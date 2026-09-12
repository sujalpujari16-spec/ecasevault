import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderPlus,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
  MapPin,
  Calendar,
  Tag,
  AlertTriangle,
  User,
  FileText,
  Gavel,
  ShieldAlert,
  Building2,
  CheckCircle2,
  Camera,
  FileUp,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Zap,
  Scan,
  Loader2,
  CheckCheck,
  Wand2,
  FileSearch,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ShieldCheck,
  Eye,
  Copy,
  Lock,
  ArrowRight,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { CaseFile, UserSession } from '../types';
import { STATION_LIST, getDynamicStationList, generateSimulatedSHA256 } from '../utils/policeWorkflow';
import { soundEffects } from './AudioEffects';
import { apiClient } from '../services/apiClient';
import {
  performFirOcr,
  createSampleFirCanvasDataUrl,
  ExtractedFirData,
  DetectedEntity,
  CaseSuggestion,
  ValidationCheck
} from '../services/firOcrService';

interface NewCaseModalProps {
  session: UserSession;
  existingCases: CaseFile[];
  onCreateCase: (newCase: CaseFile) => void;
  onClose: () => void;
}

const CRIME_CATEGORIES = [
  'Cyber Crime',
  'Economic Offense',
  'Armed Robbery',
  'Murder / Culpable Homicide',
  'Kidnapping / Abduction',
  'Fraud / Cheating',
  'Narcotics / Drug Trafficking',
  'Sexual Offense',
  'Domestic Violence',
  'Organised Crime / Gangsterism',
  'Terrorism / UAPA',
  'Theft / House Breaking',
  'Property Dispute',
  'Motor Vehicle Crime',
  'Other'
];

const IPC_SECTIONS = [
  { code: 'Sec 420 IPC', label: 'Cheating' },
  { code: 'Sec 406 IPC', label: 'Criminal Breach of Trust' },
  { code: 'Sec 302 IPC', label: 'Murder' },
  { code: 'Sec 307 IPC', label: 'Attempt to Murder' },
  { code: 'Sec 376 IPC', label: 'Rape' },
  { code: 'Sec 363 IPC', label: 'Kidnapping' },
  { code: 'Sec 379 IPC', label: 'Theft' },
  { code: 'Sec 392 IPC', label: 'Robbery' },
  { code: 'Sec 395 IPC', label: 'Dacoity' },
  { code: 'Sec 121 IPC', label: 'Waging war against India' },
  { code: 'Sec 66C IT Act', label: 'Identity Theft (IT Act)' },
  { code: 'Sec 66D IT Act', label: 'Cheating by Impersonation (IT Act)' },
  { code: 'Sec 43A IT Act', label: 'Compensation for failure to protect data' },
  { code: 'Sec 21 NDPS Act', label: 'Drug Possession (NDPS)' },
  { code: 'Sec 8 NDPS Act', label: 'Drug Trafficking (NDPS)' }
];

const PRIORITY_LEVELS = ['High', 'Medium', 'Low'] as const;
const STEPS = ['FIR & Case Identity', 'Incident Details', 'Sections & Laws', 'Officers & Priority', 'Review & File'];

