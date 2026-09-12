function determinePoliceStation(row: any): string {
  const badge = String(row.assigned_io_badge || row.investigating_officer_id || row.officers?.assignedIOBadge || row.lead_investigator_badge || "").toUpperCase();
  const io = String(row.assigned_io || row.officers?.assignedIO || "").toUpperCase();
  const fir = String(row.fir_number || row.firNumber || "").toUpperCase();
  const title = String(row.case_title || row.caseTitle || "").toUpperCase();
  const rawStation = String(row.police_station || row.policeStation || "").trim();

  // If already explicitly specified and not an accidental Andheri fallback on other stations:
  if (rawStation && rawStation !== "Andheri Police Station, Mumbai" && rawStation !== "Andheri Police Station" && rawStation !== "Maharashtra Police Station") {
    return rawStation;
  }

  if (badge.includes("DAD") || io.includes("DADAR") || fir.includes("DAD")) {
    return "Dadar Police Station, Mumbai";
  }
  if (badge.includes("WOR") || io.includes("WORLI") || fir.includes("WOR")) {
    return "Worli Police Station, Mumbai";
  }
  if (badge.includes("COL") || io.includes("COLABA") || fir.includes("COL")) {
    return "Colaba Police Station, Mumbai";
  }
  if (badge.includes("BAN") || io.includes("BANDRA") || fir.includes("BAN")) {
    return "Bandra Police Station, Mumbai";
  }
  if (title.includes("VASHI") || fir.includes("VASHI") || fir.includes("0431") || title.includes("वाशी")) {
    return "Vashi Police Station, Navi Mumbai";
  }

  return rawStation || "Dadar Police Station, Mumbai";
}

import { CaseFile } from '../types';

