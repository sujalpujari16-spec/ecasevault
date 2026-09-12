export type DocumentType = 
  | 'FIR_POLICE_REPORT'
  | 'INVESTIGATION_RECORD'
  | 'WITNESS_STATEMENT'
  | 'CHARGE_SHEET'
  | 'COURT_FILING'
  | 'FORENSIC_REPORT'
  | 'EVIDENCE_RECORD'
  | 'SEIZURE_MEMO'
  | 'SEARCH_WARRANT'
  | 'CLOSURE_REPORT'
  | 'LEGAL_NOTICE_JUDGMENT';

export type ClearanceLevel = 'PUBLIC_RECORD' | 'CONFIDENTIAL' | 'RESTRICTED' | 'TOP_SECRET_INVESTIGATION';

export type DepartmentStakeholder = 'POLICE_INVESTIGATION' | 'JUDICIARY_COURTS' | 'FORENSIC_FSL' | 'PROSECUTION_LEGAL' | 'ASSET_ARMORY';

// System-Level Stakeholder Roles (e-CASEVAULT Core RBAC Model: 5 Canonical Roles)
export type PoliceRole = 'POLICE' | 'FORENSIC' | 'LEGAL' | 'AUDITOR' | 'ADMIN';

// Action-Based Permissions
export type AppPermission =
  | 'case:create'
  | 'case:update'
  | 'case:view'
  | 'document:upload'
  | 'document:view'
  | 'evidence:create'
  | 'evidence:view'
  | 'evidence:transfer'
  | 'forensic:request'
  | 'forensic:upload'
  | 'forensic:update'
  | 'legal:upload'
  | 'legal:update'
  | 'prisoner:view'
  | 'prisoner:update'
  | 'prisoner:admit'
  | 'custody:log'
  | 'warrant:view'
  | 'warrant:create'
  | 'hearing:view'
  | 'hearing:create'
  | 'criminal_history:view'
  | 'criminal_history:search'
  | 'audit:view'
  | 'audit:export'
  | 'integrity:verify'
  | 'user:create'
  | 'user:update'
  | 'role:assign'
  | 'permission:manage'
  | 'system:configure';

// Case Repository Document Hierarchy & Sections
export type RepoDepartment = 'POLICE' | 'FORENSIC' | 'LEGAL';

export type RepoDocumentType =
  // POLICE
  | 'FIR'
  | 'POLICE_REPORT'
  | 'CASE_DIARY'
  | 'WITNESS_STATEMENT'
  | 'ACCUSED_STATEMENT'
  | 'ARREST_MEMO'
  | 'PANCHNAMA'
  | 'CHARGE_SHEET'
  | 'SEIZURE_MEMO'
  // FORENSIC
  | 'FORENSIC_REQUEST'
  | 'DNA_REPORT'
  | 'FINGERPRINT_REPORT'
  | 'BALLISTICS_REPORT'
  | 'FSL_REPORT'
  | 'EXAMINATION_RECORD'
  // LEGAL
  | 'COURT_FILING'
  | 'REMAND_ORDER'
  | 'BAIL_ORDER'
  | 'COURT_ORDER'
  | 'HEARING_RECORD'
  | 'JUDGMENT'
  | 'LEGAL_NOTICE'
  | 'WITNESS_STATEMENT'
  | 'SEC_164_STATEMENT'
  | 'LEGAL_SUBMISSION';

export interface RepoDocument {
  id: string;
  caseId: string;
  title: string;
  fileName?: string;
  documentType: RepoDocumentType;
  department: RepoDepartment;
  description?: string;
  uploadedBy: string;
  uploadedByBadge: string;
  uploadedAt: string;
  version: number;
  fileSize: number;
  mimeType: string;
  storageUri?: string;
  sha256Hash: string;
  digitalSignature?: string;
  isVerified: boolean;
  blockchainTxId?: string;
  classification: 'CONFIDENTIAL' | 'RESTRICTED' | 'SECRET';
  previousVersionHash?: string;
}

export interface UserSession {
  username: string;
  officerName: string;
  rank: string;
  badgeNo: string;
  station: string;
  jurisdictionZone?: string;
  department: DepartmentStakeholder;
  clearanceLevel: ClearanceLevel;
  role: PoliceRole;
  isLoggedIn: boolean;
}

export type CaseStatus = 
  | 'Draft'
  | 'FIR Registered'
  | 'Investigation Ongoing'
  | 'Evidence Collection'
  | 'Evidence Pending'
  | 'Forensic Examination'
  | 'Forensic Processing'
  | 'Legal Review'
  | 'Charge Sheet / Court Process'
  | 'Charge Sheet / Prosecution Stage'
  | 'Pending Supervisory Review'
  | 'Closed';

