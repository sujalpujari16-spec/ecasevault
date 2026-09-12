import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Scale, 
  FileText, 
  Upload, 
  ShieldCheck, 
  Check, 
  Calendar,
  Gavel,
  UserCheck,
  BookOpen,
  Clock,
  AlertCircle
} from 'lucide-react';
import { CaseFile, UserSession, CourtDocumentRecord, DocumentRecord, WitnessRecord } from '../types';
import { generateSimulatedSHA256 } from '../utils/policeWorkflow';
import { soundEffects } from './AudioEffects';
import { getAuthToken } from '../services/apiClient';

export type LegalModalMode = 'HEARING' | 'STATEMENT' | 'ORDER';

interface AddCourtDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseFile[];
  session: UserSession;
  onSaveCourtDocument: (updatedCase: CaseFile, docTitle: string) => void;
  preselectedCaseId?: string;
  initialMode?: LegalModalMode;
}

export type LegalDocType = 
  | 'COURT_ORDER'
  | 'FINAL_JUDGMENT'
  | 'BAIL_ORDER'
  | 'POLICE_REMAND_ORDER'
  | 'JUDICIAL_REMAND_ORDER'
  | 'NON_BAILABLE_WARRANT'
  | 'BAILABLE_WARRANT'
  | 'SUMMONS'
  | 'HEARING_RECORD'
  | 'WITNESS_STATEMENT';

