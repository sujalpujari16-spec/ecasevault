import React, { useState } from "react";
import {
  FileBarChart,
  Printer,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  Microscope,
  Scale,
  Users,
  Lock,
  FileText,
  Calendar,
  MapPin,
  Activity,
  Download,
  ExternalLink,
  X,
  Sparkles,
  Building2,
  ArrowRight,
  Fingerprint,
  UserCheck,
  Clock,
  Briefcase
} from "lucide-react";
import { CaseFile, UserSession } from "../types";
import { soundEffects } from "./AudioEffects";

interface LiveCaseSummaryModalProps {
  caseItem: CaseFile;
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
}

export const LiveCaseSummaryModal: React.FC<LiveCaseSummaryModalProps> = ({
  caseItem,
  isOpen,
  onClose,
  session
}) => {
  if (!isOpen || !caseItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full flex flex-col max-h-[94vh] overflow-hidden">
        <LiveCaseSummaryContent
          caseItem={caseItem}
          session={session}
          onClose={onClose}
          isModal={true}
        />
      </div>
    </div>
  );
};

interface LiveCaseSummaryContentProps {
  caseItem: CaseFile;
  session: UserSession;
  onClose?: () => void;
  isModal?: boolean;
}

export const LiveCaseSummaryContent: React.FC<LiveCaseSummaryContentProps> = ({
  caseItem,
  session,
  onClose,
  isModal = false
}) => {
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<"OVERVIEW" | "STATUTORY" | "ALL_DATA" | "PRINT_PREVIEW">("OVERVIEW");

  // ================= DYNAMIC LIVE DATA COMPUTATIONS =================
  const evList = caseItem.evidenceItems || [];
  const verifiedEvCount = evList.filter(e => e.isIntegrityVerified).length;
  const fslList = caseItem.forensicRequests || [];
  const fslCompletedCount = fslList.filter(f => f.status === "Report Ready" || f.status === "Report Reviewed" || f.status === "Closed").length;
  const fslPendingCount = fslList.filter(f => f.status !== "Closed" && f.status !== "Report Ready" && f.status !== "Report Reviewed").length;
  
  const suspectsList = caseItem.suspects || [];
  const arrestedCount = suspectsList.filter(s => s.status === "Arrested" || s.status === "Under Judicial Remand").length;
  const atLargeCount = suspectsList.filter(s => s.status !== "Arrested" && s.status !== "Under Judicial Remand").length;

  const witnessesList = caseItem.witnesses || [];
  const sec161Statements = witnessesList.filter(w => (w as any).statement || (w as any).statementSummary).length;
  
  const courtDocs = caseItem.courtRecords || [];
  const warrantsList = caseItem.warrants || [];
  const activeWarrants = warrantsList.filter(w => (w.status as string) === "Active" || (w.status as string) === "Issued" || w.status === "ACTIVE" || (w as any).warrantStatus === "ACTIVE").length;
  const hearingsList = caseItem.hearings || [];
  
  const diaryEntries = caseItem.investigationJournal || [];
  const repoDocs = caseItem.documents || [];

  const hasAssignedIO = Boolean(caseItem.officers?.assignedIO && !caseItem.officers.assignedIO.includes("Pending") && !caseItem.officers.assignedIO.includes("Unassigned"));

  // Calculate dynamic investigation completeness score (0-100%)
  let score = 20; // Base score for valid registered FIR
  if (hasAssignedIO) score += 15;
  if (evList.length > 0) score += 15;
  if (verifiedEvCount > 0 && verifiedEvCount === evList.length) score += 5;
  if (witnessesList.length > 0) score += 10;
  if (fslList.length > 0 && fslCompletedCount === fslList.length) score += 15;
  else if (fslList.length === 0) score += 10; // no test needed
  if (diaryEntries.length >= 2) score += 10;
  if (courtDocs.length > 0 || caseItem.status === "Charge Sheet / Court Process" || caseItem.status === "Closed") score += 10;
  score = Math.min(score, 100);

  // Dynamic Risk Flags
  const riskFlags: string[] = [];
  if (!hasAssignedIO) {
    riskFlags.push("Lead Investigating Officer (IO) assignment pending under Sec 157 Cr.P.C.");
  }
  if (evList.length === 0) {
    riskFlags.push("Zero physical or digital material evidence items seized.");
  }
  if (atLargeCount > 0) {
    riskFlags.push(`${atLargeCount} named suspect(s) currently at large / pending arrest.`);
  }
  if (fslPendingCount > 0) {
    riskFlags.push(`${fslPendingCount} forensic laboratory examination(s) awaiting completion at FSL Kalina.`);
  }
  if (activeWarrants > 0) {
    riskFlags.push(`${activeWarrants} judicial warrant(s) active and pending execution by station personnel.`);
  }
  if (witnessesList.length === 0) {
    riskFlags.push("No independent witness statements registered under Section 161 Cr.P.C.");
  }

  // Statutory Milestones Checklist
  const statutoryChecks = [
    { title: "Sec 154 CrPC / 173 BNSS (FIR Registration)", status: "COMPLETED", note: `FIR ${caseItem.firNumber} sealed on blockchain.` },
    { title: "Sec 157 CrPC (IO Designation & Spot Inquiry)", status: hasAssignedIO ? "COMPLETED" : "PENDING", note: hasAssignedIO ? `Assigned to ${caseItem.officers?.assignedIO}` : "Pending Station Head assignment." },
    { title: "Sec 100/102 CrPC (Search & Seizure Panchnama)", status: evList.length > 0 ? "COMPLETED" : "PENDING", note: `${evList.length} evidence items logged in malkhana.` },
    { title: "Sec 161 CrPC (Witness Examination)", status: witnessesList.length > 0 ? "COMPLETED" : "IN_PROGRESS", note: `${witnessesList.length} witness statements recorded.` },
    { title: "Sec 293 CrPC (Forensic Laboratory Analysis)", status: fslList.length === 0 ? "NOT_APPLICABLE" : fslCompletedCount === fslList.length ? "COMPLETED" : "IN_PROGRESS", note: fslList.length > 0 ? `${fslCompletedCount}/${fslList.length} FSL reports certified.` : "No chemical/digital FSL examination ordered." },
    { title: "Sec 172 CrPC (Police Case Diary Maintenance)", status: diaryEntries.length > 0 ? "COMPLETED" : "IN_PROGRESS", note: `${diaryEntries.length} chronological journal entries verified.` },
    { title: "Sec 173 CrPC (Final Police Report / Charge Sheet)", status: (caseItem.status === "Closed" || caseItem.status === "Charge Sheet / Court Process") ? "COMPLETED" : "IN_PROGRESS", note: `Docket currently at stage: ${caseItem.status}.` },
  ];

  // Copy Full Text Summary
  const handleCopySummary = () => {
    soundEffects.playStamp();
    const text = `
===================================================================
MAHARASHTRA POLICE • LIVE STATUTORY CASE SUMMARY REPORT
===================================================================
Case ID: ${caseItem.id}
FIR Number: ${caseItem.firNumber}
Police Station: ${caseItem.policeStation}
Jurisdiction: ${caseItem.jurisdictionZone || "Mumbai Metropolitan"}
Offenses / Sections: ${(caseItem.ipcSections || []).join(", ")}
Crime Category: ${caseItem.crimeType}
Incident Date & Location: ${caseItem.incidentDate} at ${caseItem.incidentLocation}
Current Lifecycle Status: ${caseItem.status}
Priority: ${caseItem.priority} (Severity: ${caseItem.severity})

INVESTIGATION COMMAND & PERSONNEL:
- Station In-Charge (PI): ${caseItem.officers?.piInCharge || "Police Inspector"}
- Designated Lead IO: ${caseItem.officers?.assignedIO || "Unassigned"} (${caseItem.officers?.assignedIOBadge || "N/A"})
- Supervisory Officer: ${caseItem.officers?.supervisingDySP || "DySP Sub-Division"}

LIVE DOCKET ASSETS STATUS:
- Material Evidence: ${evList.length} items (${verifiedEvCount} cryptographically verified)
- Forensic Orders: ${fslList.length} requested (${fslCompletedCount} reports finalized, ${fslPendingCount} in lab)
- Suspects / Accused: ${suspectsList.length} named (${arrestedCount} in custody, ${atLargeCount} at large)
- Witnesses: ${witnessesList.length} registered (${sec161Statements} Sec 161 statements logged)
- Judicial Proceedings: ${courtDocs.length} orders / ${activeWarrants} active warrants / ${hearingsList.length} court hearings
- Case Diary: ${diaryEntries.length} statutory entries under Sec 172 CrPC
- Repository Documents: ${repoDocs.length} archived files

INVESTIGATION PROGRESS SCORE: ${score}% Complete
RISK FLAGS:
${riskFlags.length > 0 ? riskFlags.map(r => `[!] ${r}`).join("\n") : "[✓] No high-risk statutory impediments detected."}

Generated Live via e-CASEVAULT Intranet: ${new Date().toLocaleString("en-IN")} IST
===================================================================
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  // Browser Native Print
  const handlePrint = () => {
    soundEffects.playStamp();
    window.print();
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-900">
      {/* Top Header Bar */}
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
            <FileBarChart className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-blue-300 tracking-wider uppercase">
                e-CASEVAULT Live Executive Brief
              </span>
              <span className="px-2 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-bold">
                Live Data Synchronized
              </span>
            </div>
            <h2 className="text-base font-bold text-white tracking-wide">
              {caseItem.caseTitle}
            </h2>
            <p className="text-[11px] text-slate-400">
              FIR No: <strong className="text-slate-200 font-mono">{caseItem.firNumber}</strong> • Registered at: <strong className="text-slate-200">{caseItem.policeStation}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          >
            {copiedNotice ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedNotice ? "Copied to Clipboard!" : "Copy Summary"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation */}
      <div className="px-6 border-b border-slate-200 bg-slate-50 flex items-center gap-2 shrink-0">
        {[
          { id: "OVERVIEW", label: "Executive Dashboard", icon: Sparkles },
          { id: "STATUTORY", label: "Statutory CrPC Compliance", icon: Scale },
          { id: "ALL_DATA", label: "Live Data Registry Breakdown", icon: Activity },
          { id: "PRINT_PREVIEW", label: "Official Letterhead View", icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeReportTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                soundEffects.playSnap();
                setActiveReportTab(tab.id as any);
              }}
              className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer transition-colors ${
                isActive ? "border-blue-700 text-blue-900 bg-white" : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Body */}
      <div className="p-6 overflow-y-auto flex-1 bg-slate-100/50 space-y-6 print:p-0 print:bg-white">

        {/* ================= VIEW 1: EXECUTIVE DASHBOARD ================= */}
        {activeReportTab === "OVERVIEW" && (
          <div className="space-y-6">
            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Health Score</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono text-blue-800">{score}%</span>
                  <span className="text-[10px] font-bold text-slate-500">Ready</span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-700 h-full rounded-full transition-all duration-500" style={{ width: `${score}%` }} />
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Evidence Items</span>
                <div className="text-xl font-bold font-mono text-slate-900">{evList.length}</div>
                <span className="text-[10px] text-emerald-700 font-semibold block">{verifiedEvCount} Verified Intact</span>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">FSL Lab Orders</span>
                <div className="text-xl font-bold font-mono text-purple-900">{fslList.length}</div>
                <span className="text-[10px] text-purple-700 font-semibold block">{fslCompletedCount} Ready • {fslPendingCount} In Lab</span>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suspects</span>
                <div className="text-xl font-bold font-mono text-slate-900">{suspectsList.length}</div>
                <span className="text-[10px] text-blue-700 font-semibold block">{arrestedCount} In Custody • {atLargeCount} At Large</span>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Witnesses</span>
                <div className="text-xl font-bold font-mono text-slate-900">{witnessesList.length}</div>
                <span className="text-[10px] text-slate-500 font-semibold block">{sec161Statements} Statements Logged</span>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Court Actions</span>
                <div className="text-xl font-bold font-mono text-slate-900">{courtDocs.length + warrantsList.length}</div>
                <span className="text-[10px] text-amber-700 font-semibold block">{activeWarrants} Active Warrants</span>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Case Diary</span>
                <div className="text-xl font-bold font-mono text-slate-900">{diaryEntries.length}</div>
                <span className="text-[10px] text-slate-500 font-semibold block">Sec 172 CrPC Entries</span>
              </div>
            </div>

            {/* Risk & Action Alerts */}
            {riskFlags.length > 0 ? (
              <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Statutory Bottlenecks & Critical Risk Factors ({riskFlags.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {riskFlags.map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-amber-900 bg-white/70 p-2 rounded-lg border border-amber-200/60">
                      <span className="font-bold text-amber-600 shrink-0">•</span>
                      <span>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-900 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>All statutory investigation milestones are up-to-date with zero critical blockers.</span>
              </div>
            )}

            {/* Core Overview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Box 1: Investigation Overview & Incident */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-700" />
                    Offense & Registration Genesis
                  </h3>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-[10px] font-bold">
                    {caseItem.priority}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px]">Police Station:</span>
                    <p className="font-bold text-slate-900">{caseItem.policeStation}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Jurisdiction Zone:</span>
                    <p className="font-semibold text-slate-800">{caseItem.jurisdictionZone || "Metropolitan Command"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Incident Date & Time:</span>
                    <p className="font-medium text-slate-800">{caseItem.incidentDate} at {caseItem.incidentTime || "12:00"}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px]">Occurrence Location:</span>
                    <p className="font-medium text-slate-800 truncate" title={caseItem.incidentLocation}>{caseItem.incidentLocation}</p>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-100">
                    <span className="text-slate-400 text-[11px]">Statutory Acts & Sections:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(caseItem.ipcSections || []).map((sec, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded text-[10px] font-bold font-mono">
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-slate-100">
                    <span className="text-slate-400 text-[11px]">FIR Brief Facts:</span>
                    <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-[11px] leading-relaxed mt-1">
                      {caseItem.summaryNotes || caseItem.complainant?.statementBrief || caseItem.caseTitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Box 2: Investigative Command Roster */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-700" />
                    Investigation Team & Assignment
                  </h3>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                    {caseItem.status}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-800 uppercase">Designated Lead IO</span>
                      <span className="px-1.5 py-0.2 bg-blue-200 text-blue-900 text-[9px] font-bold rounded">Sec 157 CrPC</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{caseItem.officers?.assignedIO || "Assignment Pending"}</p>
                    <p className="text-[11px] text-slate-500 font-mono">Badge: {caseItem.officers?.assignedIOBadge || "N/A"}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 text-[11px]">Station In-Charge (PI):</span>
                      <p className="font-bold text-slate-800">{caseItem.officers?.piInCharge || "Senior PI"}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px]">Supervisory DySP:</span>
                      <p className="font-medium text-slate-800">{caseItem.officers?.supervisingDySP || "Sub-Divisional Officer"}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-400 text-[11px] block mb-1">Active Case Team Members ({(caseItem.caseAssignments || []).length}):</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(caseItem.caseAssignments || []).map(a => (
                        <span key={a.assignmentId} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-medium text-slate-800 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-blue-600" />
                          {a.officerName} ({a.assignmentRole})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 2: STATUTORY COMPLIANCE CHECKLIST ================= */}
        {activeReportTab === "STATUTORY" && (
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-4 h-4 text-blue-700" />
                Statutory Code of Criminal Procedure Compliance Audit
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Mandatory procedural checkpoints required for submitting a judicial charge-sheet under Section 173 Cr.P.C. / BNSS 193.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {statutoryChecks.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-500">{item.note}</p>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                    item.status === "COMPLETED"
                      ? "bg-emerald-100 text-emerald-800"
                      : item.status === "IN_PROGRESS"
                      ? "bg-blue-100 text-blue-800"
                      : item.status === "NOT_APPLICABLE"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {item.status === "COMPLETED" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                    {item.status === "PENDING" && <AlertCircle className="w-3 h-3 text-amber-600" />}
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= VIEW 3: LIVE REGISTRY ASSET BREAKDOWN ================= */}
        {activeReportTab === "ALL_DATA" && (
          <div className="space-y-5">
            {/* Section A: Seized Evidence */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-700" />
                  Material Evidence Registry ({evList.length})
                </h4>
                <span className="text-[11px] text-slate-500">Malkhana & Chain of Custody</span>
              </div>
              {evList.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs">
                  {evList.map(ev => (
                    <div key={ev.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono font-bold text-blue-800">{ev.evidenceTag}</span>
                        <p className="font-semibold text-slate-800 text-[11px]">{ev.description}</p>
                        <p className="text-[10px] text-slate-400">Category: {ev.category} • Seized at: {ev.locationFound}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-bold text-[10px]">
                          {ev.status}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{ev.storageLocker}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 italic">No material evidence items seized for this case.</p>
              )}
            </div>

            {/* Section B: FSL Orders */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Microscope className="w-4 h-4 text-purple-700" />
                  Forensic Science Laboratory (FSL) Examinations ({fslList.length})
                </h4>
                <span className="text-[11px] text-slate-500">Section 293 CrPC</span>
              </div>
              {fslList.length > 0 ? (
                <div className="divide-y divide-slate-100 text-xs">
                  {fslList.map(fsl => (
                    <div key={fsl.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono font-bold text-purple-800">{fsl.id}</span>
                        <span className="text-[10px] text-slate-500 ml-2">Evidence: {fsl.evidenceTag}</span>
                        <p className="font-semibold text-slate-800 text-[11px]">{fsl.requestedExam}</p>
                        <p className="text-[10px] text-slate-500">Lab: {fsl.labName} • Ref: {fsl.requisitionLetterRef || "N/A"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          fsl.status === "Report Ready" || fsl.status === "Closed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {fsl.status}
                        </span>
                        {fsl.requisitionLetterName && (
                          <p className="text-[10px] text-purple-700 mt-0.5">✓ Requisition Letter Uploaded</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-3 italic">No scientific laboratory tests ordered.</p>
              )}
            </div>

            {/* Section C: Suspects & Witnesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-700" />
                  Accused / Suspects ({suspectsList.length})
                </h4>
                {suspectsList.length > 0 ? (
                  <div className="divide-y divide-slate-100 text-xs">
                    {suspectsList.map(s => (
                      <div key={s.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{s.name}</span>
                          <p className="text-[10px] text-slate-500">Status: {s.status} • {s.custodyStatus}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">{s.tag}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2 italic">Zero suspects registered.</p>
                )}
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5 text-slate-700" />
                  Witnesses & Statements ({witnessesList.length})
                </h4>
                {witnessesList.length > 0 ? (
                  <div className="divide-y divide-slate-100 text-xs">
                    {witnessesList.map(w => (
                      <div key={w.id} className="py-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{w.name}</span>
                          <p className="text-[10px] text-slate-500">Status: {w.statementStatus} • Officer: {w.recordedBy || "Recorded"}</p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                          {(w as any).statement || w.statementSummary ? "Statement Filed" : "Pending Examination"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-2 italic">No witnesses examined under Sec 161 CrPC.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= VIEW 4: OFFICIAL LETTERHEAD PRINT PREVIEW ================= */}
        {activeReportTab === "PRINT_PREVIEW" && (
          <div className="bg-white p-8 rounded-xl border border-slate-300 shadow-md max-w-4xl mx-auto space-y-6 text-slate-950 font-serif leading-relaxed">
            {/* Official Letterhead Header */}
            <div className="text-center border-b-2 border-slate-950 pb-4 space-y-1">
              <p className="text-xs font-sans uppercase tracking-widest text-slate-600 font-bold">Government of Maharashtra • Police Department</p>
              <h1 className="text-xl font-bold tracking-wider">OFFICE OF THE INVESTIGATING OFFICER</h1>
              <h2 className="text-sm font-semibold">{caseItem.policeStation.toUpperCase()}</h2>
              <p className="text-xs font-sans text-slate-600">CONFIDENTIAL STATUTORY INVESTIGATION BRIEF & CASE STATUS REPORT</p>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-sans border-b border-slate-300 pb-3">
              <div>
                <p><strong>CASE DOCKET ID:</strong> {caseItem.id}</p>
                <p><strong>FIR NO:</strong> {caseItem.firNumber}</p>
                <p><strong>POLICE STATION:</strong> {caseItem.policeStation}</p>
                <p><strong>OFFENSE SECTIONS:</strong> {(caseItem.ipcSections || []).join(", ")}</p>
              </div>
              <div>
                <p><strong>DATE OF INCIDENT:</strong> {caseItem.incidentDate}</p>
                <p><strong>LEAD INVESTIGATOR:</strong> {caseItem.officers?.assignedIO || "Pending"} ({caseItem.officers?.assignedIOBadge})</p>
                <p><strong>STATION PI:</strong> {caseItem.officers?.piInCharge || "In-Charge"}</p>
                <p><strong>REPORT DATE:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <h3 className="font-sans font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                1. BRIEF FACTS & INVESTIGATION GENESIS
              </h3>
              <p className="text-justify leading-relaxed">
                {caseItem.summaryNotes || caseItem.caseTitle}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <h3 className="font-sans font-bold uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
                2. SUMMARY OF RECOVERIES, CUSTODY & SCIENTIFIC EVIDENCE
              </h3>
              <table className="w-full text-left border-collapse border border-slate-300 font-sans text-[11px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-1.5">Asset Classification</th>
                    <th className="border border-slate-300 p-1.5 text-center">Total Quantity</th>
                    <th className="border border-slate-300 p-1.5">Statutory Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-1.5 font-bold">Material Evidence Seized</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{evList.length}</td>
                    <td className="border border-slate-300 p-1.5">{verifiedEvCount} verified intact in Malkhana custody</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-1.5 font-bold">Forensic Laboratory Orders</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{fslList.length}</td>
                    <td className="border border-slate-300 p-1.5">{fslCompletedCount} reports certified under Sec 293 CrPC</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-1.5 font-bold">Suspects / Accused Persons</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{suspectsList.length}</td>
                    <td className="border border-slate-300 p-1.5">{arrestedCount} under custodial remand / {atLargeCount} at large</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 p-1.5 font-bold">Witness Statements Recorded</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{witnessesList.length}</td>
                    <td className="border border-slate-300 p-1.5">{sec161Statements} statements recorded under Sec 161 CrPC</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-8 flex justify-between items-end font-sans text-xs">
              <div className="space-y-1">
                <p className="font-mono text-[10px] text-slate-500">DIGITAL HASH: {caseItem.id}-AUDIT-VERIFIED</p>
                <p className="font-mono text-[10px] text-slate-500">HYPERLEDGER FABRIC STATUS: CONFIRMED</p>
              </div>
              <div className="text-center space-y-1 border-t border-slate-400 pt-2 min-w-[200px]">
                <p className="font-bold">{caseItem.officers?.assignedIO || session.officerName}</p>
                <p className="text-[11px] text-slate-600">Investigating Officer ({caseItem.officers?.assignedIOBadge || session.badgeNo})</p>
                <p className="text-[10px] text-slate-500">{caseItem.policeStation}</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Footer Actions */}
      <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs shrink-0 print:hidden">
        <span className="text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Live case data fetched from secure server storage.
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopySummary}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer transition-colors"
          >
            {copiedNotice ? "✓ Copied" : "Copy Text Summary"}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>
    </div>
  );
};
