import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MaharashtraPoliceEmblem } from './Emblem';
import { soundEffects } from './AudioEffects';
import { 
  CaseFile, 
  UserSession, 
  CaseStatus, 
  PriorityLevel, 
  CrimeType, 
  AuditTrailEntry,
  PoliceRole,
  OfficerProfile
} from '../types';
import { apiClient, initRealTimeSync } from '../services/apiClient';
import { mapDbRowToCaseFile, DEFAULT_SAMPLE_CASES } from '../utils/caseMapper';
import { CaseDetailsModal } from './CaseDetailsModal';
import { AssignIOModal } from './AssignIOModal';
import { RequestCaseAccessModal } from './RequestCaseAccessModal';
import { ReassignIOModal } from './ReassignIOModal';
import { AuditLedgerView } from './AuditLedgerView';
import { AdministrationView } from './AdministrationView';
import { GlobalEvidenceView } from './GlobalEvidenceView';
import { ReportsAnalyticsView } from './ReportsAnalyticsView';
import { MemberManagementView } from './MemberManagementView';
import { AccessRequestApprovalPanel } from './AccessRequestApprovalPanel';
import { BlockchainLedgerViewer } from './BlockchainLedgerViewer';
import { SecurityCenterView } from './SecurityCenterView';
import { NewCaseModal } from './NewCaseModal';
import { ICJSPillarsView } from './ICJSPillarsView';
import { CCTNSFormsModal } from './CCTNSFormsModal';
import { SpecialInvestigationPanel } from './SpecialInvestigationPanel';
import { UploadForensicReportModal } from './UploadForensicReportModal';
import { AddCourtDocumentModal } from './AddCourtDocumentModal';
import { LiveCaseSummaryModal } from './LiveCaseSummaryModal';
import { ForensicDashboardView } from './ForensicDashboardView';
import { LegalDashboardView } from './LegalDashboardView';
import { AuditorDashboardView } from './AuditorDashboardView';
import { JailDashboardView } from './JailDashboardView';
import { NCRBDashboardView } from './NCRBDashboardView';
import { PoliceLawAssistantView } from './PoliceLawAssistantView';
import { IdentitySearchPanel } from './IdentitySearchPanel';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { 
  CASE_STATUS_LABELS,
  canCreateCase,
  canAccessCase,
  canAssignIO,
  canReviewCase,
  canApproveClosure,
  generateNotifications,
  generateSimulatedSHA256,
  generateAICaseBrief,
  ROLE_PERMISSIONS,
  canApproveAccessRequest,
  mapAuditActionToBlockchainType
} from '../utils/policeWorkflow';

import { 
  FolderLock, 
  Search, 
  Plus, 
  Filter, 
  FileText, 
  LogOut, 
  Printer, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  RotateCcw,
  X,
  ShieldCheck,
  History,
  FileSignature,
  Scale,
  Lock,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  RefreshCw,
  FileCheck,
  Fingerprint,
  User,
  Hash,
  Share2,
  Calendar,
  AlertCircle,
  Sparkles,
  Layers,
  LayoutDashboard,
  ShieldAlert,
  Bell,
  Activity,
  Users,
  BarChart3,
  Microscope,
  Check,
  UserCheck,
  Building2,
  Sliders,
  Award,
  Phone,
  Network,
  Scan,
  KeyRound,
  FileBarChart
} from 'lucide-react';

interface VaultDashboardProps {
  session: UserSession;
  onLogout: () => void;
  onOpen3DViewer: (caseItem?: CaseFile) => void;
  onReplayIntro: () => void;
}

type MainNavView = 
  | 'DASHBOARD'
  | 'CASES_LIST'
  | 'IDENTITY_SEARCH'
  | 'ICJS_INTEGRATIONS'
  | 'LAW_ASSISTANT'
  | 'EVIDENCE_VAULT'
  | 'REPORTS_ANALYTICS'
  | 'AUDIT_LOGS'
  | 'ADMINISTRATION'
  | 'MEMBERS'
  | 'ACCESS_REQUESTS'
  | 'BLOCKCHAIN_LEDGER'
  | 'CYBER_SECURITY';

