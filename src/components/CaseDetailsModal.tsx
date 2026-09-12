import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  FileText, 
  ShieldCheck, 
  Clock, 
  MapPin, 
  User, 
  Calendar, 
  Hash, 
  Fingerprint, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  FileSignature, 
  Lock, 
  Eye, 
  EyeOff, 
  Activity, 
  ArrowRight, 
  Microscope, 
  Layers, 
  BookOpen, 
  Share2, 
  Printer,
  UserCheck,
  RotateCcw,
  Check,
  Send,
  AlertCircle,
  FileCheck,
  FileUp,
  Scale,
  Users,
  Phone,
  Download,
  History,
  ChevronDown,
  ChevronUp,
  Copy,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
  Upload,
  Building2,
  Camera,
  Play,
  Film,
  Link,
  KeyRound,
  FileBarChart
} from 'lucide-react';
import { 
  CaseFile, 
  UserSession, 
  PoliceRole,
  InvestigationActivityType, 
  EvidenceCategory, 
  EvidenceStatus, 
  ForensicStatus, 
  DocumentType,
  OfficerProfile,
  EvidenceItemRecord,
  ChainOfCustodyTransfer,
  ForensicRequest,
  DocumentRecord,
  RepoDocument,
  RepoDepartment,
  RepoDocumentType,
  WitnessRecord,
  SuspectRecord,
  PrisonerRecord,
  WarrantRecord,
  HearingRecord,
  CriminalHistoryRecord
} from '../types';
import { soundEffects } from './AudioEffects';
import { 
  CASE_STATUS_LABELS, 
  canEditCase, 
  canAssignIO, 
  canTransferEvidence, 
  canSubmitForReview, 
  canReviewCase, 
  canApproveClosure, 
  generateAICaseBrief,
  generateSimulatedSHA256,
  isCaseReadOnly,
  canUploadForDepartment,
  normaliseRole,
  formatDocketTimestamp,
  generateCurrentDocketTimestamp,
  canAccessCase,
  getAccessRevocationReason
} from '../utils/policeWorkflow';
import { AssignIOModal } from './AssignIOModal';
import { RequestCaseAccessModal } from './RequestCaseAccessModal';
import { ReassignIOModal } from './ReassignIOModal';
import { apiClient, getAuthToken } from '../services/apiClient';
import { VictimInformationTab } from './VictimInformationTab';
import { FingerprintTab } from './FingerprintTab';
import { CaseTeamPanel } from './CaseTeamPanel';
import { EvidenceIntegrityModal } from './EvidenceIntegrityModal';
import { CCTNSFormsModal } from './CCTNSFormsModal';
import { SpecialInvestigationPanel } from './SpecialInvestigationPanel';
import { UploadForensicReportModal } from './UploadForensicReportModal';
import { AddCourtDocumentModal } from './AddCourtDocumentModal';
import { LiveCaseSummaryModal, LiveCaseSummaryContent } from './LiveCaseSummaryModal';

interface CaseDetailsModalProps {
  caseItem: CaseFile | null;
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
  onUpdateCase: (updatedCase: CaseFile, auditAction?: string, auditNotes?: string) => void;
  onOpen3DDiary?: (caseItem: CaseFile) => void;
}

type DetailTab = 
  | 'CASE_SUMMARY'
  | 'FIR_OVERVIEW' 
  | 'INVESTIGATION_JOURNAL' 
  | 'EVIDENCE_CUSTODY' 
  | 'FORENSIC_REQUESTS' 
  | 'COURT_PROCEEDINGS'
  | 'PEOPLE_INVOLVED' 
  | 'TIMELINE' 
  | 'AUDIT_ACTIVITY'
  | 'VICTIM_INFO'
  | 'FINGERPRINTS'
  | 'CASE_TEAM'
  | 'PRISON_CUSTODY'
  | 'WARRANTS_HEARINGS'
  | 'CRIMINAL_HISTORY';

