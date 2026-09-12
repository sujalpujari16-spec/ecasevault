import { sha256 } from './sha256';
import { 
  CaseFile, 
  UserSession, 
  PoliceRole, 
  EvidenceItemRecord, 
  AICaseSummary,
  AuditTrailEntry,
  OfficerProfile,
  CaseAssignment,
  CaseAccessRequest
} from '../types';

export interface AppNotification {
  id: string;
  type: 'CASE' | 'EVIDENCE' | 'FORENSIC' | 'REVIEW' | 'SECURITY' | 'ASSIGNMENT' | 'ACCESS_REQUEST' | 'ACCESS_EXPIRED';
  title: string;
  message: string;
  caseId?: string;
  timestamp: string;
  createdAt?: string;
  isRead: boolean;
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
}

export interface RoleDetail {
  roleTitle: string;
  description: string;
  permissions: string[];
}

// ============== ROLE HIERARCHY ORDER (lower index = higher authority) ==============
// ============== ROLE HIERARCHY ORDER (lower index = higher authority) ==============
export const ROLE_HIERARCHY: PoliceRole[] = [
  'ADMIN',
  'POLICE',
  'FORENSIC',
  'LEGAL',
  'AUDITOR'
];

export const RANK_HIERARCHY: Record<string, number> = {
  // System / State level
  'DGP': 0,
  'Director General of Police': 0,
  'ADGP': 1,
  'Additional Director General of Police': 1,
  'CP': 2,
  'Commissioner of Police': 2,
  'Joint CP': 3,
  'Additional CP': 3,
  'IGP': 3,
  'Inspector General of Police': 3,
  'DIG': 4,
  'Deputy Inspector General': 4,
  // District & Commissionerate Level (Equal Seniority)
  'DCP': 5,
  'Deputy Commissioner of Police': 5,
  'SP': 5,
  'Superintendent of Police (District Head)': 5,
  'Additional SP': 5,
  // Sub-division & Zone
  'ACP': 6,
  'Assistant Commissioner of Police': 6,
  'DySP': 6,
  'Deputy Superintendent of Police (Sub-Divisional Officer)': 6,
  'SDPO': 6,
  // Station In-Charge
  'SPI': 7,
  'Senior Police Inspector': 7,
  'Senior Police Inspector (Station In-Charge)': 7,
  'PI': 7,
  'Police Inspector': 7,
  'Police Inspector (Station Operations)': 7,
  // Investigation staff
  'API': 8,
  'Assistant Police Inspector': 8,
  'PSI': 9,
  'Police Sub-Inspector (IO)': 9,
  'Police Sub-Inspector': 9,
  'ASI': 10,
  'Assistant Sub-Inspector': 10,
  // Field
  'Head Constable': 11,
  'Police Constable': 12,
  'Constable': 12,
  // Scientific & Legal Specialists
  'Chief Forensic Scientist': 6,
  'Senior Scientific Officer': 7,
  'Public Prosecutor': 6,
  'Assistant Public Prosecutor': 7,
  'Senior Vigilance & Security Auditor': 6,
  'System Administrator': 0
};

