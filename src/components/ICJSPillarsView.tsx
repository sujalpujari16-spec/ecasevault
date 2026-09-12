import React, { useState } from 'react';
import { 
  Shield, 
  Scale, 
  Microscope, 
  Building2, 
  Database, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Clock, 
  KeyRound, 
  ArrowRight,
  ExternalLink,
  UserCheck,
  Languages,
  BadgeAlert,
  ChevronRight,
  Lock,
  Phone
} from 'lucide-react';
import { 
  CaseFile, 
  ICJSPillar, 
  CourtDocumentRecord, 
  PrisonerRecord, 
  NCRBCriminalDossier, 
  UserSession 
} from '../types';
import { DEFAULT_SAMPLE_CASES } from '../utils/caseMapper';
import { CCTNSFormsModal } from './CCTNSFormsModal';
import { SpecialInvestigationPanel } from './SpecialInvestigationPanel';

interface ICJSPillarsViewProps {
  cases: CaseFile[];
  session: UserSession;
  onOpenCaseDetails: (caseItem: CaseFile) => void;
}

export const ICJSPillarsView: React.FC<ICJSPillarsViewProps> = ({
  cases,
  session,
  onOpenCaseDetails,
}) => {
  const [selectedPillar, setSelectedPillar] = useState<ICJSPillar>('POLICE_CCTNS');
  
  const effectiveCases = (cases && cases.length > 0) ? cases : DEFAULT_SAMPLE_CASES;
  const [selectedCaseId, setSelectedCaseId] = useState<string>(effectiveCases[0]?.id || DEFAULT_SAMPLE_CASES[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<'ALL' | 'EN' | 'MR' | 'HI' | 'GU'>('ALL');

  // Modals
  const [activeCCTNSCase, setActiveCCTNSCase] = useState<CaseFile | null>(null);
  const [activeSpecialCase, setActiveSpecialCase] = useState<CaseFile | null>(null);

  const selectedCase: CaseFile = effectiveCases.find(c => c.id === selectedCaseId) || effectiveCases[0] || DEFAULT_SAMPLE_CASES[0];

  const courtRecords: CourtDocumentRecord[] = (selectedCase?.courtRecords && selectedCase.courtRecords.length > 0)
    ? selectedCase.courtRecords
    : (DEFAULT_SAMPLE_CASES[0].courtRecords || []);
  const prisonRecords: PrisonerRecord[] = (selectedCase?.prisonRecords && selectedCase.prisonRecords.length > 0)
    ? selectedCase.prisonRecords
    : (DEFAULT_SAMPLE_CASES[0].prisonRecords || []);
  const ncrbDossier: NCRBCriminalDossier = selectedCase?.ncrbDossier || DEFAULT_SAMPLE_CASES[0].ncrbDossier!;
  const forensicRequests = (selectedCase?.forensicRequests && selectedCase.forensicRequests.length > 0)
    ? selectedCase.forensicRequests
    : (DEFAULT_SAMPLE_CASES[0].forensicRequests || []);
  const journalEntries = (selectedCase?.investigationJournal && selectedCase.investigationJournal.length > 0)
    ? selectedCase.investigationJournal
    : (DEFAULT_SAMPLE_CASES[0].investigationJournal || []);

  // Multi-lingual search filter for NCRB
  const filterNCRBCases = () => {
    if (!ncrbDossier || !Array.isArray(ncrbDossier.interStateLinks)) return [];
    return ncrbDossier.interStateLinks.filter(link => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          (link.state || '').toLowerCase().includes(q) ||
          (link.agency || '').toLowerCase().includes(q) ||
          (link.crimeModus || '').toLowerCase().includes(q) ||
          (link.caseReference || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: ICJS Multi-Pillar Architecture */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 border border-blue-900/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="text-[11px] font-bold tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded uppercase">
                ICJS Core Hub (Common Case ID: Unified Folder)
              </span>
              <span className="text-xs text-slate-400">Inter-operable Criminal Justice System</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center space-x-2">
              <span>National Inter-Agency Legal & Investigation Gateway</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Synchronizing real-time evidentiary records across <strong>Police (CCTNS)</strong>, <strong>Judiciary (e-Courts)</strong>, <strong>Forensics (e-Forensics)</strong>, <strong>Prisons (e-Prisons)</strong>, and <strong>NCRB</strong> under cryptographic verification.
            </p>
          </div>

          {/* Quick Case Selector */}
          <div className="flex items-center space-x-3 bg-slate-900/80 p-2.5 rounded-xl border border-slate-700/60 text-xs">
            <span className="text-slate-400 whitespace-nowrap">Active Docket:</span>
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-3 py-1.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {effectiveCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firNumber} — {c.caseTitle.slice(0, 30)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 5 Pillar Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          {[
            {
              id: 'POLICE_CCTNS',
              title: 'Police (CCTNS)',
              subtitle: 'Forms IIF 1–5 & Diary',
              icon: Shield,
              badgeColor: 'blue',
            },
            {
              id: 'JUDICIARY_ECOURTS',
              title: 'Courts (e-Courts)',
              subtitle: 'RC No, Warrants & Orders',
              icon: Scale,
              badgeColor: 'amber',
            },
            {
              id: 'FORENSICS_FSL',
              title: 'Forensics (e-FSL)',
              subtitle: 'DNA, Ballistics, Reports',
              icon: Microscope,
              badgeColor: 'purple',
            },
            {
              id: 'PRISONS_EPRISONS',
              title: 'Jail (e-Prisons)',
              subtitle: 'Remand, Ward & Release',
              icon: Building2,
              badgeColor: 'rose',
            },
            {
              id: 'NCRB_INTELLIGENCE',
              title: 'NCRB Intelligence',
              subtitle: 'Inter-State & Dossier',
              icon: Database,
              badgeColor: 'emerald',
            },
          ].map((pillar) => {
            const Icon = pillar.icon;
            const isSelected = selectedPillar === pillar.id;
            return (
              <button
                key={pillar.id}
                onClick={() => setSelectedPillar(pillar.id as ICJSPillar)}
                className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                    : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xs">{pillar.title}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{pillar.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* PILLAR 1: POLICE (CCTNS) */}
      {selectedPillar === 'POLICE_CCTNS' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">CCTNS Integrated Investigation Framework</span>
                <h2 className="text-lg font-bold text-white mt-0.5 flex items-center space-x-2">
                  <span>Standard Forms IIF 1 to IIF 5 & Case Diary</span>
                </h2>
              </div>
              <div className="flex items-center space-x-2.5">
                <button
                  onClick={() => setActiveCCTNSCase(selectedCase)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-blue-500/20"
                >
                  <FileText className="w-4 h-4" />
                  <span>Open CCTNS Forms Docket</span>
                </button>
                <button
                  onClick={() => setActiveSpecialCase(selectedCase)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-md shadow-indigo-500/20"
                >
                  <Phone className="w-4 h-4" />
                  <span>1930 Cyber & Bank Notices</span>
                </button>
              </div>
            </div>

            {/* Quick Cards for IIF Forms */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-300">IIF-1: First Information Report</span>
                  <span className="text-emerald-400 font-mono text-[10px]">REGISTERED</span>
                </div>
                <p className="text-slate-300">FIR No: <strong className="font-mono">{selectedCase.firNumber || 'FIR-2026-0142'}</strong></p>
                <p className="text-slate-400">Station: {selectedCase.policeStation || 'Andheri Police Station, Mumbai'}</p>
                <div className="text-[11px] text-slate-400 truncate">Complainant: {selectedCase.complainant?.name || 'Ramesh V. Kulkarni'}</div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-300">IIF-2: Crime Details & Panchanama</span>
                  <span className="text-indigo-400 font-mono text-[10px]">e-SAKSH VERIFIED</span>
                </div>
                <p className="text-slate-300">Spot Panchanama: <strong className="font-mono">{selectedCase.cctnsForms?.iif2_crimeDetails?.spotPanchanamaNumber || 'SP-MH-0142-2026'}</strong></p>
                <p className="text-slate-400">Clues Identified: {selectedCase.cctnsForms?.iif2_crimeDetails?.physicalCluesIdentified?.length || 3} items</p>
                <div className="text-[11px] text-emerald-400">GPS & Digital Video Hashed</div>
              </div>

              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-300">IIF-5: Final Form / Chargesheet</span>
                  <span className="text-emerald-400 font-mono text-[10px]">e-SIGNED</span>
                </div>
                <p className="text-slate-300">Docket: <strong className="font-mono">{selectedCase.cctnsForms?.iif5_finalChargesheet?.chargeSheetNumber || 'CS-MH-0142-2026'}</strong></p>
                <p className="text-slate-400">Court: {selectedCase.cctnsForms?.iif5_finalChargesheet?.courtName || 'Metropolitan Magistrate 22nd Court'}</p>
                <div className="text-[11px] text-blue-400">Ready for Scrutiny by Magistrate</div>
              </div>
            </div>

            {/* Case Diary Entries */}
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-3">Recent Case Diary Entries (Section 172 Cr.P.C.)</h3>
              <div className="space-y-2">
                {journalEntries.slice(0, 3).map((entry) => (
                  <div key={entry.id} className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                    <div>
                      <span className="font-mono text-[11px] text-blue-400 mr-2">{entry.timestamp}</span>
                      <strong className="text-slate-200">{entry.activityType}</strong>
                      <p className="text-slate-400 text-[11px] mt-0.5">{entry.notes}</p>
                    </div>
                    <span className="text-slate-400 text-[11px] whitespace-nowrap">By: {entry.officerName}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 2: JUDICIARY (e-COURTS) */}
      {selectedPillar === 'JUDICIARY_ECOURTS' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Judiciary & Court Orders</span>
                <h2 className="text-lg font-bold text-white mt-0.5 flex items-center space-x-2">
                  <span>e-Courts Case Information System (CIS) Docket</span>
                  <span className="text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    CNR: {courtRecords[0]?.rcNumber || 'MHMB02-004821-2026'}
                  </span>
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Presiding: <strong className="text-slate-200">{courtRecords[0]?.judgeName || 'Hon. MM 22nd Court'}</strong>
              </span>
            </div>

            <div className="space-y-3">
              {courtRecords.map((doc) => (
                <div key={doc.id} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                        {doc.documentType}
                      </span>
                      <h4 className="font-bold text-slate-100 text-sm mt-1">{doc.title}</h4>
                      <p className="text-slate-400 text-[11px]">{doc.courtName}</p>
                    </div>
                    <span className="text-xs font-mono text-slate-300 bg-slate-900/60 px-2 py-1 rounded border border-slate-700/40">
                      Date: {doc.dateIssued}
                    </span>
                  </div>

                  <p className="text-slate-300 bg-slate-950/60 p-3 rounded border border-slate-800 leading-relaxed font-sans">
                    {doc.orderSummary}
                  </p>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pt-2 border-t border-slate-700/40 text-[11px] text-slate-400">
                    <div>Public Prosecutor: <strong className="text-slate-300">{doc.publicProsecutor}</strong></div>
                    <div className="font-mono truncate max-w-sm">
                      Court Certified Digest: <span className="text-emerald-400">{doc.documentHash}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 3: FORENSIC (e-FORENSICS / FSL) */}
      {selectedPillar === 'FORENSICS_FSL' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Forensic Science Laboratory (FSL Kalina)</span>
                <h2 className="text-lg font-bold text-white mt-0.5">Scientific Examination, DNA, Ballistics & Fingerprints</h2>
              </div>
              <span className="text-xs font-mono bg-purple-900/40 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded">
                Chain of Custody: Sealed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {forensicRequests.map((fr) => (
                <div key={fr.id} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono font-bold">
                        {fr.evidenceTag}
                      </span>
                      <h4 className="font-bold text-slate-100 text-sm mt-1">{fr.requestedExam}</h4>
                    </div>
                    <span className="text-emerald-400 text-[11px] font-bold">{fr.status}</span>
                  </div>

                  <div className="text-slate-400 space-y-0.5">
                    <div>Lab: <strong className="text-slate-200">{fr.labName}</strong></div>
                    <div>Analyst: <strong className="text-slate-200">{fr.analystName || 'Senior Scientific Assistant'}</strong></div>
                    <div>Submission Date: <span className="font-mono text-slate-300">{fr.submissionDate}</span></div>
                  </div>

                  {fr.findings && (
                    <div className="bg-slate-950/70 p-2.5 rounded border border-slate-700/40 text-slate-300">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Lab Findings:</span>
                      {fr.findings}
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                    <span>FSL Seal Verified: <strong className="text-emerald-400 font-mono">{fr.verificationSeal || 'SEAL-OK'}</strong></span>
                    <button
                      onClick={() => onOpenCaseDetails(selectedCase)}
                      className="text-purple-400 hover:text-purple-300 underline cursor-pointer"
                    >
                      View Full Dossier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 4: JAIL (e-PRISONS) */}
      {selectedPillar === 'PRISONS_EPRISONS' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">Maharashtra Prison Department (e-Prisons)</span>
                <h2 className="text-lg font-bold text-white mt-0.5">Under-Trial Prisoner Custody & Remand Management</h2>
              </div>
              <span className="text-xs font-mono bg-rose-900/40 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded">
                Active Inmates: {prisonRecords.length}
              </span>
            </div>

            <div className="space-y-4">
              {prisonRecords.map((prs) => (
                <div key={prs.id} className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5 space-y-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-slate-700/50 pb-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-rose-400" />
                        <h4 className="font-bold text-slate-100 text-sm">{prs.prisonerName}</h4>
                        <span className="text-xs font-mono text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded">
                          {prs.prisonerNumber}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 block mt-0.5">Facility: {prs.prisonName}</span>
                    </div>
                    <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full font-bold font-mono">
                      {prs.custodyType}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-400 block">Admission Date & Time:</span>
                      <strong className="text-slate-200">{prs.admissionDate}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Assigned Ward / Barrack:</span>
                      <strong className="text-slate-200">{prs.cellWard}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Remand Expiry Date:</span>
                      <strong className="text-amber-400 font-mono">{prs.remandExpiryDate}</strong>
                    </div>
                  </div>

                  {/* Transfer History */}
                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] font-bold uppercase block mb-1">Prisoner Escort & Transfer Ledger:</span>
                    {(prs.transferRecords || []).map((tr, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] text-slate-300">
                        <span>{tr.date}: Transferred from <strong>{tr.fromPrison}</strong> to <strong>{tr.toPrison}</strong></span>
                        <span className="text-slate-400 font-mono">Escort: {tr.escortOfficer}</span>
                      </div>
                    ))}
                  </div>

                  {/* Release Status */}
                  {prs.releaseDetails && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded border border-slate-700/40">
                      <span>Bail Order Verification: <strong className="text-amber-300">{prs.releaseDetails.status}</strong></span>
                      <span className="text-slate-300">{prs.releaseDetails.releaseRemarks}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PILLAR 5: NCRB (NATIONAL CRIME RECORDS BUREAU) */}
      {selectedPillar === 'NCRB_INTELLIGENCE' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">National Crime Records Bureau (NCRB) Dossier</span>
                <h2 className="text-lg font-bold text-white mt-0.5 flex items-center space-x-2">
                  <span>{ncrbDossier.accusedName}</span>
                  <span className="text-xs font-mono text-slate-400">({ncrbDossier.dossierId})</span>
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400">Aadhaar (Masked):</span>
                <span className="font-mono text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-200 border border-slate-700">
                  {ncrbDossier.aadhaarNumberMasked}
                </span>
              </div>
            </div>

            {/* Profile Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block mb-1">Known Aliases:</span>
                <div className="flex flex-wrap gap-1">
                  {(ncrbDossier.aliases || []).map((alias, idx) => (
                    <span key={idx} className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[11px] font-semibold">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block mb-1">Tracked Mobile Numbers:</span>
                <div className="font-mono text-slate-200 space-y-0.5">
                  {(ncrbDossier.mobileNumbers || []).map((m, idx) => (
                    <div key={idx}>{m}</div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50">
                <span className="text-slate-400 block mb-1">Fingerprint Classification:</span>
                <span className="font-mono text-emerald-400 text-xs font-bold block mt-0.5">
                  {ncrbDossier.fingerprintClassRef}
                </span>
              </div>
            </div>

            {/* Multi-Lingual Inter-State Search Filter */}
            <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div className="flex items-center space-x-2">
                  <Languages className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">ICJS Inter-State Search (Auto-Normalized: Marathi / Hindi / Gujarati / English)</span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs">
                  {['ALL', 'EN', 'MR', 'HI', 'GU'].map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguageFilter(lang as any)}
                      className={`px-2 py-1 rounded text-[10px] font-bold ${
                        languageFilter === lang
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search linked crime modus, state agency, or case reference across states..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>

              {/* Inter-State Links */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Cross-Jurisdiction Linked Cases:</span>
                {filterNCRBCases().map((link, idx) => (
                  <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-200">{link.state}: {link.agency}</span>
                        <span className="font-mono text-blue-400 text-[11px]">({link.caseReference})</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">Modus: {link.crimeModus}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-bold font-mono">
                      {link.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CCTNS Forms Modal */}
      {activeCCTNSCase && (
        <CCTNSFormsModal
          caseFile={activeCCTNSCase}
          session={session}
          onClose={() => setActiveCCTNSCase(null)}
        />
      )}

      {/* Specialized Investigation Panel (Bank Notices, 1930 Cyber, MLC) */}
      {activeSpecialCase && (
        <SpecialInvestigationPanel
          caseFile={activeSpecialCase}
          session={session}
          onClose={() => setActiveSpecialCase(null)}
        />
      )}

    </div>
  );
};