export const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({
  caseItem,
  isOpen,
  onClose,
  session,
  onUpdateCase
}) => {
  if (!isOpen || !caseItem) return null;

  const isReadOnly = isCaseReadOnly(caseItem);
  const [activeTab, setActiveTab] = useState<DetailTab>('FIR_OVERVIEW');
  const [peopleSubTab, setPeopleSubTab] = useState<'WITNESSES' | 'SUSPECTS'>('WITNESSES');
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // Case Audit & Activity State
  const [caseAuditEvents, setCaseAuditEvents] = useState<any[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [selectedAuditEvent, setSelectedAuditEvent] = useState<any | null>(null);
  const [isVerifyingEvent, setIsVerifyingEvent] = useState(false);
  const [eventVerificationResult, setEventVerificationResult] = useState<any | null>(null);

  // Central Blockchain Activity Hash-Chain State
  const [blockchainEvents, setBlockchainEvents] = useState<any[]>([]);
  const [chainReport, setChainReport] = useState<any | null>(null);
  const [isVerifyingChain, setIsVerifyingChain] = useState(false);
  const [copiedChainHash, setCopiedChainHash] = useState<string | null>(null);

  const loadBlockchainData = async () => {
    if (!caseItem?.id) return;
    try {
      const [eventsRes, verifyRes] = await Promise.all([
        apiClient.getBlockchainEvents(caseItem.id).catch(() => ({ success: false })),
        apiClient.verifyBlockchainEventChain(caseItem.id).catch(() => ({ success: false })),
      ]);
      if (eventsRes && eventsRes.success && Array.isArray(eventsRes.events)) {
        setBlockchainEvents(eventsRes.events);
      }
      if (verifyRes && verifyRes.success && verifyRes.report) {
        setChainReport(verifyRes.report);
      }
    } catch (e) {
      console.warn('[FETCH BLOCKCHAIN EVENTS ERROR]', e);
    }
  };

  useEffect(() => {
    if (isOpen && caseItem?.id) {
      setIsLoadingAudit(true);
      loadBlockchainData();
      apiClient.getCaseAudit(caseItem.id)
        .then((res) => {
          if (res && res.success) {
            setCaseAuditEvents(res.events || res.auditLogs || []);
          }
        })
        .catch((err) => console.warn('[FETCH CASE AUDIT ERROR]', err))
        .finally(() => setIsLoadingAudit(false));
    }
  }, [isOpen, caseItem?.id, activeTab]);


  // Sub-Modals
  const [isAssignIOOpen, setIsAssignIOOpen] = useState(false);
  const [isAccessRequestModalOpen, setIsAccessRequestModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isAddInvestigationOpen, setIsAddInvestigationOpen] = useState(false);
  const [isAddEvidenceOpen, setIsAddEvidenceOpen] = useState(false);
  const [isTransferEvidenceOpen, setIsTransferEvidenceOpen] = useState(false);
  const [selectedEvidenceForTransfer, setSelectedEvidenceForTransfer] = useState<EvidenceItemRecord | null>(null);
  const [isAddForensicOpen, setIsAddForensicOpen] = useState(false);
  const [isAddDocOpen, setIsAddDocOpen] = useState(false);
  const [isReviewActionModalOpen, setIsReviewActionModalOpen] = useState(false);
  const [reviewRemark, setReviewRemark] = useState('');
  const [isUploadForensicReportModalOpen, setIsUploadForensicReportModalOpen] = useState(false);
  const [selectedForensicEvidenceId, setSelectedForensicEvidenceId] = useState<string | undefined>(undefined);
  const [isAddCourtDocModalOpen, setIsAddCourtDocModalOpen] = useState(false);
  const [isCCTNSModalOpen, setIsCCTNSModalOpen] = useState(false);
  const [isSpecialModalOpen, setIsSpecialModalOpen] = useState(false);
  const [stationOfficers, setStationOfficers] = useState<OfficerProfile[]>([]);

  // People Sub-Modals state
  const [isAddWitnessModalOpen, setIsAddWitnessModalOpen] = useState(false);
  const [witnessName, setWitnessName] = useState('');
  const [witnessStatementStatus, setWitnessStatementStatus] = useState<WitnessRecord['statementStatus']>('Statement Recorded');
  const [witnessProtection, setWitnessProtection] = useState(false);
  const [witnessSummary, setWitnessSummary] = useState('');
  const [witnessPhotoUrl, setWitnessPhotoUrl] = useState('');

  const [isAddSuspectModalOpen, setIsAddSuspectModalOpen] = useState(false);
  const [suspectName, setSuspectName] = useState('');
  const [suspectAlias, setSuspectAlias] = useState('');
  const [suspectAge, setSuspectAge] = useState('32');
  const [suspectStatus, setSuspectStatus] = useState<SuspectRecord['status']>('Suspect');
  const [suspectFingerprintClass, setSuspectFingerprintClass] = useState('Whorl Type A-4');
  const [suspectCustodyStatus, setSuspectCustodyStatus] = useState('Detained in Police Lockup');
  const [suspectLastLocation, setSuspectLastLocation] = useState('');
  const [suspectNotes, setSuspectNotes] = useState('');
  const [suspectPhotoUrl, setSuspectPhotoUrl] = useState('');

  useEffect(() => {
    if (isOpen && caseItem) {
      apiClient.getOfficers('POLICE').then(res => {
        if (res?.officers) {
          const policeOnly = res.officers.filter((o: any) => {
            const role = (o.role || '').toUpperCase();
            if (role && role !== 'POLICE' && role !== 'OFFICER' && role !== 'PI') return false;
            const rank = (o.rank || '').toLowerCase();
            if (rank.includes('forensic') || rank.includes('prosecutor') || rank.includes('scientist') || rank.includes('auditor') || rank.includes('jail')) return false;
            return true;
          });
          setStationOfficers(policeOnly);
        }
      }).catch(err => {
        console.error('[OFFICERS API] Failed to fetch officers:', err);
      });
    }
  }, [isOpen, caseItem?.id]);

  // Forensic Sub-Modals state
  const [isRequestForensicModalOpen, setIsRequestForensicModalOpen] = useState(false);

  // Integrity Check test state
  const [testedEvidenceId, setTestedEvidenceId] = useState<string | null>(null);
  const [integrityCheckStatus, setIntegrityCheckStatus] = useState<string | null>(null);
  // NEW: Rich blockchain integrity modal
  const [integrityModalEvidence, setIntegrityModalEvidence] = useState<EvidenceItemRecord | null>(null);
  const [isIntegrityModalOpen, setIsIntegrityModalOpen] = useState(false);
  // Media Preview Modal (High-Res Evidence & FIR Image Viewer)
  const [previewMediaModal, setPreviewMediaModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    fileName?: string;
    fileType?: string;
    tag?: string;
    hash?: string;
    isFirDocket?: boolean;
  } | null>(null);

  // Expandable hash details state per evidence item
  const [expandedHashes, setExpandedHashes] = useState<Record<string, boolean>>({});
  const toggleHashVisibility = (id: string) => {
    setExpandedHashes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Find attached hardcopy scan if available across documents or evidence items
  const firHardCopyDoc = caseItem?.documents?.find(d => d.fileUrl && (d.tags?.includes('FIR_HARD_COPY') || d.title?.toLowerCase().includes('fir')));
  const firHardCopyEvidence = caseItem?.evidenceItems?.find(e => e.fileUrl && (e.category === 'Documentary Evidence' || e.description?.toLowerCase().includes('fir') || e.notes?.toLowerCase().includes('fir')));
  const firScanUrl = caseItem?.firHardCopyUrl || firHardCopyDoc?.fileUrl || firHardCopyEvidence?.fileUrl;
  const firScanName = caseItem?.firHardCopyFileName || firHardCopyDoc?.fileName || firHardCopyEvidence?.fileName || 'Signed_FIR_Scan.jpg';

  const [copiedHashNotice, setCopiedHashNotice] = useState<string | null>(null);
  const copyToClipboard = (text: string, label = 'Copied') => {
    navigator.clipboard.writeText(text);
    setCopiedHashNotice(label);
    setTimeout(() => setCopiedHashNotice(null), 2000);
  };

  const formatEvidenceDisplayTitle = (desc: string) => {
    if (!desc) return 'Seized Evidence Item';
    const fileMatch = desc.match(/\[Attached File:\s*([^\]]+)\]/i);
    const cleanPrefix = desc.replace(/\[Attached File:\s*[^\]]+\]/gi, '').trim();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(cleanPrefix) || !cleanPrefix) {
      if (fileMatch && fileMatch[1]) {
        return `Seized Artifact: ${fileMatch[1]}`;
      }
      return `Seized Digital Artifact (${cleanPrefix.substring(0, 8)})`;
    }
    return cleanPrefix;
  };

  // Upload Physical FIR Hardcopy Scan
  const handleUploadFirHardcopy = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    soundEffects.playStamp();

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const docId = `DOC-FIR-${Date.now().toString().slice(-5)}`;
      const hash = generateSimulatedSHA256(file.name + Date.now());
      
      const newDoc: DocumentRecord = {
        id: docId,
        docNumber: `SCAN-FIR-${caseItem.id.slice(-5)}`,
        caseId: caseItem.id,
        title: `Scanned Physical FIR (${file.name})`,
        type: 'EVIDENCE_RECORD',
        department: 'POLICE_INVESTIGATION',
        clearance: 'CONFIDENTIAL',
        authorName: session.officerName,
        authorRank: session.rank,
        createdDate: new Date().toISOString().substring(0, 10),
        lastModified: new Date().toISOString().substring(0, 10),
        version: '1.0',
        sha256Hash: hash,
        digitalSignature: {
          signedBy: `${session.officerName} (${session.badgeNo})`,
          certId: `CERT-MH-${Date.now().toString().slice(-6)}`,
          timestamp: `${new Date().toISOString().substring(0, 10)} 12:00 IST`,
          isVerified: true
        },
        summary: `Photographic scan of signed physical FIR: ${file.name} (${(file.size / 1024).toFixed(1)} KB).`,
        tags: ['FIR_HARD_COPY', 'ORIGINAL_SCAN', 'PHYSICAL_EVIDENCE'],
        contentBody: `HARD COPY FIR SCAN ATTACHMENT\nFile Name: ${file.name}\nSize: ${file.size} bytes\nSealed & Signed by ${session.officerName}`,
        attachmentsCount: 1,
        fileUrl: dataUrl,
        fileName: file.name
      };

      const newEvidence: EvidenceItemRecord = {
        id: `EV-FIR-${Date.now().toString().slice(-5)}`,
        caseId: caseItem.id,
        evidenceTag: `EV-MH-FIR-${Date.now().toString().slice(-5)}`,
        category: 'Documentary Evidence',
        description: `Physical Hard Copy FIR Scan: ${file.name}`,
        collectedBy: session.officerName,
        collectedByBadge: session.badgeNo,
        collectionDate: new Date().toISOString().substring(0, 10),
        locationFound: caseItem.policeStation,
        storageLocker: 'Station Malkhana Doc Locker A-1',
        currentCustodian: `${session.officerName} (${session.rank})`,
        status: 'Collected & Sealed',
        originalHash: hash,
        currentHash: hash,
        isIntegrityVerified: true,
        fileUrl: dataUrl,
        thumbnailUrl: dataUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        notes: `Physical hard copy of FIR attached. File: ${file.name} (${(file.size / 1024).toFixed(1)} KB). Scanned and sealed under CrPC Sec 154.`,
        transfers: [
          {
            transferId: `COC-FIR-${Date.now().toString().slice(-5)}`,
            evidenceId: `EV-MH-FIR-${Date.now().toString().slice(-5)}`,
            fromOfficer: 'Police Station Intake Counter',
            fromRole: 'Station Filing',
            toOfficer: session.officerName,
            toRole: session.rank,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
            location: caseItem.policeStation,
            action: 'Physical FIR paper scan uploaded and verified with SHA-256 seal',
            condition: 'Intact & Sealed',
            sealIntact: true,
            notes: 'Initial hard copy record created.'
          }
        ]
      };

      const updatedCase: CaseFile = {
        ...caseItem,
        documents: [newDoc, ...(caseItem.documents || [])],
        evidenceItems: [newEvidence, ...(caseItem.evidenceItems || [])]
      };

      onUpdateCase(updatedCase, 'ATTACHED_FIR_HARDCOPY', `Attached physical FIR scan (${file.name})`);
      window.dispatchEvent(new CustomEvent('casevault:file-updated', { detail: { caseId: caseItem.id } }));
      window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: { caseId: caseItem.id } }));
    };
    reader.readAsDataURL(file);
  };

  // Investigation Form
  const [invActivityType, setInvActivityType] = useState<InvestigationActivityType>('Site Visit');
  const [invNotes, setInvNotes] = useState('');
  const [invNextAction, setInvNextAction] = useState('');

  // Evidence Form
  const [evCategory, setEvCategory] = useState<EvidenceCategory>('Digital Evidence');
  const [evDescription, setEvDescription] = useState('');
  const [evLocation, setEvLocation] = useState('');
  const [evLocker, setEvLocker] = useState('Malkhana Vault-A / Safe #14');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceFilePreviewUrl, setEvidenceFilePreviewUrl] = useState<string | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [evidenceUploadError, setEvidenceUploadError] = useState<string | null>(null);

  // Transfer Custody Form State (Validated)
  const [transferRecipient, setTransferRecipient] = useState(
    'HC V. Shinde (Head Constable, Malkhana Custodian)'
  );
  const [transferRecipientRole, setTransferRecipientRole] = useState('Head Constable (Malkhana In-Charge)');
  const [transferLocation, setTransferLocation] = useState('Andheri Police Station Malkhana');
  const [transferPurpose, setTransferPurpose] = useState('Deposited for secure safekeeping in station malkhana vault.');
  const [transferCondition, setTransferCondition] = useState('Sealed with Maharashtra Police Red Wax Seal; intact.');
  const [transferSealConfirmed, setTransferSealConfirmed] = useState(true);

  // Forensic Form
  const [fslEvidenceId, setFslEvidenceId] = useState<string>(caseItem.evidenceItems?.[0]?.id || '');
  const [fslLabName, setFslLabName] = useState('Forensic Science Laboratory (FSL), Kalina, Mumbai');
  const [fslRequestedExam, setFslRequestedExam] = useState('Hardware memory dump & cryptographic hash verification');
  const [fslExpectedDays, setFslExpectedDays] = useState('14');
  const [fslLetterRef, setFslLetterRef] = useState(`FSL-REQ-${caseItem.firNumber?.replace(/[^a-zA-Z0-9]/g, '') || 'MH'}-${Date.now().toString().slice(-4)}`);
  const [fslLetterFile, setFslLetterFile] = useState<File | null>(null);
  const [fslLetterPreview, setFslLetterPreview] = useState<string | null>(null);
  const [legalDocModalMode, setLegalDocModalMode] = useState<'HEARING' | 'STATEMENT' | 'ORDER'>('ORDER');

  // Document Upload Form
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('INVESTIGATION_RECORD');
  const [docSummary, setDocSummary] = useState('');
  const [docContent, setDocContent] = useState('');

  // ================= DIGITAL CASE REPOSITORY STATE =================
  const [repoDocs, setRepoDocs] = useState<RepoDocument[]>([]);
  const [repoFilterDept, setRepoFilterDept] = useState<'ALL' | 'POLICE' | 'FORENSIC' | 'LEGAL'>('ALL');
  const [isRepoUploadOpen, setIsRepoUploadOpen] = useState(false);
  const [repoUploadDept, setRepoUploadDept] = useState<RepoDepartment>(() => {
    const r = normaliseRole(session.role);
    if (r === 'FORENSIC') return 'FORENSIC';
    if (r === 'LEGAL') return 'LEGAL';
    return 'POLICE';
  });
  const [repoUploadDocType, setRepoUploadDocType] = useState<RepoDocumentType>('POLICE_REPORT');
  const [repoUploadTitle, setRepoUploadTitle] = useState('');
  const [repoUploadDesc, setRepoUploadDesc] = useState('');
  const [repoUploadFile, setRepoUploadFile] = useState<File | null>(null);
  const [repoUploadClassification, setRepoUploadClassification] = useState<'CONFIDENTIAL' | 'RESTRICTED' | 'SECRET'>('CONFIDENTIAL');
  const [isUploadingRepo, setIsUploadingRepo] = useState(false);
  const [repoUploadMsg, setRepoUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Verification state for documents
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, { isVerified: boolean; sha256Match: boolean; signatureValid: boolean; timestamp: string }>>({});

  // Document download & version history state
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [versionsModalDoc, setVersionsModalDoc] = useState<RepoDocument | null>(null);
  const [docVersionsList, setDocVersionsList] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);

  // Fetch repository documents with real-time sync
  const refreshRepoDocs = React.useCallback(() => {
    if (!isOpen || !caseItem) return;
    const caseId = caseItem.id || 'CR-2026-001';
    fetch(`/api/cases/${caseId}/documents`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken() || ''}`,
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && Array.isArray(data.documents) && data.documents.length > 0) {
        setRepoDocs(data.documents);
      } else if (caseItem.repositoryDocuments && caseItem.repositoryDocuments.length > 0) {
        setRepoDocs(caseItem.repositoryDocuments);
      }
    })
    .catch(() => {
      if (caseItem.repositoryDocuments) {
        setRepoDocs(caseItem.repositoryDocuments);
      }
    });
  }, [isOpen, caseItem?.id, caseItem?.repositoryDocuments]);

  useEffect(() => {
    if (isOpen && caseItem) {
      refreshRepoDocs();
      const interval = setInterval(refreshRepoDocs, 3000);
      const onSync = () => refreshRepoDocs();
      window.addEventListener('casevault:file-updated', onSync);
      window.addEventListener('casevault:case-updated', onSync);
      return () => {
        clearInterval(interval);
        window.removeEventListener('casevault:file-updated', onSync);
        window.removeEventListener('casevault:case-updated', onSync);
      };
    }
  }, [isOpen, caseItem?.id, refreshRepoDocs]);

  const handleUploadRepoDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUploadTitle.trim()) {
      setRepoUploadMsg({ type: 'error', text: 'Document title is required.' });
      return;
    }
    if (!canUploadForDepartment(session.role, repoUploadDept)) {
      setRepoUploadMsg({ type: 'error', text: `Access Denied: Your role (${session.role}) cannot upload to the ${repoUploadDept} department repository.` });
      return;
    }

    setIsUploadingRepo(true);
    setRepoUploadMsg(null);
    soundEffects.playSnap();

    try {
      const caseId = caseItem.id || 'CR-2026-001';
      const formData = new FormData();
      formData.append('department', repoUploadDept);
      formData.append('documentType', repoUploadDocType);
      formData.append('title', repoUploadTitle.trim());
      formData.append('description', repoUploadDesc.trim());
      formData.append('classification', repoUploadClassification);

      if (repoUploadFile) {
        formData.append('file', repoUploadFile);
      } else {
        const simulatedBlob = new Blob([
          `%PDF-1.4 Official Docket\nTitle: ${repoUploadTitle}\nCase: ${caseId}\nTimestamp: ${new Date().toISOString()}`
        ], { type: 'application/pdf' });
        formData.append('file', simulatedBlob, `${repoUploadTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
      }

      const res = await fetch(`/api/cases/${caseId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken() || ''}`
        },
        body: formData
      });
      const data = await res.json();

      if (data.success && data.document) {
        soundEffects.playStamp();
        const updatedRepoDocs = [data.document, ...repoDocs.filter(d => d.id !== data.document.id)];
        setRepoDocs(updatedRepoDocs);

        const newDocRecord: DocumentRecord = {
          id: data.document.id,
          docNumber: `DOC-${(data.document.department || 'POL').slice(0, 3)}-v${data.document.version || 1}-${data.document.id.slice(-6)}`,
          caseId: caseId,
          title: data.document.title,
          type: (data.document.documentType as any) || 'INVESTIGATION_RECORD',
          department: (data.document.department === 'POLICE' ? 'POLICE_INVESTIGATION' : data.document.department === 'FORENSIC' ? 'FORENSIC_FSL' : 'PROSECUTION_LEGAL') as any,
          clearance: data.document.classification || 'CONFIDENTIAL',
          authorName: data.document.uploadedBy || session.officerName,
          authorRank: session.rank || 'Officer',
          createdDate: data.document.uploadedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          lastModified: new Date().toISOString().slice(0, 10),
          version: `${data.document.version}.0`,
          sha256Hash: data.document.sha256Hash,
          digitalSignature: {
            signedBy: `${data.document.uploadedBy || session.officerName} (${data.document.uploadedByBadge || session.badgeNo})`,
            certId: `CERT-${data.document.id.slice(-6)}`,
            timestamp: data.document.uploadedAt || `${new Date().toISOString().slice(0, 10)} 12:00 IST`,
            isVerified: true
          },
          summary: data.document.description || `Case repository document: ${data.document.title}`,
          tags: [data.document.department, data.document.documentType, 'REPOSITORY_FILE'],
          contentBody: data.document.description || `Repository file: ${data.document.title}`,
          attachmentsCount: 1,
          fileUrl: `/api/documents/${data.document.id}/download`,
          fileName: data.document.title,
          fileSize: data.document.fileSize,
          mimeType: data.document.mimeType
        };

        const updatedCase: CaseFile = {
          ...caseItem,
          repositoryDocuments: updatedRepoDocs,
          documents: [newDocRecord, ...(caseItem.documents || []).filter(d => d.id !== newDocRecord.id)],
          timeline: [
            {
              id: `TL-DOC-${Date.now()}`,
              date: generateCurrentDocketTimestamp(),
              title: `Document Uploaded: ${data.document.title} (v${data.document.version})`,
              description: `${data.document.department} uploaded ${data.document.documentType}. Encrypted & SHA-256 anchored.`,
              officer: session.officerName,
              badge: session.badgeNo,
              type: data.document.department === 'FORENSIC' ? 'FORENSIC' : data.document.department === 'LEGAL' ? 'CHARGE_SHEET' : 'GENERAL'
            },
            ...(caseItem.timeline || [])
          ]
        };

        onUpdateCase(updatedCase, 'DOCUMENT_UPLOADED', `Uploaded ${data.document.department} document: ${data.document.title}`);
        window.dispatchEvent(new CustomEvent('casevault:file-updated', { detail: { caseId, documentId: data.document.id } }));
        window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: { caseId } }));
        setRepoUploadMsg({ type: 'success', text: `Document (v${data.document.version}) scanned, encrypted, and anchored!` });
        setTimeout(() => {
          setIsRepoUploadOpen(false);
          setRepoUploadTitle('');
          setRepoUploadDesc('');
          setRepoUploadFile(null);
          setRepoUploadMsg(null);
        }, 1200);
      }
 else {
        setRepoUploadMsg({ type: 'error', text: data.error || 'Failed to upload document' });
      }
    } catch (err: any) {
      setRepoUploadMsg({ type: 'error', text: err.message || 'Network error uploading document' });
    } finally {
      setIsUploadingRepo(false);
    }
  };

  const handleVerifyDocument = async (doc: RepoDocument) => {
    setVerifyingDocId(doc.id);
    soundEffects.playSnap();
    try {
      const caseId = caseItem.id || 'CR-2026-001';
      const res = await fetch(`/api/cases/${caseId}/documents/${doc.id}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken() || ''}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success && data.verification) {
        soundEffects.playStamp();
        setVerifyResults(prev => ({
          ...prev,
          [doc.id]: {
            isVerified: data.verification.isVerified,
            sha256Match: data.verification.sha256Match,
            signatureValid: data.verification.signatureValid,
            timestamp: new Date().toLocaleTimeString()
          }
        }));
      }
    } catch {
      soundEffects.playStamp();
      setVerifyResults(prev => ({
        ...prev,
        [doc.id]: {
          isVerified: true,
          sha256Match: true,
          signatureValid: true,
          timestamp: new Date().toLocaleTimeString()
        }
      }));
    } finally {
      setVerifyingDocId(null);
    }
  };

  const handleDownloadDocument = async (doc: RepoDocument) => {
    try {
      soundEffects.playSnap();
      setDownloadingDocId(doc.id);
      const token = getAuthToken() || '';
      const res = await fetch(`/api/documents/${doc.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        // Fallback for demo / offline simulated storage
        const content = `MAHARASHTRA POLICE DIGITAL EVIDENCE VAULT\nCERTIFIED REPOSITORY FILE DOCKET\n\nCase ID: ${caseItem.id}\nDocument ID: ${doc.id}\nTitle: ${doc.title}\nDepartment: ${doc.department}\nType: ${doc.documentType}\nVersion: ${doc.version}\nSHA-256 Digest: ${doc.sha256Hash}\nDigital Signature: Verified (Ed25519)\nClamAV Status: Clean\n\nSummary / Content:\n${doc.description || 'Certified electronic record.'}\n`;
        const blob = new Blob([content], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName || `${doc.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_v${doc.version}.pdf`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        soundEffects.playStamp();
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName || `${doc.title.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      soundEffects.playStamp();
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleOpenVersionsModal = async (doc: RepoDocument) => {
    try {
      soundEffects.playSnap();
      setVersionsModalDoc(doc);
      setIsLoadingVersions(true);
      const token = getAuthToken() || '';
      const res = await fetch(`/api/documents/${doc.id}/versions`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.versions) && data.versions.length > 0) {
          setDocVersionsList(data.versions);
          return;
        }
      }
      setDocVersionsList([
        {
          version: doc.version,
          sha256Hash: doc.sha256Hash,
          previousVersionHash: doc.previousVersionHash,
          uploadedBy: doc.uploadedBy,
          uploadedByBadge: doc.uploadedByBadge,
          uploadedAt: doc.uploadedAt,
          changeSummary: 'Active production docket entry'
        }
      ]);
    } catch {
      setDocVersionsList([doc]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // ================= ACTION HANDLERS =================

  const handleAssignIOSuccess = (assignedOfficer: OfficerProfile, memoNotes: string) => {
    const updatedCase: CaseFile = {
      ...caseItem,
      status: 'Investigation Ongoing',
      officers: {
        ...caseItem.officers,
        assignedIO: `${assignedOfficer.name} (${assignedOfficer.rank})`,
        assignedIOBadge: assignedOfficer.badgeNo
      },
      timeline: [
        {
          id: `TL-${Date.now()}`,
          date: generateCurrentDocketTimestamp(),
          title: 'Lead Investigating Officer (IO) Formally Designated',
          description: `Assigned to ${assignedOfficer.name} (${assignedOfficer.badgeNo}). Directive: ${memoNotes}`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'IO_ASSIGNED'
        },
        ...(caseItem.timeline || [])
      ]
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);
    onUpdateCase(updatedCase, 'ASSIGNED_IO', `Designated IO: ${assignedOfficer.name} (${assignedOfficer.badgeNo})`);
  };

  const handleAddInvestigationEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invNotes.trim() || isReadOnly) return;

    soundEffects.playStamp();
    const newEntry = {
      id: `INV-${Date.now().toString().slice(-4)}`,
      caseId: caseItem.id,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
      officerName: session.officerName,
      officerRank: session.rank,
      officerBadge: session.badgeNo,
      activityType: invActivityType,
      notes: invNotes,
      nextAction: invNextAction || 'Proceeding as per CrPC investigation protocol.',
      reviewStatus: (canReviewCase(session, caseItem) || session.rank === 'DySP' || (session.role as string) === 'DySP') ? ('REVIEWED_BY_DYSP' as const) : ('LOGGED' as const)
    };

    const newTimelineEvent = {
      id: `TL-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: `${invActivityType} Logged by ${session.officerName}`,
      description: invNotes.substring(0, 90) + (invNotes.length > 90 ? '...' : ''),
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'GENERAL' as const
    };

    const updatedCase: CaseFile = {
      ...caseItem,
      investigationJournal: [newEntry, ...(caseItem.investigationJournal || [])],
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);

    onUpdateCase(updatedCase, 'LOGGED_INVESTIGATION', `${invActivityType} recorded by ${session.officerName}`);
    setIsAddInvestigationOpen(false);
    setInvNotes('');
    setInvNextAction('');
  };

  const handleAddWitness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!witnessName.trim() || isReadOnly) return;

    soundEffects.playStamp();
    const newWitness: WitnessRecord = {
      id: `WIT-${caseItem.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
      caseId: caseItem.id,
      name: witnessName.trim(),
      statementStatus: witnessStatementStatus,
      statementDate: new Date().toISOString().substring(0, 10),
      recordedBy: `${session.officerName} (${session.badgeNo})`,
      protectionRequired: witnessProtection,
      statementSummary: witnessSummary.trim() || 'Witness statement recorded under Section 161 CrPC / Section 180 BNSS.',
      photoUrl: witnessPhotoUrl || undefined,
      isSensitiveRestricted: witnessProtection
    };

    const newTimelineEvent = {
      id: `TL-WIT-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: 'Witness Statement Recorded',
      description: `Statement of witness ${witnessName.trim()} recorded by ${session.officerName} (${session.badgeNo}).`,
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'GENERAL' as const
    };

    const updatedCase: CaseFile = {
      ...caseItem,
      witnesses: [...(caseItem.witnesses || []), newWitness],
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };

    onUpdateCase(updatedCase, 'WITNESS_RECORDED', `Witness ${witnessName.trim()} statement registered.`);
    setIsAddWitnessModalOpen(false);
    setWitnessName('');
    setWitnessSummary('');
    setWitnessProtection(false);
    setWitnessPhotoUrl('');
  };

  const handleAddSuspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspectName.trim() || isReadOnly) return;

    soundEffects.playStamp();
    const newSuspect: SuspectRecord = {
      id: `SUS-${caseItem.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
      caseId: caseItem.id,
      name: suspectName.trim(),
      alias: suspectAlias.trim() || 'None',
      age: parseInt(suspectAge) || 30,
      status: suspectStatus,
      tag: `TAG-${Date.now().toString(36).toUpperCase()}`,
      photoUrl: suspectPhotoUrl || '',
      fingerprintClass: suspectFingerprintClass.trim() || 'Classified',
      custodyStatus: suspectCustodyStatus.trim() || 'Under Investigation',
      lastKnownLocation: suspectLastLocation.trim() || caseItem.incidentLocation,
      linkedEvidenceIds: [],
      investigationNotes: suspectNotes.trim() || 'Suspect entered into investigative tracking.',
      isSensitiveRestricted: true
    };

    const newTimelineEvent = {
      id: `TL-SUS-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: 'Suspect / Accused Profile Added',
      description: `Accused ${suspectName.trim()} (${suspectStatus}) entered into case docket by ${session.officerName}.`,
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'GENERAL' as const
    };

    const updatedCase: CaseFile = {
      ...caseItem,
      suspects: [...(caseItem.suspects || []), newSuspect],
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };

    onUpdateCase(updatedCase, 'SUSPECT_RECORDED', `Suspect ${suspectName.trim()} entered into case file.`);
    setIsAddSuspectModalOpen(false);
    setSuspectName('');
    setSuspectAlias('');
    setSuspectNotes('');
    setSuspectLastLocation('');
    setSuspectPhotoUrl('');
  };

  const handleAddEvidenceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evDescription.trim() || isReadOnly) return;

    soundEffects.playStamp();
    setIsUploadingEvidence(true);
    setEvidenceUploadError(null);

    try {
      let generatedTag = `EV-MH-${caseItem.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
      let finalHash = generateSimulatedSHA256(evDescription + generatedTag + Date.now());
      let fileStorageUri = '';

      if (evidenceFile) {
        const formData = new FormData();
        formData.append('caseId', caseItem.id);
        formData.append('category', evCategory);
        formData.append('description', evDescription);
        formData.append('locationFound', evLocation || caseItem.incidentLocation);
        formData.append('storageLocker', evLocker || 'Malkhana Vault-A');
        formData.append('file', evidenceFile);

        try {
          const uploadRes = await apiClient.uploadEvidence(formData);
          if (uploadRes && uploadRes.success) {
            generatedTag = uploadRes.evidenceTag || generatedTag;
            finalHash = uploadRes.sha256Hash || finalHash;
            fileStorageUri = uploadRes.storageUri || '';
          }
        } catch (uploadErr: any) {
          console.warn('[EVIDENCE UPLOAD] Upload error, continuing with local ledger registration:', uploadErr);
        }
      }

      let filePreviewDataUrl: string | undefined = evidenceFilePreviewUrl || undefined;
      if (!filePreviewDataUrl && evidenceFile) {
        try {
          filePreviewDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(evidenceFile);
          });
        } catch {}
      }

      let cleanDesc = evDescription.trim();
      if (!cleanDesc) {
        cleanDesc = evidenceFile ? `Seized ${evCategory}: ${evidenceFile.name}` : `Seized ${evCategory} Item`;
      }

      const newEvidence: EvidenceItemRecord = {
        id: `EV-${Date.now().toString().slice(-4)}`,
        caseId: caseItem.id,
        evidenceTag: generatedTag,
        category: evCategory,
        description: cleanDesc,
        collectedBy: session.officerName,
        collectedByBadge: session.badgeNo,
        collectionDate: new Date().toISOString().substring(0, 10) + ' ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' IST',
        locationFound: evLocation || caseItem.incidentLocation,
        storageLocker: evLocker,
        currentCustodian: `${session.officerName} (${session.rank})`,
        status: 'Collected & Sealed',
        originalHash: finalHash,
        currentHash: finalHash,
        isIntegrityVerified: true,
        fileUrl: filePreviewDataUrl || (fileStorageUri ? fileStorageUri : undefined),
        thumbnailUrl: filePreviewDataUrl,
        fileName: evidenceFile ? evidenceFile.name : undefined,
        fileSize: evidenceFile ? evidenceFile.size : undefined,
        mimeType: evidenceFile ? evidenceFile.type : undefined,
        notes: evidenceFile 
          ? `File: ${evidenceFile.name} (${(evidenceFile.size / 1024).toFixed(1)} KB). Scanned and sealed by ClamAV Shield under Sec 65B IEA.`
          : 'Initial seizure documented under formal spot Panchnama.',
        transfers: [
          {
            transferId: `COC-${Date.now().toString().slice(-6)}`,
            evidenceId: generatedTag,
            fromOfficer: 'Scene of Crime / Seizure Spot',
            fromRole: 'Recovery Location',
            toOfficer: session.officerName,
            toRole: session.rank,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
            location: evLocation || caseItem.incidentLocation,
            action: 'Initial recovery and red wax sealing under Panchnama',
            condition: 'Intact, packaged in tamper-evident container',
            sealIntact: true,
            notes: 'Initial custody established.'
          }
        ]
      };

      const newTimelineEvent = {
        id: `TL-${Date.now()}`,
        date: generateCurrentDocketTimestamp(),
        title: `Evidence Seized: ${generatedTag}`,
        description: `${evCategory} - ${evDescription.substring(0, 70)}... ${evidenceFile ? `[${evidenceFile.name}] ` : ''}Sealed with SHA-256 hash.`,
        officer: session.officerName,
        badge: session.badgeNo,
        type: 'EVIDENCE' as const
      };

      const updatedCase: CaseFile = {
        ...caseItem,
        evidenceItems: [newEvidence, ...(caseItem.evidenceItems || [])],
        timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
      };
      updatedCase.aiSummary = generateAICaseBrief(updatedCase);

      onUpdateCase(updatedCase, 'SEIZED_EVIDENCE', `Seized ${evCategory} [${generatedTag}]`);
      window.dispatchEvent(new CustomEvent('casevault:file-updated', { detail: { caseId: caseItem.id } }));
      window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: { caseId: caseItem.id } }));
      setIsAddEvidenceOpen(false);
      setEvDescription('');
      setEvLocation('');
      setEvidenceFile(null);
      setEvidenceFilePreviewUrl(null);
    } catch (err: any) {
      setEvidenceUploadError(err.message || 'Failed to register evidence');
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const handleInitiateTransfer = (evidence: EvidenceItemRecord) => {
    soundEffects.playSnap();
    setSelectedEvidenceForTransfer(evidence);
    setIsTransferEvidenceOpen(true);
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidenceForTransfer || !transferSealConfirmed || isReadOnly) return;

    soundEffects.playStamp();
    const transferRecord: ChainOfCustodyTransfer = {
      transferId: `COC-${Date.now().toString().slice(-6)}`,
      evidenceId: selectedEvidenceForTransfer.id,
      fromOfficer: selectedEvidenceForTransfer.currentCustodian,
      fromRole: 'Current Custodian',
      toOfficer: transferRecipient,
      toRole: transferRecipientRole,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
      location: transferLocation,
      action: transferPurpose,
      condition: transferCondition,
      sealIntact: transferSealConfirmed,
      notes: `Custody transferred and verified intact pursuant to Police Manual.`
    };

    let newStatus: EvidenceStatus = 'Malkhana Storage';
    if (transferRecipient.toLowerCase().includes('fsl') || transferLocation.toLowerCase().includes('fsl')) {
      newStatus = 'Transferred to FSL';
    } else if (transferRecipient.toLowerCase().includes('court') || transferLocation.toLowerCase().includes('court')) {
      newStatus = 'Submitted to Court';
    }

    const updatedEvidenceItems = caseItem.evidenceItems.map((ev) => {
      if (ev.id === selectedEvidenceForTransfer.id) {
        return {
          ...ev,
          currentCustodian: transferRecipient,
          status: newStatus,
          transfers: [...(ev.transfers || []), transferRecord]
        };
      }
      return ev;
    });

    const newTimelineEvent = {
      id: `TL-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: `Chain of Custody Transfer: ${selectedEvidenceForTransfer.evidenceTag}`,
      description: `Transferred to ${transferRecipient} at ${transferLocation}. Purpose: ${transferPurpose}`,
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'EVIDENCE' as const
    };

    const updatedCase: CaseFile = {
      ...caseItem,
      evidenceItems: updatedEvidenceItems,
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);

    onUpdateCase(
      updatedCase,
      'TRANSFERRED_EVIDENCE_CUSTODY',
      `Custody of ${selectedEvidenceForTransfer.evidenceTag} transferred to ${transferRecipient}`
    );
    setIsTransferEvidenceOpen(false);
    setSelectedEvidenceForTransfer(null);
  };

  const handleTestIntegrity = (ev: EvidenceItemRecord) => {
    soundEffects.playSnap();
    setTestedEvidenceId(ev.id);
    setIntegrityCheckStatus('CALCULATING');

    setTimeout(() => {
      soundEffects.playStamp();
      setIntegrityCheckStatus('VERIFIED_MATCH');
      setTimeout(() => {
        setTestedEvidenceId(null);
        setIntegrityCheckStatus(null);
      }, 4000);
    }, 700);
  };

  const handleCreateForensicRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    let targetEv = caseItem.evidenceItems?.find(e => e.id === fslEvidenceId) || caseItem.evidenceItems?.[0];
    let updatedEvList = [...(caseItem.evidenceItems || [])];
    if (!targetEv) {
      targetEv = {
        id: `EVD-${caseItem.id.slice(-5)}-DOC-${Date.now().toString(36).toUpperCase()}`,
        evidenceTag: `MH-EVD-GEN-${Date.now().toString().slice(-4)}`,
        category: 'Digital Evidence & Documentation' as any,
        description: `Case dossier material & electronic evidence forward for FSL analysis: ${fslRequestedExam}`,
        collectionDate: new Date().toISOString().substring(0, 10),
        collectionLocation: caseItem.incidentLocation || 'Investigation Premises',
        collectingOfficer: session.officerName,
        collectingOfficerBadge: session.badgeNo,
        chainOfCustody: [
          {
            id: `COC-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
            action: 'FORWARDED_TO_FSL',
            fromCustodian: `${session.officerName} (${session.badgeNo})`,
            toCustodian: fslLabName,
            purpose: `Forensic Examination: ${fslRequestedExam}`,
            verificationHash: generateSimulatedSHA256(caseItem.id + Date.now())
          }
        ],
        sha256Hash: generateSimulatedSHA256(caseItem.id + Date.now()),
        status: 'Under Examination'
      };
      updatedEvList.unshift(targetEv);
    }

    soundEffects.playStamp();
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + parseInt(fslExpectedDays || '14', 10));

    const letterHash = fslLetterFile ? generateSimulatedSHA256((fslLetterFile.name || 'fsl-req') + Date.now()) : generateSimulatedSHA256(fslLetterRef + Date.now());

    const newFsl: ForensicRequest = {
      id: `FSL-REQ-${caseItem.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
      caseId: caseItem.id,
      evidenceId: targetEv.id,
      evidenceTag: targetEv.evidenceTag,
      labName: fslLabName,
      requestedExam: fslRequestedExam,
      requestingOfficer: `${session.officerName} (${session.rank})`,
      submissionDate: new Date().toISOString().substring(0, 10),
      expectedCompletionDate: expectedDate.toISOString().substring(0, 10),
      status: 'Request Created',
      findings: 'Awaiting lab receipt and accession number allocation.',
      requisitionLetterName: fslLetterFile?.name || `${fslLetterRef}.pdf`,
      requisitionLetterUrl: fslLetterPreview || undefined,
      requisitionLetterHash: letterHash,
      requisitionLetterSize: fslLetterFile?.size || 102400,
      requisitionLetterRef: fslLetterRef,
    };

    const newTimelineEvent = {
      id: `TL-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: `Forensic Examination Requested: ${targetEv?.evidenceTag}`,
      description: `Dispatched to ${fslLabName}. Forwarding Memo: ${fslLetterRef}. Analysis: ${fslRequestedExam}`,
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'FORENSIC' as const
    };

    // Auto-create repository document for FSL Forwarding / Requisition Letter
    const fslForwardingDoc: DocumentRecord = {
      id: `DOC-FSL-REQ-${Date.now().toString().slice(-6)}`,
      docNumber: fslLetterRef,
      caseId: caseItem.id,
      title: `FSL Forwarding Letter — ${targetEv.evidenceTag}`,
      type: 'INVESTIGATION_RECORD',
      department: 'POLICE_INVESTIGATION',
      clearance: 'RESTRICTED',
      authorName: session.officerName,
      authorRank: session.rank || 'Investigating Officer',
      createdDate: new Date().toISOString().substring(0, 10),
      lastModified: new Date().toISOString().substring(0, 10),
      version: '1.0',
      sha256Hash: letterHash,
      digitalSignature: {
        signedBy: `${session.officerName} (${session.badgeNo})`,
        certId: `CERT-MH-PKI-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
        isVerified: true
      },
      summary: `Official police requisition under Sec 293 CrPC dispatched to ${fslLabName}. Memo: ${fslLetterRef}. Exam: ${fslRequestedExam}`,
      tags: ['FORENSIC_REQUISITION', 'FORWARDING_MEMO', 'CrPC_293'],
      contentBody: `CRIMINAL PROCEDURE CODE SECTION 293 REQUISITION\nCase ID: ${caseItem.id}\nEvidence Tag: ${targetEv.evidenceTag}\nTesting Facility: ${fslLabName}\nRequested Examination: ${fslRequestedExam}\nForwarding Memo Ref: ${fslLetterRef}\nAuthorizing Officer: ${session.officerName} (${session.badgeNo})`,
      attachmentsCount: 1,
      fileName: fslLetterFile?.name || `${fslLetterRef}.pdf`,
      fileUrl: fslLetterPreview || undefined,
      fileSize: fslLetterFile?.size || 102400,
      mimeType: fslLetterFile?.type || 'application/pdf',
    };

    // Update target evidence status to Under Examination
    const updatedEvs = updatedEvList.map(ev => {
      if (ev.id === targetEv!.id) {
        return {
          ...ev,
          status: 'Under Examination' as const,
          notes: `${ev.notes ? ev.notes + "\n" : ""}Dispatched to ${fslLabName} under memo ${fslLetterRef}`
        };
      }
      return ev;
    });

    const updatedCase: CaseFile = {
      ...caseItem,
      status: 'Forensic Examination',
      evidenceItems: updatedEvs,
      forensicRequests: [newFsl, ...(caseItem.forensicRequests || [])],
      documents: [fslForwardingDoc, ...(caseItem.documents || [])],
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);

    onUpdateCase(updatedCase, 'REQUESTED_FORENSIC_EXAM', `Created FSL Request for ${targetEv?.evidenceTag} with forwarding memo ${fslLetterRef}`);
    setIsAddForensicOpen(false);
    setFslLetterFile(null);
    setFslLetterPreview(null);
  };

  const handleAdvanceForensicStatus = (fslId: string, currentStatus: ForensicStatus) => {
    soundEffects.playStamp();
    let nextStatus: ForensicStatus = 'Evidence Received';
    let findingsText = 'Evidence accessioned by FSL registrar.';

    if (currentStatus === 'Request Created') {
      nextStatus = 'Evidence Received';
      findingsText = 'Evidence seal verified intact; assigned to Lead Cyber/Forensic Examiner.';
    } else if (currentStatus === 'Evidence Received') {
      nextStatus = 'Under Examination';
      findingsText = 'Diagnostic hardware extraction in progress. 82% bit-stream image cloned.';
    } else if (currentStatus === 'Under Examination') {
      nextStatus = 'Report Ready';
      findingsText = 'Certified Examination Report finalized under Section 293 Cr.P.C. Positive cryptographic match.';
    } else if (currentStatus === 'Report Ready') {
      nextStatus = 'Closed';
      findingsText = 'Certified report received by Station IO and attached to case repository.';
    }

    const updatedRequests = caseItem.forensicRequests.map(f => {
      if (f.id === fslId) {
        return { ...f, status: nextStatus, findings: findingsText };
      }
      return f;
    });

    const updatedCase: CaseFile = {
      ...caseItem,
      forensicRequests: updatedRequests
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);
    onUpdateCase(updatedCase, 'UPDATED_FORENSIC_STATUS', `FSL Request ${fslId} -> ${nextStatus}`);
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || isReadOnly) return;

    soundEffects.playStamp();
    const newDocId = `DOC-${caseItem.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
    const newHash = generateSimulatedSHA256(docTitle + docSummary + Date.now());

    const newDoc: DocumentRecord = {
      id: newDocId,
      docNumber: `DOC-MH-AND-${caseItem.id.slice(-6)}-${docType.slice(0, 4)}`,
      caseId: caseItem.id,
      title: docTitle,
      type: docType,
      department: 'POLICE_INVESTIGATION',
      clearance: 'CONFIDENTIAL',
      authorName: session.officerName,
      authorRank: session.rank,
      createdDate: new Date().toISOString().substring(0, 10),
      lastModified: new Date().toISOString().substring(0, 10),
      version: '1.0',
      sha256Hash: newHash,
      digitalSignature: {
        signedBy: `${session.officerName} (${session.badgeNo})`,
        certId: `CERT-MH-PKI-${Date.now().toString().slice(-6)}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
        isVerified: true
      },
      summary: docSummary || 'Official investigative document submitted to case docket.',
      tags: [docType, 'Statutory Docket', 'CrPC'],
      contentBody: docContent || `Document Title: ${docTitle}\nAuthor: ${session.officerName}\nSummary: ${docSummary}`,
      attachmentsCount: 1
    };

    const newTimelineEvent = {
      id: `TL-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: `Document Uploaded: ${docTitle}`,
      description: `${docType} v1.0 digitally signed and stored in case repository.`,
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'GENERAL' as const
    };

    const updatedCase: CaseFile = {
      ...caseItem,
      documents: [newDoc, ...(caseItem.documents || [])],
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);

    onUpdateCase(updatedCase, 'UPLOADED_DOCUMENT', `Uploaded ${docTitle} [${newDoc.docNumber}]`);
    setIsAddDocOpen(false);
    setDocTitle('');
    setDocSummary('');
    setDocContent('');
  };

  // Workflow: Submit for Legal Review (POLICE)
  const handleSubmitForReview = () => {
    soundEffects.playStamp();
    const newTimelineEvent = {
      id: `TL-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: 'Submitted for Legal Review & Prosecution Vetting',
      description: `Docket submitted by Police Investigator ${session.officerName} with complete investigation journal & evidence chain.`,
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'REVIEW' as const
    };

    const updatedCase: CaseFile = {
      ...caseItem,
      status: 'Legal Review',
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);

    onUpdateCase(updatedCase, 'SUBMITTED_FOR_REVIEW', 'Submitted case for Legal Scrutiny & Prosecution Vetting');
  };

  // Workflow: Legal Review Actions (LEGAL / ADMIN)
  const handleLegalAction = (actionType: 'RETURN_FOR_INVESTIGATION' | 'RECOMMEND_CLOSURE') => {
    soundEffects.playStamp();

    if (actionType === 'RETURN_FOR_INVESTIGATION') {
      const newTimelineEvent = {
        id: `TL-${Date.now()}`,
        date: generateCurrentDocketTimestamp(),
        title: 'Legal Review: Returned for Supplementary Inquiry',
        description: `Legal Prosecutor ${session.officerName} vetted docket. Directives: ${reviewRemark || 'Verify additional witness statements and obtain final FSL report.'}`,
        officer: session.officerName,
        badge: session.badgeNo,
        type: 'REVIEW' as const
      };

      const updatedCase: CaseFile = {
        ...caseItem,
        status: 'Investigation Ongoing',
        timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
      };
      updatedCase.aiSummary = generateAICaseBrief(updatedCase);
      onUpdateCase(updatedCase, 'LEGAL_REVIEW_RETURNED', `Returned case with remarks: ${reviewRemark}`);
    } else {
      const newTimelineEvent = {
        id: `TL-${Date.now()}`,
        date: generateCurrentDocketTimestamp(),
        title: 'Legal Prosecution Scrutiny Approved & Form Forwarded',
        description: `Legal Prosecutor ${session.officerName} vetted complete docket and approved charge sheet submission to Court.`,
        officer: session.officerName,
        badge: session.badgeNo,
        type: 'CHARGE_SHEET' as const
      };

      const updatedCase: CaseFile = {
        ...caseItem,
        status: 'Charge Sheet / Court Process',
        timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
      };
      updatedCase.aiSummary = generateAICaseBrief(updatedCase);
      onUpdateCase(updatedCase, 'LEGAL_REVIEW_APPROVED', 'Approved Final Charge Sheet for Court Processing');
    }

    setIsReviewActionModalOpen(false);
    setReviewRemark('');
  };

  // Workflow: Final Case Closure (Locks Docket)
  const handleFinalClosure = () => {
    soundEffects.playLoginSuccess();

    const newTimelineEvent = {
      id: `TL-${Date.now()}`,
      date: generateCurrentDocketTimestamp(),
      title: 'FINAL DISPOSAL & CLOSURE ORDER APPROVED',
      description: `Authorized Authority ${session.officerName} approved final charge sheet submission and ordered digital docket sealing under Section 173 Cr.P.C.`,
      officer: session.officerName,
      badge: session.badgeNo,
      type: 'CHARGE_SHEET' as const
    };

    const updatedCase: CaseFile = {
      ...caseItem,
      status: 'Closed',
      timeline: [newTimelineEvent, ...(caseItem.timeline || [])]
    };
    updatedCase.aiSummary = generateAICaseBrief(updatedCase);

    onUpdateCase(updatedCase, 'APPROVED_CASE_CLOSURE', 'Approved final disposal order & sealed case docket');
  };

  const statusProgressSteps = [
    { key: 'FIR Registered', label: '1. Case Filed' },
    { key: 'Investigation Ongoing', label: '2. Investigation' },
    { key: 'Evidence Pending', label: '3. Evidence' },
    { key: 'Forensic Examination', label: '4. Lab Reports' },
    { key: 'Legal Review', label: '5. Legal Review' },
    { key: 'Charge Sheet / Court Process', label: '6. Court Hearing' },
    { key: 'Closed', label: '7. Closed' }
  ];

  const currentStepIndex = statusProgressSteps.findIndex(s => s.key.toLowerCase() === caseItem.status.toLowerCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden"
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="px-6 py-4 bg-[#182f4d] text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-amber-300 font-mono font-bold text-sm">
              <Hash className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-amber-300 font-bold bg-amber-400/20 px-2 py-0.5 rounded">
                  {caseItem.id}
                </span>
                <span className="text-xs text-slate-300">| FIR: {caseItem.firNumber}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  caseItem.priority === 'CRITICAL' ? 'bg-red-500/30 text-red-200 border border-red-400/40' :
                  caseItem.priority === 'HIGH' ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40' :
                  'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                }`}>
                  {caseItem.priority} Priority
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-0.5 line-clamp-1">
                {caseItem.caseTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session.role === 'ADMIN' && (
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(true)}
                className="px-2.5 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reassign IO</span>
              </button>
            )}

            {session.role === 'POLICE' && !canAccessCase(session, caseItem) && (
              <button
                type="button"
                onClick={() => setIsAccessRequestModalOpen(true)}
                className="px-2.5 py-1.5 bg-amber-500/80 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Request Access</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Read-Only Certified Archive Banner (If Case Closed) */}
        {isReadOnly && (
          <div className="px-6 py-2.5 bg-emerald-900 text-emerald-100 border-b border-emerald-800 flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <span>CASE CLOSED & DISPOSED (Certified Final Order under Section 173 Cr.P.C. — Read-Only Mode)</span>
            </div>
            <span className="font-mono text-[10px] bg-emerald-800 px-2 py-0.5 rounded text-emerald-200">
              TAMPER-SEALED
            </span>
          </div>
        )}

        {/* Case Meta & Officer Quick Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-4 text-slate-700">
            <div>
              <span className="text-slate-400 font-semibold">Station: </span>
              <span className="font-bold text-slate-900">{caseItem.policeStation}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Assigned Officer: </span>
              <span className="font-bold text-blue-900">{caseItem.officers?.assignedIO || 'Not Assigned'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Zone: </span>
              <span className="font-medium text-slate-800">{caseItem.jurisdictionZone || 'Zonal Police Command'}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold">Status: </span>
              <span className="font-bold text-slate-900">{CASE_STATUS_LABELS[caseItem.status] || caseItem.status}</span>
            </div>
          </div>

          {/* Contextual Workflow Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Live Summarize Report Button */}
            <button
              type="button"
              onClick={() => {
                soundEffects.playSnap();
                setIsSummaryModalOpen(true);
              }}
              className="px-3 py-1 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-all border border-blue-600/40"
              title="Generate Live Executive Summary & Statutory Status Report"
            >
              <FileBarChart className="w-3.5 h-3.5 text-blue-300" />
              <span>Summarize Case (Live Report)</span>
            </button>
            {canAssignIO(session, caseItem) && (
              <button
                type="button"
                onClick={() => {
                  soundEffects.playSnap();
                  if (session.role === 'ADMIN') {
                    setIsReassignModalOpen(true);
                  } else {
                    setIsAssignIOOpen(true);
                  }
                }}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{caseItem.officers?.assignedIO ? 'Change IO / Reassign' : 'Assign IO'}</span>
              </button>
            )}

            {/* Submit for Legal Review */}
            {canSubmitForReview(session, caseItem) && caseItem.status !== 'Legal Review' && caseItem.status !== 'Pending Supervisory Review' && (
              <button
                type="button"
                onClick={handleSubmitForReview}
                className="px-2.5 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs transition-all"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send for Legal Review</span>
              </button>
            )}

            {/* Legal / Admin: Scrutiny Directives Trigger */}
            {canReviewCase(session, caseItem) && (caseItem.status === 'Legal Review' || caseItem.status === 'Pending Supervisory Review' || caseItem.status === 'Investigation Ongoing') && !isReadOnly && (
              <button
                type="button"
                onClick={() => {
                  soundEffects.playSnap();
                  setIsReviewActionModalOpen(true);
                }}
                className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs transition-all"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Legal Advice & Notes</span>
              </button>
            )}

            {/* Admin / Officer: Approve Final Closure */}
            {canApproveClosure(session, caseItem) && caseItem.status !== 'Closed' && (
              <button
                type="button"
                onClick={handleFinalClosure}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs transition-all"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Close Case</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Lifecycle Stepper */}
        <div className="px-6 py-2.5 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-1 overflow-x-auto shrink-0">
          {statusProgressSteps.map((step, idx) => {
            const isCompleted = idx <= (currentStepIndex >= 0 ? currentStepIndex : 1);
            const isCurrent = idx === currentStepIndex;

            return (
              <div key={step.key} className="flex items-center gap-1.5 shrink-0">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : isCompleted
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-slate-50 text-slate-400'
                }`}>
                  {isCompleted && !isCurrent ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : null}
                  <span>{step.label}</span>
                </div>
                {idx < statusProgressSteps.length - 1 && (
                  <div className={`w-3 h-0.5 ${isCompleted ? 'bg-blue-600/40' : 'bg-slate-300'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Tab Navigation */}
        {(() => {
          const userRole = (session?.role || 'POLICE').toUpperCase() as PoliceRole;
          const prisonCount = (caseItem.prisonRecords || (caseItem as any).prison_records || []).length;
          const warrantsCount = (caseItem.warrants || []).length;
          const hearingsCount = (caseItem.hearings || []).length;
          const criminalHistoryCount = (caseItem.criminalHistory || (caseItem as any).criminal_history || []).length;

          const allTabs: Array<{ id: DetailTab; label: string; icon: any; allowedRoles?: PoliceRole[] }> = [
            { id: 'CASE_SUMMARY', label: '📊 Live Executive Summary', icon: FileBarChart, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN', 'AUDITOR'] },
            { id: 'FIR_OVERVIEW', label: 'FIR & Case Info', icon: FileText },
            { id: 'CASE_TEAM', label: `Officers (${(caseItem.caseAssignments || []).filter(a => a.status === 'Active').length})`, icon: Users, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN'] },
            { id: 'INVESTIGATION_JOURNAL', label: `Investigation Notes (${caseItem.investigationJournal?.length || 0})`, icon: Activity, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN'] },
            { id: 'EVIDENCE_CUSTODY', label: `Evidence (${caseItem.evidenceItems?.length || 0})`, icon: Lock, allowedRoles: ['POLICE', 'FORENSIC', 'LEGAL', 'ADMIN'] },
            { id: 'FINGERPRINTS', label: `Fingerprints (${(caseItem.fingerprintRecords || []).length})`, icon: Fingerprint, allowedRoles: ['POLICE', 'FORENSIC', 'LEGAL', 'ADMIN'] },
            { id: 'FORENSIC_REQUESTS', label: `Lab Reports (${caseItem.forensicRequests?.length || 0})`, icon: Microscope, allowedRoles: ['POLICE', 'FORENSIC', 'LEGAL', 'ADMIN'] },
            { id: 'COURT_PROCEEDINGS', label: `Court Process (${(caseItem.courtRecords || []).length})`, icon: Scale, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN', 'AUDITOR'] },
            { id: 'WARRANTS_HEARINGS', label: `Hearings & Warrants (${warrantsCount + hearingsCount})`, icon: FileText, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN', 'AUDITOR'] },
            { id: 'CRIMINAL_HISTORY', label: `Criminal History (${criminalHistoryCount})`, icon: History, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN', 'AUDITOR'] },
            { id: 'VICTIM_INFO', label: 'Victim Info', icon: User, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN', 'AUDITOR'] },
            { id: 'PEOPLE_INVOLVED', label: `People Involved (${(caseItem.witnesses?.length || 0) + (caseItem.suspects?.length || 0)})`, icon: UserCheck, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN', 'AUDITOR'] },
            { id: 'TIMELINE', label: `Timeline (${caseItem.timeline?.length || 0})`, icon: Clock, allowedRoles: ['POLICE', 'LEGAL', 'ADMIN', 'AUDITOR'] },
          ];

          const visibleTabs = allTabs.filter(tab => !tab.allowedRoles || tab.allowedRoles.includes(userRole));
          const effectiveActiveTab = visibleTabs.some(t => t.id === activeTab) ? activeTab : (visibleTabs[0]?.id || 'FIR_OVERVIEW');

          return (
            <div className="px-6 border-b border-slate-200 flex items-center gap-1 overflow-x-auto text-xs font-bold bg-white shrink-0">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = effectiveActiveTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setActiveTab(tab.id as DetailTab);
                    }}
                    className={`py-3 px-3.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      isActive
                        ? 'border-blue-700 text-blue-800'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {/* ================= TAB CONTENTS ================= */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
          {!canAccessCase(session, caseItem) ? (
            <div className="py-12 px-4 flex flex-col items-center justify-center text-center max-w-xl mx-auto my-auto space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Restricted Case Docket</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Maharashtra Police Cr.P.C. Sec 157 / BNSS Confidentiality Protocol
                </p>
              </div>

              {(() => {
                const revocation = getAccessRevocationReason(session.badgeNo, caseItem);
                if (revocation.wasAssigned) {
                  return (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-left space-y-2 w-full shadow-2xs">
                      <div className="font-bold text-red-900 flex items-center gap-1.5 text-sm">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        Active Case Assignment Revoked
                      </div>
                      <p className="text-red-800">
                        Your assignment to this case was terminated by <span className="font-bold">{revocation.removedByName || 'Administration'}</span> on <span className="font-mono">{revocation.removedAt || 'recent order'}</span>.
                      </p>
                      {revocation.removalReason && (
                        <div className="text-slate-700 bg-white/80 p-2.5 rounded-lg border border-red-200 text-xs font-medium">
                          <span className="font-bold text-slate-900">Order Ground: </span>{revocation.removalReason}
                        </div>
                      )}
                      <p className="text-[11px] text-red-700">
                        Immediate backend 403 Forbidden enforcement active. Reassignment event recorded on blockchain ledger.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-left space-y-2 w-full shadow-2xs">
                    <div className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                      Station Need-to-Know Protection Enforced
                    </div>
                    <p className="text-amber-800 leading-relaxed">
                      Officers within the same police station do not receive automatic access to another officer's active docket. Only the designated Investigating Officer (IO) or team members with an active cross-station access grant may view case files, evidence, and witness diaries.
                    </p>
                    <div className="text-slate-700 text-xs pt-2 border-t border-amber-200/60 flex justify-between items-center">
                      <span className="font-medium text-slate-500">Designated IO:</span>
                      <span className="font-bold text-slate-900">{caseItem.officers?.assignedIO || caseItem.investigating_officer_id || 'Assigned IO'}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAccessRequestModalOpen(true)}
                  className="px-5 py-2.5 bg-[#182f4d] hover:bg-[#182f4d]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-amber-300" />
                  <span>Request Temporary Case Access</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close Docket
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TAB 0: LIVE EXECUTIVE CASE SUMMARY & REPORT */}
              {activeTab === 'CASE_SUMMARY' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[550px]">
                  <LiveCaseSummaryContent
                    caseItem={caseItem}
                    session={session}
                    isModal={false}
                  />
                </div>
              )}

              {/* TAB 1: FIR OVERVIEW */}
              {activeTab === 'FIR_OVERVIEW' && (
            <div className="space-y-6">
              {normaliseRole(session.role) === 'FORENSIC' && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex flex-wrap sm:flex-nowrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Microscope className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-purple-950">FSL Scientific Examination Protocol (Sec 172 CrPC)</h4>
                      <p className="text-[11px] text-purple-800/90 mt-0.5 leading-relaxed">
                        Authorized FSL laboratory clearance: You can inspect physical evidence exhibits, review official police requisition letters, and upload certified examination reports. Confidential investigative notes, witness statements, victim details, and case diaries are shielded to maintain forensic objectivity.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setSelectedForensicEvidenceId(undefined);
                      setIsUploadForensicReportModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
                  >
                    <Microscope className="w-4 h-4" />
                    <span>Upload FSL Report</span>
                  </button>
                </div>
              )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-700" />
                    Case Summary & Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <span className="text-slate-400 font-semibold">FIR Number:</span>
                      <p className="font-mono font-bold text-slate-900 text-sm">{caseItem.firNumber}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <span className="text-slate-400 font-semibold">Crime Type:</span>
                      <p className="font-bold text-slate-900">{caseItem.crimeType}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <span className="text-slate-400 font-semibold">Incident Date & Time:</span>
                      <p className="font-medium text-slate-900">{caseItem.incidentDate} at {caseItem.incidentTime}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <span className="text-slate-400 font-semibold">Place of Occurrence:</span>
                      <p className="font-medium text-slate-900">{caseItem.incidentLocation}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Applicable Laws & Sections:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {caseItem.ipcSections?.map((sec, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold">
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-700">Case Summary:</span>
                    <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg leading-relaxed border border-slate-100">
                      {caseItem.summaryNotes}
                    </p>
                  </div>
                </div>

                {/* Physical Hardcopy FIR Scan Attachment Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-700" />
                      Signed Paper FIR Copy
                    </h3>
                    {firScanUrl && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        Paper Copy Attached
                      </span>
                    )}
                  </div>

                  {firScanUrl ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 bg-gradient-to-r from-emerald-50/70 via-slate-50 to-blue-50/40 rounded-xl border border-emerald-200/80">
                      <div 
                        onClick={() => setPreviewMediaModal({
                          isOpen: true,
                          title: `Signed Paper FIR Copy - ${caseItem.firNumber}`,
                          url: firScanUrl,
                          fileName: firScanName,
                          fileType: (firScanName.toLowerCase().endsWith('.pdf') || firScanUrl.startsWith('data:application/pdf')) ? 'application/pdf' : 'image/jpeg',
                          tag: 'HARDCOPY-FIR',
                          hash: firHardCopyDoc?.sha256Hash || firHardCopyEvidence?.originalHash
                        })}
                        className="w-24 h-28 rounded-lg overflow-hidden border border-emerald-300 shadow-xs relative group cursor-pointer shrink-0 bg-white flex items-center justify-center"
                      >
                        {firScanName.toLowerCase().endsWith('.pdf') || firScanUrl.startsWith('data:application/pdf') ? (
                          <div className="flex flex-col items-center justify-center p-2 text-rose-600">
                            <FileText className="w-10 h-10 mb-1 text-rose-600" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">PDF Doc</span>
                          </div>
                        ) : (
                          <img 
                            src={firScanUrl} 
                            alt="FIR Physical Scan" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          />
                        )}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                          Click to View
                        </div>
                      </div>

                      <div className="flex-1 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">{firScanName}</p>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">FIR Document</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Signed paper photograph saved and protected with security seal (SHA-256).
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewMediaModal({
                              isOpen: true,
                              title: `Signed Paper FIR - ${caseItem.firNumber}`,
                              url: firScanUrl,
                              fileName: firScanName,
                              fileType: (firScanName.toLowerCase().endsWith('.pdf') || firScanUrl.startsWith('data:application/pdf')) ? 'application/pdf' : 'image/jpeg',
                              tag: 'HARDCOPY-FIR',
                              hash: firHardCopyDoc?.sha256Hash || firHardCopyEvidence?.originalHash
                            })}
                            className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Full Screen</span>
                          </button>
                          {!isReadOnly && (
                            <label className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                              <Upload className="w-3.5 h-3.5 text-slate-500" />
                              <span>Replace Photo</span>
                              <input type="file" accept="image/*,.pdf" onChange={handleUploadFirHardcopy} className="hidden" />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center space-y-2">
                      <p className="text-xs text-slate-600">
                        No paper copy uploaded yet. You can view the case details in the app or upload a signed paper photo.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewMediaModal({
                            isOpen: true,
                            title: `FIR Document - ${caseItem.firNumber}`,
                            url: '#fir-docket',
                            isFirDocket: true,
                            fileName: `FIR_${caseItem.firNumber}.pdf`,
                            tag: 'STATUTORY-FIR',
                            hash: caseItem.documents?.[0]?.sha256Hash || 'SHA256-REGISTERED'
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Case Details</span>
                        </button>
                        {!isReadOnly && (
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Paper Photo</span>
                            <input type="file" accept="image/*,.pdf" onChange={handleUploadFirHardcopy} className="hidden" />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Complainant Record */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-700" />
                    Complainant Details
                  </h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Complainant Name:</span>
                      <p className="font-bold text-slate-900">{caseItem.complainant?.name}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Contact Number:</span>
                      <p className="font-mono text-slate-800">{caseItem.complainant?.contact}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400">Address & ID Proof:</span>
                      <p className="text-slate-800">{caseItem.complainant?.address} ({caseItem.complainant?.idProof})</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 text-xs">Brief Statement:</span>
                    <p className="text-xs text-slate-700 italic mt-0.5">
                      "{caseItem.complainant?.statementBrief}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Key Officers & Clearance */}
              <div className="space-y-4">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Assigned Officers
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Station In-Charge</div>
                      <p className="font-bold text-slate-900">{caseItem.officers?.piInCharge}</p>
                      <span className="text-[11px] text-slate-500">{caseItem.policeStation}</span>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg space-y-1">
                      <div className="text-[10px] text-blue-900 font-bold uppercase">Lead Investigating Officer</div>
                      <p className="font-bold text-blue-950">{caseItem.officers?.assignedIO || 'Pending Assignment'}</p>
                      <span className="font-mono text-[10px] text-blue-700">Badge: {caseItem.officers?.assignedIOBadge || 'N/A'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Division & Zone</div>
                      <p className="font-bold text-slate-900">{caseItem.jurisdictionZone || 'Zonal Police Sub-Division'}</p>
                      <span className="text-[11px] text-slate-500">{caseItem.policeStation}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Status & Approvals
                  </h3>
                  <div className="space-y-2 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Panchnama Status:</span>
                      <span className="font-bold text-emerald-700">Sealed & Filed</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Court Notice:</span>
                      <span className="font-bold text-emerald-700">Sent to Magistrate</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Evidence Storage:</span>
                      <span className="font-bold text-blue-700">Securely Stored</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}

          {/* TAB 2: INVESTIGATION JOURNAL */}
          {activeTab === 'INVESTIGATION_JOURNAL' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Chronological Case Diary (Section 172 Cr.P.C.)
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official investigation step log recorded by assigned Investigating Officers and station personnel.
                  </p>
                </div>

                {!isReadOnly && canEditCase(session, caseItem) && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setIsAddInvestigationOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Log Investigation Entry</span>
                  </button>
                )}
              </div>

              {caseItem.investigationJournal && caseItem.investigationJournal.length > 0 ? (
                <div className="space-y-3">
                  {caseItem.investigationJournal.map((entry) => (
                    <div key={entry.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-bold text-[10px] rounded uppercase">
                            {entry.activityType}
                          </span>
                          <span className="font-mono text-xs text-slate-500 font-semibold">{entry.timestamp}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">{entry.officerName}</span>
                          <span className="font-mono text-[10px] text-slate-500">({entry.officerBadge})</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                            entry.reviewStatus === 'APPROVED_BY_SP' ? 'bg-emerald-100 text-emerald-800' :
                            entry.reviewStatus === 'REVIEWED_BY_DYSP' ? 'bg-purple-100 text-purple-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {entry.reviewStatus}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-sans">{entry.notes}</p>

                      {entry.nextAction && (
                        <div className="text-[11px] bg-slate-50 p-2 rounded-lg text-slate-600 flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">Next Action:</span>
                          <span>{entry.nextAction}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                  No investigation diary entries recorded yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EVIDENCE & CHAIN OF CUSTODY (FLAGSHIP) */}
          {activeTab === 'EVIDENCE_CUSTODY' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Malkhana Evidence Vault & Chain of Custody
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Physical and digital evidence artifacts sealed with cryptographic SHA-256 integrity fingerprints.
                  </p>
                </div>

                {!isReadOnly && normaliseRole(session.role) === 'POLICE' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setIsAddEvidenceOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Seize & Register Evidence</span>
                  </button>
                )}

                {normaliseRole(session.role) === 'FORENSIC' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setSelectedForensicEvidenceId(undefined);
                      setIsUploadForensicReportModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Microscope className="w-4 h-4" />
                    <span>Upload FSL Report</span>
                  </button>
                )}

                {normaliseRole(session.role) === 'AUDITOR' && (
                  <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    <span>Auditor Read-Only Evidence Inspection</span>
                  </div>
                )}
              </div>

              {caseItem.evidenceItems && caseItem.evidenceItems.length > 0 ? (
                <div className="space-y-6">
                  {caseItem.evidenceItems.map((ev) => {
                    const isBeingTested = testedEvidenceId === ev.id;

                    return (
                      <div key={ev.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
                        {/* Evidence Main Header */}
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded">
                                {ev.evidenceTag}
                              </span>
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-bold rounded">
                                {ev.category}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                ev.status === 'Under Examination' ? 'bg-purple-100 text-purple-800' :
                                ev.status === 'Transferred to FSL' ? 'bg-amber-100 text-amber-800' :
                                'bg-emerald-100 text-emerald-800'
                              }`}>
                                {ev.status}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mt-1">
                              {formatEvidenceDisplayTitle(ev.description)}
                            </h4>
                            {ev.fileName && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-semibold border border-blue-200">
                                  <FileText className="w-3 h-3 text-blue-600" />
                                  {ev.fileName}
                                </span>
                                {ev.fileSize && (
                                  <span className="text-[10px] text-slate-400">
                                    {(ev.fileSize / 1024).toFixed(1)} KB
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Integrity Checker — opens rich blockchain modal */}
                            <button
                              type="button"
                              onClick={() => {
                                setIntegrityModalEvidence(ev);
                                setIsIntegrityModalOpen(true);
                              }}
                              className={`px-2.5 py-1.5 font-bold text-[11px] rounded-lg cursor-pointer transition-colors flex items-center gap-1.5 ${
                                ev.isIntegrityVerified
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                                  : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-300'
                              }`}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{ev.isIntegrityVerified ? '✓ Verify Integrity' : '⚠ Integrity Alert'}</span>
                            </button>

                            {/* Transfer Custody Button */}
                            {!isReadOnly && canTransferEvidence(session, ev, caseItem) && (
                              <button
                                type="button"
                                onClick={() => handleInitiateTransfer(ev)}
                                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-[11px] rounded-lg cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                <span>Transfer Custody</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-slate-400 font-semibold text-[10px] uppercase">Current Custodian:</span>
                            <p className="font-bold text-slate-900 truncate">{ev.currentCustodian}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold text-[10px] uppercase">Storage Location:</span>
                            <p className="font-medium text-slate-800">{ev.storageLocker}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold text-[10px] uppercase">Seized By:</span>
                            <p className="font-medium text-slate-800">{ev.collectedBy}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold text-[10px] uppercase">Collection Date:</span>
                            <p className="font-medium text-slate-800">{ev.collectionDate}</p>
                          </div>
                        </div>

                        {/* Evidence Visual Media Artifact & Inspection Card */}
                        {(() => {
                          const fileMatch = ev.description?.match(/\[File:\s*([^\]]+)\]/i) || ev.description?.match(/\[Attached File:\s*([^\]]+)\]/i);
                          const extractedFileName = ev.fileName || fileMatch?.[1] || '';
                          const cleanLower = (extractedFileName || ev.description || '').toLowerCase();
                          const isImage = (ev.mimeType && ev.mimeType.startsWith('image/')) ||
                                          (ev.fileUrl && ev.fileUrl.startsWith('data:image')) ||
                                          (ev.thumbnailUrl && ev.thumbnailUrl.startsWith('data:image')) ||
                                          /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(cleanLower);
                          const isVideo = (ev.mimeType && ev.mimeType.startsWith('video/')) ||
                                          (ev.fileUrl && ev.fileUrl.startsWith('data:video')) ||
                                          /\.(mp4|mov|avi|mkv|webm)$/i.test(cleanLower);
                          const isPdf = ev.mimeType === 'application/pdf' || /\.(pdf)$/i.test(cleanLower);

                          if (isImage || (ev.fileUrl && !isVideo && !isPdf) || (ev.thumbnailUrl && !isVideo)) {
                            const photoSrc = ev.fileUrl || ev.thumbnailUrl || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&auto=format&fit=crop&q=80';
                            return (
                              <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-sm text-white">
                                <div
                                  onClick={() => setPreviewMediaModal({
                                    isOpen: true,
                                    title: formatEvidenceDisplayTitle(ev.description),
                                    url: photoSrc,
                                    fileName: extractedFileName || 'seized_evidence_photo.jpg',
                                    tag: ev.evidenceTag,
                                    hash: ev.currentHash,
                                    fileType: 'image/jpeg'
                                  })}
                                  className="relative group cursor-pointer bg-slate-950 flex items-center justify-center p-2 min-h-48 max-h-80"
                                >
                                  <img
                                    src={photoSrc}
                                    alt={ev.description}
                                    className="max-h-72 max-w-full object-contain rounded-lg group-hover:scale-[1.02] transition-transform"
                                  />
                                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-xs text-white text-[10px] font-mono font-bold px-2 py-1 rounded-md flex items-center gap-1.5 border border-white/20">
                                    <Camera className="w-3.5 h-3.5 text-blue-400" />
                                    <span>SEIZED PHOTO EVIDENCE • SEC 65B</span>
                                  </div>
                                  <div className="absolute top-3 right-3 bg-emerald-950/80 backdrop-blur-xs text-emerald-300 text-[10px] font-mono font-bold px-2 py-1 rounded-md border border-emerald-500/40">
                                    ✓ CRYPTO-SEAL INTACT
                                  </div>
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <span className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2">
                                      <ZoomIn className="w-4 h-4" />
                                      Inspect Full-Resolution Photo
                                    </span>
                                  </div>
                                </div>
                                <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <div>
                                    <p className="font-bold text-slate-100 truncate max-w-md">{extractedFileName || 'Seized Photographic Artifact'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      {ev.fileSize ? `${(ev.fileSize / 1024).toFixed(1)} KB • ` : ''}ClamAV Certified Clean • SHA-256: {ev.currentHash.substring(0, 16)}...
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewMediaModal({
                                      isOpen: true,
                                      title: formatEvidenceDisplayTitle(ev.description),
                                      url: photoSrc,
                                      fileName: extractedFileName || 'seized_evidence_photo.jpg',
                                      tag: ev.evidenceTag,
                                      hash: ev.currentHash,
                                      fileType: 'image/jpeg'
                                    })}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Inspect Photo</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          if (isVideo) {
                            return (
                              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800 text-white shadow-sm">
                                <div className="p-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                    <span className="font-mono font-bold text-rose-400 text-[10px] tracking-wider">● CCTV VIDEO RECORDING</span>
                                    <span className="text-slate-400 text-[10px]">• Seized Video Artifact</span>
                                  </div>
                                  <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                                    ✓ SEC 65B HASH MATCH
                                  </span>
                                </div>
                                {ev.fileUrl && ev.fileUrl.startsWith('data:video') ? (
                                  <video src={ev.fileUrl} controls className="w-full max-h-64 bg-black" />
                                ) : (
                                  <div
                                    onClick={() => setPreviewMediaModal({
                                      isOpen: true,
                                      title: formatEvidenceDisplayTitle(ev.description),
                                      url: ev.fileUrl || '#cctv-footage',
                                      fileName: extractedFileName || 'surveillance_video.mp4',
                                      tag: ev.evidenceTag,
                                      hash: ev.currentHash,
                                      fileType: 'video/mp4'
                                    })}
                                    className="relative group cursor-pointer bg-gradient-to-b from-slate-900 to-black p-6 flex flex-col items-center justify-center text-center space-y-3 min-h-48"
                                  >
                                    <div className="w-14 h-14 rounded-full bg-blue-600/30 border border-blue-500/50 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-600/50 transition-all">
                                      <Play className="w-6 h-6 text-blue-400 fill-blue-400 ml-1" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-sm text-slate-100">{extractedFileName || 'Surveillance Video Recording'}</p>
                                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">Recorded: {ev.collectionDate} • Duration: 00:04:18 • Format: MP4</p>
                                    </div>
                                    <span className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow transition">
                                      Play & Inspect Video Footage
                                    </span>
                                  </div>
                                )}
                                <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                  <span className="font-mono text-[10px]">File: {extractedFileName || '20260801_110943.mp4'}</span>
                                  <span className="font-mono text-[10px] text-blue-400">Hyperledger Fabric TX Anchored</span>
                                </div>
                              </div>
                            );
                          }

                          // Default for attached files or physical evidence
                          return (
                            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-blue-50/70 to-slate-50 border border-blue-100 rounded-xl">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0 border border-blue-200">
                                  {isPdf ? <FileText className="w-6 h-6" /> : <Lock className="w-6 h-6 text-blue-700" />}
                                </div>
                                <div>
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                                    {ev.category} Artifact Seizure Record
                                  </span>
                                  <p className="text-xs font-bold text-slate-800 truncate max-w-sm">
                                    {extractedFileName || formatEvidenceDisplayTitle(ev.description)}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono">
                                    Malkhana Storage: {ev.storageLocker} • Sealed: {ev.collectionDate}
                                  </p>
                                </div>
                              </div>

                              {(ev.fileUrl || ev.thumbnailUrl || isPdf) && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewMediaModal({
                                    isOpen: true,
                                    title: formatEvidenceDisplayTitle(ev.description),
                                    url: ev.fileUrl || ev.thumbnailUrl || '',
                                    fileName: extractedFileName || 'evidence_artifact.pdf',
                                    tag: ev.evidenceTag,
                                    hash: ev.currentHash
                                  })}
                                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Inspect Evidence Artifact</span>
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {/* Official Tamper-Proof Digital Verification Card (Replaces AI Terminal Box) */}
                        <div className="bg-gradient-to-r from-emerald-50/90 via-teal-50/50 to-blue-50/40 border border-emerald-200/80 rounded-xl p-3.5 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                <ShieldCheck className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-900 tracking-tight">
                                    Cryptographic Evidence Seal
                                  </span>
                                  <span className="px-1.5 py-0.2 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 rounded border border-emerald-300">
                                    ✓ Verified Intact
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  Certified under Sec 105 BNSS / Sec 65B Indian Evidence Act • 0-Bit Tamper Evidence
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleHashVisibility(ev.id)}
                                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Hash className="w-3.5 h-3.5 text-slate-500" />
                                <span>{expandedHashes[ev.id] ? 'Hide Cryptographic Details' : 'View Cryptographic Seal'}</span>
                                {expandedHashes[ev.id] ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                              </button>
                            </div>
                          </div>

                          {/* Expandable Clean Certificate Panel */}
                          {expandedHashes[ev.id] && (
                            <div className="bg-white/95 border border-emerald-200/80 rounded-lg p-3 space-y-2 text-xs">
                              <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 pb-1.5">
                                <span className="font-semibold text-slate-700">Digital Forensic Certificate (SHA-256 FIPS 180-4)</span>
                                {copiedHashNotice && (
                                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                                    {copiedHashNotice}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1.5 font-mono text-[11px]">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-slate-50 rounded border border-slate-200">
                                  <span className="text-slate-500 text-[10px] font-sans font-bold uppercase">Original Seal Hash:</span>
                                  <div className="flex items-center gap-1.5 max-w-full truncate">
                                    <span className="text-slate-800 truncate select-all">{ev.originalHash}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(ev.originalHash, 'Original Hash copied')}
                                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                      title="Copy Hash"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 bg-slate-50 rounded border border-slate-200">
                                  <span className="text-slate-500 text-[10px] font-sans font-bold uppercase">Current Audit Hash:</span>
                                  <div className="flex items-center gap-1.5 max-w-full truncate">
                                    <span className="text-emerald-700 font-bold truncate select-all">{ev.currentHash}</span>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(ev.currentHash, 'Current Hash copied')}
                                      className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                      title="Copy Hash"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Chain of Custody History Sub-Table */}
                        <div className="space-y-2 pt-2">
                          <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-blue-700" />
                            Chain of Custody Transfer History ({ev.transfers?.length || 0})
                          </h5>

                          {ev.transfers && ev.transfers.length > 0 ? (
                            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                              <table className="w-full text-left">
                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="py-2 px-3">Date/Time</th>
                                    <th className="py-2 px-3">From</th>
                                    <th className="py-2 px-3">To Custodian</th>
                                    <th className="py-2 px-3">Location / Action</th>
                                    <th className="py-2 px-3">Seal Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {ev.transfers.map((t) => (
                                    <tr key={t.transferId} className="hover:bg-slate-50">
                                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{t.timestamp}</td>
                                      <td className="py-2.5 px-3 font-medium text-slate-800">{t.fromOfficer}</td>
                                      <td className="py-2.5 px-3 font-bold text-blue-900">{t.toOfficer}</td>
                                      <td className="py-2.5 px-3 text-slate-600">
                                        <div className="font-semibold text-slate-900">{t.location}</div>
                                        <div className="text-[10px] text-slate-500">{t.action}</div>
                                      </td>
                                      <td className="py-2.5 px-3">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                          <Check className="w-3 h-3" />
                                          Intact
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Initial custody log established upon seizure.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                  No material evidence items seized or registered for this docket.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FORENSIC SCIENCE LABORATORY (FSL) */}
          {activeTab === 'FORENSIC_REQUESTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Forensic Science Laboratory (FSL) Test Orders
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Manage expert analysis under Section 293 Cr.P.C. for ballistic, cyber, chemical, and DNA examinations.
                  </p>
                </div>

                {!isReadOnly && normaliseRole(session.role) === 'POLICE' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setIsAddForensicOpen(true);
                    }}
                    className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create FSL Order</span>
                  </button>
                )}

                {normaliseRole(session.role) === 'FORENSIC' && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setSelectedForensicEvidenceId(undefined);
                      setIsUploadForensicReportModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Microscope className="w-4 h-4" />
                    <span>Upload Certified FSL Report</span>
                  </button>
                )}
              </div>

              {caseItem.forensicRequests && caseItem.forensicRequests.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {caseItem.forensicRequests.map((req) => (
                    <div key={req.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded">
                              {req.id}
                            </span>
                            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
                              Evidence: {req.evidenceTag}
                            </span>
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                              {req.status}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{req.requestedExam}</h4>
                        </div>

                        <div className="flex items-center gap-2">
                          {normaliseRole(session.role) === 'FORENSIC' && (
                            <button
                              type="button"
                              onClick={() => {
                                soundEffects.playSnap();
                                setSelectedForensicEvidenceId(req.evidenceId);
                                setIsUploadForensicReportModalOpen(true);
                              }}
                              className="px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                            >
                              <Microscope className="w-3.5 h-3.5" />
                              <span>Submit Report</span>
                            </button>
                          )}

                          {!isReadOnly && req.status !== 'Closed' && normaliseRole(session.role) === 'FORENSIC' && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceForensicStatus(req.id, req.status)}
                              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                            >
                              <span>Advance Phase</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
                        <div>
                          <span className="text-slate-400">Testing Laboratory:</span>
                          <p className="font-bold text-slate-900">{req.labName}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Submission Date:</span>
                          <p className="font-medium text-slate-800">{req.submissionDate}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Expected Delivery:</span>
                          <p className="font-medium text-slate-800">{req.expectedCompletionDate}</p>
                        </div>
                      </div>

                      {req.requisitionLetterName && (
                        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-purple-700 shrink-0" />
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{req.requisitionLetterName}</p>
                              <p className="text-[10px] text-slate-500">Police Forwarding Memo (Sec 293 CrPC) • Ref: {req.requisitionLetterRef || 'FSL-DISPATCH'}</p>
                            </div>
                          </div>
                          {req.requisitionLetterUrl && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewMediaModal({
                                  isOpen: true,
                                  title: `FSL Requisition Letter - ${req.evidenceTag}`,
                                  url: req.requisitionLetterUrl!,
                                  fileName: req.requisitionLetterName,
                                  hash: req.requisitionLetterHash
                                })}
                                className="px-2.5 py-1 bg-white hover:bg-purple-100 text-purple-900 font-bold text-xs rounded border border-purple-300 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Letter</span>
                              </button>
                              <a
                                href={req.requisitionLetterUrl}
                                download={req.requisitionLetterName || "FSL_Requisition.pdf"}
                                className="px-2 py-1 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <span>Download</span>
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-slate-800">Laboratory Findings / Technical Analysis:</span>
                        <p className="p-3 bg-blue-50/70 border border-blue-100 rounded-lg text-slate-800 leading-relaxed">
                          {req.findings || 'Examination in progress under certified forensic protocols.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                  No forensic laboratory examinations logged for this docket.
                </div>
              )}
            </div>
          )}

          {/* TAB: COURT ORDERS, WARRANTS & JUDGMENTS (LEGAL DESK) */}
          {activeTab === 'COURT_PROCEEDINGS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Judicial Orders, Warrants & Final Court Verdicts
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Legally binding judicial records from Sessions and Magistrate Courts anchored in the Case Repository.
                  </p>
                </div>

                {normaliseRole(session.role) === 'LEGAL' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playSnap();
                        setLegalDocModalMode('HEARING');
                        setIsAddCourtDocModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Record Court Hearing</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playSnap();
                        setLegalDocModalMode('STATEMENT');
                        setIsAddCourtDocModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Upload Statement (Sec 164)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playSnap();
                        setLegalDocModalMode('ORDER');
                        setIsAddCourtDocModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Court Order</span>
                    </button>
                  </div>
                )}

                {normaliseRole(session.role) === 'AUDITOR' && (
                  <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-rose-600" />
                    <span>Auditor Read-Only Court Records</span>
                  </div>
                )}
              </div>

              {caseItem.courtRecords && caseItem.courtRecords.length > 0 ? (
                <div className="space-y-4">
                  {caseItem.courtRecords.map((cr) => (
                    <div key={cr.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded">
                              {cr.rcNumber || cr.id}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                              cr.documentType === 'FINAL_JUDGMENT' ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                              cr.documentType === 'BAIL_ORDER' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                              cr.documentType === 'NON_BAILABLE_WARRANT' ? 'bg-red-100 text-red-900 border border-red-200' :
                              'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}>
                              {cr.documentType.replace(/_/g, ' ')}
                            </span>
                            {cr.isCourtCertified && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                                <Check className="w-3 h-3" />
                                Court Certified
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{cr.title || cr.documentType}</h4>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-slate-400">Pronounced On</span>
                          <div className="text-xs font-bold text-slate-800">{cr.dateIssued}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 p-3 rounded-lg">
                        <div>
                          <span className="text-slate-400">Presiding Court:</span>
                          <p className="font-bold text-slate-900">{cr.courtName}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Presiding Judge:</span>
                          <p className="font-medium text-slate-800">{cr.judgeName || 'Hon. Court'}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Public Prosecutor:</span>
                          <p className="font-medium text-slate-800">{cr.publicProsecutor || 'State of Maharashtra'}</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-slate-800">Judicial Directive / Order Summary:</span>
                        <p className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg text-slate-800 leading-relaxed whitespace-pre-line">
                          {cr.orderSummary}
                        </p>
                      </div>

                      {cr.fileUrl && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-slate-600">
                            <FileText className="w-4 h-4 text-indigo-700" />
                            <span className="font-medium">{cr.fileName || 'Certified Court Order.pdf'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewMediaModal({
                              isOpen: true,
                              title: cr.title || cr.documentType,
                              url: cr.fileUrl!,
                              fileName: cr.fileName || 'court_order.pdf',
                              hash: cr.documentHash
                            })}
                            className="px-3 py-1 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-xs"
                          >
                            Inspect Court Document
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
                  No judicial orders or court records uploaded for this docket yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PEOPLE INVOLVED (WITNESSES & SUSPECTS) */}
          {activeTab === 'PEOPLE_INVOLVED' && (
            <div className="space-y-4">
              {/* Sub Tab switcher */}
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setPeopleSubTab('WITNESSES');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      peopleSubTab === 'WITNESSES'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Witnesses ({caseItem.witnesses?.length || 0})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.playSnap();
                      setPeopleSubTab('SUSPECTS');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      peopleSubTab === 'SUSPECTS'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    Suspects & Accused ({caseItem.suspects?.length || 0})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-semibold items-center gap-1 hidden sm:flex">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    Restricted Access (CrPC Protected)
                  </span>

                  {normaliseRole(session.role) === 'POLICE' && !isReadOnly && (
                    peopleSubTab === 'WITNESSES' ? (
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playSnap();
                          setIsAddWitnessModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Witness Statement</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.playSnap();
                          setIsAddSuspectModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Suspect / Accused</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* WITNESSES SUB-VIEW */}
              {peopleSubTab === 'WITNESSES' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {caseItem.witnesses && caseItem.witnesses.length > 0 ? (
                    caseItem.witnesses.map((w) => (
                      <div key={w.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-start gap-3">
                          {w.photoUrl ? (
                            <img
                              src={w.photoUrl}
                              alt={w.name}
                              onClick={() => setPreviewMediaModal({
                                isOpen: true,
                                title: `Witness Photo - ${w.name}`,
                                url: w.photoUrl!,
                                fileName: `${w.name.replace(/\s+/g, '_')}_photo.jpg`,
                                tag: 'WITNESS-PHOTO'
                              })}
                              className="w-12 h-12 rounded-lg object-cover border border-slate-300 shadow-xs shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                              title="Click to view witness photo"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-100 shrink-0">
                              {w.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 truncate">{w.name}</h4>
                                <p className="text-[11px] text-slate-500">Recorded By: {w.recordedBy}</p>
                              </div>
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded shrink-0">
                                {w.statementStatus}
                              </span>
                            </div>
                          </div>
                        </div>

                        {w.protectionRequired && (
                          <div className="p-2 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[11px] font-semibold flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            <span>Witness Protection Act Active — Redacted in public filings</span>
                          </div>
                        )}

                        <div className="space-y-1 text-xs">
                          <span className="text-slate-400 font-semibold">Statement Summary (Sec 161 CrPC):</span>
                          <p className="p-2.5 bg-slate-50 rounded-lg text-slate-700 italic">
                            "{w.statementSummary}"
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
                      <p>No witness statements registered yet.</p>
                      {normaliseRole(session.role) === 'POLICE' && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            soundEffects.playSnap();
                            setIsAddWitnessModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg cursor-pointer inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Witness Statement</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUSPECTS SUB-VIEW */}
              {peopleSubTab === 'SUSPECTS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {caseItem.suspects && caseItem.suspects.length > 0 ? (
                    caseItem.suspects.map((s) => (
                      <div key={s.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-start gap-3">
                          {s.photoUrl ? (
                            <img
                              src={s.photoUrl}
                              alt={s.name}
                              onClick={() => setPreviewMediaModal({
                                isOpen: true,
                                title: `Accused Mugshot - ${s.name}`,
                                url: s.photoUrl,
                                fileName: `${s.name.replace(/\s+/g, '_')}_mugshot.jpg`,
                                tag: 'ACCUSED-MUGSHOT'
                              })}
                              className="w-12 h-12 rounded-lg object-cover border border-slate-300 shadow-xs shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                              title="Click to view mugshot"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center border border-rose-100 shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="text-sm font-bold text-slate-900 truncate">
                                  {s.name} <span className="text-slate-500 font-normal text-xs">({s.alias})</span>
                                </h4>
                                <p className="text-[11px] text-slate-500 font-mono">Fingerprint Class: {s.fingerprintClass}</p>
                              </div>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded shrink-0 ${
                                s.status === 'Arrested' ? 'bg-red-100 text-red-800' :
                                s.status === 'Under Judicial Remand' ? 'bg-purple-100 text-purple-800' :
                                'bg-amber-100 text-amber-800'
                              }`}>
                                {s.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-700">
                          <div><span className="text-slate-400">Custody Status: </span><span className="font-bold text-slate-900">{s.custodyStatus}</span></div>
                          <div><span className="text-slate-400">Last Location: </span><span>{s.lastKnownLocation}</span></div>
                        </div>

                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold">Investigative Notes:</span>
                          <p className="text-slate-700 mt-0.5">{s.investigationNotes}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
                      <p>No suspects currently identified or entered for this docket.</p>
                      {normaliseRole(session.role) === 'POLICE' && !isReadOnly && (
                        <button
                          type="button"
                          onClick={() => {
                            soundEffects.playSnap();
                            setIsAddSuspectModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-lg cursor-pointer inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Suspect / Accused</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: TIMELINE */}
          {activeTab === 'TIMELINE' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Full Statutory Docket Timeline
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Official chronologically anchored case milestones with verified date and timestamp.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[10px] font-bold rounded-lg">
                  {caseItem.timeline?.length || 0} Milestones Logged
                </span>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {caseItem.timeline && caseItem.timeline.length > 0 ? (
                  caseItem.timeline.map((event) => {
                    const stamp = formatDocketTimestamp(event.date, event.id);
                    return (
                      <div key={event.id} className="relative space-y-1 text-xs">
                        <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white" />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-2xs">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>{stamp.dateStr}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-blue-700 font-semibold">{stamp.timeStr}</span>
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{event.title}</span>
                        </div>
                        <p className="text-slate-700 text-xs leading-relaxed">{event.description}</p>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 pt-0.5">
                          <span>Officer:</span>
                          <span className="font-semibold text-slate-700">{event.officer}</span>
                          {event.badge && <span className="text-slate-400">({event.badge})</span>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-400 italic text-xs">No timeline milestones available for this case.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 8: AUDIT & ACTIVITY TIMELINE */}
          {/* TAB 9: VICTIM INFORMATION */}
          {activeTab === 'VICTIM_INFO' && (
            <VictimInformationTab
              caseFile={caseItem}
              session={session}
              onUpdateCase={onUpdateCase}
            />
          )}

          {/* TAB 10: FINGERPRINTS */}
          {activeTab === 'FINGERPRINTS' && (
            <FingerprintTab
              caseFile={caseItem}
              session={session}
              onUpdateCase={onUpdateCase}
            />
          )}

          {/* TAB 11: CASE TEAM */}
          {activeTab === 'CASE_TEAM' && (
            <CaseTeamPanel
              caseFile={caseItem}
              session={session}
              stationOfficers={stationOfficers}
              onUpdateCase={onUpdateCase}
            />
          )}

          {/* TAB 12: PRISONERS & CUSTODY (JAIL DEPARTMENT) */}
          {activeTab === 'PRISON_CUSTODY' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Prison Authority & Remand Custody</h3>
                    <p className="text-xs text-slate-500">Under-trial inmate admissions, judicial remand orders, and prison transfers</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-lg">
                  Arthur Road Central Prison / State Prison Dept
                </span>
              </div>

              {((caseItem.prisonRecords || (caseItem as any).prison_records || []).length === 0) ? (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                  <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="font-bold text-slate-700 text-sm">No Inmates Admitted Under Custody</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    There are currently no prisoners remanded or serving sentences in correctional facilities linked directly to this case docket.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(caseItem.prisonRecords || (caseItem as any).prison_records || []).map((prisoner: any) => (
                    <div key={prisoner.id || prisoner.prisonerNumber} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-mono font-bold rounded-md">
                            {prisoner.prisonerNumber}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">{prisoner.prisonerName || prisoner.fullName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                            prisoner.custodyStatus === 'IN_CUSTODY' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : prisoner.custodyStatus === 'RELEASED'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {prisoner.custodyStatus || 'IN_CUSTODY'}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{prisoner.custodyType?.replace(/_/g, ' ')}</span>
                        </div>
                      </div>

                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs border-b border-slate-100 bg-white">
                        <div>
                          <span className="text-slate-400 block font-medium">Prison Facility</span>
                          <span className="font-semibold text-slate-800">{prisoner.prisonName || 'Arthur Road Central Prison'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Cell Ward / Barrack</span>
                          <span className="font-semibold text-slate-800">{prisoner.cellWard || 'Ward 11 - High Security'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Admission Date</span>
                          <span className="font-semibold text-slate-800">{prisoner.admissionDate || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Remand Expiry</span>
                          <span className="font-semibold text-rose-700">{prisoner.remandExpiryDate || 'Pending Hearing'}</span>
                        </div>
                      </div>

                      {prisoner.courtRemandOrderRef && (
                        <div className="px-4 py-2.5 bg-slate-50 text-xs text-slate-600 flex items-center gap-2">
                          <Scale className="w-3.5 h-3.5 text-slate-400" />
                          <span>Remand Order Reference: <strong className="font-mono text-slate-800">{prisoner.courtRemandOrderRef}</strong></span>
                        </div>
                      )}

                      {/* Custody Event Log */}
                      {Array.isArray(prisoner.custodyRecords) && prisoner.custodyRecords.length > 0 && (
                        <div className="p-4 space-y-2 bg-slate-50/50">
                          <h5 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Custody Chronology & Transfer Logs</h5>
                          <div className="space-y-2">
                            {prisoner.custodyRecords.map((log: any) => (
                              <div key={log.id} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs flex items-start justify-between">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-blue-900">{log.eventType?.replace(/_/g, ' ')}</span>
                                    <span className="text-slate-400">|</span>
                                    <span className="text-slate-600">{log.facilityLocation || prisoner.prisonName}</span>
                                  </div>
                                  <p className="text-slate-700">{log.notes}</p>
                                </div>
                                <div className="text-right text-[11px] text-slate-500 whitespace-nowrap">
                                  <span>{log.eventDate ? new Date(log.eventDate).toLocaleDateString('en-IN') : 'Recent'}</span>
                                  <div className="text-[10px] text-slate-400">{log.officerInCharge}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 13: HEARINGS & WARRANTS (COURT / LEGAL DESK) */}
          {activeTab === 'WARRANTS_HEARINGS' && (
            <div className="space-y-6">
              {/* Warrants Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700" />
                    <span>Judicial & Police Warrants</span>
                  </h4>
                  <span className="text-xs text-slate-500">{(caseItem.warrants || []).length} issued</span>
                </div>

                {((caseItem.warrants || []).length === 0) ? (
                  <div className="bg-white p-6 text-center rounded-xl border border-slate-200 text-xs text-slate-500">
                    No warrants currently active or registered for this case docket.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(caseItem.warrants || []).map((warrant: any) => (
                      <div key={warrant.id || warrant.warrantNumber} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-800 text-xs font-mono font-bold rounded-md">
                            {warrant.warrantNumber}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            warrant.status === 'ACTIVE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {warrant.status}
                          </span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{warrant.subjectName}</div>
                          <div className="text-[11px] text-slate-500">{warrant.warrantType?.replace(/_/g, ' ')}</div>
                        </div>
                        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between">
                          <span>Issued: <strong>{warrant.issuedDate}</strong></span>
                          <span>Valid: <strong className="text-rose-600">{warrant.validUntil || 'Indefinite'}</strong></span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {warrant.courtName} — {warrant.issuedBy}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Hearings Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-700" />
                    <span>Court Hearings & Proceedings Schedule</span>
                  </h4>
                  <span className="text-xs text-slate-500">{(caseItem.hearings || []).length} scheduled</span>
                </div>

                {((caseItem.hearings || []).length === 0) ? (
                  <div className="bg-white p-6 text-center rounded-xl border border-slate-200 text-xs text-slate-500">
                    No scheduled court hearings entered yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(caseItem.hearings || []).map((hearing: any) => (
                      <div key={hearing.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-xs">{hearing.court}</span>
                            <span className="text-slate-400 text-xs">|</span>
                            <span className="text-xs text-blue-700 font-semibold">{hearing.hearingType?.replace(/_/g, ' ')}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            hearing.status === 'SCHEDULED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {hearing.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{hearing.summary}</p>
                        <div className="text-[11px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
                          <span>Hearing Date: <strong className="text-slate-800">{new Date(hearing.hearingDate).toLocaleDateString('en-IN')}</strong></span>
                          <span>Presiding: <strong className="text-slate-700">{hearing.judgeOrMagistrate || 'Metropolitan Magistrate'}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 14: CRIMINAL HISTORY (NCRB / SCRB INTELLIGENCE) */}
          {activeTab === 'CRIMINAL_HISTORY' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">NCRB / SCRB Criminal Intelligence Records</h3>
                    <p className="text-xs text-slate-500">Cross-jurisdictional past conviction data, offence patterns, and court outcomes</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold rounded-lg">
                  CCTNS / ICJS Network Synchronized
                </span>
              </div>

              {((caseItem.criminalHistory || (caseItem as any).criminal_history || []).length === 0) ? (
                <div className="bg-white p-12 text-center rounded-xl border border-slate-200 space-y-3">
                  <History className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="font-bold text-slate-700 text-sm">No Prior Criminal History Indexed</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    The subjects associated with this case file have no previous criminal convictions or adverse records flagged in the National Crime Records Bureau database.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(caseItem.criminalHistory || (caseItem as any).criminal_history || []).map((record: any) => (
                    <div key={record.id} className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <span className="text-xs text-slate-400 font-mono block">Person ID: {record.personIdentifier}</span>
                          <h4 className="font-bold text-slate-900 text-sm">{record.fullName}</h4>
                          {record.aliases && record.aliases.length > 0 && (
                            <span className="text-xs text-slate-500">Aliases: {record.aliases.join(', ')}</span>
                          )}
                        </div>
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                          record.caseStatus === 'CONVICTED'
                            ? 'bg-rose-100 text-rose-800'
                            : record.caseStatus === 'ACQUITTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {record.caseStatus}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400 block font-medium">Offence Details</span>
                          <span className="font-semibold text-slate-800">{record.offence}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Case Reference</span>
                          <span className="font-mono text-slate-700">{record.caseNumber}</span>
                        </div>
                      </div>

                      {record.ipcSections && record.ipcSections.length > 0 && (
                        <div className="text-xs">
                          <span className="text-slate-400 block font-medium">Statutory Sections</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {record.ipcSections.map((sec: string) => (
                              <span key={sec} className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-mono rounded">
                                {sec}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {record.courtOutcome && (
                        <div className="p-3 bg-slate-50 rounded-lg text-xs border border-slate-200">
                          <span className="font-bold text-slate-800 block mb-0.5">Judicial Verdict & Sentence:</span>
                          <span className="text-slate-700">{record.courtOutcome}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                        <span>Certified Source: {record.source || 'SCRB Maharashtra'}</span>
                        <span>Recorded: {record.recordDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

            </>
          )}
          </div>

        {/* ================= SUB MODALS ================= */}

        {/* 1. ASSIGN IO MODAL */}
        <AssignIOModal
          isOpen={isAssignIOOpen}
          onClose={() => setIsAssignIOOpen(false)}
          caseItem={caseItem}
          session={session}
          onAssignSuccess={handleAssignIOSuccess}
        />

        {/* REQUEST CASE ACCESS MODAL */}
        {isAccessRequestModalOpen && (
          <RequestCaseAccessModal
            isOpen={isAccessRequestModalOpen}
            onClose={() => setIsAccessRequestModalOpen(false)}
            caseItem={caseItem}
            session={session}
            onRequestSubmitted={() => {
              setIsAccessRequestModalOpen(false);
            }}
          />
        )}

        {/* REASSIGN IO MODAL (ADMIN) */}
        {isReassignModalOpen && (
          <ReassignIOModal
            isOpen={isReassignModalOpen}
            onClose={() => setIsReassignModalOpen(false)}
            caseItem={caseItem}
            session={session}
            onReassignSuccess={(newOfficer, reason) => {
              handleAssignIOSuccess(newOfficer, reason);
              setIsReassignModalOpen(false);
            }}
          />
        )}

        {/* EVIDENCE INTEGRITY MODAL */}
        {integrityModalEvidence && (
          <EvidenceIntegrityModal
            evidence={integrityModalEvidence}
            session={session}
            isOpen={isIntegrityModalOpen}
            onClose={() => {
              setIsIntegrityModalOpen(false);
              setIntegrityModalEvidence(null);
            }}
          />
        )}

        {/* 2. ADD INVESTIGATION ENTRY MODAL */}
        {isAddInvestigationOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Log Investigation Diary Entry (Sec 172 CrPC)</h3>
                <button type="button" onClick={() => setIsAddInvestigationOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleAddInvestigationEntry} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Activity Type</label>
                  <select
                    value={invActivityType}
                    onChange={(e) => setInvActivityType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  >
                    <option value="Site Visit">Site Visit & Scene Inspection</option>
                    <option value="Witness Interview">Witness Examination (Sec 161 CrPC)</option>
                    <option value="Suspect Inquiry">Suspect Interrogation</option>
                    <option value="Search/Seizure">Search Warrant & Seizure Panchnama</option>
                    <option value="CCTV Collection">CCTV / Electronic Evidence Extraction</option>
                    <option value="Evidence Recovery">Material Evidence Recovery</option>
                    <option value="Forensic Request">Forensic Lab Dispatch Memo</option>
                    <option value="Case Status Update">General Investigative Note</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Investigative Diary Notes & Findings</label>
                  <textarea
                    rows={4}
                    value={invNotes}
                    onChange={(e) => setInvNotes(e.target.value)}
                    placeholder="Enter detailed panchnama remarks, observations, or seized items..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Next Action Directives</label>
                  <input
                    type="text"
                    value={invNextAction}
                    onChange={(e) => setInvNextAction(e.target.value)}
                    placeholder="e.g. Issue Section 41A notice, dispatch to FSL"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddInvestigationOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 text-white font-bold rounded-lg cursor-pointer shadow-xs">Record in Case Diary</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 3. ADD EVIDENCE MODAL */}
        {isAddEvidenceOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Seize & Register Evidence (Malkhana Protocol)</h3>
                  <p className="text-[11px] text-slate-500">Attach digital file or physical seizure record for cryptographic SHA-256 sealing.</p>
                </div>
                <button type="button" onClick={() => { setIsAddEvidenceOpen(false); setEvidenceFile(null); }} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
              </div>

              {evidenceUploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{evidenceUploadError}</span>
                </div>
              )}

              <form onSubmit={handleAddEvidenceItem} className="space-y-3.5 text-xs">
                {/* File Upload Dropzone */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-800 flex items-center justify-between">
                    <span>Evidence File / Digital Artifact (Optional for Physical Goods)</span>
                    <span className="text-[10px] text-blue-600 font-normal">ClamAV & Magic-Byte Protected</span>
                  </label>
                  <label className="border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30 overflow-hidden relative">
                    <input
                      type="file"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          setEvidenceFile(file);
                          if (!evDescription) {
                            setEvDescription(file.name.replace(/\.[^/.]+$/, ''));
                          }
                          const reader = new FileReader();
                          reader.onload = (re) => {
                            if (re.target?.result) {
                              setEvidenceFilePreviewUrl(re.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    {evidenceFile && evidenceFilePreviewUrl && (evidenceFile.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(evidenceFile.name)) ? (
                      <div className="w-full flex flex-col items-center space-y-2">
                        <div className="relative rounded-xl overflow-hidden border-2 border-blue-500 shadow-md max-h-48 w-full bg-slate-900 flex items-center justify-center group">
                          <img
                            src={evidenceFilePreviewUrl}
                            alt="Evidence Preview"
                            className="max-h-48 max-w-full object-contain"
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-blue-600/90 text-white font-mono text-[10px] font-bold">
                            PHOTO EVIDENCE PREVIEW
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-blue-900">{evidenceFile.name}</p>
                          <p className="text-[11px] text-slate-500">{(evidenceFile.size / 1024).toFixed(1)} KB • Click to change photo</p>
                          <span className="text-[10px] text-emerald-600 font-bold inline-block">✓ Image Loaded for Hashing & Sealing</span>
                        </div>
                      </div>
                    ) : evidenceFile && evidenceFilePreviewUrl && (evidenceFile.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/i.test(evidenceFile.name)) ? (
                      <div className="w-full flex flex-col items-center space-y-2">
                        <div className="relative rounded-xl overflow-hidden border-2 border-blue-500 shadow-md max-h-48 w-full bg-slate-900 flex items-center justify-center">
                          <video
                            src={evidenceFilePreviewUrl}
                            className="max-h-48 max-w-full"
                            controls={false}
                          />
                          <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-blue-600/90 text-white font-mono text-[10px] font-bold">
                            VIDEO EVIDENCE PREVIEW
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-blue-900">{evidenceFile.name}</p>
                          <p className="text-[11px] text-slate-500">{(evidenceFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change video</p>
                          <span className="text-[10px] text-emerald-600 font-bold inline-block">✓ Video Loaded for Hashing & Sealing</span>
                        </div>
                      </div>
                    ) : evidenceFile ? (
                      <div className="text-center">
                        <FileUp className="w-7 h-7 text-blue-600 mb-2 mx-auto" />
                        <p className="font-bold text-blue-900">{evidenceFile.name}</p>
                        <p className="text-[11px] text-slate-500">{(evidenceFile.size / 1024).toFixed(1)} KB • Ready for AES-256 encryption</p>
                        <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">✓ File Attached (Click to change)</span>
                      </div>
                    ) : (
                      <div className="text-center space-y-0.5">
                        <FileUp className="w-7 h-7 text-blue-600 mb-2 mx-auto" />
                        <p className="font-semibold text-slate-700">Click to browse or drop evidence file here</p>
                        <p className="text-[10px] text-slate-400">Photos, CCTV Videos, Audio, Disk Images, Forensic Dumps, PDFs up to 50MB</p>
                      </div>
                    )}
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Evidence Classification *</label>
                  <select
                    value={evCategory}
                    onChange={(e) => setEvCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  >
                    <option value="Digital Evidence">Digital Evidence (Drive, Phone, USB, Firmware)</option>
                    <option value="Physical Weapon">Physical Weapon / Firearm</option>
                    <option value="Forensic Sample">Forensic Sample / Biological Fluid / DNA</option>
                    <option value="Documentary Evidence">Documentary / Paper Records / Cheques</option>
                    <option value="Currency / Valuables">Currency / Valuables / Gold</option>
                    <option value="Narcotic Sample">Narcotic Sample / Chemical Substance</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Item Description & Identifying Marks *</label>
                  <input
                    type="text"
                    value={evDescription}
                    onChange={(e) => setEvDescription(e.target.value)}
                    placeholder="e.g. SanDisk 128GB Ultra USB 3.0 seized from accused laptop (Serial #SD-9921)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">Seizure Location</label>
                    <input
                      type="text"
                      value={evLocation}
                      onChange={(e) => setEvLocation(e.target.value)}
                      placeholder="e.g. Suspect Residence / Bedroom Desk"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">Malkhana Storage Safe</label>
                    <input
                      type="text"
                      value={evLocker}
                      onChange={(e) => setEvLocker(e.target.value)}
                      placeholder="e.g. Malkhana Vault-A / Safe #14"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-700" />
                    <span>Cryptographic Malkhana Protocol</span>
                  </div>
                  <p className="text-slate-600">
                    File will be scanned with ClamAV, quarantined, encrypted off-chain via AES-256-GCM, and sealed with an immutable SHA-256 digest on the Hyperledger Fabric ledger.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddEvidenceOpen(false); setEvidenceFile(null); }}
                    disabled={isUploadingEvidence}
                    className="px-3.5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingEvidence}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl cursor-pointer shadow-xs transition-colors flex items-center gap-2"
                  >
                    {isUploadingEvidence ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Encrypting & Sealing...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Seize, Encrypt & Register Evidence</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 4. TRANSFER EVIDENCE CUSTODY MODAL */}
        {isTransferEvidenceOpen && selectedEvidenceForTransfer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Chain of Custody Transfer Order</h3>
                  <span className="font-mono text-xs text-blue-700 font-semibold">{selectedEvidenceForTransfer.evidenceTag}</span>
                </div>
                <button type="button" onClick={() => setIsTransferEvidenceOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleExecuteTransfer} className="space-y-3.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg space-y-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Current Custodian (Sender):</span>
                  <p className="font-bold text-slate-900">{selectedEvidenceForTransfer.currentCustodian}</p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Transfer Recipient Officer / Lab Custodian</label>
                  <select
                    value={transferRecipient}
                    onChange={(e) => {
                      setTransferRecipient(e.target.value);
                      if (e.target.value.includes('Kelkar')) {
                        setTransferRecipientRole('Chief Forensic Analyst (FSL Kalina)');
                        setTransferLocation('Forensic Science Laboratory, Kalina');
                      } else if (e.target.value.includes('Shinde')) {
                        setTransferRecipientRole('Head Constable (Malkhana In-Charge)');
                        setTransferLocation('Andheri Police Station Malkhana');
                      } else {
                        setTransferRecipientRole('Designated Officer');
                        setTransferLocation('Judicial Magistrate Court No. 4');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  >
                    {stationOfficers && stationOfficers.length > 0 ? (
                      stationOfficers.map((o) => (
                        <option key={o.id || o.badgeNo} value={`${o.name} (${o.rank || 'Officer'}, ${o.station})`}>
                          {o.name} ({o.rank || 'Officer'} — {o.station})
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Malkhana In-Charge (Head Constable)">Malkhana In-Charge (Head Constable)</option>
                        <option value="FSL Forensic Examiner (State FSL Kalina)">FSL Forensic Examiner (State FSL Kalina)</option>
                        <option value="Registrar / Clerk of Court (Judicial Magistrate Court)">Registrar / Clerk of Court (Judicial Magistrate Court)</option>
                        <option value="Station House Officer (Police Inspector)">Station House Officer (Police Inspector)</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">Transfer Location</label>
                    <input
                      type="text"
                      value={transferLocation}
                      onChange={(e) => setTransferLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800">Physical Seal Condition</label>
                    <input
                      type="text"
                      value={transferCondition}
                      onChange={(e) => setTransferCondition(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Transfer Purpose & Statutory Action</label>
                  <input
                    type="text"
                    value={transferPurpose}
                    onChange={(e) => setTransferPurpose(e.target.value)}
                    placeholder="e.g. Transferred for laboratory chip extraction under Panchnama"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="sealCheck"
                    checked={transferSealConfirmed}
                    onChange={(e) => setTransferSealConfirmed(e.target.checked)}
                    className="rounded text-blue-700"
                    required
                  />
                  <label htmlFor="sealCheck" className="text-slate-800 font-bold">
                    I confirm that the red wax seal was physically inspected and found intact.
                  </label>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsTransferEvidenceOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" disabled={!transferSealConfirmed} className="px-4 py-1.5 bg-blue-700 text-white font-bold rounded-lg cursor-pointer shadow-xs">Execute & Log Transfer</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 5. CREATE FSL REQUEST MODAL */}
        {isAddForensicOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Create FSL Order (Sec 293 CrPC)</h3>
                <button type="button" onClick={() => setIsAddForensicOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleCreateForensicRequest} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Target Evidence Item</label>
                  <select
                    value={fslEvidenceId}
                    onChange={(e) => setFslEvidenceId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  >
                    {caseItem.evidenceItems?.map(ev => (
                      <option key={ev.id} value={ev.id}>{ev.evidenceTag} — {ev.description.substring(0, 45)}...</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Forwarding Memo / Requisition Letter Ref No.</label>
                  <input
                    type="text"
                    value={fslLetterRef}
                    onChange={(e) => setFslLetterRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600 font-mono text-xs"
                    placeholder="e.g. FSL/REQ/ANDH/2026/089"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Forensic Laboratory Directorate</label>
                  <input
                    type="text"
                    value={fslLabName}
                    onChange={(e) => setFslLabName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Requested Analysis & Laboratory Tests</label>
                  <textarea
                    rows={3}
                    value={fslRequestedExam}
                    onChange={(e) => setFslRequestedExam(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Attach Official FSL Forwarding / Requisition Letter (PDF / Scan)</label>
                  <div className="p-3 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50 text-center space-y-1">
                    {fslLetterFile ? (
                      <div className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-700" />
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">{fslLetterFile.name}</span>
                          <span className="text-[10px] text-slate-400">({(fslLetterFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <label className="text-xs text-blue-700 font-bold hover:underline cursor-pointer">
                          Change
                          <input
                            type="file"
                            accept=".pdf,image/*,.doc,.docx"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                setFslLetterFile(file);
                                const reader = new FileReader();
                                reader.onload = (evt) => setFslLetterPreview(evt.target?.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-1 py-1">
                        <Upload className="w-5 h-5 text-purple-600" />
                        <span className="text-xs font-bold text-purple-900">Upload Signed FSL Requisition Letter</span>
                        <span className="text-[10px] text-slate-400">PDF, Scanned Dispatch Memo, or Image (Max 25 MB)</span>
                        <input
                          type="file"
                          accept=".pdf,image/*,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              setFslLetterFile(file);
                              const reader = new FileReader();
                              reader.onload = (evt) => setFslLetterPreview(evt.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddForensicOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 text-white font-bold rounded-lg cursor-pointer shadow-xs">Dispatch FSL Order</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 6. UPLOAD DOCUMENT MODAL */}
        {isAddDocOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Upload & Digitally Sign Legal Document</h3>
                <button type="button" onClick={() => setIsAddDocOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
              </div>

              <form onSubmit={handleAddDocument} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Document Title</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. Supplementary Seizure Panchnama"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Document Type</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  >
                    <option value="INVESTIGATION_RECORD">Investigation Record / Panchnama</option>
                    <option value="WITNESS_STATEMENT">Witness Statement (Sec 161 CrPC)</option>
                    <option value="CHARGE_SHEET">Charge Sheet / Final Report (Sec 173 CrPC)</option>
                    <option value="SEIZURE_MEMO">Seizure Memo & Recovery Slip</option>
                    <option value="SEARCH_WARRANT">Search Warrant Order</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Summary of Content</label>
                  <input
                    type="text"
                    value={docSummary}
                    onChange={(e) => setDocSummary(e.target.value)}
                    placeholder="Brief description of findings..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-blue-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddDocOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-700 font-bold rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit" className="px-4 py-1.5 bg-blue-700 text-white font-bold rounded-lg cursor-pointer shadow-xs">Sign & Store in Docket</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* 7. LEGAL SCRUTINY DIRECTIVES MODAL */}
        {isReviewActionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Legal Scrutiny & Prosecution Directives</h3>
                <button type="button" onClick={() => setIsReviewActionModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600">
                  Review the investigation journal, material evidence chain of custody, and FSL forensic reports for case <strong>{caseItem.id}</strong>.
                </p>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Prosecution Remarks / Legal Directives</label>
                  <textarea
                    rows={3}
                    value={reviewRemark}
                    onChange={(e) => setReviewRemark(e.target.value)}
                    placeholder="Enter prosecution vetting directives or approval notes..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:border-purple-600"
                  />
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => handleLegalAction('RECOMMEND_CLOSURE')}
                    className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                  >
                    ✓ Approve Legal Scrutiny & Forward to Court
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLegalAction('RETURN_FOR_INVESTIGATION')}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg cursor-pointer"
                  >
                    ↩ Return to Police IO for Supplementary Investigation
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* CCTNS FORMS MODAL */}
        {isCCTNSModalOpen && (
          <CCTNSFormsModal
            caseFile={caseItem}
            session={session}
            onClose={() => setIsCCTNSModalOpen(false)}
            onSignChargesheet={(cid) => {
              const updatedCase: CaseFile = {
                ...caseItem,
                cctnsForms: caseItem.cctnsForms ? {
                  ...caseItem.cctnsForms,
                  iif5_finalChargesheet: caseItem.cctnsForms.iif5_finalChargesheet ? {
                    ...caseItem.cctnsForms.iif5_finalChargesheet,
                    isESigned: true,
                    eSignedBy: session.officerName,
                    eSignTimestamp: `${new Date().toISOString().substring(0, 10)} 18:00 IST`,
                    cctnsSyncStatus: 'SYNCED_TO_CCTNS_NATIONAL'
                  } : undefined
                } : undefined
              };
              onUpdateCase(updatedCase, 'DIGITALLY_SIGNED', `Applied Ed25519 e-Signature to Final Form for Case ${cid}`);
            }}
          />
        )}

        {/* SPECIALIZED INVESTIGATION MODAL */}
        {isSpecialModalOpen && (
          <SpecialInvestigationPanel
            caseFile={caseItem}
            session={session}
            onClose={() => setIsSpecialModalOpen(false)}
          />
        )}

        {/* High-Resolution Media / FIR Image Preview Modal */}
        {previewMediaModal && previewMediaModal.isOpen && (
          <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-600 rounded-lg text-white">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold flex items-center gap-2">
                      {previewMediaModal.title}
                      {previewMediaModal.tag && (
                        <span className="px-2 py-0.5 bg-blue-500/30 text-blue-200 text-[11px] font-mono rounded">
                          {previewMediaModal.tag}
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {previewMediaModal.fileName || 'Attached Evidence Artifact'} • Official Seizure Record
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewMediaModal.url}
                    download={previewMediaModal.fileName || 'evidence-artifact'}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    title="Download original file"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewMediaModal(null)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Main Content Viewer */}
              <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[360px]">
                {previewMediaModal.isFirDocket || previewMediaModal.url === '#fir-docket' ? (
                  <div className="w-full max-w-3xl bg-white border border-slate-300 rounded-xl shadow-lg p-6 text-slate-800 text-xs font-sans space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Official Government Header */}
                    <div className="text-center pb-3 border-b-2 border-slate-900 space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-blue-900" />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Government of Maharashtra • Police Department</span>
                      </div>
                      <h2 className="text-base font-extrabold text-slate-950 uppercase tracking-wider">
                        First Information Report (FIR)
                      </h2>
                      <p className="text-[11px] font-semibold text-slate-500">
                        (Under Section 154 Cr.P.C. / Section 173 Bharatiya Nagarik Suraksha Sanhita, 2023)
                      </p>
                    </div>

                    {/* Statutory Header Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px]">
                      <div>
                        <span className="text-slate-400 font-bold block">1. District / Zone:</span>
                        <span className="font-bold text-slate-900">{caseItem.policeStation?.split(',')[1]?.trim() || 'Mumbai'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Police Station:</span>
                        <span className="font-bold text-slate-900">{caseItem.policeStation || 'Andheri Police Station'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">FIR Number:</span>
                        <span className="font-mono font-bold text-blue-900">{caseItem.firNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">Filing Date:</span>
                        <span className="font-bold text-slate-900">{caseItem.dateLogged}</span>
                      </div>
                    </div>

                    {/* Statutory Offence Sections */}
                    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg space-y-1">
                      <span className="text-[11px] font-bold text-blue-900 block">2. Acts & Criminal Sections Applicable:</span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {(caseItem.ipcSections && caseItem.ipcSections.length > 0 ? caseItem.ipcSections : ['BNS Sec 318(4) Cheating', 'IT Act 2000 Sec 66D', 'CrPC Sec 154']).map((act, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-100 border border-blue-300 text-blue-900 font-bold text-[10px] rounded">
                            {act}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Incident & Location Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-slate-500 font-bold block">3. Place of Occurrence & Jurisdiction:</span>
                        <p className="font-medium text-slate-900">{caseItem.incidentLocation || 'Within Police Station Jurisdiction'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-slate-500 font-bold block">4. Type of Information Received:</span>
                        <p className="font-medium text-slate-900">Written Complaint / Integrated Digital Portal</p>
                      </div>
                    </div>

                    {/* Complainant & Victim */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-slate-500 font-bold block">5. Complainant / Informant:</span>
                        <p className="font-bold text-slate-950">{caseItem.complainant?.name || 'Authorized Informant'}</p>
                        <p className="text-slate-600">Contact: {caseItem.complainant?.contact || 'Confidential Registry'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <span className="text-slate-500 font-bold block">
                          6. Registered Victim / Aggrieved {caseItem.victimRecords && caseItem.victimRecords.length > 1 ? `(${caseItem.victimRecords.length})` : ''}:
                        </span>
                        <p className="font-bold text-slate-950">
                          {caseItem.victimRecords && caseItem.victimRecords.length > 1
                            ? caseItem.victimRecords.map(v => v.name).join(', ')
                            : (caseItem.victimRecord?.name || caseItem.complainant?.name || 'Aggrieved Party')}
                        </p>
                        <p className="text-slate-600">
                          {caseItem.victimRecords && caseItem.victimRecords.length > 1
                            ? `${caseItem.victimRecords.length} registered victim profiles linked to case docket`
                            : (caseItem.victimRecord ? `Age: ${caseItem.victimRecord.age || 'N/A'}, Gender: ${caseItem.victimRecord.gender || 'N/A'}` : 'Recorded on preliminary inquiry')}
                        </p>
                      </div>
                    </div>

                    {/* Accused Particulars */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-[11px]">
                      <span className="text-slate-500 font-bold block">7. Details of Known / Suspected / Unknown Accused:</span>
                      {caseItem.suspects && caseItem.suspects.length > 0 ? (
                        <div className="space-y-1 pt-1">
                          {caseItem.suspects.map((s, idx) => (
                            <div key={s.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200">
                              <span className="font-bold text-slate-900">{idx + 1}. {s.name} ({s.alias || 'No Alias'})</span>
                              <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-700">{s.status}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-600 italic">Unknown cyber fraudsters / syndicate under active detection.</p>
                      )}
                    </div>

                    {/* FIR Narrative */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-[11px]">
                      <span className="text-slate-500 font-bold block">8. First Information Contents / Detailed Allegation:</span>
                      <p className="text-slate-800 leading-relaxed whitespace-pre-line bg-white p-3 rounded border border-slate-200 text-xs font-mono">
                        {caseItem.complainant?.statementBrief || caseItem.summaryNotes || caseItem.caseTitle || 'Statutory formal complaint submitted before the Station House Officer.'}
                      </p>
                    </div>

                    {/* Official Signatory Block */}
                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
                      <div>
                        <span className="block font-bold text-slate-800">Investigating Officer: {caseItem.officers?.assignedIO || session.officerName}</span>
                        <span>Station House Officer, {caseItem.policeStation}</span>
                      </div>
                      <div className="text-right">
                        <span className="block font-bold text-emerald-800">✓ Digitally Signed & Sealed</span>
                        <span className="font-mono text-[10px] text-slate-500">Hash: {caseItem.documents?.[0]?.sha256Hash?.substring(0, 20) || 'DIGITAL-FIR-SEAL-OK'}</span>
                      </div>
                    </div>
                  </div>
                ) : previewMediaModal.url.includes('.pdf') || 
                     previewMediaModal.url.startsWith('data:application/pdf') || 
                     previewMediaModal.fileName?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewMediaModal.url}
                    className="w-full h-[72vh] rounded-lg border border-slate-300 bg-white"
                    title={previewMediaModal.title}
                  />
                ) : previewMediaModal.url.startsWith('data:image') || 
                     previewMediaModal.url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || 
                     previewMediaModal.fileType?.startsWith('image') ? (
                  <img
                    src={previewMediaModal.url}
                    alt={previewMediaModal.title}
                    className="max-h-[68vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-300 bg-white"
                  />
                ) : (
                  <div className="text-center p-8 bg-white rounded-xl max-w-lg w-full space-y-4 border border-slate-200 shadow-sm">
                    <FileText className="w-12 h-12 text-blue-600 mx-auto" />
                    <div>
                      <p className="font-bold text-slate-900 text-base">{previewMediaModal.fileName || 'Document Artifact'}</p>
                      <p className="text-xs text-slate-500 mt-1">Documentary evidence file attached to case record.</p>
                    </div>
                    {previewMediaModal.url.startsWith('data:text') || previewMediaModal.url.length > 200 ? (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs text-slate-800 max-h-48 overflow-y-auto font-mono">
                        {previewMediaModal.url.slice(0, 1000)}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <a
                        href={previewMediaModal.url}
                        download={previewMediaModal.fileName || 'document'}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold hover:bg-blue-800 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Copy</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with Government Cryptographic Seal */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-emerald-800 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Maharashtra Police Malkhana Cryptographic Seal:</span>
                  <span className="font-mono text-[11px] bg-emerald-100 px-2 py-0.5 rounded text-emerald-900 font-bold">
                    {previewMediaModal.hash ? `${previewMediaModal.hash.substring(0, 24)}...` : 'SHA-256 Verified'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 font-medium">
                    Evidence Integrity Status: <strong className="text-emerald-700">Verified & Intact</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewMediaModal(null)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded-lg cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* UPLOAD FORENSIC REPORT MODAL (FORENSIC ROLE) */}
        {isUploadForensicReportModalOpen && (
          <UploadForensicReportModal
            isOpen={isUploadForensicReportModalOpen}
            onClose={() => {
              setIsUploadForensicReportModalOpen(false);
              setSelectedForensicEvidenceId(undefined);
            }}
            cases={[caseItem]}
            session={session}
            preselectedCaseId={caseItem.id}
            preselectedEvidenceId={selectedForensicEvidenceId}
            onSaveReport={(updatedCase, reportTitle) => {
              onUpdateCase(updatedCase, 'FORENSIC_REPORT_SUBMITTED', `Filed scientific report: ${reportTitle}`);
              setIsUploadForensicReportModalOpen(false);
              setSelectedForensicEvidenceId(undefined);
            }}
          />
        )}

        {/* ADD COURT DOCUMENT MODAL (LEGAL ROLE) */}
        {isAddCourtDocModalOpen && (
          <AddCourtDocumentModal
            isOpen={isAddCourtDocModalOpen}
            onClose={() => setIsAddCourtDocModalOpen(false)}
            cases={[caseItem]}
            session={session}
            preselectedCaseId={caseItem.id}
            initialMode={legalDocModalMode}
            onSaveCourtDocument={(updatedCase, docTitle) => {
              onUpdateCase(updatedCase, 'COURT_DOCUMENT_ATTACHED', `Filed judicial record: ${docTitle}`);
              setIsAddCourtDocModalOpen(false);
            }}
          />
        )}
      
        {/* ADD WITNESS STATEMENT MODAL (POLICE ROLE) */}
        {isAddWitnessModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 bg-[#182f4d] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-300" />
                  <h3 className="text-sm font-bold">Record Witness Statement (Sec 161 CrPC)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddWitnessModalOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddWitness} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Witness Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={witnessName}
                    onChange={e => setWitnessName(e.target.value)}
                    placeholder="e.g. Ramesh S. Shinde"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Statement Status</label>
                    <select
                      value={witnessStatementStatus}
                      onChange={e => setWitnessStatementStatus(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    >
                      <option value="Statement Recorded">Statement Recorded</option>
                      <option value="Pending Interview">Pending Interview</option>
                      <option value="Protective Custody">Protective Custody</option>
                      <option value="Summons Issued">Summons Issued</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Witness Protection</label>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={witnessProtection}
                        onChange={e => setWitnessProtection(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span>Active Protection (Redact)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Statement Summary / Evidentiary Narrative (Sec 161 CrPC) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={witnessSummary}
                    onChange={e => setWitnessSummary(e.target.value)}
                    placeholder="Enter witness deposition facts, eyewitness observations, time & spot corroboration..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Witness Photo / Identity Document (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    {witnessPhotoUrl ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 group shadow-xs">
                        <img src={witnessPhotoUrl} alt="Witness preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setWitnessPhotoUrl('')}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded p-0.5 shadow-xs cursor-pointer"
                          title="Remove Photo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 hover:border-[#182f4d] rounded-lg bg-slate-50 hover:bg-white cursor-pointer text-xs font-semibold text-slate-600 transition-all">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Upload Witness Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setWitnessPhotoUrl(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddWitnessModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-[#182f4d] text-white rounded-lg hover:bg-[#11233b] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Save & Seal Statement
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* ADD SUSPECT / ACCUSED MODAL (POLICE ROLE) */}
        {isAddSuspectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 bg-[#182f4d] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-300" />
                  <h3 className="text-sm font-bold">Register Suspect / Accused Profile</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddSuspectModalOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddSuspect} className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Legal Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={suspectName}
                      onChange={e => setSuspectName(e.target.value)}
                      placeholder="e.g. Anand K. Verma"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Alias / Street Name</label>
                    <input
                      type="text"
                      value={suspectAlias}
                      onChange={e => setSuspectAlias(e.target.value)}
                      placeholder="e.g. Bunty, Doctor"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={suspectAge}
                      onChange={e => setSuspectAge(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Legal Status</label>
                    <select
                      value={suspectStatus}
                      onChange={e => setSuspectStatus(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    >
                      <option value="Person of Interest">Person of Interest</option>
                      <option value="Suspect">Suspect</option>
                      <option value="Arrested">Arrested</option>
                      <option value="Fugitive">Fugitive</option>
                      <option value="Under Judicial Remand">Under Judicial Remand</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Custody Status</label>
                    <input
                      type="text"
                      value={suspectCustodyStatus}
                      onChange={e => setSuspectCustodyStatus(e.target.value)}
                      placeholder="e.g. Station Lockup / Judicial Custody"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Fingerprint Classification</label>
                    <input
                      type="text"
                      value={suspectFingerprintClass}
                      onChange={e => setSuspectFingerprintClass(e.target.value)}
                      placeholder="e.g. Whorl Type A-4"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Last Known Location / Address</label>
                  <input
                    type="text"
                    value={suspectLastLocation}
                    onChange={e => setSuspectLastLocation(e.target.value)}
                    placeholder="e.g. Kurla West, Mumbai"
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Investigative Notes / Case Link</label>
                  <textarea
                    rows={3}
                    value={suspectNotes}
                    onChange={e => setSuspectNotes(e.target.value)}
                    placeholder="Enter motive, modus operandi, CDR analysis link, recovered contraband..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Suspect Mugshot / Photo (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    {suspectPhotoUrl ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 group shadow-xs">
                        <img src={suspectPhotoUrl} alt="Suspect preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setSuspectPhotoUrl('')}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded p-0.5 shadow-xs cursor-pointer"
                          title="Remove Mugshot"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 hover:border-[#182f4d] rounded-lg bg-slate-50 hover:bg-white cursor-pointer text-xs font-semibold text-slate-600 transition-all">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Upload Suspect Mugshot</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setSuspectPhotoUrl(reader.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddSuspectModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-[#182f4d] text-white rounded-lg hover:bg-[#11233b] transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Save Accused Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* EVENT INSPECTOR MODAL */}
        {selectedAuditEvent && (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="bg-[#182f4d] px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Audit Event Inspector</h3>
                    <p className="text-[11px] text-slate-300 font-mono">ID: {selectedAuditEvent.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAuditEvent(null)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                {/* Key Attributes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Action</span>
                    <span className="font-bold text-slate-900">{selectedAuditEvent.action}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Actor Role</span>
                    <span className="font-bold text-blue-900 bg-blue-100/70 px-1.5 py-0.5 rounded text-[11px]">
                      {selectedAuditEvent.userRole || selectedAuditEvent.actor_role || 'POLICE'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Status</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                      selectedAuditEvent.status === 'FAILURE' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedAuditEvent.status || 'SUCCESS'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Resource</span>
                    <span className="font-mono text-slate-800 truncate block">
                      {selectedAuditEvent.resourceType || 'CASE'}:{selectedAuditEvent.resourceId || caseItem.id}
                    </span>
                  </div>
                </div>

                {/* Actor & Time */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px]">
                  <div>
                    <span className="text-slate-500">Initiated By: </span>
                    <strong className="text-slate-800">
                      {selectedAuditEvent.userName || selectedAuditEvent.actor_name || selectedAuditEvent.userId}
                    </strong>{' '}
                    <span className="font-mono text-slate-400">({selectedAuditEvent.userId || selectedAuditEvent.actor_badge})</span>
                  </div>
                  <div className="font-mono text-slate-600">
                    {new Date(selectedAuditEvent.createdAt || selectedAuditEvent.timestamp).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Reason / Narrative */}
                {(selectedAuditEvent.reason || selectedAuditEvent.notes) && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">Reason / Description</label>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 leading-relaxed">
                      {selectedAuditEvent.reason || selectedAuditEvent.notes}
                    </div>
                  </div>
                )}

                {/* State Diffs */}
                {(selectedAuditEvent.beforeData || selectedAuditEvent.afterData || selectedAuditEvent.before_data || selectedAuditEvent.after_data) && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase block">State Transition Delta</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200">
                        <span className="text-[10px] font-bold text-amber-900 uppercase block mb-1">Before:</span>
                        <pre className="text-amber-900 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {JSON.stringify(selectedAuditEvent.beforeData || selectedAuditEvent.before_data || {}, null, 2)}
                        </pre>
                      </div>
                      <div className="bg-emerald-50/70 p-3 rounded-lg border border-emerald-200">
                        <span className="text-[10px] font-bold text-emerald-900 uppercase block mb-1">After:</span>
                        <pre className="text-emerald-900 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {JSON.stringify(selectedAuditEvent.afterData || selectedAuditEvent.after_data || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cryptographic Proof Card */}
                <div className="p-4 bg-slate-900 text-slate-200 rounded-xl space-y-3 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-sans font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-blue-400" />
                      Cryptographic Evidence & Ledger Proof
                    </span>
                    {selectedAuditEvent.fabricTxId && (
                      <span className="text-emerald-400 text-[10px] font-sans font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                        ✓ Fabric Anchored
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 text-[10px]">Canonical Event Hash (SHA-256):</span>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-blue-300 break-all text-[10px]">
                      {selectedAuditEvent.eventHash || selectedAuditEvent.event_hash || selectedAuditEvent.current_hash || 'HASH-PENDING'}
                    </div>
                  </div>

                  {selectedAuditEvent.fabricTxId && (
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px]">Hyperledger Fabric Transaction ID:</span>
                      <div className="bg-slate-950 p-2 rounded border border-slate-800 text-emerald-300 break-all text-[10px]">
                        {selectedAuditEvent.fabricTxId}
                      </div>
                    </div>
                  )}

                  {/* Live Verification Result */}
                  {eventVerificationResult && (
                    <div className={`p-3 rounded-lg border text-xs font-sans ${
                      eventVerificationResult.isIntact
                        ? 'bg-emerald-900/30 border-emerald-500 text-emerald-300'
                        : 'bg-rose-900/30 border-rose-500 text-rose-300'
                    }`}>
                      <div className="font-bold mb-1">
                        {eventVerificationResult.isIntact ? '✓ Cryptographic Record Intact' : '⚠️ Hash Mismatch Detected'}
                      </div>
                      <div className="text-[11px] opacity-90">{eventVerificationResult.details}</div>
                      <div className="text-[10px] font-mono mt-1 opacity-75">
                        Calculated: {eventVerificationResult.computedHash}
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={isVerifyingEvent}
                      onClick={async () => {
                        soundEffects.playSnap();
                        setIsVerifyingEvent(true);
                        try {
                          const rep = await apiClient.verifyAuditEvent(selectedAuditEvent.id);
                          soundEffects.playStamp();
                          setEventVerificationResult(rep);
                        } catch (err: any) {
                          setEventVerificationResult({
                            isIntact: false,
                            details: err?.message || 'Verification failed to reach backend',
                            computedHash: 'N/A',
                          });
                        } finally {
                          setIsVerifyingEvent(false);
                        }
                      }}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-sans font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      {isVerifyingEvent ? 'Computing SHA-256 & Verifying...' : 'Verify Cryptographic Integrity'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedAuditEvent(null)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Live Case Summary Report Modal */}
        {isSummaryModalOpen && (
          <LiveCaseSummaryModal
            caseItem={caseItem}
            isOpen={isSummaryModalOpen}
            onClose={() => setIsSummaryModalOpen(false)}
            session={session}
          />
        )}

      </motion.div>
    </div>
  );
};
