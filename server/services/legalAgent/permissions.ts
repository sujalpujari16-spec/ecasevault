/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Pre-Tool Authorization & Access Governance Engine
 * 
 * Invariant: The LLM NEVER receives case data without strict pre-execution
 * authorization from the backend RBAC / case access layer.
 */

import { AgentUser } from './types';
import { verifyCaseAccessForUser } from '../../middleware/caseAccess';
import { casePersistenceService } from '../casePersistenceService';

export class AgentPermissions {
  /**
   * Validates if the authenticated officer has legitimate access to query or inspect a case.
   * Leverages the authoritative single-source-of-truth verifyCaseAccessForUser.
   */
  public static async canAccessCase(caseId: string, user: AgentUser): Promise<{
    allowed: boolean;
    reason?: string;
    caseRecord?: any;
  }> {
    if (!caseId || typeof caseId !== 'string') {
      return { allowed: false, reason: 'Invalid or missing Case ID' };
    }

    const normalizedCaseId = caseId.trim().toUpperCase();

    // 1. Check if case exists in persistence store
    const caseRecord = casePersistenceService.getCaseById(normalizedCaseId);
    if (!caseRecord) {
      return { allowed: false, reason: `Case "${caseId}" not found in institutional repository.` };
    }

    // 2. Administrators and Statutory Auditors have oversight clearance
    if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
      return { allowed: true, caseRecord };
    }

    // 3. Station Isolation & Assigned IO Enforcement for Police Officers
    if (user.role === 'POLICE') {
      const assignedIoBadge = caseRecord.assigned_io_badge || '';
      const isAssignedIo = assignedIoBadge === user.badgeNo || (user.name && caseRecord.assigned_io?.includes(user.name));
      
      const userStnPrefix = (user.station || '').toLowerCase().split(' ')[0];
      const caseStnPrefix = (caseRecord.police_station || '').toLowerCase().split(' ')[0];
      const isStationMatch = Boolean(userStnPrefix && caseStnPrefix && (userStnPrefix === caseStnPrefix || (caseRecord.police_station || '').toLowerCase().includes(userStnPrefix)));

      if (!isAssignedIo && !isStationMatch) {
        return {
          allowed: false,
          reason: `ACCESS DENIED: Officer ${user.username} (${user.badgeNo}) from ${user.station || 'unassigned precinct'} lacks jurisdiction on ${caseRecord.police_station} docket ${caseRecord.fir_number || caseRecord.id}.`,
        };
      }
    }

    // 4. Delegate to relational RBAC engine
    const isAuthorized = await verifyCaseAccessForUser(caseRecord.id, {
      role: user.role,
      badgeNo: user.badgeNo,
      username: user.username,
      station: user.station,
      station_id: user.station_id,
    });

    if (!isAuthorized) {
      return {
        allowed: false,
        reason: `ACCESS DENIED: Officer ${user.username} (${user.badgeNo}) from ${user.station || 'unassigned precinct'} lacks jurisdiction and active assignment on Docket ${caseRecord.fir_number || caseRecord.id}.`,
      };
    }

    return { allowed: true, caseRecord };
  }

  /**
   * Checks role clearance for specialized departmental repositories
   */
  public static canAccessForensics(user: AgentUser): boolean {
    return ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'].includes(user.role);
  }

  public static canAccessEvidence(user: AgentUser): boolean {
    return ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'].includes(user.role);
  }

  public static canAccessCourtRecords(user: AgentUser): boolean {
    return ['POLICE', 'LEGAL', 'AUDITOR', 'ADMIN'].includes(user.role);
  }
}
