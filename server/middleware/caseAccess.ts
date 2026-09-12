import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';
import { casePersistenceService } from '../services/casePersistenceService';

export interface CaseAccessUser {
  role: string;
  badgeNo: string;
  username?: string;
  station_id?: string;
  station?: string;
  status?: string;
}

/**
 * Single source of truth for case access authorization:
 * Evaluates:
 * 1. Is user active?
 * 2. Is ADMIN or AUDITOR? -> ALLOW
 * 3. Is ACTIVE Investigating Officer? -> ALLOW
 * 4. Has active team assignment in case_assignments? -> ALLOW
 * 5. Has approved, unexpired access grant? -> ALLOW
 * 6. Otherwise -> DENY (403 Forbidden)
 */
export async function canAccessCase(
  user: CaseAccessUser,
  caseId: string
): Promise<boolean> {
  if (!user || !user.badgeNo) return false;
  if (user.status && user.status !== 'ACTIVE') return false;

  const role = (user.role || '').toUpperCase().trim();

  // 1. ADMIN and AUDITOR have system oversight clearance
  if (role === 'ADMIN' || role === 'AUDITOR') {
    return true;
  }

  // 2. Fetch case record (try PostgreSQL, then persistent JSON store)
  let caseRecord: any = null;
  try {
    const dbRes = await pool.query(
      `SELECT id, investigating_officer_id, assigned_io_badge, police_station_id, status FROM cases WHERE id = $1`,
      [caseId]
    );
    if (dbRes.rows.length > 0) {
      caseRecord = dbRes.rows[0];
    }
  } catch {
    // Database offline
  }

  if (!caseRecord) {
    caseRecord = casePersistenceService.getCaseById(caseId);
  }

  if (!caseRecord) {
    return false;
  }

  // 3a. Is Registering Officer / Creator / Lead Investigator?
  const assignedBy = caseRecord.assigned_by || caseRecord.registered_by;
  if (assignedBy && assignedBy.trim() === user.badgeNo.trim()) {
    return true;
  }
  const leadBadge = caseRecord.lead_investigator_badge;
  if (leadBadge && leadBadge.trim() === user.badgeNo.trim()) {
    return true;
  }

  // 3b. Is Active Investigating Officer?
  const ioBadge = caseRecord.investigating_officer_id || caseRecord.assigned_io_badge;
  if (ioBadge && ioBadge.trim() === user.badgeNo.trim()) {
    return true;
  }

  // 4. Check active assignment in case_assignments
  try {
    const asgnRes = await pool.query(
      `SELECT 1 FROM case_assignments 
       WHERE case_id = $1 AND (officer_id = $2 OR user_id = $2) AND UPPER(status) = 'ACTIVE' 
       LIMIT 1`,
      [caseId, user.badgeNo]
    );
    if (asgnRes.rows.length > 0) return true;
  } catch {
    // Fallback to persistence store
  }

  if (casePersistenceService.hasActiveAssignment(caseId, user.badgeNo)) {
    return true;
  }

  // 5. Check approved, unexpired access grant
  try {
    const grantRes = await pool.query(
      `SELECT 1 FROM case_access_grants 
       WHERE case_id = $1 AND (user_badge = $2 OR user_id = $2) AND UPPER(status) = 'ACTIVE'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       LIMIT 1`,
      [caseId, user.badgeNo]
    );
    if (grantRes.rows.length > 0) return true;
  } catch {
    // Fallback to persistence store
  }

  if (casePersistenceService.hasActiveAccessGrant(caseId, user.badgeNo)) {
    return true;
  }

  // 6. Role-specific statutory stage clearance (Forensic / Legal)
  // FORENSIC: Can open every case docket to review FSL orders and upload reports
  if (role === 'FORENSIC') {
    return true;
  }

  // LEGAL: Public Prosecutors & Legal Officers have statewide docket jurisdiction and review access
  if (role === 'LEGAL') {
    return true;
  }

  return false;
}

export async function verifyCaseAccessForUser(
  caseId: string,
  user: CaseAccessUser
): Promise<boolean> {
  return canAccessCase(user, caseId);
}

/**
 * Resource-Level Authorization Middleware (Default Deny).
 * Enforces relational authorization on caseId before proceeding.
 */
export async function authorizeCaseAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.user;
  const caseId = req.params.caseId || req.params.id || req.body.caseId || (req.query.caseId as string);

  if (!user) {
    res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
    return;
  }

  if (!caseId) {
    res.status(400).json({ success: false, error: 'Bad Request: Case ID parameter is required' });
    return;
  }

  try {
    const hasAccess = await canAccessCase(user, caseId);
    if (!hasAccess) {
      res.status(403).json({
        success: false,
        error: `Access Denied: Officer ${user.username || user.badgeNo} (${user.badgeNo}) does not have active case clearance or approved access grant for Case ${caseId}`,
        requestId: `REQ-${Date.now()}`,
      });
      return;
    }
    next();
  } catch (err: any) {
    console.error('[CASE ACCESS AUTHORIZATION ERROR]', err);
    res.status(500).json({
      success: false,
      error: 'Internal authorization error',
      requestId: `REQ-${Date.now()}`,
    });
  }
}

