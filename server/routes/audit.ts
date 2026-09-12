import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { buildCaseScope } from '../middleware/rbacScope';
import { auditService } from '../services/auditService';
import { auditSecurityService } from '../services/auditSecurityService';
import { casePersistenceService, getCaseHistoryFromFile } from '../services/casePersistenceService';

export const auditRouter = Router();

// GET /api/audit/history/cases/:id - Fetch GitHub-style version history
auditRouter.get('/history/cases/:id', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const caseId = req.params.id;
  try {
    // Attempt Postgres fetch first
    const result = await pool.query(`
      SELECT 
        h.history_id, h.action, h.changed_at, p.full_name as changed_by_name, p.badge_no, p.role as changed_by_role,
        h.case_number, h.fir_number, h.title, h.description, h.status, h.police_station
      FROM cases_history h
      LEFT JOIN profiles p ON h.changed_by_user = p.auth_user_id
      WHERE h.original_case_id = $1
      ORDER BY h.changed_at DESC
    `, [caseId]);
    
    const current = await pool.query(`
      SELECT c.id as original_case_id, c.updated_at as changed_at, 'CURRENT' as action,
      c.case_number, c.fir_number, c.title, c.description, c.status, c.police_station
      FROM cases c WHERE c.id = $1
    `, [caseId]);

    res.json({
      success: true,
      currentVersion: current.rows[0],
      history: result.rows
    });
  } catch (error) {
    // FALLBACK TO OFFLINE JSON STORE (if Postgres is down/mocked)
    const jsonHistory = getCaseHistoryFromFile(caseId);
    const currentCase = casePersistenceService.getCaseById(caseId);
    
    const mappedHistory = jsonHistory.map((h: any) => ({
      history_id: h.history_id,
      action: h.action,
      changed_at: h.changed_at,
      changed_by_badge: h.changed_by_badge,
      case_number: h.case_snapshot.case_number,
      fir_number: h.case_snapshot.fir_number,
      title: h.case_snapshot.case_title,
      status: h.case_snapshot.status,
      police_station: h.case_snapshot.police_station
    }));

    let currentVersion = null;
    if (currentCase) {
      currentVersion = {
        action: 'CURRENT',
        changed_at: new Date().toISOString(),
        case_number: currentCase.case_number || currentCase.fir_number,
        fir_number: currentCase.fir_number,
        title: currentCase.case_title,
        status: currentCase.status,
        police_station: currentCase.police_station
      };
    }

    res.json({
      success: true,
      fallbackMode: true,
      currentVersion,
      history: mappedHistory
    });
  }
});

// GET /api/audit/history/evidence/:id - Fetch GitHub-style version history for evidence
auditRouter.get('/history/evidence/:id', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const evidenceId = req.params.id;
    const result = await pool.query(`
      SELECT 
        h.history_id, h.action, h.changed_at, p.full_name as changed_by_name, p.badge_no, p.role as changed_by_role,
        h.evidence_number, h.evidence_type, h.description, h.status, h.collection_location
      FROM evidence_history h
      LEFT JOIN profiles p ON h.changed_by_user = p.auth_user_id
      WHERE h.original_evidence_id = $1
      ORDER BY h.changed_at DESC
    `, [evidenceId]);
    
    const current = await pool.query(`
      SELECT e.id as original_evidence_id, e.collection_date as changed_at, 'CURRENT' as action,
      e.evidence_number, e.evidence_type, e.description, e.status, e.collection_location
      FROM evidence e WHERE e.id = $1
    `, [evidenceId]);

    res.json({ success: true, currentVersion: current.rows[0], history: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch version history' });
  }
});