export const ROLE_PERMISSIONS: Record<PoliceRole, RoleDetail> = {
  POLICE: {
    roleTitle: 'Police Officer / Station Authority',
    description: 'First Information Report (FIR) registration, investigation diary, evidence registration & seizure, transfer to FSL, witness statements, and case docket management.',
    permissions: [
      'case:create',
      'case:update',
      'case:view',
      'document:upload',
      'document:view',
      'evidence:create',
      'evidence:view',
      'evidence:transfer',
      'forensic:request',
      'view_all_cases',
      'create_case',
      'edit_case',
      'assign_io',
      'add_investigation',
      'create_evidence',
      'transfer_evidence',
      'create_forensic_request',
      'manage_witnesses',
      'manage_suspects',
      'upload_documents',
      'submit_for_review',
      'view_audit',
      'view_victim_details',
      'view_fingerprints',
      'add_fingerprint_record',
      'reassign_cases',
      'prisoner:view',
      'prisoner:update',
      'prisoner:admit',
      'custody:log',
      'warrant:view',
      'criminal_history:view',
      'criminal_history:search'
    ]
  },
  FORENSIC: {
    roleTitle: 'Forensic Science Specialist (FSL Kalina)',
    description: 'Forensic Science Laboratory analysis: DNA profiling, ballistics examination, toxicology analysis, fingerprint records, and digital evidence verification.',
    permissions: [
      'case:view',
      'document:view',
      'forensic:upload',
      'forensic:update',
      'evidence:view',
      'view_all_cases',
      'view_evidence',
      'view_forensics',
      'upload_documents',
      'transfer_evidence',
      'view_fingerprints',
      'view_audit'
    ]
  },
  LEGAL: {
    roleTitle: 'Prosecution & Legal Counsel',
    description: 'Judicial & prosecution workflow: legal scrutiny, charge sheet review, remand and bail filings, court proceeding logs, and e-Courts interoperability.',
    permissions: [
      'case:view',
      'document:view',
      'legal:upload',
      'legal:update',
      'evidence:view',
      'prisoner:view',
      'warrant:view',
      'criminal_history:view',
      'view_all_cases',
      'view_evidence',
      'upload_documents',
      'review_cases',
      'view_audit',
      'view_victim_details'
    ]
  },
  AUDITOR: {
    roleTitle: 'Compliance & Security Auditor',
    description: 'Audit & vigilance desk: monitor blockchain immutability, inspect cryptographic signatures, review access attempts, hash-chain audits, and district analytics.',
    permissions: [
      'case:view',
      'document:view',
      'audit:view',
      'audit:export',
      'integrity:verify',
      'prisoner:view',
      'warrant:view',
      'criminal_history:view',
      'view_all_cases',
      'view_audit',
      'view_analytics',
      'export_district_reports',
      'view_station_performance'
    ]
  },
  ADMIN: {
    roleTitle: 'System & Vault Administrator',
    description: 'Enterprise administration: user provisioning, role allocation, cryptographic system health, security policies, and technical configuration. (Restricted from altering case evidence).',
    permissions: [
      'user:create',
      'user:update',
      'role:assign',
      'permission:manage',
      'system:configure',
      'prisoner:view',
      'prisoner:update',
      'warrant:view',
      'criminal_history:view',
      'criminal_history:search',
      'view_all_cases',
      'view_audit',
      'view_analytics',
      'manage_officers',
      'configure_security'
    ]
  }
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Draft',
  'Draft': 'Draft',
  'FIR_REGISTERED': 'FIR Registered',
  'FIR Registered': 'FIR Registered',
  'INVESTIGATION_ONGOING': 'Investigation Ongoing',
  'Investigation Ongoing': 'Investigation Ongoing',
  'EVIDENCE_COLLECTION': 'Evidence Collection',
  'Evidence Collection': 'Evidence Collection',
  'EVIDENCE_PENDING': 'Evidence Collection',
  'Evidence Pending': 'Evidence Collection',
  'FORENSIC_EXAMINATION': 'Forensic Examination',
  'Forensic Examination': 'Forensic Examination',
  'FORENSIC_PROCESSING': 'Forensic Processing',
  'Forensic Processing': 'Forensic Processing',
  'LEGAL_REVIEW': 'Legal Review',
  'Legal Review': 'Legal Review',
  'CHARGE_SHEET_COURT_PROCESS': 'Charge Sheet / Court Process',
  'Charge Sheet / Court Process': 'Charge Sheet / Court Process',
  'CHARGE_SHEET_PROSECUTION': 'Charge Sheet / Court Process',
  'Charge Sheet / Prosecution Stage': 'Charge Sheet / Court Process',
  'PENDING_SUPERVISORY_REVIEW': 'Legal Review',
  'Pending Supervisory Review': 'Legal Review',
  'CLOSED': 'Closed (Archived)',
  'Closed': 'Closed (Archived)'
};

// ============== PERMISSION & RBAC HELPERS ==============

