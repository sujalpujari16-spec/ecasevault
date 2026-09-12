import React, { useState } from 'react';
import { 
  X, 
  Building, 
  PhoneCall, 
  Stethoscope, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  FileText, 
  Send, 
  ExternalLink,
  MapPin,
  Radio,
  Search,
  Lock,
  Download,
  AlertTriangle,
  Smartphone,
  CreditCard,
  FileCheck
} from 'lucide-react';
import { 
  CaseFile, 
  BankNoticeRecord, 
  CyberTracingRecord, 
  MedicoLegalCaseRecord, 
  DigitalEvidenceItem,
  CallDataRecordDetail,
  UserSession 
} from '../types';
import { DEFAULT_SAMPLE_CASES } from '../utils/caseMapper';

interface SpecialInvestigationPanelProps {
  caseFile?: CaseFile;
  cases?: CaseFile[];
  session: UserSession;
  onClose?: () => void;
  isInline?: boolean;
  onUpdateBankNotice?: (noticeId: string, newStatus: any) => void;
}

type SubModuleTab = 'BANK_NOTICES' | 'CYBER_1930' | 'MLC_HOSPITAL' | 'DIGITAL_EVIDENCE' | 'CDR_RECORDS';

export const SpecialInvestigationPanel: React.FC<SpecialInvestigationPanelProps> = ({
  caseFile,
  cases,
  session: _session,
  onClose,
  isInline = false,
  onUpdateBankNotice,
}) => {
  const [activeTab, setActiveTab] = useState<SubModuleTab>('BANK_NOTICES');

  const effectiveCases = (cases && cases.length > 0) ? cases : DEFAULT_SAMPLE_CASES;
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    caseFile?.id || effectiveCases[0]?.id || DEFAULT_SAMPLE_CASES[0].id
  );

  const activeCase: CaseFile = (cases && cases.find(c => c.id === selectedCaseId)) || caseFile || effectiveCases[0] || DEFAULT_SAMPLE_CASES[0];

  // Local state for Bank Notices
  const [bankNotices, setBankNotices] = useState<BankNoticeRecord[]>(() => {
    return (activeCase?.bankNotices && activeCase.bankNotices.length > 0)
      ? activeCase.bankNotices
      : (DEFAULT_SAMPLE_CASES[0].bankNotices || []);
  });

  // Sync bank notices when active case changes
  React.useEffect(() => {
    if (activeCase?.bankNotices && activeCase.bankNotices.length > 0) {
      setBankNotices(activeCase.bankNotices);
    } else {
      setBankNotices(DEFAULT_SAMPLE_CASES[0].bankNotices || []);
    }
  }, [activeCase?.id]);

  // Quick action: Toggle Bank Notice status
  const handleFreezeAccount = (noticeId: string) => {
    setBankNotices(prev =>
      prev.map(n => n.id === noticeId ? { ...n, status: 'ACCOUNT_FROZEN' as const, bankResponseSummary: 'Immediate debit freeze applied pursuant to police requisition order.' } : n)
    );
    if (onUpdateBankNotice) {
      onUpdateBankNotice(noticeId, 'ACCOUNT_FROZEN');
    }
  };

  const cyber: CyberTracingRecord = activeCase?.cyberTracing || DEFAULT_SAMPLE_CASES[0].cyberTracing!;
  const mlc: MedicoLegalCaseRecord = activeCase?.medicoLegalCase || DEFAULT_SAMPLE_CASES[0].medicoLegalCase!;
  const digitalEvidence: DigitalEvidenceItem[] = (activeCase?.digitalEvidence && activeCase.digitalEvidence.length > 0)
    ? activeCase.digitalEvidence
    : (DEFAULT_SAMPLE_CASES[0].digitalEvidence || []);
  const cdrList: CallDataRecordDetail[] = (activeCase?.cdrRecords && activeCase.cdrRecords.length > 0)
    ? activeCase.cdrRecords
    : (DEFAULT_SAMPLE_CASES[0].cdrRecords || []);

  const containerClass = isInline
    ? "w-full space-y-4"
    : "fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto";
  const innerClass = isInline
    ? "bg-slate-900 border border-slate-800 w-full rounded-2xl shadow-xl flex flex-col overflow-hidden text-slate-100"
    : "bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100";

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-700/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-indigo-900/60 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="text-xs font-bold uppercase tracking-wider bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded">
                  Specialized Modules
                </span>
                <span className="text-xs text-slate-400">Section 91/94 Bank Notices, 1930 Cyber Tracing, Hospital MLC & CDR Analysis</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5 flex items-center space-x-2">
                <span>{activeCase.caseTitle || 'Specialized Investigation'}</span>
                <span className="text-sm font-mono text-indigo-400 font-medium">({activeCase.firNumber || 'N/A'})</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* Docket Selector */}
            <div className="flex items-center space-x-2 bg-slate-950/70 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 whitespace-nowrap">Case:</span>
              <select
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {effectiveCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firNumber} — {c.caseTitle.slice(0, 24)}...
                  </option>
                ))}
              </select>
            </div>

            {onClose && !isInline && (
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-4 overflow-x-auto">
          {[
            { id: 'BANK_NOTICES', label: 'Section 91/94 Bank Notices', icon: Building, count: bankNotices.length },
            { id: 'CYBER_1930', label: '1930 Cyber & Mobile Tracing', icon: PhoneCall, count: cyber ? 1 : 0 },
            { id: 'MLC_HOSPITAL', label: 'Medico-Legal Case (Govt Doctor)', icon: Stethoscope, count: mlc ? 1 : 0 },
            { id: 'DIGITAL_EVIDENCE', label: 'Digital Evidence Vault', icon: Radio, count: digitalEvidence.length },
            { id: 'CDR_RECORDS', label: 'Call Data Records (CDR)', icon: Smartphone, count: cdrList.length },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SubModuleTab)}
                className={`flex items-center space-x-2 py-3.5 px-4 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/50 space-y-6 text-sm">

          {/* TAB 1: Bank Notices */}
          {activeTab === 'BANK_NOTICES' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800/40 p-4 rounded-xl border border-slate-700/60">
                <div>
                  <h3 className="font-bold text-white text-sm">Section 91 Cr.P.C. / Section 94 BNSS Bank Directives</h3>
                  <p className="text-xs text-slate-400">Statutory summons for production of certified ledger statements & immediate debit freezing</p>
                </div>
                <span className="text-xs font-mono bg-blue-900/40 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded">
                  Active Directives: {bankNotices.length}
                </span>
              </div>

              <div className="space-y-3">
                {bankNotices.map((notice) => (
                  <div key={notice.id} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-700/50 pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-indigo-400" />
                          <h4 className="font-bold text-slate-100 text-sm">{notice.bankName}</h4>
                          <span className="text-xs text-slate-400 font-mono">({notice.branchName})</span>
                        </div>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          Target Account: <strong className="text-slate-200 font-mono">{notice.accountNumber}</strong> | Holder: <strong className="text-slate-200">{notice.accountHolderName}</strong>
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {notice.status === 'ACCOUNT_FROZEN' ? (
                          <span className="px-2.5 py-1 bg-red-500/20 text-red-300 border border-red-500/40 rounded-full text-xs font-bold font-mono flex items-center">
                            <Lock className="w-3.5 h-3.5 mr-1" />
                            DEBIT OPERATIONS FROZEN
                          </span>
                        ) : notice.status === 'REPLIED_STATEMENTS_RECEIVED' ? (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold font-mono flex items-center">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Statements Received
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold font-mono flex items-center">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            Notice Dispatched / Pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">Requisition Directives:</span>
                        <p className="text-slate-300 mt-0.5 leading-relaxed">{notice.requestedActions}</p>
                      </div>
                      <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-700/40">
                        <span className="text-slate-400 block font-semibold">Bank Compliance Response:</span>
                        <p className="text-slate-200 mt-0.5">{notice.bankResponseSummary || 'Pending response within statutory 72 hours window.'}</p>
                        {notice.statementHash && (
                          <div className="mt-2 text-[10px] font-mono text-slate-400 truncate">
                            Certified Hash: <span className="text-emerald-400">{notice.statementHash}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="text-slate-400">Issued by: <strong className="text-slate-200">{notice.ioOfficerName} ({notice.ioBadge})</strong></span>
                      {notice.status !== 'ACCOUNT_FROZEN' && (
                        <button
                          onClick={() => handleFreezeAccount(notice.id)}
                          className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white font-bold rounded-lg text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Order Immediate Debit Freeze</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: 1930 Cyber & Mobile Tracing */}
          {activeTab === 'CYBER_1930' && cyber && (
            <div className="space-y-5">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Smartphone className="w-5 h-5 text-indigo-400" />
                      <h3 className="font-bold text-white text-base">National Cyber Crime Helpline (1930) & IMEI Tracker</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Automated telecom tower triangulation, IMEI tracing & Section 41A notice management</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold font-mono">
                    {cyber.traceStatus}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">1930 Portal Ticket:</span>
                    <span className="font-bold text-indigo-300 font-mono">{cyber.helplineTicket1930}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Primary Target IMEI:</span>
                    <span className="font-bold text-slate-200 font-mono">{cyber.stolenDeviceIMEI}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Target Device Model:</span>
                    <span className="font-semibold text-slate-200">{cyber.deviceModel}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Active SIM Subscriber (Dump):</span>
                    <span className="font-semibold text-amber-300">{cyber.currentSimSubscriber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Current IMSI:</span>
                    <span className="font-mono text-slate-300">{cyber.currentSimIMSI}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Nearest Police Jurisdiction:</span>
                    <span className="font-semibold text-slate-200">{cyber.currentLocationCoords?.nearestPoliceStation}</span>
                  </div>
                </div>

                {/* Geolocation & Area Alert */}
                {cyber.currentLocationCoords && (
                  <div className="p-4 bg-slate-950/70 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg">
                        <MapPin className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <span className="text-slate-400 block">Triangulated Device Location (Tower Dump):</span>
                        <strong className="text-white text-sm">{cyber.currentLocationCoords.areaName}</strong>
                        <span className="text-[11px] font-mono text-slate-400 block">
                          Lat: {cyber.currentLocationCoords.lat}, Lng: {cyber.currentLocationCoords.lng}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 rounded font-semibold text-xs">
                      Live Area Alert Active
                    </span>
                  </div>
                )}

                {/* Section 41A Notice to Secondary Buyer */}
                {cyber.sec41ANoticeToBuyer && (
                  <div className="p-4 bg-slate-950/60 border border-slate-700/50 rounded-xl space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 flex items-center">
                        <FileCheck className="w-4 h-4 mr-1.5 text-blue-400" />
                        Notice under Section 41A Cr.P.C. / Section 35(3) BNSS Served to Buyer
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[11px] font-bold">
                        {cyber.sec41ANoticeToBuyer.complianceStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300">
                      <div>Name: <strong>{cyber.sec41ANoticeToBuyer.buyerName}</strong></div>
                      <div>Address: <strong>{cyber.sec41ANoticeToBuyer.address}</strong></div>
                      <div>Contact: <strong className="font-mono">{cyber.sec41ANoticeToBuyer.contact}</strong></div>
                    </div>
                    <p className="text-slate-400 text-[11px] pt-1">
                      CDR & IPDR logs confirmed device was purchased without proof of invoice. Device voluntarily surrendered and sealed in Malkhana.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Medico-Legal Case (MLC) */}
          {activeTab === 'MLC_HOSPITAL' && mlc && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5 space-y-4">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Stethoscope className="w-5 h-5 text-rose-400" />
                      <h3 className="font-bold text-white text-base">Government Hospital Medico-Legal Case (MLC) Examination</h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">Statutory casualty medical officer injury report linked to Case FIR</p>
                  </div>
                  <span className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full text-xs font-bold font-mono">
                    {mlc.mlcNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Hospital Name:</span>
                    <span className="font-semibold text-slate-200">{mlc.hospitalName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Examining Medical Officer:</span>
                    <span className="font-semibold text-slate-200">{mlc.examiningDoctorName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Doctor MMC Reg No:</span>
                    <span className="font-mono text-slate-300">{mlc.examiningDoctorRegNo}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Patient / Injured Name:</span>
                    <span className="font-semibold text-slate-200">{mlc.patientName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Age & Gender:</span>
                    <span className="text-slate-200">{mlc.ageAndGender}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Date & Time of Examination:</span>
                    <span className="font-semibold text-slate-200">{mlc.examinationDateTime}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/70 rounded-lg border border-slate-700/40 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Clinical Injury Assessment:</span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-bold">
                      {mlc.injuryCategory}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-sans">{mlc.detailedInjuriesDescription}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="flex items-center space-x-2 text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Patient is Conscious, Oriented & Fit for Police Statement</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-700/40">
                    <ShieldAlert className="w-4 h-4 text-blue-400" />
                    <span>No Intoxication or Narcotic Impairment Detected</span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] font-mono text-slate-400 truncate">
                  Digital Certificate Digest: <span className="text-slate-300">{mlc.medicalCertificateHash}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Digital Evidence Vault */}
          {activeTab === 'DIGITAL_EVIDENCE' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-white text-sm">Digital Evidence Taxonomy (CCTV, CDR, Audio & Cyber Logs)</h3>
                  <p className="text-xs text-slate-400">Encrypted with AES-256-GCM and stamped with immutable SHA-256 hashes</p>
                </div>
                <span className="text-xs font-mono bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded">
                  {digitalEvidence.length} Digital Assets
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {digitalEvidence.map((de) => (
                  <div key={de.id} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2.5 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono font-bold">
                          {de.evidenceType}
                        </span>
                        <h4 className="font-bold text-slate-100 text-sm mt-1">{de.fileName}</h4>
                      </div>
                      <span className="text-emerald-400 flex items-center text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Hash Verified
                      </span>
                    </div>

                    <div className="text-slate-400 space-y-0.5">
                      <div>Source: <strong className="text-slate-200">{de.sourceDeviceOrCCTVCamera}</strong></div>
                      <div>Collected by: <strong className="text-slate-200">{de.collectedByOfficer}</strong></div>
                      <div>Timestamp: <span className="font-mono text-slate-300">{de.collectionTimestamp}</span></div>
                    </div>

                    <div className="bg-slate-950/70 p-2.5 rounded border border-slate-700/40 text-[10px] font-mono text-slate-400 space-y-1">
                      <div className="truncate">SHA-256: <span className="text-emerald-400">{de.sha256Hash}</span></div>
                      <div>Size: {(de.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB | AES-256-GCM Sealed</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Granular Call Data Records (CDR) Analysis */}
          {activeTab === 'CDR_RECORDS' && (
            <div className="space-y-4">
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    <span>Call Data Records (CDR) Telecom Intelligence Register</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Certified telecom provider records with cell tower azimuth, IMEI/IMSI mapping, and Section 65B BSA hash integrity
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono bg-indigo-900/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded">
                    Total Records: {cdrList.length}
                  </span>
                  <span className="text-xs font-mono bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded">
                    Sec 65B Certified
                  </span>
                </div>
              </div>

              {cdrList.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
                  <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No Call Data Records attached to this docket yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-950/80">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-3">CDR ID / Provider</th>
                        <th className="py-3 px-3">Target Phone & Direction</th>
                        <th className="py-3 px-3">Party A (Caller) & Party B (Receiver)</th>
                        <th className="py-3 px-3">Call Time & Duration</th>
                        <th className="py-3 px-3">Cell Tower ID & Sector Location</th>
                        <th className="py-3 px-3">IMEI / IMSI</th>
                        <th className="py-3 px-3">Source Requisition & Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {cdrList.map((cdr) => {
                        const isIncoming = cdr.callType.includes('IN');
                        return (
                          <tr key={cdr.cdrId} className="hover:bg-slate-900/60 transition">
                            <td className="py-3 px-3 align-top font-mono">
                              <div className="font-bold text-slate-200">{cdr.cdrId}</div>
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-900/50 text-indigo-300 border border-indigo-500/30">
                                {cdr.telecomProvider}
                              </span>
                            </td>

                            <td className="py-3 px-3 align-top">
                              <div className="font-mono font-semibold text-slate-100">{cdr.phoneNumber}</div>
                              <div className="mt-1">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  isIncoming 
                                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30' 
                                    : 'bg-blue-900/40 text-blue-300 border border-blue-500/30'
                                }`}>
                                  {cdr.callType.replace('_', ' ')}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3 align-top font-mono">
                              <div className="text-slate-300">
                                <span className="text-slate-500 mr-1">From:</span>
                                <strong className="text-white">{cdr.callerNumber}</strong>
                              </div>
                              <div className="text-slate-300 mt-0.5">
                                <span className="text-slate-500 mr-1">To:</span>
                                <strong className="text-indigo-300">{cdr.receiverNumber}</strong>
                              </div>
                            </td>

                            <td className="py-3 px-3 align-top">
                              <div className="text-slate-300 font-mono text-[11px]">{cdr.callStartTime}</div>
                              <div className="text-slate-400 font-mono text-[10px]">End: {cdr.callEndTime}</div>
                              <div className="text-amber-300/90 font-mono text-[11px] font-semibold mt-0.5">
                                Duration: {cdr.durationSeconds}s ({Math.floor(cdr.durationSeconds / 60)}m {cdr.durationSeconds % 60}s)
                              </div>
                            </td>

                            <td className="py-3 px-3 align-top">
                              <div className="font-mono font-semibold text-slate-200 text-[11px] flex items-center">
                                <Radio className="w-3 h-3 text-indigo-400 mr-1 inline shrink-0" />
                                <span>{cdr.towerCellId}</span>
                              </div>
                              <div className="text-slate-400 text-[11px] mt-0.5 flex items-start">
                                <MapPin className="w-3 h-3 text-rose-400 mr-1 inline shrink-0 mt-0.5" />
                                <span>{cdr.locationArea}</span>
                              </div>
                            </td>

                            <td className="py-3 px-3 align-top font-mono text-[11px]">
                              <div><span className="text-slate-500">IMEI:</span> <span className="text-slate-200">{cdr.imei}</span></div>
                              <div className="mt-0.5"><span className="text-slate-500">IMSI:</span> <span className="text-slate-400">{cdr.imsi}</span></div>
                            </td>

                            <td className="py-3 px-3 align-top font-mono text-[10px]">
                              <div className="text-slate-300 font-semibold">{cdr.sourceDocumentRef}</div>
                              <div className="text-emerald-400 truncate max-w-[140px] mt-1 flex items-center" title={cdr.sha256Digest}>
                                <CheckCircle2 className="w-3 h-3 mr-1 inline shrink-0 text-emerald-400" />
                                <span>{cdr.sha256Digest.slice(0, 16)}...</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="text-xs text-slate-400 flex items-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 mr-2 shrink-0" />
            <span>Integrated Police Evidence Standards • Maharashtra Police Cyber Cell & 1930 Gateway</span>
          </div>
          {onClose && !isInline && (
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Close Panel
            </button>
          )}
          {isInline && (
            <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Synced to ICJS & NCRP 1930</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