export type CasePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'ROUTINE';
export type PriorityLevel = CasePriority;
export type CrimeType = string;

export type InvestigationActivityType = 
  | 'Site Visit'
  | 'Witness Interview'
  | 'Suspect Inquiry'
  | 'CCTV Collection'
  | 'Search/Seizure'
  | 'Evidence Recovery'
  | 'Forensic Request'
  | 'Document Review'
  | 'Senior Review'
  | 'Case Status Update';

export interface InvestigationEntry {
  id: string;
  caseId: string;
  timestamp: string;
  officerName: string;
  officerRank: string;
  officerBadge: string;
  activityType: InvestigationActivityType;
  notes: string;
  nextAction: string;
  reviewStatus: 'PENDING_REVIEW' | 'REVIEWED_BY_DYSP' | 'APPROVED_BY_SP' | 'LOGGED';
  attachmentsCount?: number;
}

export type EvidenceCategory = 
  | 'Digital Evidence'
  | 'Physical Weapon'
  | 'Forensic Sample'
  | 'Documentary Evidence'
  | 'Narcotic Sample'
  | 'Vehicle / Machinery'
  | 'Currency / Valuables';

export type EvidenceStatus = 
  | 'Collected & Sealed'
  | 'Malkhana Storage'
  | 'Transferred to FSL'
  | 'Under Examination'
  | 'Report Received'
  | 'Stored in Secure Vault'
  | 'Submitted to Court';

export interface ChainOfCustodyTransfer {
  transferId: string;
  evidenceId: string;
  fromOfficer: string;
  fromRole: string;
  toOfficer: string;
  toRole: string;
  timestamp: string;
  location: string;
  action: string;
  condition: string;
  sealIntact: boolean;
  notes: string;
}

export interface EvidenceItemRecord {
  id: string;
  caseId: string;
  evidenceTag: string; // e.g. "EV-MH-2026-009821"
  category: EvidenceCategory;
  description: string;
  collectedBy: string;
  collectedByBadge: string;
  collectionDate: string;
  locationFound: string;
  storageLocker: string;
  currentCustodian: string;
  status: EvidenceStatus;
  originalHash: string;
  currentHash: string;
  isIntegrityVerified: boolean;
  notes: string;
  transfers: ChainOfCustodyTransfer[];
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
}

export type ForensicStatus = 
  | 'Request Created'
  | 'Evidence Received'
  | 'Under Examination'
  | 'Report Ready'
  | 'Report Reviewed'
  | 'Closed';

export interface ForensicRequest {
  id: string;
  caseId: string;
  evidenceId: string;
  evidenceTag: string;
  labName: string;
  requestedExam: string;
  requestingOfficer: string;
  submissionDate: string;
  expectedCompletionDate: string;
  status: ForensicStatus;
  analystName?: string;
  findings?: string;
  ballisticsSummary?: string;
  dnaMatchRate?: string;
  verificationSeal?: string;
  isOverdue?: boolean;
  requisitionLetterName?: string;
  requisitionLetterUrl?: string;
  requisitionLetterHash?: string;
  requisitionLetterSize?: number;
  requisitionLetterRef?: string;
  reportDocumentName?: string;
  reportDocumentUrl?: string;
  reportDocumentHash?: string;
}

export interface SuspectRecord {
  id: string;
  caseId: string;
  name: string;
  alias: string;
  age: number;
  status: 'Person of Interest' | 'Suspect' | 'Arrested' | 'Fugitive' | 'Under Judicial Remand';
  tag: string;
  photoUrl: string;
  fingerprintClass: string;
  custodyStatus: string;
  lastKnownLocation: string;
  linkedEvidenceIds: string[];
  investigationNotes: string;
  isSensitiveRestricted?: boolean;
}

export interface WitnessAttachment {
  id: string;
  name: string;
  type: 'document' | 'video' | 'image' | 'audio' | 'other';
  url: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
}

export interface WitnessRecord {
  id: string;
  caseId: string;
  name: string;
  statementStatus: 'Statement Recorded' | 'Pending Interview' | 'Protective Custody' | 'Summons Issued';
  statementDate: string;
  recordedBy: string;
  protectionRequired: boolean;
  statementSummary: string;
  photoUrl?: string;
  isSensitiveRestricted?: boolean;
  relatedDocIds?: string[];
  attachments?: WitnessAttachment[];
}

