import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticateJwt } from '../middleware/auth';
import { authorizeRole } from '../middleware/rbac';
import { biometricService } from '../services/biometricService';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB limit
});

/**
 * POST /api/identity/search
 * Initiates an authorized biometric identity search.
 * Strictly restricted to POLICE officers with mandatory Case ID, Purpose, and Justification.
 */
router.post(
  '/search',
  authenticateJwt,
  authorizeRole('POLICE'),
  upload.single('photo'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { caseId, purpose, justification, imageBase64, searchScope } = req.body;
      let queryEmbedding: number[] | undefined;

      if (req.body.queryEmbedding) {
        try {
          queryEmbedding = typeof req.body.queryEmbedding === 'string'
            ? JSON.parse(req.body.queryEmbedding)
            : req.body.queryEmbedding;
        } catch {
          // Ignore parse error and fall back to image
        }
      }

      const officerBadge = req.user?.badgeNo || 'MH-POL-OFFICER';
      const officerName = req.user?.name || 'Investigating Officer';

      if (!caseId) {
        res.status(400).json({ error: 'Case ID is mandatory for all biometric searches.' });
        return;
      }
      if (!purpose) {
        res.status(400).json({ error: 'Investigative purpose is required.' });
        return;
      }
      if (!justification || justification.trim().length < 5) {
        res.status(400).json({ error: 'Written justification (minimum 5 characters) must be provided.' });
        return;
      }

      const imageBuffer = req.file?.buffer;
      if (!imageBuffer && !imageBase64 && !queryEmbedding) {
        res.status(400).json({ error: 'Face photograph, CCTV frame, or face embedding vector is required for biometric processing.' });
        return;
      }

      const result = await biometricService.searchCandidates({
        officerBadge,
        officerName,
        caseId,
        purpose,
        justification,
        queryEmbedding,
        imageBuffer,
        imageBase64,
        searchScope: searchScope === 'CASE_PERSONS_ONLY' ? 'CASE_PERSONS_ONLY' : 'ALL_PERSONS'
      });

      res.status(200).json({
        success: true,
        message: 'Biometric search completed. Candidate matches generated for human officer verification.',
        searchId: result.searchId,
        candidates: result.candidates,
        flaggedAbuse: result.flaggedAbuse,
        abuseReason: result.abuseReason,
        notice: 'Results are candidate matches and require explicit officer confirmation.'
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to process biometric search' });
    }
  }
);

/**
 * POST /api/identity/enroll
 * Enrolls a new person and their 128-d face embedding into the central police registry.
 */
router.post(
  '/enroll',
  authenticateJwt,
  authorizeRole('POLICE'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, alias, dateOfBirth, gender, photoUrl, embedding, caseId, role } = req.body;
      const officerBadge = req.user?.badgeNo || 'MH-POL-OFFICER';
      const officerName = req.user?.name || 'Investigating Officer';

      if (!name || !name.trim()) {
        res.status(400).json({ error: 'Person name is required for biometric enrollment.' });
        return;
      }

      const result = await biometricService.enrollPerson({
        name: name.trim(),
        alias: alias?.trim(),
        dateOfBirth,
        gender,
        photoUrl,
        embedding,
        caseId,
        role,
        officerBadge,
        officerName
      });

      res.status(201).json({
        success: true,
        message: `Person ${result.person.name} (${result.person.id}) successfully enrolled in biometric registry.`,
        person: result.person,
        profileId: result.profile.id
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to enroll person in biometric registry.' });
    }
  }
);

/**
 * POST /api/identity/confirm
 * Human officer explicitly confirms a candidate match after reviewing biometric coordinates.
 * Returns authorized case associations (strictly excluding WITNESS relationships).
 */
router.post(
  '/confirm',
  authenticateJwt,
  authorizeRole('POLICE'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { searchId, personId } = req.body;
      const officerBadge = req.user?.badgeNo || 'MH-POL-OFFICER';
      const officerName = req.user?.name || 'Investigating Officer';

      if (!searchId || !personId) {
        res.status(400).json({ error: 'Both searchId and personId are required to confirm identity.' });
        return;
      }

      const result = await biometricService.confirmIdentity({
        searchId,
        personId,
        officerBadge,
        officerName
      });

      res.status(200).json({
        success: true,
        message: 'Identity confirmed by investigating officer. Authorized case associations retrieved.',
        searchId: result.searchId,
        confirmedPerson: result.confirmedPerson,
        caseAssociations: result.caseAssociations,
        witnessCountExcluded: result.witnessCountExcluded,
        privacyPolicy: 'Witness records are excluded by statutory policy and cannot be retrieved through biometric search.',
        auditTxId: result.auditTxId,
        sha256Hash: result.sha256Hash
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to confirm identity' });
    }
  }
);

/**
 * GET /api/identity/audit
 * Retrieves biometric search audit logs, telemetry, and abuse detection alerts.
 * Accessible to AUDITOR and POLICE supervisor roles.
 */
router.get(
  '/audit',
  authenticateJwt,
  authorizeRole('AUDITOR', 'POLICE'),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = biometricService.getBiometricAuditStats();
      const searches = biometricService.getAllSearches();

      res.status(200).json({
        success: true,
        stats,
        searches
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve biometric audit records' });
    }
  }
);

export default router;
