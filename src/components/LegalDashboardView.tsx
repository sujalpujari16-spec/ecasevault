import React, { useState } from 'react';
import { 
  Scale, 
  FileText, 
  Calendar, 
  Gavel, 
  ShieldCheck, 
  Plus, 
  Download, 
  Eye, 
  ChevronRight, 
  Check, 
  FileCheck,
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { CaseFile, UserSession, CourtDocumentRecord } from '../types';

interface LegalDashboardViewProps {
  cases: CaseFile[];
  session: UserSession;
  onOpenCaseDetails: (caseItem: CaseFile) => void;
  onOpenAddCourtDoc: (caseId?: string, initialMode?: 'HEARING' | 'STATEMENT' | 'ORDER') => void;
  onPreviewMedia?: (media: { isOpen: boolean; title: string; url: string; fileName?: string; hash?: string }) => void;
}

export const LegalDashboardView: React.FC<LegalDashboardViewProps> = ({
  cases,
  session,
  onOpenCaseDetails,
  onOpenAddCourtDoc,
  onPreviewMedia
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  // Collect all court records across accessible cases
  const allCourtRecords: Array<{ record: CourtDocumentRecord; caseItem: CaseFile }> = [];
  cases.forEach(caseItem => {
    (caseItem.courtRecords || []).forEach(record => {
      allCourtRecords.push({ record, caseItem });
    });
  });

  // Calculate Metrics
  const activeCasesCount = cases.filter(c => c.status === 'Legal Review' || c.status === 'Charge Sheet / Court Process').length;
  const totalOrdersCount = allCourtRecords.length;
  const warrantsCount = allCourtRecords.filter(r => r.record.documentType.includes('WARRANT')).length;
  const judgmentsCount = allCourtRecords.filter(r => r.record.documentType === 'FINAL_JUDGMENT').length;

  const filteredRecords = allCourtRecords.filter(({ record }) => {
    if (activeFilter === 'ALL') return true;
    return record.documentType === activeFilter;
  });

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner with prosecution Identity */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase bg-slate-100 text-slate-950 border border-slate-200">
              prosecution & Judicial Desk
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Directorate of Public prosecution & Sessions Courts
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Court Proceedings, Judicial Orders & prosecution Repository
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Vetting chargesheets, filing prosecution applications, entering court remand/bail orders, tracking warrants, and anchoring final judgments to the case docket.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenAddCourtDoc(undefined, 'HEARING')}
            className="px-3.5 py-2 bg-[#17406a] hover:bg-[#112d4a] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            <span>Record Court Hearing</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAddCourtDoc(undefined, 'STATEMENT')}
            className="px-3.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
          >
            <UserCheck className="w-4 h-4" />
            <span>Upload Statement (Sec 164)</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenAddCourtDoc(undefined, 'ORDER')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Court Order</span>
          </button>
        </div>
      </div>

      {/* Judicial Operational KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'prosecution Stage Cases', value: activeCasesCount, icon: Scale, color: 'text-slate-800', bg: 'bg-slate-50/60' },
          { label: 'Court Orders On Record', value: totalOrdersCount, icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50/60' },
          { label: 'Judicial Warrants Issued', value: warrantsCount, icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50/60' },
          { label: 'Final Judgments / Disposals', value: judgmentsCount, icon: Gavel, color: 'text-emerald-700', bg: 'bg-emerald-50/60' },
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

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'ALL', label: `All Judicial Filings (${allCourtRecords.length})` },
          { id: 'HEARING_RECORD', label: 'Court Hearings' },
          { id: 'WITNESS_STATEMENT', label: 'Witness Statements (164)' },
          { id: 'COURT_ORDER', label: 'Court Orders' },
          { id: 'FINAL_JUDGMENT', label: 'Judgments' },
          { id: 'BAIL_ORDER', label: 'Bail Orders' },
          { id: 'NON_BAILABLE_WARRANT', label: 'Warrants (NBW)' },
          { id: 'JUDICIAL_REMAND_ORDER', label: 'Remand Orders' },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeFilter === tab.id
                ? 'bg-[#17406a] text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Judicial Records Repository Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Court Orders & Judicial Filings Repository ({filteredRecords.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            Certified court orders and decrees linked to police dockets
          </span>
        </div>

        {filteredRecords.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredRecords.map(({ record, caseItem }) => (
              <div 
                key={record.id}
                className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 p-2 rounded-xl transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      {record.rcNumber || record.id}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px]">
                      {record.documentType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-slate-400 text-[11px]">•</span>
                    <span className="text-slate-600 font-medium text-[11px]">{record.courtName}</span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm">{record.title}</h3>
                  <p className="text-slate-600 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed max-w-3xl">
                    {record.orderSummary}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span>Judge: <strong className="text-slate-800">{record.judgeName}</strong></span>
                    <span>Prosecutor: <strong>{record.publicProsecutor}</strong></span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Order Date: <strong className="font-mono text-slate-800">{record.dateIssued}</strong>
                    </span>
                    {record.nextHearingDate && (
                      <span className="flex items-center gap-1 text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                        Next Hearing: {record.nextHearingDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Court Certified
                  </span>

                  <div className="flex items-center gap-2 pt-1">
                    {record.fileUrl && onPreviewMedia ? (
                      <button
                        type="button"
                        onClick={() => onPreviewMedia({
                          isOpen: true,
                          title: record.title,
                          url: record.fileUrl!,
                          fileName: record.fileName || `${record.documentType}.pdf`,
                          hash: record.documentHash
                        })}
                        className="px-3 py-1 bg-[#17406a] hover:bg-[#112d4a] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Order</span>
                      </button>
                    ) : null}

                    {record.fileUrl && (
                      <a
                        href={record.fileUrl}
                        download={record.fileName || 'court-order.pdf'}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenCaseDetails(caseItem)}
                      className="px-2.5 py-1 text-slate-800 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                    >
                      Case Docket →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Scale className="w-8 h-8 mx-auto opacity-30" />
            <p>No judicial documents found matching the selected filter.</p>
            <button
              type="button"
              onClick={() => onOpenAddCourtDoc()}
              className="px-3 py-1.5 bg-[#17406a] hover:bg-[#112d4a] text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 text-xs shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record First Court Document</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
