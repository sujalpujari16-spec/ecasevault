import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MaharashtraPoliceEmblem } from './Emblem';
import { soundEffects } from './AudioEffects';
import { Fingerprint, CheckCircle2, RotateCcw, Volume2, VolumeX, ShieldCheck, Sparkles, BookOpen, Lock } from 'lucide-react';

interface Diary3DAnimationProps {
  onAnimationComplete?: () => void;
  isInteractiveMode?: boolean;
  onOpenCaseDetail?: () => void;
}

export const Diary3DAnimation: React.FC<Diary3DAnimationProps> = ({
  onAnimationComplete,
  isInteractiveMode = false,
  onOpenCaseDetail,
}) => {
  // Animation Phases:
  // 0: Tilted closed binder (0:00)
  // 1: Unclasp & open binder with flipping pages & forensic report (0:01)
  // 2: Close and move to center with Title & Embossed Emblem (0:02)
  // 3: Circular Telemetry Loading ring 20% -> 50% -> 75% -> 100% -> READY (0:03 - 0:05)
  // 4: Completed -> Ready for Login Transition (0:06)
  const [phase, setPhase] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isOpenManual, setIsOpenManual] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [pageIndex, setPageIndex] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimers = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  const startCinematicSequence = () => {
    clearAllTimers();
    setPhase(0);
    setProgressPercent(0);
    setIsOpenManual(false);
    setPageIndex(0);

    // Timeline matching video:
    // 0.4s: Open binder & flip pages
    const t1 = setTimeout(() => {
      setPhase(1);
      soundEffects.playSnap();
      soundEffects.playPageFlip();
    }, 450);

    // 1.8s: Flip to next page
    const t2 = setTimeout(() => {
      setPageIndex(1);
      soundEffects.playPageFlip();
    }, 1200);

    // 2.3s: Close binder and rotate to center
    const t3 = setTimeout(() => {
      setPhase(2);
      soundEffects.playSnap();
    }, 2300);

    // 2.9s: Start radial loading ring
    const t4 = setTimeout(() => {
      setPhase(3);
      setProgressPercent(20);
    }, 2900);

    const t5 = setTimeout(() => {
      setProgressPercent(50);
    }, 3600);

    const t6 = setTimeout(() => {
      setProgressPercent(75);
    }, 4300);

    const t7 = setTimeout(() => {
      setProgressPercent(100);
      soundEffects.playReadyChime();
    }, 5000);

    // 5.8s: Transition to Login Window
    const t8 = setTimeout(() => {
      setPhase(4);
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    }, 5800);

    timerRef.current = [t1, t2, t3, t4, t5, t6, t7, t8];
  };

  useEffect(() => {
    if (!isInteractiveMode) {
      startCinematicSequence();
    } else {
      setPhase(2);
      setProgressPercent(100);
    }
    return () => clearAllTimers();
  }, [isInteractiveMode]);

  const toggleManualOpen = () => {
    if (isOpenManual) {
      soundEffects.playSnap();
      setIsOpenManual(false);
    } else {
      soundEffects.playSnap();
      soundEffects.playPageFlip();
      setIsOpenManual(true);
    }
  };

  const handleNextPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEffects.playPageFlip();
    setPageIndex((prev) => (prev === 0 ? 1 : 0));
  };

  // Determine if book should be rendered open
  const isBookOpen = (phase === 1 && !isInteractiveMode) || isOpenManual;

  return (
    <div className="relative w-full h-screen min-h-screen flex flex-col justify-between items-center overflow-hidden bg-vault-stone py-6 sm:py-8 px-4 select-none">
      {/* Studio lighting background gradient */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 35% 25%, rgba(255,255,255,0.75) 0%, rgba(230,225,215,0.4) 50%, rgba(215,208,196,0.85) 100%)',
        }}
      />

      {/* Floating 4-Point Sparkle in bottom right corner (exact match to Screenshot 2) */}
      <div className="absolute bottom-8 right-12 opacity-70 pointer-events-none select-none z-10">
        <svg className="w-8 h-8 text-stone-400 fill-stone-300/60" viewBox="0 0 24 24">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
        </svg>
      </div>

      {/* Main Header Brand (Exact match to Screenshot 2) */}
      <div className="w-full flex flex-col items-center pt-2 sm:pt-4 z-20">
        <AnimatePresence>
          {(phase >= 2 || isInteractiveMode) && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="text-center"
            >
              <h2 className="text-xs sm:text-sm tracking-[0.25em] font-bold text-[#2d3748] uppercase mb-1 font-sans">
                MAHARASHTRA POLICE
              </h2>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] font-cinzel">
                e-CASEVAULT
              </h1>
              <p className="text-xs sm:text-sm text-[#4a5568] font-normal tracking-wide mt-1">
                Digital Case & Evidence Management System
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Central 3D Stage Area with Radial Telemetry Ring */}
      <div className="relative flex items-center justify-center perspective-1000 w-full max-w-lg min-h-[380px] my-auto py-4">
        {/* Circular Progress Ring Overlay (Exact match to Screenshot 2) */}
        <AnimatePresence>
          {phase >= 2 && !isBookOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="absolute w-[360px] h-[360px] sm:w-[420px] sm:h-[420px] pointer-events-none z-10 flex items-center justify-center"
            >
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
                {/* Background Ring */}
                <circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="#8e897e"
                  strokeWidth="2.8"
                  opacity="0.35"
                />

                {/* Animated Progress Arc */}
                <motion.circle
                  cx="100"
                  cy="100"
                  r="88"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 88}
                  initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
                  animate={{
                    strokeDashoffset:
                      2 * Math.PI * 88 - (progressPercent / 100) * (2 * Math.PI * 88),
                  }}
                  transition={{ duration: 0.7, ease: 'easeInOut' }}
                />

                {/* 100% milestone circle marker on track (Screenshot 2) */}
                <circle
                  cx="188"
                  cy="100"
                  r="4"
                  fill="#1e293b"
                />
              </svg>

              {/* Top Marker: READY text (Screenshot 2) */}
              <div className="absolute -top-3 text-[11px] font-bold text-[#2d3748] tracking-wider uppercase font-sans">
                READY
              </div>

              {/* Right Marker: 100% (Screenshot 2) */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-5 text-xs font-bold text-[#1e293b] font-sans">
                100%
              </div>

              {/* Bottom Marker: 75% (Screenshot 2) */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-3 text-xs font-bold text-[#1e293b] font-sans">
                75%
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======================================================== */}
        {/* 3D LEATHER BINDER COMPONENT */}
        {/* ======================================================== */}
        <motion.div
          animate={
            phase === 0
              ? {
                  rotateX: 25,
                  rotateY: -20,
                  rotateZ: -12,
                  scale: 0.95,
                  x: -30,
                  y: 10,
                }
              : phase === 1 || isBookOpen
              ? {
                  rotateX: 18,
                  rotateY: 0,
                  rotateZ: 0,
                  scale: 1.02,
                  x: 0,
                  y: -5,
                }
              : {
                  rotateX: 0,
                  rotateY: 0,
                  rotateZ: 0,
                  scale: 1,
                  x: 0,
                  y: 0,
                }
          }
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-20 cursor-pointer transform-style-3d select-none"
          onClick={toggleManualOpen}
          title="Click to Open/Close 3D Investigation Diary"
        >
          {/* Realistic Contact Shadow on White Studio Background */}
          <div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-[90%] h-12 bg-slate-950/20 blur-xl rounded-full transform pointer-events-none"
            style={{ transform: 'rotateX(60deg)' }}
          />

          {!isBookOpen ? (
            /* ================= CLOSED LEATHER BINDER ================= */
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="relative w-[240px] h-[310px] sm:w-[270px] sm:h-[345px] leather-dark rounded-r-2xl rounded-l-md p-3.5 border-t border-r border-b border-slate-700/60 shadow-2xl flex flex-col items-center justify-between"
            >
              {/* Outer Saddle Stitching Perimeter */}
              <div className="absolute inset-2.5 rounded-r-xl rounded-l-sm leather-stitch pointer-events-none" />

              {/* Leather Spine Ridge Detail on Left */}
              <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-950 via-slate-900 to-transparent rounded-l-md border-r border-slate-800/80" />

              {/* Embossed Maharashtra Police Emblem on Leather Cover */}
              <div className="my-auto flex flex-col items-center justify-center pt-2">
                <MaharashtraPoliceEmblem
                  size={128}
                  embossed={true}
                  variant="silver"
                  showBackground={false}
                  className="filter drop-shadow-lg"
                />
              </div>

              {/* Silver Leather Clasp Strap on Right Edge */}
              <div className="absolute -right-7 top-1/2 -translate-y-1/2 flex items-center">
                <div className="w-9 h-7 leather-dark rounded-r-full border-t border-r border-b border-slate-600 shadow-md flex items-center justify-center pl-1">
                  {/* Metal Snap Button */}
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-slate-200 via-slate-400 to-slate-600 shadow-inner flex items-center justify-center border border-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 shadow-inner" />
                  </div>
                </div>
              </div>

              {/* Bottom Spine Pages Edges Preview */}
              <div className="absolute bottom-1 right-5 left-5 h-2 bg-[#f4ebd0] rounded-b-sm border-t border-stone-400/50 shadow-inner opacity-70 flex justify-between px-1">
                <span className="w-2 h-full bg-amber-400 rounded-sm inline-block" />
                <span className="w-2 h-full bg-teal-500 rounded-sm inline-block" />
                <span className="w-2 h-full bg-blue-600 rounded-sm inline-block" />
              </div>
            </motion.div>
          ) : (
            /* ================= OPEN 3D BINDER WITH FORENSIC REPORT ================= */
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative w-[340px] sm:w-[480px] h-[340px] sm:h-[360px] flex bg-[#162232] rounded-xl p-2.5 shadow-2xl border border-slate-700/80 transform-style-3d"
            >
              {/* Saddle Stitching on outer case */}
              <div className="absolute inset-1.5 rounded-lg leather-stitch pointer-events-none" />

              {/* Left Colored Filing Tabs */}
              <div className="absolute -left-3.5 top-8 flex flex-col gap-3 z-30">
                <div className="w-4 h-8 bg-amber-400 rounded-l shadow-md border-y border-l border-amber-600 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-amber-950 -rotate-90">FIR</span>
                </div>
                <div className="w-4 h-8 bg-cyan-500 rounded-l shadow-md border-y border-l border-cyan-700 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-cyan-950 -rotate-90">FSL</span>
                </div>
                <div className="w-4 h-8 bg-blue-600 rounded-l shadow-md border-y border-l border-blue-800 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white -rotate-90">EVD</span>
                </div>
              </div>

              {/* Open Metal Binder Rings */}
              <div className="absolute left-1/2 top-4 bottom-4 -translate-x-1/2 w-4 z-40 flex flex-col justify-around items-center pointer-events-none">
                <div className="w-3 h-5 rounded-full border-2 border-slate-300 bg-gradient-to-r from-slate-200 to-slate-400 shadow-md" />
                <div className="w-3 h-5 rounded-full border-2 border-slate-300 bg-gradient-to-r from-slate-200 to-slate-400 shadow-md" />
                <div className="w-3 h-5 rounded-full border-2 border-slate-300 bg-gradient-to-r from-slate-200 to-slate-400 shadow-md" />
              </div>

              {/* LEFT PAGE: CASE DOSSIER / SUSPECT PHOTO CARD */}
              <div className="w-1/2 h-full bg-[#fdfcf7] rounded-l-md p-3.5 flex flex-col justify-between border-r border-stone-300 shadow-inner overflow-hidden relative">
                {/* Official Header */}
                <div className="border-b border-stone-300 pb-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold tracking-wider text-slate-800 uppercase font-mono-code">
                      FORENSIC REPORT
                    </span>
                    <span className="text-[8px] font-bold px-1 py-0.2 bg-red-100 text-red-700 border border-red-300 rounded">
                      CASE 049
                    </span>
                  </div>
                  <p className="text-[8px] text-stone-500 font-medium mt-0.5">
                    CRIME BRANCH • CYBER FORENSICS
                  </p>
                </div>

                {/* Suspect Identification Card (matches video layout) */}
                <div className="relative my-auto bg-stone-100 p-2 rounded border border-stone-300/80 shadow-sm flex gap-2 items-start">
                  {/* Red "PLB" ribbon tag on photo */}
                  <div className="relative">
                    <div className="w-16 h-20 bg-slate-800 rounded border border-stone-400 overflow-hidden relative shadow-inner">
                      <img
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80"
                        alt="Suspect"
                        className="w-full h-full object-cover filter grayscale contrast-125"
                      />
                      <div className="absolute top-1 left-0 bg-red-600 text-white font-extrabold text-[8px] px-1 py-0.2 tracking-widest shadow">
                        PLB
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 text-[8.5px] leading-tight text-slate-700 space-y-1">
                    <div>
                      <span className="text-stone-400 block text-[7px]">SUSPECT NAME:</span>
                      <strong className="text-slate-900 font-bold block text-[10px]">
                        Krishna Shrivastav
                      </strong>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[7px]">ALIAS: </span>
                      <span className="font-semibold text-slate-800">Vortex / Cipher</span>
                    </div>
                    <div>
                      <span className="text-stone-400 text-[7px]">STATUS: </span>
                      <span className="text-amber-800 font-bold">Judicial Remand</span>
                    </div>
                  </div>
                </div>

                {/* Fingerprint + Official Signature block */}
                <div className="flex items-center justify-between pt-1 border-t border-stone-200">
                  <div className="flex items-center gap-1">
                    <Fingerprint className="w-5 h-5 text-slate-700 opacity-80" />
                    <div className="text-[7px] text-stone-500 leading-tight">
                      <span>FP-CLASS:</span>
                      <strong className="block text-slate-800">#A98-WHORL</strong>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-serif italic text-[10px] text-blue-900 tracking-wider">
                      Sdr. Krishna Shrivastav
                    </div>
                    <div className="text-[6.5px] text-stone-400 uppercase">
                      Investigating Officer Seal
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT PAGE: EVIDENCE LOG & FORENSIC CERTIFICATE */}
              <div 
                onClick={handleNextPage}
                className="w-1/2 h-full bg-[#fdfcf7] rounded-r-md p-3.5 flex flex-col justify-between shadow-inner overflow-hidden relative cursor-pointer group"
                title="Click page to flip records"
              >
                {/* Stamp Seal */}
                <div className="absolute right-2 top-2 border-2 border-red-600/60 rounded px-1 py-0.5 rotate-6 text-red-600 font-extrabold text-[7.5px] tracking-wider uppercase opacity-80 pointer-events-none">
                  EVIDENCE VERIFIED
                </div>

                <div>
                  <div className="flex items-center justify-between border-b border-stone-300 pb-1">
                    <span className="text-[8.5px] font-bold text-slate-800">
                      {pageIndex === 0 ? 'PHYSICAL & DIGITAL EVIDENCE' : 'FORENSIC DNA & BALLISTICS'}
                    </span>
                    <span className="text-[7px] text-blue-800 font-mono-code font-bold underline group-hover:text-blue-950">
                      Page {pageIndex + 1}/2 ↻
                    </span>
                  </div>

                  {pageIndex === 0 ? (
                    <div className="mt-2 space-y-1.5 text-[8px] text-slate-700">
                      <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                        <strong className="text-slate-900 block font-semibold text-[8.5px]">
                          [EVD-01] Hardware Ledger Wallet
                        </strong>
                        <span className="text-stone-500">Recovered from Bandra Safe House. SHA-256 Ledger intact.</span>
                      </div>
                      <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                        <strong className="text-slate-900 block font-semibold text-[8.5px]">
                          [EVD-02] Encrypted Multi-SIM Devices
                        </strong>
                        <span className="text-stone-500">4 Active IMEI mapped to international relay network.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5 text-[8px] text-slate-700">
                      <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                        <strong className="text-slate-900 block font-semibold text-[8.5px]">
                          DNA Analysis (FSL Kalina)
                        </strong>
                        <span className="text-stone-500">99.98% match on biometric door sensor.</span>
                      </div>
                      <div className="bg-stone-50 p-1.5 rounded border border-stone-200">
                        <strong className="text-slate-900 block font-semibold text-[8.5px]">
                          Court Panchnama
                        </strong>
                        <span className="text-stone-500">Signed under Executive Magistrate supervision.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Verification Footer */}
                <div className="border-t border-stone-200 pt-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[7px] text-emerald-700 font-semibold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>CHAIN OF CUSTODY SECURED</span>
                  </div>
                  <span className="text-[6.5px] text-stone-400 font-mono-code">
                    HASH #7F49B
                  </span>
                </div>
              </div>

              {/* Clasp hanging on right */}
              <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                <div className="w-9 h-6 leather-dark rounded-r-full border border-slate-600 flex items-center justify-center shadow">
                  <div className="w-3.5 h-3.5 rounded-full bg-slate-300 border border-slate-500" />
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Footer Status Line (Exact match to Screenshot 2) */}
      <div className="z-20 mt-6 sm:mt-8 flex items-center gap-1.5 text-xs sm:text-sm font-medium tracking-wide text-[#2d3748] uppercase font-mono-code select-none">
        <span>SECURE CASE MANAGEMENT</span>
        <span>-</span>
        <span>
          {phase < 3 ? (
            <span className="text-amber-700 animate-pulse">Initializing...</span>
          ) : progressPercent < 100 ? (
            <span className="text-slate-800">Ready {progressPercent}%</span>
          ) : (
            <span className="text-slate-900 font-semibold flex items-center gap-1">
              Ready <span className="text-slate-950 font-bold">✓</span>
            </span>
          )}
        </span>
      </div>

      {/* Helper text for user interaction */}
      <div className="z-20 mt-2 text-[11px] text-slate-500 font-medium">
        {isBookOpen ? 'Click anywhere on the book cover to close' : 'Click binder to inspect 3D physical forensic case records'}
      </div>
    </div>
  );
};