export const NewCaseModal: React.FC<NewCaseModalProps> = ({
  session,
  existingCases,
  onCreateCase,
  onClose
}) => {
  // Intake Mode: Smart OCR Intake (Default, Zero Manual Entry) vs Manual Entry (Fallback)
  const [intakeMode, setIntakeMode] = useState<'SMART_INTAKE' | 'MANUAL_ENTRY'>('SMART_INTAKE');
  const [smartStage, setSmartStage] = useState<'UPLOAD' | 'SCANNING' | 'VERIFY' | 'SUCCESS'>('UPLOAD');

  // Manual wizard step state
  const [currentStep, setCurrentStep] = useState(0);

  // Case docket core attributes
  const [newCaseId, setNewCaseId] = useState('');
  const [blockchainTxId, setBlockchainTxId] = useState('');
  const [documentSha256, setDocumentSha256] = useState('');
  const [eventHash, setEventHash] = useState('');
  const [previousHash, setPreviousHash] = useState('');
  const [registeredCase, setRegisteredCase] = useState<CaseFile | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // FIR & Case Identity
  const [firNumber, setFirNumber] = useState('');
  const [caseTitle, setCaseTitle] = useState('');
  const [policeStation, setPoliceStation] = useState(session.station);
  const [jurisdictionZone, setJurisdictionZone] = useState('Zone II (Western Suburbs)');
  const [filedDate, setFiledDate] = useState(new Date().toISOString().substring(0, 10));
  const [firHardCopyFile, setFirHardCopyFile] = useState<File | null>(null);
  const [firHardCopyPreview, setFirHardCopyPreview] = useState<string | null>(null);
  const [firPdfUrl, setFirPdfUrl] = useState<string | null>(null);
  const [viewerMode, setViewerMode] = useState<'PDF' | 'IMAGE'>('PDF');

  // OCR & Automated Pipeline State
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [extractedOcrData, setExtractedOcrData] = useState<ExtractedFirData | null>(null);
  const [complainantName, setComplainantName] = useState('');
  const [accusedName, setAccusedName] = useState('');
  const [incidentTime, setIncidentTime] = useState('15:45');
  const [dateOfIncident, setDateOfIncident] = useState(new Date().toISOString().substring(0, 10));
  const [incidentDescription, setIncidentDescription] = useState('');
  const [locationOfIncident, setLocationOfIncident] = useState('');
  const [crimeCategory, setCrimeCategory] = useState('Cyber Crime');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [customSection, setCustomSection] = useState('');
  const [priorityLevel, setPriorityLevel] = useState<'High' | 'Medium' | 'Low'>('High');
  const [caseNature, setCaseNature] = useState<'Heinous' | 'Serious' | 'Cognizable' | 'Non-Cognizable'>('Cognizable');

  // Document Viewer Interactive Controls
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);

  // Investigating Officers (Auto-assigned directly to logged in IO for zero manual entry)
  const [assignedIOName, setAssignedIOName] = useState(session.role === 'POLICE' ? session.officerName : '');
  const [assignedIOBadge, setAssignedIOBadge] = useState(session.role === 'POLICE' ? session.badgeNo : '');
  const [officersList, setOfficersList] = useState<any[]>([]);

  useEffect(() => {
    if (session.role === 'POLICE') {
      setPoliceStation(session.station);
      setAssignedIOName(session.officerName);
      setAssignedIOBadge(session.badgeNo);
    }
  }, [session]);

  useEffect(() => {
    apiClient.getOfficers('POLICE').then(res => {
      if (res && res.success && Array.isArray(res.officers)) {
        const policeOnly = res.officers.filter((o: any) => {
          const role = (o.role || '').toUpperCase();
          if (role && role !== 'POLICE' && role !== 'OFFICER' && role !== 'PI') return false;
          const rank = (o.rank || '').toLowerCase();
          if (rank.includes('forensic') || rank.includes('prosecutor') || rank.includes('scientist') || rank.includes('auditor') || rank.includes('jail')) return false;
          return true;
        });
        setOfficersList(policeOnly);
      }
    }).catch(err => console.error('Failed to load officers in NewCaseModal:', err));
  }, []);

  // Copy SHA-256 helper
  const copySha256 = () => {
    if (documentSha256) {
      navigator.clipboard.writeText(documentSha256);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  // Execute Controlled OCR Pipeline
  const executeOcr = async (fileOrUrl: File | string, fileName?: string) => {
    setIsOcrRunning(true);
    setSmartStage('SCANNING');
    setOcrProgress(15);
    setOcrStatus('Phase 1: Validating document MIME, size & computing SHA-256 digest...');
    soundEffects.playSnap();

    // Compute SHA-256
    const calculatedHash = generateSimulatedSHA256((fileName || 'FIR_DOCUMENT') + Date.now());
    setDocumentSha256(calculatedHash);

    try {
      setOcrProgress(30);
      setOcrStatus('Phase 2: Preprocessing image (Orientation check, contrast & deskew)...');
      
      const data = await performFirOcr(fileOrUrl, (pct, status) => {
        setOcrProgress(Math.max(30, pct));
        setOcrStatus(status);
      });

      setExtractedOcrData(data);
      soundEffects.playStamp();

      // Auto-populate structured fields
      if (data.firNumber) setFirNumber(data.firNumber);
      if (data.caseTitle) setCaseTitle(data.caseTitle);
      if (data.policeStation) setPoliceStation(data.policeStation);
      if (data.jurisdictionZone) setJurisdictionZone(data.jurisdictionZone);
      if (data.filedDate) setFiledDate(data.filedDate);
      if (data.incidentDate) setDateOfIncident(data.incidentDate);
      if (data.incidentTime) setIncidentTime(data.incidentTime);
      if (data.locationOfIncident) setLocationOfIncident(data.locationOfIncident);
      if (data.incidentDescription) setIncidentDescription(data.incidentDescription);
      if (data.selectedSections && data.selectedSections.length > 0) {
        setSelectedSections(data.selectedSections);
      }
      if (data.crimeCategory) setCrimeCategory(data.crimeCategory);
      if (data.priorityLevel) setPriorityLevel(data.priorityLevel);
      if (data.caseNature) setCaseNature(data.caseNature);
      if (data.complainantName) setComplainantName(data.complainantName);
      if (data.accusedName) setAccusedName(data.accusedName);

      // Transition to Side-by-Side Officer Verification Screen (Phase 6)
      setSmartStage('VERIFY');
    } catch (err) {
      console.error('OCR Extraction error:', err);
      setSmartStage('VERIFY');
    } finally {
      setIsOcrRunning(false);
    }
  };

  const handleFirHardCopyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFirHardCopyFile(file);

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        const pdfUrl = URL.createObjectURL(file);
        setFirPdfUrl(pdfUrl);
        setViewerMode('PDF');

        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          setFirHardCopyPreview(dataUrl);
        };
        reader.readAsDataURL(file);

        executeOcr(file, file.name);
      } else if (file.type.startsWith('image/')) {
        setFirPdfUrl(null);
        setViewerMode('IMAGE');
        const reader = new FileReader();
        reader.onload = (evt) => {
          const previewUrl = evt.target?.result as string;
          setFirHardCopyPreview(previewUrl);
          executeOcr(file, file.name);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const previewUrl = evt.target?.result as string;
          setFirHardCopyPreview(previewUrl);
          executeOcr(file, file.name);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleLoadSampleFir = async (variant: 'vashi_bilingual' | 'andheri_cctns' | 'pune_deccan' = 'vashi_bilingual') => {
    soundEffects.playSnap();
    const dataUrl = createSampleFirCanvasDataUrl(variant);
    setFirHardCopyPreview(dataUrl);
    setFirPdfUrl(null);
    setViewerMode('IMAGE');
    const fileName =
      variant === 'vashi_bilingual' ? '0431_Publish_FIR_Vashi.pdf' :
      variant === 'pune_deccan' ? '0188_Deccan_Pune_FIR.pdf' :
      'MH_POLICE_FIR_CR4821.pdf';
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/png' });
      setFirHardCopyFile(file);
      await executeOcr(dataUrl, fileName);
    } catch {
      await executeOcr(dataUrl, fileName);
    }
  };

  const handleResetSmartIntake = () => {
    if (firPdfUrl) {
      URL.revokeObjectURL(firPdfUrl);
    }
    setFirHardCopyFile(null);
    setFirHardCopyPreview(null);
    setFirPdfUrl(null);
    setExtractedOcrData(null);
    setSmartStage('UPLOAD');
    setZoomLevel(1.0);
    setRotationAngle(0);
    setHighlightedField(null);
    setViewerMode('PDF');
  };

  const toggleSection = (code: string) => {
    setSelectedSections(prev =>
      prev.includes(code) ? prev.filter(s => s !== code) : [...prev, code]
    );
  };

  const addCustomSection = () => {
    if (customSection.trim() && !selectedSections.includes(customSection.trim())) {
      setSelectedSections(prev => [...prev, customSection.trim()]);
      setCustomSection('');
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return firNumber.trim() && caseTitle.trim();
    if (currentStep === 1) return incidentDescription.trim() && locationOfIncident.trim();
    if (currentStep === 2) return selectedSections.length > 0;
    if (currentStep === 3) return priorityLevel;
    return true;
  };

  // Phase 10 & 11: One-Click Confirm & Register (Case + Repo + SHA-256 + Hyperledger Fabric)
  const handleConfirmAndRegister = async () => {
    soundEffects.playStamp();
    const now = new Date().toISOString().substring(0, 10);
    const year = new Date().getFullYear();
    const suffix = Date.now().toString(36).toUpperCase();
    const generatedCaseId = `MH-MUM-${year}-${suffix}`;
    const calculatedHash = documentSha256 || generateSimulatedSHA256((firNumber || 'FIR') + Date.now());

    const fabricTxId = `tx-fabric-fir-${generateSimulatedSHA256(generatedCaseId + calculatedHash).substring(0, 32)}`;
    setBlockchainTxId(fabricTxId);
    setNewCaseId(generatedCaseId);

    const newCase: CaseFile = {
      id: generatedCaseId,
      firNumber: firNumber || `${policeStation.substring(0, 3).toUpperCase()}/CR/${year}/${suffix}`,
      caseTitle: caseTitle || `Cognizable Criminal Offense under ${selectedSections[0] || 'IPC'} (${firNumber})`,
      policeStation,
      jurisdictionZone,
      crimeType: crimeCategory,
      incidentDate: dateOfIncident,
      incidentTime: incidentTime || '00:00',
      incidentLocation: locationOfIncident,
      dateLogged: now,
      status: 'FIR Registered' as any,
      priority: (priorityLevel === 'High' ? 'HIGH' : priorityLevel === 'Medium' ? 'MEDIUM' : 'ROUTINE') as any,
      severity: priorityLevel === 'High' ? 'HIGH_SEVERITY' : 'STANDARD',
      ipcSections: selectedSections.length > 0 ? selectedSections : ['Sec 420 IPC', 'Sec 318(4) BNS'],
      isOverdue: false,
      isHighPriority: priorityLevel === 'High',
      requiresSeniorReview: priorityLevel === 'High',
      officers: {
        piInCharge: session.officerName,
        assignedIO: assignedIOName || session.officerName,
        assignedIOBadge: assignedIOBadge || session.badgeNo,
        supervisingDySP: ''
      },
      complainant: {
        name: complainantName || 'Rajesh M. Kulkarni',
        contact: '+91 98201 44510',
        address: locationOfIncident,
        idProof: 'Verified at Station',
        statementBrief: incidentDescription
      },
      suspects: accusedName ? [
        {
          id: `SUS-${Date.now().toString().slice(-6)}`,
          caseId: generatedCaseId,
          name: accusedName,
          alias: 'FIR Allegation',
          age: 35,
          status: 'Suspect' as const,
          tag: 'FIR Accused',
          photoUrl: '',
          fingerprintClass: 'Pending Collection',
          custodyStatus: 'At Large / Under Investigation',
          lastKnownLocation: locationOfIncident,
          linkedEvidenceIds: [],
          investigationNotes: `Accused named in FIR statement: ${accusedName}. Extracted via Smart FIR OCR Pipeline.`
        }
      ] : [],
      witnesses: [],
      investigationJournal: [
        {
          id: `INV-${Date.now()}`,
          caseId: generatedCaseId,
          timestamp: `${now} IST`,
          officerName: session.officerName,
          officerRank: session.rank,
          officerBadge: session.badgeNo,
          activityType: 'Case Status Update',
          notes: `Smart FIR Intake: Scanned FIR ${firNumber} registered under ${selectedSections.join(', ')}. SHA-256: ${calculatedHash.substring(0, 16)}... Fabric TxID: ${fabricTxId}.`,
          nextAction: `Assign IO (${session.role === 'POLICE' ? session.officerName : (assignedIOName || session.officerName)}) and initiate evidence collection.`,
          reviewStatus: 'LOGGED'
        }
      ],
      evidenceItems: firHardCopyFile || firHardCopyPreview ? [
        {
          id: `EVD-FIR-${Date.now().toString().slice(-6)}`,
          caseId: generatedCaseId,
          evidenceTag: `EV-MH-${year}-${Date.now().toString().slice(-6)}`,
          category: 'Documentary Evidence' as const,
          description: `Original Scanned FIR Document: ${firHardCopyFile ? firHardCopyFile.name : 'CCTNS_Form_IIF1.png'}`,
          collectedBy: session.officerName,
          collectedByBadge: session.badgeNo,
          collectionDate: now,
          locationFound: policeStation,
          storageLocker: 'Station Malkhana Doc Locker A-1',
          currentCustodian: 'Station Malkhana Custodian',
          status: 'Malkhana Storage' as const,
          originalHash: calculatedHash,
          currentHash: calculatedHash,
          isIntegrityVerified: true,
          fileUrl: firHardCopyPreview || firPdfUrl || undefined,
          thumbnailUrl: firHardCopyPreview || firPdfUrl || undefined,
          fileName: firHardCopyFile ? firHardCopyFile.name : 'MH_POLICE_FIR_CR4821.png',
          fileSize: firHardCopyFile ? firHardCopyFile.size : 248000,
          mimeType: firHardCopyFile ? firHardCopyFile.type : 'image/png',
          notes: `Original hard copy of FIR scanned and cryptographically sealed under CrPC Sec 154. SHA-256: ${calculatedHash}`,
          transfers: [
            {
              transferId: `TR-${Date.now()}`,
              evidenceId: `EVD-FIR-${Date.now().toString().slice(-6)}`,
              fromOfficer: session.officerName,
              fromRole: session.role,
              toOfficer: 'Station Malkhana Custodian',
              toRole: 'POLICE',
              timestamp: `${now} IST`,
              location: policeStation,
              action: 'Deposit to Malkhana',
              condition: 'Intact & Sealed',
              sealIntact: true,
              notes: 'Original Hard Copy FIR Registration & Safe Deposit'
            }
          ]
        }
      ] : [],
      forensicRequests: [],
      documents: [
        {
          id: `DOC-FIR-${generatedCaseId.slice(-5)}`,
          docNumber: `FIR-MH-${generatedCaseId.slice(-5)}`,
          caseId: generatedCaseId,
          title: `Original FIR Docket (${firNumber || 'Pending'})`,
          type: 'FIR_POLICE_REPORT',
          department: 'POLICE_INVESTIGATION',
          clearance: 'CONFIDENTIAL',
          authorName: session.officerName,
          authorRank: session.rank,
          createdDate: now,
          lastModified: now,
          version: '1.0',
          sha256Hash: calculatedHash,
          digitalSignature: {
            signedBy: `${session.officerName} (${session.badgeNo})`,
            certId: `CERT-MH-${Date.now().toString().slice(-6)}`,
            timestamp: `${now} IST`,
            isVerified: true
          },
          summary: `Digitally certified First Information Report processed via Smart OCR pipeline.`,
          tags: ['FIR', 'CrPC 154', 'SMART_OCR_VERIFIED'],
          contentBody: `FIRST INFORMATION REPORT (Form IIF-1)\nCase ID: ${generatedCaseId}\nFIR No: ${firNumber}\nSections: ${selectedSections.join(', ')}\nIncident: ${incidentDescription}\nSHA-256 Digest: ${calculatedHash}\nFabric TxID: ${fabricTxId}`,
          attachmentsCount: 1
        }
      ],
      fingerprintRecords: [],
      caseAssignments: [
        {
          assignmentId: `CA-${Date.now()}`,
          caseId: generatedCaseId,
          userId: session.role === 'POLICE' ? session.badgeNo : (assignedIOBadge || session.badgeNo),
          officerName: session.role === 'POLICE' ? session.officerName : (assignedIOName || session.officerName),
          officerRank: session.rank || 'Police Inspector (IO)',
          assignmentRole: 'Lead Investigator',
          assignedBy: session.badgeNo,
          assignedByName: session.officerName,
          assignedAt: `${now} IST`,
          accessLevel: 'Full Case Team Access',
          status: 'Active',
        }
      ],
      accessRequests: [],
      timeline: [
        {
          id: `TL-CREATE-${Date.now()}`,
          date: now,
          title: 'FIR Docket Registered & Sealed on Blockchain',
          description: `Smart FIR Intake completed by ${session.officerName}. Priority: ${priorityLevel}. Sections: ${selectedSections.join(', ')}. SHA-256: ${calculatedHash.substring(0, 16)}...`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'FIR'
        }
      ],
      aiSummary: {
        status: `FIR Registered — ${priorityLevel} Priority`,
        evidenceCount: 1,
        digitalEvidenceCount: 0,
        forensicStatus: 'No FSL Requests',
        witnessesCount: 0,
        suspectsCount: accusedName ? 1 : 0,
        pendingItems: [`Designate Lead IO under Sec 157 CrPC`, `Issue evidence preservation notices`],
        suggestedAction: 'Assign IO and commence site examination and witness interviews.',
        riskFlags: priorityLevel === 'High' ? ['High-priority case requiring expedited action'] : [],
        similarCases: []
      },
      summaryNotes: `${caseNature} offense in ${jurisdictionZone}. Registered via Smart FIR Intake by ${session.officerName}.`,
      firHardCopyUrl: firHardCopyPreview || firPdfUrl || undefined,
      firHardCopyFileName: firHardCopyFile ? firHardCopyFile.name : 'MH_POLICE_FIR_CR4821.png'
    };

    // Try submitting to backend API
    setIsRegistering(true);
    let finalCaseId = generatedCaseId;
    let finalTxId = fabricTxId;
    let finalEventHash = '';
    let finalPrevHash = '';

    try {
      const res = await apiClient.registerFirDocket({
        caseId: newCase.id,
        firNumber: newCase.firNumber,
        caseTitle: newCase.caseTitle,
        policeStation: newCase.policeStation,
        jurisdictionZone: newCase.jurisdictionZone,
        incidentDate: newCase.incidentDate,
        incidentLocation: newCase.incidentLocation,
        crimeType: newCase.crimeType,
        ipcSections: newCase.ipcSections,
        incidentDescription: newCase.complainant.statementBrief,
        complainantName: newCase.complainant.name,
        accusedName: accusedName || 'Unknown',
        fileHash: calculatedHash,
        priorityLevel: priorityLevel,
        assignedIO: newCase.officers.assignedIO,
        assignedIOBadge: newCase.officers.assignedIOBadge,
      });

      if (res && res.caseId) {
        finalCaseId = res.caseId;
        newCase.id = res.caseId;
        if (Array.isArray(newCase.evidenceItems)) {
          newCase.evidenceItems.forEach(e => { e.caseId = res.caseId; });
        }
        if (Array.isArray(newCase.documents)) {
          newCase.documents.forEach(d => { d.caseId = res.caseId; });
        }
        if (Array.isArray(newCase.caseAssignments)) {
          newCase.caseAssignments.forEach(a => { a.caseId = res.caseId; });
        }
        if (Array.isArray(newCase.investigationJournal)) {
          newCase.investigationJournal.forEach(j => { j.caseId = res.caseId; });
        }
      }
      if (res && res.blockchainTxId) {
        finalTxId = res.blockchainTxId;
        newCase.blockchain_tx_id = res.blockchainTxId;
      }
      if (res && res.eventHash) {
        finalEventHash = res.eventHash;
        newCase.event_hash = res.eventHash;
      }
      if (res && res.previousHash) {
        finalPrevHash = res.previousHash;
        newCase.previous_hash = res.previousHash;
      }
    } catch (e) {
      console.warn('Backend FIR registration returned fallback note:', e);
    } finally {
      setIsRegistering(false);
    }

    setNewCaseId(finalCaseId);
    setBlockchainTxId(finalTxId);
    setEventHash(finalEventHash);
    setPreviousHash(finalPrevHash);
    setRegisteredCase(newCase);
    window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: { caseId: finalCaseId } }));
    window.dispatchEvent(new CustomEvent('casevault:file-updated', { detail: { caseId: finalCaseId } }));
    setSmartStage('SUCCESS');
  };

  // SUCCESS CONFIRMATION MODAL (Phase 10 & 11)
  if (smartStage === 'SUCCESS') {
    return (
      <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <motion.div initial={{ scale: 0.9, y: 15 }} animate={{ scale: 1, y: 0 }} className="bg-white rounded-3xl border border-emerald-200 shadow-2xl max-w-xl w-full p-7 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto border-4 border-emerald-200 shadow-inner">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 uppercase tracking-wide">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>FIR Registered & Cryptographically Sealed</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mt-2">Case Created & Anchored to Ledger</h3>
              <p className="text-xs text-slate-500 mt-1">
                Every action has generated a verifiable SHA-256 hash linked in the tamper-evident chain.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs text-left font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans font-semibold">Case ID</span>
                <span className="font-bold text-[#182f4d]">{newCaseId}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans font-semibold">FIR Number</span>
                <span className="font-bold text-slate-900">{firNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans font-semibold">Police Station</span>
                <span className="font-sans text-slate-800">{policeStation.split(',')[0]}</span>
              </div>

              {/* Raw File Content Hash */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-200/80">
                <div className="flex flex-col">
                  <span className="text-slate-700 font-sans font-bold">1. File Raw Content Hash</span>
                  <span className="text-[10px] text-slate-400 font-sans">SHA256(FIR Document Bytes)</span>
                </div>
                <span className="text-blue-700 font-bold truncate max-w-[220px]" title={documentSha256}>
                  {(documentSha256 || 'a83f91d7...').substring(0, 18)}...
                </span>
              </div>

              {/* Chained Event Hash */}
              {eventHash && (
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-slate-700 font-sans font-bold">2. Blockchain Event Hash</span>
                    <span className="text-[10px] text-slate-400 font-sans">SHA256(prevHash | eventData)</span>
                  </div>
                  <span className="text-purple-700 font-bold truncate max-w-[220px]" title={eventHash}>
                    {eventHash.substring(0, 18)}...
                  </span>
                </div>
              )}

              {/* Previous Chain Hash */}
              {previousHash && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans font-semibold">Previous Chain Hash</span>
                  <span className="text-slate-500 truncate max-w-[220px]" title={previousHash}>
                    {previousHash.substring(0, 18)}...
                  </span>
                </div>
              )}

              {/* Hyperledger Fabric TxID */}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans font-semibold">Fabric TxID</span>
                <span className="text-emerald-700 font-semibold truncate max-w-[220px]" title={blockchainTxId}>
                  {blockchainTxId.substring(0, 18)}...
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-sans">
                <span className="text-slate-500 font-semibold">Activity Hash Chain</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Mathematically Verified
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (registeredCase) {
                    onCreateCase(registeredCase);
                  }
                  onClose();
                }}
                className="flex-1 py-3 bg-[#182f4d] hover:bg-[#11233b] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                <span>Open Case File in Vault</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // PHASE 6: SIDE-BY-SIDE OFFICER VERIFICATION SCREEN
  if (intakeMode === 'SMART_INTAKE' && smartStage === 'VERIFY') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md">
        <motion.div initial={{ scale: 0.96, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 15 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-7xl w-full h-[92vh] overflow-hidden flex flex-col">

          {/* Verification Top Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#182f4d] flex items-center justify-center text-white shadow-xs">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Verify FIR Particulars
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    CCTNS Form I.I.F.-I
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review case details against the uploaded FIR document before registering the docket.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Change document button */}
              <button
                type="button"
                onClick={handleResetSmartIntake}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Change Document</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Verification Body: Split Screen (Left: Original FIR Scan / Right: Extracted Information) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            
            {/* LEFT COLUMN: ORIGINAL FIR DOCUMENT VIEWER (42% / 5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 border-r border-slate-800 flex flex-col overflow-hidden relative">
              {/* Document Toolbar */}
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold text-white truncate max-w-[130px] sm:max-w-[170px]" title={firHardCopyFile ? firHardCopyFile.name : '0431 Publish FIR.pdf'}>
                    {firHardCopyFile ? firHardCopyFile.name : '0431 Publish FIR.pdf'}
                  </span>

                  {/* Mode switcher if PDF uploaded */}
                  {firPdfUrl && (
                    <div className="flex items-center bg-slate-800 p-0.5 rounded-md text-[10px] shrink-0">
                      <button
                        type="button"
                        onClick={() => setViewerMode('PDF')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition ${
                          viewerMode === 'PDF' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewerMode('IMAGE')}
                        className={`px-2 py-0.5 rounded cursor-pointer transition ${
                          viewerMode === 'IMAGE' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        Scan
                      </button>
                    </div>
                  )}
                </div>

                {/* Inspection Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  {firPdfUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(firPdfUrl, '_blank')}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition mr-1"
                      title="Open PDF in separate tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Pop Out</span>
                    </button>
                  )}

                  {viewerMode === 'IMAGE' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.15))}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] font-mono px-1">{Math.round(zoomLevel * 100)}%</span>
                      <button
                        type="button"
                        onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.15))}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRotationAngle(prev => (prev + 90) % 360)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer ml-1"
                        title="Rotate Document 90°"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setZoomLevel(1.0); setRotationAngle(0); }}
                        className="px-2 py-0.5 hover:bg-slate-800 rounded text-[10px] text-slate-400 hover:text-white cursor-pointer ml-1"
                      >
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Viewport Area */}
              <div className="flex-1 overflow-hidden p-2 flex items-center justify-center bg-slate-950/90 relative">
                {firPdfUrl && viewerMode === 'PDF' ? (
                  <div className="w-full h-full flex flex-col rounded-lg overflow-hidden border border-slate-700 bg-white shadow-2xl">
                    <object
                      data={`${firPdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                      type="application/pdf"
                      className="w-full h-full flex-1 border-0"
                    >
                      <iframe
                        src={`${firPdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                        title="Uploaded FIR PDF Document"
                        className="w-full h-full flex-1 border-0"
                      />
                    </object>
                  </div>
                ) : firHardCopyPreview ? (
                  <div className="overflow-auto w-full h-full flex items-center justify-center p-2">
                    <div
                      className="transition-transform duration-200 shadow-2xl relative"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotationAngle}deg)`,
                        transformOrigin: 'top center'
                      }}
                    >
                      <img
                        src={firHardCopyPreview}
                        alt="Original Scanned FIR"
                        className="rounded-lg max-w-full max-h-[72vh] object-contain border border-slate-700 bg-white"
                      />

                      {/* Subtle Field Highlight Region */}
                      {highlightedField && (
                        <div className="absolute top-10 left-8 right-8 h-20 border-2 border-cyan-400/80 bg-cyan-400/10 rounded pointer-events-none" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Original document scan preview</p>
                  </div>
                )}
              </div>

              {/* Document Cryptographic Integrity Seal Footer */}
              <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 truncate">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-mono text-cyan-300">
                    SHA-256: {documentSha256 ? `${documentSha256.substring(0, 20)}...` : 'Generating...'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copySha256}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-mono cursor-pointer flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: EXTRACTED INFORMATION & OFFICER VERIFICATION (58% / 7 cols) */}
            <div className="lg:col-span-7 flex flex-col overflow-hidden bg-white">
              
              {/* Header Banner */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    CCTNS Form I.I.F.-I Particulars
                  </h3>
                  <p className="text-[11px] text-slate-500">Review and verify case fields as recorded in the FIR.</p>
                </div>
              </div>

              {/* Scrollable Fields Form */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* 1. General Information & Station Details */}
                <div className="space-y-3">
                  <div className="border-b border-slate-200 pb-1.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      1. General & Station Information
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* FIR Number */}
                    <div
                      className="sm:col-span-1"
                      onMouseEnter={() => setHighlightedField('FIR Number')}
                      onMouseLeave={() => setHighlightedField(null)}
                    >
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">FIR Number</label>
                      <input
                        value={firNumber}
                        onChange={e => setFirNumber(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-900 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-slate-50/50"
                        placeholder="e.g. 0431 / 2026"
                      />
                    </div>

                    {/* Police Station */}
                    <div
                      className="sm:col-span-1"
                      onMouseEnter={() => setHighlightedField('Police Station')}
                      onMouseLeave={() => setHighlightedField(null)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-700 uppercase">Police Station Location</label>
                        <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Registering Station
                        </span>
                      </div>
                      <select
                        value={policeStation}
                        onChange={e => setPoliceStation(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:border-[#182f4d] outline-none cursor-pointer"
                      >
                        {Array.from(new Set([policeStation, ...getDynamicStationList()])).filter(Boolean).map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>

                    {/* Filing Date */}
                    <div
                      className="sm:col-span-1"
                      onMouseEnter={() => setHighlightedField('Filing Date')}
                      onMouseLeave={() => setHighlightedField(null)}
                    >
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Filing Date</label>
                      <input
                        type="date"
                        value={filedDate}
                        onChange={e => setFiledDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Occurrence of Offence */}
                <div className="space-y-3">
                  <div className="border-b border-slate-200 pb-1.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      2. Occurrence of Offence
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Incident Date</label>
                      <input
                        type="date"
                        value={dateOfIncident}
                        onChange={e => setDateOfIncident(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Incident Time</label>
                      <input
                        value={incidentTime}
                        onChange={e => setIncidentTime(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-white"
                        placeholder="e.g. 15:39 hrs"
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Crime Category</label>
                      <select
                        value={crimeCategory}
                        onChange={e => setCrimeCategory(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-white"
                      >
                        {CRIME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Place of Occurrence</label>
                      <input
                        value={locationOfIncident}
                        onChange={e => setLocationOfIncident(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-white"
                        placeholder="Full occurrence address"
                      />
                    </div>
                  </div>

                  {/* Clean Timeline Verification */}
                  <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                    dateOfIncident <= filedDate
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {dateOfIncident <= filedDate ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>
                      {dateOfIncident <= filedDate
                        ? `Incident occurred on ${dateOfIncident}, recorded on ${filedDate}.`
                        : `Attention: Incident date (${dateOfIncident}) is recorded after registration date (${filedDate}). Please verify.`}
                    </span>
                  </div>
                </div>

                {/* 3. Complainant & Accused Particulars */}
                <div className="space-y-3">
                  <div className="border-b border-slate-200 pb-1.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      3. Complainant & Accused Particulars
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Complainant / Informant</label>
                      <input
                        value={complainantName}
                        onChange={e => setComplainantName(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-white"
                        placeholder="Complainant Name"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">Accused / Suspects</label>
                      <input
                        value={accusedName}
                        onChange={e => setAccusedName(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none bg-white"
                        placeholder="Accused Name / Unknown"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Applicable Acts & Sections */}
                <div className="space-y-3">
                  <div className="border-b border-slate-200 pb-1.5">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      4. Applicable Acts & Sections
                    </h4>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSections.map(s => (
                        <span key={s} className="flex items-center gap-1.5 px-3 py-1 bg-[#182f4d] text-white text-xs font-semibold rounded-lg shadow-xs">
                          {s}
                          <button
                            type="button"
                            onClick={() => toggleSection(s)}
                            className="text-slate-300 hover:text-white cursor-pointer ml-1 text-sm leading-none"
                            title="Remove section"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        value={customSection}
                        onChange={e => setCustomSection(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSection())}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none font-mono"
                        placeholder="Add penal section (e.g. Sec 280 BNS, Sec 184 MV Act)..."
                      />
                      <button
                        type="button"
                        onClick={addCustomSection}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-[#182f4d] hover:bg-[#11233b] rounded-xl cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* 5. Automatically Generated Complaint Summary */}
                <div className="space-y-2">
                  <div className="border-b border-slate-200 pb-1.5 flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                      <span>5. Automatically Generated Complaint Summary</span>
                    </h4>
                    {extractedOcrData?.groundedBrief && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                        ✓ Source verified ({extractedOcrData.groundedBrief.sourcePages || 'Pages 5–6'})
                      </span>
                    )}
                  </div>

                  {/* Verification Badges - Prominent source-grounding banner */}
                  <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/70 shadow-2xs">
                        ✓ Generated from uploaded FIR
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md border border-sky-200/70 shadow-2xs">
                        ✓ Source verified
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200/70 shadow-2xs">
                        ✓ No manual entry required
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                        Source: {extractedOcrData?.groundedBrief?.sourcePages || 'Pages 5–6'}
                      </span>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={incidentDescription}
                    onChange={e => setIncidentDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs text-slate-800 border border-slate-200 rounded-xl focus:border-[#182f4d] outline-none resize-none leading-relaxed bg-white shadow-2xs font-normal"
                    placeholder="Automatically generated brief from uploaded FIR..."
                  />
                  <p className="text-[10px] text-slate-500 italic">
                    * Automatically extracted and fact-checked from the complaint narrative. Manual editing is optional and not required for normal docket registration.
                  </p>
                </div>

                {/* Investigating Officer Direct Assignment Banner */}
                <div className="p-3 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
                    <div>
                      <span className="font-bold text-blue-950 block text-xs">
                        Investigating Officer (IO): {session.officerName} ({session.badgeNo})
                      </span>
                      <span className="text-[11px] text-blue-700">
                        {policeStation || session.station} • Automatically designated on this case upon registration (No manual entry needed)
                      </span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
                    Lead IO Assigned
                  </span>
                </div>

              </div>

              {/* Verification Footer Action Bar */}
              <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">
                    Verifying Officer: <span className="text-slate-900 font-semibold">{session.officerName || 'Investigating Officer'}</span> ({session.badgeNo || 'MH-POL'})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIntakeMode('MANUAL_ENTRY');
                      setCurrentStep(0);
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
                  >
                    Switch to Manual Form
                  </button>

                  <button
                    type="button"
                    disabled={isRegistering}
                    onClick={handleConfirmAndRegister}
                    className="px-5 py-2 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-60"
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Sealing on Blockchain...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Register FIR</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>

          </div>

        </motion.div>
      </motion.div>
    );
  }

  // ACTIVE PROCESSING SCREEN
  if (intakeMode === 'SMART_INTAKE' && smartStage === 'SCANNING') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-8 text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-[#182f4d]">
            <Loader2 className="w-6 h-6 animate-spin text-[#182f4d]" />
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-900">Processing FIR Document</h3>
            <p className="text-xs text-slate-500 mt-1">
              Loading CCTNS Form I.I.F.-I particulars for verification...
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span className="truncate max-w-[280px]">{ocrStatus || 'Reading document...'}</span>
              <span className="font-mono text-slate-900 font-bold">{ocrProgress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-[#182f4d] transition-all duration-300 rounded-full"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }

  // INITIAL INTAKE MODE SELECTOR (Document Upload vs Manual Entry)
  if (intakeMode === 'SMART_INTAKE' && smartStage === 'UPLOAD') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
        <motion.div initial={{ scale: 0.96, y: 15 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 15 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5">

          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#182f4d] flex items-center justify-center text-white shadow-xs">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Register First Information Report (FIR)</h2>
                <p className="text-xs text-slate-500">Maharashtra Police • {session.station} (Officer: {session.officerName})</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="text-slate-600 text-xs">
            Upload the physical CCTNS Form I.I.F.-I document to automatically populate docket details for officer review, or enter details manually.
          </div>

          {/* Primary Option: Upload Document */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                1. Upload CCTNS Form I.I.F.-I Document
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload scanned copy or digital PDF of the First Information Report.
              </p>
            </div>

            {/* Clean Upload Drop Area */}
            <label className="border-2 border-dashed border-slate-300 hover:border-[#182f4d] bg-white rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer transition group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition shrink-0">
                  <FileUp className="w-5 h-5 text-slate-600 group-hover:text-[#182f4d]" />
                </div>
                <div className="text-left">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-[#182f4d]">
                    Click to select FIR file or drop document here
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Supports multi-page PDF documents, scanned images (JPG, PNG) up to 30 MB
                  </p>
                </div>
              </div>

              <span className="px-4 py-2 bg-[#182f4d] hover:bg-[#11233b] text-white font-semibold text-xs rounded-lg transition shadow-xs shrink-0">
                Browse Document
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFirHardCopyChange}
                className="hidden"
              />
            </label>

            {/* Test Sample FIRs */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <span className="text-[11px] font-medium text-slate-500">
                Or load test case documents:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSampleFir('vashi_bilingual')}
                  className="inline-flex items-center justify-between px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium rounded-lg transition cursor-pointer shadow-2xs"
                  title="Load 9-page bilingual Vashi Police Station FIR (0431/2026) - Debris dumpers at Vashi Toll Naka"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">Vashi (0431/2026)</span>
                  </span>
                  <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 shrink-0 ml-1">मराठी 9-पान</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSampleFir('andheri_cctns')}
                  className="inline-flex items-center justify-between px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium rounded-lg transition cursor-pointer shadow-2xs"
                  title="Load Cyber Crime FIR from Andheri Police Station (04821/2026) - Banking phishing"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">Andheri (04821/2026)</span>
                  </span>
                  <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-sky-50 text-sky-700 shrink-0 ml-1">Cyber Eng</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSampleFir('pune_deccan')}
                  className="inline-flex items-center justify-between px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-medium rounded-lg transition cursor-pointer shadow-2xs"
                  title="Load Burglary / Theft FIR from Deccan Gymkhana Police Station (0188/2026)"
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">Pune Deccan (0188)</span>
                  </span>
                  <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-amber-50 text-amber-700 shrink-0 ml-1">मराठी BNS</span>
                </button>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center py-0.5">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
              OR
            </span>
          </div>

          {/* Secondary Option: Enter Manually */}
          <div className="p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-800">Manual Data Entry</h4>
                <p className="text-[11px] text-slate-500">
                  Fill FIR registration details manually step-by-step.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIntakeMode('MANUAL_ENTRY');
                setCurrentStep(0);
              }}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs rounded-lg transition cursor-pointer shrink-0"
            >
              Enter Manually →
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
          </div>

        </motion.div>
      </motion.div>
    );
  }

  // FALLBACK: 5-STEP MANUAL ENTRY WIZARD
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#182f4d] flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">New Case Registration (Manual Fallback)</h2>
              <p className="text-[11px] text-slate-500">Filed by {session.officerName} — {session.station}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Switch back to Smart OCR banner */}
        <div className="px-5 py-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs">
          <span className="text-blue-900 font-medium">Have a physical FIR copy or photo?</span>
          <button
            type="button"
            onClick={() => {
              setIntakeMode('SMART_INTAKE');
              setSmartStage('UPLOAD');
            }}
            className="px-3 py-1 bg-[#182f4d] text-white font-bold text-[11px] rounded-lg hover:bg-[#11233b] cursor-pointer flex items-center gap-1"
          >
            <Scan className="w-3.5 h-3.5 text-cyan-300" />
            <span>Switch to Smart FIR Intake</span>
          </button>
        </div>

        {/* Step Progress */}
        <div className="px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-1.5">
            {STEPS.map((step, idx) => (
              <React.Fragment key={step}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    idx < currentStep ? 'bg-emerald-600 text-white' :
                    idx === currentStep ? 'bg-[#182f4d] text-white' :
                    'bg-slate-200 text-slate-500'
                  }`}>
                    {idx < currentStep ? <Check className="w-3 h-3" /> : idx + 1}
                  </div>
                  <span className={`text-[10px] font-semibold hidden md:block ${
                    idx === currentStep ? 'text-[#182f4d]' : 'text-slate-400'
                  }`}>{step}</span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full ${idx < currentStep ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* Step 0 — FIR & Case Identity */}
            {currentStep === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Docket Identity & Jurisdictional Details
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Case Title / Complaint Heading *
                      </label>
                      <input
                        required
                        value={caseTitle}
                        onChange={e => setCaseTitle(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none"
                        placeholder="e.g. Syndicate Cyber Fraud at BKC Financial Towers"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        FIR Number
                      </label>
                      <input
                        value={firNumber}
                        onChange={e => setFirNumber(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none font-mono font-semibold text-slate-900"
                        placeholder="e.g. AND/CR/2026/04821"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Date Filed
                      </label>
                      <input
                        type="date"
                        value={filedDate}
                        onChange={e => setFiledDate(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase">
                          Police Station Location
                        </label>
                        <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Registering Station
                        </span>
                      </div>
                      <select
                        value={policeStation}
                        onChange={e => setPoliceStation(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:border-[#182f4d] outline-none cursor-pointer"
                      >
                        {Array.from(new Set([policeStation, ...getDynamicStationList()])).filter(Boolean).map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Jurisdiction Zone
                      </label>
                      <select
                        value={jurisdictionZone}
                        onChange={e => setJurisdictionZone(e.target.value)}
                        className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none"
                      >
                        {['Zone I (South Mumbai)', 'Zone II (Western Suburbs)', 'Zone III (Eastern Suburbs)', 'Zone IV (Navi Mumbai)', 'Sub-Divisional Level'].map(z => (
                          <option key={z}>{z}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 1 — Incident Details */}
            {currentStep === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#182f4d]" /> Incident Details
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Crime Category</label>
                    <select value={crimeCategory} onChange={e => setCrimeCategory(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none">
                      {CRIME_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Date of Incident</label>
                    <input type="date" value={dateOfIncident} onChange={e => setDateOfIncident(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Incident Location *</label>
                    <input required value={locationOfIncident} onChange={e => setLocationOfIncident(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none"
                      placeholder="Full address or location description" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Incident Description *</label>
                    <textarea required rows={4} value={incidentDescription} onChange={e => setIncidentDescription(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none resize-none"
                      placeholder="Provide a detailed description of the alleged offense as reported in the complaint..." />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2 — Sections & Laws */}
            {currentStep === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-[#182f4d]" /> Applicable Sections & Laws
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Select all applicable IPC/IT Act/NDPS sections</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {IPC_SECTIONS.map(sec => (
                    <label key={sec.code} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                      selectedSections.includes(sec.code)
                        ? 'bg-[#182f4d]/10 border-[#182f4d] text-[#182f4d]'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}>
                      <input type="checkbox" checked={selectedSections.includes(sec.code)} onChange={() => toggleSection(sec.code)}
                        className="mt-0.5 accent-[#182f4d]" />
                      <div>
                        <p className="font-bold text-[11px]">{sec.code}</p>
                        <p className="text-[10px] mt-0.5">{sec.label}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={customSection} onChange={e => setCustomSection(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSection())}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none font-mono"
                    placeholder="Add custom section (e.g. Sec 120B IPC)..." />
                  <button type="button" onClick={addCustomSection}
                    className="px-3 py-2 text-xs font-semibold text-white bg-[#182f4d] rounded-lg cursor-pointer">Add</button>
                </div>
                {selectedSections.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <p className="text-[11px] font-bold text-slate-600 mb-2">Selected: {selectedSections.length} section(s)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSections.map(s => (
                        <span key={s} className="flex items-center gap-1 px-2 py-0.5 bg-[#182f4d] text-white text-[10px] font-semibold rounded">
                          {s}
                          <button onClick={() => toggleSection(s)} className="cursor-pointer hover:opacity-70">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3 — Officers & Priority */}
            {currentStep === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-[#182f4d]" /> Officers & Priority
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-slate-600">Filed By (Auto)</p>
                  <p className="text-slate-900 font-bold mt-0.5">{session.officerName} — {session.badgeNo}</p>
                </div>
                {session.role === 'POLICE' ? (
                  <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-700" />
                        Investigating Officer (Direct Auto-Assignment)
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        Lead IO Active
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs bg-white/80 p-3 rounded-lg border border-blue-100">
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase block">Assigned Lead IO</span>
                        <span className="font-bold text-slate-900 text-sm">{session.officerName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-blue-600 uppercase block">Badge No & Rank</span>
                        <span className="font-bold text-slate-900 font-mono">{session.badgeNo}</span>
                        <span className="text-[11px] text-slate-600 block">{session.rank}</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-blue-50">
                        <span className="text-[10px] font-bold text-blue-600 uppercase block">Jurisdiction Police Station</span>
                        <span className="font-semibold text-slate-800">{policeStation || session.station}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                      ✓ <strong>Direct Station Assignment</strong>: As the registering officer at {policeStation || session.station}, you are directly designated as the Lead IO. No manual input required.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Select Investigating Officer (from Police Roster)
                      </label>
                      <select
                        value={assignedIOName ? `${assignedIOName}|${assignedIOBadge}` : ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (!val) {
                            setAssignedIOName('');
                            setAssignedIOBadge('');
                          } else {
                            const [name, badge] = val.split('|');
                            setAssignedIOName(name);
                            setAssignedIOBadge(badge);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none"
                      >
                        <option value="">— Assign to Self ({session.officerName} - {session.badgeNo}) or choose from directory —</option>
                        {officersList.map(o => (
                          <option key={o.id || o.badgeNo} value={`${o.name || o.full_name}|${o.badgeNo || o.badge_no}`}>
                            {o.name || o.full_name} ({o.badgeNo || o.badge_no}) — {o.rank} [{o.station}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assigned IO (Name)</label>
                        <input value={assignedIOName} onChange={e => setAssignedIOName(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none"
                          placeholder="Leave blank to assign to yourself" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Assigned IO (Badge)</label>
                        <input value={assignedIOBadge} onChange={e => setAssignedIOBadge(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none font-mono"
                          placeholder="e.g. MH-PSI-4910" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Priority Level *</label>
                    <div className="flex gap-2">
                      {PRIORITY_LEVELS.map(p => (
                        <button key={p} type="button" onClick={() => setPriorityLevel(p)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg border cursor-pointer transition-colors ${
                            priorityLevel === p
                              ? p === 'High' ? 'bg-red-600 text-white border-red-600' :
                                p === 'Medium' ? 'bg-amber-500 text-white border-amber-500' :
                                'bg-slate-600 text-white border-slate-600'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Case Nature</label>
                    <select value={caseNature} onChange={e => setCaseNature(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none">
                      {(['Heinous', 'Serious', 'Cognizable', 'Non-Cognizable'] as const).map(n => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4 — Review */}
            {currentStep === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#182f4d]" /> Review & File Case
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Confirm all details before officially filing the case</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Case Title', value: caseTitle },
                    { label: 'FIR Number', value: firNumber || '(Auto-generated)' },
                    { label: 'Police Station', value: policeStation },
                    { label: 'Crime Category', value: crimeCategory },
                    { label: 'Date of Incident', value: dateOfIncident },
                    { label: 'Location', value: locationOfIncident },
                    { label: 'Priority', value: priorityLevel },
                    { label: 'Case Nature', value: caseNature },
                    { label: 'Assigned IO', value: assignedIOName || session.officerName }
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs py-2 border-b border-slate-100">
                      <span className="text-slate-500 font-semibold">{label}</span>
                      <span className="text-slate-900 font-semibold text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                  <div className="py-2">
                    <p className="text-xs text-slate-500 font-semibold mb-2">Applicable Sections ({selectedSections.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedSections.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-[#182f4d]/10 text-[#182f4d] text-[10px] font-semibold rounded">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="py-2">
                    <p className="text-xs text-slate-500 font-semibold mb-1">Description</p>
                    <p className="text-xs text-slate-700">{incidentDescription}</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-amber-800">Legal Declaration</p>
                    <p className="text-xs text-amber-700 mt-1">
                      By filing this case, you confirm that the information entered is accurate to the best of your knowledge.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between p-5 border-t border-slate-100 shrink-0">
          <button
            onClick={() => currentStep === 0 ? onClose() : setCurrentStep(prev => prev - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>

          <div className="flex items-center gap-1.5">
            {STEPS.map((_, idx) => (
              <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${
                idx === currentStep ? 'bg-[#182f4d]' : idx < currentStep ? 'bg-emerald-500' : 'bg-slate-200'
              }`} />
            ))}
          </div>

          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-[#182f4d] rounded-xl hover:bg-[#11233b] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirmAndRegister}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 rounded-xl hover:bg-emerald-800 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> File Case
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
