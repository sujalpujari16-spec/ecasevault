import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticateJwt, AuthenticatedUser } from '../middleware/auth.js';
import { uploadLimiter, downloadLimiter } from '../middleware/rateLimit.js';
import { documentRepoService } from '../services/documentRepoService.js';
import { auditService } from '../services/auditService.js';
import { verifyCaseAccessForUser } from '../middleware/caseAccess.js';
import { RepoDepartment, RepoDocumentType } from '../../src/types.js';

const router = express.Router();
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  storage: multer.memoryStorage(),
});

function getDepartmentFromUserRole(role: string): RepoDepartment {
  const norm = role.toUpperCase().trim();
  if (norm === 'POLICE') {
    return 'POLICE';
  }
  if (norm === 'FORENSIC') {
    return 'FORENSIC';
  }
  if (norm === 'LEGAL') {
    return 'LEGAL';
  }
  throw new Error(`User with role '${role}' cannot author case documents.`);
}

/**
 * Authentication middleware for downloads: accepts Bearer token or signed query token.
 */
function authenticateDownload(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJwt(req, res, next);
  }

  const token = req.query.token as string;
  const { documentId } = req.params;
  if (token && documentId) {
    const check = documentRepoService.verifyDownloadToken(documentId, token);
    if (check.isValid && check.claims && check.claims.scope === 'DOCUMENT_DOWNLOAD' && check.claims.role) {
      // Capability token: strictly carry genuine officer claims without manufacturing privileged roles
      req.user = {
        userId: check.claims.userId || check.claims.badge,
        badgeNo: check.claims.badge,
        username: check.claims.badge,
        role: check.claims.role as any,
        station: check.claims.station || 'Unknown Station',
      };
      return next();
    } else {
      res.status(401).json({
        success: false,
        error: `Unauthorized: ${check.error || 'Invalid, unscoped, or expired download capability token'}`
      });
      return;
    }
  }

  res.status(401).json({ success: false, error: 'Unauthorized: Missing Authorization header or valid download token' });
}

/**
 * GET /api/documents/:documentId
 * Retrieves metadata, cryptographic hash, and signature for a document.
 */
router.get('/:documentId', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.params;
    const doc = documentRepoService.getDocumentById(documentId);
    if (!doc) {
      res.status(404).json({ success: false, error: `Document '${documentId}' not found.` });
      return;
    }

    const hasAccess = await verifyCaseAccessForUser(doc.caseId, req.user!);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access Denied: You do not have clearance for this case file' });
      return;
    }

    res.json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /api/documents/:documentId/download-token
 * Generates a short-lived (5-minute) authenticated download capability token.
 */
router.post(
  '/:documentId/download-token',
  downloadLimiter,
  authenticateJwt,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthenticatedUser;
    const { documentId } = req.params;
    const expirySeconds = Math.min(3600, Math.max(30, Number(req.body.expirySeconds) || 300));

    try {
      const doc = documentRepoService.getDocumentById(documentId);
      if (!doc) {
        res.status(404).json({ success: false, error: `Document '${documentId}' not found.` });
        return;
      }

      const hasAccess = await verifyCaseAccessForUser(doc.caseId, user);
      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Access Denied: You do not have clearance for this case file' });
        return;
      }

      const tokenData = await documentRepoService.generateDownloadToken(
        documentId, 
        {
          badgeNo: user.badgeNo,
          userId: user.userId || user.badgeNo,
          role: user.role,
          station: user.station || 'Statewide',
        }, 
        expirySeconds
      );

      res.json({
        success: true,
        documentId,
        token: tokenData.token,
        expiresAt: tokenData.expiresAt,
        expirySeconds: tokenData.expirySeconds,
        downloadUrl: `/api/documents/${documentId}/download?token=${tokenData.token}`,
        signedUrl: tokenData.signedUrl,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to generate download token' });
    }
  }
);

/**
 * GET /api/documents/:documentId/download
 * Decrypts AES-256-GCM file payload and streams authentic binary file to client.
 */
router.get('/:documentId/download', downloadLimiter, authenticateDownload, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthenticatedUser;
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { documentId } = req.params;

  try {
    const docMeta = documentRepoService.getDocumentById(documentId);
    if (docMeta) {
      const hasAccess = await verifyCaseAccessForUser(docMeta.caseId, user);
      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Access Denied: You do not have clearance to download this case file' });
        return;
      }
    }
    const result = await documentRepoService.getDecryptedDocumentBuffer(documentId);

    // Audit log document download
    await auditService.logEvent({
      actorBadge: user.badgeNo,
      actorName: user.name || user.username,
      actorRole: user.role,
      action: 'DOCUMENT_DOWNLOADED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      metadata: {
        caseId: result.document.caseId,
        filename: result.filename,
        sha256Hash: result.document.sha256Hash,
        version: result.document.version,
      },
      clientIp,
    });

    res.setHeader('Content-Type', result.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Document-SHA256', result.document.sha256Hash);
    res.setHeader('X-Document-Version', result.document.version.toString());
    res.setHeader('X-Digital-Signature', result.document.digitalSignature || 'NONE');

    res.send(result.buffer);
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message || 'Could not download document' });
  }
});