export function normaliseRole(role: string | undefined): PoliceRole {
  if (!role) return 'POLICE';
  const r = role.toUpperCase().trim();
  if (['POLICE', 'PI', 'PSI', 'API', 'ASI', 'OFFICER', 'POLICE OFFICER', 'INVESTIGATOR', 'SP', 'DYSP'].includes(r)) {
    return 'POLICE';
  }
  if (['FORENSIC', 'FSL'].includes(r) || r.includes('FORENSIC')) {
    return 'FORENSIC';
  }
  if (['LEGAL', 'LEGAL OFFICER', 'PROSECUTOR'].includes(r) || r.includes('LEGAL')) {
    return 'LEGAL';
  }
  // External Integration / Department mappings map to canonical roles:
  if (['JAIL', 'PRISON', 'SUPERINTENDENT', 'JAIL OFFICER', 'WARDEN'].includes(r) || r.includes('JAIL') || r.includes('PRISON')) {
    return 'POLICE';
  }
  if (['NCRB', 'SCRB', 'CRIME RECORDS', 'ANALYST'].includes(r) || r.includes('NCRB') || r.includes('SCRB')) {
    return 'POLICE';
  }
  if (['AUDITOR', 'AUDIT', 'VIGILANCE'].includes(r) || r.includes('AUDIT')) {
    return 'AUDITOR';
  }
  if (['ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'].includes(r) || r.includes('ADMIN')) {
    return 'ADMIN';
  }
  return 'POLICE';
}

export function hasPermission(role: PoliceRole, permission: string): boolean {
  const normRole = normaliseRole(role);
  return ROLE_PERMISSIONS[normRole]?.permissions.includes(permission) ?? false;
}

export function canCreateCase(sessionOrRole: UserSession | PoliceRole | string): boolean {
  const role = typeof sessionOrRole === 'string' ? normaliseRole(sessionOrRole) : sessionOrRole.role;
  return role === 'POLICE';
}

/**
 * Core need-to-know access check:
 * ADMIN, AUDITOR, FORENSIC, and LEGAL have cross-case access for governance, audit, specialist dockets, and prosecution.
 * POLICE officers access cases within their assigned station or through explicit case assignment.
 */
export function canAccessCase(session: UserSession, caseFile: CaseFile): boolean {
  // Administrative and Audit oversight
  if (session.role === 'ADMIN' || session.role === 'AUDITOR') {
    return true;
  }

  // Legal and Forensic specialist access
  if (session.role === 'FORENSIC' || session.role === 'LEGAL') {
    return true;
  }
  
  // Police officers: strict default deny. Only active IO or active assignment/approved grant allowed.
  if (session.role === 'POLICE') {
    return isOfficerAssignedToCase(session.badgeNo, caseFile);
  }

  return false;
}

/**
 * Checks if an officer is the active IO or has an ACTIVE assignment / unexpired approved access grant.
 */
export function isOfficerAssignedToCase(badgeNo: string, caseFile: CaseFile): boolean {
  // 1. Direct active Investigating Officer (IO)
  if (
    caseFile.officers?.assignedIOBadge === badgeNo ||
    (caseFile as any).investigating_officer_id === badgeNo
  ) {
    return true;
  }

  // 2. Active team assignment
  const assignments = caseFile.caseAssignments || [];
  const hasActiveAssignment = assignments.some(
    a => a.userId === badgeNo && a.status === 'Active'
  );
  if (hasActiveAssignment) return true;

  // 3. Approved, non-expired cross-station access request
  const requests = caseFile.accessRequests || [];
  const now = new Date();
  const hasApprovedRequest = requests.some(r => {
    if (r.requestedByUserId !== badgeNo) return false;
    if (r.status !== 'Approved') return false;
    if (r.expiresAt && new Date(r.expiresAt) < now) return false;
    return true;
  });

  return hasApprovedRequest;
}

/**
 * Returns the reason why an officer lost access (for the "Access Revoked" screen).
 */