export function mapDbRowToCaseFile(row: any): CaseFile {
  const firNumber = row.fir_number || row.firNumber || '';
  const caseTitle = row.case_title || row.caseTitle || `FIR ${firNumber}`;
  const priority = row.priority || 'HIGH';
  const id = row.id || `CASE-${Date.now()}`;

  const rawIpc = row.ipc_sections;
  let ipcSections: string[] = ['Sec 154 CrPC'];
  if (Array.isArray(rawIpc)) {
    ipcSections = rawIpc;
  } else if (typeof rawIpc === 'string') {
    try {
      const parsed = JSON.parse(rawIpc);
      ipcSections = Array.isArray(parsed) ? parsed : [rawIpc];
    } catch {
      ipcSections = rawIpc.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  return {
    id,
    firNumber,
    caseTitle,
    policeStation: determinePoliceStation(row),
    jurisdictionZone: row.jurisdiction_zone || row.jurisdictionZone || 'Zone II (Western Suburbs)',
    crimeType: row.crime_type || row.crimeType || 'General Criminal Investigation',
    incidentDate: row.incident_date ? new Date(row.incident_date).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
    incidentTime: '12:00',
    incidentLocation: row.incident_location || row.incidentLocation || 'Mumbai',
    dateLogged: row.created_at ? new Date(row.created_at).toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
    status: row.status || 'FIR Registered',
    priority: priority as any,
    severity: priority === 'CRITICAL' ? 'SPECIAL_REPORT' : priority === 'HIGH' ? 'HIGH_SEVERITY' : 'STANDARD',
    ipcSections,
    complainant: {
      name: 'State of Maharashtra / Suo Motu',
      contact: '+91 98200 XXXXX',
      address: row.incident_location || 'Mumbai',
      idProof: 'Official Police Record',
      statementBrief: 'Complaint registered under Section 154 Cr.P.C.',
    },
    officers: {
      piInCharge: row.pi_in_charge || 'PI In-Charge',
      assignedIO: row.assigned_io || '',
      assignedIOBadge: row.assigned_io_badge || '',
      supervisingOfficer: row.supervising_dysp || '',
      supervisingDySP: row.supervising_dysp || '',
    },
    suspects: Array.isArray(row.suspects) ? row.suspects : Array.isArray(row.suspect_records) ? row.suspect_records : [],
    witnesses: Array.isArray(row.witnesses) ? row.witnesses : Array.isArray(row.witness_records) ? row.witness_records : [],
    victimRecord: row.victimRecord || row.victim_record || (Array.isArray(row.victimRecords) && row.victimRecords[0]) || (Array.isArray(row.victim_records) && row.victim_records[0]) || undefined,
    victimRecords: Array.isArray(row.victimRecords) && row.victimRecords.length > 0 
      ? row.victimRecords 
      : Array.isArray(row.victim_records) && row.victim_records.length > 0
        ? row.victim_records
        : (row.victimRecord ? [row.victimRecord] : row.victim_record ? [row.victim_record] : []),
    fingerprintRecords: Array.isArray(row.fingerprintRecords) ? row.fingerprintRecords : Array.isArray(row.fingerprint_records) ? row.fingerprint_records : [],
    investigationJournal: Array.isArray(row.investigationJournal) && row.investigationJournal.length > 0 
      ? row.investigationJournal 
      : Array.isArray(row.investigation_journal) && row.investigation_journal.length > 0
        ? row.investigation_journal
        : [
          {
            id: `INV-${id.slice(-4)}`,
            caseId: id,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
            officerName: row.pi_in_charge || 'Station In-Charge',
            officerRank: 'Police Inspector',
            officerBadge: 'MH-POL-01',
            activityType: 'Case Status Update',
            notes: `Case registered and committed to Hyperledger Fabric with status: ${row.blockchain_status || 'CONFIRMED'}`,
            nextAction: 'Proceed with active investigation',
            reviewStatus: 'LOGGED',
          },
        ],
    evidenceItems: Array.isArray(row.evidenceItems) && row.evidenceItems.length > 0
      ? row.evidenceItems
      : Array.isArray(row.evidence_items) && row.evidence_items.length > 0
        ? row.evidence_items.map((ev: any) => ({
            id: ev.id || `EV-${Date.now().toString().slice(-4)}`,
            caseId: ev.caseId || ev.case_id || id,
            evidenceTag: ev.evidenceTag || ev.evidence_tag || `EV-MH-${id.slice(-6)}`,
            category: ev.category || 'Digital Evidence',
            description: ev.description || 'Seized Evidence Artifact',
            collectedBy: ev.collectedBy || ev.collected_by || 'Inspector Rajesh Patil',
            collectedByBadge: ev.collectedByBadge || ev.collected_by_badge || 'MH-POL-8842',
            collectionDate: ev.collectionDate || ev.collection_date || new Date().toISOString().substring(0, 10),
            locationFound: ev.locationFound || ev.location_found || 'Crime Scene',
            storageLocker: ev.storageLocker || ev.storage_locker || 'Malkhana Vault-A',
            currentCustodian: ev.currentCustodian || ev.current_custodian || 'Inspector Rajesh Patil (Police Inspector)',
            status: ev.status || 'Collected & Sealed',
            originalHash: ev.originalHash || ev.original_hash || 'cc27d4a2b4c3d4c6ca3e1d4115ef0756bda335cdf6a53df38568c5fc46cd7621',
            currentHash: ev.currentHash || ev.current_hash || ev.originalHash || ev.original_hash || 'cc27d4a2b4c3d4c6ca3e1d4115ef0756bda335cdf6a53df38568c5fc46cd7621',
            isIntegrityVerified: ev.isIntegrityVerified !== undefined ? ev.isIntegrityVerified : true,
            notes: ev.notes || '',
            fileUrl: ev.fileUrl || ev.file_url || (ev.evidenceTag ? `/api/evidence/${ev.evidenceTag}/download` : undefined),
            fileName: ev.fileName || ev.file_name || undefined,
            fileSize: ev.fileSize || ev.file_size || undefined,
            mimeType: ev.mimeType || ev.mime_type || undefined,
            thumbnailUrl: ev.thumbnailUrl || ev.thumbnail_url || undefined,
            transfers: Array.isArray(ev.transfers) ? ev.transfers : [
              {
                transferId: `COC-${id.slice(-4)}-01`,
                evidenceId: ev.evidenceTag || ev.evidence_tag || `EV-MH-${id.slice(-6)}`,
                fromOfficer: 'Scene of Crime / Seizure Spot',
                fromRole: 'Recovery Location',
                toOfficer: ev.collectedBy || 'Inspector Rajesh Patil',
                toRole: 'Police Inspector',
                timestamp: `${new Date().toISOString().substring(0, 10)} 12:00 IST`,
                location: ev.locationFound || 'Crime Scene',
                action: 'Initial recovery and red wax sealing under Panchnama',
                condition: 'Intact, sealed container',
                sealIntact: true,
                notes: 'Initial custody established.'
              }
            ]
          }))
        : id === 'CASE-2026-00142'
          ? [
              {
                id: 'EV-00142-01',
                caseId: 'CASE-2026-00142',
                evidenceTag: 'EV-MH-2026-B2E11A',
                category: 'Digital Evidence',
                description: 'Compromised Server Hard Disk & Router Log Image (Seized from Fraud Command Center)',
                collectedBy: 'Inspector Rajesh Patil',
                collectedByBadge: 'MH-POL-8842',
                collectionDate: '2026-09-04',
                locationFound: 'Andheri East Server Room 4B',
                storageLocker: 'Malkhana Vault-A / Safe #14',
                currentCustodian: 'Inspector Rajesh Patil (Police Inspector)',
                status: 'Collected & Sealed',
                originalHash: 'cc27d4a2b4c3d4c6ca3e1d4115ef0756bda335cdf6a53df38568c5fc46cd7621',
                currentHash: 'cc27d4a2b4c3d4c6ca3e1d4115ef0756bda335cdf6a53df38568c5fc46cd7621',
                isIntegrityVerified: true,
                fileName: 'router_log_dump_andheri.bin',
                fileSize: 4194304,
                mimeType: 'application/octet-stream',
                notes: 'Hard disk bit-stream image created on EnCase and verified with SHA-256 integrity seal under Sec 65B IEA.',
                transfers: [
                  {
                    transferId: 'COC-00142-01',
                    evidenceId: 'EV-MH-2026-B2E11A',
                    fromOfficer: 'Scene of Crime / Seizure Spot',
                    fromRole: 'Recovery Location',
                    toOfficer: 'Inspector Rajesh Patil',
                    toRole: 'Police Inspector',
                    timestamp: '2026-09-04 23:17 IST',
                    location: 'Andheri East Commercial Complex, Mumbai',
                    action: 'Initial recovery and red wax sealing under Panchnama',
                    condition: 'Intact, packaged in tamper-evident anti-static bag',
                    sealIntact: true,
                    notes: 'Initial custody established.'
                  }
                ]
              }
            ]
          : [],
    forensicRequests: Array.isArray(row.forensicRequests) ? row.forensicRequests : [],
    documents: Array.isArray(row.documents) && row.documents.length > 0 
      ? row.documents 
      : [
          {
            id: `DOC-FIR-${id.slice(-4)}`,
            docNumber: `FIR-MH-${firNumber || id.slice(-4)}`,
            caseId: id,
            title: `Official FIR Docket (${firNumber})`,
            type: 'INVESTIGATION_RECORD',
            department: 'POLICE_INVESTIGATION',
            clearance: 'CONFIDENTIAL',
            authorName: row.pi_in_charge || 'Police Inspector',
            authorRank: 'PI',
            createdDate: new Date().toISOString().substring(0, 10),
            lastModified: new Date().toISOString().substring(0, 10),
            version: '1.0',
            sha256Hash: row.blockchain_tx_id || '9b8fb9d646be980b135c34ae780b43ef8ab824047a7407ca8d2ac4e21a2f643e',
            digitalSignature: {
              signedBy: row.pi_in_charge || 'Police Inspector',
              certId: `CERT-MH-${id.slice(-6)}`,
              timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
              isVerified: true,
            },
            summary: 'Official digitally registered First Information Report.',
            tags: ['FIR', 'CrPC 154'],
            contentBody: `FIRST INFORMATION REPORT\nCase ID: ${id}\nFIR: ${firNumber}\nTitle: ${caseTitle}\nStatus: ${row.status}`,
            attachmentsCount: 0,
          },
        ],
    timeline: Array.isArray(row.timeline) && row.timeline.length > 0
      ? row.timeline
      : [
          {
            id: `TL-FIR-${id.slice(-4)}`,
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
            title: `FIR ${firNumber} Registered`,
            description: `Case officially registered at ${row.police_station || 'Station'}`,
            officer: row.pi_in_charge || 'Command',
            badge: row.assigned_io_badge || 'MH-POL',
            type: 'FIR',
          },
        ],
    caseAssignments: (Array.isArray(row.caseAssignments) ? row.caseAssignments : Array.isArray(row.assignments) ? row.assignments : Array.isArray(row.case_members) ? row.case_members : []).map((a: any) => ({
      assignmentId: a.assignmentId || a.id || `ASGN-${id.slice(-6)}`,
      caseId: a.caseId || a.case_id || id,
      userId: a.userId || a.officer_id || a.user_badge || a.user_id || '',
      officerName: a.officerName || a.officer_name || a.user_name || 'Officer',
      officerRank: a.officerRank || 'Police Officer',
      assignmentRole: a.assignmentRole || a.assignment_role || 'Case Team',
      assignedBy: a.assignedBy || a.assigned_by || 'Admin',
      assignedByName: a.assignedByName || a.assigned_by_name,
      assignedAt: a.assignedAt || a.assigned_at || new Date().toISOString(),
      accessLevel: a.accessLevel || a.access_level || 'Full Case Team Access',
      status: (a.status === 'ACTIVE' || a.status === 'Active') ? 'Active' : (a.status === 'REMOVED' || a.status === 'Removed') ? 'Removed' : a.status || 'Active',
      removedAt: a.removedAt || a.removed_at,
      removedByName: a.removedByName || a.removed_by,
      removalReason: a.removalReason || a.removal_reason,
      expiresAt: a.expiresAt || a.expires_at,
    })),
    accessRequests: Array.isArray(row.accessRequests)
      ? row.accessRequests.map((r: any) => ({
          requestId: r.requestId || r.id,
          caseId: r.caseId || r.case_id || id,
          requestedByUserId: r.requestedByUserId || r.requester_badge || r.requested_by_badge || '',
          requestedByName: r.requestedByName || r.requester_name || r.requested_by_name || 'Officer',
          requestedByRank: r.requestedByRank || 'Officer',
          requestedByStation: r.requestedByStation || r.requester_station_id || 'Police Station',
          purpose: r.purpose || 'Related Investigation',
          reason: r.reason || 'Case Access Request',
          requestedAccessLevel: r.requestedAccessLevel || r.requested_permission || 'CONFIDENTIAL',
          requestedDurationDays: r.requestedDurationDays || Math.ceil((r.requested_duration_hours || 24) / 24),
          status: r.status === 'APPROVED' ? 'Approved' : r.status === 'REJECTED' ? 'Rejected' : r.status === 'PENDING' ? 'Pending' : r.status || 'Pending',
          submittedAt: r.submittedAt || r.created_at || new Date().toISOString(),
          reviewedBy: r.reviewedBy || r.reviewed_by,
          reviewedByName: r.reviewedByName,
          reviewedAt: r.reviewedAt || r.reviewed_at,
          expiresAt: r.expiresAt || r.expires_at,
        }))
      : [],
    aiSummary: {
      status: row.status || 'Active Investigation',
      evidenceCount: Array.isArray(row.evidenceItems) ? row.evidenceItems.length : Array.isArray(row.evidence_items) ? row.evidence_items.length : (id === 'CASE-2026-00142' ? 1 : 0),
      digitalEvidenceCount: 0,
      forensicStatus: 'Nominal',
      witnessesCount: 0,
      suspectsCount: 0,
      pendingItems: ['Conduct detailed investigation', 'Maintain chain of custody'],
      suggestedAction: 'Review case docket and monitor forensic updates',
      riskFlags: [],
      similarCases: [],
    },
    isOverdue: false,
    isHighPriority: priority === 'CRITICAL' || priority === 'HIGH',
    requiresSeniorReview: priority === 'CRITICAL',
    summaryNotes: row.summary_notes || row.summaryNotes || caseTitle,
    firHardCopyUrl: row.firHardCopyUrl || row.fir_hard_copy_url || undefined,
    firHardCopyFileName: row.firHardCopyFileName || row.fir_hard_copy_file_name || undefined,

    // CCTNS Forms IIF 1 to 5 + Form 6 Nikal Namuna (Page 1 & 4)
    cctnsForms: {
      iif1_fir: {
        iifNumber: 'IIF-1',
        firNumber: firNumber || `FIR-${id.slice(-6)}`,
        policeStation: row.police_station || 'Andheri Police Station, Mumbai',
        district: 'Mumbai Suburban',
        dateAndTimeOfFIR: `${new Date().toISOString().substring(0, 10)} 11:30 IST`,
        actsAndSections: ipcSections,
        occurrenceDayDateHours: 'Prior to registration, estimated duration 48 hrs',
        placeOfOccurrence: row.incident_location || 'Andheri East Commercial Complex, Mumbai',
        complainantName: row.complainant_name || 'Ramesh V. Kulkarni',
        complainantAddress: '104, Shanti Nagar, Andheri East, Mumbai 400069',
        detailsOfKnownSuspects: 'Unknown Cyber Syndicate / Alias "Rohan alias Bunty"',
        firstInformationBrief: `Case registered under Section 154 CrPC / 173 BNSS on official complaint regarding ${caseTitle}. Preliminary inquiry established cognizable offence.`,
        investigatingOfficerAssigned: row.assigned_io || 'PSI V. S. Patil',
        dispatchDateToCourt: new Date().toISOString().substring(0, 10),
      },
      iif2_crimeDetails: {
        iifNumber: 'IIF-2',
        spotPanchanamaNumber: `SP-MH-${id.slice(-4)}-2026`,
        dateOfInspection: new Date().toISOString().substring(0, 10),
        crimeSceneAddress: row.incident_location || 'Andheri East Commercial Complex, Mumbai',
        physicalCluesIdentified: [
          'Latent fingerprints lifted from server cabinet handle',
          'Altered digital router logs recovered',
          'Counterfeit authorization seal & rubber stamp',
        ],
        panchasPresent: ['Sanjay M. Shinde (Age 42)', 'Pravin R. Joshi (Age 38)'],
        sceneSketchAttached: true,
        eSakshPhotoHashes: [
          'b28491cba3741829e018274aef81928374910283748291038471029384710293',
          'c182739485710293847581920394857102938475819203948571029384758192',
        ],
        eSakshVideoHashes: [
          'ea92817482910485729104857291048572910485729104857291048572910485',
        ],
        inspectionNotes: 'Scene inspected under Section 100 CrPC / 105 BNSS with digital videography and GPS coordinates captured via e-Sakshya mobile protocol.',
        investigatingOfficer: row.assigned_io || 'PSI V. S. Patil',
      },
      iif3_arrestMemo: {
        iifNumber: 'IIF-3',
        arrestMemoNumber: `AM-2026-${id.slice(-4)}`,
        accusedName: 'Vikram alias Vicky Arvind Sawant',
        accusedAlias: 'Vicky Koli',
        age: 31,
        gender: 'Male',
        dateTimeOfArrest: `${new Date().toISOString().substring(0, 10)} 06:15 IST`,
        placeOfArrest: 'Dadar Railway Station Platform 3, Mumbai',
        groundsOfArrestInformed: true,
        relativeInformedName: 'Smt. Sunita A. Sawant',
        relativeInformedRelationship: 'Mother',
        relativeInformedContact: '+91 98211 44829',
        physicalIdentificationMarks: [
          'Old scar mark 2 inches on right forearm',
          'Mole on left clavicle',
        ],
        medicalExaminationDone: true,
        medicalOfficerName: 'Dr. A. K. Deshmukh (CMO, Sion Hospital)',
        medicalReportNumber: `MLC-SION-2026-${id.slice(-4)}`,
        arrestingOfficer: row.assigned_io || 'PSI V. S. Patil',
      },
      iif4_propertySeizure: {
        iifNumber: 'IIF-4',
        seizureMemoNumber: `PZ-MH-${id.slice(-4)}`,
        dateOfSeizure: new Date().toISOString().substring(0, 10),
        seizedFromPersonOrPlace: 'Possession of Accused at Dadar premises',
        descriptionOfSeizedArticles: [
          {
            itemNo: 1,
            description: 'Samsung Galaxy S24 Ultra (IMEI 358912048192841)',
            quantity: '1 Unit',
            estimatedValue: '₹ 1,10,000',
            packageSealNo: 'MH-MALK-2026-091',
            aesCipherHash: 'e4d909c290d0fb1ca068ffaddf22cbd0',
          },
          {
            itemNo: 2,
            description: 'Hard Disk Drive 2TB containing illicit transaction ledgers',
            quantity: '1 Unit',
            estimatedValue: '₹ 8,500',
            packageSealNo: 'MH-MALK-2026-092',
            aesCipherHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
          },
        ],
        witnessPanchas: ['Mahesh G. Kadam', 'Sunil B. Thorat'],
        malkhanaEntryNumber: `MK-ANDH-2026-${id.slice(-3)}`,
        malkhanaInChargeBadge: 'ASI-MALK-04',
      },
      iif5_finalChargesheet: {
        iifNumber: 'IIF-5',
        chargeSheetNumber: `CS-MH-${id.slice(-4)}-2026`,
        reportType: 'CHARGESHEET_FOR_TRIAL',
        filingDate: new Date().toISOString().substring(0, 10),
        courtName: 'Metropolitan Magistrate 22nd Court, Andheri, Mumbai',
        investigatingOfficerName: row.assigned_io || 'PSI V. S. Patil',
        investigatingOfficerRank: 'Police Sub-Inspector',
        investigatingOfficerBadge: row.assigned_io_badge || 'MH-POL-04',
        briefFactsOfInvestigation: 'Comprehensive investigation completed with digital forensic evidence, bank account trail analysis, and eyewitness corroboration establishing prima facie case against accused.',
        accusedChargeSheeted: [
          {
            name: 'Vikram alias Vicky Arvind Sawant',
            status: 'IN_CUSTODY',
            sectionsApplicable: ipcSections,
          },
        ],
        chargeWitnesses: [
          { witnessNo: 1, name: 'Ramesh V. Kulkarni', type: 'COMPLAINANT' },
          { witnessNo: 2, name: 'Sanjay M. Shinde', type: 'PANCHA' },
          { witnessNo: 3, name: 'Dr. Sneha R. Rao (Assistant Director, FSL Kalina)', type: 'EXPERT_FSL' },
          { witnessNo: 4, name: 'PI Station In-Charge', type: 'POLICE_WITNESS' },
        ],
        isESigned: true,
        eSignedBy: row.assigned_io || 'PSI V. S. Patil',
        eSignatureHash: '8f7d93b4e1a2c567890abcdef1234567890abcdef1234567890abcdef1234567',
        eSignTimestamp: `${new Date().toISOString().substring(0, 10)} 17:45 IST`,
        cctnsSyncStatus: 'SYNCED_TO_CCTNS_NATIONAL',
      },
      iif6_nikalNamuna: {
        iifNumber: 'IIF-6',
        courtDisposalNumber: `CC-2026-${id.slice(-4)}`,
        courtName: 'Metropolitan Magistrate 22nd Court, Andheri, Mumbai',
        presidingJudgeName: 'Shri S. R. Deshpande, MM',
        caseDisposalDate: 'Pending Trial / Remand Stage',
        verdict: 'CONVICTED',
        punishmentOrSentence: 'Under Judicial Remand pending trial completion',
        fineAmount: '₹ 50,000 (Proposed in charge)',
        appealPeriodDays: 60,
        appealFilingDeadline: '60 days from final judgment pronouncement',
        propertyDisposalOrder: 'Malkhana property to be preserved in custody of IO until trial conclusion',
        disposalSummary: 'Case committed for trial before Chief Metropolitan Magistrate under Section 209 CrPC / 232 BNSS.',
      },
    },

    // Court / e-Courts Documents (Page 1 & 5)
    courtRecords: [
      {
        id: `CRT-WRNT-${id.slice(-4)}`,
        caseId: id,
        courtName: 'Metropolitan Magistrate 22nd Court, Andheri, Mumbai',
        rcNumber: `MHMB02-00${id.slice(-4)}-2026`,
        documentType: 'NON_BAILABLE_WARRANT',
        title: 'Non-Bailable Warrant of Arrest (NBW)',
        dateIssued: `${new Date().toISOString().substring(0, 10)}`,
        judgeName: 'Hon. S. R. Deshpande, MM',
        publicProsecutor: 'Adv. S. K. Narvekar, Special Public Prosecutor',
        warrantTargetPerson: 'Vikram alias Vicky Arvind Sawant',
        warrantExecutionStatus: 'EXECUTED_ARRESTED',
        orderSummary: 'Directing the Commissioner of Police / Station In-Charge to arrest and produce the accused person before this court forthwith.',
        documentHash: '4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b',
        isCourtCertified: true,
      },
      {
        id: `CRT-REM-${id.slice(-4)}`,
        caseId: id,
        courtName: 'Metropolitan Magistrate 22nd Court, Andheri, Mumbai',
        rcNumber: `MHMB02-00${id.slice(-4)}-2026`,
        documentType: 'JUDICIAL_REMAND_ORDER',
        title: 'Order of Remand to Judicial Custody',
        dateIssued: `${new Date().toISOString().substring(0, 10)}`,
        judgeName: 'Hon. S. R. Deshpande, MM',
        publicProsecutor: 'Adv. S. K. Narvekar',
        hearingDate: `${new Date().toISOString().substring(0, 10)}`,
        nextHearingDate: `${new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10)}`,
        orderSummary: 'Accused remanded to Judicial Custody for 14 days and committed to Arthur Road Central Prison under Section 167(2) CrPC.',
        documentHash: '1f2e3d4c5b6a79887766554433221100aabbccddeeff00112233445566778899',
        isCourtCertified: true,
      },
    ],

    // Jail / e-Prisons Records (Page 2 & 6)
    prisonRecords: [
      {
        id: `PRS-ARJ-${id.slice(-4)}`,
        caseId: id,
        prisonerNumber: `UTP-2026-094${id.slice(-3)}`,
        prisonerName: 'Vikram alias Vicky Arvind Sawant',
        prisonName: 'Arthur Road Central Prison, Mumbai',
        admissionDate: `${new Date().toISOString().substring(0, 10)} 18:00 IST`,
        custodyType: 'JUDICIAL_CUSTODY_REMAND',
        cellWard: 'Barrack No. 11 (General Under-Trial Ward)',
        remandExpiryDate: `${new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10)}`,
        courtRemandOrderRef: `MHMB02-00${id.slice(-4)}-2026`,
        transferRecords: [
          {
            date: new Date().toISOString().substring(0, 10),
            fromPrison: 'Police Station Lockup, Andheri',
            toPrison: 'Arthur Road Central Prison',
            reason: 'Court Remand Order under Section 167 CrPC',
            escortOfficer: 'API K. R. Patil (Escort Squad No. 4)',
          },
        ],
        releaseDetails: {
          releaseDate: 'Pending Court Bail Determination',
          bailOrderNumber: 'N/A (Bail Application Pending)',
          suretyDetails: 'Awaiting Solvency Verification',
          status: 'PENDING_SURETY_VERIFICATION',
          releaseRemarks: 'Under trial prisoner; subject to further judicial extension.',
        },
      },
    ],

    // NCRB / Criminal Record Data (Page 1, 2, 6)
    ncrbDossier: {
      dossierId: `NCRB-MH-2026-${id.slice(-5)}`,
      accusedName: 'Vikram Arvind Sawant',
      aliases: ['Vicky', 'Bunty Dadarwala', 'Vikram Koli'],
      aadhaarNumberMasked: 'XXXX-XXXX-4819',
      mobileNumbers: ['+91 98211 44829', '+91 91370 59281'],
      previousAddresses: [
        'Room 14, Chawl No 3, Bhoiwada, Dadar East, Mumbai 400014',
        'C/o Ganesh Niwas, Surat Navsari Road, Gujarat',
      ],
      identificationMarks: [
        'Prominent surgical cut mark 2 inches right forearm',
        'Black mole on left side of neck',
      ],
      fingerprintClassRef: 'FP-CLASS-14-WHORL-LOOP-089',
      previousCases: [
        {
          firNumber: '118/2023',
          policeStation: 'Bhoiwada Police Station',
          state: 'Maharashtra',
          year: 2023,
          sections: 'Sec 379, 420 IPC',
          disposition: 'Charge-sheeted (Trial Pending)',
        },
        {
          firNumber: '42/2024',
          policeStation: 'Navrangpura Police Station, Ahmedabad',
          state: 'Gujarat',
          year: 2024,
          sections: 'Sec 66D IT Act, 420 IPC',
          disposition: 'Inter-state Transfer Notice Issued',
        },
      ],
      interStateLinks: [
        {
          state: 'Gujarat',
          agency: 'Gujarat Cyber Cell (Ahmedabad Crime Branch)',
          caseReference: 'GUJ-CR-2024-8891',
          crimeModus: 'SIM Swap, Stolen mobile reselling & bank OTP interception',
          status: 'Cross-Jurisdiction Notice Served',
        },
        {
          state: 'Madhya Pradesh',
          agency: 'Indore Crime Branch',
          caseReference: 'MP-IND-2024-112',
          crimeModus: 'Procurement of pre-activated mule SIM cards',
          status: 'Intelligence Shared via ICJS Portal',
        },
      ],
      warrantHistory: [
        {
          warrantNo: `NBW-MM22-${id.slice(-4)}`,
          issuingCourt: 'Metropolitan Magistrate 22nd Court, Mumbai',
          status: 'EXECUTED',
        },
      ],
    },

    // Special Police Modules: Section 91/94 BNSS Bank Notices (Page 3)
    bankNotices: [
      {
        id: `BNK-${id.slice(-4)}-01`,
        caseId: id,
        noticeSection: 'SEC_91_CRPC_94_BNSS',
        bankName: 'State Bank of India',
        branchName: 'Andheri East Industrial Estate Branch',
        accountNumber: '304918294819',
        accountHolderName: 'Sawant Digital Solutions / Vikram Sawant',
        dateIssued: `${new Date().toISOString().substring(0, 10)}`,
        responseDueDate: `${new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10)}`,
        status: 'ACCOUNT_FROZEN',
        ioOfficerName: row.assigned_io || 'PSI V. S. Patil',
        ioBadge: row.assigned_io_badge || 'MH-POL-04',
        requestedActions: 'Freeze debit operations and supply certified KYC documents, IP login records, and transaction ledger statements for past 6 months.',
        bankResponseSummary: 'Debit freeze applied. Certified statement bearing transaction hash delivered to IO.',
        statementHash: '6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
      },
      {
        id: `BNK-${id.slice(-4)}-02`,
        caseId: id,
        noticeSection: 'SEC_91_CRPC_94_BNSS',
        bankName: 'HDFC Bank Ltd',
        branchName: 'Dadar TT Circle Branch, Mumbai',
        accountNumber: '50100492819482',
        accountHolderName: 'Sunita A. Sawant',
        dateIssued: `${new Date().toISOString().substring(0, 10)}`,
        responseDueDate: `${new Date(Date.now() + 5 * 86400000).toISOString().substring(0, 10)}`,
        status: 'PENDING',
        ioOfficerName: row.assigned_io || 'PSI V. S. Patil',
        ioBadge: row.assigned_io_badge || 'MH-POL-04',
        requestedActions: 'Produce statement of accounts and alert IO upon any withdrawal above ₹ 25,000.',
        bankResponseSummary: 'Notice acknowledged by Branch Manager; compliance in progress.',
      },
    ],

    // 1930 Cyber Cell & Field Mobile Tracing (Page 3 & 6)
    cyberTracing: {
      id: `CYB-1930-${id.slice(-4)}`,
      caseId: id,
      helplineTicket1930: `1930-MH-2026-098${id.slice(-3)}`,
      stolenDeviceIMEI: '358912048192841',
      secondaryIMEI: '358912048192842',
      deviceModel: 'Samsung Galaxy S24 Ultra Titanium Black',
      currentSimSubscriber: 'Prakash R. Ghadge (Identified Secondary Buyer)',
      currentSimIMSI: '404450918294819',
      currentLocationCoords: {
        lat: 19.0178,
        lng: 72.8478,
        areaName: 'Dadar West Railway Market, Mumbai',
        nearestPoliceStation: 'Dadar Police Station',
      },
      sec41ANoticeToBuyer: {
        buyerName: 'Prakash R. Ghadge',
        address: 'Shop No. 7, Market Road, Dadar West, Mumbai',
        contact: '+91 97690 18294',
        noticeDate: `${new Date().toISOString().substring(0, 10)}`,
        complianceStatus: 'DEVICE_SURRENDERED',
      },
      cdrAnalysisSummary: 'Tower dumps at Dadar West confirmed active IMEI on target IMSI. Notice under 41A served to second-hand electronics buyer; device recovered intact with original serial seals.',
      traceStatus: 'RECOVERED_AND_SEIZED',
    },

    // Medico-Legal Case (MLC) Govt Hospital (Page 2)
    medicoLegalCase: {
      id: `MLC-${id.slice(-4)}`,
      caseId: id,
      mlcNumber: `MLC-SION-2026-${id.slice(-4)}`,
      hospitalName: 'Lokmanya Tilak Municipal General Hospital (Sion Hospital), Mumbai',
      examiningDoctorName: 'Dr. A. K. Deshmukh, MD (Forensic Medicine)',
      examiningDoctorRegNo: 'MMC-2012-08-2948',
      examinationDateTime: `${new Date().toISOString().substring(0, 10)} 08:30 IST`,
      patientName: 'Vikram alias Vicky Arvind Sawant',
      ageAndGender: '31 Years / Male',
      broughtByOfficerBadge: row.assigned_io_badge || 'MH-POL-04',
      injuryCategory: 'SIMPLE_BLUNT_INJURY',
      detailedInjuriesDescription: 'Superficial abrasion 1.5 cm x 0.5 cm over right knee joint. No fresh bone injuries or internal haemorrhage. Conscious, oriented, fit for interrogation.',
      isFitForPoliceStatement: true,
      alcoholOrToxicSubstanceDetected: false,
      medicalCertificateHash: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
    },

    // Digital Evidence Taxonomy (Page 6)
    digitalEvidence: [
      {
        id: `DE-CCTV-${id.slice(-4)}`,
        caseId: id,
        evidenceType: 'CCTV_FOOTAGE',
        fileName: 'Dadar_West_Stn_Exit_Cam04_1080p.mp4',
        sourceDeviceOrCCTVCamera: 'Govt Railway Police (GRP) Camera No. 04',
        fileSizeBytes: 482910400,
        sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        aes256GcmEncrypted: true,
        collectedByOfficer: row.assigned_io || 'PSI V. S. Patil',
        collectionTimestamp: `${new Date().toISOString().substring(0, 10)} 09:15 IST`,
        hashIntegrityVerified: true,
        cloudStorageKey: `storage/evidence/${id}/cctv_dadar_cam04.enc`,
      },
      {
        id: `DE-CDR-${id.slice(-4)}`,
        caseId: id,
        evidenceType: 'CALL_DATA_RECORD',
        fileName: 'CDR_TowerDump_Dadar_Telecom_Nodal.csv',
        sourceDeviceOrCCTVCamera: 'Telecom Nodal Officer (Reliance Jio / Airtel)',
        fileSizeBytes: 14208000,
        sha256Hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        aes256GcmEncrypted: true,
        collectedByOfficer: 'Cyber Crime Cell Unit II',
        collectionTimestamp: `${new Date().toISOString().substring(0, 10)} 10:45 IST`,
        hashIntegrityVerified: true,
        cloudStorageKey: `storage/evidence/${id}/cdr_dadar_tower.enc`,
      },
    ],

    // Granular Call Data Records (CDR)
    cdrRecords: [
      {
        cdrId: `CDR-MH-2026-${id.slice(-4)}-01`,
        phoneNumber: '+91 98211 44829',
        imei: '358912048192841',
        imsi: '404450918294819',
        callerNumber: '+91 98211 44829',
        receiverNumber: '+91 91370 59281',
        callStartTime: `${new Date().toISOString().substring(0, 10)} 02:14:10 IST`,
        callEndTime: `${new Date().toISOString().substring(0, 10)} 02:19:45 IST`,
        durationSeconds: 335,
        callType: 'OUTGOING_VOICE',
        towerCellId: 'MUM-DADAR-TWR-4418',
        locationArea: 'Dadar West Railway Market Sector 4',
        telecomProvider: 'Reliance Jio',
        sourceDocumentRef: 'CERT-NODAL-JIO-99124',
        sha256Digest: 'f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8',
      },
      {
        cdrId: `CDR-MH-2026-${id.slice(-4)}-02`,
        phoneNumber: '+91 98211 44829',
        imei: '358912048192841',
        imsi: '404450918294819',
        callerNumber: '+91 97690 18294',
        receiverNumber: '+91 98211 44829',
        callStartTime: `${new Date().toISOString().substring(0, 10)} 05:42:01 IST`,
        callEndTime: `${new Date().toISOString().substring(0, 10)} 05:43:20 IST`,
        durationSeconds: 79,
        callType: 'INCOMING_VOICE',
        towerCellId: 'MUM-ANDH-TWR-0912',
        locationArea: 'Andheri East Commercial Complex',
        telecomProvider: 'Bharti Airtel',
        sourceDocumentRef: 'CERT-NODAL-AIRTEL-48192',
        sha256Digest: 'e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a79887766554433221100aabbccddeef',
      },
    ],
  };
}

export const DEFAULT_SAMPLE_CASES: CaseFile[] = [
  mapDbRowToCaseFile({
    id: 'CASE-2026-00142',
    fir_number: 'FIR-2026-ANDH-0142',
    case_title: 'Corporate Financial Cyber Fraud & Phishing Syndicate',
    police_station: 'Andheri Police Station, Mumbai',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Cyber Crime & Financial Fraud',
    incident_date: '2026-08-28',
    incident_location: 'Andheri East Commercial Complex, Mumbai',
    status: 'Under Investigation',
    priority: 'CRITICAL',
    ipc_sections: ['Sec 420 IPC', 'Sec 66C/66D IT Act', 'Sec 111 BNS'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
  }),
  mapDbRowToCaseFile({
    id: 'CASE-2026-00189',
    fir_number: 'FIR-2026-ANDH-0189',
    case_title: 'Armed Commercial Robbery & Heist at S.V. Road',
    police_station: 'Andheri Police Station, Mumbai',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Armed Robbery & Dacoity',
    incident_date: '2026-08-30',
    incident_location: 'S.V. Road Gold Jewellers Market, Andheri West',
    status: 'Forensic Examination',
    priority: 'HIGH',
    ipc_sections: ['Sec 392 IPC', 'Sec 397 IPC', 'Sec 25 Arms Act'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
  }),
  mapDbRowToCaseFile({
    id: 'CASE-2026-00205',
    fir_number: 'FIR-2026-ANDH-0205',
    case_title: 'Inter-State Commercial Narcotic Smuggling & Hawala Ring',
    police_station: 'Andheri Police Station, Mumbai',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Narcotics & NDPS',
    incident_date: '2026-09-01',
    incident_location: 'Chhatrapati Shivaji Maharaj Cargo Terminal',
    status: 'Pending Supervisory Review',
    priority: 'CRITICAL',
    ipc_sections: ['Sec 8(c) NDPS Act', 'Sec 21(c) NDPS Act', 'Sec 29 NDPS Act'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
  }),
  mapDbRowToCaseFile({
    id: 'CASE-2026-00231',
    fir_number: 'FIR-2026-ANDH-0231',
    case_title: 'Commercial ATM Skimming & Identity Cloning Case',
    police_station: 'Andheri Police Station, Mumbai',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Identity Theft & Electronic Fraud',
    incident_date: '2026-09-02',
    incident_location: 'Versova Link Road ATM Kiosk, Andheri',
    status: 'FIR Registered',
    priority: 'MEDIUM',
    ipc_sections: ['Sec 419 IPC', 'Sec 66C IT Act'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: '',
    assigned_io_badge: '',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
  }),
  mapDbRowToCaseFile({
    id: 'CASE-2026-00098',
    fir_number: 'FIR-2026-ANDH-0098',
    case_title: 'Counterfeit High-Denomination Currency Circulation Network',
    police_station: 'Andheri Police Station, Mumbai',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Counterfeiting & Forgery',
    incident_date: '2026-08-15',
    incident_location: 'Andheri Railway Station West Yard',
    status: 'Disposed & Closed',
    priority: 'HIGH',
    ipc_sections: ['Sec 489A IPC', 'Sec 489B IPC', 'Sec 489C IPC'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
  }),
];
