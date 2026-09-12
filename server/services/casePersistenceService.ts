import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface PersistentEvidenceItem {
  id: string;
  caseId: string;
  evidenceTag: string;
  category: string;
  description: string;
  collectedBy: string;
  collectedByBadge?: string;
  collectionDate: string;
  locationFound?: string;
  storageLocker?: string;
  currentCustodian: string;
  status: string;
  originalHash: string;
  currentHash: string;
  isIntegrityVerified: boolean;
  notes?: string;
  storageUri?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  event_hash?: string;
  previous_hash?: string;
  transfers?: Array<{
    transferId: string;
    evidenceId: string;
    fromOfficer: string;
    fromRole?: string;
    toOfficer: string;
    toRole?: string;
    timestamp: string;
    location?: string;
    action: string;
    condition?: string;
    sealIntact?: boolean;
    notes?: string;
  }>;
}

export interface PersistentCaseRecord {
  id: string;
  fir_number?: string;
  case_title?: string;
  case_number?: string;
  folder_name?: string;
  police_station: string;
  police_station_id?: string;
  jurisdiction_zone?: string;
  crime_type: string;
  incident_date: string;
  incident_location: string;
  status: string;
  priority: string;
  ipc_sections: string[];
  pi_in_charge: string;
  assigned_io: string;
  assigned_io_badge: string;
  supervising_dysp: string;
  investigating_officer_id?: string;
  assigned_at?: string;
  assigned_by?: string;
  blockchain_tx_id?: string;
  blockchain_status?: string;
  event_hash?: string;
  previous_hash?: string;
  created_at: string;
  updated_at?: string;
  summary_notes?: string;
  fir_hard_copy_url?: string;
  fir_hard_copy_file_name?: string;
  evidence_items?: PersistentEvidenceItem[];
  documents?: any[];
  case_members?: any[];
  timeline?: any[];
  cctns_forms?: any;
  victim_record?: any;
  victimRecord?: any;
  victim_records?: any[];
  victimRecords?: any[];
  witnesses?: any[];
  suspects?: any[];
  investigation_journal?: any[];
  investigationJournal?: any[];
  court_records?: any[];
  courtRecords?: any[];
  fingerprint_records?: any[];
  fingerprintRecords?: any[];
  forensic_requests?: any[];
  forensicRequests?: any[];
  prison_records?: any[];
  prisonRecords?: any[];
  warrants?: any[];
  hearings?: any[];
  criminal_history?: any[];
  criminalHistory?: any[];
}

export interface CaseAssignmentRecord {
  id: string;
  case_id: string;
  officer_id: string; // badgeNo
  officer_name: string;
  assigned_by: string;
  assigned_at: string;
  removed_at?: string;
  removed_by?: string;
  removal_reason?: string;
  status: 'ACTIVE' | 'REMOVED';
}

export interface CaseAccessRequestRecord {
  id: string;
  case_id: string;
  requester_badge: string;
  requester_name: string;
  requester_role: string;
  requester_station_id?: string;
  reason: string;
  requested_permission: string;
  requested_duration_hours: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'REVOKED';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  expires_at?: string;
}

export interface CaseAccessGrantRecord {
  id: string;
  case_id: string;
  user_badge: string;
  permission: string;
  granted_by: string;
  granted_at: string;
  expires_at?: string;
  revoked_at?: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const STORE_PATH = path.join(DATA_DIR, 'cases_store.json');
const HISTORY_STORE_PATH = path.join(DATA_DIR, 'cases_history.json');
const ASSIGNMENTS_STORE_PATH = path.join(DATA_DIR, 'case_assignments.json');
const ACCESS_REQUESTS_STORE_PATH = path.join(DATA_DIR, 'case_access_requests.json');
const ACCESS_GRANTS_STORE_PATH = path.join(DATA_DIR, 'case_access_grants.json');

// Ensure history file exists
if (!fs.existsSync(HISTORY_STORE_PATH)) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(HISTORY_STORE_PATH, JSON.stringify([]));
}