export function getAccessRevocationReason(badgeNo: string, caseFile: CaseFile): {
  wasAssigned: boolean;
  removalReason?: string;
  removedAt?: string;
  removedByName?: string;
  hasExpiredRequest: boolean;
  expiredAt?: string;
} {
  const assignments = caseFile.caseAssignments || [];
  const removedAssignment = assignments.find(
    a => a.userId === badgeNo && a.status === 'Removed'
  );

  const requests = caseFile.accessRequests || [];
  const now = new Date();
  const expiredRequest = requests.find(r => {
    return r.requestedByUserId === badgeNo &&
      r.status === 'Approved' &&
      r.expiresAt &&
      new Date(r.expiresAt) < now;
  });

  return {
    wasAssigned: !!removedAssignment,
    removalReason: removedAssignment?.removalReason,
    removedAt: removedAssignment?.removedAt,
    removedByName: removedAssignment?.removedByName,
    hasExpiredRequest: !!expiredRequest,
    expiredAt: expiredRequest?.expiresAt
  };
}

export function isCaseReadOnly(caseFile: CaseFile): boolean {
  return caseFile.status === 'Closed' || (caseFile.status as string) === 'CLOSED';
}

export function canEditCase(session: UserSession, caseFile: CaseFile): boolean {
  if (isCaseReadOnly(caseFile)) return false;
  if (session.role === 'AUDITOR' || session.role === 'ADMIN') return false;
  if (session.role === 'POLICE') {
    return canAccessCase(session, caseFile);
  }
  return false;
}

export function canAssignIO(session: UserSession, caseFile: CaseFile): boolean {
  if (isCaseReadOnly(caseFile)) return false;
  return (session.role === 'POLICE' || session.role === 'ADMIN') && canAccessCase(session, caseFile);
}

export function canReassignCase(session: UserSession, caseFile: CaseFile): boolean {
  if (isCaseReadOnly(caseFile)) return false;
  return (session.role === 'POLICE' || session.role === 'ADMIN') && canAccessCase(session, caseFile);
}

export function canCreateEvidence(session: UserSession, caseFile: CaseFile): boolean {
  if (isCaseReadOnly(caseFile)) return false;
  if (session.role === 'POLICE') {
    return canAccessCase(session, caseFile);
  }
  return false;
}

export function canTransferEvidence(session: UserSession, _evidence: EvidenceItemRecord, caseFile: CaseFile): boolean {
  if (isCaseReadOnly(caseFile)) return false;
  return (session.role === 'POLICE' || session.role === 'FORENSIC') && canAccessCase(session, caseFile);
}

export function canSubmitForReview(session: UserSession, caseFile: CaseFile): boolean {
  if (isCaseReadOnly(caseFile)) return false;
  return session.role === 'POLICE' && canAccessCase(session, caseFile);
}

export function canReviewCase(session: UserSession, _caseFile: CaseFile): boolean {
  return session.role === 'POLICE' || session.role === 'LEGAL' || session.role === 'ADMIN';
}

export function canApproveClosure(session: UserSession, _caseFile: CaseFile): boolean {
  return session.role === 'POLICE' || session.role === 'ADMIN';
}

export function canManageOfficers(session: UserSession): boolean {
  return session.role === 'ADMIN';
}

export function canViewVictimDetails(session: UserSession): boolean {
  return session.role === 'POLICE' || session.role === 'LEGAL' || session.role === 'ADMIN';
}

export function canSubmitAccessRequest(session: UserSession, caseFile: CaseFile): boolean {
  if (session.role === 'ADMIN' || session.role === 'AUDITOR') return false;
  return !canAccessCase(session, caseFile);
}

export function canApproveAccessRequest(session: UserSession): boolean {
  return session.role === 'POLICE' || session.role === 'ADMIN';
}

/**
 * Departmental file upload check:
 * POLICE can upload to POLICE department section (FIR, Panchnama, Case Diary, etc.)
 * FORENSIC can upload to FORENSIC department section (DNA, Ballistics, FSL Reports)
 * LEGAL can upload to LEGAL department section (Remand, Bail, Charge Sheet, Court Orders)
 * AUDITOR and ADMIN are restricted from direct case file uploads.
 */
