import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RotateCcw,
  UserX,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  ShieldCheck,
  Briefcase,
  Lock,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { CaseFile, OfficerProfile, UserSession } from '../types';
import { apiClient } from '../services/apiClient';
import { soundEffects } from './AudioEffects';

import { getStoredMembers } from '../utils/institutionStorage';

interface ReassignIOModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: CaseFile;
  session: UserSession;
  onReassignSuccess: (newOfficer: OfficerProfile, reason: string) => void;
}

const DEFAULT_STATION_IOS: OfficerProfile[] = [
  {
    id: 'OFF-MH-DAD-401',
    name: 'Inspector Sachin R. Kadam (IO)',
    badgeNo: 'MH-POL-DAD-401',
    rank: 'Police Inspector (IO)',
    station: 'Dadar Police Station, Mumbai',
    unit: 'Dadar Crime Investigation Wing',
    contact: '+91 22 2422 1200',
    activeCases: 1,
    completedCases: 18,
    currentWorkload: 'Optimal',
    status: 'ACTIVE_ON_DUTY',
    role: 'POLICE',
  },
  {
    id: 'OFF-MH-WOR-101',
    name: 'Inspector Arvind B. Shinde (IO)',
    badgeNo: 'MH-POL-WOR-101',
    rank: 'Police Inspector (IO)',
    station: 'Worli Police Station, Mumbai',
    unit: 'Worli Crime Investigation Wing',
    contact: '+91 22 2493 0100',
    activeCases: 1,
    completedCases: 14,
    currentWorkload: 'Optimal',
    status: 'ACTIVE_ON_DUTY',
    role: 'POLICE',
  },
  {
    id: 'OFF-MH-BAN-201',
    name: 'Inspector Sunil M. Kadam (IO)',
    badgeNo: 'MH-POL-BAN-201',
    rank: 'Police Inspector (IO)',
    station: 'Bandra Police Station, Mumbai',
    unit: 'Bandra Crime Investigation Wing',
    contact: '+91 22 2642 2200',
    activeCases: 1,
    completedCases: 22,
    currentWorkload: 'Optimal',
    status: 'ACTIVE_ON_DUTY',
    role: 'POLICE',
  },
  {
    id: 'OFF-MH-COL-301',
    name: 'Inspector Dilip M. Mane (IO)',
    badgeNo: 'MH-POL-COL-301',
    rank: 'Police Inspector (IO)',
    station: 'Colaba Police Station, Mumbai',
    unit: 'Colaba Crime Investigation Wing',
    contact: '+91 22 2285 1100',
    activeCases: 1,
    completedCases: 16,
    currentWorkload: 'Optimal',
    status: 'ACTIVE_ON_DUTY',
    role: 'POLICE',
  },
  {
    id: 'OFF-MH-AND-8842',
    name: 'Inspector Rajesh Patil (IO)',
    badgeNo: 'MH-POL-8842',
    rank: 'Senior Police Inspector (IO)',
    station: 'Andheri Police Station, Mumbai',
    unit: 'Crime & Cyber Cell',
    contact: '+91 22 2683 0100',
    activeCases: 2,
    completedCases: 34,
    currentWorkload: 'Optimal',
    status: 'ACTIVE_ON_DUTY',
    role: 'POLICE',
  },
  {
    id: 'OFF-MH-PSI-4910',
    name: 'PSI R. Deshmukh',
    badgeNo: 'MH-PSI-4910',
    rank: 'Police Sub-Inspector',
    station: 'Andheri Police Station, Mumbai',
    unit: 'General Crimes Unit',
    contact: '+91 22 2683 0101',
    activeCases: 2,
    completedCases: 12,
    currentWorkload: 'Optimal',
    status: 'ACTIVE_ON_DUTY',
    role: 'POLICE',
  },
];

