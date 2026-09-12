import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Fingerprint,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Upload,
  Microscope,
  ShieldCheck,
  X,
  ChevronDown,
  Sparkles,
  FileText,
  User,
  Image as ImageIcon
} from 'lucide-react';
import { FingerprintRecord, CaseFile, UserSession, FingerprintForensicStatus, FingerprintPrintType, FingerprintQuality } from '../types';
import { soundEffects } from './AudioEffects';

interface FingerprintTabProps {
  caseFile: CaseFile;
  session: UserSession;
  onUpdateCase: (updated: CaseFile, auditAction?: string) => void;
}

const QUALITY_COLORS: Record<string, string> = {
  'Clear': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Partial': 'bg-amber-100 text-amber-800 border-amber-200',
  'Smudged': 'bg-orange-100 text-orange-800 border-orange-200',
  'Unusable': 'bg-red-100 text-red-800 border-red-200'
};

const STATUS_COLORS: Record<string, string> = {
  'Pending Examination': 'bg-slate-100 text-slate-700 border-slate-200',
  'Under Examination': 'bg-blue-100 text-blue-700 border-blue-200',
  'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Inconclusive': 'bg-orange-100 text-orange-800 border-orange-200'
};

const RESULT_COLORS: Record<string, string> = {
  'Match Found': 'bg-red-100 text-red-800 border-red-300',
  'No Match': 'bg-slate-100 text-slate-700 border-slate-200',
  'Inconclusive': 'bg-amber-100 text-amber-800 border-amber-200',
  'Pending': 'bg-blue-100 text-blue-700 border-blue-200'
};