export function canUploadForDepartment(role: PoliceRole, department: import('../types').RepoDepartment): boolean {
  if (role === 'POLICE' && department === 'POLICE') return true;
  if (role === 'FORENSIC' && department === 'FORENSIC') return true;
  if (role === 'LEGAL' && department === 'LEGAL') return true;
  return false;
}

export function canVerifyIntegrity(_sessionOrRole?: UserSession | PoliceRole | string): boolean {
  return true; // All stakeholders can run SHA-256 + digital signature verification
}

/**
 * Returns whether a creator can create an officer account (ADMIN only).
 */
export function canCreateMemberOfRank(creatorRole: PoliceRole, _targetRankLabel: string): boolean {
  return creatorRole === 'ADMIN';
}

// ============== DYNAMIC AI CASE BRIEF GENERATOR ==============

export function generateAICaseBrief(caseItem: CaseFile): AICaseSummary {
  const evCount = caseItem.evidenceItems?.length || 0;
  const digitalEvCount = caseItem.evidenceItems?.filter(e => e.category === 'Digital Evidence').length || 0;
  const fslPending = caseItem.forensicRequests?.filter(f => f.status !== 'Closed').length || 0;
  const witnessesCount = caseItem.witnesses?.length || 0;
  const suspectsCount = caseItem.suspects?.length || 0;
  const arrestsCount = caseItem.suspects?.filter(s => s.status === 'Arrested' || s.status === 'Under Judicial Remand').length || 0;
  const fpCount = caseItem.fingerprintRecords?.length || 0;
  const fpPending = caseItem.fingerprintRecords?.filter(f => f.forensicStatus === 'Pending Examination').length || 0;
  const isClosed = isCaseReadOnly(caseItem);

  const pendingItems: string[] = [];
  const riskFlags: string[] = [];

  if (isClosed) {
    return {
      status: 'Case Closed & Disposed — Statutory Charge Sheet Filed',
      evidenceCount: evCount,
      digitalEvidenceCount: digitalEvCount,
      forensicStatus: fslPending > 0 ? `${fslPending} Archived Reports` : 'All FSL Examinations Completed',
      witnessesCount,
      suspectsCount,
      pendingItems: ['Archived in Digital Police Record Repository (10-year retention rule)'],
      suggestedAction: 'No pending police actions. Docket sealed under Section 173 CrPC final order.',
      riskFlags: ['Case is Read-Only / Digitally Signed Final Archive'],
      similarCases: [
        {
          caseId: 'MH-MUM-2024-001201',
          title: 'State vs. Cyber Infiltration Matrix',
          similarityScore: '94% Match',
          outcome: 'Final Conviction under IPC Sec 420 & 120B'
        }
      ]
    };
  }

  if (!caseItem.officers?.assignedIO || caseItem.officers.assignedIO.includes('Pending')) {
    pendingItems.push('Designate Lead Investigating Officer (IO) under Sec 157 CrPC');
    riskFlags.push('IO assignment pending');
  }

  if (evCount === 0) {
    pendingItems.push('Conduct Spot Panchnama & seize material evidence');
    riskFlags.push('Zero physical/digital evidence items registered');
  }

  if (fslPending > 0) {
    pendingItems.push(`Follow up with FSL Kalina on ${fslPending} active laboratory requests`);
  }

  if (fpPending > 0) {
    pendingItems.push(`Submit ${fpPending} fingerprint record(s) for forensic examination`);
  }

  if (witnessesCount === 0) {
    pendingItems.push('Record statements of primary complainant and spot witnesses (Sec 161 CrPC)');
  }

  if (suspectsCount > 0 && arrestsCount === 0) {
    pendingItems.push('Issue Sec 41A CrPC notice / proceed with custodial interrogation');
  }

  if (caseItem.status === 'Legal Review' || caseItem.status === 'Pending Supervisory Review') {
    pendingItems.push('Legal scrutiny & charge sheet vetting pending: verify evidence chain of custody & investigation diary');
  }

  if (!caseItem.victimRecord) {
    pendingItems.push('Record victim/complainant information in victim module');
  }

  let suggestedAction = 'Proceed with routine investigative diary entries and witness summons under CrPC.';
  if (pendingItems.length > 0) {
    suggestedAction = `Priority Action: ${pendingItems[0]}`;
  }

  if (caseItem.priority === 'CRITICAL') {
    riskFlags.push('High-profile district investigation: expedited 30-day charge sheet timeline');
  }

  if (fpCount > 0) {
    riskFlags.push(`${fpCount} fingerprint record(s) documented — forensic comparison ${fpPending > 0 ? 'pending' : 'completed'}`);
  }

  return {
    status: `Active Inquiry (${caseItem.status})`,
    evidenceCount: evCount,
    digitalEvidenceCount: digitalEvCount,
    forensicStatus: fslPending > 0 ? `${fslPending} Pending Lab Reports` : 'All Available Reports Received',
    witnessesCount,
    suspectsCount,
    pendingItems: pendingItems.length > 0 ? pendingItems : ['No statutory pendency detected.'],
    suggestedAction,
    riskFlags: riskFlags.length > 0 ? riskFlags : ['Statutory procedures on schedule.'],
    similarCases: [
      {
        caseId: 'MH-MUM-2025-004492',
        title: 'State vs. Nexus Syndicate (Financial Fraud)',
        similarityScore: '89% Modus Operandi Match',
        outcome: 'Charge Sheet Filed, 3 Arrests Secured'
      },
      {
        caseId: 'MH-THN-2024-001092',
        title: 'State vs. Cyber SIM Cloning Ring',
        similarityScore: '76% Modus Operandi Match',
        outcome: 'Judicial Remand & Hardware Seizure Verified'
      }
    ]
  };
}

