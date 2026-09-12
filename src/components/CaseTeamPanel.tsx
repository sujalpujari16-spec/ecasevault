import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserCheck,
  UserX,
  RotateCcw,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { CaseFile, UserSession, CaseAssignment, CaseAssignmentRole, CaseAccessLevel } from '../types';
import { canReassignCase, isOfficerAssignedToCase, generateCurrentDocketTimestamp } from '../utils/policeWorkflow';
import { OfficerProfile } from '../types';
import { soundEffects } from './AudioEffects';
import { getStoredMembers } from '../utils/institutionStorage';
import { apiClient } from '../services/apiClient';

interface CaseTeamPanelProps {
  caseFile: CaseFile;
  session: UserSession;
  stationOfficers: OfficerProfile[];
  onUpdateCase: (updated: CaseFile, auditAction?: string, auditNotes?: string) => void;
  onOpenReassign?: () => void;
}

export const CaseTeamPanel: React.FC<CaseTeamPanelProps> = ({
  caseFile,
  session,
  stationOfficers,
  onUpdateCase,
  onOpenReassign
}) => {
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [selectedRole, setSelectedRole] = useState<CaseAssignmentRole>('Supporting Officer');
  const [selectedAccess, setSelectedAccess] = useState<CaseAccessLevel>('Investigation Contributor');

  // Reassign form state
  const [reassignTo, setReassignTo] = useState('');
  const [reassignReason, setReassignReason] = useState<string>('Transfer / Workload');
  const [reassignNote, setReassignNote] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const assignments = caseFile.caseAssignments || [];
  const activeAssignments = assignments.filter(a => a.status === 'Active');
  const removedAssignments = assignments.filter(a => a.status === 'Removed');

  const leadInvestigator = activeAssignments.find(a => a.assignmentRole === 'Lead Investigator');
  const supportingOfficers = activeAssignments.filter(a => a.assignmentRole !== 'Lead Investigator');

  const canManage = canReassignCase(session, caseFile);

  const effectiveOfficers: OfficerProfile[] = (stationOfficers && stationOfficers.length > 0)
    ? stationOfficers
    : getStoredMembers().filter(m => m.role === 'POLICE').map(m => ({
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
        currentWorkload: 'Optimal',
        status: 'ACTIVE_ON_DUTY' as any,
        email: m.email || `${m.username}@casevault.gov.in`,
      }));

  // Only police officers not already assigned
  const availableOfficers = effectiveOfficers.filter(
    o => !activeAssignments.some(a => a.userId === o.badgeNo)
      && (o.role === 'POLICE' || (o.role as string) === 'OFFICER' || (o.role as string) === 'PI')
      && !['forensic', 'prosecutor', 'scientist', 'auditor', 'jail'].some(term => (o.rank || '').toLowerCase().includes(term))
  );

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficer) return;
    soundEffects.playStamp();
    const officer = effectiveOfficers.find(o => o.badgeNo === selectedOfficer);
    if (!officer) return;

    const newAssignment: CaseAssignment = {
      assignmentId: `ASGN-${caseFile.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
      caseId: caseFile.id,
      userId: officer.badgeNo,
      officerName: officer.name,
      officerRank: officer.rank,
      assignmentRole: selectedRole,
      assignedBy: session.badgeNo,
      assignedByName: session.officerName,
      assignedAt: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
      accessLevel: selectedAccess,
      status: 'Active'
    };

    const updatedCase: CaseFile = {
      ...caseFile,
      caseAssignments: [...(caseFile.caseAssignments || []), newAssignment],
      timeline: [
        ...(caseFile.timeline || []),
        {
          id: `TL-ASSIGN-${Date.now()}`,
          date: generateCurrentDocketTimestamp(),
          title: 'Case Member Added',
          description: `${officer.name} (${selectedRole}) added to case team by ${session.officerName}.`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'ASSIGNMENT'
        }
      ]
    };

    onUpdateCase(updatedCase, 'CASE_ASSIGNED', `${officer.name} assigned as ${selectedRole}`);
    setIsAddMemberOpen(false);
    setSelectedOfficer('');
  };

  const handleRemoveMember = (assignment: CaseAssignment) => {
    soundEffects.playSnap();
    const updatedAssignments = (caseFile.caseAssignments || []).map(a =>
      a.assignmentId === assignment.assignmentId
        ? {
            ...a,
            status: 'Removed' as const,
            removedAt: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST',
            removedBy: session.badgeNo,
            removedByName: session.officerName,
            removalReason: `Access revoked by ${session.officerName}`
          }
        : a
    );
    const updatedCase: CaseFile = {
      ...caseFile,
      caseAssignments: updatedAssignments,
      timeline: [
        ...(caseFile.timeline || []),
        {
          id: `TL-REMOVE-${Date.now()}`,
          date: generateCurrentDocketTimestamp(),
          title: 'Case Member Removed',
          description: `${assignment.officerName} removed from case team. Access revoked by ${session.officerName}.`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'ACCESS_REVOKED'
        }
      ]
    };
    onUpdateCase(updatedCase, 'ACCESS_REVOKED', `${assignment.officerName} removed from case ${caseFile.id}`);
  };

  const handleReassignLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTo || !leadInvestigator) return;
    soundEffects.playStamp();

    const newOfficer = effectiveOfficers.find(o => o.badgeNo === reassignTo);
    if (!newOfficer) return;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST';
    const nowDate = new Date().toISOString().substring(0, 10);

    const updatedAssignments: CaseAssignment[] = (caseFile.caseAssignments || []).map(a =>
      a.assignmentId === leadInvestigator.assignmentId
        ? {
            ...a,
            status: 'Removed' as const,
            removedAt: now,
            removedBy: session.badgeNo,
            removedByName: session.officerName,
            removalReason: `${reassignReason}. ${reassignNote}`
          }
        : a
    );

    const newAssignment: CaseAssignment = {
      assignmentId: `ASGN-${caseFile.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
      caseId: caseFile.id,
      userId: newOfficer.badgeNo,
      officerName: newOfficer.name,
      officerRank: newOfficer.rank,
      assignmentRole: 'Lead Investigator',
      assignedBy: session.badgeNo,
      assignedByName: session.officerName,
      assignedAt: now,
      accessLevel: 'Full Case Team Access',
      status: 'Active'
    };

    const updatedCase: CaseFile = {
      ...caseFile,
      officers: {
        ...caseFile.officers,
        assignedIO: newOfficer.name,
        assignedIOBadge: newOfficer.badgeNo
      },
      caseAssignments: [...updatedAssignments, newAssignment],
      timeline: [
        ...(caseFile.timeline || []),
        {
          id: `TL-REASSIGN-${Date.now()}`,
          date: generateCurrentDocketTimestamp(),
          title: 'Case Reassignment',
          description: `Lead Investigator changed: ${leadInvestigator.officerName} → ${newOfficer.name}. Reason: ${reassignReason}. ${reassignNote}. Former officer's active case access revoked. New investigator's access granted.`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'REASSIGNMENT'
        }
      ]
    };

    onUpdateCase(
      updatedCase,
      'CASE_REASSIGNED',
      `Lead IO changed from ${leadInvestigator.officerName} to ${newOfficer.name}. Reason: ${reassignReason}`
    );

    // Synchronize reassignment with backend & blockchain event chain
    apiClient.changeInvestigatingOfficer(caseFile.id, {
      newOfficerBadge: newOfficer.badgeNo,
      newOfficerName: newOfficer.name,
      reason: `${reassignReason}: ${reassignNote}`.trim(),
      revokeTemporaryGrants: true,
    }).catch(err => {
      console.warn('[BACKEND_REASSIGN_SYNC_WARN]', err);
    });

    setIsReassignOpen(false);
    setIsConfirming(false);
    setReassignTo('');
    setReassignNote('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#182f4d]" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Case Team</span>
          <span className="px-1.5 py-0.5 bg-[#182f4d]/10 text-[#182f4d] text-[10px] font-bold rounded">
            {activeAssignments.length} Active
          </span>
        </div>
        {canManage && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white text-[11px] font-semibold rounded-lg hover:bg-emerald-700 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add Member
            </button>
            {leadInvestigator && (
              <button
                onClick={() => setIsReassignOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white text-[11px] font-semibold rounded-lg hover:bg-amber-700 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reassign Lead
              </button>
            )}
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100">
        {/* Lead Investigator */}
        {leadInvestigator ? (
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#182f4d] flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-900">{leadInvestigator.officerName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-[#182f4d] font-semibold bg-[#182f4d]/10 px-1.5 py-0.5 rounded">
                  {leadInvestigator.assignmentRole}
                </span>
                <span className="text-[10px] text-slate-500">Assigned: {leadInvestigator.assignedAt}</span>
              </div>
            </div>
            <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full border border-emerald-200">
              Active
            </span>
          </div>
        ) : (
          <div className="px-4 py-3 flex items-center gap-3 bg-amber-50">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-xs text-amber-800 font-semibold">No Lead Investigator assigned</p>
          </div>
        )}

        {/* Supporting Officers */}
        {supportingOfficers.map(a => (
          <div key={a.assignmentId} className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 text-slate-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-800">{a.officerName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-600 font-semibold bg-slate-100 px-1.5 py-0.5 rounded">
                  {a.assignmentRole}
                </span>
                <span className="text-[10px] text-slate-400">Assigned: {a.assignedAt}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-800 font-semibold rounded-full border border-emerald-200">
                Active
              </span>
              {canManage && (
                <button
                  onClick={() => handleRemoveMember(a)}
                  className="text-red-400 hover:text-red-600 cursor-pointer"
                  title="Remove member"
                >
                  <UserX className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Historical removed assignments (collapsed) */}
        {removedAssignments.length > 0 && (
          <div className="px-4 py-2 bg-slate-50">
            <p className="text-[10px] text-slate-400 font-semibold uppercase">
              {removedAssignments.length} former member(s) — history preserved
            </p>
          </div>
        )}
        {removedAssignments.map(a => (
          <div key={a.assignmentId} className="px-4 py-2.5 flex items-center gap-3 opacity-60">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
              <UserX className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-500 line-through">{a.officerName}</p>
              <p className="text-[10px] text-slate-400">Removed: {a.removedAt} — {a.removalReason}</p>
            </div>
            <span className="text-[10px] px-2 py-1 bg-slate-100 text-slate-500 font-semibold rounded-full">
              Removed
            </span>
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      <AnimatePresence>
        {isAddMemberOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Add Officer to Case</h3>
                <button onClick={() => setIsAddMemberOpen(false)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddMember} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Select Police Officer</label>
                  <select value={selectedOfficer} onChange={e => setSelectedOfficer(e.target.value)} required
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none">
                    <option value="">— Select Police Officer —</option>
                    {availableOfficers.map(o => (
                      <option key={o.badgeNo} value={o.badgeNo}>{o.name} ({o.rank}) — {o.badgeNo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Role in Case</label>
                  <select value={selectedRole} onChange={e => setSelectedRole(e.target.value as CaseAssignmentRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none">
                    {(['Supporting Officer', 'Evidence Officer', 'Supervisory Review'] as CaseAssignmentRole[]).map(r => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Access Level</label>
                  <select value={selectedAccess} onChange={e => setSelectedAccess(e.target.value as CaseAccessLevel)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none">
                    {(['Investigation Contributor', 'Evidence Contributor', 'View Only', 'View Case Summary'] as CaseAccessLevel[]).map(l => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button type="button" onClick={() => setIsAddMemberOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
                  <button type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-[#182f4d] rounded-lg cursor-pointer">Add Officer</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reassign Lead Modal */}
      <AnimatePresence>
        {isReassignOpen && leadInvestigator && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl border border-amber-200 shadow-2xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Change Lead Officer</h3>
                </div>
                <button onClick={() => { setIsReassignOpen(false); setIsConfirming(false); }} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              {!isConfirming ? (
                <form onSubmit={e => { e.preventDefault(); setIsConfirming(true); }} className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                    <div>
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">Current Lead Officer</p>
                      <p className="text-sm font-bold text-slate-900">{leadInvestigator.officerName}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400 mx-2" />
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-500 font-semibold uppercase">Assign To</p>
                      <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} required
                        className="w-full mt-0.5 px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-amber-400 outline-none">
                        <option value="">— Select Police Officer —</option>
                        {availableOfficers.map(o => (
                          <option key={o.badgeNo} value={o.badgeNo}>{o.name} ({o.badgeNo})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Reason *</label>
                    <select value={reassignReason} onChange={e => setReassignReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-amber-400 outline-none">
                      {['Transfer / Workload', 'Medical Leave', 'Conflict of Interest', 'Disciplinary Action', 'Officer Promotion', 'Other'].map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Detailed Note</label>
                    <textarea rows={2} value={reassignNote} onChange={e => setReassignNote(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-amber-400 resize-none"
                      placeholder="Optional additional details for the audit record..." />
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Revoke former investigator's case access immediately</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Preserve old investigator's activity history</div>
                    <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Notify both officers</div>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={() => setIsReassignOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-lg cursor-pointer">Review & Confirm</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleReassignLead} className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-red-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Confirm Reassignment
                    </p>
                    <p className="text-xs text-red-700">
                      <strong>{leadInvestigator.officerName}</strong> will immediately lose active access to Case {caseFile.id}. Their past activity history will be preserved. The new officer will receive full investigator access.
                    </p>
                    <div className="text-xs font-semibold text-red-800">Reason: {reassignReason}</div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setIsConfirming(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer">Back</button>
                    <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg cursor-pointer">Confirm Reassignment</button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