export interface DocumentRecord {
  id: string;
  docNumber: string;
  caseId: string;
  title: string;
  type: DocumentType;
  department: DepartmentStakeholder;
  clearance: ClearanceLevel;
  authorName: string;
  authorRank: string;
  createdDate: string;
  lastModified: string;
  version: string;
  sha256Hash: string;
  digitalSignature: {
    signedBy: string;
    certId: string;
    timestamp: string;
    isVerified: boolean;
  };
  summary: string;
  tags: string[];
  contentBody: string;
  attachmentsCount: number;
  courtFilingRef?: string;
  ipcSections?: string[];
  chainOfCustodyCount?: number;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface CaseTimelineEvent {
  id: string;
  date: string;
  title: string;
  description: string;
  officer: string;
  badge: string;
  type: 'FIR' | 'IO_ASSIGNED' | 'EVIDENCE' | 'FORENSIC' | 'REVIEW' | 'CHARGE_SHEET' | 'GENERAL' | 'ASSIGNMENT' | 'REASSIGNMENT' | 'ACCESS_REVOKED' | 'ACCESS_GRANTED';
}

export interface AICaseSummary {
  status: string;
  evidenceCount: number;
  digitalEvidenceCount: number;
  forensicStatus: string;
  witnessesCount: number;
  suspectsCount: number;
  pendingItems: string[];
  suggestedAction: string;
  riskFlags: string[];
  similarCases: Array<{
    caseId: string;
    title: string;
    similarityScore: string;
    outcome: string;
  }>;
}

// ============== NEW: VICTIM RECORD ==============

export interface VictimRecord {
  id: string; // e.g. "VIC-2026-001457"
  caseId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other' | 'Not Disclosed';
  contact: string;
  address: string;
  relationshipToIncident: 'Complainant / Victim' | 'Victim' | 'Complainant' | 'Guardian of Victim';
  statementStatus: 'Recorded' | 'Pending' | 'Refused' | 'Through Advocate';
  protectionStatus: 'Safe' | 'Review Required' | 'Protection Provided' | 'At Risk';
  supportReferralNotes: string;
  photoUrl?: string;
  isSensitiveRestricted: boolean;
}

// ============== NEW: FINGERPRINT RECORDS ==============

export type FingerprintPrintType = 'Latent Print' | 'Rolled Print' | 'Plain Impression' | 'Digital Scan';
export type FingerprintQuality = 'Clear' | 'Partial' | 'Smudged' | 'Unusable';
export type FingerprintForensicStatus = 'Pending Examination' | 'Under Examination' | 'Completed' | 'Inconclusive';
export type FingerprintResult = 'Match Found' | 'No Match' | 'Inconclusive' | 'Pending';

export interface FingerprintRecord {
  id: string; // e.g. "FP-MH-2026-000654"
  caseId: string;
  evidenceId: string; // Linked evidence tag
  printType: FingerprintPrintType;
  fingerPosition: string; // e.g. "Right Thumb", "Left Index"
  recoveredFrom: string; // e.g. "Vehicle door handle"
  recoveredLocation: string;
  collectedBy: string;
  collectedByBadge: string;
  collectionDateTime: string;
  scanImageUrl?: string; // Simulated
  quality: FingerprintQuality;
  forensicStatus: FingerprintForensicStatus;
  // Examination result (filled after forensic examination)
  examinationResult?: FingerprintResult;
  matchedPersonId?: string; // Suspect ID if match found
  matchedPersonName?: string;
  examinedBy?: string;
  reportNumber?: string;
  reportAttachment?: string;
  aiQualityAssessment?: string; // Demo AI feature
  aiConfidence?: 'High' | 'Medium' | 'Low';
}

// ============== NEW: CASE ASSIGNMENT (Need-to-Know RBAC) ==============

export type CaseAssignmentRole = 'Lead Investigator' | 'Supporting Officer' | 'Evidence Officer' | 'Supervisory Review' | 'Temporary View Access';
export type CaseAssignmentStatus = 'Active' | 'Removed' | 'Expired';
export type CaseAccessLevel = 'View Case Summary' | 'View Only' | 'Investigation Contributor' | 'Evidence Contributor' | 'Full Case Team Access' | 'Supervisory Review';

export interface CaseAssignment {
  assignmentId: string; // e.g. "CA-2026-000451"
  caseId: string;
  userId: string; // Badge number or officer ID
  officerName: string;
  officerRank: string;
  assignmentRole: CaseAssignmentRole;
  assignedBy: string; // Badge of assigning officer
  assignedByName: string;
  assignedAt: string; // ISO timestamp
  accessLevel: CaseAccessLevel;
  status: CaseAssignmentStatus;
  removedAt?: string;
  removedBy?: string;
  removedByName?: string;
  removalReason?: string;
  expiresAt?: string; // For time-limited access requests
}

// ============== NEW: CASE ACCESS REQUEST ==============

export type AccessRequestPurpose = 
  | 'Related Investigation'
  | 'Supervisory Review'
  | 'Evidence Cross-Reference'
  | 'Witness Coordination'
  | 'Legal / Prosecution Support'
  | 'Other Official Duty';

export type AccessRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'More Info Requested' | 'Expired';

export interface CaseAccessRequest {
  requestId: string; // e.g. "AR-2026-000712"
  caseId: string;
  requestedByUserId: string; // badge
  requestedByName: string;
  requestedByRank: string;
  requestedByStation: string;
  purpose: AccessRequestPurpose;
  reason: string;
  requestedAccessLevel: CaseAccessLevel;
  requestedDurationDays: 7 | 14 | 30;
  status: AccessRequestStatus;
  submittedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  approvalNote?: string;
  expiresAt?: string; // Set when approved
}

// ============== NEW: BLOCKCHAIN LEDGER ENTRY ==============

export type BlockchainActionType =
  | 'CASE_CREATED'
  | 'CASE_ASSIGNED'
  | 'CASE_REASSIGNED'
  | 'CASE_CLOSED'
  | 'ACCESS_REVOKED'
  | 'ACCESS_GRANTED'
  | 'ACCESS_REQUEST_SUBMITTED'
  | 'ACCESS_REQUEST_APPROVED'
  | 'ACCESS_REQUEST_REJECTED'
  | 'EVIDENCE_REGISTERED'
  | 'EVIDENCE_SEALED'
  | 'EVIDENCE_TRANSFERRED'
  | 'FINGERPRINT_REGISTERED'
  | 'FORENSIC_REPORT_UPLOADED'
  | 'VICTIM_DATA_ACCESSED'
  | 'MEMBER_CREATED'
  | 'CASE_STATUS_UPDATED'
  | 'FORENSIC_REQUEST_CREATED'
  | 'INVESTIGATION_UPDATE'
  | 'INTEGRITY_ALERT';

export interface BlockchainLedgerEntry {
  blockIndex: number;
  previousHash: string;
  blockHash: string;
  timestamp: string;
  actionType: BlockchainActionType;
  actor: string; // Officer badge / name
  actorRole: string;
  caseId?: string;
  payload: Record<string, string | number | boolean>;
  isVerified: boolean;
  // Extended fields for permissioned blockchain simulation
  transactionId?: string;   // e.g. TXN-EV-000981
  validatorNode?: string;   // e.g. "Andheri Station Node"
  digitalSignature?: string; // Simulated officer sig hash
}

// ============== NETWORK NODE ==============

export type NodeStatus = 'ACTIVE' | 'SYNCING' | 'OFFLINE';

export interface NetworkNode {
  id: string;
  name: string;
  type: 'SP_COMMAND' | 'DYSP_OFFICE' | 'POLICE_STATION' | 'FORENSIC_LAB' | 'CYBER_CELL' | 'PROSECUTION';
  location: string;
  status: NodeStatus;
  blockHeight: number;
  lastSeen: string;
  validatedTxCount: number;
}

// ============== INTEGRITY CHECK RESULT ==============

export interface IntegrityCheckResult {
  evidenceId: string;
  evidenceTag: string;
  storedHash: string;
  currentHash: string;
  isVerified: boolean;
  status: 'VERIFIED' | 'TAMPER_ALERT' | 'PENDING';
  blockchainTxId?: string;
  checkedAt: string;
  checkedBy: string;
}

// ============== EXISTING TYPES (unchanged) ==============

export interface CaseFile {
  id: string; // e.g. "MH-MUM-2026-004821" or "CASE-049"
  firNumber: string;
  caseTitle: string;
  policeStation: string;
  jurisdictionZone: string;
  crimeType: string;
  incidentDate: string;
  incidentTime: string;
  incidentLocation: string;
  dateLogged: string;
  status: CaseStatus;
  priority: CasePriority;
  severity: 'SPECIAL_REPORT' | 'HIGH_SEVERITY' | 'STANDARD';
  ipcSections: string[];
  
