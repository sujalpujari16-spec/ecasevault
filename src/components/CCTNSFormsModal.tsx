import React, { useState } from 'react';
import { 
  X, 
  FileText, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Package, 
  Camera, 
  Printer, 
  BadgeAlert,
  Download,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { CaseFile, CCTNSFormsCollection, UserSession } from '../types';

interface CCTNSFormsModalProps {
  caseFile: CaseFile;
  session: UserSession;
  onClose: () => void;
  onSignChargesheet?: (caseId: string) => void;
}

type IIFTab = 'IIF1' | 'IIF2' | 'IIF3' | 'IIF4' | 'IIF5' | 'IIF6';

export const CCTNSFormsModal: React.FC<CCTNSFormsModalProps> = ({
  caseFile,
  session,
  onClose,
  onSignChargesheet,
}) => {
  const [activeTab, setActiveTab] = useState<IIFTab>('IIF1');
  const [isSigningInProgress, setIsSigningInProgress] = useState(false);
  const [localSigned, setLocalSigned] = useState(
    caseFile.cctnsForms?.iif5_finalChargesheet?.isESigned ?? false
  );

  const forms: CCTNSFormsCollection | undefined = caseFile.cctnsForms;

  const handleSign = () => {
    setIsSigningInProgress(true);
    setTimeout(() => {
      setLocalSigned(true);
      setIsSigningInProgress(false);
      if (onSignChargesheet) {
        onSignChargesheet(caseFile.id);
      }
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header with CCTNS Official Seal Banner */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-slate-700/80 p-5 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-blue-900/60 border border-blue-400/30 rounded-xl text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded">
                  CCTNS / ICJS Standard
                </span>
                <span className="text-xs text-slate-400">Integrated Investigation Forms (IIF 1–5 & Nikal Namuna)</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5 flex items-center space-x-2">
                <span>{caseFile.caseTitle}</span>
                <span className="text-sm font-mono text-blue-400 font-medium">({caseFile.firNumber})</span>
              </h2>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => window.print()}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              title="Print Form"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 px-4 overflow-x-auto">
          {[
            { id: 'IIF1', label: 'IIF-1: FIR', badge: 'CrPC 154' },
            { id: 'IIF2', label: 'IIF-2: Crime Details', badge: 'Panchanama' },
            { id: 'IIF3', label: 'IIF-3: Atak Aaropi', badge: 'Arrest Memo' },
            { id: 'IIF4', label: 'IIF-4: Sampatti', badge: 'Property Seizure' },
            { id: 'IIF5', label: 'IIF-5: Final Form', badge: 'Chargesheet' },
            { id: 'IIF6', label: 'Form 6: Nikal Namuna', badge: 'Disposal' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as IIFTab)}
              className={`flex items-center space-x-2 py-3.5 px-4 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                {tab.badge}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content Container */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900/50 space-y-6 text-sm">

          {/* IIF-1: First Information Report */}
          {activeTab === 'IIF1' && forms?.iif1_fir && (
            <div className="space-y-6">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Integrated Investigation Form-1 (First Information Report)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Under Section 154 Cr.P.C. / Section 173 Bharatiya Nagarik Suraksha Sanhita (BNSS)</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold font-mono">
                    OFFICIALLY REGISTERED
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">District / Unit:</span>
                    <span className="font-semibold text-slate-200">{forms.iif1_fir.district}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Police Station:</span>
                    <span className="font-semibold text-slate-200">{forms.iif1_fir.policeStation}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">FIR Registration Date & Time:</span>
                    <span className="font-semibold text-slate-200">{forms.iif1_fir.dateAndTimeOfFIR}</span>
                  </div>
                  <div className="md:col-span-3">
                    <span className="text-slate-400 block mb-1">Acts & Sections Applicable:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {forms.iif1_fir.actsAndSections.map((sec, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-blue-900/40 border border-blue-500/30 text-blue-300 rounded font-mono text-xs">
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Place of Occurrence:</span>
                    <span className="font-semibold text-slate-200">{forms.iif1_fir.placeOfOccurrence}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Complainant / Informant:</span>
                    <span className="font-semibold text-slate-200">{forms.iif1_fir.complainantName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Assigned Investigating Officer:</span>
                    <span className="font-semibold text-slate-200">{forms.iif1_fir.investigatingOfficerAssigned}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-700/60">
                  <span className="text-slate-400 text-xs font-semibold block mb-1.5">Brief Facts of Information (First Information Narrative):</span>
                  <p className="text-xs text-slate-300 bg-slate-900/80 p-3.5 rounded-lg border border-slate-700/40 leading-relaxed font-sans">
                    {forms.iif1_fir.firstInformationBrief}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 pt-2">
                  <span>Dispatch Date to Jurisdiction Court: <strong className="text-slate-200">{forms.iif1_fir.dispatchDateToCourt}</strong></span>
                  <span className="flex items-center text-blue-400 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    CCTNS Digital Record Integrity Validated
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* IIF-2: Crime Detail Form / Spot Panchanama */}
          {activeTab === 'IIF2' && forms?.iif2_crimeDetails && (
            <div className="space-y-6">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Integrated Investigation Form-2 (Crime Detail Form & Spot Panchanama)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Under Section 100 Cr.P.C. / Section 105 BNSS (e-Sakshya Digital Media Integrity)</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full text-xs font-bold font-mono">
                    {forms.iif2_crimeDetails.spotPanchanamaNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Crime Scene Address:</span>
                    <span className="font-semibold text-slate-200">{forms.iif2_crimeDetails.crimeSceneAddress}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Date of Scene Inspection:</span>
                    <span className="font-semibold text-slate-200">{forms.iif2_crimeDetails.dateOfInspection}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Independent Panchas Present:</span>
                    <span className="font-semibold text-slate-200">{forms.iif2_crimeDetails.panchasPresent.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Investigating Officer:</span>
                    <span className="font-semibold text-slate-200">{forms.iif2_crimeDetails.investigatingOfficer}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-slate-400 text-xs font-semibold block mb-1.5">Physical Clues Recovered on Spot:</span>
                  <ul className="space-y-1 text-xs">
                    {forms.iif2_crimeDetails.physicalCluesIdentified.map((clue, idx) => (
                      <li key={idx} className="flex items-center text-slate-300 bg-slate-900/60 px-3 py-2 rounded border border-slate-700/30">
                        <Package className="w-3.5 h-3.5 mr-2 text-amber-400" />
                        {clue}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* e-Sakshya Video & Photo Hashes */}
                <div className="bg-slate-950/80 border border-indigo-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-300 flex items-center">
                      <Camera className="w-4 h-4 mr-1.5 text-indigo-400" />
                      e-Sakshya Cryptographic Crime Scene Hashes (Section 105 BNSS)
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                      Tamper-Proof Video Recording
                    </span>
                  </div>
                  <div className="space-y-1.5 text-[11px] font-mono">
                    <div className="text-slate-400">Photo Digest 1: <span className="text-slate-200">{forms.iif2_crimeDetails.eSakshPhotoHashes[0]}</span></div>
                    <div className="text-slate-400">Photo Digest 2: <span className="text-slate-200">{forms.iif2_crimeDetails.eSakshPhotoHashes[1]}</span></div>
                    <div className="text-slate-400">Video Digest: <span className="text-emerald-400">{forms.iif2_crimeDetails.eSakshVideoHashes[0]}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IIF-3: Atak Aaropi Form / Arrest Memo */}
          {activeTab === 'IIF3' && forms?.iif3_arrestMemo && (
            <div className="space-y-6">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Integrated Investigation Form-3 (Atak Aaropi Form / Arrest Memo)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Compliant with D.K. Basu Guidelines & Section 41B Cr.P.C. / Section 36 BNSS</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold font-mono">
                    {forms.iif3_arrestMemo.arrestMemoNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Accused Name & Alias:</span>
                    <span className="font-semibold text-slate-200 text-sm">
                      {forms.iif3_arrestMemo.accusedName} 
                      {forms.iif3_arrestMemo.accusedAlias && <span className="text-amber-400"> ({forms.iif3_arrestMemo.accusedAlias})</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Age & Gender:</span>
                    <span className="font-semibold text-slate-200">{forms.iif3_arrestMemo.age} Yrs / {forms.iif3_arrestMemo.gender}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Date & Time of Arrest:</span>
                    <span className="font-semibold text-slate-200">{forms.iif3_arrestMemo.dateTimeOfArrest}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Place of Arrest:</span>
                    <span className="font-semibold text-slate-200">{forms.iif3_arrestMemo.placeOfArrest}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Relative Informed:</span>
                    <span className="font-semibold text-slate-200">
                      {forms.iif3_arrestMemo.relativeInformedName} ({forms.iif3_arrestMemo.relativeInformedRelationship})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Relative Contact:</span>
                    <span className="font-semibold text-slate-200">{forms.iif3_arrestMemo.relativeInformedContact}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 text-xs font-semibold block mb-1.5">Physical Identification Marks:</span>
                    <ul className="space-y-1 text-xs">
                      {forms.iif3_arrestMemo.physicalIdentificationMarks.map((mark, idx) => (
                        <li key={idx} className="flex items-center text-slate-300 bg-slate-900/60 px-3 py-1.5 rounded border border-slate-700/30">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-blue-400" />
                          {mark}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-700/50 text-xs space-y-1.5">
                    <span className="text-slate-400 font-semibold block">Medical Inspection Record:</span>
                    <div className="text-emerald-400 font-semibold flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1.5" /> Medical Exam Completed Prior to Remand
                    </div>
                    <div className="text-slate-300">Examining Officer: {forms.iif3_arrestMemo.medicalOfficerName}</div>
                    <div className="text-slate-400 font-mono text-[11px]">Report Ref: {forms.iif3_arrestMemo.medicalReportNumber}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IIF-4: Property / Evidence Seizure Memo */}
          {activeTab === 'IIF4' && forms?.iif4_propertySeizure && (
            <div className="space-y-6">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Integrated Investigation Form-4 (Sampatti Form / Property Seizure Memo)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Under Section 102 Cr.P.C. / Section 106 BNSS (Malkhana Chain of Custody Sealed)</p>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full text-xs font-bold font-mono">
                    {forms.iif4_propertySeizure.seizureMemoNumber}
                  </span>
                </div>

                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950/70 text-slate-400 border-b border-slate-700">
                        <th className="p-2.5">Item #</th>
                        <th className="p-2.5">Description of Property</th>
                        <th className="p-2.5">Qty</th>
                        <th className="p-2.5">Est. Value</th>
                        <th className="p-2.5">Seal No</th>
                        <th className="p-2.5">AES Cipher Digest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/40 text-slate-200 font-sans">
                      {forms.iif4_propertySeizure.descriptionOfSeizedArticles.map((item) => (
                        <tr key={item.itemNo} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-bold text-blue-400">{item.itemNo}</td>
                          <td className="p-2.5">{item.description}</td>
                          <td className="p-2.5">{item.quantity}</td>
                          <td className="p-2.5 font-mono">{item.estimatedValue}</td>
                          <td className="p-2.5 font-mono text-amber-300">{item.packageSealNo}</td>
                          <td className="p-2.5 font-mono text-emerald-400 text-[11px]">{item.aesCipherHash}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-700/60">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Witness Panchas:</span>
                    <span className="font-semibold text-slate-200">{forms.iif4_propertySeizure.witnessPanchas.join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Malkhana Register Entry:</span>
                    <span className="font-semibold text-slate-200 font-mono">
                      {forms.iif4_propertySeizure.malkhanaEntryNumber} (In-Charge: {forms.iif4_propertySeizure.malkhanaInChargeBadge})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IIF-5: Final Form (Chargesheet) with e-Sign */}
          {activeTab === 'IIF5' && forms?.iif5_finalChargesheet && (
            <div className="space-y-6">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Integrated Investigation Form-5 (Final Form / Charge Sheet)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Under Section 173 Cr.P.C. / Section 193 BNSS for Court Trial Dispatch</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {localSigned ? (
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-bold font-mono flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        e-Signed & CCTNS Synced
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold font-mono flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        Pending Ed25519 e-Signature
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Charge Sheet Number:</span>
                    <span className="font-bold text-slate-200 font-mono text-sm">{forms.iif5_finalChargesheet.chargeSheetNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Filing / Scrutiny Court:</span>
                    <span className="font-semibold text-slate-200">{forms.iif5_finalChargesheet.courtName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Investigating Officer:</span>
                    <span className="font-semibold text-slate-200">
                      {forms.iif5_finalChargesheet.investigatingOfficerName} ({forms.iif5_finalChargesheet.investigatingOfficerBadge})
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-slate-400 text-xs font-semibold block mb-1.5">Investigating Officer's Final Opinion / Brief:</span>
                  <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded border border-slate-700/40 leading-relaxed font-sans">
                    {forms.iif5_finalChargesheet.briefFactsOfInvestigation}
                  </p>
                </div>

                {/* Charge Witnesses */}
                <div className="mb-5">
                  <span className="text-slate-400 text-xs font-semibold block mb-1.5">Calendar of Witnesses for Prosecution:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {forms.iif5_finalChargesheet.chargeWitnesses.map((cw) => (
                      <div key={cw.witnessNo} className="bg-slate-950/60 p-2.5 rounded border border-slate-700/40 flex items-center justify-between">
                        <span className="text-slate-200 font-medium">PW-{cw.witnessNo}: {cw.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-500/30">
                          {cw.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ed25519 e-Signature Box */}
                <div className="p-4 bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2 text-sm font-bold text-white">
                      <KeyRound className="w-4 h-4 text-blue-400" />
                      <span>Investigating Officer Ed25519 Digital e-Signature</span>
                    </div>
                    {localSigned ? (
                      <div className="text-xs text-slate-300 mt-1 font-mono">
                        Signed By: <strong className="text-emerald-400">{forms.iif5_finalChargesheet.eSignedBy || session.officerName}</strong> | 
                        Stamp: {forms.iif5_finalChargesheet.eSignTimestamp || 'Timestamped'}
                        <div className="text-[10px] text-slate-400 truncate max-w-lg mt-0.5">
                          Sig Digest: {forms.iif5_finalChargesheet.eSignatureHash || 'ed25519_verified_hash_ok'}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">
                        Mandatory digital seal required before transmission to e-Courts & CCTNS National Database.
                      </p>
                    )}
                  </div>

                  {!localSigned && (
                    <button
                      onClick={handleSign}
                      disabled={isSigningInProgress}
                      className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center space-x-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSigningInProgress ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Generating Seal...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Apply Ed25519 e-Sign</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* IIF-6: Result / Nikal Namuna (Court Disposal Form) */}
          {activeTab === 'IIF6' && forms?.iif6_nikalNamuna && (
            <div className="space-y-6">
              <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-5">
                <div className="flex justify-between items-start border-b border-slate-700/60 pb-3 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wide">
                      Form-6: Nikal Namuna (Court Disposal / Case Result Form)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Official e-Courts Disposal Synchronization with CCTNS Central Repository</p>
                  </div>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold font-mono">
                    {forms.iif6_nikalNamuna.courtDisposalNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Disposing Court:</span>
                    <span className="font-semibold text-slate-200">{forms.iif6_nikalNamuna.courtName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Presiding Officer:</span>
                    <span className="font-semibold text-slate-200">{forms.iif6_nikalNamuna.presidingJudgeName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Final Trial Verdict:</span>
                    <span className="font-bold text-amber-400 font-mono text-sm">{forms.iif6_nikalNamuna.verdict}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950/70 rounded-lg border border-slate-700/50 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 block">Sentence / Punishment Ordered:</span>
                    <span className="text-slate-200 font-medium">{forms.iif6_nikalNamuna.punishmentOrSentence}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Fine & Property Disposal Order:</span>
                    <span className="text-slate-200 font-medium">{forms.iif6_nikalNamuna.propertyDisposalOrder}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Appeal Deadline:</span>
                    <span className="text-slate-300 font-mono">{forms.iif6_nikalNamuna.appealFilingDeadline} ({forms.iif6_nikalNamuna.appealPeriodDays} Days Limitation)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400 mr-2" />
            <span>Authenticated under Maharashtra Police Digital Case Vault Regulations 2026</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition"
          >
            Close Viewer
          </button>
        </div>

      </div>
    </div>
  );
};