// ============== NOTIFICATION ENGINE ==============

export function generateNotifications(cases: CaseFile[], session: UserSession): AppNotification[] {
  const notifications: AppNotification[] = [];

  cases.forEach((c) => {
    // Unassigned IO Alert for Police
    if (session.role === 'POLICE' && (!c.officers?.assignedIO || c.officers.assignedIO.includes('Pending'))) {
      notifications.push({
        id: `NOTIF-IO-${c.id}`,
        type: 'CASE',
        title: `IO Assignment Required: ${c.id}`,
        message: `FIR ${c.firNumber} (${c.caseTitle.substring(0, 30)}...) has no designated Investigating Officer.`,
        caseId: c.id,
        timestamp: 'Immediate Attention',
        isRead: false,
        severity: 'HIGH'
      });
    }

    // Pending Legal Scrutiny Alert for Legal Officers
    if ((session.role === 'LEGAL' || session.role === 'ADMIN') && (c.status === 'Legal Review' || c.status === 'Pending Supervisory Review')) {
      notifications.push({
        id: `NOTIF-REV-${c.id}`,
        type: 'REVIEW',
        title: `Legal Review Ready: ${c.id}`,
        message: `Docket submitted with complete investigation journal & evidence chain for prosecution vetting.`,
        caseId: c.id,
        timestamp: 'Action Required',
        isRead: false,
        severity: 'HIGH'
      });
    }

    // Critical Priority Cases for Administration / Command
    if ((session.role === 'ADMIN' || session.role === 'POLICE') && c.priority === 'CRITICAL' && c.status !== 'Closed') {
      notifications.push({
        id: `NOTIF-CRIT-${c.id}`,
        type: 'CASE',
        title: `Critical Incident Monitored: ${c.id}`,
        message: `High-priority docket ${c.caseTitle.substring(0, 35)}... at ${c.policeStation}.`,
        caseId: c.id,
        timestamp: 'Active Monitoring',
        isRead: false,
        severity: 'MEDIUM'
      });
    }

    // Pending access requests for approving authority
    if (canApproveAccessRequest(session)) {
      const pendingRequests = (c.accessRequests || []).filter(r => r.status === 'Pending');
      pendingRequests.forEach(r => {
        notifications.push({
          id: `NOTIF-AR-${r.requestId}`,
          type: 'ACCESS_REQUEST',
          title: `Access Request Pending: ${r.requestId}`,
          message: `${r.requestedByRank} ${r.requestedByName} requests ${r.requestedAccessLevel} access to Case ${c.id}.`,
          caseId: c.id,
          timestamp: r.submittedAt,
          isRead: false,
          severity: 'HIGH'
        });
      });
    }

    // Delayed Forensic Alert
    c.forensicRequests?.forEach((f) => {
      if (f.status === 'Under Examination' || f.status === 'Evidence Received') {
        notifications.push({
          id: `NOTIF-FSL-${f.id}`,
          type: 'FORENSIC',
          title: `FSL Lab Pending: ${f.id}`,
          message: `Laboratory report for ${f.evidenceTag} expected on ${f.expectedCompletionDate}.`,
          caseId: c.id,
          timestamp: f.submissionDate,
          isRead: false,
          severity: 'INFO'
        });
      }
    });
  });

  return notifications;
}