// GET /api/audit — Fetch unified canonical audit events with filtering and RBAC
auditRouter.get('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const {
    action,
    resourceType,
    resourceId,
    actorBadge,
    caseId,
    role,
    status,
    limit = '50',
    page = '1',
  } = req.query as Record<string, string>;

  const numLimit = Math.min(100, Math.max(10, Number(limit) || 50));
  const numPage = Math.max(1, Number(page) || 1);
  const offset = (numPage - 1) * numLimit;
  const user = req.user!;

  try {
    // 1. First retrieve unified audit_events
    const { events, total } = await auditService.getAllAuditEvents({
      caseId: caseId || resourceId,
      role: role || (user.role === 'AUDITOR' || user.role === 'ADMIN' ? undefined : user.role),
      action: action !== 'ALL' ? action : undefined,
      status: status !== 'ALL' ? status : undefined,
      limit: numLimit,
      offset,
    });

    if (events.length > 0 || total > 0) {
      // Return both unified events and legacy formatted logs for frontend components
      res.json({
        success: true,
        total,
        page: numPage,
        limit: numLimit,
        events,
        logs: events.map((e) => ({
          id: e.id,
          timestamp: e.createdAt,
          actor_badge: e.userId,
          actor_name: e.userName || e.userId,
          actor_role: e.userRole,
          action: e.action,
          resource_type: e.resourceType,
          resource_id: e.resourceId,
          ip_address: e.ipAddress,
          hash_verified: true,
          notes: e.reason || (e.metadata ? JSON.stringify(e.metadata) : ''),
          event_hash: e.eventHash,
          fabric_tx_id: e.fabricTxId,
          status: e.status,
          case_id: e.caseId,
          before_data: e.beforeData,
          after_data: e.afterData,
        })),
      });
      return;
    }

    // 2. Fallback to audit_logs if audit_events has no entries
    let query = `
      SELECT al.id, al.timestamp, al.actor_badge, al.actor_name, al.actor_role, al.action,
             al.resource_type, al.resource_id, al.ip_address, al.hash_verified, al.notes
      FROM audit_logs al
      WHERE 1=1
    `;
    const scope = buildCaseScope(user, 'sc', 1);
    const params: any[] = [...scope.params];

    if (!scope.unrestricted) {
      query += ` AND (
        al.actor_badge = $1
        OR al.resource_id IN (SELECT sc.id FROM cases sc WHERE ${scope.clause})
        OR al.resource_id IN (
          SELECT se.evidence_tag FROM evidence se
          WHERE se.case_id IN (SELECT sc.id FROM cases sc WHERE ${scope.clause})
        )
      )`;
    }

    if (action && action !== 'ALL') {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }

    if (resourceType) {
      params.push(resourceType);
      query += ` AND resource_type = $${params.length}`;
    }

    if (resourceId || caseId) {
      params.push(resourceId || caseId);
      query += ` AND (resource_id = $${params.length} OR notes ILIKE '%' || $${params.length} || '%')`;
    }

    if (actorBadge) {
      params.push(actorBadge);
      query += ` AND actor_badge = $${params.length}`;
    }

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(numLimit, offset);

    query += ` ORDER BY timestamp DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      total: result.rows.length,
      page: numPage,
      limit: numLimit,
      events: [],
      logs: result.rows,
    });
  } catch (err: any) {
    console.error('[AUDIT API ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve audit logs',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// GET /api/audit/security-anomalies — Evaluate statutory security engine rules A, B, C, D
auditRouter.get('/security-anomalies', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const lookbackMinutes = Number(req.query.lookbackMinutes) || 60;
    const custodyGapHours = Number(req.query.custodyGapHours) || 24;

    const anomalies = await auditSecurityService.evaluateSecurityRules({
      lookbackMinutes,
      custodyGapHours,
    });

    res.json({
      success: true,
      count: anomalies.length,
      anomalies,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[AUDIT SECURITY ANOMALIES ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate security rules',
      requestId: `REQ-${Date.now()}`,
    });
  }
});

// POST & GET /api/audit/:eventId/verify — Cryptographically verify individual event against SHA-256 and Fabric
const verifyEventHandler = async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params;

  try {
    const verification = await auditService.verifyEventIntegrity(eventId);

    if (!verification.event) {
      res.status(404).json({
        success: false,
        error: `Audit event ${eventId} not found`,
        verification,
      });
      return;
    }

    res.json({
      success: true,
      eventId,
      isIntact: verification.isIntact,
      storedHash: verification.storedHash,
      computedHash: verification.computedHash,
      fabricTxId: verification.fabricTxId,
      status: verification.isIntact ? 'RECORD_VERIFIED' : 'TAMPER_DETECTED',
      details: verification.details,
      event: verification.event,
    });
  } catch (err: any) {
    console.error(`[AUDIT EVENT VERIFY ERROR] ID ${eventId}:`, err);
    res.status(500).json({
      success: false,
      error: 'Failed to verify event integrity',
      requestId: `REQ-${Date.now()}`,
    });
  }
};

auditRouter.post('/:eventId/verify', authenticateJwt, verifyEventHandler);
auditRouter.get('/:eventId/verify', authenticateJwt, verifyEventHandler);

// POST & GET /api/audit/verify-chain — Cryptographically verify entire SHA-256 hash-chained audit log
const verifyChainHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const report = await auditService.verifyAuditChain();
    res.json({
      success: true,
      report,
      isIntact: report.isIntact,
      totalBlocks: report.totalBlocks,
      verifiedAt: report.verifiedAt,
      latestHash: report.latestHash,
      details: report.details,
    });
  } catch (err: any) {
    console.error('[AUDIT VERIFY CHAIN ERROR]', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to verify audit hash chain',
      requestId: `REQ-${Date.now()}`,
    });
  }
};

auditRouter.post('/verify-chain', authenticateJwt, verifyChainHandler);
auditRouter.get('/verify-chain', authenticateJwt, verifyChainHandler);
