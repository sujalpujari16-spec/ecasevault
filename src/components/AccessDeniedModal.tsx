import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Lock, ArrowLeft, AlertTriangle } from 'lucide-react';
import { UserSession, CaseFile } from '../types';

interface AccessDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
  targetCase: CaseFile | null;
}

export const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
  isOpen,
  onClose,
  session,
  targetCase,
}) => {
  if (!isOpen || !targetCase) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="bg-slate-900 border-2 border-red-500/80 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-white"
        >
          {/* Top Red Security Flasher Header */}
          <div className="bg-gradient-to-r from-red-900 via-red-800 to-slate-900 px-6 py-4 border-b border-red-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/60 flex items-center justify-center text-red-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-100 tracking-wide uppercase">
                  Access Denied • RBAC Enforced
                </h3>
                <p className="text-[11px] font-mono text-red-300/90">
                  Security Code: ERR_403_STATION_JURISDICTION_RESTRICTION
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-red-950/80 border border-red-500/60 text-red-300 text-[10px] font-bold rounded-md uppercase font-mono">
              Restricted
            </span>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4" />
                <span>Unauthorized Cross-Jurisdiction Docket Access</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Officer <strong className="text-white">{session.officerName}</strong> ({session.badgeNo}) does not have territorial or security clearance to inspect this case docket.
              </p>
            </div>

            {/* Target Case Details */}
            <div className="space-y-2 text-xs border border-slate-800 rounded-xl p-3.5 bg-slate-950/60">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Requested Case ID:</span>
                <span className="font-mono font-bold text-amber-300">{targetCase.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Restricted Station:</span>
                <span className="font-semibold text-slate-200">{targetCase.policeStation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Your Station Assignment:</span>
                <span className="font-semibold text-blue-300">{session.station}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Required Clearance Tier:</span>
                <span className="font-bold text-red-400">SUPERINTENDENT (SP) / ATS CELL</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 italic">
              *All unauthorized attempts to query confidential dockets outside assigned police stations are logged to the immutable cryptographically sealed audit ledger.
            </p>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Authorized Jurisdiction</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
