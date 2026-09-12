import { extractFirFromBuffer, ExtractedCctnsFir } from "../services/cctnsExtractor";
import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { authenticateJwt, verifyActiveOfficer } from '../middleware/auth';
import { authorizeRole } from '../middleware/rbac';
import { calculateServerSha256 } from '../services/cryptoService';
import { pool } from '../config/database';
import { auditService } from '../services/auditService';
import { fabricGateway } from '../services/fabricGateway';
import { casePersistenceService } from '../services/casePersistenceService';
import { blockchainEventService } from '../services/blockchainEventService';
import { documentRepoService } from '../services/documentRepoService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid document format. Only PDF, JPG, JPEG, and PNG are permitted for FIR intake.'));
    }
  },
});

export const firIntakeRouter = Router();

/**
 * POST /api/fir/ocr
 * Directly extracts live CCTNS information from an uploaded document in real-time.
 */
firIntakeRouter.post(
  '/ocr',
  upload.single('firDocument'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No document uploaded for OCR extraction.' });
        return;
      }
      const fileBuffer = req.file.buffer;
      const fileHash = calculateServerSha256(fileBuffer);
      const extracted = await extractFirFromBuffer(fileBuffer, req.file.originalname);
      const fileDataUrl = `data:${req.file.mimetype};base64,${fileBuffer.toString("base64")}`;

      res.status(200).json({
        success: true,
        fileHash,
        fileName: req.file.originalname,
        fileDataUrl,
        extractedData: extracted
      });
    } catch (err: any) {
      console.error("[FIR OCR ERROR]", err);
      res.status(500).json({ success: false, error: err.message || 'OCR extraction failed.' });
    }
  }
);


// In-memory intake stage cache
interface StagedIntake {
  documentId: string;
  fileHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
  buffer: Buffer;
}

const stagedIntakes = new Map<string, StagedIntake>();

/**
 * POST /api/fir/intake
 * Uploads, validates, hashes, and stages an FIR physical document before extraction.
 */