function saveToHistoryStore(action: string, caseData: PersistentCaseRecord, userBadge: string) {
  try {
    const raw = fs.readFileSync(HISTORY_STORE_PATH, 'utf-8');
    const history = JSON.parse(raw);
    history.push({
      history_id: crypto.randomUUID(),
      action,
      changed_at: new Date().toISOString(),
      changed_by_badge: userBadge,
      case_snapshot: JSON.parse(JSON.stringify(caseData)) // Deep copy
    });
    fs.writeFileSync(HISTORY_STORE_PATH, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Failed to write to JSON history store:', err);
  }
}

export function getCaseHistoryFromFile(caseId: string) {
  try {
    if (!fs.existsSync(HISTORY_STORE_PATH)) return [];
    const raw = fs.readFileSync(HISTORY_STORE_PATH, 'utf-8');
    const history = JSON.parse(raw);
    return history.filter((h: any) => h.case_snapshot.id === caseId).sort((a: any, b: any) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  } catch (err) {
    console.error('Failed to read from JSON history store:', err);
    return [];
  }
}

// Default initial seeds matching Maharashtra Police dockets
const INITIAL_SEEDS: PersistentCaseRecord[] = [
  {
    id: 'CASE-2026-00142',
    police_station: 'Andheri Police Station, Mumbai',
    police_station_id: 'ANDHERI-PS',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Cyber Crime & Financial Fraud',
    incident_date: '2026-08-28',
    incident_location: 'Andheri East Commercial Complex, Mumbai',
    status: 'Under Investigation',
    priority: 'CRITICAL',
    ipc_sections: ['Sec 420 IPC', 'Sec 66C/66D IT Act', 'Sec 111 BNS'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
    blockchain_tx_id: '9b8fb9d646be980b135c34ae780b43ef8ab824047a7407ca8d2ac4e21a2f643e',
    blockchain_status: 'CONFIRMED',
    created_at: '2026-08-28T10:00:00.000Z',
    evidence_items: [
      {
        id: 'EV-00142-01',
        caseId: 'CASE-2026-00142',
        evidenceTag: 'EV-MH-2026-B2E11A',
        category: 'Digital Evidence',
        description: 'Compromised Server Hard Disk & Router Log Image (Seized from Fraud Command Center)',
        collectedBy: 'Inspector Rajesh Patil',
        collectedByBadge: 'MH-POL-8842',
        collectionDate: '2026-09-04',
        locationFound: 'Andheri East Server Room 4B',
        storageLocker: 'Malkhana Vault-A / Safe #14',
        currentCustodian: 'Inspector Rajesh Patil (Police Inspector)',
        status: 'Collected & Sealed',
        originalHash: 'cc27d4a2b4c3d4c6ca3e1d4115ef0756bda335cdf6a53df38568c5fc46cd7621',
        currentHash: 'cc27d4a2b4c3d4c6ca3e1d4115ef0756bda335cdf6a53df38568c5fc46cd7621',
        isIntegrityVerified: true,
        fileName: 'router_log_dump_andheri.bin',
        fileSize: 4194304,
        mimeType: 'application/octet-stream',
        notes: 'Hard disk bit-stream image created on EnCase and verified with SHA-256 integrity seal under Sec 65B IEA.',
        transfers: [
          {
            transferId: 'COC-00142-01',
            evidenceId: 'EV-MH-2026-B2E11A',
            fromOfficer: 'Scene of Crime / Seizure Spot',
            fromRole: 'Recovery Location',
            toOfficer: 'Inspector Rajesh Patil',
            toRole: 'Police Inspector',
            timestamp: '2026-09-04 23:17 IST',
            location: 'Andheri East Commercial Complex, Mumbai',
            action: 'Initial recovery and red wax sealing under Panchnama',
            condition: 'Intact, packaged in tamper-evident anti-static bag',
            sealIntact: true,
            notes: 'Initial custody established.'
          }
        ]
      }
    ]
  },
  {
    id: 'CASE-2026-00189',
    fir_number: 'FIR-2026-ANDH-0189',
    case_title: 'Armed Commercial Robbery & Heist at S.V. Road',
    police_station: 'Andheri Police Station, Mumbai',
    police_station_id: 'ANDHERI-PS',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Armed Robbery & Dacoity',
    incident_date: '2026-08-30',
    incident_location: 'S.V. Road Gold Jewellers Market, Andheri West',
    status: 'Forensic Examination',
    priority: 'HIGH',
    ipc_sections: ['Sec 392 IPC', 'Sec 397 IPC', 'Sec 25 Arms Act'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
    blockchain_tx_id: 'a8c7b6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7',
    blockchain_status: 'CONFIRMED',
    created_at: '2026-08-30T14:30:00.000Z',
    evidence_items: []
  },
  {
    id: 'CASE-2026-00205',
    fir_number: 'FIR-2026-ANDH-0205',
    case_title: 'Inter-State Commercial Narcotic Smuggling & Hawala Ring',
    police_station: 'Andheri Police Station, Mumbai',
    police_station_id: 'ANDHERI-PS',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Narcotics & NDPS',
    incident_date: '2026-09-01',
    incident_location: 'Chhatrapati Shivaji Maharaj Cargo Terminal',
    status: 'Pending Supervisory Review',
    priority: 'CRITICAL',
    ipc_sections: ['Sec 8(c) NDPS Act', 'Sec 21(c) NDPS Act', 'Sec 29 NDPS Act'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
    blockchain_tx_id: 'b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6',
    blockchain_status: 'CONFIRMED',
    created_at: '2026-09-01T09:15:00.000Z',
    evidence_items: []
  },
  {
    id: 'CASE-2026-00231',
    fir_number: 'FIR-2026-ANDH-0231',
    case_title: 'Commercial ATM Skimming & Identity Cloning Case',
    police_station: 'Andheri Police Station, Mumbai',
    police_station_id: 'ANDHERI-PS',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Identity Theft & Electronic Fraud',
    incident_date: '2026-09-02',
    incident_location: 'Versova Link Road ATM Kiosk, Andheri',
    status: 'FIR Registered',
    priority: 'MEDIUM',
    ipc_sections: ['Sec 419 IPC', 'Sec 66C IT Act'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: '',
    assigned_io_badge: '',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
    blockchain_tx_id: 'c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5',
    blockchain_status: 'CONFIRMED',
    created_at: '2026-09-02T16:45:00.000Z',
    evidence_items: []
  },
  {
    id: 'CASE-2026-00098',
    fir_number: 'FIR-2026-ANDH-0098',
    case_title: 'Counterfeit High-Denomination Currency Circulation Network',
    police_station: 'Andheri Police Station, Mumbai',
    police_station_id: 'ANDHERI-PS',
    jurisdiction_zone: 'Zone II (Western Suburbs)',
    crime_type: 'Counterfeiting & Forgery',
    incident_date: '2026-08-15',
    incident_location: 'Andheri Railway Station West Yard',
    status: 'Disposed & Closed',
    priority: 'HIGH',
    ipc_sections: ['Sec 489A IPC', 'Sec 489B IPC', 'Sec 489C IPC'],
    pi_in_charge: 'Inspector Rajesh Patil',
    assigned_io: 'PSI R. Deshmukh',
    assigned_io_badge: 'MH-PSI-4910',
    supervising_dysp: 'DySP Ananya Sharma, MPS',
    blockchain_tx_id: 'd5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4',
    blockchain_status: 'CONFIRMED',
    created_at: '2026-08-15T11:00:00.000Z',
    evidence_items: []
  }
];

class CasePersistenceService {
  private cache: PersistentCaseRecord[] = [];
  private assignmentsCache: CaseAssignmentRecord[] = [];
  private accessRequestsCache: CaseAccessRequestRecord[] = [];
  private accessGrantsCache: CaseAccessGrantRecord[] = [];
  private isLoaded = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cache = parsed;
        } else {
          this.cache = JSON.parse(JSON.stringify(INITIAL_SEEDS));
          this.persistToDisk();
        }
      } else {
        this.cache = JSON.parse(JSON.stringify(INITIAL_SEEDS));
        this.persistToDisk();
      }

      // Ensure investigating_officer_id is populated from assigned_io_badge
      let needsCaseSync = false;
      this.cache.forEach(c => {
        if (!c.investigating_officer_id && c.assigned_io_badge) {
          c.investigating_officer_id = c.assigned_io_badge;
          needsCaseSync = true;
        }
      });
      if (needsCaseSync) {
        this.persistToDisk();
      }

      this.loadAssignments();
      this.loadAccessRequests();
      this.loadAccessGrants();

      this.isLoaded = true;
    } catch (err) {
      console.warn('[CASE PERSISTENCE] Init error, using in-memory seeds:', err);
      this.cache = JSON.parse(JSON.stringify(INITIAL_SEEDS));
      this.isLoaded = true;
    }
  }

  private persistToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${STORE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.cache, null, 2), 'utf-8');
      fs.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.error('[CASE PERSISTENCE] Failed to write cases_store.json:', err);
    }
  }

  private loadAssignments() {
    try {
      if (fs.existsSync(ASSIGNMENTS_STORE_PATH)) {
        const raw = fs.readFileSync(ASSIGNMENTS_STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.assignmentsCache = parsed;
          return;
        }
      }
      // Seed default active assignments for initial cases
      this.assignmentsCache = [];
      for (const c of this.cache) {
        if (c.assigned_io_badge) {
          this.assignmentsCache.push({
            id: `ASGN-${c.id.replace(/[^a-zA-Z0-9]/g, '')}-01`,
            case_id: c.id,
            officer_id: c.assigned_io_badge,
            officer_name: c.assigned_io || 'Assigned IO',
            assigned_by: c.supervising_dysp || 'ADMIN-SYSTEM',
            assigned_at: c.created_at || new Date().toISOString(),
            status: 'ACTIVE',
          });
        }
      }
      this.persistAssignments();
    } catch (e) {
      console.error('[CASE PERSISTENCE] Failed to load assignments:', e);
      this.assignmentsCache = [];
    }
  }

  private persistAssignments() {
    try {
      const tmpPath = `${ASSIGNMENTS_STORE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.assignmentsCache, null, 2), 'utf-8');
      fs.renameSync(tmpPath, ASSIGNMENTS_STORE_PATH);
    } catch (err) {
      console.error('[CASE PERSISTENCE] Failed to write case_assignments.json:', err);
    }
  }

  private loadAccessRequests() {
    try {
      if (fs.existsSync(ACCESS_REQUESTS_STORE_PATH)) {
        const raw = fs.readFileSync(ACCESS_REQUESTS_STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.accessRequestsCache = parsed;
          return;
        }
      }
      this.accessRequestsCache = [];
      this.persistAccessRequests();
    } catch (e) {
      console.error('[CASE PERSISTENCE] Failed to load access requests:', e);
      this.accessRequestsCache = [];
    }
  }

  private persistAccessRequests() {
    try {
      const tmpPath = `${ACCESS_REQUESTS_STORE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.accessRequestsCache, null, 2), 'utf-8');
      fs.renameSync(tmpPath, ACCESS_REQUESTS_STORE_PATH);
    } catch (err) {
      console.error('[CASE PERSISTENCE] Failed to write case_access_requests.json:', err);
    }
  }

  private loadAccessGrants() {
    try {
      if (fs.existsSync(ACCESS_GRANTS_STORE_PATH)) {
        const raw = fs.readFileSync(ACCESS_GRANTS_STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.accessGrantsCache = parsed;
          return;
        }
      }
      this.accessGrantsCache = [];
      this.persistAccessGrants();
    } catch (e) {
      console.error('[CASE PERSISTENCE] Failed to load access grants:', e);
      this.accessGrantsCache = [];
    }
  }

  private persistAccessGrants() {
    try {
      const tmpPath = `${ACCESS_GRANTS_STORE_PATH}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpPath, JSON.stringify(this.accessGrantsCache, null, 2), 'utf-8');
      fs.renameSync(tmpPath, ACCESS_GRANTS_STORE_PATH);
    } catch (err) {
      console.error('[CASE PERSISTENCE] Failed to write case_access_grants.json:', err);
    }
  }

  public getAllCases(): PersistentCaseRecord[] {
    if (!this.isLoaded) this.init();
    return JSON.parse(JSON.stringify(this.cache));
  }

  public getCaseById(id: string): PersistentCaseRecord | null {
    if (!this.isLoaded) this.init();
    const found = this.cache.find(c => c.id === id || c.fir_number === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  public createCase(caseData: Partial<PersistentCaseRecord>): PersistentCaseRecord {
    if (!this.isLoaded) this.init();

    // Create unique folder name: CASE-[RANDOM]-MH-MUM-GHATKOPAR-[DATE]
    const shortId = crypto.randomUUID().substring(0, 4).toUpperCase();
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '').toUpperCase();
    const folderName = `CASE-${shortId}-MH-MUM-GHATKOPAR-${dateStr}`;
    
    // Create physical directory for OCR and files
    const caseFolderPath = path.join(DATA_DIR, folderName);
    if (!fs.existsSync(caseFolderPath)) {
      fs.mkdirSync(caseFolderPath, { recursive: true });
    }

    const caseId = caseData.id || folderName;
    const firNumber = caseData.fir_number || (caseData as any).firNumber || `FIR-${Date.now().toString().slice(-4)}`;

    const newRecord: PersistentCaseRecord = {
      id: caseId,
      fir_number: firNumber,
      folder_name: folderName, // newly added for tracking physical directory
      case_title: caseData.case_title || (caseData as any).caseTitle || `FIR ${firNumber}`,
      police_station: caseData.police_station || (caseData as any).policeStation || 'Andheri Police Station, Mumbai',
      police_station_id: caseData.police_station_id || (caseData as any).policeStationId || 'ANDHERI-PS',
      jurisdiction_zone: caseData.jurisdiction_zone || (caseData as any).jurisdictionZone || 'Zone II (Western Suburbs)',
      crime_type: caseData.crime_type || (caseData as any).crimeType || 'General Criminal Investigation',
      incident_date: caseData.incident_date || (caseData as any).incidentDate || new Date().toISOString().substring(0, 10),
      incident_location: caseData.incident_location || (caseData as any).incidentLocation || 'Mumbai',
      status: caseData.status || 'FIR Registered',
      priority: caseData.priority || 'HIGH',
      ipc_sections: caseData.ipc_sections || (caseData as any).ipcSections || ['Sec 154 CrPC'],
      pi_in_charge: caseData.pi_in_charge || (caseData as any).piInCharge || 'Inspector Rajesh Patil',
      investigating_officer_id: caseData.investigating_officer_id || caseData.assigned_io_badge || (caseData as any).assignedIOBadge || '',
      assigned_io: caseData.assigned_io || (caseData as any).assignedIO || '',
      assigned_io_badge: caseData.assigned_io_badge || (caseData as any).assignedIOBadge || '',
      assigned_at: caseData.assigned_at || new Date().toISOString(),
      assigned_by: caseData.assigned_by || caseData.assigned_io_badge || '',
      supervising_dysp: caseData.supervising_dysp || (caseData as any).supervisingDySP || 'DySP Ananya Sharma, MPS',
      blockchain_tx_id: caseData.blockchain_tx_id || `TX-MH-${Date.now().toString(36).toUpperCase()}`,
      blockchain_status: 'CONFIRMED',
      created_at: caseData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      summary_notes: caseData.summary_notes || (caseData as any).summaryNotes || '',
      fir_hard_copy_url: (caseData as any).fir_hard_copy_url || (caseData as any).firHardCopyUrl || '',
      fir_hard_copy_file_name: (caseData as any).fir_hard_copy_file_name || (caseData as any).firHardCopyFileName || '',
      evidence_items: caseData.evidence_items || (caseData as any).evidenceItems || [],
      documents: caseData.documents || [],
      case_members: caseData.case_members || (caseData as any).caseAssignments || [],
      timeline: caseData.timeline || [
        {
          id: `TL-CREATE-${Date.now()}`,
          date: new Date().toISOString().substring(0, 10),
          title: `FIR ${firNumber} Registered`,
          description: `Case officially created in e-CASEVAULT repository.`,
          officer: caseData.pi_in_charge || 'Command',
          badge: caseData.assigned_io_badge || 'MH-POL',
          type: 'FIR'
        }
      ]
    };

    this.cache.unshift(newRecord);
    this.persistToDisk();
    return JSON.parse(JSON.stringify(newRecord));
  }

  public updateCase(id: string, updates: Partial<PersistentCaseRecord>): PersistentCaseRecord | null {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === id || c.fir_number === id);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const newIOBadge = updates.assigned_io_badge !== undefined 
      ? updates.assigned_io_badge 
      : (updates as any).assignedIOBadge !== undefined 
        ? (updates as any).assignedIOBadge 
        : updates.investigating_officer_id !== undefined
          ? updates.investigating_officer_id
          : current.assigned_io_badge;
    const newIOName = updates.assigned_io !== undefined 
      ? updates.assigned_io 
      : (updates as any).assignedIO !== undefined 
        ? (updates as any).assignedIO 
        : current.assigned_io;

    const oldIOBadge = current.investigating_officer_id || current.assigned_io_badge;
    if (newIOBadge && newIOBadge !== oldIOBadge) {
      // Reassign IO assignments
      const now = new Date().toISOString();
      this.assignmentsCache.forEach(a => {
        if (a.case_id === current.id && a.status === 'ACTIVE') {
          a.status = 'REMOVED';
          a.removed_at = now;
          a.removed_by = (updates as any).assigned_by || 'COMMAND';
          a.removal_reason = 'Investigating Officer reassigned';
        }
      });
      this.assignmentsCache.push({
        id: `ASGN-${current.id.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
        case_id: current.id,
        officer_id: newIOBadge,
        officer_name: newIOName,
        assigned_by: (updates as any).assigned_by || 'COMMAND',
        assigned_at: now,
        status: 'ACTIVE',
      });
      this.persistAssignments();
    }

    const updated: PersistentCaseRecord = {
      ...current,
      ...updates,
      status: updates.status || (updates as any).caseStatus || current.status,
      priority: updates.priority || current.priority,
      assigned_io: newIOName,
      assigned_io_badge: newIOBadge,
      investigating_officer_id: newIOBadge,
      incident_location: updates.incident_location || (updates as any).incidentLocation || current.incident_location,
      fir_hard_copy_url: (updates as any).fir_hard_copy_url !== undefined ? (updates as any).fir_hard_copy_url : (updates as any).firHardCopyUrl !== undefined ? (updates as any).firHardCopyUrl : current.fir_hard_copy_url,
      fir_hard_copy_file_name: (updates as any).fir_hard_copy_file_name !== undefined ? (updates as any).fir_hard_copy_file_name : (updates as any).firHardCopyFileName !== undefined ? (updates as any).firHardCopyFileName : current.fir_hard_copy_file_name,
      updated_at: new Date().toISOString()
    };

    // If full arrays like evidence_items, documents, timeline are supplied, preserve them
    if (Array.isArray((updates as any).evidenceItems)) {
      updated.evidence_items = (updates as any).evidenceItems;
    } else if (Array.isArray(updates.evidence_items)) {
      updated.evidence_items = updates.evidence_items;
    }

    if (Array.isArray((updates as any).documents)) {
      updated.documents = (updates as any).documents;
    } else if (Array.isArray(updates.documents)) {
      updated.documents = updates.documents;
    }

    if (Array.isArray((updates as any).caseAssignments)) {
      updated.case_members = (updates as any).caseAssignments;
    } else if (Array.isArray(updates.case_members)) {
      updated.case_members = updates.case_members;
    }

    if (Array.isArray(updates.timeline)) {
      updated.timeline = updates.timeline;
    }

    if ((updates as any).victimRecords !== undefined) {
      updated.victim_records = (updates as any).victimRecords;
      updated.victimRecords = (updates as any).victimRecords;
      if (Array.isArray((updates as any).victimRecords) && (updates as any).victimRecords.length > 0) {
        updated.victim_record = (updates as any).victimRecords[0];
        updated.victimRecord = (updates as any).victimRecords[0];
      }
    } else if ((updates as any).victim_records !== undefined) {
      updated.victim_records = (updates as any).victim_records;
      updated.victimRecords = (updates as any).victim_records;
      if (Array.isArray((updates as any).victim_records) && (updates as any).victim_records.length > 0) {
        updated.victim_record = (updates as any).victim_records[0];
        updated.victimRecord = (updates as any).victim_records[0];
      }
    }

    if ((updates as any).victimRecord !== undefined) {
      updated.victim_record = (updates as any).victimRecord;
      updated.victimRecord = (updates as any).victimRecord;
      if (!updated.victimRecords || updated.victimRecords.length === 0) {
        updated.victimRecords = [(updates as any).victimRecord];
        updated.victim_records = [(updates as any).victimRecord];
      }
    } else if (updates.victim_record !== undefined) {
      updated.victim_record = updates.victim_record;
      updated.victimRecord = updates.victim_record;
      if (!updated.victimRecords || updated.victimRecords.length === 0) {
        updated.victimRecords = [updates.victim_record];
        updated.victim_records = [updates.victim_record];
      }
    }

    if (Array.isArray((updates as any).witnesses)) {
      updated.witnesses = (updates as any).witnesses;
    }

    if (Array.isArray((updates as any).suspects)) {
      updated.suspects = (updates as any).suspects;
    }

    if (Array.isArray((updates as any).investigationJournal)) {
      updated.investigation_journal = (updates as any).investigationJournal;
      updated.investigationJournal = (updates as any).investigationJournal;
    } else if (Array.isArray(updates.investigation_journal)) {
      updated.investigation_journal = updates.investigation_journal;
      updated.investigationJournal = updates.investigation_journal;
    }

    if (Array.isArray((updates as any).courtRecords)) {
      updated.court_records = (updates as any).courtRecords;
      updated.courtRecords = (updates as any).courtRecords;
    } else if (Array.isArray(updates.court_records)) {
      updated.court_records = updates.court_records;
      updated.courtRecords = updates.court_records;
    }

    if (Array.isArray((updates as any).fingerprintRecords)) {
      updated.fingerprint_records = (updates as any).fingerprintRecords;
      updated.fingerprintRecords = (updates as any).fingerprintRecords;
    } else if (Array.isArray(updates.fingerprint_records)) {
      updated.fingerprint_records = updates.fingerprint_records;
      updated.fingerprintRecords = updates.fingerprint_records;
    }

    if (Array.isArray((updates as any).forensicRequests)) {
      updated.forensic_requests = (updates as any).forensicRequests;
      updated.forensicRequests = (updates as any).forensicRequests;
    } else if (Array.isArray(updates.forensic_requests)) {
      updated.forensic_requests = updates.forensic_requests;
      updated.forensicRequests = updates.forensic_requests;
    }

    if (Array.isArray((updates as any).prisonRecords)) {
      updated.prison_records = (updates as any).prisonRecords;
      updated.prisonRecords = (updates as any).prisonRecords;
    } else if (Array.isArray(updates.prison_records)) {
      updated.prison_records = updates.prison_records;
      updated.prisonRecords = updates.prison_records;
    }

    if (Array.isArray((updates as any).warrants)) {
      updated.warrants = (updates as any).warrants;
    }

    if (Array.isArray((updates as any).hearings)) {
      updated.hearings = (updates as any).hearings;
    }

    if (Array.isArray((updates as any).criminalHistory)) {
      updated.criminal_history = (updates as any).criminalHistory;
      updated.criminalHistory = (updates as any).criminalHistory;
    } else if (Array.isArray(updates.criminal_history)) {
      updated.criminal_history = updates.criminal_history;
      updated.criminalHistory = updates.criminal_history;
    }

    saveToHistoryStore('UPDATE', current, 'SYSTEM');
    this.cache[idx] = updated;
    this.persistToDisk();
    return JSON.parse(JSON.stringify(updated));
  }

  // ==================== JAIL & PRISONER HELPERS ====================
  public getAllPrisoners(): any[] {
    if (!this.isLoaded) this.init();
    const prisoners: any[] = [];
    for (const c of this.cache) {
      const records = c.prison_records || c.prisonRecords || [];
      for (const pr of records) {
        prisoners.push({
          ...pr,
          caseId: pr.caseId || c.id,
          firNumber: c.fir_number,
          caseTitle: c.case_title,
          policeStation: c.police_station
        });
      }
    }
    return prisoners;
  }

  public getPrisonersByCase(caseId: string): any[] {
    if (!this.isLoaded) this.init();
    const c = this.cache.find(item => item.id === caseId || item.fir_number === caseId);
    return c?.prison_records || c?.prisonRecords || [];
  }

  public admitPrisoner(caseId: string, prisonerData: any): any {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId || c.fir_number === caseId);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const existing = current.prison_records || current.prisonRecords || [];
    const newPrisoner = {
      id: prisonerData.id || `PRIS-${Date.now().toString(36).toUpperCase()}`,
      prisonerNumber: prisonerData.prisonerNumber || `PR-${Math.floor(1000 + Math.random() * 9000)}`,
      prisonerName: prisonerData.prisonerName || prisonerData.fullName || 'Under-trial Accused',
      fullName: prisonerData.prisonerName || prisonerData.fullName || 'Under-trial Accused',
      caseId: current.id,
      warrantId: prisonerData.warrantId || '',
      custodyStatus: prisonerData.custodyStatus || 'IN_CUSTODY',
      prisonName: prisonerData.prisonName || prisonerData.jailLocation || 'Arthur Road Central Prison, Mumbai',
      jailLocation: prisonerData.prisonName || prisonerData.jailLocation || 'Arthur Road Central Prison, Mumbai',
      admissionDate: prisonerData.admissionDate || new Date().toISOString().substring(0, 10),
      releaseDate: prisonerData.releaseDate || '',
      custodyType: prisonerData.custodyType || 'JUDICIAL_CUSTODY_REMAND',
      cellWard: prisonerData.cellWard || 'Ward 4 - Barrack B',
      remandExpiryDate: prisonerData.remandExpiryDate || '',
      courtRemandOrderRef: prisonerData.courtRemandOrderRef || '',
      transferRecords: prisonerData.transferRecords || [],
      custodyRecords: prisonerData.custodyRecords || [
        {
          id: `CUST-${Date.now()}`,
          prisonerId: prisonerData.id || `PRIS-${Date.now().toString(36).toUpperCase()}`,
          caseId: current.id,
          eventType: 'ADMISSION',
          eventDate: new Date().toISOString(),
          officerInCharge: prisonerData.admittedBy || 'Superintendent Rajan S. Gokhale',
          notes: `Admitted into ${prisonerData.prisonName || 'Arthur Road Central Prison'} under remand order ${prisonerData.courtRemandOrderRef || 'COURT-REM-2026'}.`,
          facilityLocation: prisonerData.prisonName || 'Arthur Road Central Prison, Mumbai'
        }
      ]
    };

    const updated = [newPrisoner, ...existing];
    current.prison_records = updated;
    current.prisonRecords = updated;
    this.persistToDisk();
    return newPrisoner;
  }

  public addCustodyRecord(prisonerId: string, custodyEvent: any): any {
    if (!this.isLoaded) this.init();
    for (const c of this.cache) {
      const records = c.prison_records || c.prisonRecords || [];
      const pIdx = records.findIndex(p => p.id === prisonerId || p.prisonerNumber === prisonerId);
      if (pIdx !== -1) {
        const prisoner = records[pIdx];
        const currentLogs = prisoner.custodyRecords || [];
        const newLog = {
          id: custodyEvent.id || `CUST-${Date.now()}`,
          prisonerId: prisoner.id,
          caseId: c.id,
          eventType: custodyEvent.eventType || 'STATUS_UPDATE',
          eventDate: custodyEvent.eventDate || new Date().toISOString(),
          officerInCharge: custodyEvent.officerInCharge || 'Superintendent Rajan S. Gokhale',
          notes: custodyEvent.notes || 'Custody event logged.',
          facilityLocation: custodyEvent.facilityLocation || prisoner.prisonName || 'Arthur Road Central Prison'
        };
        prisoner.custodyRecords = [newLog, ...currentLogs];
        if (custodyEvent.newStatus) {
          prisoner.custodyStatus = custodyEvent.newStatus;
        }
        if (custodyEvent.releaseDetails) {
          prisoner.releaseDetails = custodyEvent.releaseDetails;
          prisoner.releaseDate = custodyEvent.releaseDetails.releaseDate;
          prisoner.custodyStatus = 'RELEASED';
        }
        records[pIdx] = prisoner;
        c.prison_records = records;
        c.prisonRecords = records;
        this.persistToDisk();
        return { success: true, prisoner, record: newLog };
      }
    }
    return null;
  }

  // ==================== WARRANTS & HEARINGS HELPERS ====================
  public getAllWarrants(): any[] {
    if (!this.isLoaded) this.init();
    const warrants: any[] = [];
    for (const c of this.cache) {
      const wList = c.warrants || [];
      for (const w of wList) {
        warrants.push({
          ...w,
          caseId: w.caseId || c.id,
          firNumber: c.fir_number,
          caseTitle: c.case_title
        });
      }
    }
    return warrants;
  }

  public getWarrantsByCase(caseId: string): any[] {
    if (!this.isLoaded) this.init();
    const c = this.cache.find(item => item.id === caseId || item.fir_number === caseId);
    return c?.warrants || [];
  }

  public addWarrant(caseId: string, warrantData: any): any {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId || c.fir_number === caseId);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const existing = current.warrants || [];
    const newWarrant = {
      id: warrantData.id || `WAR-${Date.now().toString(36).toUpperCase()}`,
      caseId: current.id,
      warrantNumber: warrantData.warrantNumber || `WR-MH-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      warrantType: warrantData.warrantType || 'REMAND_WARRANT',
      subjectName: warrantData.subjectName || 'Accused',
      issuedDate: warrantData.issuedDate || new Date().toISOString().substring(0, 10),
      validUntil: warrantData.validUntil || '',
      status: warrantData.status || 'ACTIVE',
      issuedBy: warrantData.issuedBy || 'Chief Metropolitan Magistrate, Esplanade, Mumbai',
      courtName: warrantData.courtName || 'Sessions Court, Mumbai',
      documentRef: warrantData.documentRef || ''
    };

    current.warrants = [newWarrant, ...existing];
    this.persistToDisk();
    return newWarrant;
  }

  public getAllHearings(): any[] {
    if (!this.isLoaded) this.init();
    const hearings: any[] = [];
    for (const c of this.cache) {
      const hList = c.hearings || [];
      for (const h of hList) {
        hearings.push({
          ...h,
          caseId: h.caseId || c.id,
          firNumber: c.fir_number,
          caseTitle: c.case_title
        });
      }
    }
    return hearings;
  }

  public getHearingsByCase(caseId: string): any[] {
    if (!this.isLoaded) this.init();
    const c = this.cache.find(item => item.id === caseId || item.fir_number === caseId);
    return c?.hearings || [];
  }

  public addHearing(caseId: string, hearingData: any): any {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId || c.fir_number === caseId);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const existing = current.hearings || [];
    const newHearing = {
      id: hearingData.id || `HRG-${Date.now().toString(36).toUpperCase()}`,
      caseId: current.id,
      hearingDate: hearingData.hearingDate || new Date().toISOString(),
      court: hearingData.court || 'Court of Metropolitan Magistrate, Andheri, Mumbai',
      hearingType: hearingData.hearingType || 'REMAND_EXTENSION',
      status: hearingData.status || 'SCHEDULED',
      summary: hearingData.summary || 'Judicial remand hearing scheduled.',
      judgeOrMagistrate: hearingData.judgeOrMagistrate || 'Special Judge, Sessions Court',
      createdBy: hearingData.createdBy || 'Public Prosecutor',
      createdAt: new Date().toISOString()
    };

    current.hearings = [newHearing, ...existing];
    this.persistToDisk();
    return newHearing;
  }

  // ==================== NCRB & CRIMINAL HISTORY HELPERS ====================
  public searchCriminalHistory(query: string): any[] {
    if (!this.isLoaded) this.init();
    const q = (query || '').toLowerCase().trim();
    const allRecords: any[] = [];

    for (const c of this.cache) {
      const history = c.criminal_history || c.criminalHistory || [];
      for (const h of history) {
        const matches = !q ||
          (h.fullName || '').toLowerCase().includes(q) ||
          (h.personIdentifier || '').toLowerCase().includes(q) ||
          (h.offence || '').toLowerCase().includes(q) ||
          (h.caseNumber || '').toLowerCase().includes(q) ||
          (h.aliases || []).some((a: string) => a.toLowerCase().includes(q));

        if (matches) {
          allRecords.push({
            ...h,
            linkedCaseTitle: c.case_title,
            linkedPoliceStation: c.police_station
          });
        }
      }
    }
    return allRecords;
  }

  public getAllCriminalHistory(): any[] {
    return this.searchCriminalHistory('');
  }

  public addCriminalHistory(caseId: string, historyData: any): any {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId || c.fir_number === caseId);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const existing = current.criminal_history || current.criminalHistory || [];
    const newRecord = {
      id: historyData.id || `CRH-${Date.now().toString(36).toUpperCase()}`,
      personIdentifier: historyData.personIdentifier || `PID-MH-${Math.floor(100000 + Math.random() * 900000)}`,
      fullName: historyData.fullName || 'Accused Person',
      aliases: historyData.aliases || [],
      caseId: current.id,
      caseNumber: historyData.caseNumber || current.fir_number,
      offence: historyData.offence || current.crime_type,
      ipcSections: historyData.ipcSections || current.ipc_sections,
      caseStatus: historyData.caseStatus || 'UNDER_INVESTIGATION',
      courtOutcome: historyData.courtOutcome || 'Pending Trial',
      recordDate: historyData.recordDate || new Date().toISOString().substring(0, 10),
      source: historyData.source || 'SCRB Maharashtra',
      createdAt: new Date().toISOString()
    };

    current.criminal_history = [newRecord, ...existing];
    current.criminalHistory = current.criminal_history;
    this.persistToDisk();
    return newRecord;
  }

  public addEvidenceToCase(caseId: string, evidenceItem: PersistentEvidenceItem): PersistentCaseRecord | null {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId || c.fir_number === caseId);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const existingEvidence = current.evidence_items || [];
    
    // Check if evidence tag or id already exists
    const existingIdx = existingEvidence.findIndex(e => e.id === evidenceItem.id || e.evidenceTag === evidenceItem.evidenceTag);
    let updatedEvidence: PersistentEvidenceItem[];

    if (existingIdx !== -1) {
      updatedEvidence = [...existingEvidence];
      updatedEvidence[existingIdx] = { ...updatedEvidence[existingIdx], ...evidenceItem };
    } else {
      updatedEvidence = [evidenceItem, ...existingEvidence];
    }

    const updatedTimeline = [
      {
        id: `TL-EVD-${Date.now()}`,
        date: new Date().toISOString().substring(0, 10),
        title: `Evidence Attached: ${evidenceItem.evidenceTag}`,
        description: `${evidenceItem.category} - ${evidenceItem.description.substring(0, 80)}... Sealed with SHA-256 hash.`,
        officer: evidenceItem.collectedBy,
        badge: evidenceItem.collectedByBadge || 'MH-POL',
        type: 'EVIDENCE'
      },
      ...(current.timeline || [])
    ];

    const updatedCase: PersistentCaseRecord = {
      ...current,
      evidence_items: updatedEvidence,
      timeline: updatedTimeline,
      updated_at: new Date().toISOString()
    };

    this.cache[idx] = updatedCase;
    this.persistToDisk();
    return JSON.parse(JSON.stringify(updatedCase));
  }

  public addDocumentToCase(caseId: string, documentItem: any): PersistentCaseRecord | null {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId || c.fir_number === caseId);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const existingDocs = current.documents || [];
    
    // Check if doc id already exists
    const existingIdx = existingDocs.findIndex((d: any) => d.id === documentItem.id || (d.docNumber && d.docNumber === documentItem.docNumber));
    let updatedDocs: any[];

    if (existingIdx !== -1) {
      updatedDocs = [...existingDocs];
      updatedDocs[existingIdx] = { ...updatedDocs[existingIdx], ...documentItem };
    } else {
      updatedDocs = [documentItem, ...existingDocs];
    }

    const updatedTimeline = [
      {
        id: `TL-DOC-${Date.now()}`,
        date: new Date().toISOString().substring(0, 10),
        title: `Document Uploaded: ${documentItem.title || documentItem.id}`,
        description: `${documentItem.department || 'Case'} document ${documentItem.type || documentItem.documentType || 'record'} registered and anchored with SHA-256 seal.`,
        officer: documentItem.authorName || documentItem.uploadedBy || 'Investigating Officer',
        badge: documentItem.uploadedByBadge || 'MH-POL',
        type: documentItem.department === 'FORENSIC_FSL' || documentItem.department === 'FORENSIC' ? 'FORENSIC' : documentItem.department === 'PROSECUTION_LEGAL' || documentItem.department === 'LEGAL' ? 'LEGAL' : 'DOCUMENT'
      },
      ...(current.timeline || [])
    ];

    const updatedCase: PersistentCaseRecord = {
      ...current,
      documents: updatedDocs,
      timeline: updatedTimeline,
      updated_at: new Date().toISOString()
    };

    this.cache[idx] = updatedCase;
    this.persistToDisk();
    return JSON.parse(JSON.stringify(updatedCase));
  }

  public addMemberToCase(caseId: string, member: any): PersistentCaseRecord | null {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId);
    if (idx === -1) return null;

    const current = this.cache[idx];
    const members = current.case_members || [];
    const updatedMembers = [member, ...members.filter((m: any) => m.badgeNo !== member.badgeNo && m.user_id !== member.user_id)];

    const updatedCase: PersistentCaseRecord = {
      ...current,
      case_members: updatedMembers,
      updated_at: new Date().toISOString()
    };

    this.cache[idx] = updatedCase;
    this.persistToDisk();
    return JSON.parse(JSON.stringify(updatedCase));
  }

  // ==================== CASE OWNERSHIP & ASSIGNMENT METHODS ====================

  public createAssignment(assignment: CaseAssignmentRecord): CaseAssignmentRecord {
    if (!this.isLoaded) this.init();
    const existingIdx = this.assignmentsCache.findIndex(a => a.id === assignment.id);
    if (existingIdx !== -1) {
      this.assignmentsCache[existingIdx] = assignment;
    } else {
      this.assignmentsCache.push(assignment);
    }
    this.persistAssignments();
    return JSON.parse(JSON.stringify(assignment));
  }

  public getActiveAssignment(caseId: string): CaseAssignmentRecord | undefined {
    if (!this.isLoaded) this.init();
    return this.assignmentsCache.find(a => (a.case_id === caseId) && a.status === 'ACTIVE');
  }

  public hasActiveAssignment(caseId: string, officerBadge: string): boolean {
    if (!this.isLoaded) this.init();
    return this.assignmentsCache.some(
      a => (a.case_id === caseId) && a.officer_id === officerBadge && a.status === 'ACTIVE'
    );
  }

  public getAssignments(caseId?: string): CaseAssignmentRecord[] {
    if (!this.isLoaded) this.init();
    if (caseId) {
      return this.assignmentsCache.filter(a => a.case_id === caseId);
    }
    return [...this.assignmentsCache];
  }

  public removeAssignment(caseId: string, officerBadge: string, reason: string, removedBy: string): boolean {
    if (!this.isLoaded) this.init();
    let modified = false;
    const now = new Date().toISOString();
    this.assignmentsCache.forEach(a => {
      if (a.case_id === caseId && a.officer_id === officerBadge && a.status === 'ACTIVE') {
        a.status = 'REMOVED';
        a.removed_at = now;
        a.removal_reason = reason;
        modified = true;
      }
    });
    if (modified) this.persistAssignments();
    return modified;
  }

  // ==================== CROSS-STATION ACCESS REQUEST METHODS ====================

  public createAccessRequest(req: Omit<CaseAccessRequestRecord, 'id' | 'created_at' | 'status'>): CaseAccessRequestRecord {
    if (!this.isLoaded) this.init();
    const id = `REQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const newRecord: CaseAccessRequestRecord = {
      ...req,
      id,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };
    this.accessRequestsCache.unshift(newRecord);
    this.persistAccessRequests();
    return JSON.parse(JSON.stringify(newRecord));
  }

  public getAccessRequests(filter?: { status?: string; caseId?: string; requesterBadge?: string }): CaseAccessRequestRecord[] {
    if (!this.isLoaded) this.init();
    return this.accessRequestsCache.filter(r => {
      if (filter?.status && r.status !== filter.status) return false;
      if (filter?.caseId && r.case_id !== filter.caseId) return false;
      if (filter?.requesterBadge && r.requester_badge !== filter.requesterBadge) return false;
      return true;
    });
  }

  public approveAccessRequest(
    requestId: string,
    adminBadge: string,
    durationHours: number = 24
  ): { request: CaseAccessRequestRecord; grant: CaseAccessGrantRecord } | null {
    if (!this.isLoaded) this.init();
    const req = this.accessRequestsCache.find(r => r.id === requestId);
    if (!req || req.status !== 'PENDING') return null;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (durationHours || 24) * 60 * 60 * 1000).toISOString();

    req.status = 'APPROVED';
    req.reviewed_by = adminBadge;
    req.reviewed_at = now.toISOString();
    req.expires_at = expiresAt;
    this.persistAccessRequests();

    const grant: CaseAccessGrantRecord = {
      id: `GRANT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      case_id: req.case_id,
      user_badge: req.requester_badge,
      permission: req.requested_permission || 'VIEW',
      granted_by: adminBadge,
      granted_at: now.toISOString(),
      expires_at: expiresAt,
      status: 'ACTIVE',
    };

    // Remove any existing active grant for this user/case and insert new
    this.accessGrantsCache = this.accessGrantsCache.filter(
      g => !(g.case_id === req.case_id && g.user_badge === req.requester_badge && g.status === 'ACTIVE')
    );
    this.accessGrantsCache.unshift(grant);
    this.persistAccessGrants();

    // Ensure team assignment reflects approved clearance
    const existingAsgn = this.assignmentsCache.find(
      a => a.case_id === req.case_id && a.officer_id === req.requester_badge
    );
    if (existingAsgn) {
      existingAsgn.status = 'ACTIVE';
      existingAsgn.assigned_by = adminBadge;
      existingAsgn.assigned_at = now.toISOString();
    } else {
      this.assignmentsCache.push({
        id: `ASGN-${req.case_id.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
        case_id: req.case_id,
        officer_id: req.requester_badge,
        officer_name: req.requester_name,
        assigned_by: adminBadge,
        assigned_at: now.toISOString(),
        status: 'ACTIVE',
      });
    }
    this.persistAssignments();

    return {
      request: JSON.parse(JSON.stringify(req)),
      grant: JSON.parse(JSON.stringify(grant)),
    };
  }

  public rejectAccessRequest(
    requestId: string,
    adminBadge: string,
    reason: string
  ): CaseAccessRequestRecord | null {
    if (!this.isLoaded) this.init();
    const req = this.accessRequestsCache.find(r => r.id === requestId);
    if (!req || req.status !== 'PENDING') return null;

    req.status = 'REJECTED';
    req.reviewed_by = adminBadge;
    req.reviewed_at = new Date().toISOString();
    req.rejection_reason = reason || 'Declined by Administrator';
    this.persistAccessRequests();

    return JSON.parse(JSON.stringify(req));
  }

  public hasActiveAccessGrant(caseId: string, userBadge: string): boolean {
    if (!this.isLoaded) this.init();
    const now = Date.now();
    return this.accessGrantsCache.some(g => {
      if (g.case_id !== caseId || g.user_badge !== userBadge || g.status !== 'ACTIVE') {
        return false;
      }
      if (g.expires_at && new Date(g.expires_at).getTime() < now) {
        g.status = 'EXPIRED';
        return false;
      }
      return true;
    });
  }

  public getActiveAccessGrants(caseId?: string): CaseAccessGrantRecord[] {
    if (!this.isLoaded) this.init();
    const now = Date.now();
    return this.accessGrantsCache.filter(g => {
      if (caseId && g.case_id !== caseId) return false;
      if (g.status !== 'ACTIVE') return false;
      if (g.expires_at && new Date(g.expires_at).getTime() < now) {
        g.status = 'EXPIRED';
        return false;
      }
      return true;
    });
  }

  public revokeAccessGrants(caseId: string): number {
    if (!this.isLoaded) this.init();
    let count = 0;
    const now = new Date().toISOString();
    this.accessGrantsCache.forEach(g => {
      if (g.case_id === caseId && g.status === 'ACTIVE') {
        g.status = 'REVOKED';
        g.revoked_at = now;
        count++;
      }
    });
    if (count > 0) this.persistAccessGrants();
    return count;
  }

  // ==================== ADMIN REASSIGN INVESTIGATING OFFICER ====================

  public reassignCaseIO(
    caseId: string,
    newOfficerBadge: string,
    newOfficerName: string,
    reason: string,
    adminBadge: string,
    revokeTemporaryGrants: boolean = false
  ): { oldOfficerBadge?: string; updatedCase: PersistentCaseRecord } {
    if (!this.isLoaded) this.init();
    const idx = this.cache.findIndex(c => c.id === caseId || c.fir_number === caseId);
    if (idx === -1) {
      throw new Error(`Case ${caseId} not found in persistent store`);
    }

    const currentCase = this.cache[idx];
    const oldOfficerBadge = currentCase.investigating_officer_id || currentCase.assigned_io_badge;
    const now = new Date().toISOString();

    // 1. Mark former IO active assignment as REMOVED
    this.assignmentsCache.forEach(a => {
      if (a.case_id === currentCase.id && a.status === 'ACTIVE') {
        a.status = 'REMOVED';
        a.removed_at = now;
        a.removed_by = adminBadge;
        a.removal_reason = `${reason} (Reassigned to ${newOfficerName} [${newOfficerBadge}] by ${adminBadge})`;
      }
    });

    // 2. Create new active assignment
    const newAssignment: CaseAssignmentRecord = {
      id: `ASGN-${currentCase.id.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
      case_id: currentCase.id,
      officer_id: newOfficerBadge,
      officer_name: newOfficerName,
      assigned_by: adminBadge,
      assigned_at: now,
      status: 'ACTIVE',
    };
    this.assignmentsCache.push(newAssignment);
    this.persistAssignments();

    // 3. Revoke temporary access grants if requested
    if (revokeTemporaryGrants) {
      this.revokeAccessGrants(currentCase.id);
    }

    // 4. Update case properties
    currentCase.investigating_officer_id = newOfficerBadge;
    currentCase.assigned_io = newOfficerName;
    currentCase.assigned_io_badge = newOfficerBadge;
    currentCase.assigned_at = now;
    currentCase.assigned_by = adminBadge;
    currentCase.updated_at = now;

    if ((currentCase as any).officers) {
      (currentCase as any).officers.assignedIO = newOfficerName;
      (currentCase as any).officers.assignedIOBadge = newOfficerBadge;
    }

    if (Array.isArray((currentCase as any).caseAssignments)) {
      (currentCase as any).caseAssignments.forEach((a: any) => {
        if (a.assignmentRole === 'Lead Investigator' || a.status === 'Active') {
          a.status = 'Removed';
          a.removedAt = now;
          a.removedByName = adminBadge;
          a.removalReason = reason;
        }
      });
      (currentCase as any).caseAssignments.unshift({
        assignmentId: `ASGN-${currentCase.id.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
        caseId: currentCase.id,
        userId: newOfficerBadge,
        officerName: newOfficerName,
        assignmentRole: 'Lead Investigator',
        status: 'Active',
        accessLevel: 'Full Case Team Access',
        assignedBy: adminBadge,
        assignedAt: now,
      });
    }

    // 5. Append to case timeline
    const timelineEntry = {
      id: `TL-REASSIGN-${Date.now()}`,
      date: now.substring(0, 10),
      title: 'Investigating Officer Reassigned',
      description: `Lead IO reallocated: ${oldOfficerBadge || 'None'} → ${newOfficerName} (${newOfficerBadge}). Reason: ${reason}. Former officer active case access revoked.`,
      officer: adminBadge,
      badge: adminBadge,
      type: 'REASSIGNMENT',
    };
    currentCase.timeline = [timelineEntry, ...(currentCase.timeline || [])];

    this.cache[idx] = currentCase;
    this.persistToDisk();

    // 6. Record history snapshot
    saveToHistoryStore('CASE_REASSIGNED', currentCase, adminBadge);

    return {
      oldOfficerBadge,
      updatedCase: JSON.parse(JSON.stringify(currentCase)),
    };
  }
}

export const casePersistenceService = new CasePersistenceService();