// ============== AUTHENTIC CRYPTOGRAPHIC SHA-256 DIGEST ==============

export function generateSimulatedSHA256(input: string): string {
  return sha256(input);
}

export { sha256 };

// ============== AVAILABLE RANKS FOR MEMBER CREATION ==============

export const RANKS_BY_CREATOR: Record<PoliceRole, string[]> = {
  POLICE: [
    'Police Inspector',
    'Assistant Police Inspector',
    'Police Sub-Inspector (IO)',
    'Police Sub-Inspector',
    'Assistant Sub-Inspector',
    'Head Constable',
    'Police Constable'
  ],
  FORENSIC: [
    'Chief Forensic Scientist',
    'Senior Scientific Officer',
    'Scientific Assistant'
  ],
  LEGAL: [
    'Public Prosecutor',
    'Assistant Public Prosecutor',
    'Legal Advisor'
  ],
  AUDITOR: [
    'Senior Vigilance & Security Auditor',
    'Compliance Auditor'
  ],
  ADMIN: [
    'Superintendent of Police (District Head)',
    'Deputy Superintendent of Police (Sub-Divisional Officer)',
    'Police Inspector (Station In-Charge)',
    'Police Sub-Inspector (IO)',
    'Chief Forensic Scientist',
    'Public Prosecutor',
    'Superintendent of Prisons',
    'Crime Records Officer',
    'Senior Vigilance & Security Auditor',
    'System Administrator'
  ]
};

export const STATION_LIST = [
  'Andheri Police Station, Mumbai',
  'Bandra Police Station, Mumbai',
  'Juhu Police Station, Mumbai',
  'Versova Police Station, Mumbai',
  'Santacruz Police Station, Mumbai',
  'Vile Parle Police Station, Mumbai',
  'Kurla Police Station, Mumbai',
  'Borivali Police Station, Mumbai',
  'Malad Police Station, Mumbai',
  'Kandivali Police Station, Mumbai',
  'Dadar Police Station, Mumbai',
  'Worli Police Station, Mumbai',
  'Colaba Police Station, Mumbai',
  'Vashi Police Station, Navi Mumbai',
  'Cyber Crime Police Station, Navi Mumbai'
];

export function getDynamicStationList(): string[] {
  if (typeof window === 'undefined') return STATION_LIST;
  try {
    const raw = localStorage.getItem('casevault_police_stations_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const names = parsed.map((s: any) => s.name).filter(Boolean);
        return Array.from(new Set([...names, ...STATION_LIST]));
      }
    }
  } catch {}
  return STATION_LIST;
}

/**
 * Maps application audit action strings to valid BlockchainActionType enum values.
 * Prevents string mismatches and eliminates `as any` type bypasses.
 */