  // Complainant Details
  complainant: {
    name: string;
    contact: string;
    address: string;
    idProof: string;
    statementBrief: string;
  };
  
  // Officers Involved
  officers: {
    piInCharge: string;
    assignedIO: string;
    assignedIOBadge: string;
    supervisingOfficer?: string;
    supervisingDySP?: string;
    reviewDate?: string;
  };
  
  // Sub-modules
  suspects: SuspectRecord[];
  witnesses: WitnessRecord[];
  investigationJournal: InvestigationEntry[];
  evidenceItems: EvidenceItemRecord[];
  forensicRequests: ForensicRequest[];
  documents: DocumentRecord[];
  repositoryDocuments?: RepoDocument[];
  timeline: CaseTimelineEvent[];
  aiSummary: AICaseSummary;
  
  // NEW: Extended modules
  victimRecord?: VictimRecord;
  victimRecords?: VictimRecord[];
  fingerprintRecords?: FingerprintRecord[];
  caseAssignments?: CaseAssignment[];
  accessRequests?: CaseAccessRequest[];
  investigating_officer_id?: string;
  assigned_at?: string;
  assigned_by?: string;

  // ICJS Multi-Pillar & CCTNS Integrations (7-Page Research Matrix)
  cctnsForms?: CCTNSFormsCollection;
  courtRecords?: CourtDocumentRecord[];
  prisonRecords?: PrisonerRecord[];
  warrants?: WarrantRecord[];
  hearings?: HearingRecord[];
  criminalHistory?: CriminalHistoryRecord[];
  ncrbDossier?: NCRBCriminalDossier;
  bankNotices?: BankNoticeRecord[];
  cyberTracing?: CyberTracingRecord;
  medicoLegalCase?: MedicoLegalCaseRecord;
  digitalEvidence?: DigitalEvidenceItem[];
  cdrRecords?: CallDataRecordDetail[];

