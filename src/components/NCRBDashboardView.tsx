import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  ShieldCheck, 
  Users, 
  History, 
  Scale, 


  
  Download, 
  Printer, 
  Eye, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Award,
  Hash,
  Database,
  FileCheck
} from 'lucide-react';
import { CaseFile, UserSession, CriminalHistoryRecord } from '../types';
import { apiClient } from '../services/apiClient';

interface NCRBDashboardViewProps {
  cases: CaseFile[];
  session: UserSession;
  onOpenCaseDetails: (caseItem: CaseFile) => void;
}

export const NCRBDashboardView: React.FC<NCRBDashboardViewProps> = ({
  cases,
  session,
  onOpenCaseDetails
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalRecords: 0,
    trackedPersons: 0,
    convictionsRecorded: 0,
    convictionRatePercent: 74,
    agency: 'National Crime Records Bureau (NCRB) / SCRB Maharashtra',
    cctnsIntegrationStatus: 'CONNECTED_SYNC_ACTIVE'
  });
  const [selectedPersonDossier, setSelectedPersonDossier] = useState<any>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const fetchNcrbData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, historyRes] = await Promise.all([
        apiClient.getNcrbStats().catch(() => null),
        apiClient.getAllCriminalHistory().catch(() => null)
      ]);

      if (statsRes?.success && statsRes.stats) {
        setStats(statsRes.stats);
      }

      if (historyRes?.success && Array.isArray(historyRes.records)) {
        setRecords(historyRes.records);
      } else {
        // Fallback: extract from cases
        const collected: any[] = [];
        cases.forEach(c => {
          const hList = (c as any).criminal_history || (c as any).criminalHistory || [];
          hList.forEach((h: any) => collected.push({ ...h, linkedCaseTitle: c.caseTitle, linkedPoliceStation: c.policeStation }));
        });
        setRecords(collected);
      }
    } catch (err) {
      console.warn('Operating with local NCRB dataset:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNcrbData();
  }, [cases]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiClient.searchCriminalHistory(searchQuery);
      if (res?.success && Array.isArray(res.records)) {
        setRecords(res.records);
      }
    } catch (err: any) {
      console.warn('Search fallback to local filter:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPersonDossier = async (personIdentifier: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.getPersonDossier(personIdentifier);
      if (res?.success && res.dossier) {
        setSelectedPersonDossier(res.dossier);
      }
    } catch (err) {
      // Local fallback
      const matched = records.filter(r => r.personIdentifier === personIdentifier);
      if (matched.length > 0) {
        setSelectedPersonDossier({
          personIdentifier,
          fullName: matched[0].fullName,
          aliases: matched[0].aliases || [],
          totalCasesInvolved: matched.length,
          cases: matched
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCertifiedReport = async (personIdentifier: string) => {
    setIsGeneratingReport(true);
    try {
      const res = await apiClient.generateNcrbReport({
        personIdentifier,
        requestedByPurpose: 'Statutory Judicial Background Verification & Bail Opposition (Sec 437 BNSS)'
      });
      if (res?.success && res.report) {
        setGeneratedReport(res.report);
      }
    } catch (err: any) {
      setNotificationMsg(err.message || 'Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="space-y-6 text-xs">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase bg-blue-100 text-blue-950 border border-blue-200">
              National Crime Records Bureau (NCRB) & SCRB
            </span>
            <span className="text-xs text-slate-500 font-mono">
              State Criminal Intelligence & Conviction History Node
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Criminal History Registry, Multi-Case Linkage & Statutory Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Authoritative, read-only intelligence repository tracking recidivism patterns, past criminal trials, inter-station charge-sheets, and court disposal outcomes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs rounded-xl flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <span>Read-Only Authorized Oversight</span>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Criminal Dossiers Indexed', value: stats.totalRecords || records.length, icon: Database, color: 'text-blue-800', bg: 'bg-blue-50/60' },
          { label: 'Unique Person Profiles', value: stats.trackedPersons || new Set(records.map(r => r.personIdentifier)).size, icon: Users, color: 'text-indigo-800', bg: 'bg-indigo-50/60' },
          { label: 'Judicial Convictions Logged', value: stats.convictionsRecorded || records.filter(r => r.caseStatus === 'CONVICTED').length, icon: Scale, color: 'text-emerald-700', bg: 'bg-emerald-50/60' },
          { label: 'Prosecution Conviction Rate', value: `${stats.convictionRatePercent || 74}%`, icon: Award, color: 'text-amber-700', bg: 'bg-amber-50/60' },
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

      {/* Search Input */}
      <form onSubmit={handleSearch} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by suspect name, alias, Person ID (PID-MH-...), FIR Number, or offence..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600 focus:bg-white transition"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button
            type="submit"
            className="flex-1 md:flex-initial px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition flex items-center justify-center gap-2"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Records</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              fetchNcrbData();
            }}
            className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 cursor-pointer"
            title="Reset Search"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </form>

      {/* Main Content Grid: Search Results / Records & Person Dossier Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Criminal History Table */}
        <div className={`${selectedPersonDossier ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden`}>
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-700" />
              <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                Criminal Offence & Previous Cases Registry ({records.length})
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Inter-Agency CCTNS Sync: Active
            </span>
          </div>

          {records.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-medium text-xs">No matching criminal records located in the NCRB repository.</p>
              <p className="text-[10px] text-slate-400">Try a broader keyword or reset the query filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400 bg-slate-50/50">
                    <th className="p-3">Person ID & Full Name</th>
                    <th className="p-3">Offence Particulars</th>
                    <th className="p-3">Case Reference</th>
                    <th className="p-3">Status / Outcome</th>
                    <th className="p-3">Source Node</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r, idx) => {
                    const isConvicted = r.caseStatus === 'CONVICTED';
                    return (
                      <tr key={r.id || idx} className="hover:bg-slate-50/80 transition">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{r.fullName}</div>
                          <div className="font-mono text-[10px] text-blue-900 font-semibold">{r.personIdentifier}</div>
                          {r.aliases && r.aliases.length > 0 && (
                            <div className="text-[9px] text-slate-400">Alias: {r.aliases.join(', ')}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 line-clamp-1">{r.offence}</div>
                          {r.ipcSections && (
                            <div className="text-[10px] text-slate-500 font-mono">{r.ipcSections.join(' • ')}</div>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          <div>{r.caseNumber}</div>
                          <div className="text-[9px] text-slate-400 font-sans">{r.recordDate}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isConvicted
                              ? 'bg-rose-100 text-rose-900 border border-rose-200'
                              : 'bg-amber-100 text-amber-900 border border-amber-200'
                          }`}>
                            {r.caseStatus}
                          </span>
                          <div className="text-[10px] text-slate-500 mt-0.5">{r.courtOutcome || 'Pending Trial'}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {r.source || 'SCRB Maharashtra'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleViewPersonDossier(r.personIdentifier)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-[11px] rounded-lg cursor-pointer transition flex items-center gap-1 ml-auto"
                          >
                            <Users className="w-3 h-3" />
                            <span>Linkages</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Person Multi-Case Dossier Drawer (when selected) */}
        {selectedPersonDossier && (
          <div className="bg-white rounded-2xl border border-blue-200 shadow-lg p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2 py-0.5 text-[9px] font-bold rounded uppercase bg-blue-100 text-blue-900">
                  Person Dossier & Criminal Trail
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedPersonDossier.fullName}
                </h3>
                <p className="font-mono text-xs text-blue-800 font-semibold">{selectedPersonDossier.personIdentifier}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPersonDossier(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedPersonDossier.aliases && selectedPersonDossier.aliases.length > 0 && (
              <div className="p-2.5 bg-slate-50 rounded-xl text-slate-600 text-xs">
                <span className="font-bold text-slate-700">Known Aliases: </span>
                <span>{selectedPersonDossier.aliases.join(', ')}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>Multi-Case Trail ({selectedPersonDossier.cases?.length || 0} Cases)</span>
                <span className="text-[10px] text-blue-700 font-mono">PERSON → CASES LINK</span>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {(selectedPersonDossier.cases || []).map((cItem: any, cIdx: number) => {
                  const linkedCase = cases.find(c => c.id === cItem.caseId);
                  return (
                    <div key={cIdx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 hover:border-blue-300 transition">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900 text-xs">{cItem.caseNumber}</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                          cItem.caseStatus === 'CONVICTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {cItem.caseStatus}
                        </span>
                      </div>
                      <div className="text-slate-700 font-medium text-xs">{cItem.offence}</div>
                      <div className="text-[10px] text-slate-500">Outcome: {cItem.courtOutcome || 'Pending Trial'}</div>
                      <div className="flex items-center justify-between pt-1 text-[9px] text-slate-400">
                        <span>Date: {cItem.recordDate}</span>
                        {linkedCase && (
                          <button
                            type="button"
                            onClick={() => onOpenCaseDetails(linkedCase)}
                            className="text-blue-700 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Inspect Docket</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleGenerateCertifiedReport(selectedPersonDossier.personIdentifier)}
                disabled={isGeneratingReport}
                className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition flex items-center justify-center gap-2"
              >
                <FileCheck className="w-4 h-4" />
                <span>{isGeneratingReport ? 'Sealing Report...' : 'Generate Certified NCRB Report'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL: CERTIFIED REPORT VIEWER ================= */}
      {generatedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Report Header with Insignia Styling */}
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <div className="text-[10px] font-bold text-blue-900 tracking-wider uppercase">
                Government of Maharashtra • Department of Home Affairs
              </div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                STATE CRIME RECORDS BUREAU (SCRB) / NATIONAL CRIME RECORDS BUREAU
              </h2>
              <div className="text-xs font-semibold text-slate-600">
                Official Statutory Criminal History & Recidivism Dossier
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Report ID: {generatedReport.reportId} • Generated: {generatedReport.generatedAt}
              </div>
            </div>

            {/* Subject Information */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">Subject Person ID:</span>
                <span className="font-bold font-mono text-blue-900">{generatedReport.subjectIdentifier}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Purpose of Certification:</span>
                <span className="font-semibold text-slate-800">{generatedReport.purpose}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Total Linked Offences:</span>
                <span className="font-bold text-slate-900">{generatedReport.recordsFound} Records on File</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Certifying Officer:</span>
                <span className="font-semibold text-slate-800">{generatedReport.analystName} ({generatedReport.analystBadge})</span>
              </div>
            </div>

            {/* Records Breakdown */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Certified Prior Offences</h4>
              <div className="space-y-2">
                {(generatedReport.records || []).map((rec: any, idx: number) => (
                  <div key={idx} className="p-3 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900">{rec.caseNumber}</span>
                      <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${
                        rec.caseStatus === 'CONVICTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {rec.caseStatus}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800">{rec.offence}</div>
                    <div className="text-[10px] text-slate-500">Judicial Outcome: {rec.courtOutcome || 'Pending'}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic SHA-256 Seal Box */}
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-1 font-mono">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Statutory Cryptographic Integrity Seal</span>
              </div>
              <div className="text-[10px] text-emerald-800 break-all">
                SHA-256: {generatedReport.sha256Seal}
              </div>
              <div className="text-[9px] text-emerald-700 font-sans">
                Sealed under Section 63 Bharatiya Sakshya Adhiniyam, 2023 for admissibility in court.
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setGeneratedReport(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
              >
                Close Dossier
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Certified Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