export const ReassignIOModal: React.FC<ReassignIOModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  session,
  onReassignSuccess,
}) => {
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [reasonCategory, setReasonCategory] = useState<string>('Investigation Performance / Quality Review (Administrative Replacement)');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [revokeTemporaryGrants, setRevokeTemporaryGrants] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentIOBadge = caseItem.officers?.assignedIOBadge || caseItem.investigating_officer_id;

      const fallbackFromStore: OfficerProfile[] = [
        ...DEFAULT_STATION_IOS,
        ...getStoredMembers()
          .filter(m => m.role === 'POLICE')
          .map(m => ({
            id: m.id,
            name: m.fullName,
            badgeNo: m.badgeNo,
            rank: m.rank,
            station: m.stationOrInstitution,
            role: m.role,
            unit: m.department || 'Investigation Wing',
            contact: m.contactNumber || '+91 98200 XXXXX',
            activeCases: 0,
            completedCases: 0,
            currentWorkload: 'Optimal' as const,
            status: 'ACTIVE_ON_DUTY' as any,
          }))
      ];

      apiClient.getOfficers('POLICE')
        .then((res) => {
          let listToProcess = fallbackFromStore;
          if (res && res.success && Array.isArray(res.officers) && res.officers.length > 0) {
            const apiMapped = res.officers.map((o: any) => ({
              id: o.id || o.badgeNo,
              name: o.name || o.full_name || o.username,
              badgeNo: o.badgeNo || o.badge_no,
              rank: o.rank || 'Police Inspector (PI)',
              station: o.station || o.station_id || 'Maharashtra Police',
              unit: o.department || 'Crime Investigation',
              contact: '+91 98200 XXXXX',
              activeCases: Number(o.activeCasesCount ?? 0),
              completedCases: 0,
              currentWorkload: 'Optimal' as const,
              status: 'ACTIVE_ON_DUTY',
              role: 'POLICE',
            }));
            listToProcess = [...apiMapped, ...fallbackFromStore];
          }

          // Deduplicate by badgeNo and exclude current IO
          const uniqueByBadge = new Map<string, OfficerProfile>();
          for (const off of listToProcess) {
            const b = (off.badgeNo || '').trim();
            if (!b || b === currentIOBadge) continue;
            if (!uniqueByBadge.has(b)) {
              uniqueByBadge.set(b, off);
            }
          }

          const filtered = Array.from(uniqueByBadge.values());
          setOfficers(filtered);
          if (filtered.length > 0) {
            setSelectedOfficerId(filtered[0].badgeNo);
          }
        })
        .catch(() => {
          const uniqueByBadge = new Map<string, OfficerProfile>();
          for (const off of fallbackFromStore) {
            const b = (off.badgeNo || '').trim();
            if (!b || b === currentIOBadge) continue;
            if (!uniqueByBadge.has(b)) {
              uniqueByBadge.set(b, off);
            }
          }
          const filtered = Array.from(uniqueByBadge.values());
          setOfficers(filtered);
          if (filtered.length > 0) {
            setSelectedOfficerId(filtered[0].badgeNo);
          }
        });
    }
  }, [isOpen, caseItem]);

  if (!isOpen) return null;

  const currentIO = caseItem.officers?.assignedIO || caseItem.investigating_officer_id || 'Current Investigating Officer';
  const currentIOBadge = caseItem.officers?.assignedIOBadge || caseItem.investigating_officer_id || 'N/A';
  const selectedOfficer = officers.find(o => o.badgeNo === selectedOfficerId || o.id === selectedOfficerId) || officers[0];

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficer) {
      setErrorMessage('Please select an eligible investigating officer.');
      return;
    }

    if (!isConfirmed) {
      setIsConfirmed(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    soundEffects.playStamp();

    const fullReason = additionalNotes.trim()
      ? `${reasonCategory}: ${additionalNotes.trim()}`
      : reasonCategory;

    try {
      const res = await apiClient.changeInvestigatingOfficer(caseItem.id, {
        newOfficerBadge: selectedOfficer.badgeNo,
        newOfficerName: selectedOfficer.name,
        reason: fullReason,
        revokeTemporaryGrants,
      });

      if (res && res.success) {
        onReassignSuccess(selectedOfficer, fullReason);
        handleClose();
      } else {
        throw new Error(res?.error || 'Failed to reassign case on backend');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with backend authority service');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsConfirmed(false);
    setErrorMessage(null);
    setAdditionalNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#0d1b2a] text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Reassign Investigating Officer
                </h3>
                <span className="px-2 py-0.5 bg-red-500/20 text-red-300 font-mono text-[10px] font-bold rounded">
                  Admin Authority
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Case: <span className="font-mono text-slate-200">{caseItem.firNumber || caseItem.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <form onSubmit={handleReassign} className="space-y-4">
            {/* Transfer Visualizer */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-slate-500 font-bold mb-1">
                  <UserX className="w-3.5 h-3.5 text-red-500" />
                  <span>Outgoing IO (Revoke)</span>
                </div>
                <div className="font-bold text-slate-900 truncate">{currentIO}</div>
                <div className="font-mono text-[11px] text-slate-500">{currentIOBadge}</div>
              </div>

              <div className="px-2 py-1 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center">
                <ArrowRight className="w-4 h-4" />
              </div>

              <div className="flex-1 text-right">
                <div className="flex items-center justify-end gap-1.5 text-blue-600 font-bold mb-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Incoming IO (Grant)</span>
                </div>
                <div className="font-bold text-blue-950 truncate">
                  {selectedOfficer?.name || 'Select Officer'}
                </div>
                <div className="font-mono text-[11px] text-blue-700">
                  {selectedOfficer?.badgeNo || '---'}
                </div>
              </div>
            </div>

            {/* Officer Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Designate New Lead Investigating Officer <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-medium text-slate-800 cursor-pointer"
              >
                {officers.map(o => (
                  <option key={o.badgeNo} value={o.badgeNo}>
                    {o.name} ({o.rank}) — Badge: {o.badgeNo} [{o.station}]
                  </option>
                ))}
              </select>
            </div>

            {/* Reason Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Statutory Ground for Reassignment <span className="text-red-500">*</span>
              </label>
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden font-medium text-slate-800 cursor-pointer"
              >
                <option value="Investigation Performance / Quality Review (Administrative Replacement)">Investigation Performance / Quality Review (Administrative Replacement)</option>
                <option value="Officer Replaced by Station Command / Admin Directive">Officer Replaced by Station Command / Admin Directive</option>
                <option value="Administrative Transfer of Investigation">Administrative Transfer of Investigation</option>
                <option value="Workload Balancing & Swift Case Disposal">Workload Balancing & Swift Case Disposal</option>
                <option value="Jurisdictional Transfer under Cr.P.C.">Jurisdictional Transfer under Cr.P.C.</option>
                <option value="Officer Medical / Extended Leave">Officer Medical / Extended Leave</option>
                <option value="Promotion / Re-posting to Another Unit">Promotion / Re-posting to Another Unit</option>
                <option value="Special Investigation Team (SIT) Escalation">Special Investigation Team (SIT) Escalation</option>
                <option value="Supervisory Order / High Court Directive">Supervisory Order / High Court Directive</option>
              </select>
            </div>

            {/* Memo Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Transfer Memo & Directives (Optional)
              </label>
              <textarea
                rows={2}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="E.g., Complete case diary handover within 24 hours under memo SP-HQ/2026/894."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden resize-none"
              />
            </div>

            {/* Revoke grants toggle */}
            <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <input
                type="checkbox"
                id="revokeTemporaryGrants"
                checked={revokeTemporaryGrants}
                onChange={(e) => setRevokeTemporaryGrants(e.target.checked)}
                className="rounded border-slate-300 text-[#182f4d] focus:ring-blue-500"
              />
              <label htmlFor="revokeTemporaryGrants" className="text-xs text-slate-700 cursor-pointer">
                <span className="font-bold text-slate-900">Revoke Temporary Access Grants:</span> Terminate any temporary view clearances issued under former IO.
              </label>
            </div>

            {/* Warning when confirming */}
            {isConfirmed && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-900 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Immediate Backend Access Revocation:</span> Former officer's active token privileges for this case will return <span className="font-mono font-bold text-red-800">403 Forbidden</span> immediately. This operation will be permanently recorded on the blockchain ledger.
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                className="py-2 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`py-2 px-4 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2 cursor-pointer ${
                  isConfirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-[#182f4d] hover:bg-[#182f4d]/90'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Committing Reassignment...
                  </>
                ) : isConfirmed ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Confirm & Revoke Former IO Access
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reassign Case IO
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
