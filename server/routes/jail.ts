import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import { authorizeRole } from '../middleware/rbac';
import { casePersistenceService } from '../services/casePersistenceService';
import { auditService } from '../services/auditService';

export const jailRouter = Router();

// All jail endpoints require authentication
jailRouter.use(authenticateJwt);

/**
 * GET /api/jail/stats
 * Overview KPIs for Jail Superintendent dashboard
 */
jailRouter.get('/stats', authorizeRole('POLICE', 'ADMIN', 'AUDITOR', 'LEGAL'), async (req: Request, res: Response): Promise<void> => {
  try {
    const prisoners = casePersistenceService.getAllPrisoners();
    const warrants = casePersistenceService.getAllWarrants();

    const activeInmates = prisoners.filter(p => p.custodyStatus === 'IN_CUSTODY').length;
    const judicialRemand = prisoners.filter(p => p.custodyType === 'JUDICIAL_CUSTODY_REMAND' && p.custodyStatus === 'IN_CUSTODY').length;
    const policeRemand = prisoners.filter(p => p.custodyType === 'POLICE_CUSTODY_REMAND' && p.custodyStatus === 'IN_CUSTODY').length;
    const activeWarrants = warrants.filter(w => w.status === 'ACTIVE').length;
    const released = prisoners.filter(p => p.custodyStatus === 'RELEASED').length;

    res.json({
      success: true,
      stats: {
        activeInmates,
        judicialRemand,
        policeRemand,
        activeWarrants,
        released,
        totalTracked: prisoners.length,
        facilityName: 'Arthur Road Central Prison, Mumbai',
        jailJurisdiction: 'Maharashtra Prisons & Correctional Services Department'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to retrieve jail statistics' });
  }
});

/**
 * GET /api/jail/prisoners
 * Lists prisoners currently in custody across assigned cases
 */
jailRouter.get('/prisoners', authorizeRole('POLICE', 'ADMIN', 'LEGAL', 'AUDITOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const prisoners = casePersistenceService.getAllPrisoners();
    res.json({
      success: true,
      prisoners,
      count: prisoners.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch prisoners roster' });
  }
});

/**
 * GET /api/jail/cases/:caseId/prisoner
 * Retrieves prisoner & custody details for a specific case
 */
jailRouter.get('/cases/:caseId/prisoner', authorizeRole('POLICE', 'ADMIN', 'LEGAL', 'AUDITOR'), async (req: Request, res: Response): Promise<void> => {
  const { caseId } = req.params;
  try {
    const prisoners = casePersistenceService.getPrisonersByCase(caseId);
    res.json({
      success: true,
      caseId,
      prisoners
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch case prisoners' });
  }
});

/**
 * POST /api/jail/admission
 * Admits an under-trial / convict to prison on remand warrant
 * Requires POLICE or ADMIN role
 */
jailRouter.post('/admission', authorizeRole('POLICE', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      caseId,
      prisonerNumber,
      prisonerName,
      fullName,
      warrantId,
      custodyType,
      cellWard,
      remandExpiryDate,
      courtRemandOrderRef,
      prisonName,
      jailLocation
    } = req.body;

    if (!caseId || (!prisonerName && !fullName)) {
      res.status(400).json({ success: false, error: 'Case ID and Prisoner Name are required for jail admission' });
      return;
    }

    const admitted = casePersistenceService.admitPrisoner(caseId, {
      prisonerNumber,
      prisonerName: prisonerName || fullName,
      fullName: prisonerName || fullName,
      warrantId,
      custodyType: custodyType || 'JUDICIAL_CUSTODY_REMAND',
      cellWard: cellWard || 'Ward 4 - Barrack B',
      remandExpiryDate,
      courtRemandOrderRef: courtRemandOrderRef || `REM-${Date.now().toString(36).toUpperCase()}`,
      prisonName: prisonName || 'Arthur Road Central Prison, Mumbai',
      jailLocation: jailLocation || 'Arthur Road Central Prison, Mumbai',
      admittedBy: req.user?.username || 'Jail Superintendent'
    });

    if (!admitted) {
      res.status(404).json({ success: false, error: `Case ${caseId} not found` });
      return;
    }

    // Audit log entry
    await auditService.logAction({
      actor_badge: req.user?.badgeNo || 'PRIS-MH',
      actor_name: req.user?.username || 'Jail Superintendent',
      actor_role: req.user?.role || 'POLICE',
      action: 'PRISONER_ADMISSION',
      resource_type: 'PRISONER',
      resource_id: admitted.id,
      ip_address: req.ip || '127.0.0.1',
      notes: `Prisoner ${admitted.prisonerNumber} (${admitted.prisonerName}) admitted to ${admitted.prisonName} under Case ${caseId}.`
    });

    res.status(201).json({
      success: true,
      message: `Prisoner ${admitted.prisonerNumber} successfully admitted into custody`,
      prisoner: admitted
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to admit prisoner' });
  }
});

/**
 * POST /api/jail/custody-event
 * Logs custody transfer, court production, parole, or bail release
 * Requires POLICE or ADMIN role
 */
jailRouter.post('/custody-event', authorizeRole('POLICE', 'ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      prisonerId,
      eventType,
      newStatus,
      notes,
      facilityLocation,
      releaseDetails
    } = req.body;

    if (!prisonerId || !eventType) {
      res.status(400).json({ success: false, error: 'Prisoner ID and eventType are required' });
      return;
    }

    const result = casePersistenceService.addCustodyRecord(prisonerId, {
      eventType,
      newStatus,
      notes: notes || `Custody event: ${eventType}`,
      facilityLocation: facilityLocation || 'Arthur Road Central Prison, Mumbai',
      officerInCharge: req.user?.username || 'Superintendent Rajan S. Gokhale',
      releaseDetails
    });

    if (!result) {
      res.status(404).json({ success: false, error: `Prisoner ${prisonerId} not found in prison registry` });
      return;
    }

    await auditService.logAction({
      actor_badge: req.user?.badgeNo || 'PRIS-MH',
      actor_name: req.user?.username || 'Jail Superintendent',
      actor_role: req.user?.role || 'POLICE',
      action: 'CUSTODY_STATUS_UPDATE',
      resource_type: 'PRISONER',
      resource_id: prisonerId,
      ip_address: req.ip || '127.0.0.1',
      notes: `Custody status updated to ${newStatus || eventType} for Inmate ${prisonerId}. Notes: ${notes || 'None'}`
    });

    res.json({
      success: true,
      message: `Custody event ${eventType} logged successfully`,
      prisoner: result.prisoner,
      record: result.record
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update custody record' });
  }
});

/**
 * GET /api/jail/warrants
 * Lists active warrants requiring jail/remand compliance
 */
jailRouter.get('/warrants', authorizeRole('POLICE', 'ADMIN', 'LEGAL', 'AUDITOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const warrants = casePersistenceService.getAllWarrants();
    res.json({
      success: true,
      warrants,
      count: warrants.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch warrants' });
  }
});

/**
 * POST /api/jail/warrants
 * Issues or logs a new warrant linked to a case
 */
jailRouter.post('/warrants', authorizeRole('POLICE', 'ADMIN', 'LEGAL'), async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      caseId,
      warrantNumber,
      warrantType,
      subjectName,
      issuedDate,
      validUntil,
      courtName,
      documentRef
    } = req.body;

    if (!caseId || !subjectName) {
      res.status(400).json({ success: false, error: 'Case ID and Subject Name are required for warrant creation' });
      return;
    }

    const warrant = casePersistenceService.addWarrant(caseId, {
      warrantNumber,
      warrantType: warrantType || 'REMAND_WARRANT',
      subjectName,
      issuedDate: issuedDate || new Date().toISOString().substring(0, 10),
      validUntil,
      issuedBy: req.user?.username || 'Metropolitan Magistrate Court',
      courtName: courtName || 'Sessions Court, Mumbai',
      documentRef
    });

    if (!warrant) {
      res.status(404).json({ success: false, error: `Case ${caseId} not found` });
      return;
    }

    await auditService.logAction({
      actor_badge: req.user?.badgeNo || 'MH-LEG',
      actor_name: req.user?.username || 'Court Registrar',
      actor_role: req.user?.role || 'LEGAL',
      action: 'WARRANT_ISSUANCE',
      resource_type: 'WARRANT',
      resource_id: warrant.id,
      ip_address: req.ip || '127.0.0.1',
      notes: `Warrant ${warrant.warrantNumber} (${warrant.warrantType}) issued for ${warrant.subjectName} in Case ${caseId}.`
    });

    res.status(201).json({
      success: true,
      message: `Warrant ${warrant.warrantNumber} registered successfully`,
      warrant
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to issue warrant' });
  }
});