export const VaultDashboard: React.FC<VaultDashboardProps> = ({
  session,
  onLogout,
  onOpen3DViewer,
  onReplayIntro: _onReplayIntro,
}) => {
  // Navigation & Layout State
  const { t, language } = useLanguage();
  const [currentView, setCurrentView] = useState<MainNavView>('DASHBOARD');
  const [lawAssistantQuery, setLawAssistantQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

  // Cases State (initialized with realistic police dockets, synced with backend when online)
  const [cases, setCases] = useState<CaseFile[]>(DEFAULT_SAMPLE_CASES);
  const [selectedCaseForDetails, setSelectedCaseForDetails] = useState<CaseFile | null>(null);
  const [isCaseDetailsOpen, setIsCaseDetailsOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  
  // Assign IO Modal State
  const [caseForIOAssign, setCaseForIOAssign] = useState<CaseFile | null>(null);
  const [isAssignIOModalOpen, setIsAssignIOModalOpen] = useState(false);

  // Access Request & IO Reassignment Modals State
  const [caseForAccessRequest, setCaseForAccessRequest] = useState<CaseFile | null>(null);
  const [isAccessRequestModalOpen, setIsAccessRequestModalOpen] = useState(false);
  const [caseForReassignIO, setCaseForReassignIO] = useState<CaseFile | null>(null);
  const [isReassignIOModalOpen, setIsReassignIOModalOpen] = useState(false);

  // Create Case Modal State
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFirNumber, setNewFirNumber] = useState('');
  const [newCrimeType, setNewCrimeType] = useState<CrimeType>('Cyber Crime & Financial Fraud');
  const [newIncidentDate, setNewIncidentDate] = useState(new Date().toISOString().substring(0, 10));
  const [newIncidentTime, setNewIncidentTime] = useState('14:30');
  const [newLocation, setNewLocation] = useState('Andheri East Commercial Complex, Mumbai');
  const [newIpcSections, setNewIpcSections] = useState('Sec 420 IPC, Sec 66C/66D IT Act');
  const [newComplainantName, setNewComplainantName] = useState('');
  const [newComplainantContact, setNewComplainantContact] = useState('');
  const [newComplainantBrief, setNewComplainantBrief] = useState('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('HIGH');
  const [newSummaryNotes, setNewSummaryNotes] = useState('');
  const [isNewCaseWizardOpen, setIsNewCaseWizardOpen] = useState(false);
  const [blockchainRefreshTrigger, setBlockchainRefreshTrigger] = useState(0);

  // CCTNS Forms & Special Investigation Modals
  const [activeCCTNSCaseForModal, setActiveCCTNSCaseForModal] = useState<CaseFile | null>(null);
  const [activeSpecialCaseForModal, setActiveSpecialCaseForModal] = useState<CaseFile | null>(null);

  // Department-Specific Modals (Forensic Lab Reports, Court Orders & Judgments)
  const [isUploadForensicReportOpen, setIsUploadForensicReportOpen] = useState(false);
  const [selectedForensicCaseId, setSelectedForensicCaseId] = useState<string | undefined>(undefined);
  const [selectedForensicEvidenceId, setSelectedForensicEvidenceId] = useState<string | undefined>(undefined);

  const [isAddCourtDocumentOpen, setIsAddCourtDocumentOpen] = useState(false);
  const [summaryModalCase, setSummaryModalCase] = useState<CaseFile | null>(null);
  const [selectedLegalCaseId, setSelectedLegalCaseId] = useState<string | undefined>(undefined);
  const [selectedLegalModalMode, setSelectedLegalModalMode] = useState<'HEARING' | 'STATEMENT' | 'ORDER'>('ORDER');

  // Audit Logs State (from PostgreSQL)
  const [auditLogs, setAuditLogs] = useState<AuditTrailEntry[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));

  // Fetch real data from backend APIs
  const fetchAllData = async () => {
    try {
      const [casesRes, summaryRes, activityRes] = await Promise.all([
        apiClient.getCases().catch(() => null),
        apiClient.getDashboardSummary().catch(() => null),
        apiClient.getRecentActivity(25).catch(() => null)
      ]);

      setLastSyncTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      if (casesRes && casesRes.success && Array.isArray(casesRes.cases)) {
        const mapped = casesRes.cases.map(mapDbRowToCaseFile);
        setCases(mapped);
        setSelectedCaseForDetails(prev => {
          if (!prev) return null;
          const fresh = mapped.find(c => c.id === prev.id);
          if (!fresh) return prev;
          return {
            ...prev,
            ...fresh,
            documents: (fresh.documents && fresh.documents.length > 0) ? fresh.documents : prev.documents,
            evidenceItems: (fresh.evidenceItems && fresh.evidenceItems.length > 0) ? fresh.evidenceItems : prev.evidenceItems,
            timeline: (fresh.timeline && fresh.timeline.length > 0) ? fresh.timeline : prev.timeline,
            forensicRequests: (fresh.forensicRequests && fresh.forensicRequests.length > 0) ? fresh.forensicRequests : prev.forensicRequests,
            courtRecords: (fresh.courtRecords && fresh.courtRecords.length > 0) ? fresh.courtRecords : prev.courtRecords,
            repositoryDocuments: (fresh.repositoryDocuments && fresh.repositoryDocuments.length > 0) ? fresh.repositoryDocuments : prev.repositoryDocuments,
          };
        });
      }
      if (summaryRes && summaryRes.success && summaryRes.summary) {
        setDashboardSummary(summaryRes.summary);
      }
      if (activityRes && activityRes.success && Array.isArray(activityRes.activity) && activityRes.activity.length > 0) {
        const mappedLogs: AuditTrailEntry[] = activityRes.activity.map((a: any) => ({
          id: String(a.id),
          timestamp: new Date(a.timestamp).toISOString().replace('T', ' ').substring(0, 16) + ' IST',
          officerName: a.actor_name || 'Officer',
          badgeNo: a.actor_badge || 'MH-POL',
          department: 'POLICE_INVESTIGATION',
          action: a.action,
          targetEntityId: a.resource_id || a.action,
          ipAddress: a.ip_address || '127.0.0.1',
          status: 'VERIFIED_SUCCESS'
        }));
        setAuditLogs(mappedLogs);
      }
    } catch (err) {
      console.warn('Dashboard operating with local demo dockets:', err);
    }
  };

  React.useEffect(() => {
    fetchAllData();

    // Real-Time Multi-Device SSE synchronization
    const unsubscribeSSE = initRealTimeSync(() => {
      fetchAllData();
    });

    // Periodic live-sync polling (every 3.5 seconds) for real-time docket updates across officers & stations
    const liveSyncInterval = setInterval(() => {
      fetchAllData();
    }, 2500);

    const handleLiveSync = () => {
      fetchAllData();
    };

    window.addEventListener('casevault:case-updated', handleLiveSync);
    window.addEventListener('casevault:file-updated', handleLiveSync);
    window.addEventListener('focus', handleLiveSync);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchAllData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribeSSE();
      clearInterval(liveSyncInterval);
      window.removeEventListener('casevault:case-updated', handleLiveSync);
      window.removeEventListener('casevault:file-updated', handleLiveSync);
      window.removeEventListener('focus', handleLiveSync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [blockchainRefreshTrigger]);

  // Strict role-based dashboard lock: each role can ONLY access permitted views
  React.useEffect(() => {
    const allowedViewsForRole: Record<PoliceRole, MainNavView[]> = {
      POLICE: ['DASHBOARD', 'CASES_LIST', 'IDENTITY_SEARCH', 'EVIDENCE_VAULT', 'LAW_ASSISTANT', 'MEMBERS', 'REPORTS_ANALYTICS', 'AUDIT_LOGS'],
      FORENSIC: ['DASHBOARD', 'CASES_LIST', 'EVIDENCE_VAULT', 'MEMBERS', 'REPORTS_ANALYTICS', 'AUDIT_LOGS'],
      LEGAL: ['DASHBOARD', 'CASES_LIST', 'EVIDENCE_VAULT', 'MEMBERS', 'REPORTS_ANALYTICS', 'AUDIT_LOGS'],
      AUDITOR: ['DASHBOARD', 'CASES_LIST', 'MEMBERS', 'BLOCKCHAIN_LEDGER', 'CYBER_SECURITY', 'AUDIT_LOGS'],
      ADMIN: ['DASHBOARD', 'CASES_LIST', 'ADMINISTRATION', 'ACCESS_REQUESTS', 'MEMBERS', 'AUDIT_LOGS'],
    };

    const allowed = allowedViewsForRole[session.role] || ['DASHBOARD'];
    if (!allowed.includes(currentView)) {
      setCurrentView('DASHBOARD');
    }
  }, [currentView, session.role]);

  // Success Notification Toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Filters for Cases List
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [stationFilter, setStationFilter] = useState<string>('ALL');

  // Dynamic Audit Entry Creator
  const logAudit = (action: string, target: string, notes?: string) => {
    const newEntry: AuditTrailEntry = {
      id: `AUD-MH-${session.badgeNo.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
      officerName: session.officerName,
      badgeNo: session.badgeNo,
      department: session.department,
      action: action,
      targetEntityId: target,
      ipAddress: '10.14.88.42 (Internal Net)',
      status: 'VERIFIED_SUCCESS'
    };
    setAuditLogs(prev => [newEntry, ...prev]);
  };

  // Handle Case Update from Details Modal or Assign Modal
  const handleUpdateCase = async (updatedCase: CaseFile, auditAction?: string, auditNotes?: string) => {
    setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
    if (selectedCaseForDetails && selectedCaseForDetails.id === updatedCase.id) {
      setSelectedCaseForDetails(updatedCase);
    }
    if (auditAction) {
      logAudit(auditAction, updatedCase.id, auditNotes);
      setBlockchainRefreshTrigger(prev => prev + 1);
    }
    showToast(`Case Docket ${updatedCase.id} updated successfully.`);

    // Persist to backend store so changes survive across all logins
    try {
      await apiClient.updateCase(updatedCase.id, {
        status: updatedCase.status,
        caseStatus: updatedCase.status,
        priority: updatedCase.priority,
        assignedIO: updatedCase.officers?.assignedIO,
        assignedIOBadge: updatedCase.officers?.assignedIOBadge,
        incidentLocation: updatedCase.incidentLocation,
        evidenceItems: updatedCase.evidenceItems,
        documents: updatedCase.documents,
        timeline: updatedCase.timeline,
        caseAssignments: updatedCase.caseAssignments,
        victimRecord: updatedCase.victimRecord,
        victimRecords: updatedCase.victimRecords,
        witnesses: updatedCase.witnesses,
        suspects: updatedCase.suspects,
        investigationJournal: updatedCase.investigationJournal,
        courtRecords: updatedCase.courtRecords,
        fingerprintRecords: updatedCase.fingerprintRecords,
        forensicRequests: updatedCase.forensicRequests,
        warrants: updatedCase.warrants,
        hearings: updatedCase.hearings,
        criminalHistory: updatedCase.criminalHistory
      });
      // Broadcast live event and trigger instant refresh across dashboard
      window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: { caseId: updatedCase.id } }));
      window.dispatchEvent(new CustomEvent('casevault:file-updated', { detail: { caseId: updatedCase.id } }));
      fetchAllData();
    } catch (err: any) {
      console.warn('[CASE UPDATE PERSISTENCE] Backend sync notice:', err.message);
    }
  };

  // Handle bulk cases update (used by AccessRequestApprovalPanel)
  const handleUpdateCases = (updatedCases: CaseFile[]) => {
    setCases(updatedCases);
    showToast('Access request decision recorded.');
  };

  // Handle new case created from wizard
  const handleNewCaseCreated = async (newCase: CaseFile) => {
    setCases(prev => [newCase, ...prev]);
    logAudit('CASE_CREATED', newCase.id, `New FIR: ${newCase.firNumber}`);
    setBlockchainRefreshTrigger(prev => prev + 1);

    // Persist new case to backend so every login immediately has access to it
    try {
      await apiClient.createCase({
        id: newCase.id,
        firNumber: newCase.firNumber,
        caseTitle: newCase.caseTitle,
        policeStation: newCase.policeStation,
        policeStationId: (newCase as any).policeStationId || 'ANDHERI-PS',
        jurisdictionZone: newCase.jurisdictionZone,
        crimeType: newCase.crimeType,
        incidentDate: newCase.incidentDate,
        incidentLocation: newCase.incidentLocation,
        priority: newCase.priority,
        ipcSections: newCase.ipcSections,
        piInCharge: newCase.officers.piInCharge,
        assignedIO: newCase.officers.assignedIO,
        assignedIOBadge: newCase.officers.assignedIOBadge,
        supervisingDySP: newCase.officers.supervisingDySP,
        evidenceItems: newCase.evidenceItems,
        documents: newCase.documents,
        timeline: newCase.timeline,
        caseAssignments: newCase.caseAssignments,
        summaryNotes: newCase.summaryNotes
      });
    } catch (err: any) {
      console.warn('[CASE CREATION PERSISTENCE] Backend sync notice:', err.message);
    } finally {
      fetchAllData();
    }
  };

  // Handle Create Case Form Submission (PI Driven - API backed)
  const handleCreateCaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newFirNumber.trim()) return;

    soundEffects.playStamp();
    const sectionsArray = newIpcSections.split(',').map(s => s.trim()).filter(Boolean);

    try {
      const res = await apiClient.createCase({
        firNumber: newFirNumber,
        caseTitle: newTitle,
        crimeType: newCrimeType,
        incidentDate: newIncidentDate,
        incidentTime: newIncidentTime,
        incidentLocation: newLocation,
        policeStation: session.station || 'Andheri Police Station, Mumbai',
        priority: newPriority,
        ipcSections: sectionsArray.length > 0 ? sectionsArray : ['Sec 154 CrPC'],
        summaryNotes: newSummaryNotes || `${newTitle} registered at ${session.station}.`,
      });

      if (res && res.success && res.caseItem) {
        const newCase = mapDbRowToCaseFile(res.caseItem);
        setCases(prev => [newCase, ...prev]);
        setIsCreateCaseOpen(false);
        showToast(`Case ${newCase.id} registered.`);
        setSelectedCaseForDetails(newCase);
        setIsCaseDetailsOpen(true);
        setBlockchainRefreshTrigger(prev => prev + 1);
      } else {
        showToast(res.error || 'Failed to create case');
      }
    } catch (err: any) {
      showToast(`Error creating case: ${err.message}`);
    }

    // Reset Form
    setNewTitle('');
    setNewFirNumber('');
    setNewComplainantName('');
    setNewComplainantContact('');
    setNewComplainantBrief('');
    setNewSummaryNotes('');
  };

  // Dynamic Case Notifications for Current User
  const notifications = useMemo(() => {
    return generateNotifications(cases, session);
  }, [cases, session]);

  // Filtered Cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      // Global Search
      // Advanced Multi-Token Search Algorithm
      const searchTerms = globalSearch.toLowerCase().split(/\s+/).filter(Boolean);
      let searchMatch = true;
      
      if (searchTerms.length > 0) {
        // Aggregate all searchable case data into a single corpus string for algorithmic matching
        const searchableCorpus = [
          c.id,
          c.firNumber,
          c.caseTitle,
          c.crimeType,
          c.officers?.assignedIO || '',
          c.complainant?.name || '',
          c.policeStation,
          c.summaryNotes || '',
          ...(c.ipcSections || []),
          ...(c.evidenceItems?.map(e => `${e.evidenceTag} ${e.description}`) || []),
          ...(c.suspects?.map(s => `${s.name} ${s.alias}`) || []),
          ...(c.investigationJournal?.map(j => j.notes) || [])
        ].join(' ').toLowerCase();

        // Algorithm: All search tokens must be present in the corpus (order-independent)
        searchMatch = searchTerms.every(term => searchableCorpus.includes(term));
      }

      if (!searchMatch) return false;

      // Status Filter
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;

      // Priority Filter
      if (priorityFilter !== 'ALL' && c.priority !== priorityFilter) return false;

      // Station Filter
      if (stationFilter !== 'ALL' && !c.policeStation.includes(stationFilter)) return false;

      return true;
    });
  }, [cases, globalSearch, statusFilter, priorityFilter, stationFilter]);

  // Aggregate Metrics Computed from PostgreSQL API & Case List
  const stats = useMemo(() => {
    const totalCases = dashboardSummary?.totalCases ?? cases.length;
    const activeInvestigations = dashboardSummary?.activeCases ?? cases.filter(c => c.status === 'Investigation Ongoing' || c.status === 'FIR Registered').length;
    const pendingIOAssign = cases.filter(c => !c.officers?.assignedIO).length;
    const pendingForensics = cases.filter(c => c.status === 'Forensic Examination').length;
    const pendingReview = cases.filter(c => c.status === 'Pending Supervisory Review').length;
    const chargeSheetReady = cases.filter(c => (c.status as string) === 'Charge Sheet / Pslatecution Stage' || (c.status as string) === 'Chargesheet Filed').length;
    const closedCases = cases.filter(c => c.status === 'Closed').length;

    let totalEvidence = dashboardSummary?.totalEvidence ?? 0;
    let sha256VerifiedEvidence = dashboardSummary?.verifiedEvidence ?? 0;
    if (!dashboardSummary) {
      cases.forEach(c => {
        c.evidenceItems?.forEach(e => {
          totalEvidence++;
          if (e.isIntegrityVerified) sha256VerifiedEvidence++;
        });
      });
    }

    return {
      totalCases,
      activeInvestigations,
      pendingIOAssign,
      pendingForensics,
      pendingReview,
      chargeSheetReady,
      closedCases,
      totalEvidence,
      sha256VerifiedEvidence
    };
  }, [cases, dashboardSummary]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#f4f3ee] text-slate-800 overflow-hidden select-none font-sans">
      
      {/* 1. MHA TOP BAR (Light Grey) */}
      <div className="h-8 bg-slate-100 border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 text-[10px] font-bold text-slate-700 uppercase tracking-wide shrink-0">
        <div className="flex items-center gap-4">
          {/* Top bar left spacer */}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
             <span className="pl-3">
               {session.officerName} ({session.badgeNo})
             </span>
             <button onClick={onLogout} className="text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer pl-2 border-l border-slate-300">
               <LogOut className="w-3 h-3" /> Logout
             </button>
          </div>
        </div>
      </div>

      {/* 2. MHA LOGO BAR (White) */}
      <div className="h-20 bg-white flex items-center justify-between px-4 sm:px-8 shadow-sm z-20 relative shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex flex-col pl-2">
             <span className="text-xl sm:text-2xl font-black text-[#17406a] tracking-tight">{t('app.title', 'e-CASEVAULT')}</span>
             <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 tracking-widest mt-0.5">{t('app.subtitle', 'DIGITAL EVIDENCE MANAGEMENT SYSTEM')}</span>
          </div>
        </div>
        <div className="hidden lg:flex items-center gap-4">
          {/* Real-Time Live Sync Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-300/80 rounded-md text-xs font-sans shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-emerald-900 tracking-wide text-[11px]">LIVE SYNC</span>
            <span className="text-emerald-300 font-bold">|</span>
            <span className="text-slate-600 font-mono text-[10px]">Update at {lastSyncTime}</span>
          </div>

          {/* Language Selector */}
          <LanguageSelector />
          
          {/* Global Search Bar */}
          <div className="relative w-64 xl:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={t('app.search_placeholder', 'Search Case ID, FIR, IO...')}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#17406a] transition-all"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >✕</button>
            )}
          </div>

          {/* Quick Header Actions */}
          {canCreateCase(session) && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playSnap();
                setIsNewCaseWizardOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#17406a] hover:bg-[#112d4a] text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{t('app.register_fir', 'Register FIR')}</span>
            </button>
          )}

          {session.role === 'FORENSIC' && (
            <button
              type="button"
              onClick={() => {
                soundEffects.playSnap();
                setSelectedForensicCaseId(undefined);
                setSelectedForensicEvidenceId(undefined);
                setIsUploadForensicReportOpen(true);
              }}
              className="px-3.5 py-1.5 bg-[#17406a] hover:bg-[#112d4a] text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Microscope className="w-4 h-4" />
              <span>{t('action.submit_fsl_report', 'Submit FSL Report')}</span>
            </button>
          )}

          {session.role === 'LEGAL' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  soundEffects.playSnap();
                  setSelectedLegalCaseId(undefined);
                  setSelectedLegalModalMode('HEARING');
                  setIsAddCourtDocumentOpen(true);
                }}
                className="px-3 py-1.5 bg-[#17406a] hover:bg-[#112d4a] text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Record Hearing</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEffects.playSnap();
                  setSelectedLegalCaseId(undefined);
                  setSelectedLegalModalMode('STATEMENT');
                  setIsAddCourtDocumentOpen(true);
                }}
                className="px-3 py-1.5 bg-[#17406a] hover:bg-[#112d4a] text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Upload Statement</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundEffects.playSnap();
                  setSelectedLegalCaseId(undefined);
                  setSelectedLegalModalMode('ORDER');
                  setIsAddCourtDocumentOpen(true);
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Court Order</span>
              </button>
            </div>
          )}

          {session.role === 'AUDITOR' && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-800 font-bold text-xs rounded">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
              <span>Auditor Mode (Read-Only)</span>
            </div>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                soundEffects.playSnap();
                setIsNotificationsDrawerOpen(!isNotificationsDrawerOpen);
              }}
              className="relative p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {isNotificationsDrawerOpen && (
              <div className="absolute right-0 top-10 w-80 sm:w-96 bg-white rounded border border-slate-200 shadow-2xl p-4 space-y-3 z-50 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-[#17406a]" />
                    {t('app.command_alerts', 'Command Alerts')} ({notifications.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsNotificationsDrawerOpen(false)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >✕</button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        const target = cases.find(c => c.id === n.caseId);
                        if (target) {
                          setSelectedCaseForDetails(target);
                          setIsCaseDetailsOpen(true);
                          setIsNotificationsDrawerOpen(false);
                        }
                      }}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        n.severity === 'HIGH' ? 'bg-red-50/70 border-red-200 hover:bg-red-50' :
                        n.severity === 'MEDIUM' ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50' :
                        'bg-blue-50/70 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{n.title}</span>
                        <span className="font-mono text-[10px] text-slate-400">{n.timestamp}</span>
                      </div>
                      <p className="text-slate-600 mt-1 text-[11px]">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. MHA HORIZONTAL NAV BAR (Navy Blue) */}
      <nav className="h-11 bg-[#17406a] flex items-center px-4 sm:px-8 overflow-x-auto shadow-md z-10 shrink-0 hide-scrollbar gap-1 sm:gap-2">
        {(() => {
            let items: any[] = [];
            if (session.role === 'FORENSIC') {
              items = [
                { id: 'DASHBOARD', label: t('nav.dashboard_overview', 'FSL Lab Desk & Queue'), icon: Microscope },
                { id: 'CASES_LIST', label: `${t('nav.all_cases', 'Forensic Cases')} (${cases.length})`, icon: FolderLock },
                { id: 'MEMBERS', label: t('nav.member_management', 'Forensic Scientists (FSL)'), icon: Users },
                { id: 'REPORTS_ANALYTICS', label: t('nav.crime_analytics', 'FSL Turnaround & Analysis'), icon: BarChart3 },
                { id: 'AUDIT_LOGS', label: t('nav.audit_trail', 'Custody & FSL Audit Trail'), icon: History },
              ];
            } else if (session.role === 'LEGAL') {
              items = [
                { id: 'DASHBOARD', label: t('nav.dashboard_overview', 'Prosecution & Court Desk'), icon: Scale },
                { id: 'CASES_LIST', label: `${t('nav.all_cases', 'Court Dockets')} (${cases.length})`, icon: FolderLock },
                { id: 'MEMBERS', label: t('nav.member_management', 'Courts & Judicial Roster'), icon: Users },
                { id: 'REPORTS_ANALYTICS', label: t('nav.crime_analytics', 'Disposal & Trial Analytics'), icon: BarChart3 },
                { id: 'AUDIT_LOGS', label: t('nav.audit_trail', 'Judicial Audit Trail'), icon: History },
              ];
            } else if (session.role === 'AUDITOR') {
              items = [
                { id: 'DASHBOARD', label: t('nav.dashboard_overview', 'Integrity & Vigilance Desk'), icon: ShieldCheck },
                { id: 'CASES_LIST', label: `${t('nav.all_cases', 'Inspect Case Dockets')} (${cases.length})`, icon: FolderLock },
                { id: 'MEMBERS', label: t('nav.member_management', 'Institutional Personnel Roster'), icon: Users },
                { id: 'BLOCKCHAIN_LEDGER', label: t('nav.blockchain_ledger', 'Fabric Ledger & Anchors'), icon: Hash },
                { id: 'CYBER_SECURITY', label: t('nav.cyber_security', 'Threat & Integrity Monitor'), icon: ShieldAlert },
                { id: 'AUDIT_LOGS', label: t('nav.audit_trail', 'Immutable Audit Trail'), icon: History },
              ];
            } else if (session.role === 'ADMIN') {
              items = [
                { id: 'DASHBOARD', label: t('nav.dashboard_overview', 'Admin Dashboard'), icon: LayoutDashboard },
                { id: 'CASES_LIST', label: `${t('nav.all_cases', 'All Cases & Dockets')} (${cases.length})`, icon: FolderLock },
                { id: 'ADMINISTRATION', label: t('nav.users_permissions', 'Users, Roles & Security'), icon: Sliders },
                ...(canApproveAccessRequest(session) ? [{ id: 'ACCESS_REQUESTS', label: t('nav.access_requests', 'Case Access Requests'), icon: ShieldCheck, badge: cases.reduce((a, c) => a + (c.accessRequests || []).filter(r => r.status === 'Pending').length, 0) }] : []),
                { id: 'MEMBERS', label: t('nav.member_management', 'Personnel & Members'), icon: Users },
                { id: 'AUDIT_LOGS', label: t('nav.audit_trail', 'Activity Log'), icon: History },
              ];
            } else {
              items = [
                { id: 'DASHBOARD', label: t('nav.dashboard_overview', 'Police Dashboard'), icon: LayoutDashboard },
                { id: 'CASES_LIST', label: `${t('nav.all_cases', 'All Cases')} (${cases.length})`, icon: FolderLock },
                { id: 'IDENTITY_SEARCH', label: t('nav.identity_search', 'Face & Photo Search'), icon: Scan },
                { id: 'LAW_ASSISTANT', label: t('nav.law_assistant', 'Law Assistant'), icon: Scale },
                { id: 'MEMBERS', label: t('nav.member_management', 'Police Officers'), icon: Users },
                { id: 'REPORTS_ANALYTICS', label: t('nav.crime_analytics', 'Reports & Statistics'), icon: BarChart3 },
                { id: 'AUDIT_LOGS', label: t('nav.audit_trail', 'Activity Log'), icon: History },
              ];
            }
            return items;
        })().map((item: any) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  soundEffects.playSnap();
                  setCurrentView(item.id as MainNavView);
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white/10 text-white font-bold border-b-2 border-orange-400'
                    : 'text-slate-200 hover:bg-white/5 hover:text-white font-semibold'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-xs">{item.label}</span>
                {typeof item.badge === 'number' ? (
                   item.badge > 0 && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full animate-pulse">{item.badge}</span>
                ) : item.badge && (
                   <span className="px-1.5 py-0.5 bg-white/20 text-white border border-white/30 text-[9px] font-bold rounded">{item.badge}</span>
                )}
              </button>
            );
        })}
      </nav>

      {/* 4. MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#f4f3ee]">
          {/* VIEW 1: ROLE DASHBOARD (ROLE SPECIFIC VIEWS) */}
          {currentView === 'DASHBOARD' && (
            <>
              {session.role === 'FORENSIC' && (
                <ForensicDashboardView
                  cases={cases}
                  session={session}
                  onOpenCaseDetails={(caseItem) => {
                    soundEffects.playSnap();
                    setSelectedCaseForDetails(caseItem);
                    setIsCaseDetailsOpen(true);
                  }}
                  onOpenUploadReport={(caseId, evidenceId) => {
                    soundEffects.playSnap();
                    setSelectedForensicCaseId(caseId);
                    setSelectedForensicEvidenceId(evidenceId);
                    setIsUploadForensicReportOpen(true);
                  }}
                  onUpdateCase={(updatedCase, action, notes) => {
                    handleUpdateCase(updatedCase, action, notes);
                  }}
                />
              )}

              {session.role === 'LEGAL' && (
                <LegalDashboardView
                  cases={cases}
                  session={session}
                  onOpenCaseDetails={(caseItem) => {
                    soundEffects.playSnap();
                    setSelectedCaseForDetails(caseItem);
                    setIsCaseDetailsOpen(true);
                  }}
                  onOpenAddCourtDoc={(caseId, initialMode) => {
                    soundEffects.playSnap();
                    setSelectedLegalCaseId(caseId);
                    setSelectedLegalModalMode(initialMode || 'ORDER');
                    setIsAddCourtDocumentOpen(true);
                  }}
                />
              )}

              {session.role === 'AUDITOR' && (
                <AuditorDashboardView
                  cases={cases}
                  session={session}
                  onOpenCaseDetails={(caseItem) => {
                    soundEffects.playSnap();
                    setSelectedCaseForDetails(caseItem);
                    setIsCaseDetailsOpen(true);
                  }}
                />
              )}



              {session.role === 'ADMIN' && (
                <AdministrationView
                  session={session}
                  onAuditAction={logAudit}
                  cases={cases}
                  onOpenCaseDetails={(caseItem) => {
                    soundEffects.playSnap();
                    setSelectedCaseForDetails(caseItem);
                    setIsCaseDetailsOpen(true);
                  }}
                  onReassignIO={(caseItem) => {
                    soundEffects.playSnap();
                    setCaseForReassignIO(caseItem);
                    setIsReassignIOModalOpen(true);
                  }}
                />
              )}

              {session.role === 'POLICE' && (
                <div className="space-y-6">
              {/* Dynamic Header Banner by Role */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase bg-blue-100 text-blue-900 border border-blue-200">
                      {ROLE_PERMISSIONS[session.role]?.roleTitle || 'Police Station'} View
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {session.station}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
                    {t('dashboard.title', 'Police Station Operations, FIR & Evidence Management')}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                    {ROLE_PERMISSIONS[session.role]?.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setCurrentView('CASES_LIST');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer transition-colors"
                  >
                    {t('dashboard.view_all', 'View All Cases')}
                  </button>
                  {canCreateCase(session) && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playSnap();
                        setIsNewCaseWizardOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('dashboard.register_fir', 'Register FIR')}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* OFFICER / INVESTIGATOR: Assigned Cases Dashboard */}
              {(session.rank === 'OFFICER' || (session.role as string) === 'OFFICER' || (session.role as string) === 'Investigator') ? (
                <div className="space-y-4">
                  {/* Officer Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                    {(() => {
                      const myCases = cases.filter(c => (c.caseAssignments || []).some(a => a.userId === session.badgeNo && a.status === 'Active'));
                      const myEvidence = myCases.reduce((a, c) => a + (c.evidenceItems || []).filter(e => e.collectedByBadge === session.badgeNo).length, 0);
                      const myFingerprints = myCases.reduce((a, c) => a + (c.fingerprintRecords || []).filter(f => f.collectedByBadge === session.badgeNo).length, 0);
                      return [
                        { label: 'My Active Cases', value: myCases.length, icon: FolderLock, color: 'text-blue-700', bg: 'bg-blue-50/50' },
                        { label: 'My Evidence Items', value: myEvidence, icon: Lock, color: 'text-slate-700', bg: 'bg-slate-50/50' },
                        { label: 'My Fingerprint Records', value: myFingerprints, icon: Fingerprint, color: 'text-emerald-700', bg: 'bg-emerald-50/50' },
                      ].map((stat, idx) => {
                        const Icon = stat.icon;
                        return (
                          <div key={idx} className={`p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1 ${stat.bg}`}>
                            <div className="flex items-center justify-between text-slate-400">
                              <span className="text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* My Assigned Cases List */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                      <UserCheck className="w-4 h-4 text-blue-700" />
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        My Assigned Case Dockets (Need-to-Know Access)
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {cases
                        .filter(c => (c.caseAssignments || []).some(a => a.userId === session.badgeNo && a.status === 'Active'))
                        .map((caseItem) => {
                          const myAssignment = (caseItem.caseAssignments || []).find(a => a.userId === session.badgeNo && a.status === 'Active');
                          return (
                            <div
                              key={caseItem.id}
                              onClick={() => {
                                soundEffects.playSnap();
                                setSelectedCaseForDetails(caseItem);
                                setIsCaseDetailsOpen(true);
                              }}
                              className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 space-y-2"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded">
                                    {caseItem.id}
                                  </span>
                                  <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{caseItem.caseTitle}</h4>
                                </div>
                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                                  caseItem.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                  caseItem.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {caseItem.priority}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold">
                                  {myAssignment?.assignmentRole}
                                </span>
                                <span className="text-slate-400">{CASE_STATUS_LABELS[caseItem.status]}</span>
                              </div>
                              <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-[11px]">
                                <span className="text-slate-500">{caseItem.evidenceItems?.length || 0} Evidence</span>
                                <span className="font-bold text-blue-700 flex items-center gap-1">
                                  Open Docket <ChevronRight className="w-3 h-3" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      {cases.filter(c => (c.caseAssignments || []).some(a => a.userId === session.badgeNo && a.status === 'Active')).length === 0 && (
                        <div className="col-span-2 text-center py-10 text-slate-400 text-xs">
                          <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          No active case assignments found for your badge.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
              {/* Top Operational Metrics Grid — SP/DySP/PI */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {[
                  { label: t('stats.total_cases', 'Total Cases'), value: stats.totalCases, icon: FolderLock, color: 'text-slate-900', bg: 'bg-white' },
                  { label: t('stats.under_investigation', 'Active Cases'), value: stats.activeInvestigations, icon: Activity, color: 'text-blue-700', bg: 'bg-blue-50/50' },
                  { label: t('action.assign_io', 'Pending Officer'), value: stats.pendingIOAssign, icon: UserCheck, color: 'text-amber-700', bg: 'bg-amber-50/50' },
                  { label: t('role.FORENSIC', 'Forensic Lab (FSL)'), value: stats.pendingForensics, icon: Microscope, color: 'text-slate-700', bg: 'bg-slate-50/50' },
                  { label: t('stats.pending_review', 'Pending Reviews'), value: stats.pendingReview, icon: FileCheck, color: 'text-red-700', bg: 'bg-red-50/50' },
                  { label: t('stats.closed_cases', 'Closed Cases'), value: stats.closedCases, icon: ShieldCheck, color: 'text-emerald-700', bg: 'bg-emerald-50/50' },
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className={`p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1 ${stat.bg}`}>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] font-bold uppercase tracking-wider">{stat.label}</span>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className={`text-2xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
                    </div>
                  );
                })}
              </div>

              {/* High Priority & Action Required Cases */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {t('dashboard.priority_cases', 'Priority Cases Requiring Action')}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {filteredCases.filter(c => c.priority === 'CRITICAL' || c.priority === 'HIGH' || !c.officers?.assignedIO).length} {t('dashboard.action_items', 'Action Items')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cases
                    .filter(c => c.priority === 'CRITICAL' || c.priority === 'HIGH' || !c.officers?.assignedIO || c.status === 'Pending Supervisory Review')
                    .slice(0, 6)
                    .map((caseItem) => (
                      <div
                        key={caseItem.id}
                        onClick={() => {
                          soundEffects.playSnap();
                          setSelectedCaseForDetails(caseItem);
                          setIsCaseDetailsOpen(true);
                        }}
                        className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:shadow-xs transition-all cursor-pointer bg-slate-50/50 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded">
                              {caseItem.id}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1">{caseItem.caseTitle}</h4>
                          </div>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                            caseItem.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {caseItem.priority}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t('dashboard.assigned_officer', 'Assigned Officer:')}</span>
                            <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                              {caseItem.officers?.assignedIO || <span className="text-red-600 font-bold">{t('dashboard.unassigned', 'Unassigned (Pending)')}</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">{t('dashboard.status', 'Status:')}</span>
                            <span className="font-medium text-slate-700">{CASE_STATUS_LABELS[caseItem.status]}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">{caseItem.evidenceItems?.length || 0} {t('dashboard.evidences', 'Evidences')}</span>
                          <span className="font-bold text-blue-700 flex items-center gap-1">
                            {t('dashboard.open_case', 'Open Case')} <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              </>
              )}
            </div>
          )}
        </>
      )}

          {/* VIEW 2: CASES LIST & SEARCH */}
          {currentView === 'CASES_LIST' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-700">{t('filter.label', 'Filter:')}</span>
                  
                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 font-semibold text-slate-700"
                  >
                    <option value="ALL">{t('filter.all_statuses', 'All Statuses')} ({cases.length})</option>
                    <option value="FIR Registered">FIR Registered</option>
                    <option value="Under Investigation">Under Investigation</option>
                    <option value="Forensic Examination">Forensic Examination</option>
                    <option value="Pending Supervisory Review">Pending Supervisory Review</option>
                    <option value="Legal Review">Legal Review</option>
                    <option value="Charge-Sheet Submitted">Charge-Sheet Submitted</option>
                    <option value="Evidence Pending">Evidence Pending</option>
                    <option value="Closed">Closed & Disposed</option>
                  </select>

                  {/* Priority Filter */}
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 font-semibold text-slate-700"
                  >
                    <option value="ALL">{t('filter.all_priorities', 'All Priorities')}</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  {/* Station Filter */}
                  <select
                    value={stationFilter}
                    onChange={(e) => setStationFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 font-semibold text-slate-700 max-w-[200px] truncate"
                  >
                    <option value="ALL">{t('filter.all_stations', 'All Stations')}</option>
                    <option value="Dadar">Dadar Police Station</option>
                    <option value="Worli">Worli Police Station</option>
                    <option value="Bandra">Bandra Police Station</option>
                    <option value="Colaba">Colaba Police Station</option>
                    <option value="Andheri">Andheri Police Station</option>
                    <option value="Versova">Versova Police Station</option>
                  </select>
                </div>

                <div className="flex items-center gap-2.5 text-slate-500 font-semibold text-xs">
                  <span className="hidden sm:inline-flex items-center gap-1 text-emerald-800 bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-200 text-[11px] font-mono shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live update at {lastSyncTime}
                  </span>
                  <span>{filteredCases.length} / {cases.length}</span>
                </div>
              </div>

              {/* Cases Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">{t('table.case_id', 'Case ID / FIR')}</th>
                        <th className="py-3 px-4">{t('table.title_class', 'Title & Classification')}</th>
                        <th className="py-3 px-4">{t('table.station_io', 'Station & Assigned IO')}</th>
                        <th className="py-3 px-4 text-center">{t('table.priority', 'Priority')}</th>
                        <th className="py-3 px-4 text-center">{t('table.status', 'Status')}</th>
                        <th className="py-3 px-4 text-center">{t('table.evidence', 'Evidence')}</th>
                        <th className="py-3 px-4 text-right">{t('table.actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCases.map((caseItem) => (
                        <tr
                          key={caseItem.id}
                          className="hover:bg-blue-50/40 transition-colors cursor-pointer"
                          onClick={() => {
                            soundEffects.playSnap();
                            setSelectedCaseForDetails(caseItem);
                            setIsCaseDetailsOpen(true);
                          }}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-blue-900">{caseItem.id}</div>
                            <div className="text-[10px] text-slate-400 font-mono">FIR: {caseItem.firNumber}</div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-bold text-slate-900 truncate">{caseItem.caseTitle}</div>
                            <div className="text-[10px] text-slate-500 truncate">{caseItem.crimeType}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{caseItem.policeStation}</div>
                            <div className="text-[11px] font-semibold text-blue-900 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              {caseItem.officers?.assignedIO ? (
                                <>
                                  <span className="font-bold text-slate-900">{caseItem.officers.assignedIO}</span>
                                  {caseItem.officers?.assignedIOBadge && (
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded font-bold">
                                      {caseItem.officers.assignedIOBadge}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-semibold text-[9px] rounded border border-emerald-200">
                                    Lead IO
                                  </span>
                                </>
                              ) : (
                                <span className="text-red-600 font-bold px-1.5 py-0.5 bg-red-50 rounded border border-red-200 text-[10px]">
                                  {t('table.unassigned', 'Unassigned IO')}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                              caseItem.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                              caseItem.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {caseItem.priority}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${
                              caseItem.status === 'Closed' ? 'bg-emerald-100 text-emerald-800' :
                              caseItem.status === 'Pending Supervisory Review' ? 'bg-slate-100 text-slate-800' :
                              caseItem.status === 'Forensic Examination' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {CASE_STATUS_LABELS[caseItem.status]}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700">
                            {caseItem.evidenceItems?.length || 0}
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {canAssignIO(session, caseItem) && !caseItem.officers?.assignedIO && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCaseForIOAssign(caseItem);
                                    setIsAssignIOModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px] rounded-lg cursor-pointer transition-colors"
                                >
                                  Assign IO
                                </button>
                              )}

                              {session.role === 'ADMIN' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    soundEffects.playSnap();
                                    setCaseForReassignIO(caseItem);
                                    setIsReassignIOModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 font-bold text-[10px] rounded-lg cursor-pointer transition-colors border border-red-200 flex items-center gap-1 shadow-2xs"
                                  title="Change or reassign Investigating Officer"
                                >
                                  <RotateCcw className="w-3 h-3 text-red-600" />
                                  <span>{caseItem.officers?.assignedIO ? 'Change IO' : 'Assign IO'}</span>
                                </button>
                              )}

                              {!canAccessCase(session, caseItem) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    soundEffects.playSnap();
                                    setCaseForAccessRequest(caseItem);
                                    setIsAccessRequestModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-[10px] rounded-lg cursor-pointer transition-colors border border-amber-200 flex items-center gap-1 shadow-2xs"
                                >
                                  <KeyRound className="w-3 h-3 text-amber-700" />
                                  <span>Request Access</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  soundEffects.playSnap();
                                  setSummaryModalCase(caseItem);
                                }}
                                className="px-2.5 py-1 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-[10px] rounded-lg cursor-pointer transition-all flex items-center gap-1 shadow-2xs"
                                title="Generate Live Case Summary Report"
                              >
                                <FileBarChart className="w-3 h-3 text-blue-300" />
                                <span>Summarize</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveCCTNSCaseForModal(caseItem)}
                                className="px-2.5 py-1 bg-blue-50 text-blue-800 hover:bg-blue-100 font-bold text-[10px] rounded-lg cursor-pointer transition-colors flex items-center gap-1 border border-blue-200"
                              >
                                <FileText className="w-3 h-3" />
                                <span>{t('table.cctns', 'CCTNS Forms')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  soundEffects.playSnap();
                                  setSelectedCaseForDetails(caseItem);
                                  setIsCaseDetailsOpen(true);
                                }}
                                className="px-3 py-1 bg-white border border-slate-200 hover:border-blue-400 text-slate-700 hover:text-blue-700 font-bold rounded shadow-2xs text-[10px] cursor-pointer transition-all"
                              >
                                {t('table.view', 'View')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: IDENTITY & CASE LINK (POLICE DASHBOARD ONLY) */}
          {currentView === 'IDENTITY_SEARCH' && session.role === 'POLICE' && (
            <IdentitySearchPanel
              session={session}
              cases={cases}
              onOpenCase={(caseItem) => {
                soundEffects.playSnap();
                setSelectedCaseForDetails(caseItem);
                setIsCaseDetailsOpen(true);
              }}
            />
          )}


          {/* VIEW: POLICE LAW ASSISTANT (BNS/BNSS/BSA RAG) */}
          {currentView === 'LAW_ASSISTANT' && (
            <PoliceLawAssistantView
              initialQuery={lawAssistantQuery}
              onApplyToCase={(sections, summary) => {
                if (selectedCaseForDetails) {
                  const updatedIpc = Array.from(new Set([...(selectedCaseForDetails.ipcSections || []), ...sections]));
                  const updatedSummary = `${selectedCaseForDetails.summaryNotes || ''}\n\n[Legal Advisory]: ${summary}`.trim();
                  handleUpdateCase({
                    ...selectedCaseForDetails,
                    ipcSections: updatedIpc,
                    summaryNotes: updatedSummary,
                  });
                  alert(`Successfully appended statutory sections (${sections.join(', ')}) to Case ${selectedCaseForDetails.firNumber}`);
                }
              }}
            />
          )}

          {currentView === 'IDENTITY_SEARCH' && (
            <div className="p-8 text-center text-slate-500">
              Identity Search Module Unavailable.
            </div>
            /*
            <FaceSearchProvider>
              <FaceSearchDashboard />
            </FaceSearchProvider>
            */
          )}

          {/* VIEW 4: CRIME STATS & ANALYTICS */}
          {currentView === 'REPORTS_ANALYTICS' && (
            <ReportsAnalyticsView session={session} />
          )}

          {/* VIEW 5: STATUTORY AUDIT LEDGER */}
          {currentView === 'AUDIT_LOGS' && (
            <AuditLedgerView auditLogs={auditLogs} session={session} />
          )}

          {/* VIEW 6: USER & ACCESS ADMINISTRATION */}
          {currentView === 'ADMINISTRATION' && (
            <AdministrationView
              session={session}
              onAuditAction={logAudit}
              cases={cases}
              onOpenCaseDetails={(caseItem) => {
                soundEffects.playSnap();
                setSelectedCaseForDetails(caseItem);
                setIsCaseDetailsOpen(true);
              }}
              onReassignIO={(caseItem) => {
                soundEffects.playSnap();
                setCaseForReassignIO(caseItem);
                setIsReassignIOModalOpen(true);
              }}
            />
          )}

          {/* VIEW 7: MEMBER MANAGEMENT */}
          {currentView === 'MEMBERS' && (
            <MemberManagementView
              session={session}
              onAuditAction={logAudit}
            />
          )}

          {/* VIEW 8: ACCESS REQUEST APPROVAL */}
          {currentView === 'ACCESS_REQUESTS' && (
            <AccessRequestApprovalPanel
              cases={cases}
              session={session}
              onUpdateCases={handleUpdateCases}
            />
          )}

          {/* VIEW 9: BLOCKCHAIN AUDIT LEDGER */}
          {currentView === 'BLOCKCHAIN_LEDGER' && (
            <BlockchainLedgerViewer refreshTrigger={blockchainRefreshTrigger} />
          )}

          {/* VIEW 10: CYBERSECURITY OPERATIONS CENTER */}
          {currentView === 'CYBER_SECURITY' && (
            <SecurityCenterView session={session} />
          )}
        </main>

      {/* ================= MODALS ================= */}

      {/* 1. CASE DETAILS MODAL */}
      <CaseDetailsModal
        caseItem={selectedCaseForDetails}
        isOpen={isCaseDetailsOpen}
        onClose={() => {
          setIsCaseDetailsOpen(false);
          setSelectedCaseForDetails(null);
        }}
        session={session}
        onUpdateCase={handleUpdateCase}
      />

      {/* 2. ASSIGN IO MODAL */}
      {caseForIOAssign && (
        <AssignIOModal
          isOpen={isAssignIOModalOpen}
          onClose={() => {
            setIsAssignIOModalOpen(false);
            setCaseForIOAssign(null);
          }}
          caseItem={caseForIOAssign}
          session={session}
          onAssignSuccess={(officer, memo) => {
            const updatedCase: CaseFile = {
              ...caseForIOAssign,
              status: 'Investigation Ongoing',
              officers: {
                ...caseForIOAssign.officers,
                assignedIO: `${officer.name} (${officer.rank})`,
                assignedIOBadge: officer.badgeNo
              },
              timeline: [
                {
                  id: `TL-${Date.now()}`,
                  date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
                  title: 'Lead Investigating Officer Assigned',
                  description: `Assigned to ${officer.name} (${officer.badgeNo}). Note: ${memo}`,
                  officer: session.officerName,
                  badge: session.badgeNo,
                  type: 'IO_ASSIGNED'
                },
                ...(caseForIOAssign.timeline || [])
              ]
            };
            handleUpdateCase(updatedCase, 'ASSIGNED_IO', `Designated IO: ${officer.name}`);
            setSelectedCaseForDetails(updatedCase);
            setIsCaseDetailsOpen(true);
          }}
        />
      )}

      {/* 2b. REQUEST CASE ACCESS MODAL */}
      {caseForAccessRequest && (
        <RequestCaseAccessModal
          isOpen={isAccessRequestModalOpen}
          onClose={() => {
            setIsAccessRequestModalOpen(false);
            setCaseForAccessRequest(null);
          }}
          caseItem={caseForAccessRequest}
          session={session}
          onRequestSubmitted={() => {
            fetchAllData();
            setBlockchainRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {/* 2c. REASSIGN IO MODAL (ADMIN) */}
      {caseForReassignIO && (
        <ReassignIOModal
          isOpen={isReassignIOModalOpen}
          onClose={() => {
            setIsReassignIOModalOpen(false);
            setCaseForReassignIO(null);
          }}
          caseItem={caseForReassignIO}
          session={session}
          onReassignSuccess={(newOfficer, reason) => {
            setCases(prev => prev.map(c => {
              if (c.id === caseForReassignIO?.id) {
                return {
                  ...c,
                  officers: {
                    ...c.officers,
                    assignedIO: newOfficer.name,
                    assignedIOBadge: newOfficer.badgeNo,
                  },
                  investigating_officer_id: newOfficer.badgeNo,
                  assigned_io: newOfficer.name,
                  assigned_io_badge: newOfficer.badgeNo,
                };
              }
              return c;
            }));
            fetchAllData();
            setBlockchainRefreshTrigger(prev => prev + 1);
            showToast(`Case assigned to ${newOfficer.name} (${newOfficer.badgeNo}).`);
          }}
        />
      )}

      {/* 3. NEW CASE WIZARD MODAL (5-step) */}
      {isNewCaseWizardOpen && (
        <NewCaseModal
          session={session}
          existingCases={cases}
          onCreateCase={(newCase) => {
            handleNewCaseCreated(newCase);
            setIsNewCaseWizardOpen(false);
            showToast(`Case ${newCase.id} filed.`);
            setSelectedCaseForDetails(newCase);
            setIsCaseDetailsOpen(true);
          }}
          onClose={() => setIsNewCaseWizardOpen(false)}
        />
      )}

      {/* 3b. LEGACY REGISTER FIR MODAL (kept as fallback, can be removed) */}
      {isCreateCaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Register New FIR Docket (Sec 154 Cr.P.C.)</h3>
                  <p className="text-[11px] text-slate-500">Initiate station-level police docket and assign Investigating Officer.</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsCreateCaseOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateCaseSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">FIR Number</label>
                  <input
                    type="text"
                    value={newFirNumber}
                    onChange={(e) => setNewFirNumber(e.target.value)}
                    placeholder="e.g. FIR-AND-2026-0042"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Crime Classification</label>
                  <select
                    value={newCrimeType}
                    onChange={(e) => setNewCrimeType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  >
                    <option value="Cyber Crime & Financial Fraud">Cyber Crime & Financial Fraud</option>
                    <option value="Homicide / Violent Crime">Homicide / Violent Crime</option>
                    <option value="Narcotics & Contraband">Narcotics & Contraband</option>
                    <option value="Armed Robbery / Extortion">Armed Robbery / Extortion</option>
                    <option value="Property Theft & Burglary">Property Theft & Burglary</option>
                    <option value="Special Statutes & NDPS">Special Statutes & NDPS</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">Case Title / Incident Heading</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Investigation into Offshore Cryptocurrency Laundering Ring"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Incident Date</label>
                  <input
                    type="date"
                    value={newIncidentDate}
                    onChange={(e) => setNewIncidentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Incident Time</label>
                  <input
                    type="text"
                    value={newIncidentTime}
                    onChange={(e) => setNewIncidentTime(e.target.value)}
                    placeholder="14:30 IST"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Priority Level</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  >
                    <option value="CRITICAL">Critical (SP Notified)</option>
                    <option value="HIGH">High Priority</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="LOW">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">Place of Occurrence / Seizure Spot</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g. Andheri East Commercial Complex, Mumbai"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">Applied Acts & Sections</label>
                <input
                  type="text"
                  value={newIpcSections}
                  onChange={(e) => setNewIpcSections(e.target.value)}
                  placeholder="Sec 420 IPC, Sec 66C IT Act, Sec 154 CrPC"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Complainant Particulars</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newComplainantName}
                    onChange={(e) => setNewComplainantName(e.target.value)}
                    placeholder="Complainant Full Name"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    value={newComplainantContact}
                    onChange={(e) => setNewComplainantContact(e.target.value)}
                    placeholder="Contact Number (+91...)"
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">FIR Statement / Narrative Summary</label>
                <textarea
                  rows={3}
                  value={newSummaryNotes}
                  onChange={(e) => setNewSummaryNotes(e.target.value)}
                  placeholder="Enter initial complainant statement and scene observation notes..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreateCaseOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 bg-[#182f4d] hover:bg-[#11233b] text-white font-bold rounded-lg cursor-pointer shadow-xs">Generate Case ID & Assign IO</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 4. CCTNS FORMS MODAL */}
      {activeCCTNSCaseForModal && (
        <CCTNSFormsModal
          caseFile={activeCCTNSCaseForModal}
          session={session}
          onClose={() => setActiveCCTNSCaseForModal(null)}
          onSignChargesheet={(caseId) => {
            showToast(`Ed25519 e-Signature applied on Case ${caseId}. Synced with CCTNS.`);
          }}
        />
      )}

      {/* 5. SPECIAL INVESTIGATION MODAL */}
      {activeSpecialCaseForModal && (
        <SpecialInvestigationPanel
          caseFile={activeSpecialCaseForModal}
          session={session}
          onClose={() => setActiveSpecialCaseForModal(null)}
          onUpdateBankNotice={(noticeId, newStatus) => {
            showToast(`Bank Notice ${noticeId} updated to ${newStatus}.`);
          }}
        />
      )}

      {/* 6. UPLOAD FORENSIC REPORT MODAL */}
      {isUploadForensicReportOpen && (
        <UploadForensicReportModal
          isOpen={isUploadForensicReportOpen}
          onClose={() => {
            setIsUploadForensicReportOpen(false);
            setSelectedForensicCaseId(undefined);
            setSelectedForensicEvidenceId(undefined);
          }}
          cases={cases}
          session={session}
          preselectedCaseId={selectedForensicCaseId}
          preselectedEvidenceId={selectedForensicEvidenceId}
          onSaveReport={(updatedCase, reportTitle) => {
            handleUpdateCase(updatedCase, 'FORENSIC_REPORT_SUBMITTED', `Filed scientific report: ${reportTitle}`);
            setIsUploadForensicReportOpen(false);
            setSelectedForensicCaseId(undefined);
            setSelectedForensicEvidenceId(undefined);
            showToast(`Forensic Report '${reportTitle}' anchored to Case ${updatedCase.id}.`);
          }}
        />
      )}

      {/* 8. LIVE CASE SUMMARY REPORT MODAL */}
      {summaryModalCase && (
        <LiveCaseSummaryModal
          caseItem={summaryModalCase}
          isOpen={Boolean(summaryModalCase)}
          onClose={() => setSummaryModalCase(null)}
          session={session}
        />
      )}

      {/* 7. ADD COURT DOCUMENT MODAL */}
      {isAddCourtDocumentOpen && (
        <AddCourtDocumentModal
          isOpen={isAddCourtDocumentOpen}
          onClose={() => {
            setIsAddCourtDocumentOpen(false);
            setSelectedLegalCaseId(undefined);
          }}
          cases={cases}
          session={session}
          preselectedCaseId={selectedLegalCaseId}
          initialMode={selectedLegalModalMode}
          onSaveCourtDocument={(updatedCase, docTitle) => {
            handleUpdateCase(updatedCase, 'COURT_DOCUMENT_ATTACHED', `Filed judicial record: ${docTitle}`);
            setIsAddCourtDocumentOpen(false);
            setSelectedLegalCaseId(undefined);
            showToast(`Court Record '${docTitle}' anchored to Case ${updatedCase.id}.`);
          }}
        />
      )}
    </div>
  );
};