export const FingerprintTab: React.FC<FingerprintTabProps> = ({ caseFile, session, onUpdateCase }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FingerprintRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [printType, setPrintType] = useState<FingerprintPrintType>('Latent Print');
  const [fingerPosition, setFingerPosition] = useState('Right Thumb');
  const [recoveredFrom, setRecoveredFrom] = useState('');
  const [recoveredLocation, setRecoveredLocation] = useState('');
  const [evidenceId, setEvidenceId] = useState('');
  const [quality, setQuality] = useState<FingerprintQuality>('Clear');
  const [collectionDateTime, setCollectionDateTime] = useState(
    new Date().toISOString().substring(0, 16).replace('T', ' ') + ' IST'
  );
  const [scanImageFile, setScanImageFile] = useState<File | null>(null);
  const [scanImagePreview, setScanImagePreview] = useState<string | null>(null);

  const records = (caseFile.fingerprintRecords || []).filter(fp =>
    fp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fp.recoveredFrom.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fp.fingerPosition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Only POLICE role can add police evidence & fingerprint records
  const canAdd = session.role === 'POLICE';

  const handleFingerprintFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setScanImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveredFrom.trim()) return;

    soundEffects.playStamp();
    const finalEvidenceId = evidenceId || caseFile.evidenceItems?.[0]?.id || 'EV-SCENE-PRIMARY';
    const newId = `FP-MH-${caseFile.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`;
    const newRecord: FingerprintRecord = {
      id: newId,
      caseId: caseFile.id,
      evidenceId: finalEvidenceId,
      printType,
      fingerPosition,
      recoveredFrom,
      recoveredLocation: recoveredLocation || recoveredFrom,
      collectedBy: session.officerName,
      collectedByBadge: session.badgeNo,
      collectionDateTime,
      scanImageUrl: scanImagePreview || undefined,
      quality,
      forensicStatus: 'Pending Examination',
      aiQualityAssessment: quality === 'Clear' ? 'Suitable for forensic examination'
        : quality === 'Partial' ? 'Marginal quality — further enhancement may be required'
        : quality === 'Smudged' ? 'Limited ridge detail — examination may be inconclusive'
        : 'Insufficient quality for reliable identification',
      aiConfidence: quality === 'Clear' ? 'High' : quality === 'Partial' ? 'Medium' : 'Low'
    };

    const updatedCase: CaseFile = {
      ...caseFile,
      fingerprintRecords: [...(caseFile.fingerprintRecords || []), newRecord],
      timeline: [
        ...(caseFile.timeline || []),
        {
          id: `TL-FP-${Date.now()}`,
          date: new Date().toISOString().substring(0, 10),
          title: 'Fingerprint Evidence Documented',
          description: `${printType} recovered from ${recoveredFrom} (Anchored to Evidence ${evidenceId}) documented by ${session.officerName}.${scanImagePreview ? ' Friction-ridge image scan uploaded.' : ''} Quality: ${quality}.`,
          officer: session.officerName,
          badge: session.badgeNo,
          type: 'EVIDENCE'
        }
      ]
    };

    onUpdateCase(updatedCase, 'FINGERPRINT_RECORDED');

    setIsAddModalOpen(false);
    setRecoveredFrom('');
    setRecoveredLocation('');
    setEvidenceId('');
    setScanImageFile(null);
    setScanImagePreview(null);
  };

  const pendingCount = (caseFile.fingerprintRecords || []).filter(fp => fp.forensicStatus === 'Pending Examination').length;
  const matchCount = (caseFile.fingerprintRecords || []).filter(fp => fp.examinationResult === 'Match Found').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[#182f4d] flex items-center gap-2">
            <Fingerprint className="w-4 h-4" />
            Fingerprint Evidence Module
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Forensic-grade documentation and ridge impression uploads
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stats pills */}
          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-semibold border border-slate-200">
            {records.length} Record{records.length !== 1 ? 's' : ''}
          </span>
          {pendingCount > 0 && (
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full font-semibold border border-amber-200">
              {pendingCount} Pending FSL
            </span>
          )}
          {matchCount > 0 && (
            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-semibold border border-red-200">
              {matchCount} Match Found
            </span>
          )}
          {canAdd && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#182f4d] text-white text-xs font-semibold rounded-lg hover:bg-[#11233b] transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Fingerprint Record
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search fingerprint records..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:border-[#182f4d] focus:ring-1 focus:ring-[#182f4d]/20 outline-none"
        />
      </div>

      {/* Records List */}
      {records.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          <Fingerprint className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500 font-medium">No fingerprint impressions logged</p>
          <p className="text-xs text-slate-400 mt-1">
            Log latent, inked, or digital friction ridge impressions anchored to seized evidence
          </p>
          {canAdd && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 px-4 py-2 bg-[#182f4d] text-white text-xs font-semibold rounded-lg hover:bg-[#11233b] cursor-pointer"
            >
              + Add Fingerprint Record
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(fp => (
            <motion.div
              key={fp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => setSelectedRecord(selectedRecord?.id === fp.id ? null : fp)}
            >
              <div className="flex items-start gap-3">
                {fp.scanImageUrl ? (
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-300 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
                    <img src={fp.scanImageUrl} alt={fp.fingerPosition} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#182f4d]/10 flex items-center justify-center shrink-0">
                    <Fingerprint className="w-5 h-5 text-[#182f4d]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#182f4d] font-mono">{fp.id}</span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${QUALITY_COLORS[fp.quality]}`}>
                      {fp.quality}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border ${STATUS_COLORS[fp.forensicStatus]}`}>
                      {fp.forensicStatus}
                    </span>
                    {fp.examinationResult && fp.examinationResult !== 'Pending' && (
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${RESULT_COLORS[fp.examinationResult]}`}>
                        {fp.examinationResult}
                      </span>
                    )}
                    {fp.scanImageUrl && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-bold rounded">
                        <ImageIcon className="w-2.5 h-2.5" /> Scan Attached
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold rounded">
                      <ShieldCheck className="w-2.5 h-2.5" /> On-Chain ✓
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 font-semibold mt-1">
                    {fp.printType} — {fp.fingerPosition}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recovered from: <span className="font-medium">{fp.recoveredFrom}</span>
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                    <span>Collected by {fp.collectedBy}</span>
                    <span>•</span>
                    <span>{fp.collectionDateTime}</span>
                    <span>•</span>
                    <span>Evidence: {fp.evidenceId}</span>
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${selectedRecord?.id === fp.id ? 'rotate-180' : ''}`} />
              </div>

              {/* Expanded Detail */}
              <AnimatePresence>
                {selectedRecord?.id === fp.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-slate-100 space-y-3"
                  >
                    {/* Scan image preview */}
                    {fp.scanImageUrl && (
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
                        <img 
                          src={fp.scanImageUrl} 
                          alt="Fingerprint Impression Scan" 
                          className="w-24 h-24 rounded-lg object-contain bg-slate-900 border border-slate-300 shadow-xs" 
                        />
                        <div className="text-xs space-y-1">
                          <p className="font-bold text-slate-900">Uploaded Friction Ridge Impression</p>
                          <p className="text-[11px] text-slate-600">Print Type: {fp.printType} ({fp.fingerPosition})</p>
                          <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Sealed in Malkhana Case Registry
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Forensic Ridge Quality Assessment */}
                    {fp.aiQualityAssessment && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                            Forensic Ridge Quality Assessment
                          </span>
                          <span className={`ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded ${
                            fp.aiConfidence === 'High' ? 'bg-emerald-100 text-emerald-700' :
                            fp.aiConfidence === 'Medium' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            Clarity: {fp.aiConfidence}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700">{fp.aiQualityAssessment}</p>
                      </div>
                    )}

                    {/* Location */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Recovery Location</p>
                        <p className="text-slate-700 mt-0.5">{fp.recoveredLocation || fp.recoveredFrom}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Collection Officer</p>
                        <p className="text-slate-700 mt-0.5">{fp.collectedBy} ({fp.collectedByBadge})</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Fingerprint Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 bg-[#182f4d] text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-5 h-5 text-amber-300" />
                  <h3 className="text-sm font-bold">Record Fingerprint Impression</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddRecord} className="p-6 space-y-4 overflow-y-auto">
                {(!caseFile.evidenceItems || caseFile.evidenceItems.length === 0) ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Scene Evidence Reference
                    </label>
                    <input
                      type="text"
                      value={evidenceId || 'EV-SCENE-PRIMARY'}
                      onChange={e => setEvidenceId(e.target.value)}
                      placeholder="e.g. EV-SCENE-PRIMARY (Spot Panchnama Lift)"
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Directly lifted from crime scene during spot panchnama inspection.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Anchor to Physical Evidence Item
                    </label>
                    <select
                      value={evidenceId}
                      onChange={e => setEvidenceId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    >
                      <option value="EV-SCENE-PRIMARY">Direct Crime Scene Surface Lift</option>
                      {caseFile.evidenceItems.map(ev => (
                        <option key={ev.id} value={ev.id}>
                          {ev.id} — {ev.evidenceTag} ({ev.description.substring(0, 40)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Print Type</label>
                    <select
                      value={printType}
                      onChange={e => setPrintType(e.target.value as FingerprintPrintType)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    >
                      <option value="Latent Print">Latent Print</option>
                      <option value="Patent Print">Patent Print</option>
                      <option value="Plastic Print">Plastic Print</option>
                      <option value="Inked Print">Inked Print</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Pattern / Position</label>
                    <input
                      type="text"
                      value={fingerPosition}
                      onChange={e => setFingerPosition(e.target.value)}
                      placeholder="e.g. Right Thumb"
                      required
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Recovered From (Object)</label>
                  <input
                    type="text"
                    value={recoveredFrom}
                    onChange={e => setRecoveredFrom(e.target.value)}
                    placeholder="e.g. Glass tumbler handle, Vehicle steering rim"
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                  />
                </div>

                {/* Fingerprint Image Upload Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Upload Fingerprint Impression Scan / Photo
                  </label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-center relative cursor-pointer">
                    <input
                      type="file"
                      accept="image/*,.wsq,.nist,.bmp,.png,.jpg,.jpeg"
                      onChange={handleFingerprintFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {scanImagePreview ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={scanImagePreview}
                          alt="Preview"
                          className="w-14 h-14 object-cover rounded-lg border border-slate-300 bg-slate-900 shadow-xs"
                        />
                        <div className="text-left text-xs">
                          <p className="font-bold text-slate-800">{scanImageFile?.name || 'fingerprint_scan.png'}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {scanImageFile ? `${(scanImageFile.size / 1024).toFixed(1)} KB` : ''}
                          </p>
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Fingerprint image loaded
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 flex flex-col items-center gap-1 text-slate-500">
                        <Upload className="w-5 h-5 text-slate-400" />
                        <span className="text-xs font-semibold">Click or drag & drop fingerprint image</span>
                        <span className="text-[10px] text-slate-400">Supported: PNG, JPG, BMP, WSQ friction-ridge scans</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Quality Assessment</label>
                    <select
                      value={quality}
                      onChange={e => setQuality(e.target.value as FingerprintQuality)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    >
                      <option value="Clear">Clear (High ridge clarity)</option>
                      <option value="Partial">Partial (Sufficient for AFIS)</option>
                      <option value="Smudged">Smudged (Marginal)</option>
                      <option value="Unusable">Unusable (Distorted)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Collection Time</label>
                    <input
                      type="text"
                      value={collectionDateTime}
                      onChange={e => setCollectionDateTime(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-[#182f4d] outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!caseFile.evidenceItems || caseFile.evidenceItems.length === 0 || !evidenceId}
                    className="px-4 py-2 text-xs font-semibold bg-[#182f4d] text-white rounded-lg hover:bg-[#11233b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Save & Seal Record
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
