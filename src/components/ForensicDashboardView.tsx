import React, { useState } from 'react';
import { 
  Microscope, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Dna, 
  Fingerprint, 
  HardDrive, 
  Flame, 
  FlaskConical, 
  Plus, 
  ShieldCheck, 
  ChevronRight, 
  Download, 
  Eye, 
  AlertCircle,
  FileCheck,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import { CaseFile, UserSession, ForensicRequest, EvidenceItemRecord } from '../types';
import { soundEffects } from './AudioEffects';

interface ForensicDashboardViewProps {
  cases: CaseFile[];
  session: UserSession;
  onOpenCaseDetails: (caseItem: CaseFile) => void;
  onOpenUploadReport: (caseId?: string, evidenceId?: string) => void;
  onUpdateCase: (updatedCase: CaseFile, action: string, notes: string) => void;
  onPreviewMedia?: (media: { isOpen: boolean; title: string; url: string; fileName?: string; hash?: string }) => void;
}

export const ForensicDashboardView: React.FC<ForensicDashboardViewProps> = ({
  cases,
  session,
  onOpenCaseDetails,
  onOpenUploadReport,
  onUpdateCase,
  onPreviewMedia
}) => {
  const [activeDiscipline, setActiveDiscipline] = useState<'ALL' | 'DNA' | 'CYBER' | 'FINGERPRINT' | 'BALLISTICS' | 'TOXICOLOGY'>('ALL');
  const [previewMediaModal, setPreviewMediaModal] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    fileName?: string;
    hash?: string;
  } | null>(null);

  // Aggregate all forensic requests across all accessible cases
  const allForensicRequests: Array<{ request: ForensicRequest; caseItem: CaseFile; evidence?: EvidenceItemRecord }> = [];
  cases.forEach(caseItem => {
    (caseItem.forensicRequests || []).forEach(req => {
      const ev = (caseItem.evidenceItems || []).find(e => e.id === req.evidenceId || e.evidenceTag === req.evidenceTag);
      allForensicRequests.push({
        request: req,
        caseItem,
        evidence: ev
      });
    });
  });

  // Aggregate all completed forensic documents
  const allForensicReports: Array<{ doc: any; caseItem: CaseFile }> = [];
  cases.forEach(caseItem => {
    (caseItem.documents || []).forEach(doc => {
      if (doc.type === 'FORENSIC_REPORT' || (doc.department as string) === 'FORENSIC_FSL' || (doc.department as string) === 'FORENSIC' || doc.tags?.includes('FORENSIC_REPORT')) {
        allForensicReports.push({ doc, caseItem });
      }
    });
  });

  // Calculate Metrics
  const pendingRequestsCount = allForensicRequests.filter(r => r.request.status === 'Request Created').length;
  const receivedEvidenceCount = allForensicRequests.filter(r => r.request.status === 'Evidence Received').length;
  const underExamCount = allForensicRequests.filter(r => r.request.status === 'Under Examination').length;
  const completedReportsCount = allForensicReports.length;

  const handleUpdateStatus = (caseItem: CaseFile, requestId: string, newStatus: any) => {
    soundEffects.playStamp();
    const updatedRequests = (caseItem.forensicRequests || []).map(r => 
      r.id === requestId ? { ...r, status: newStatus } : r
    );

    const updatedCase: CaseFile = {
      ...caseItem,
      status: newStatus === 'Under Examination' ? 'Forensic Examination' : caseItem.status,
      forensicRequests: updatedRequests,
      timeline: [
        {
          id: `TL-FSL-STAT-${Date.now()}`,
          date: new Date().toISOString().substring(0, 10),
          title: `FSL Status Updated: ${newStatus}`,
          description: `Forensic examination request ${requestId} transitioned to '${newStatus}' by ${session.officerName}.`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'FORENSIC'
        },
        ...(caseItem.timeline || [])
      ]
    };

    onUpdateCase(updatedCase, 'FORENSIC_STATUS_UPDATE', `FSL request status updated to ${newStatus}`);
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner with FSL Identity & Quick Action */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase bg-slate-100 text-slate-900 border border-slate-200">
              Forensic Science Laboratory (FSL)
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Kalina Central Directorate & Regional Laboratories
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Forensic Examination, Scientific Analysis & FSL Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Receive seized physical/digital artifacts, conduct scientific examinations, track analysis lifecycles, and submit cryptographically sealed reports under Section 293 CrPC.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenUploadReport()}
            className="px-4 py-2.5 bg-[#17406a] hover:bg-[#112d4a] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Submit Forensic Report</span>
          </button>
        </div>
      </div>

      {/* Forensic KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Pending Lab Requests', value: pendingRequestsCount, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50/60' },
          { label: 'Evidence Received in Lab', value: receivedEvidenceCount, icon: Microscope, color: 'text-blue-700', bg: 'bg-blue-50/60' },
          { label: 'Under Active Examination', value: underExamCount, icon: FlaskConical, color: 'text-slate-700', bg: 'bg-slate-50/60' },
          { label: 'Completed FSL Reports', value: completedReportsCount, icon: ShieldCheck, color: 'text-emerald-700', bg: 'bg-emerald-50/60' },
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

      {/* Forensic Examination Lifecycle Stepper */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
          Scientific Examination Lifecycle Protocol (CrPC 293 / BNSS 329)
        </span>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {[
            { step: '1. REQUESTED', desc: 'Investigating Officer dispatches evidence' },
            { step: '2. RECEIVED', desc: 'FSL Malkhana verifies seal & logs entry' },
            { step: '3. UNDER EXAM', desc: 'Scientific analysis & bench procedures' },
            { step: '4. REPORT READY', desc: 'Examiner findings & report draft' },
            { step: '5. SIGNED & ANCHORED', desc: 'Ed25519 PKI signature & SHA-256 seal' }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="font-bold text-slate-900 block">{item.step}</span>
                <span className="text-[10px] text-slate-600 block">{item.desc}</span>
              </div>
              {idx < 4 && <ChevronRight className="w-4 h-4 text-slate-300 hidden md:block" />}
            </div>
          ))}
        </div>
      </div>

      {/* Forensic Examination Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Microscope className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Forensic Lab Examination Queue ({allForensicRequests.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            Showing all evidence dockets referred for scientific examination
          </span>
        </div>

        {allForensicRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-2.5">Case / FIR</th>
                  <th className="pb-2.5">Evidence Tag</th>
                  <th className="pb-2.5">Requested Examination</th>
                  <th className="pb-2.5">Lab Facility</th>
                  <th className="pb-2.5">Current Status</th>
                  <th className="pb-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allForensicRequests.map(({ request, caseItem, evidence }) => (
                  <tr key={request.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 font-semibold text-slate-900">
                      <div 
                        onClick={() => onOpenCaseDetails(caseItem)}
                        className="cursor-pointer hover:text-slate-700"
                      >
                        <span className="font-mono text-blue-800 font-bold block">{caseItem.firNumber}</span>
                        <span className="text-[11px] text-slate-500 line-clamp-1">{caseItem.caseTitle}</span>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-slate-700">
                      <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200 font-bold">
                        {request.evidenceTag}
                      </span>
                      {evidence && (
                        <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">
                          {evidence.category}
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-medium text-slate-900">
                      <div>{request.requestedExam}</div>
                      {request.requisitionLetterName && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span 
                            title={request.requisitionLetterName}
                            className="text-[10px] text-purple-900 bg-purple-100/80 px-2 py-0.5 rounded border border-purple-300 font-semibold flex items-center gap-1 max-w-[210px] truncate"
                          >
                            <FileText className="w-3 h-3 text-purple-700 shrink-0" />
                            <span className="truncate">
                              {request.requisitionLetterName.length > 25
                                ? request.requisitionLetterName.slice(0, 14) + "..." + request.requisitionLetterName.slice(-8)
                                : request.requisitionLetterName}
                            </span>
                          </span>
                          {request.requisitionLetterUrl && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  if (onPreviewMedia) {
                                    onPreviewMedia({
                                      isOpen: true,
                                      title: `Police Requisition Letter - ${request.evidenceTag}`,
                                      url: request.requisitionLetterUrl!,
                                      fileName: request.requisitionLetterName,
                                      hash: request.requisitionLetterHash
                                    });
                                  }
                                  setPreviewMediaModal({
                                    isOpen: true,
                                    title: `Police Requisition Letter - ${request.evidenceTag}`,
                                    url: request.requisitionLetterUrl!,
                                    fileName: request.requisitionLetterName,
                                    hash: request.requisitionLetterHash
                                  });
                                }}
                                className="px-2 py-0.5 bg-purple-700 hover:bg-purple-800 text-white rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View Letter</span>
                              </button>
                              <a
                                href={request.requisitionLetterUrl}
                                download={request.requisitionLetterName || "Police_FSL_Requisition.pdf"}
                                className="px-1.5 py-0.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-slate-500 text-[11px]">
                      {request.labName}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        request.status === 'Report Ready' || request.status === 'Report Reviewed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : request.status === 'Under Examination'
                          ? 'bg-slate-100 text-slate-800'
                          : request.status === 'Evidence Received'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                      {request.status === 'Request Created' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(caseItem, request.id, 'Evidence Received')}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-blue-200"
                        >
                          Accept Sample
                        </button>
                      )}
                      {request.status === 'Evidence Received' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(caseItem, request.id, 'Under Examination')}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-lg text-xs font-bold transition-colors cursor-pointer border border-slate-200"
                        >
                          Begin Exam
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenUploadReport(caseItem.id, request.evidenceId)}
                        className="px-2.5 py-1 bg-[#17406a] hover:bg-[#112d4a] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                      >
                        Submit FSL Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Microscope className="w-8 h-8 mx-auto opacity-30" />
            <p>No pending forensic requests in active dockets.</p>
            <button
              type="button"
              onClick={() => onOpenUploadReport()}
              className="px-3 py-1.5 bg-[#17406a] hover:bg-[#112d4a] text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 text-xs shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Submit Direct FSL Report</span>
            </button>
          </div>
        )}
      </div>

      {/* Completed FSL Scientific Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Completed & Digitally Sealed Forensic Reports ({allForensicReports.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            Admissible scientific expert testimony under Sec 293 CrPC
          </span>
        </div>

        {allForensicReports.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {allForensicReports.map(({ doc, caseItem }) => (
              <div 
                key={doc.id}
                className="p-4 rounded-xl border border-slate-200/80 bg-gradient-to-r from-slate-50/50 via-slate-50 to-blue-50/30 space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {doc.docNumber || doc.id}
                    </span>
                    <h3 className="font-bold text-slate-900 text-xs mt-1 line-clamp-1">{doc.title}</h3>
                    <p className="text-[11px] text-slate-500">Case: {caseItem.firNumber} — {caseItem.caseTitle.slice(0, 30)}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Sealed & Signed
                  </span>
                </div>

                <p className="text-slate-600 text-[11px] bg-white/80 p-2.5 rounded-lg border border-slate-200/70 leading-relaxed">
                  {doc.summary || doc.contentBody?.slice(0, 140)}
                </p>

                <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                  <span>Signer: <strong>{doc.authorName}</strong> ({doc.authorRank || 'FSL Scientist'})</span>
                  <span className="font-mono">{doc.createdDate}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  {doc.fileUrl && onPreviewMedia ? (
                    <button
                      type="button"
                      onClick={() => onPreviewMedia({
                        isOpen: true,
                        title: doc.title,
                        url: doc.fileUrl,
                        fileName: doc.fileName || `${doc.title}.pdf`,
                        hash: doc.sha256Hash
                      })}
                      className="px-3 py-1 bg-[#17406a] hover:bg-[#112d4a] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Report</span>
                    </button>
                  ) : null}
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      download={doc.fileName || 'forensic-report.pdf'}
                      className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenCaseDetails(caseItem)}
                    className="px-3 py-1 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold ml-auto cursor-pointer flex items-center gap-0.5"
                  >
                    <span>View Docket</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            No completed scientific reports recorded yet. Submit your first FSL examination finding above.
          </div>
        )}
      </div>
      {/* Modal: View Uploaded Document by Police (Requisition Letter / Evidence Doc) */}
      {previewMediaModal && previewMediaModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-700" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewMediaModal.title}</h3>
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                    {previewMediaModal.fileName} {previewMediaModal.hash ? `• SHA-256: ${previewMediaModal.hash.slice(0, 16)}...` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewMediaModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Fullscreen</span>
                </a>
                <a
                  href={previewMediaModal.url}
                  download={previewMediaModal.fileName || "police_requisition.pdf"}
                  className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewMediaModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 bg-slate-100/60 overflow-y-auto flex items-center justify-center min-h-[480px]">
              {previewMediaModal.url.startsWith("data:image/") || previewMediaModal.fileName?.match(/\.(png|jpg|jpeg|webp)$/i) ? (
                <img
                  src={previewMediaModal.url}
                  alt={previewMediaModal.title}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md border border-slate-200"
                />
              ) : (
                <iframe
                  src={previewMediaModal.url}
                  title={previewMediaModal.title}
                  className="w-full h-[65vh] rounded-lg border border-slate-200 bg-white shadow-xs"
                />
              )}
            </div>

            <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Section 293 Cr.P.C. / Sec 329 BNSS Statutory Forwarding Requisition</span>
              <button
                type="button"
                onClick={() => setPreviewMediaModal(null)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