  // Physical FIR Hardcopy Attachment
  firHardCopyUrl?: string;
  firHardCopyFileName?: string;

  // Blockchain & Cryptographic Integrity
  blockchain_tx_id?: string;
  event_hash?: string;
  previous_hash?: string;

  // State flags
  isOverdue: boolean;
  isHighPriority: boolean;
  requiresSeniorReview: boolean;
  summaryNotes: string;
  isRestrictedCrossStation?: boolean; // For RBAC demo
}

export type AssetCategory = 
  | 'SERVICE_WEAPON'
  | 'BODY_WORN_CAMERA'
  | 'PATROL_VEHICLE'
  | 'COMMUNICATION_RADIO'
  | 'FORENSIC_FIELD_KIT'
  | 'TACTICAL_EQUIPMENT';

export type AssetLifecycleStatus = 
  | 'IN_INVENTORY'
  | 'ASSIGNED_ON_DUTY'
  | 'UNDER_MAINTENANCE'
  | 'EVIDENCE_CUSTODY'
  | 'SCHEDULED_INSPECTION'
  | 'DECOMMISSIONED';

export interface PoliceAsset {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  serialNumber: string;
  procurementDate: string;
  expectedLifespanYears: number;
  conditionStatus: 'EXCELLENT' | 'GOOD' | 'NEEDS_SERVICE' | 'CRITICAL_REPAIR';
  lifecycleStatus: AssetLifecycleStatus;
  assignedOfficer?: {
    name: string;
    badgeNo: string;
    station: string;
    assignedDate: string;
  };
  stationLocation: string;
  lastInspectionDate: string;
  nextServiceDue: string;
  maintenanceHistory: Array<{
    date: string;
    type: string;
    technician: string;
    cost: number;
    notes: string;
  }>;
  custodyLog: Array<{
    timestamp: string;
    action: string;
    officer: string;
    purpose: string;
  }>;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  actorName?: string;
  actorBadge?: string;
  actorRole?: string;
  officerName?: string;
  badgeNo?: string;
  department: DepartmentStakeholder;
  action: 'VIEWED' | 'CREATED' | 'MODIFIED' | 'DIGITALLY_SIGNED' | 'EXPORTED' | 'TRANSFERRED_CUSTODY' | 'TAMPER_CHECK_PASSED' | string;
  resourceType?: 'DOCUMENT' | 'CASE' | 'POLICE_ASSET' | 'EVIDENCE' | string;
  resourceId?: string;
  resourceTitle?: string;
  targetEntityId?: string;
  ipAddress: string;
  hashVerified?: boolean;
  status?: string;
  notes?: string;
}

export interface OfficerProfile {
  id: string;
  name: string;
  rank: string;
  badgeNo: string;
  station: string;
  unit: string;
  contact: string;
  activeCases: number;
  completedCases: number;
  currentWorkload: 'Optimal' | 'Heavy' | 'Overloaded';
  status: 'ACTIVE_ON_DUTY' | 'ON_LEAVE' | 'SPECIAL_INVESTIGATION_CELL';
  role?: PoliceRole; // For hierarchy-based member management
  email?: string;
  photoUrl?: string;
  createdBy?: string;
  permissions?: {
    canBeAssignedToCases: boolean;
    canAddInvestigationUpdates: boolean;
    canRegisterEvidence: boolean;
    canApproveAccessRequests: boolean;
    canCreateStationAccounts: boolean;
  };
}

// ============================================================================
// ICJS (Inter-operable Criminal Justice System) & CCTNS Specification Models
// (Based on 7-Page Multi-Pillar Research)
// ============================================================================

export type ICJSPillar = 'POLICE_CCTNS' | 'JUDICIARY_ECOURTS' | 'FORENSICS_FSL' | 'PRISONS_EPRISONS' | 'NCRB_INTELLIGENCE';

export interface IIF1_FIR {
  iifNumber: 'IIF-1';
  firNumber: string;
  policeStation: string;
  district: string;
  dateAndTimeOfFIR: string;
  actsAndSections: string[];
  occurrenceDayDateHours: string;
  placeOfOccurrence: string;
  complainantName: string;
  complainantAddress: string;
  detailsOfKnownSuspects: string;
  firstInformationBrief: string;
  investigatingOfficerAssigned: string;
  dispatchDateToCourt: string;
}

export interface IIF2_CrimeDetails {
  iifNumber: 'IIF-2';
  spotPanchanamaNumber: string;
  dateOfInspection: string;
  crimeSceneAddress: string;
  physicalCluesIdentified: string[];
  panchasPresent: string[];
  sceneSketchAttached: boolean;
  eSakshPhotoHashes: string[];
  eSakshVideoHashes: string[];
  inspectionNotes: string;
  investigatingOfficer: string;
}

export interface IIF3_ArrestMemo {
  iifNumber: 'IIF-3';
  arrestMemoNumber: string;
  accusedName: string;
  accusedAlias?: string;
  age: number;
  gender: string;
  dateTimeOfArrest: string;
  placeOfArrest: string;
  groundsOfArrestInformed: boolean;
  relativeInformedName: string;
  relativeInformedRelationship: string;
  relativeInformedContact: string;
  physicalIdentificationMarks: string[];
  medicalExaminationDone: boolean;
  medicalOfficerName?: string;
  medicalReportNumber?: string;
  arrestingOfficer: string;
}

export interface IIF4_PropertySeizure {
  iifNumber: 'IIF-4';
  seizureMemoNumber: string;
  dateOfSeizure: string;
  seizedFromPersonOrPlace: string;
  descriptionOfSeizedArticles: Array<{
    itemNo: number;
    description: string;
    quantity: string;
    estimatedValue: string;
    packageSealNo: string;
    aesCipherHash: string;
  }>;
  witnessPanchas: string[];
  malkhanaEntryNumber: string;
  malkhanaInChargeBadge: string;
}

export interface IIF5_FinalChargesheet {
  iifNumber: 'IIF-5';
  chargeSheetNumber: string; // or Closure Report 'B'/'C' Summary
  reportType: 'CHARGESHEET_FOR_TRIAL' | 'CLOSURE_REPORT_UNTRACEABLE' | 'CLOSURE_REPORT_FALSE_COMPLAINT' | 'SUPPLEMENTARY_CHARGESHEET';
  filingDate: string;
  courtName: string;
  investigatingOfficerName: string;
  investigatingOfficerRank: string;
  investigatingOfficerBadge: string;
  briefFactsOfInvestigation: string;
  accusedChargeSheeted: Array<{
    name: string;
    status: 'IN_CUSTODY' | 'ON_BAIL' | 'ABSCONDING';
    sectionsApplicable: string[];
  }>;
  chargeWitnesses: Array<{
    witnessNo: number;
    name: string;
    type: 'COMPLAINANT' | 'EYE_WITNESS' | 'PANCHA' | 'EXPERT_FSL' | 'POLICE_WITNESS';
  }>;
  // e-Sign Verification
  isESigned: boolean;
  eSignedBy?: string;
  eSignatureHash?: string;
  eSignTimestamp?: string;
  cctnsSyncStatus: 'SYNCED_TO_CCTNS_NATIONAL' | 'PENDING_ESIGN' | 'PENDING_COURT_SCRUTINY';
}

export interface IIF6_NikalNamuna {
  iifNumber: 'IIF-6';
  courtDisposalNumber: string;
  courtName: string;
  presidingJudgeName: string;
  caseDisposalDate: string;
  verdict: 'CONVICTED' | 'ACQUITTED' | 'DISCHARGED' | 'COMPOUNDED';
  punishmentOrSentence?: string;
  fineAmount?: string;
  appealPeriodDays: number;
  appealFilingDeadline: string;
  propertyDisposalOrder: string;
  disposalSummary: string;
}

export interface CCTNSFormsCollection {
  iif1_fir: IIF1_FIR;
  iif2_crimeDetails: IIF2_CrimeDetails;
  iif3_arrestMemo?: IIF3_ArrestMemo;
  iif4_propertySeizure?: IIF4_PropertySeizure;
  iif5_finalChargesheet?: IIF5_FinalChargesheet;
  iif6_nikalNamuna?: IIF6_NikalNamuna;
}

export interface CourtDocumentRecord {
  id: string;
  caseId: string;
  courtName: string;
  rcNumber: string; // CNR Number e.g. "MHMB02-004821-2026"
  documentType: 
    | 'PETITION_COMPLAINT'
    | 'SUMMONS'
    | 'BAILABLE_WARRANT'
    | 'NON_BAILABLE_WARRANT'
    | 'BAIL_ORDER'
    | 'POLICE_REMAND_ORDER'
    | 'JUDICIAL_REMAND_ORDER'
    | 'HEARING_RECORD'
    | 'COURT_ORDER'
    | 'FINAL_JUDGMENT'
    | 'WITNESS_STATEMENT'
    | 'SEC_164_STATEMENT'
    | 'LEGAL_SUBMISSION';
  hearingStage?: string;
  statementDeponentName?: string;
  statementDeponentRole?: string;
  title: string;
  dateIssued: string;
  judgeName: string;
  publicProsecutor: string;
  hearingDate?: string;
  nextHearingDate?: string;
  warrantTargetPerson?: string;
  warrantExecutionStatus?: 'PENDING_EXECUTION' | 'EXECUTED_ARRESTED' | 'RECALLED_BY_COURT';
  orderSummary: string;
  documentHash: string;
  isCourtCertified: boolean;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export interface CustodyRecord {
  id: string;
  prisonerId: string;
  caseId: string;
  eventType: 'ADMISSION' | 'REMAND_EXTENSION' | 'COURT_HEARING' | 'MEDICAL_CHECKUP' | 'JAIL_TRANSFER' | 'BAIL_RELEASE' | 'PAROLE';
  eventDate: string;
  officerInCharge: string;
  notes: string;
  documentHash?: string;
  facilityLocation: string;
}

export interface PrisonerRecord {
  id: string;
  caseId: string;
  prisonerNumber: string; // e.g. "PR-ARJ-2026-449"
  prisonerName: string;
  fullName?: string;
  warrantId?: string;
  custodyStatus?: 'IN_CUSTODY' | 'TRANSFERRED' | 'RELEASED' | 'COURT_HEARING';
  prisonName: string; // e.g. "Arthur Road Central Prison, Mumbai"
  jailLocation?: string;
  admissionDate: string;
  releaseDate?: string;
  custodyType: 'POLICE_CUSTODY_REMAND' | 'JUDICIAL_CUSTODY_REMAND' | 'CONVICTED_PRISONER';
  cellWard: string;
  remandExpiryDate: string;
  courtRemandOrderRef: string;
  custodyRecords?: CustodyRecord[];
  transferRecords: Array<{
    date: string;
    fromPrison: string;
    toPrison: string;
    reason: string;
    escortOfficer: string;
  }>;
  releaseDetails?: {
    releaseDate: string;
    bailOrderNumber: string;
    suretyDetails: string;
    status: 'RELEASED' | 'PENDING_SURETY_VERIFICATION';
    releaseRemarks: string;
  };
}

export interface CriminalHistoryRecord {
  id: string;
  personIdentifier: string; // e.g. Aadhaar Hash, CCTNS Person ID, Voter ID
  fullName: string;
  aliases?: string[];
  caseId: string;
  caseNumber: string;
  offence: string;
  ipcSections?: string[];
  caseStatus: 'UNDER_INVESTIGATION' | 'PENDING_TRIAL' | 'CONVICTED' | 'ACQUITTED' | 'DISCHARGED';
  courtOutcome?: string;
  recordDate: string;
  source: string; // e.g. "SCRB Maharashtra" or "NCRB National Vault"
  createdAt: string;
}

export interface HearingRecord {
  id: string;
  caseId: string;
  hearingDate: string;
  court: string;
  hearingType: 'BAIL_APPLICATION' | 'REMAND_EXTENSION' | 'FRAMING_OF_CHARGES' | 'EVIDENCE_RECORDING' | 'FINAL_ARGUMENTS' | 'JUDGMENT_SENTENCING';
  status: 'SCHEDULED' | 'ADJOURNED' | 'CONCLUDED';
  summary: string;
  judgeOrMagistrate?: string;
  createdBy: string;
  createdAt?: string;
}

export interface WarrantRecord {
  id: string;
  caseId: string;
  warrantNumber: string;
  warrantType: 'SEARCH_WARRANT' | 'PRODUCTION_WARRANT' | 'NBW' | 'BAILABLE_WARRANT' | 'REMAND_WARRANT';
  subjectName: string;
  issuedDate: string;
  validUntil: string;
  status: 'ACTIVE' | 'EXECUTED' | 'RECALLED' | 'EXPIRED';
  issuedBy: string;
  courtName: string;
  documentRef?: string;
}

export interface NCRBCriminalDossier {
  dossierId: string; // e.g. "NCRB-IND-MH-994821"
  accusedName: string;
  aliases: string[];
  aadhaarNumberMasked?: string; // e.g. "XXXX-XXXX-4819"
  mobileNumbers: string[];
  previousAddresses: string[];
  identificationMarks: string[];
  fingerprintClassRef: string;
  previousCases: Array<{
    firNumber: string;
    policeStation: string;
    state: string;
    year: number;
    sections: string;
    disposition: string;
  }>;
  interStateLinks: Array<{
    state: 'Maharashtra' | 'Gujarat' | 'Madhya Pradesh' | 'Delhi' | 'Karnataka' | string;
    agency: string;
    caseReference: string;
    crimeModus: string;
    status: string;
  }>;
  warrantHistory: Array<{
    warrantNo: string;
    issuingCourt: string;
    status: 'ACTIVE' | 'EXECUTED' | 'EXPIRED';
  }>;
}

export interface BankNoticeRecord {
  id: string;
  caseId: string;
  noticeSection: 'SEC_91_CRPC_94_BNSS' | 'SEC_102_CRPC_106_BNSS';
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountHolderName: string;
  dateIssued: string;
  responseDueDate: string;
  status: 'PENDING' | 'REPLIED_STATEMENTS_RECEIVED' | 'ACCOUNT_FROZEN' | 'FUNDS_SEIZED';
  ioOfficerName: string;
  ioBadge: string;
  requestedActions: string;
  bankResponseSummary?: string;
  statementHash?: string;
}

export interface CyberTracingRecord {
  id: string;
  caseId: string;
  helplineTicket1930?: string; // 1930 National Cyber Crime Reporting Portal ref
  stolenDeviceIMEI: string;
  secondaryIMEI?: string;
  deviceModel: string;
  currentSimSubscriber: string;
  currentSimIMSI?: string;
  currentLocationCoords?: {
    lat: number;
    lng: number;
    areaName: string;
    nearestPoliceStation: string;
  };
  sec41ANoticeToBuyer?: {
    buyerName: string;
    address: string;
    contact: string;
    noticeDate: string;
    complianceStatus: 'NOTICE_SERVED' | 'DEVICE_SURRENDERED' | 'FAILED_TO_APPEAR';
  };
  cdrAnalysisSummary: string;
  ipdrLogsRef?: string;
  traceStatus: 'ACTIVE_MONITORING' | 'TOWER_DUMP_ANALYZED' | 'RECOVERY_IN_PROGRESS' | 'RECOVERED_AND_SEIZED';
}

export interface MedicoLegalCaseRecord {
  id: string;
  caseId: string;
  mlcNumber: string; // e.g. "MLC-SION-2026-0812"
  hospitalName: string; // e.g. "Lokmanya Tilak Municipal General Hospital (Sion Hospital)"
  examiningDoctorName: string;
  examiningDoctorRegNo: string;
  examinationDateTime: string;
  patientName: string;
  ageAndGender: string;
  broughtByOfficerBadge: string;
  injuryCategory: 'SIMPLE_BLUNT_INJURY' | 'GRIEVOUS_HURT' | 'DANGEROUS_WEAPON_CUT' | 'FATAL_INJURY_DEATH' | 'SEXUAL_ASSAULT_EXAMINATION';
  detailedInjuriesDescription: string;
  isFitForPoliceStatement: boolean;
  alcoholOrToxicSubstanceDetected: boolean;
  medicalCertificateHash: string;
}

export interface DigitalEvidenceItem {
  id: string;
  caseId: string;
  evidenceType: 'CCTV_FOOTAGE' | 'CRIME_SCENE_PHOTO' | 'AUDIO_RECORDING' | 'VIDEO_STATEMENT' | 'CALL_DATA_RECORD' | 'CYBER_FORENSIC_IMAGE';
  fileName: string;
  sourceDeviceOrCCTVCamera: string;
  fileSizeBytes: number;
  sha256Hash: string;
  aes256GcmEncrypted: boolean;
  collectedByOfficer: string;
  collectionTimestamp: string;
  hashIntegrityVerified: boolean;
  cloudStorageKey?: string;
}

export interface CallDataRecordDetail {
  cdrId: string;
  phoneNumber: string;
  imei: string;
  imsi: string;
  callerNumber: string;
  receiverNumber: string;
  callStartTime: string;
  callEndTime: string;
  durationSeconds: number;
  callType: 'INCOMING_VOICE' | 'OUTGOING_VOICE' | 'SMS_IN' | 'SMS_OUT' | 'DATA_SESSION';
  towerCellId: string;
  locationArea: string;
  telecomProvider: 'Reliance Jio' | 'Bharti Airtel' | 'Vodafone Idea (Vi)' | 'BSNL';
  sourceDocumentRef: string;
  sha256Digest: string;
}

