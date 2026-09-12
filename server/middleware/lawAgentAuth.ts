/**
 * e-CASEVAULT Law Agent Security Gateway Middleware
 * Phase 1: Institutional Access Control & Case Authorization Invariants
 * 
 * Invariants:
 * 1. POLICE role ONLY: Non-police roles (FORENSIC, LEGAL, AUDITOR, ADMIN) are strictly 403 Forbidden.
 * 2. Case-Level Authorization: Police users can only query cases they are assigned to or have jurisdiction over.
 * 3. Advisory Only: The AI system possesses ZERO mutation capabilities.
 *    It cannot modify FIRs, alter evidence, tamper with forensic reports, close cases,
 *    change custody, update permissions, or automatically file charge sheets.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedUser } from './auth';
import { casePersistenceService } from '../services/casePersistenceService';
import { pool } from '../config/database';

/**
 * Middleware: Enforces that ONLY users with the POLICE role can invoke the Law Agent.
 */
export function requireLawAgentAccess(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as AuthenticatedUser | undefined;

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required: Valid officer session token must be provided.',
    });
    return;
  }

  // Strict role whitelist: ONLY 'POLICE' is authorized
  if (user.role !== 'POLICE') {
    res.status(403).json({
      success: false,
      error: 'Law Agent is available only to POLICE users',
      policy: 'INSTITUTIONAL_RBAC_POLICE_ONLY',
      rejectedRole: user.role,
    });
    return;
  }

  next();
}

export interface CaseAccessVerificationResult {
  authorized: boolean;
  reason?: string;
  caseData?: any;
}

/**
 * Verifies that the requesting police officer has legitimate jurisdiction / assignment over the requested case docket.
 */
export async function verifyCaseAccess(
  user: AuthenticatedUser,
  caseIdentifier: string
): Promise<CaseAccessVerificationResult> {
  if (!user || user.role !== 'POLICE') {
    return {
      authorized: false,
      reason: 'Unauthorized: Officer session invalid or lacking POLICE role.',
    };
  }

  const cleanCaseId = caseIdentifier.trim();

  // 1. Try authoritative PostgreSQL check if online
  try {
    const dbRes = await pool.query(
      `SELECT c.id, c.case_number, c.police_station_id, c.investigating_officer_id, c.status
       FROM cases c
       WHERE c.id = $1 OR c.case_number = $1`,
      [cleanCaseId]
    );

    if (dbRes.rows.length > 0) {
      const caseRow = dbRes.rows[0];

      // Station or assigned IO match check
      const isStationMatch = !user.station_id || !caseRow.police_station_id || user.station_id === caseRow.police_station_id;
      const isAssignedIo = caseRow.investigating_officer_id === user.userId || caseRow.investigating_officer_id === user.badgeNo;

      if (!isStationMatch && !isAssignedIo) {
        return {
          authorized: false,
          reason: `Access Denied: Officer badge '${user.badgeNo}' from station '${user.station}' does not have jurisdictional clearance for docket '${cleanCaseId}'.`,
        };
      }

      return { authorized: true, caseData: caseRow };
    }
  } catch {
    // Database check fallback to persistence store
  }

  // 2. Fallback check on JSON persistence store
  const localCase = casePersistenceService.getCaseById(cleanCaseId);
  if (!localCase) {
    return {
      authorized: false,
      reason: `Case docket '${cleanCaseId}' not found in Maharashtra Police records.`,
    };
  }

  // Check station alignment or IO badge
  const officerBadge = user.badgeNo.toUpperCase();
  const assignedBadge = (localCase.assigned_io_badge || '').toUpperCase();
  const stationMatch = !user.station_id || !localCase.police_station_id ||
    user.station_id === localCase.police_station_id ||
    (localCase.police_station || '').toLowerCase().includes((user.station || '').toLowerCase());

  const ioMatch = assignedBadge === officerBadge ||
    (localCase.assigned_io || '').toLowerCase().includes((user.name || user.username || '').toLowerCase()) ||
    (localCase.pi_in_charge || '').toLowerCase().includes((user.name || user.username || '').toLowerCase());

  if (!stationMatch && !ioMatch) {
    return {
      authorized: false,
      reason: `Access Denied: Officer badge '${user.badgeNo}' does not have jurisdictional access to docket '${cleanCaseId}'. Station mismatch.`,
    };
  }

  return {
    authorized: true,
    caseData: localCase,
  };
}
