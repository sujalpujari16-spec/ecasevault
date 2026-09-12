import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Users, 
  FileText, 
  Calendar, 
  ShieldAlert, 
  Plus, 
  Eye, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Filter,
  RefreshCw,
  Search,
  FileCheck,
  UserCheck
} from 'lucide-react';
import { CaseFile, UserSession, PrisonerRecord, WarrantRecord } from '../types';
import { apiClient } from '../services/apiClient';

interface JailDashboardViewProps {
  cases: CaseFile[];
  session: UserSession;
  onOpenCaseDetails: (caseItem: CaseFile) => void;
  onUpdateCase?: (updatedCase: CaseFile, auditAction?: string, auditNotes?: string) => void;
}

export const JailDashboardView: React.FC<JailDashboardViewProps> = ({
  cases,
  session,
  onOpenCaseDetails,
  onUpdateCase
}) => {
  const [prisoners, setPrisoners] = useState<any[]>([]);
  const [warrants, setWarrants] = useState<any[]>([]);
  const [jailStats, setJailStats] = useState<any>({
    activeInmates: 0,
    judicialRemand: 0,
    policeRemand: 0,
    activeWarrants: 0,
    released: 0,
    facilityName: 'Arthur Road Central Prison, Mumbai'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal States
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [isCustodyEventModalOpen, setIsCustodyEventModalOpen] = useState(false);
  const [isWarrantModalOpen, setIsWarrantModalOpen] = useState(false);
  const [selectedPrisoner, setSelectedPrisoner] = useState<any>(null);

  // New Prisoner Form State
  const [admitForm, setAdmitForm] = useState({
    caseId: cases[0]?.id || '',
    prisonerNumber: `PR-${Math.floor(1000 + Math.random() * 9000)}`,
    prisonerName: '',
    custodyType: 'JUDICIAL_CUSTODY_REMAND',
    cellWard: 'Barrack 12 - Under-trial Ward',
    remandExpiryDate: new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 10),
    courtRemandOrderRef: 'REM-MM-4421/2026',
    warrantId: '',
    prisonName: 'Arthur Road Central Prison, Mumbai'
  });

  // Custody Event Form State
  const [custodyEventForm, setCustodyEventForm] = useState({
    eventType: 'COURT_HEARING',
    newStatus: 'IN_CUSTODY',
    notes: 'Escorted to Sessions Court for remand hearing under armed guard.',
    facilityLocation: 'Arthur Road Central Prison, Mumbai',
    bailOrderNumber: '',
    releaseRemarks: ''
  });

  // Warrant Form State
  const [warrantForm, setWarrantForm] = useState({
    caseId: cases[0]?.id || '',
    warrantNumber: `WR-MH-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    warrantType: 'REMAND_WARRANT',
    subjectName: '',
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 10),
    courtName: '10th Metropolitan Magistrate Court, Mumbai'
  });

  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const fetchJailData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, prisonersRes, warrantsRes] = await Promise.all([
        apiClient.getJailStats().catch(() => null),
        apiClient.getPrisoners().catch(() => null),
        apiClient.getWarrants().catch(() => null)
      ]);

      if (statsRes?.success && statsRes.stats) {
        setJailStats(statsRes.stats);
      }

      if (prisonersRes?.success && Array.isArray(prisonersRes.prisoners)) {
        setPrisoners(prisonersRes.prisoners);
      } else {
        // Fallback: collect from cases prop
        const collected: any[] = [];
        cases.forEach(c => {
          const recs = (c as any).prison_records || (c as any).prisonRecords || [];
          recs.forEach((r: any) => collected.push({ ...r, caseId: c.id, caseTitle: c.caseTitle }));
        });
        setPrisoners(collected);
      }

      if (warrantsRes?.success && Array.isArray(warrantsRes.warrants)) {
        setWarrants(warrantsRes.warrants);
      } else {
        const collectedW: any[] = [];
        cases.forEach(c => {
          const wList = (c as any).warrants || [];
          wList.forEach((w: any) => collectedW.push({ ...w, caseId: c.id, caseTitle: c.caseTitle }));
        });
        setWarrants(collectedW);
      }
    } catch (err) {
      console.warn('Operating with local jail state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJailData();
  }, [cases]);

  const showNotification = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleAdmitPrisoner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.admitPrisoner(admitForm);
      if (res?.success) {
        showNotification(`Inmate ${admitForm.prisonerName} admitted successfully.`);
        setIsAdmitModalOpen(false);
        fetchJailData();
        if (onUpdateCase) {
          const matched = cases.find(c => c.id === admitForm.caseId);
          if (matched) {
            onUpdateCase(matched, 'PRISONER_ADMITTED', `Inmate ${admitForm.prisonerName} (${admitForm.prisonerNumber}) admitted to prison.`);
          }
        }
      } else {
        showNotification(res?.error || 'Failed to admit prisoner');
      }
    } catch (err: any) {
      showNotification(err.message || 'Network error during admission');
    }
  };

  const handleCustodyEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrisoner) return;
    try {
      const payload: any = {
        prisonerId: selectedPrisoner.id,
        eventType: custodyEventForm.eventType,
        newStatus: custodyEventForm.newStatus,
        notes: custodyEventForm.notes,
        facilityLocation: custodyEventForm.facilityLocation
      };
      if (custodyEventForm.newStatus === 'RELEASED') {
        payload.releaseDetails = {
          releaseDate: new Date().toISOString().substring(0, 10),
          bailOrderNumber: custodyEventForm.bailOrderNumber || 'BAIL-ORD-2026',
          suretyDetails: 'Personal Bond & Two Local Sureties Verified',
          status: 'RELEASED',
          releaseRemarks: custodyEventForm.releaseRemarks || 'Released on court bail order.'
        };
      }
      const res = await apiClient.logCustodyEvent(payload);
      if (res?.success) {
        showNotification(`Custody event logged for ${selectedPrisoner.prisonerName}.`);
        setIsCustodyEventModalOpen(false);
        fetchJailData();
      } else {
        showNotification(res?.error || 'Failed to log custody event');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error updating custody');
    }
  };

  const handleIssueWarrant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.issueWarrant(warrantForm);
      if (res?.success) {
        showNotification(`Warrant ${warrantForm.warrantNumber} registered.`);
        setIsWarrantModalOpen(false);
        fetchJailData();
      } else {
        showNotification(res?.error || 'Failed to register warrant');
      }
    } catch (err: any) {
      showNotification(err.message || 'Error creating warrant');
    }
  };

  const filteredPrisoners = prisoners.filter(p => {
    const matchesSearch = 
      !searchQuery ||
      (p.prisonerName || p.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.prisonerNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.caseId || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'IN_CUSTODY' && p.custodyStatus === 'IN_CUSTODY') ||
      (statusFilter === 'JUDICIAL' && p.custodyType === 'JUDICIAL_CUSTODY_REMAND') ||
      (statusFilter === 'POLICE' && p.custodyType === 'POLICE_CUSTODY_REMAND') ||
      (statusFilter === 'RELEASED' && p.custodyStatus === 'RELEASED');

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 text-xs">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase bg-amber-100 text-amber-950 border border-amber-200">
              Jail & Correctional Administration
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {jailStats.facilityName}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Prison Custody, Judicial Remand & Warrant Oversight
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Centralized register for under-trial admissions, remand compliance, production warrants, custody transfers, and court-mandated bail releases.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsWarrantModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Record Warrant</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAdmitModalOpen(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Admit Prisoner</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notificationMsg}</span>
          </div>
          <button type="button" onClick={() => setNotificationMsg(null)} className="text-emerald-700 cursor-pointer">✕</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { label: 'Active Inmates in Facility', value: jailStats.activeInmates || prisoners.filter(p => p.custodyStatus === 'IN_CUSTODY').length, icon: Building2, color: 'text-amber-800', bg: 'bg-amber-50/60' },
          { label: 'Under Judicial Remand', value: jailStats.judicialRemand || prisoners.filter(p => p.custodyType === 'JUDICIAL_CUSTODY_REMAND').length, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50/60' },
          { label: 'Active Remand Warrants', value: jailStats.activeWarrants || warrants.filter(w => w.status === 'ACTIVE').length, icon: ShieldAlert, color: 'text-rose-700', bg: 'bg-rose-50/60' },
          { label: 'Discharged / Released on Bail', value: jailStats.released || prisoners.filter(p => p.custodyStatus === 'RELEASED').length, icon: UserCheck, color: 'text-emerald-700', bg: 'bg-emerald-50/60' },
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

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inmate name, prisoner ID, case ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-600 focus:bg-white transition"
            />
          </div>
          <button
            type="button"
            onClick={fetchJailData}
            title="Refresh Registry"
            className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-600' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Inmates' },
            { id: 'IN_CUSTODY', label: 'In Custody' },
            { id: 'JUDICIAL', label: 'Judicial Remand' },
            { id: 'POLICE', label: 'Police Remand' },
            { id: 'RELEASED', label: 'Released' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition ${
                statusFilter === f.id
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inmate Custody Roster */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-700" />
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Active Inmates & Remand Registry ({filteredPrisoners.length})
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Prison Section 29 Compliance
          </span>
        </div>

        {filteredPrisoners.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p className="font-medium text-xs">No inmates found matching filter criteria.</p>
            <p className="text-[10px] text-slate-400">Click "Admit Prisoner" to enter a remand admission.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400 bg-slate-50/50">
                  <th className="p-3">Prisoner ID & Name</th>
                  <th className="p-3">Linked Case</th>
                  <th className="p-3">Custody Type & Cell</th>
                  <th className="p-3">Admission Date</th>
                  <th className="p-3">Remand Expiry</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPrisoners.map((p, idx) => {
                  const linkedCase = cases.find(c => c.id === p.caseId);
                  const isReleased = p.custodyStatus === 'RELEASED';
                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-50/80 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{p.prisonerName || p.fullName}</div>
                        <div className="font-mono text-[10px] text-amber-800 font-bold">{p.prisonerNumber}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-slate-700 font-semibold">{p.caseId}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{p.caseTitle || linkedCase?.caseTitle || 'Case Docket'}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-semibold text-slate-700 block">{p.custodyType?.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-slate-400">{p.cellWard || 'Ward Unassigned'}</span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{p.admissionDate || '2026-09-05'}</td>
                      <td className="p-3">
                        <div className="font-mono text-slate-800 font-semibold">{p.remandExpiryDate || 'Under Trial'}</div>
                        {p.courtRemandOrderRef && (
                          <div className="text-[9px] text-slate-400 font-mono">{p.courtRemandOrderRef}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isReleased
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}>
                          {p.custodyStatus?.replace(/_/g, ' ') || 'IN CUSTODY'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPrisoner(p);
                              setIsCustodyEventModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] rounded-lg cursor-pointer transition"
                          >
                            Update Custody
                          </button>
                          {linkedCase && (
                            <button
                              type="button"
                              onClick={() => onOpenCaseDetails(linkedCase)}
                              title="Inspect Case (Need-To-Know View)"
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg cursor-pointer transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Warrants List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-700" />
            <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wide">
              Active Production & Remand Warrants ({warrants.length})
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Judicial Compliance Queue
          </span>
        </div>

        {warrants.length === 0 ? (
          <div className="p-6 text-center text-slate-400">
            No active warrants recorded for this facility.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {warrants.map((w, idx) => (
              <div key={w.id || idx} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-blue-900">{w.warrantNumber}</span>
                    <span className="px-2 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {w.warrantType?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-slate-800 font-semibold">Subject: {w.subjectName}</div>
                  <div className="text-[10px] text-slate-500">Issued By: {w.issuedBy} • {w.courtName}</div>
                </div>

                <div className="text-right space-y-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {w.status || 'ACTIVE'}
                  </span>
                  <div className="text-[10px] text-slate-400 font-mono">Valid Until: {w.validUntil || 'Pending Return'}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= MODAL: ADMIT PRISONER ================= */}
      {isAdmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-700" />
                <span>Admit Prisoner into Prison Facility</span>
              </h3>
              <button type="button" onClick={() => setIsAdmitModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAdmitPrisoner} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Associated Case Docket *</label>
                <select
                  value={admitForm.caseId}
                  onChange={(e) => setAdmitForm({ ...admitForm, caseId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50 outline-none focus:border-amber-600 focus:bg-white"
                  required
                >
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.caseTitle} ({c.policeStation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Prisoner Number *</label>
                  <input
                    type="text"
                    value={admitForm.prisonerNumber}
                    onChange={(e) => setAdmitForm({ ...admitForm, prisonerNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name of Inmate *</label>
                  <input
                    type="text"
                    value={admitForm.prisonerName}
                    onChange={(e) => setAdmitForm({ ...admitForm, prisonerName: e.target.value })}
                    placeholder="e.g. Ramesh Kumar Verma"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Custody Type</label>
                  <select
                    value={admitForm.custodyType}
                    onChange={(e) => setAdmitForm({ ...admitForm, custodyType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="JUDICIAL_CUSTODY_REMAND">Judicial Custody Remand (Jail)</option>
                    <option value="POLICE_CUSTODY_REMAND">Police Custody Remand (Transit)</option>
                    <option value="CONVICTED_PRISONER">Convicted Prisoner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Assigned Cell / Barrack</label>
                  <input
                    type="text"
                    value={admitForm.cellWard}
                    onChange={(e) => setAdmitForm({ ...admitForm, cellWard: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Remand Expiry Date</label>
                  <input
                    type="date"
                    value={admitForm.remandExpiryDate}
                    onChange={(e) => setAdmitForm({ ...admitForm, remandExpiryDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Court Remand Order Ref</label>
                  <input
                    type="text"
                    value={admitForm.courtRemandOrderRef}
                    onChange={(e) => setAdmitForm({ ...admitForm, courtRemandOrderRef: e.target.value })}
                    placeholder="e.g. REM-MM-1029/2026"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdmitModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Complete Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: CUSTODY STATUS UPDATE ================= */}
      {isCustodyEventModalOpen && selectedPrisoner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Custody Status</h3>
                <p className="text-[10px] text-slate-500 font-mono">Inmate: {selectedPrisoner.prisonerName} ({selectedPrisoner.prisonerNumber})</p>
              </div>
              <button type="button" onClick={() => setIsCustodyEventModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCustodyEvent} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Custody Event Type *</label>
                <select
                  value={custodyEventForm.eventType}
                  onChange={(e) => setCustodyEventForm({ ...custodyEventForm, eventType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50"
                  required
                >
                  <option value="COURT_HEARING">Court Hearing Appearance Escort</option>
                  <option value="REMAND_EXTENSION">Remand Extension Order Granted</option>
                  <option value="MEDICAL_CHECKUP">JJ Hospital / Medical Ward Transfer</option>
                  <option value="JAIL_TRANSFER">Inter-Prison Transfer (e.g. Taloja Central Jail)</option>
                  <option value="BAIL_RELEASE">Statutory Court Bail Release</option>
                  <option value="PAROLE">Temporary Parole Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">New Custodial Status</label>
                <select
                  value={custodyEventForm.newStatus}
                  onChange={(e) => setCustodyEventForm({ ...custodyEventForm, newStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                >
                  <option value="IN_CUSTODY">IN_CUSTODY (Inside Facility)</option>
                  <option value="TRANSFERRED">TRANSFERRED (Court/Hospital/Other Prison)</option>
                  <option value="RELEASED">RELEASED (Discharged on Bail/Acquittal)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Event Notes & Officer Remarks *</label>
                <textarea
                  value={custodyEventForm.notes}
                  onChange={(e) => setCustodyEventForm({ ...custodyEventForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>

              {custodyEventForm.newStatus === 'RELEASED' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-900 text-[11px]">Bail Discharge Compliance</div>
                  <input
                    type="text"
                    value={custodyEventForm.bailOrderNumber}
                    onChange={(e) => setCustodyEventForm({ ...custodyEventForm, bailOrderNumber: e.target.value })}
                    placeholder="Bail Order Number (e.g. BAIL-CR-2026-990)"
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    value={custodyEventForm.releaseRemarks}
                    onChange={(e) => setCustodyEventForm({ ...custodyEventForm, releaseRemarks: e.target.value })}
                    placeholder="Surety verification remarks"
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustodyEventModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Save Custody Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: RECORD WARRANT ================= */}
      {isWarrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Record Warrant in Prison Register</h3>
              <button type="button" onClick={() => setIsWarrantModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleIssueWarrant} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Associated Case *</label>
                <select
                  value={warrantForm.caseId}
                  onChange={(e) => setWarrantForm({ ...warrantForm, caseId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-slate-50"
                  required
                >
                  {cases.map(c => (
                    <option key={c.id} value={c.id}>{c.id} — {c.caseTitle}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Warrant Number *</label>
                <input
                  type="text"
                  value={warrantForm.warrantNumber}
                  onChange={(e) => setWarrantForm({ ...warrantForm, warrantNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Warrant Type</label>
                  <select
                    value={warrantForm.warrantType}
                    onChange={(e) => setWarrantForm({ ...warrantForm, warrantType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  >
                    <option value="REMAND_WARRANT">Remand Warrant (Judicial)</option>
                    <option value="PRODUCTION_WARRANT">Production Warrant (Court)</option>
                    <option value="NBW">Non-Bailable Warrant (NBW)</option>
                    <option value="BAILABLE_WARRANT">Bailable Warrant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    value={warrantForm.subjectName}
                    onChange={(e) => setWarrantForm({ ...warrantForm, subjectName: e.target.value })}
                    placeholder="Name of Accused"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Issuing Court *</label>
                <input
                  type="text"
                  value={warrantForm.courtName}
                  onChange={(e) => setWarrantForm({ ...warrantForm, courtName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWarrantModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Save Warrant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