/**
 * GET /api/documents/:documentId/versions
 * Retrieves all versions in the document lineage (v1, v2...).
 */
router.get('/:documentId/versions', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { documentId } = req.params;
    const versions = await documentRepoService.getDocumentVersions(documentId);
    res.json({
      success: true,
      documentId,
      versions,
      count: versions.length,
    });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message || 'Versions not found' });
  }
});

/**
 * POST /api/documents/:documentId/versions
 * Uploads an updated version for an existing document without overwriting previous versions.
 */
router.post(
  '/:documentId/versions',
  uploadLimiter,
  authenticateJwt,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user as AuthenticatedUser;
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const { documentId } = req.params;

    try {
      const existingDoc = documentRepoService.getDocumentById(documentId);
      if (!existingDoc) {
        res.status(404).json({ success: false, error: `Document '${documentId}' not found.` });
        return;
      }

      // Enforce departmental isolation: uploader role must match document department
      const userDept = getDepartmentFromUserRole(user.role);
      if (userDept !== existingDoc.department) {
        res.status(403).json({
          success: false,
          error: `Departmental Isolation: User with department '${userDept}' cannot modify '${existingDoc.department}' documents.`,
        });
        return;
      }

      let fileBuffer: Buffer | null = null;
      let filename = 'document_v' + (existingDoc.version + 1) + '.pdf';
      let mimeType = 'application/pdf';

      if (req.file) {
        fileBuffer = req.file.buffer;
        filename = req.file.originalname;
        mimeType = req.file.mimetype;
      } else if (req.body.content || req.body.fileBase64) {
        const rawContent = req.body.fileBase64 || req.body.content;
        fileBuffer = Buffer.from(rawContent, 'base64');
        if (req.body.filename) filename = req.body.filename;
        if (req.body.mimeType) mimeType = req.body.mimeType;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        res.status(400).json({ success: false, error: 'No file content uploaded for new version.' });
        return;
      }

      const uploadResult = await documentRepoService.uploadCaseDocument({
        caseId: existingDoc.caseId,
        department: existingDoc.department,
        documentType: existingDoc.documentType,
        title: existingDoc.title,
        description: req.body.description || existingDoc.description,
        classification: existingDoc.classification,
        fileBuffer,
        originalFilename: filename,
        declaredMimeType: mimeType,
        uploaderName: user.name || user.username,
        uploaderBadge: user.badgeNo,
        clientIp,
      });

      try {
        const { emitCaseEvent } = await import('./events');
        emitCaseEvent('DOCUMENT_UPLOADED', {
          caseId: existingDoc.caseId,
          documentId: uploadResult.document.id,
          title: existingDoc.title,
          version: uploadResult.document.version,
        });
      } catch {}

      res.status(201).json({
        success: true,
        message: `Version ${uploadResult.document.version} of '${existingDoc.title}' successfully registered.`,
        document: uploadResult.document,
        previousVersionHash: existingDoc.sha256Hash,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to upload new document version' });
    }
  }
);

/**
 * POST /api/documents/:documentId/verify
 * Cryptographically verifies SHA-256 hash and Ed25519 signature against storage and blockchain.
 */
router.post('/:documentId/verify', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthenticatedUser;
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const { documentId } = req.params;

  try {
    const verification = await documentRepoService.verifyDocumentIntegrity(documentId);

    // Audit the verification action
    await auditService.logEvent({
      actorBadge: user.badgeNo,
      actorName: user.name || user.username,
      actorRole: user.role,
      action: 'DOCUMENT_INTEGRITY_VERIFIED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      metadata: {
        isVerified: verification.isVerified,
        sha256Match: verification.sha256Match,
        signatureValid: verification.signatureValid,
        blockchainTxId: verification.blockchainTxId,
      },
      clientIp,
    });

    res.json({
      success: true,
      documentId,
      verification: {
        isValid: verification.isVerified,
        isVerified: verification.isVerified,
        status: verification.isVerified ? 'VERIFIED' : 'TAMPERED',
        sha256Match: verification.sha256Match,
        signatureValid: verification.signatureValid,
        currentHash: verification.currentHash,
        expectedHash: verification.expectedHash,
        version: verification.version,
        blockchainTxId: verification.blockchainTxId,
        details: verification.details,
      },
    });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message || 'Verification failed' });
  }
});

export default router;