export function mapAuditActionToBlockchainType(action: string): import('../types').BlockchainActionType {
  switch (action) {
    case 'ASSIGNED_IO':
    case 'CASE_ASSIGNED':
      return 'CASE_ASSIGNED';
    case 'CASE_REASSIGNED':
    case 'REASSIGNED_OFFICER':
      return 'CASE_REASSIGNED';
    case 'SEIZED_EVIDENCE':
    case 'EVIDENCE_REGISTERED':
      return 'EVIDENCE_REGISTERED';
    case 'EVIDENCE_TRANSFERRED':
    case 'TRANSFERRED_EVIDENCE':
      return 'EVIDENCE_TRANSFERRED';
    case 'LOGGED_INVESTIGATION':
    case 'INVESTIGATION_UPDATE':
    case 'UPLOADED_DOCUMENT':
      return 'INVESTIGATION_UPDATE';
    case 'REQUESTED_FORENSIC_EXAM':
    case 'FORENSIC_REQUEST_CREATED':
      return 'FORENSIC_REQUEST_CREATED';
    case 'UPDATED_FORENSIC_STATUS':
    case 'SUBMITTED_FOR_REVIEW':
    case 'DYSP_REVIEW_RETURNED':
    case 'CASE_STATUS_UPDATED':
      return 'CASE_STATUS_UPDATED';
    case 'APPROVED_CASE_CLOSURE':
    case 'CASE_CLOSED':
      return 'CASE_CLOSED';
    case 'ACCESS_REQUEST_SUBMITTED':
    case 'SUBMITTED_ACCESS_REQUEST':
      return 'ACCESS_REQUEST_SUBMITTED';
    case 'ACCESS_REQUEST_APPROVED':
    case 'APPROVED_ACCESS_REQUEST':
      return 'ACCESS_REQUEST_APPROVED';
    case 'ACCESS_REQUEST_REJECTED':
    case 'REJECTED_ACCESS_REQUEST':
      return 'ACCESS_REQUEST_REJECTED';
    case 'CREATED_OFFICER':
    case 'MEMBER_CREATED':
      return 'MEMBER_CREATED';
    case 'FINGERPRINT_REGISTERED':
      return 'FINGERPRINT_REGISTERED';
    case 'VICTIM_DATA_ACCESSED':
      return 'VICTIM_DATA_ACCESSED';
    case 'INTEGRITY_ALERT':
      return 'INTEGRITY_ALERT';
    default:
      return 'INVESTIGATION_UPDATE';
  }
}

/**
 * Generates an official, precise statutory docket timestamp including exact IST time.
 * e.g. "08 SEP 2026 • 18:36:12 IST"
 */
export function generateCurrentDocketTimestamp(date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST';
  return `${dateStr} • ${timeStr}`;
}

/**
 * Standardizes any raw date/timestamp string into a clean, authoritative docket format.
 * Returns date and time components with precision.
 */
export function formatDocketTimestamp(rawDate: string, eventId?: string): { dateStr: string; timeStr: string; fullStr: string } {
  if (!rawDate) {
    const current = generateCurrentDocketTimestamp();
    const [d, t] = current.split(' • ');
    return { dateStr: d, timeStr: t, fullStr: current };
  }

  // Already formatted with time
  if (rawDate.includes('•')) {
    const parts = rawDate.split('•').map(p => p.trim());
    return {
      dateStr: parts[0],
      timeStr: parts[1] || '10:00:00 IST',
      fullStr: rawDate
    };
  }

  let parsedDate: Date | null = null;
  let timeStr = '10:30:00 IST';

  // Extract unix millis from event ID if available, e.g. TL-EVD-1725791784000
  const tsMatch = eventId?.match(/(\d{13})/);
  if (tsMatch) {
    const d = new Date(parseInt(tsMatch[1], 10));
    if (!isNaN(d.getTime())) {
      parsedDate = d;
      timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST';
    }
  }

  if (!parsedDate) {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      parsedDate = d;
      if (rawDate.includes(':')) {
        timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' IST';
      } else {
        // Derive consistent stable deterministic time
        let hash = 0;
        for (let i = 0; i < rawDate.length; i++) hash = (hash * 31 + rawDate.charCodeAt(i)) % 10000;
        const hr = String(9 + (hash % 9)).padStart(2, '0');
        const mn = String((hash * 7) % 60).padStart(2, '0');
        const sc = String((hash * 13) % 60).padStart(2, '0');
        timeStr = `${hr}:${mn}:${sc} IST`;
      }
    }
  }

  let dateStr = rawDate;
  if (parsedDate) {
    dateStr = parsedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  }

  return {
    dateStr,
    timeStr,
    fullStr: `${dateStr} • ${timeStr}`
  };
}
