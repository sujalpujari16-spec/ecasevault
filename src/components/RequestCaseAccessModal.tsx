import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Clock,
  KeyRound,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  Send,
  Lock,
  Building2,
  Sparkles
} from 'lucide-react';
import { CaseFile, UserSession } from '../types';
import { apiClient } from '../services/apiClient';
import { soundEffects } from './AudioEffects';

interface RequestCaseAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseItem: CaseFile;
  session: UserSession;
  onRequestSubmitted?: (requestId: string, details: any) => void;
}

export const RequestCaseAccessModal: React.FC<RequestCaseAccessModalProps> = ({
  isOpen,
  onClose,
  caseItem,
  session,
  onRequestSubmitted,
}) => {
  const [reason, setReason] = useState('');
  const [clearanceRequested, setClearanceRequested] = useState<'CONFIDENTIAL' | 'RESTRICTED' | 'SECRET'>('CONFIDENTIAL');
  const [durationHours, setDurationHours] = useState<number>(24);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    requestId: string;
    blockchainTxId?: string;
    eventHash?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Please state the operational justification for requesting access.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    soundEffects.playStamp();

    try {
      const res = await apiClient.requestCaseAccess({
        caseId: caseItem.id,
        reason: reason.trim(),
        clearanceRequested,
        requestedDurationHours: durationHours,
      });

      if (res && res.success) {
        setSuccessInfo({
          requestId: res.requestId,
          blockchainTxId: res.blockchainTxId,
          eventHash: res.eventHash,
        });
        if (onRequestSubmitted) {
          onRequestSubmitted(res.requestId, res);
        }
      } else {
        throw new Error(res?.error || 'Failed to submit access request');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error submitting access request to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setErrorMessage(null);
    setSuccessInfo(null);
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
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Request Cross-Station Case Access
              </h3>
              <p className="text-xs text-slate-400">
                Case: <span className="font-mono text-amber-300 font-semibold">{caseItem.firNumber || caseItem.id}</span>
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
          {successInfo ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 border border-emerald-300 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Access Request Logged</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                  Your request has been registered and forwarded to Station Command & Admin for security clearance.
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-left space-y-2 font-mono text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Request ID:</span>
                  <span className="font-bold text-slate-900">{successInfo.requestId}</span>
                </div>
                {successInfo.blockchainTxId && (
                  <div className="flex justify-between text-slate-600 truncate">
                    <span>Blockchain Tx:</span>
                    <span className="font-bold text-blue-700 truncate max-w-[200px]" title={successInfo.blockchainTxId}>
                      {successInfo.blockchainTxId}
                    </span>
                  </div>
                )}
                {successInfo.eventHash && (
                  <div className="flex justify-between text-slate-600 truncate">
                    <span>Tamper Hash:</span>
                    <span className="font-bold text-purple-700 truncate max-w-[200px]" title={successInfo.eventHash}>
                      {successInfo.eventHash.slice(0, 16)}...
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 px-4 bg-[#182f4d] text-white text-xs font-bold rounded-xl hover:bg-[#182f4d]/90 shadow transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Security Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Strict Default Deny Enforced:</span> You do not currently hold active IO assignment or clearance on this docket. An administrative approval will grant time-bounded read clearance.
                </div>
              </div>

              {/* Case Summary Pill */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Case Title:</span>
                  <span className="font-semibold text-slate-800">{caseItem.caseTitle}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Police Station:</span>
                  <span className="font-medium text-slate-700">{caseItem.policeStation || 'Station Command'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Active IO:</span>
                  <span className="font-medium text-slate-700">
                    {caseItem.officers?.assignedIO || caseItem.investigating_officer_id || 'Unassigned'}
                  </span>
                </div>
              </div>

              {/* Clearance Level */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Requested Clearance Level
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CONFIDENTIAL', 'RESTRICTED', 'SECRET'] as const).map(lvl => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setClearanceRequested(lvl)}
                      className={`py-2 px-2.5 rounded-lg border text-xs font-bold transition-all text-center ${
                        clearanceRequested === lvl
                          ? 'border-blue-600 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration in Hours */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Requested Duration</span>
                  <span className="font-mono text-blue-600 font-bold">{durationHours} Hours ({Math.round(durationHours / 24)} Day{durationHours >= 48 ? 's' : ''})</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[12, 24, 48, 72].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setDurationHours(h)}
                      className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                        durationHours === h
                          ? 'border-[#182f4d] bg-[#182f4d] text-white font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Justification / Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Operational Justification / Ground for Access <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="E.g., Inter-station linked gang robbery investigation; verifying accused fingerprint records across jurisdiction."
                  className="w-full text-xs p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden resize-none"
                />
              </div>

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
                  disabled={isSubmitting || !reason.trim()}
                  className="py-2 px-4 bg-[#182f4d] hover:bg-[#182f4d]/90 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      Submit Access Request
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