export const AddCourtDocumentModal: React.FC<AddCourtDocumentModalProps> = ({
  isOpen,
  onClose,
  cases,
  session,
  onSaveCourtDocument,
  preselectedCaseId,
  initialMode = 'ORDER'
}) => {
  const [modalMode, setModalMode] = useState<LegalModalMode>(initialMode);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(preselectedCaseId || cases[0]?.id || '');

  useEffect(() => {
    if (initialMode) setModalMode(initialMode);
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (preselectedCaseId) setSelectedCaseId(preselectedCaseId);
  }, [preselectedCaseId, isOpen]);

  const selectedCase = cases.find(c => c.id === selectedCaseId);

  // Common Fields
  const [courtName, setCourtName] = useState('Metropolitan Magistrate 22nd Court, Andheri, Mumbai');
  const [rcNumber, setRcNumber] = useState(`CC-MH-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
  const [judgeName, setJudgeName] = useState('Hon. S. R. Deshpande, MM');
  const [publicProsecutor, setPublicProsecutor] = useState(session.officerName || 'Adv. Special Public Prosecutor');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mode 1: Hearing Fields
  const [hearingDate, setHearingDate] = useState(new Date().toISOString().substring(0, 10));
  const [nextHearingDate, setNextHearingDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10)
  );
  const [hearingStage, setHearingStage] = useState('EVIDENCE_RECORDING');
  const [hearingSummary, setHearingSummary] = useState('');

  // Mode 2: Statement Fields
  const [statementType, setStatementType] = useState<'STATEMENT_SEC_164_CRPC' | 'WITNESS_DEPOSITION' | 'LEGAL_SUBMISSION' | 'VICTIM_STATEMENT'>('STATEMENT_SEC_164_CRPC');
  const [deponentName, setDeponentName] = useState('');
  const [deponentRole, setDeponentRole] = useState('Key Eyewitness');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().substring(0, 10));
  const [statementText, setStatementText] = useState('');
  const [isOathAdministered, setIsOathAdministered] = useState(true);

  // Mode 3: Order Fields
  const [docType, setDocType] = useState<LegalDocType>('COURT_ORDER');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().substring(0, 10));
  const [orderSummary, setOrderSummary] = useState('');
  const [verdictOutcome, setVerdictOutcome] = useState<'CONVICTED' | 'ACQUITTED' | 'DISMISSED' | 'PENDING'>('CONVICTED');
  const [sentenceDetails, setSentenceDetails] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setUploadedFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setFilePreview(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
    soundEffects.playSnap();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;

    setIsSubmitting(true);
    soundEffects.playStamp();

    const timestamp = new Date().toISOString();
    const docId = `CRT-DOC-${Date.now().toString().slice(-6)}`;
    const hash = generateSimulatedSHA256((uploadedFile?.name || 'court-document') + Date.now());

    let uploadedRepoDoc: any = null;
    let finalFileUrl = filePreview || undefined;

    try {
      const formData = new FormData();
      formData.append('department', 'LEGAL');
      formData.append('documentType', modalMode === 'ORDER' ? 'COURT_ORDER' : modalMode === 'BAIL' ? 'BAIL_ORDER' : 'COURT_FILING');
      formData.append('title', modalMode === 'ORDER' ? orderTitle || `Judicial Order — ${selectedCase.firNumber}` : modalMode === 'BAIL' ? `Bail Ruling (${bailApplicantName}) — ${selectedCase.firNumber}` : `Hearing Record (${hearingDate}) — ${selectedCase.firNumber}`);
      formData.append('description', modalMode === 'ORDER' ? orderText.slice(0, 150) : modalMode === 'BAIL' ? bailRemarks.slice(0, 150) : hearingSummary.slice(0, 150));
      formData.append('classification', 'CONFIDENTIAL');

      if (uploadedFile) {
        formData.append('file', uploadedFile);
      } else {
        const courtContent = `%PDF-1.4 Judicial Order & Court Filing\nCourt: ${courtName}\nRC Number: ${rcNumber}\nJudge: ${judgeName}\nProsecutor: ${publicProsecutor}\nTimestamp: ${timestamp}`;
        const blob = new Blob([courtContent], { type: 'application/pdf' });
        formData.append('file', blob, `court_document_${Date.now()}.pdf`);
      }

      const res = await fetch(`/api/cases/${selectedCase.id}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken() || ''}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success && data.document) {
        uploadedRepoDoc = data.document;
        finalFileUrl = `/api/documents/${data.document.id}/download`;
      }
    } catch (uploadErr) {
      console.warn('[LEGAL UPLOAD] Cloud upload notice, proceeding with docket attachment:', uploadErr);
    }

    let newCourtDoc: CourtDocumentRecord;
    let newRepoDoc: DocumentRecord;
    let updatedCase: CaseFile = { ...selectedCase };
    let finalTitle = '';

    if (modalMode === 'HEARING') {
      if (!hearingSummary.trim()) {
        alert('Please enter hearing proceedings or summary of daily order.');
        setIsSubmitting(false);
        return;
      }

      finalTitle = `Hearing Record: ${hearingStage.replace(/_/g, ' ')} (${hearingDate})`;

      newCourtDoc = {
        id: docId,
        caseId: selectedCase.id,
        courtName,
        rcNumber,
        documentType: 'HEARING_RECORD',
        title: finalTitle,
        dateIssued: hearingDate,
        judgeName,
        publicProsecutor,
        hearingDate,
        nextHearingDate: nextHearingDate || undefined,
        hearingStage,
        orderSummary: `Hearing Stage: ${hearingStage.replace(/_/g, ' ')}\nPresiding: ${judgeName}\n\nProceedings & Directives:\n${hearingSummary}\nNext Date: ${nextHearingDate || 'Adjourned Sine Die'}`,
        documentHash: hash,
        isCourtCertified: true,
        fileUrl: finalFileUrl,
        fileName: uploadedFile?.name || `hearing_record_${hearingDate}.pdf`,
        fileSize: uploadedFile?.size || 102400
      };

      newRepoDoc = {
        id: `DOC-HEARING-${Date.now().toString().slice(-6)}`,
        docNumber: `HRG-${rcNumber}-${hearingDate.replace(/-/g, '')}`,
        caseId: selectedCase.id,
        title: finalTitle,
        type: 'COURT_FILING',
        department: 'PROSECUTION_LEGAL',
        clearance: 'RESTRICTED',
        authorName: publicProsecutor,
        authorRank: session.rank || 'Prosecuting Advocate',
        createdDate: hearingDate,
        lastModified: hearingDate,
        version: '1.0',
        sha256Hash: hash,
        digitalSignature: {
          signedBy: `${publicProsecutor} (${session.badgeNo || 'BAR-MH'})`,
          certId: `CERT-HRG-${Date.now().toString().slice(-6)}`,
          timestamp: `${hearingDate} 17:30 IST`,
          isVerified: true
        },
        summary: `Court hearing before ${judgeName} (${courtName}). Stage: ${hearingStage}. Next Date: ${nextHearingDate}.`,
        tags: ['HEARING_RECORD', 'COURT_PROCEEDING', hearingStage],
        contentBody: `COURT OF ${courtName.toUpperCase()}\n` +
          `CASE CNR/RC: ${rcNumber}\n` +
          `PRESIDING JUDGE: ${judgeName}\n` +
          `PROSECUTOR: ${publicProsecutor}\n` +
          `HEARING DATE: ${hearingDate}\n` +
          `HEARING STAGE: ${hearingStage}\n\n` +
          `DAILY ORDER & PROCEEDINGS:\n${hearingSummary}\n\n` +
          `NEXT HEARING SCHEDULED: ${nextHearingDate || 'TBD'}\n`,
        attachmentsCount: uploadedFile ? 1 : 0,
        fileUrl: finalFileUrl,
        fileName: uploadedFile?.name || `hearing_order_${hearingDate}.pdf`,
        fileSize: uploadedFile?.size || 102400,
        mimeType: uploadedFile?.type || 'application/pdf'
      };

      const newHearingEntry = {
        id: `HRG-${Date.now().toString(36).toUpperCase()}`,
        caseId: selectedCase.id,
        hearingDate,
        court: courtName,
        hearingType: (hearingStage as any) || 'EVIDENCE_RECORDING',
        status: 'CONCLUDED' as const,
        summary: hearingSummary,
        judgeOrMagistrate: judgeName,
        createdBy: publicProsecutor,
        createdAt: timestamp
      };

      updatedCase = {
        ...selectedCase,
        courtRecords: [newCourtDoc, ...(selectedCase.courtRecords || [])],
        hearings: [newHearingEntry as any, ...(selectedCase.hearings || [])],
        documents: [newRepoDoc, ...(selectedCase.documents || [])],
        timeline: [
          {
            id: `TL-HRG-${Date.now()}`,
            date: hearingDate,
            title: `Court Hearing Concluded: ${hearingStage.replace(/_/g, ' ')}`,
            description: `Proceedings conducted before ${judgeName} (${courtName}). Next date of hearing: ${nextHearingDate || 'Sine Die'}. Summary: ${hearingSummary.slice(0, 120)}...`,
            officer: publicProsecutor,
            badge: session.badgeNo || 'LEGAL-PROSECUTOR',
            type: 'CHARGE_SHEET'
          },
          ...(selectedCase.timeline || [])
        ]
      };

    } else if (modalMode === 'STATEMENT') {
      if (!deponentName.trim() || !statementText.trim()) {
        alert('Please specify the deponent name and enter the statement transcript.');
        setIsSubmitting(false);
        return;
      }

      const stmtLabel = statementType === 'STATEMENT_SEC_164_CRPC' 
        ? 'Sec 164 CrPC Judicial Statement' 
        : statementType === 'WITNESS_DEPOSITION'
        ? 'In-Court Witness Deposition'
        : statementType === 'LEGAL_SUBMISSION'
        ? 'Prosecution Written Submission'
        : 'Victim/Complainant Statement';

      finalTitle = `${stmtLabel} — ${deponentName}`;

      newCourtDoc = {
        id: docId,
        caseId: selectedCase.id,
        courtName,
        rcNumber,
        documentType: 'WITNESS_STATEMENT',
        title: finalTitle,
        dateIssued: statementDate,
        judgeName,
        publicProsecutor,
        hearingDate: statementDate,
        statementDeponentName: deponentName,
        statementDeponentRole: deponentRole,
        orderSummary: `Nature: ${stmtLabel}\nDeponent: ${deponentName} (${deponentRole})\nRecording Magistrate: ${judgeName}\nOath Administered: ${isOathAdministered ? 'Yes' : 'No'}\n\nStatement Content:\n${statementText}`,
        documentHash: hash,
        isCourtCertified: true,
        fileUrl: finalFileUrl,
        fileName: uploadedFile?.name || `statement_${deponentName.replace(/ /g, '_')}.pdf`,
        fileSize: uploadedFile?.size || 102400
      };

      newRepoDoc = {
        id: `DOC-STMT-${Date.now().toString().slice(-6)}`,
        docNumber: `STMT-${rcNumber}-${Date.now().toString().slice(-4)}`,
        caseId: selectedCase.id,
        title: finalTitle,
        type: 'WITNESS_STATEMENT',
        department: 'PROSECUTION_LEGAL',
        clearance: 'RESTRICTED',
        authorName: judgeName || publicProsecutor,
        authorRank: 'Judicial Magistrate / Legal Counsel',
        createdDate: statementDate,
        lastModified: statementDate,
        version: '1.0',
        sha256Hash: hash,
        digitalSignature: {
          signedBy: `${judgeName} / ${publicProsecutor}`,
          certId: `CERT-STMT-${Date.now().toString().slice(-6)}`,
          timestamp: `${statementDate} 16:00 IST`,
          isVerified: true
        },
        summary: `${stmtLabel} of ${deponentName} (${deponentRole}) recorded under judicial seal before ${judgeName}.`,
        tags: ['WITNESS_STATEMENT', statementType, 'COURT_RECORD'],
        contentBody: `RECORD OF STATEMENT BEFORE ${courtName.toUpperCase()}\n` +
          `CASE CNR/RC: ${rcNumber}\n` +
          `MAGISTRATE/JUDGE: ${judgeName}\n` +
          `DEPONENT: ${deponentName} (Role: ${deponentRole})\n` +
          `OATH ADMINISTERED: ${isOathAdministered ? 'Administered according to law' : 'Confessional statement'}\n` +
          `DATE RECORDED: ${statementDate}\n\n` +
          `STATEMENT TRANSCRIPT:\n${statementText}\n`,
        attachmentsCount: uploadedFile ? 1 : 0,
        fileUrl: finalFileUrl,
        fileName: uploadedFile?.name || `signed_statement_${deponentName.replace(/ /g, '_')}.pdf`,
        fileSize: uploadedFile?.size || 102400,
        mimeType: uploadedFile?.type || 'application/pdf'
      };

      // Add or update matching witness in the case
      const existingWitnessIndex = (selectedCase.witnesses || []).findIndex(
        w => w.name.toLowerCase().trim() === deponentName.toLowerCase().trim()
      );

      let updatedWitnesses: WitnessRecord[];
      if (existingWitnessIndex >= 0) {
        updatedWitnesses = (selectedCase.witnesses || []).map((w, i) => {
          if (i === existingWitnessIndex) {
            return {
              ...w,
              statementStatus: 'Statement Recorded' as const,
              statementDate,
              recordedBy: `${judgeName} (Judicial Court)`,
              statementSummary: statementText.slice(0, 300),
              relatedDocIds: [newRepoDoc.id, ...(w.relatedDocIds || [])]
            };
          }
          return w;
        });
      } else {
        const newWitness: WitnessRecord = {
          id: `WIT-${Date.now().toString().slice(-5)}`,
          caseId: selectedCase.id,
          name: deponentName,
          statementStatus: 'Statement Recorded',
          statementDate,
          recordedBy: `${judgeName} (Court)`,
          protectionRequired: false,
          statementSummary: statementText.slice(0, 300),
          relatedDocIds: [newRepoDoc.id]
        };
        updatedWitnesses = [newWitness, ...(selectedCase.witnesses || [])];
      }

      updatedCase = {
        ...selectedCase,
        witnesses: updatedWitnesses,
        courtRecords: [newCourtDoc, ...(selectedCase.courtRecords || [])],
        documents: [newRepoDoc, ...(selectedCase.documents || [])],
        timeline: [
          {
            id: `TL-STMT-${Date.now()}`,
            date: statementDate,
            title: `Judicial Statement Recorded: ${deponentName}`,
            description: `${stmtLabel} recorded by ${judgeName} before ${courtName}. Cryptographically signed & anchored.`,
            officer: publicProsecutor,
            badge: session.badgeNo || 'LEGAL-PROSECUTOR',
            type: 'CHARGE_SHEET'
          },
          ...(selectedCase.timeline || [])
        ]
      };

    } else {
      // MODE 3: ORDER / JUDGMENT
      if (!orderSummary.trim()) {
        alert('Please enter judicial order summary or court directives.');
        setIsSubmitting(false);
        return;
      }

      finalTitle = `${docType.replace(/_/g, ' ')} — ${rcNumber}`;

      newCourtDoc = {
        id: docId,
        caseId: selectedCase.id,
        courtName,
        rcNumber,
        documentType: docType,
        title: finalTitle,
        dateIssued: orderDate,
        judgeName,
        publicProsecutor,
        hearingDate: orderDate,
        nextHearingDate: nextHearingDate || undefined,
        orderSummary: orderSummary + (docType === 'FINAL_JUDGMENT' && sentenceDetails ? `\nVerdict: ${verdictOutcome}. Sentence: ${sentenceDetails}` : ''),
        documentHash: hash,
        isCourtCertified: true,
        fileUrl: finalFileUrl,
        fileName: uploadedFile?.name || `${docType.toLowerCase()}_signed.pdf`,
        fileSize: uploadedFile?.size || 102400
      };

      newRepoDoc = {
        id: `DOC-COURT-${Date.now().toString().slice(-6)}`,
        docNumber: `CRT-MH-${rcNumber}`,
        caseId: selectedCase.id,
        title: `Judicial Order: ${docType.replace(/_/g, ' ')} (${rcNumber})`,
        type: docType === 'FINAL_JUDGMENT' ? 'LEGAL_NOTICE_JUDGMENT' : 'COURT_FILING',
        department: 'PROSECUTION_LEGAL',
        clearance: 'RESTRICTED',
        authorName: publicProsecutor,
        authorRank: session.rank || 'Public Prosecutor',
        createdDate: orderDate,
        lastModified: orderDate,
        version: '1.0',
        sha256Hash: hash,
        digitalSignature: {
          signedBy: `${publicProsecutor} (${session.badgeNo || 'BAR-MH'})`,
          certId: `CERT-CRT-${Date.now().toString().slice(-6)}`,
          timestamp: `${orderDate} 17:00 IST`,
          isVerified: true
        },
        summary: `Judicial filing before ${courtName}. Presiding: ${judgeName}. ${orderSummary.slice(0, 120)}...`,
        tags: ['COURT_RECORD', docType, 'JUDICIAL_FILING'],
        contentBody: `IN THE COURT OF ${courtName.toUpperCase()}\n` +
          `CASE CNR / RC NUMBER: ${rcNumber}\n` +
          `BEFORE: ${judgeName}\n` +
          `PROSECUTING COUNSEL: ${publicProsecutor}\n` +
          `ORDER DATE: ${orderDate}\n` +
          `DOCUMENT NATURE: ${docType}\n\n` +
          `SUMMARY OF JUDICIAL PRONOUNCEMENT / DIRECTIVES:\n${orderSummary}\n` +
          (docType === 'FINAL_JUDGMENT' ? `\nVERDICT: ${verdictOutcome}\nSENTENCE / DISPOSAL: ${sentenceDetails}\n` : ''),
        attachmentsCount: uploadedFile ? 1 : 0,
        fileUrl: finalFileUrl,
        fileName: uploadedFile?.name || `${docType.toLowerCase()}.pdf`,
        fileSize: uploadedFile?.size || 102400,
        mimeType: uploadedFile?.type || 'application/pdf'
      };

      let newStatus = selectedCase.status;
      if (docType === 'FINAL_JUDGMENT') {
        newStatus = 'Closed';
      } else if (selectedCase.status === 'Legal Review') {
        newStatus = 'Charge Sheet / Court Process';
      }

      updatedCase = {
        ...selectedCase,
        status: newStatus,
        courtRecords: [newCourtDoc, ...(selectedCase.courtRecords || [])],
        documents: [newRepoDoc, ...(selectedCase.documents || [])],
        timeline: [
          {
            id: `TL-CRT-${Date.now()}`,
            date: orderDate,
            title: `Court Proceeding: ${docType.replace(/_/g, ' ')}`,
            description: `Pronounced by ${judgeName} (${courtName}). Summary: ${orderSummary.slice(0, 140)}. Anchored in Judicial Repository.`,
            officer: publicProsecutor,
            badge: session.badgeNo || 'LEGAL-PROSECUTOR',
            type: 'CHARGE_SHEET'
          },
          ...(selectedCase.timeline || [])
        ]
      };
    }

    if (uploadedRepoDoc) {
      updatedCase.repositoryDocuments = [uploadedRepoDoc, ...(updatedCase.repositoryDocuments || []).filter((d: any) => d.id !== uploadedRepoDoc.id)];
    }
    onSaveCourtDocument(updatedCase, finalTitle);
    window.dispatchEvent(new CustomEvent('casevault:file-updated', { detail: { caseId: selectedCase.id } }));
    window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: { caseId: selectedCase.id } }));
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-linear-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
              <Scale className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Prosecution & Court Document Center</h2>
              <p className="text-[11px] text-indigo-200/80">ICJS Judicial Pillar (Metropolitan & Sessions Court Integration)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Operational Mode Segmented Tabs */}
        <div className="bg-slate-100 p-2 border-b border-slate-200 flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEffects.playSnap();
              setModalMode('HEARING');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              modalMode === 'HEARING'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Calendar className="w-4 h-4 text-indigo-700" />
            <span>Record Court Hearing</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEffects.playSnap();
              setModalMode('STATEMENT');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              modalMode === 'STATEMENT'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-700" />
            <span>Upload Statement (Sec 164)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEffects.playSnap();
              setModalMode('ORDER');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              modalMode === 'ORDER'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Gavel className="w-4 h-4 text-indigo-700" />
            <span>Court Order / Judgment</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Target Case Docket */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Target Case Docket:</label>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600 cursor-pointer"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firNumber || c.id} — {c.caseTitle} ({c.policeStation || 'Mumbai Police'})
                </option>
              ))}
            </select>
          </div>

          {/* MODE 1: COURT HEARING RECORD */}
          {modalMode === 'HEARING' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-indigo-950">
                  <span className="font-bold">Court Hearing Logging & Daily Order Sheet:</span>
                  <p className="text-indigo-800/80 mt-0.5">
                    Record formal judicial hearing proceedings, adjournment dates, orders passed, and upload scanned certified order sheets directly into the tamper-evident docket.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Hearing Stage / Agenda:</label>
                  <select
                    value={hearingStage}
                    onChange={(e) => setHearingStage(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600"
                  >
                    <option value="REMAND_EXTENSION">⚖️ Remand Extension / Production Hearing</option>
                    <option value="BAIL_APPLICATION">📜 Bail Application Arguments</option>
                    <option value="FRAMING_OF_CHARGES">📑 Framing of Charges (Sec 228 / 240 CrPC)</option>
                    <option value="EVIDENCE_RECORDING">🎙️ Evidence of Prosecution / Witness Recording</option>
                    <option value="STATEMENT_OF_ACCUSED">🗣️ Statement of Accused (Sec 313 CrPC)</option>
                    <option value="FINAL_ARGUMENTS">⚖️ Final Arguments (Sec 314 CrPC)</option>
                    <option value="JUDGMENT_SENTENCING">🏛️ Judgment & Pronouncement of Sentence</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Court / Coram Details:</label>
                  <input
                    type="text"
                    value={courtName}
                    onChange={(e) => setCourtName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    placeholder="e.g. Sessions Court Courtroom 14, Mumbai"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Hearing Date (Conducted):</label>
                  <input
                    type="date"
                    value={hearingDate}
                    onChange={(e) => setHearingDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Next Hearing Date (Adjourned To):</label>
                  <input
                    type="date"
                    value={nextHearingDate}
                    onChange={(e) => setNextHearingDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Presiding Judicial Officer / Judge:</label>
                  <input
                    type="text"
                    value={judgeName}
                    onChange={(e) => setJudgeName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Prosecuting Counsel / PP:</label>
                  <input
                    type="text"
                    value={publicProsecutor}
                    onChange={(e) => setPublicProsecutor(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Daily Proceedings Summary & Orders Passed:</label>
                <textarea
                  required
                  rows={3}
                  value={hearingSummary}
                  onChange={(e) => setHearingSummary(e.target.value)}
                  placeholder="Record summary of arguments presented, witnesses examined, court directives, or bail conditions imposed..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-600 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* MODE 2: WITNESS / SEC 164 STATEMENT */}
          {modalMode === 'STATEMENT' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-2.5">
                <UserCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-950">
                  <span className="font-bold">Sec 164 CrPC Judicial Statement & Court Deposition:</span>
                  <p className="text-amber-800/80 mt-0.5">
                    Upload statements recorded before a Magistrate under Section 164 CrPC or in-court witness depositions under Section 137 Indian Evidence Act / BSA.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Statement Category:</label>
                  <select
                    value={statementType}
                    onChange={(e) => setStatementType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600"
                  >
                    <option value="STATEMENT_SEC_164_CRPC">⚖️ Section 164 CrPC Confession / Statement before Magistrate</option>
                    <option value="WITNESS_DEPOSITION">🎙️ Court Witness Deposition (Chief / Cross Examination)</option>
                    <option value="VICTIM_STATEMENT">🛡️ Victim / Complainant In-Court Statement</option>
                    <option value="LEGAL_SUBMISSION">📑 Prosecution Written Submission / Legal Memo</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Date Recorded:</label>
                  <input
                    type="date"
                    value={statementDate}
                    onChange={(e) => setStatementDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Deponent Full Name:</label>
                  <input
                    type="text"
                    value={deponentName}
                    onChange={(e) => setDeponentName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar Shinde"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Role / Relation to Case:</label>
                  <select
                    value={deponentRole}
                    onChange={(e) => setDeponentRole(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600"
                  >
                    <option value="Key Eyewitness">Key Eyewitness (PW-1)</option>
                    <option value="Complainant / First Informant">Complainant / First Informant</option>
                    <option value="Material Witness">Material Witness</option>
                    <option value="Accused / Confessing Suspect">Accused / Confessing Suspect</option>
                    <option value="Forensic / Medical Expert">Forensic / Medical Expert</option>
                    <option value="Panch Witness">Panch Witness</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Recording Judicial Magistrate / Court:</label>
                  <input
                    type="text"
                    value={judgeName}
                    onChange={(e) => setJudgeName(e.target.value)}
                    placeholder="e.g. Hon. S. R. Deshpande, Metropolitan Magistrate"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Statutory Certificate:</label>
                  <label className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isOathAdministered}
                      onChange={(e) => setIsOathAdministered(e.target.checked)}
                      className="rounded text-indigo-700"
                    />
                    <span className="text-slate-800 font-medium">Oath & Voluntariness Certificate Administered</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Statement Transcript / Summary of Deposition:</label>
                <textarea
                  required
                  rows={4}
                  value={statementText}
                  onChange={(e) => setStatementText(e.target.value)}
                  placeholder="Enter verbatim or structured record of the witness deposition, question-answers, or Section 164 confession statement..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-600 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* MODE 3: ORDERS & JUDGMENTS */}
          {modalMode === 'ORDER' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Court Order / Document Type:</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as LegalDocType)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-indigo-600"
                  >
                    <option value="COURT_ORDER">📜 Interlocutory Court Order</option>
                    <option value="POLICE_REMAND_ORDER">🚔 Police Custody Remand Order (PC)</option>
                    <option value="JUDICIAL_REMAND_ORDER">🏛️ Judicial Custody Remand Order (JC)</option>
                    <option value="BAIL_ORDER">🔓 Regular / Anticipatory Bail Order</option>
                    <option value="NON_BAILABLE_WARRANT">⚠️ Non-Bailable Warrant (NBW)</option>
                    <option value="BAILABLE_WARRANT">📑 Bailable Warrant</option>
                    <option value="SUMMONS">📩 Witness / Accused Summons</option>
                    <option value="FINAL_JUDGMENT">⚖️ Final Judgment & Sentence</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Case CNR / CC Register Number:</label>
                  <input
                    type="text"
                    value={rcNumber}
                    onChange={(e) => setRcNumber(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Presiding Judicial Officer / Judge:</label>
                  <input
                    type="text"
                    value={judgeName}
                    onChange={(e) => setJudgeName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Order / Pronouncement Date:</label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              {/* If Judgment: Verdict & Sentence */}
              {docType === 'FINAL_JUDGMENT' && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-indigo-950">Verdict Outcome:</label>
                      <select
                        value={verdictOutcome}
                        onChange={(e) => setVerdictOutcome(e.target.value as any)}
                        className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-indigo-900 outline-none"
                      >
                        <option value="CONVICTED">⚖️ CONVICTED</option>
                        <option value="ACQUITTED">🕊️ ACQUITTED</option>
                        <option value="DISMISSED">❌ DISMISSED</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-indigo-950">Sentence / Fine Amount:</label>
                      <input
                        type="text"
                        placeholder="e.g. 3 Years Rigorous Imprisonment & ₹ 50,000 fine"
                        value={sentenceDetails}
                        onChange={(e) => setSentenceDetails(e.target.value)}
                        className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-xs text-indigo-950 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Judicial Directives & Summary of Order:</label>
                <textarea
                  required
                  rows={4}
                  value={orderSummary}
                  onChange={(e) => setOrderSummary(e.target.value)}
                  placeholder="Enter specific court directives, bail conditions, remand period, or operative portion of the order..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-indigo-600 leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Upload Certified Copy / Scanned Document (Common for all modes) */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <label className="font-bold text-slate-700">
              Attach Certified Copy of {modalMode === 'HEARING' ? 'Daily Hearing Order Sheet' : modalMode === 'STATEMENT' ? 'Signed Statement Scan' : 'Court Order / Judgment'} (PDF / Scan):
            </label>
            <div className="p-4 border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/40 text-center space-y-2">
              {uploadedFile ? (
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-indigo-200">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-700" />
                    <div className="text-left">
                      <p className="font-bold text-slate-900 text-xs truncate max-w-xs">{uploadedFile.name}</p>
                      <p className="text-[10px] text-slate-400">{(uploadedFile.size / 1024).toFixed(1)} KB • Certified Copy</p>
                    </div>
                  </div>
                  <label className="px-2.5 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded text-xs font-bold cursor-pointer transition-colors">
                    Change File
                    <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-700 font-semibold">Upload signed copy from Court Registry / e-Courts</p>
                  <p className="text-[11px] text-slate-400">Supported formats: PDF, Scanned Image (Max 25 MB)</p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select Court Document</span>
                    <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={handleFileChange} className="hidden" />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Statutory Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Judicial Record Integrity (e-Courts Integration):</span>
              <p className="text-slate-500 mt-0.5">
                Uploaded court hearings, statements, and orders are anchored with SHA-256 digests into the case repository, establishing immutable judicial milestones visible to the investigation and prosecution teams.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>
                {isSubmitting 
                  ? 'Recording...' 
                  : modalMode === 'HEARING' 
                  ? 'Record Court Hearing' 
                  : modalMode === 'STATEMENT' 
                  ? 'File Judicial Statement' 
                  : 'Register Court Document'}
              </span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
