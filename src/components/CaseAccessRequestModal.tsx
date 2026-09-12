import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FolderLock,
  AlertTriangle,
  Send,
  Clock,
  CheckCircle2,
  X,
  FileText,
  Shield
} from 'lucide-react';
import { CaseFile, UserSession, CaseAccessRequest, AccessRequestPurpose, CaseAccessLevel } from '../types';
import { soundEffects } from './AudioEffects';

interface CaseAccessRequestModalProps {
  caseFile: CaseFile;
  session: UserSession;
  onClose: () => void;
  onSubmitRequest: (request: CaseAccessRequest) => void;
}

export const CaseAccessRequestModal: React.FC<CaseAccessRequestModalProps> = ({
  caseFile,
  session,
  onClose,
  onSubmitRequest
}) => {
  const [purpose, setPurpose] = useState<AccessRequestPurpose>('Related Investigation');
  const [reason, setReason] = useState('');
  const [accessLevel, setAccessLevel] = useState<CaseAccessLevel>('View Only');
  const [durationDays, setDurationDays] = useState<7 | 14 | 30>(7);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    soundEffects.playStamp();

    const requestId = `REQ-${caseFile.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
    const newRequest: CaseAccessRequest = {
      requestId,
      caseId: caseFile.id,
      requestedByUserId: session.badgeNo,
      requestedByName: session.officerName,
      requestedByRank: session.rank,
      requestedByStation: session.station,
      purpose,
      reason,
      requestedAccessLevel: accessLevel,
      requestedDurationDays: durationDays,
      status: 'Pending',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' IST'
    };

    onSubmitRequest(newRequest);
    setSubmittedRequestId(requestId);
    setIsSubmitted(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {!isSubmitted ? (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <FolderLock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Request Case Access</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{caseFile.id}</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Restricted notice */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-red-800">Restricted Case</p>
                  <p className="text-xs text-red-700 mt-1">
                    You do not have active access to Case <strong>{caseFile.id}</strong>. 
                    Submit a formal access request. A senior authority (PI / DySP / SP) will review and approve or reject your request.
                  </p>
                </div>
              </div>

              {/* Request info */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Requested Case</span>
                  <span className="font-mono font-bold text-[#182f4d]">{caseFile.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Requesting Officer</span>
                  <span className="font-semibold">{session.officerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Current Station</span>
                  <span className="text-slate-700">{session.station}</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purpose of Access *
                  </label>
                  <select
                    value={purpose}
                    onChange={e => setPurpose(e.target.value as AccessRequestPurpose)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none"
                  >
                    {([
                      'Related Investigation',
                      'Supervisory Review',
                      'Evidence Cross-Reference',
                      'Witness Coordination',
                      'Legal / Prosecution Support',
                      'Other Official Duty'
                    ] as AccessRequestPurpose[]).map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Reason / Justification *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Describe the official investigative reason for requiring access to this case..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-[#182f4d] outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Requested Access Level
                    </label>
                    <select
                      value={accessLevel}
                      onChange={e => setAccessLevel(e.target.value as CaseAccessLevel)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none"
                    >
                      {([
                        'View Case Summary',
                        'View Only',
                        'Investigation Contributor',
                        'Evidence Contributor'
                      ] as CaseAccessLevel[]).map(l => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Access Duration
                    </label>
                    <select
                      value={durationDays}
                      onChange={e => setDurationDays(parseInt(e.target.value) as 7 | 14 | 30)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] outline-none"
                    >
                      <option value={7}>7 Days</option>
                      <option value={14}>14 Days</option>
                      <option value={30}>30 Days</option>
                    </select>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>Your request will be sent to the Station PI, Supervisory DySP, or SP as appropriate. You will be notified when the request is reviewed. All details are recorded in the audit log.</p>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!reason.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#182f4d] rounded-lg hover:bg-[#11233b] cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Request Submitted</h3>
              <p className="text-xs text-slate-500 mt-1">Your access request has been forwarded to the approving authority</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Request ID</span>
                <span className="font-mono font-bold text-[#182f4d]">{submittedRequestId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Status</span>
                <span className="flex items-center gap-1 text-amber-700 font-semibold">
                  <Clock className="w-3 h-3" /> Pending Review
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Access Requested</span>
                <span>{accessLevel} — {durationDays} days</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-[#182f4d] text-white text-sm font-bold rounded-xl hover:bg-[#11233b] cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
