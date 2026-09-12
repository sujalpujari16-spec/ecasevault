import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MaharashtraPoliceEmblem } from './Emblem';
import { soundEffects } from './AudioEffects';
import { CaseFile } from '../types';
import { Fingerprint, CheckCircle2, ShieldCheck, X, ArrowLeft, ArrowRight, Printer, Sparkles } from 'lucide-react';

interface Case3DReaderModalProps {
  caseItem: CaseFile;
  onClose: () => void;
}

export const Case3DReaderModal: React.FC<Case3DReaderModalProps> = ({
  caseItem,
  onClose,
}) => {
  const [currentPage, setCurrentPage] = useState<number>(0); // 0: Cover & Suspect / FIR, 1: Forensics & Evidence, 2: Chain of Custody & Court Panchnama
  const [isCoverClosed, setIsCoverClosed] = useState<boolean>(false);

  const flipPage = (direction: 'next' | 'prev') => {
    soundEffects.playPageFlip();
    if (direction === 'next') {
      setCurrentPage((prev) => Math.min(prev + 1, 2));
    } else {
      setCurrentPage((prev) => Math.max(prev - 1, 0));
    }
  };

  const toggleCover = () => {
    soundEffects.playSnap();
    setIsCoverClosed(!isCoverClosed);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 select-none">
      {/* Top Bar with Navigation Controls */}
      <div className="w-full max-w-4xl flex items-center justify-between text-white mb-3 px-2">
        <div className="flex items-center gap-2">
          <MaharashtraPoliceEmblem size={24} variant="gold" />
          <span className="text-xs sm:text-sm font-bold font-cinzel">
            MAHARASHTRA POLICE • 3D CASE DIARY ({caseItem.id})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleCover}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-md border border-slate-600 transition-colors"
          >
            {isCoverClosed ? 'Open Diary' : 'Close Leather Cover'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 bg-red-900/70 hover:bg-red-800 text-white rounded-md transition-colors"
            title="Close 3D Viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3D Journal Container */}
      <div className="relative perspective-1000 w-full max-w-4xl min-h-[460px] flex items-center justify-center">
        {isCoverClosed ? (
          /* ================= CLOSED LEATHER BINDER ================= */
          <motion.div
            initial={{ rotateY: -45, scale: 0.9 }}
            animate={{ rotateY: 0, scale: 1 }}
            onClick={toggleCover}
            className="relative w-[300px] h-[400px] leather-dark rounded-r-2xl rounded-l-md p-5 border border-slate-700 shadow-2xl flex flex-col items-center justify-between cursor-pointer group"
          >
            <div className="absolute inset-3 rounded-r-xl rounded-l-sm leather-stitch pointer-events-none" />
            <div className="absolute left-0 top-0 bottom-0 w-5 bg-gradient-to-r from-slate-950 via-slate-900 to-transparent rounded-l-md" />

            <div className="my-auto flex flex-col items-center text-center">
              <MaharashtraPoliceEmblem size={140} embossed={true} variant="silver" showBackground={false} />
              <div className="mt-4">
                <span className="text-[10px] text-amber-400/90 font-mono-code tracking-widest uppercase block">
                  {caseItem.firNumber}
                </span>
                <h3 className="text-sm font-bold text-slate-100 mt-1 font-cinzel">
                  {caseItem.caseTitle}
                </h3>
              </div>
            </div>

            {/* Clasp */}
            <div className="absolute -right-8 top-1/2 -translate-y-1/2">
              <div className="w-10 h-8 leather-dark rounded-r-full border border-slate-600 shadow flex items-center justify-center pl-1">
                <div className="w-4 h-4 rounded-full bg-slate-300 border border-slate-500 shadow-inner" />
              </div>
            </div>

            <span className="text-[11px] text-stone-400 group-hover:text-white transition-colors">
              Click to Open Diary →
            </span>
          </motion.div>
        ) : (
          /* ================= OPEN 3D DUAL-PAGE BOOK ================= */
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-3xl h-[480px] bg-[#162232] rounded-2xl p-3 shadow-2xl border border-slate-700 flex transform-style-3d"
          >
            {/* Left colored tabs */}
            <div className="absolute -left-4 top-10 flex flex-col gap-3 z-30">
              <button
                onClick={() => {
                  soundEffects.playPageFlip();
                  setCurrentPage(0);
                }}
                className={`w-5 h-10 rounded-l shadow-md border-y border-l text-[9px] font-bold transition-all flex items-center justify-center ${
                  currentPage === 0
                    ? 'bg-amber-400 text-amber-950 border-amber-600 scale-105'
                    : 'bg-amber-600 text-amber-100 border-amber-800'
                }`}
              >
                <span className="-rotate-90">FIR</span>
              </button>
              <button
                onClick={() => {
                  soundEffects.playPageFlip();
                  setCurrentPage(1);
                }}
                className={`w-5 h-10 rounded-l shadow-md border-y border-l text-[9px] font-bold transition-all flex items-center justify-center ${
                  currentPage === 1
                    ? 'bg-cyan-400 text-cyan-950 border-cyan-600 scale-105'
                    : 'bg-cyan-700 text-cyan-100 border-cyan-900'
                }`}
              >
                <span className="-rotate-90">FSL</span>
              </button>
              <button
                onClick={() => {
                  soundEffects.playPageFlip();
                  setCurrentPage(2);
                }}
                className={`w-5 h-10 rounded-l shadow-md border-y border-l text-[9px] font-bold transition-all flex items-center justify-center ${
                  currentPage === 2
                    ? 'bg-blue-400 text-blue-950 border-blue-600 scale-105'
                    : 'bg-blue-700 text-blue-100 border-blue-900'
                }`}
              >
                <span className="-rotate-90">EVD</span>
              </button>
            </div>

            {/* Central Spine Rings */}
            <div className="absolute left-1/2 top-4 bottom-4 -translate-x-1/2 w-4 z-40 flex flex-col justify-around items-center pointer-events-none">
              <div className="w-3 h-6 rounded-full border-2 border-slate-300 bg-gradient-to-r from-slate-200 to-slate-400 shadow-md" />
              <div className="w-3 h-6 rounded-full border-2 border-slate-300 bg-gradient-to-r from-slate-200 to-slate-400 shadow-md" />
              <div className="w-3 h-6 rounded-full border-2 border-slate-300 bg-gradient-to-r from-slate-200 to-slate-400 shadow-md" />
            </div>

            {/* LEFT BOOK PAGE */}
            <div className="w-1/2 h-full bg-[#fcfbf7] rounded-l-lg p-5 flex flex-col justify-between border-r border-stone-300 shadow-inner overflow-hidden relative">
              {/* Header */}
              <div className="border-b border-stone-300 pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 font-mono-code">
                    {currentPage === 0
                      ? 'FORENSIC REPORT & DOSSIER'
                      : currentPage === 1
                      ? 'FSL LAB BALLISTICS & DNA'
                      : 'COURT PANCHNAMA LOG'}
                  </span>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 border border-red-300 rounded font-mono-code">
                    {caseItem.id}
                  </span>
                </div>
                <span className="text-[9px] text-stone-500 block mt-0.5">
                  MAHARASHTRA POLICE • {caseItem.policeStation}
                </span>
              </div>

              {/* Dynamic Page Content */}
              {currentPage === 0 ? (
                /* Suspect Photo & Profile (Case 049 layout) */
                <div className="space-y-3 my-auto">
                  <div className="bg-stone-100 p-2.5 rounded-lg border border-stone-300 shadow-xs flex gap-3 items-start">
                    <div className="relative shrink-0">
                      <div className="w-20 h-24 bg-slate-800 rounded border border-stone-400 overflow-hidden relative shadow">
                        <img
                          src={caseItem.suspects?.[0]?.photoUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80'}
                          alt={caseItem.suspects?.[0]?.name || 'Suspect'}
                          className="w-full h-full object-cover filter grayscale contrast-125"
                        />
                        <div className="absolute top-1 left-0 bg-red-600 text-white font-extrabold text-[9px] px-1.5 py-0.2 tracking-wider shadow">
                          {caseItem.suspects?.[0]?.tag || 'PRIMARY'}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 text-[10px] space-y-1 text-slate-700">
                      <div>
                        <span className="text-stone-400 block text-[8px]">SUSPECT:</span>
                        <strong className="text-slate-900 font-bold text-xs">
                          {caseItem.suspects?.[0]?.name || 'Unidentified Suspect'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-stone-400 text-[8px]">ALIAS: </span>
                        <span className="font-semibold text-slate-800">
                          {caseItem.suspects?.[0]?.alias || 'Unknown'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 text-[8px]">STATUS: </span>
                        <span className="text-amber-800 font-bold">
                          {caseItem.suspects?.[0]?.custodyStatus || 'Under Investigation'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-stone-50 p-2 rounded border border-stone-200 text-[10px] text-slate-700">
                    <span className="text-stone-400 text-[8px] block uppercase font-bold">
                      INCIDENT CASE TITLE:
                    </span>
                    <p className="font-semibold text-slate-900 text-[11px] leading-snug">
                      {caseItem.caseTitle}
                    </p>
                  </div>
                </div>
              ) : currentPage === 1 ? (
                /* Lab findings */
                <div className="space-y-2.5 my-auto text-[10px] text-slate-700">
                  <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                    <strong className="text-slate-900 block text-[11px] font-bold mb-0.5">
                      DNA Profiling & Biometric Verification
                    </strong>
                    <p className="text-emerald-800 font-medium">
                      {caseItem.forensicRequests?.[0]?.dnaMatchRate || '99.98% Biometric Match Confidence'}
                    </p>
                  </div>

                  <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                    <strong className="text-slate-900 block text-[11px] font-bold mb-0.5">
                      Ballistics & Material Findings
                    </strong>
                    <p className="text-slate-800">
                      {caseItem.forensicRequests?.[0]?.findings || 'CCTV timestamps & digital storage units cataloged into digital evidence locker.'}
                    </p>
                  </div>
                </div>
              ) : (
                /* Panchnama & Custody */
                <div className="space-y-2.5 my-auto text-[10px] text-slate-700">
                  <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                    <strong className="text-slate-900 block text-[11px] font-bold mb-0.5">
                      Investigating Officer Seal
                    </strong>
                    <p className="text-slate-800">
                      {caseItem.officers?.assignedIO || 'PSI R. Deshmukh'} ({caseItem.officers?.assignedIOBadge || 'MH-PSI-4910'})
                    </p>
                  </div>
                  <div className="bg-stone-50 p-2.5 rounded border border-stone-200">
                    <strong className="text-slate-900 block text-[11px] font-bold mb-0.5">
                      Summary Case Notes
                    </strong>
                    <p className="text-slate-800 leading-relaxed">
                      {caseItem.summaryNotes}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom Fingerprint & Signature Block */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-300">
                <div className="flex items-center gap-1.5">
                  <Fingerprint className="w-6 h-6 text-slate-700" />
                  <div className="text-[8px] text-stone-500 leading-tight">
                    <span>FP CLASSIFICATION:</span>
                    <strong className="block text-slate-800 font-mono-code">
                      {caseItem.suspects?.[0]?.fingerprintClass || 'Whorl-Loop Archetype #A98'}
                    </strong>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-serif italic text-xs text-blue-900 font-bold">
                    Sdr. {(caseItem.suspects?.[0]?.name || 'Witness').split(' ')[0]}
                  </div>
                  <div className="text-[7.5px] text-stone-400 uppercase">
                    Official Panchnama Sign
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT BOOK PAGE */}
            <div className="w-1/2 h-full bg-[#fcfbf7] rounded-r-lg p-5 flex flex-col justify-between shadow-inner overflow-hidden relative">
              {/* Evidence Verified Rubber Stamp */}
              <div className="absolute right-4 top-4 border-2 border-red-600/60 rounded px-2 py-0.5 rotate-6 text-red-600 font-extrabold text-[9px] tracking-wider uppercase opacity-85 pointer-events-none">
                EVIDENCE VERIFIED
              </div>

              <div>
                <div className="flex items-center justify-between border-b border-stone-300 pb-2">
                  <span className="text-[11px] font-bold text-slate-800 font-mono-code uppercase">
                    EVIDENCE VAULT LOG
                  </span>
                  <span className="text-[9px] text-stone-400 font-mono-code">
                    PAGE {currentPage + 1}/3
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-[10px] text-slate-700">
                  {caseItem.evidenceItems.map((evd, idx) => (
                    <div key={idx} className="bg-stone-50 p-2.5 rounded border border-stone-200">
                      <div className="flex items-center justify-between mb-0.5">
                        <strong className="text-slate-900 font-bold text-[10.5px]">
                          [{evd.evidenceTag}] {evd.description}
                        </strong>
                      </div>
                      <p className="text-stone-500 text-[9px]">
                        Locker: {evd.storageLocker}
                      </p>
                      <p className="text-[9px] text-emerald-800 font-medium mt-0.5">
                        Status: {evd.status} ({evd.currentCustodian})
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Navigation on Page */}
              <div className="border-t border-stone-300 pt-2 flex items-center justify-between">
                <button
                  disabled={currentPage === 0}
                  onClick={() => flipPage('prev')}
                  className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 disabled:opacity-40 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3 h-3" /> Prev Page
                </button>

                <span className="text-[8px] text-emerald-700 font-mono-code font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  HASH #7F49B-SECURE
                </span>

                <button
                  disabled={currentPage === 2}
                  onClick={() => flipPage('next')}
                  className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 disabled:opacity-40 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  Next Page <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
