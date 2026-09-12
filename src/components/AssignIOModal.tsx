import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, UserCheck, Briefcase, CheckCircle2 } from 'lucide-react';
import { CaseFile, OfficerProfile, UserSession } from '../types';
import { apiClient } from '../services/apiClient';
import { soundEffects } from './AudioEffects';

interface AssignIOModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: CaseFile;
  session: UserSession;
  onAssignSuccess: (assignedOfficer: OfficerProfile, memoNotes: string) => void;
}

export const AssignIOModal: React.FC<AssignIOModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  session: _session,
  onAssignSuccess,
}) => {
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState<string>('');
  const [memoNotes, setMemoNotes] = useState(
    `Formally assigned as Lead Investigating Officer (IO) under Section 157 Cr.P.C. for FIR ${caseItem.firNumber}. Directed to inspect scene of crime and prepare spot panchnama.`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      apiClient.getOfficers('POLICE').then((res) => {
        if (res && res.success && Array.isArray(res.officers)) {
          const mapped: OfficerProfile[] = res.officers
            .filter((o: any) => {
              const role = (o.role || '').toUpperCase();
              if (role && role !== 'POLICE' && role !== 'OFFICER' && role !== 'PI') return false;
              const rank = (o.rank || '').toLowerCase();
              if (rank.includes('forensic') || rank.includes('prosecutor') || rank.includes('scientist') || rank.includes('auditor') || rank.includes('jail')) return false;
              return true;
            })
            .map((o: any) => ({
              id: o.id || o.badgeNo,
              name: o.name || o.full_name || o.username,
              badgeNo: o.badgeNo || o.badge_no,
              rank: o.rank,
              station: o.station || o.station_id || 'Andheri Police Station',
              unit: o.department || 'Investigation Wing',
              contact: '+91 98200 XXXXX',
              activeCases: Number(o.activeCasesCount ?? 0),
              completedCases: 0,
              currentWorkload: 'Optimal',
              status: 'ACTIVE_ON_DUTY',
              role: 'POLICE',
            }));
          setOfficers(mapped);
          if (mapped.length > 0 && !selectedOfficerId) {
            setSelectedOfficerId(mapped[0].id);
          }
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedOfficer = officers.find((o) => o.id === selectedOfficerId) || officers[0];

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficer) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    soundEffects.playStamp();

    try {
      // 1. Call changeInvestigatingOfficer to record assignment/reassignment in backend store + chained blockchain event
      try {
        await apiClient.changeInvestigatingOfficer(caseItem.id, {
          newOfficerBadge: selectedOfficer.badgeNo,
          newOfficerName: selectedOfficer.name,
          reason: memoNotes || 'Designated Lead Investigating Officer',
          revokeTemporaryGrants: true,
        });
      } catch (adminErr) {
        // Fallback to assignOfficer + updateCase if user is not ADMIN or endpoint unavailable
        await apiClient.assignOfficer(caseItem.id, {
          userBadge: selectedOfficer.badgeNo,
          officerName: selectedOfficer.name,
          assignmentRole: 'Lead Investigating Officer',
          accessLevel: 'FULL',
        }).catch(() => null);

        await apiClient.updateCase(caseItem.id, {
          assignedIO: selectedOfficer.name,
          assignedIOBadge: selectedOfficer.badgeNo,
        }).catch(() => null);
      }

      onAssignSuccess(selectedOfficer, memoNotes);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to assign officer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Assign Investigating Officer
                </h3>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 font-mono text-[10px] font-bold rounded">
                  Police Staff
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Case: <span className="font-mono text-slate-200">{caseItem.firNumber}</span> — {caseItem.caseTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        {/* Modal Body */}
        <form onSubmit={handleAssign} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Select Police Officer
            </label>
            <select
              value={selectedOfficerId}
              onChange={(e) => setSelectedOfficerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 outline-none focus:bg-white focus:border-blue-500"
            >
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.badgeNo}) — {o.rank} [{o.station}]
                </option>
              ))}
            </select>
          </div>

          {selectedOfficer && (
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-blue-950">{selectedOfficer.name}</span>
                <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                  {selectedOfficer.badgeNo}
                </span>
              </div>
              <p className="text-slate-600 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {selectedOfficer.rank} — {selectedOfficer.station}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Assignment Notes / Instructions
            </label>
            <textarea
              rows={3}
              value={memoNotes}
              onChange={(e) => setMemoNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-500"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedOfficer}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Assign Officer'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