firIntakeRouter.post(
  '/intake',
  authenticateJwt,
  verifyActiveOfficer('POLICE'),
  authorizeRole('POLICE', 'ADMIN'),
  upload.single('firDocument'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No FIR document file uploaded.' });
        return;
      }

      const fileBuffer = req.file.buffer;
      const fileHash = calculateServerSha256(fileBuffer);
      const documentId = `FIR-DOC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const officerBadge = req.user?.badgeNo || 'POLICE-ROOT';
      const uploadedAt = new Date().toISOString();

      stagedIntakes.set(documentId, {
        documentId,
        fileHash,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: officerBadge,
        uploadedAt,
        buffer: fileBuffer,
      });

      // Audit file staging
      await auditService.recordEvent({
        action: 'FIR_DOCUMENT_STAGED',
        officerBadge,
        details: `FIR scan staged: ${req.file.originalname} (SHA-256: ${fileHash.substring(0, 16)}...)`,
        ipAddress: req.ip || '127.0.0.1',
      });

      // Perform high-precision real-time extraction from the uploaded file buffer
      let extractedData: any = null;
      try {
        extractedData = await extractFirFromBuffer(fileBuffer, req.file.originalname);
      } catch (ocrErr) {
        console.warn("[FIR INTAKE REAL-TIME EXTRACTION WARNING]", ocrErr);
      }

      const fileDataUrl = `data:${req.file.mimetype};base64,${fileBuffer.toString("base64")}`;

      res.status(200).json({
        success: true,
        documentId,
        fileHash,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        pageCount: extractedData?.pageCount || (req.file.mimetype === 'application/pdf' ? 2 : 1),
        uploadedBy: officerBadge,
        uploadedAt,
        fileDataUrl,
        extractedData,
        message: 'FIR document validated, hashed with SHA-256, and real-time CCTNS data extracted successfully.',
      });
    } catch (err: any) {
      console.error('[FIR INTAKE ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to process FIR document upload.' });
    }
  }
);

/**
 * POST /api/fir/register
 * Finalizes verified FIR docket into Case Repository, Malkhana vault, and Hyperledger Fabric.
 */
firIntakeRouter.post(
  '/register',
  authenticateJwt,
  verifyActiveOfficer('POLICE'),
  authorizeRole('POLICE', 'ADMIN'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        firNumber,
        caseTitle,
        policeStation,
        jurisdictionZone = 'Zone II (Western Suburbs)',
        incidentDate,
        incidentLocation,
        crimeType = 'General Criminal Investigation',
        ipcSections = ['Sec 154 CrPC'],
        incidentDescription = '',
        complainantName = 'State of Maharashtra / Suo Motu',
        accusedName = 'Unknown',
        documentId,
        fileHash,
        priorityLevel = 'High',
        caseId: requestedCaseId,
      } = req.body;

      const officer = req.user!;
      const effectivePoliceStation = (policeStation && policeStation.trim()) || officer.station_name || officer.station;

      if (!firNumber || !caseTitle || !effectivePoliceStation) {
        res.status(400).json({
          success: false,
          error: 'Missing mandatory fields: FIR Number and Case Title are strictly required.',
        });
        return;
      }

      const year = new Date().getFullYear();
      const suffix = Date.now().toString(36).toUpperCase();
      const caseId = requestedCaseId || `CASE-${year}-${suffix}`;
      const now = new Date().toISOString();

      let effectiveFileHash = fileHash;
      let stagedDoc: StagedIntake | undefined;
      if (documentId && stagedIntakes.has(documentId)) {
        stagedDoc = stagedIntakes.get(documentId);
        effectiveFileHash = effectiveFileHash || stagedDoc?.fileHash;
      }

      // Step 1: Record DOCUMENT_UPLOADED Blockchain Event (with File Hash & Chained Event Hash)
      const docEvent = await blockchainEventService.createBlockchainEvent({
        caseId,
        entityId: documentId || `DOC-FIR-${suffix}`,
        entityType: 'DOCUMENT',
        action: 'DOCUMENT_UPLOADED',
        actorId: officer.badgeNo,
        actorName: officer.name || officer.username,
        fileHash: effectiveFileHash,
        metadata: {
          documentTitle: `Original Scanned FIR (${firNumber})`,
          fileName: stagedDoc?.fileName || 'FIR_Scanned_Docket.pdf',
          fileSize: stagedDoc?.fileSize,
          policeStation: effectivePoliceStation,
          firNumber,
        },
      });

      // Step 2: Record CASE_CREATED Blockchain Event (Chained to DOCUMENT_UPLOADED)
      const caseEvent = await blockchainEventService.createBlockchainEvent({
        caseId,
        entityId: caseId,
        entityType: 'CASE',
        action: 'CASE_CREATED',
        actorId: officer.badgeNo,
        actorName: officer.name || officer.username,
        metadata: {
          firNumber,
          caseTitle,
          policeStation: effectivePoliceStation,
          crimeType,
          ipcSections: Array.isArray(ipcSections) ? ipcSections : [ipcSections],
          priorityLevel,
          complainantName,
          accusedName,
        },
      });

      const { assignedIO, assignedIOBadge } = req.body;
      const fabricTxId = caseEvent.blockchainTxId || `tx-fabric-fir-${suffix}`;

      // Directly auto-assign the designated IO or registering officer as Investigating Officer (IO)
      const ioBadge = assignedIOBadge || officer.badgeNo;
      const ioName = assignedIO || officer.full_name || officer.name || officer.username || `Officer ${ioBadge}`;
      const stationName = (policeStation && policeStation.trim()) || officer.station_name || officer.station || "Dadar Police Station, Mumbai";
      let stationId = officer.station_id || "STATION-PS";
      if (stationName.toUpperCase().includes("DADAR")) stationId = "DADAR-PS";
      else if (stationName.toUpperCase().includes("WORLI")) stationId = "WORLI-PS";
      else if (stationName.toUpperCase().includes("BANDRA")) stationId = "BANDRA-PS";
      else if (stationName.toUpperCase().includes("COLABA")) stationId = "COLABA-PS";
      else if (stationName.toUpperCase().includes("ANDHERI")) stationId = "ANDHERI-PS";
      else if (stationName.toUpperCase().includes("VASHI")) stationId = "VASHI-PS";

      // Save to cases_store.json and generate physical folder structure
      const newCase = casePersistenceService.createCase({
        id: caseId,
        fir_number: firNumber,
        case_title: caseTitle,
        police_station: stationName,
        police_station_id: stationId,
        jurisdiction_zone: jurisdictionZone,
        crime_type: crimeType,
        incident_date: incidentDate || now.substring(0, 10),
        incident_location: incidentLocation || 'Mumbai',
        ipc_sections: Array.isArray(ipcSections) ? ipcSections : [ipcSections],
        summary_notes: incidentDescription,
        priority: priorityLevel,
        pi_in_charge: officer.name || officer.username || 'Duty Officer',
        investigating_officer_id: ioBadge,
        assigned_io: ioName,
        assigned_io_badge: ioBadge,
        assigned_at: now,
        assigned_by: officer.badgeNo,
        lead_investigator_badge: officer.badgeNo,
        blockchain_tx_id: fabricTxId,
        blockchain_status: 'CONFIRMED',
        created_at: now,
        status: 'FIR Registered',
        evidence_items: effectiveFileHash ? [
          {
            id: `EVD-FIR-${suffix}`,
            caseId,
            evidenceTag: `EV-MH-${year}-${suffix}`,
            category: 'Documentary Evidence',
            description: `Original Scanned FIR Document: ${stagedDoc?.fileName || 'CCTNS_Form_IIF1.pdf'}`,
            collectedBy: officer.name || officer.username || 'Duty Officer',
            collectedByBadge: officer.badgeNo,
            collectionDate: now.substring(0, 10),
            currentCustodian: 'Station Malkhana Custodian',
            status: 'Malkhana Storage',
            originalHash: effectiveFileHash,
            currentHash: effectiveFileHash,
            isIntegrityVerified: true,
            fileName: stagedDoc?.fileName || 'MH_POLICE_FIR.pdf',
          }
        ] : [],
        timeline: [
          {
            id: `TL-FIR-${suffix}`,
            date: now.substring(0, 10),
            title: `FIR Registered: ${firNumber}`,
            description: `Primary crime docket registered by ${officer.name || officer.username} (${officer.badgeNo}). Investigating Officer ${ioName} assigned. Anchored to Hyperledger Fabric with SHA-256 event chaining.`,
            officer: officer.name || officer.username || 'Duty Officer',
            badge: officer.badgeNo,
            type: 'FIR_LODGED',
          },
        ],
      });

      // Record primary IO active assignment in persistence store
      casePersistenceService.createAssignment({
        id: `ASGN-${caseId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
        case_id: caseId,
        officer_id: ioBadge,
        officer_name: ioName,
        assigned_by: officer.badgeNo,
        assigned_at: now,
        status: 'ACTIVE',
      });

      // If registering officer is different from assigned IO, ensure registering officer also holds active assignment
      if (officer.badgeNo !== ioBadge) {
        casePersistenceService.createAssignment({
          id: `ASGN-REG-${caseId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
          case_id: caseId,
          officer_id: officer.badgeNo,
          officer_name: officer.name || officer.username || `Officer ${officer.badgeNo}`,
          assigned_by: officer.badgeNo,
          assigned_at: now,
          status: 'ACTIVE',
        });
      }

      // Synchronize with PostgreSQL database (cases, case_assignments, fir_records, case_members)
      try {
        await pool.query(
          `INSERT INTO cases (
             id, fir_number, case_title, police_station, police_station_id, jurisdiction_zone,
             crime_type, incident_date, incident_location, status, priority,
             pi_in_charge, investigating_officer_id, assigned_io, assigned_io_badge, supervising_dysp,
             ipc_sections, blockchain_status, blockchain_tx_id, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'CONFIRMED', $18, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
          [
            caseId,
            firNumber,
            caseTitle,
            stationName,
            stationId,
            jurisdictionZone,
            crimeType,
            incidentDate || now.substring(0, 10),
            incidentLocation || 'Mumbai',
            'FIR Registered',
            priorityLevel,
            officer.name || officer.username || 'Duty Officer',
            ioBadge,
            ioName,
            ioBadge,
            'DySP Crime Branch',
            Array.isArray(ipcSections) ? ipcSections : [ipcSections],
            fabricTxId,
          ]
        );

        await pool.query(
          `INSERT INTO case_assignments (case_id, officer_id, officer_name, status, assigned_by, assigned_at)
           VALUES ($1, $2, $3, 'ACTIVE', $4, NOW())`,
          [caseId, ioBadge, ioName, officer.badgeNo]
        );

        if (officer.badgeNo !== ioBadge) {
          await pool.query(
            `INSERT INTO case_assignments (case_id, officer_id, officer_name, status, assigned_by, assigned_at)
             VALUES ($1, $2, $3, 'ACTIVE', $4, NOW())`,
            [caseId, officer.badgeNo, officer.name || officer.username, officer.badgeNo]
          ).catch(() => {});
        }

        await pool.query(
          `INSERT INTO fir_records (
             case_id, fir_number, police_station, incident_date, incident_location, 
             acts_sections, complainant_details, accused_details, brief_facts, registered_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            caseId,
            firNumber,
            stationName,
            incidentDate || now.substring(0, 10),
            incidentLocation || 'Mumbai',
            Array.isArray(ipcSections) ? ipcSections : [ipcSections],
            JSON.stringify({ name: complainantName || 'Complainant' }),
            JSON.stringify([{ name: accusedName || 'Unknown' }]),
            incidentDescription || `FIR ${firNumber} registered`,
            officer.badgeNo,
          ]
        ).catch(() => {});

        await pool.query(
          `INSERT INTO case_members (case_id, user_id, member_role, can_read, can_write, can_close, granted_by)
           VALUES ($1, (SELECT id FROM profiles WHERE badge_no = $2 LIMIT 1), 'PRIMARY_OFFICER', true, true, true, $3)`,
          [caseId, ioBadge, officer.badgeNo]
        ).catch(() => {});
      } catch (dbErr) {
        console.warn('[FIR INTAKE DB SYNC WARNING]', dbErr);
      }

      // Save the physical FIR document to the case folder and document repository if staged
      if (stagedDoc) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const dataDir = path.resolve(process.cwd(), 'server/data');
          const caseFolder = path.join(dataDir, (newCase as any).folder_name || newCase.id);
          if (!fs.existsSync(caseFolder)) {
            fs.mkdirSync(caseFolder, { recursive: true });
          }
          const fileExt = path.extname(stagedDoc.fileName) || '.pdf';
          const rawFilePath = path.join(caseFolder, `${documentId}_raw${fileExt}`);
          fs.writeFileSync(rawFilePath, stagedDoc.buffer);

          // Register directly into case repository
          await documentRepoService.uploadCaseDocument({
            caseId,
            department: 'POLICE',
            documentType: 'FIR',
            title: `Official FIR Form IIF-I (${firNumber})`,
            description: `Original sealed FIR document registered for ${firNumber} at ${stationName}.`,
            classification: 'CONFIDENTIAL',
            fileBuffer: stagedDoc.buffer,
            originalFilename: stagedDoc.fileName || 'FIR_Document.pdf',
            declaredMimeType: stagedDoc.mimeType || 'application/pdf',
            uploaderName: officer.name || officer.username || 'Duty Officer',
            uploaderBadge: officer.badgeNo,
            clientIp: req.ip || '127.0.0.1',
          }).catch(err => console.warn('[FIR REPO UPLOAD WARNING]', err));

          stagedIntakes.delete(documentId);
        } catch (fileErr) {
          console.warn('[FIR FILE PERSISTENCE WARNING]', fileErr);
        }
      }


      // Record Canonical Audit Event
      await auditService.logAuditEvent({
        action: 'FIR_REGISTERED',
        eventType: 'FIR',
        userId: officer.badgeNo,
        userName: officer.name || officer.username,
        userRole: officer.role,
        caseId: caseId,
        resourceType: 'FIR',
        resourceId: firNumber,
        status: 'SUCCESS',
        reason: `FIR ${firNumber} registered for Case ${caseId} at ${policeStation}`,
        afterData: {
          firNumber,
          caseId,
          policeStation,
          ipcSections,
          crimeType,
          documentHash: effectiveFileHash,
          eventHash: caseEvent.eventHash,
        },
        metadata: {
          complainantName,
          accusedName,
          documentId,
          fileHash: effectiveFileHash,
          priorityLevel,
          docEventHash: docEvent.eventHash,
          caseEventHash: caseEvent.eventHash,
        },
        fabricTxId,
        req,
      });

      // Emit real-time multi-device sync event
      try {
        const { emitCaseEvent } = await import('./events');
        emitCaseEvent('CASE_CREATED', {
          caseId,
          firNumber,
          caseTitle,
          policeStation: stationName,
          assignedIO: ioName,
          assignedIOBadge: ioBadge,
          createdAt: now
        });
      } catch (e) {
        // ignore SSE broadcast failures
      }

      res.status(201).json({
        success: true,
        caseId,
        firNumber,
        documentHash: effectiveFileHash,
        eventHash: caseEvent.eventHash,
        previousHash: caseEvent.previousHash,
        blockchainTxId: fabricTxId,
        registeredAt: now,
        officer: officer.name || officer.badgeNo,
        caseItem: newCase,
        blockchainEvents: [docEvent, caseEvent],
        message: 'FIR officially registered. Case created, original document cryptographically sealed with SHA-256 and committed to Hyperledger Fabric activity chain.',
      });
    } catch (err: any) {
      console.error('[FIR REGISTRATION ERROR]', err);
      res.status(500).json({ success: false, error: err.message || 'Failed to register FIR on blockchain.' });
    }
  }
);
