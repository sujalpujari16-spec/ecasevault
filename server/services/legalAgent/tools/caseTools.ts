/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Case Data Tools with Pre-Execution RBAC & Data Minimization
 */

import { AgentUser, ToolExecutionResult } from '../types';
import { AgentPermissions } from '../permissions';

/**
 * Redacts personal identifiable information (PII) before context enters the model.
 * Adheres to the principle of Data Minimization.
 */
function redactPiiFromCase(caseRecord: any): { sanitized: any; redactedFieldsCount: number } {
  let redactedCount = 0;
  const copy = JSON.parse(JSON.stringify(caseRecord));

  // Redact phone numbers
  const redactPhone = (val: string) => {
    if (typeof val === 'string' && /(?:\+91[\-\s]?)?[6789]\d{9}|\b\d{5}\s\d{5}\b/.test(val)) {
      redactedCount++;
      return '[PHONE REDACTED FOR PRIVACY]';
    }
    return val;
  };

  // Redact Aadhaar / National IDs
  const redactId = (val: string) => {
    if (typeof val === 'string' && /\b\d{4}\s?\d{4}\s?\d{4}\b/.test(val)) {
      redactedCount++;
      return '[NATIONAL_ID_REDACTED]';
    }
    return val;
  };

  if (copy.victim_records && Array.isArray(copy.victim_records)) {
    copy.victim_records = copy.victim_records.map((v: any) => ({
      ...v,
      phone: redactPhone(v.phone),
      mobile: redactPhone(v.mobile),
      aadhaar: redactId(v.aadhaar),
      address: '[RESIDENTIAL ADDRESS MASKED]',
    }));
  }

  if (copy.witnesses && Array.isArray(copy.witnesses)) {
    copy.witnesses = copy.witnesses.map((w: any) => ({
      ...w,
      contact: redactPhone(w.contact),
      phone: redactPhone(w.phone),
      address: '[ADDRESS MASKED]',
    }));
  }

  // Only return structural case information necessary for legal analysis
  const minimizedCase = {
    id: copy.id,
    firNumber: copy.fir_number,
    caseTitle: copy.case_title,
    policeStation: copy.police_station,
    jurisdictionZone: copy.jurisdiction_zone,
    crimeType: copy.crime_type,
    incidentDate: copy.incident_date,
    incidentLocation: copy.incident_location,
    status: copy.status,
    priority: copy.priority,
    ipcSections: copy.ipc_sections || [],
    piInCharge: copy.pi_in_charge,
    assignedIo: copy.assigned_io,
    summaryNotes: copy.summary_notes,
    blockchainStatus: copy.blockchain_status,
    blockchainTxId: copy.blockchain_tx_id,
    evidenceCount: (copy.evidence_items || []).length,
    documentsCount: (copy.documents || []).length,
    courtRecordsCount: (copy.court_records || []).length,
    forensicRequestsCount: (copy.forensic_requests || []).length,
  };

  return { sanitized: minimizedCase, redactedFieldsCount: redactedCount };
}

export async function executeGetCaseDetails(
  caseId: string,
  user: AgentUser
): Promise<ToolExecutionResult> {
  const auth = await AgentPermissions.canAccessCase(caseId, user);
  if (!auth.allowed) {
    return {
      toolName: 'get_case_details',
      isAuthorized: false,
      status: 'DENIED',
      error: auth.reason || 'Unauthorized case access.',
    };
  }

  const { sanitized, redactedFieldsCount } = redactPiiFromCase(auth.caseRecord);

  return {
    toolName: 'get_case_details',
    isAuthorized: true,
    status: 'SUCCESS',
    data: sanitized,
    dataMinimizationApplied: redactedFieldsCount > 0,
  };
}
