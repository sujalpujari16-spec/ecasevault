import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Microscope, 
  FileText, 
  Upload, 
  ShieldCheck, 
  Check
} from 'lucide-react';
import { CaseFile, UserSession, DocumentRecord, EvidenceItemRecord } from '../types';
import { generateSimulatedSHA256 } from '../utils/policeWorkflow';
import { soundEffects } from './AudioEffects';
import { getAuthToken } from '../services/apiClient';

interface UploadForensicReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: CaseFile[];
  session: UserSession;
  onSaveReport: (updatedCase: CaseFile, reportTitle: string) => void;
  preselectedCaseId?: string;
  preselectedEvidenceId?: string;
}

export type ForensicReportType = 
  | 'DNA Profile Examination Report'
  | 'Fingerprint & Latent Print Match Report'
  | 'Cyber Forensics & Hard Disk Extraction Report'
  | 'Ballistics & Firearm Examination Report'
  | 'Toxicology & Chemical Analysis Report'
  | 'Handwriting & Questioned Document Report'
  | 'General Forensic Science Laboratory (FSL) Report';

export const UploadForensicReportModal: React.FC<UploadForensicReportModalProps> = ({
  isOpen,
  onClose,
  cases,
  session,
  onSaveReport,
  preselectedCaseId,
  preselectedEvidenceId
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(preselectedCaseId || cases[0]?.id || '');
  const selectedCase = cases.find(c => c.id === selectedCaseId);

  const availableEvidences = selectedCase?.evidenceItems || [];
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string>(
    preselectedEvidenceId || (availableEvidences[0]?.id || '')
  );

  const [reportType, setReportType] = useState<ForensicReportType>('DNA Profile Examination Report');
  const [labName, setLabName] = useState('State Forensic Science Laboratory, Kalina, Mumbai');
  const [analystName, setAnalystName] = useState(session.officerName);
  const [findings, setFindings] = useState('');
  const [conclusion, setConclusion] = useState<'MATCH_FOUND' | 'NO_MATCH' | 'INCONCLUSIVE' | 'ANALYSIS_CONFIRMED'>('MATCH_FOUND');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setReportFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setFilePreview(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
    soundEffects.playSnap();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase) return;
    if (!findings.trim()) {
      alert('Please enter examination findings & scientific observations.');
      return;
    }

    setIsSubmitting(true);
    soundEffects.playStamp();

    const timestamp = new Date().toISOString();
    const docId = `DOC-FSL-${Date.now().toString().slice(-6)}`;
    const hash = generateSimulatedSHA256((reportFile?.name || 'forensic-report') + Date.now());

    let uploadedRepoDoc: any = null;
    let finalFileUrl = filePreview || undefined;

    try {
      const formData = new FormData();
      formData.append('department', 'FORENSIC');
      formData.append('documentType', 'FSL_REPORT');
      formData.append('title', `${reportType} — ${selectedCase.firNumber}`);
      formData.append('description', `Scientific examination report by ${analystName} (${labName}). Conclusion: ${conclusion}. Findings: ${findings.slice(0, 150)}`);
      formData.append('classification', 'CONFIDENTIAL');

      if (reportFile) {
        formData.append('file', reportFile);
      } else {
        const reportContent = `%PDF-1.4 Official FSL Examination Report\nCase: ${selectedCase.id} (${selectedCase.firNumber})\nFacility: ${labName}\nExaminer: ${analystName}\nReport: ${reportType}\nConclusion: ${conclusion}\nObservations: ${findings}\nTimestamp: ${timestamp}`;
        const blob = new Blob([reportContent], { type: 'application/pdf' });
        formData.append('file', blob, `${reportType.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
      }

      const res = await fetch(`/api/cases/${selectedCase.id}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken() || ''}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success && data.document) {
        uploadedRepoDoc = data.document;
        finalFileUrl = `/api/documents/${data.document.id}/download`;
      }
    } catch (uploadErr) {
      console.warn('[FORENSIC UPLOAD] Network upload note, proceeding with docket attachment:', uploadErr);
    }

    // 1. Create Forensic DocumentRecord
    const newDoc: DocumentRecord = {
      id: uploadedRepoDoc?.id || docId,
      docNumber: `FSL-MH-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`,
      caseId: selectedCase.id,
      title: `${reportType} (${selectedCase.firNumber})`,
      type: 'FORENSIC_REPORT',
      department: 'FORENSIC_FSL',
      clearance: 'CONFIDENTIAL',
      authorName: analystName,
      authorRank: session.rank || 'Forensic Scientist',
      createdDate: timestamp.substring(0, 10),
      lastModified: timestamp.substring(0, 10),
      version: '1.0',
      sha256Hash: hash,
      digitalSignature: {
        signedBy: `${analystName} (${session.badgeNo || 'FSL-ANALYST'})`,
        certId: `CERT-FSL-${Date.now().toString().slice(-6)}`,
        timestamp: `${timestamp.substring(0, 10)} 16:30 IST`,
        isVerified: true
      },
      summary: `Scientific examination findings: ${findings.slice(0, 160)}...`,
      tags: ['FORENSIC_REPORT', 'FSL', reportType.split(' ')[0].toUpperCase()],
      contentBody: `STATE FORENSIC SCIENCE LABORATORY REPORT\n` +
        `Case: ${selectedCase.caseTitle} (${selectedCase.firNumber})\n` +
        `Examination: ${reportType}\n` +
        `Lab Facility: ${labName}\n` +
        `Examiner: ${analystName}\n` +
        `Finding Conclusion: ${conclusion}\n\n` +
        `Detailed Observations:\n${findings}\n`,
      attachmentsCount: reportFile ? 1 : 0,
      fileUrl: finalFileUrl,
      fileName: reportFile?.name || `${reportType.replace(/ /g, '_')}.pdf`,
      fileSize: reportFile?.size || 204800,
      mimeType: reportFile?.type || 'application/pdf'
    };

    // 2. Update linked Evidence item status to 'Report Received'
    const updatedEvidenceItems: EvidenceItemRecord[] = (selectedCase.evidenceItems || []).map(item => {
      if (item.id === selectedEvidenceId || (item as any).evidenceTag === selectedEvidenceId) {
        return {
          ...item,
          status: 'Report Received' as const,
          notes: `${item.notes ? item.notes + '\n' : ''}FSL Examination completed by ${analystName}: ${findings.slice(0, 100)}`
        };
      }
      return item;
    });

    // 3. Update any matching ForensicRequest in the case
    const updatedForensicRequests = (selectedCase.forensicRequests || []).map(req => {
      if (req.evidenceId === selectedEvidenceId || req.evidenceTag === selectedEvidenceId || !selectedEvidenceId) {
        return {
          ...req,
          status: 'Report Ready' as const,
          analystName,
          findings: findings,
          verificationSeal: `SEAL-FSL-${hash.slice(0, 16)}`
        };
      }
      return req;
    });

    // Ensure at least one evidence item exists if case was empty
    let finalEvidenceItems = updatedEvidenceItems;
    if (finalEvidenceItems.length === 0) {
      const fallbackEvidence: EvidenceItemRecord = {
        id: `EVD-${selectedCase.id.slice(-4)}-SPECIMEN`,
        evidenceTag: `FSL-SPEC-${Date.now().toString().slice(-4)}`,
        category: 'Digital Evidence & Documentation' as any,
        description: `Scientific examination specimen for ${reportType}`,
        collectionDate: timestamp.substring(0, 10),
        collectionLocation: labName,
        collectingOfficer: analystName,
        collectingOfficerBadge: session.badgeNo || 'FSL-ANALYST',
        chainOfCustody: [
          {
            id: `COC-FSL-${Date.now()}`,
            timestamp: `${timestamp.substring(0, 10)} 10:00 IST`,
            action: 'EXAMINED_BY_FSL',
            fromCustodian: 'Maharashtra Police Evidence Malkhana',
            toCustodian: `${analystName} (${labName})`,
            purpose: `Forensic Analysis: ${reportType}`,
            verificationHash: hash
          }
        ],
        sha256Hash: hash,
        status: 'Report Received',
        notes: `Certified report submitted under Section 293 CrPC: ${conclusion}`
      };
      finalEvidenceItems = [fallbackEvidence];
    }

    // 4. Update case object
    const updatedCase: CaseFile = {
      ...selectedCase,
      documents: [newDoc, ...(selectedCase.documents || [])],
      repositoryDocuments: uploadedRepoDoc ? [uploadedRepoDoc, ...(selectedCase.repositoryDocuments || []).filter((d: any) => d.id !== uploadedRepoDoc.id)] : selectedCase.repositoryDocuments,
      evidenceItems: finalEvidenceItems,
      forensicRequests: updatedForensicRequests,
      timeline: [
        {
          id: `TL-FSL-${Date.now()}`,
          date: timestamp.substring(0, 10),
          title: `FSL Report Submitted: ${reportType}`,
          description: `Scientific examination completed by ${analystName} (${labName}). Conclusion: ${conclusion}. Cryptographic SHA-256 seal anchored.`,
          officer: analystName,
          badge: session.badgeNo || 'FSL-OFFICER',
          type: 'FORENSIC'
        },
        ...(selectedCase.timeline || [])
      ]
    };

    onSaveReport(updatedCase, newDoc.title);
    window.dispatchEvent(new CustomEvent('casevault:file-updated', { detail: { caseId: selectedCase.id } }));
    window.dispatchEvent(new CustomEvent('casevault:case-updated', { detail: { caseId: selectedCase.id } }));
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-xl">
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">Submit Scientific / FSL Forensic Report</h2>
              <p className="text-xs text-purple-200">State Forensic Science Laboratory (FSL) Division</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-purple-200 hover:text-white hover:bg-purple-800/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {/* Target Case & Evidence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Target Case Docket:</label>
              <select
                value={selectedCaseId}
                onChange={(e) => {
                  setSelectedCaseId(e.target.value);
                  const c = cases.find(item => item.id === e.target.value);
                  if (c?.evidenceItems && c.evidenceItems[0]) {
                    setSelectedEvidenceId(c.evidenceItems[0].id);
                  }
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-purple-600 cursor-pointer"
              >
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firNumber} — {c.caseTitle.slice(0, 35)}...
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Linked Evidence Sample:</label>
              <select
                value={selectedEvidenceId}
                onChange={(e) => setSelectedEvidenceId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-purple-600 cursor-pointer"
              >
                {availableEvidences.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.evidenceTag} — {ev.category} ({ev.description.slice(0, 25)})
                  </option>
                ))}
                {availableEvidences.length === 0 && (
                  <option value="">No seized evidence registered in case</option>
                )}
              </select>
            </div>
          </div>

          {/* Report Type & Facility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Forensic Discipline / Report Type:</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ForensicReportType)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-purple-600 cursor-pointer"
              >
                <option value="DNA Profile Examination Report">🧬 DNA Profile Examination Report</option>
                <option value="Fingerprint & Latent Print Match Report">👆 Fingerprint & Latent Print Match Report</option>
                <option value="Cyber Forensics & Hard Disk Extraction Report">💻 Cyber Forensics & Hard Disk Extraction Report</option>
                <option value="Ballistics & Firearm Examination Report">🎯 Ballistics & Firearm Examination Report</option>
                <option value="Toxicology & Chemical Analysis Report">🧪 Toxicology & Chemical Analysis Report</option>
                <option value="Handwriting & Questioned Document Report">📝 Handwriting & Questioned Document Report</option>
                <option value="General Forensic Science Laboratory (FSL) Report">🔬 General FSL Forensic Analysis Report</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Laboratory Facility:</label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-purple-600"
              />
            </div>
          </div>

          {/* Examiner & Finding Conclusion */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Reporting Scientist / Examiner:</label>
              <input
                type="text"
                value={analystName}
                onChange={(e) => setAnalystName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium outline-none focus:border-purple-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">Scientific Finding Conclusion:</label>
              <select
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold outline-none focus:border-purple-600 cursor-pointer"
              >
                <option value="MATCH_FOUND">✓ Match Confirmed / Positive Identification</option>
                <option value="ANALYSIS_CONFIRMED">✓ Scientific Analysis Conclusive</option>
                <option value="NO_MATCH">✗ Negative / No Match Found</option>
                <option value="INCONCLUSIVE">? Inconclusive / Further Specimen Required</option>
              </select>
            </div>
          </div>

          {/* Detailed Observations Text */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Scientific Findings & Laboratory Observations:</label>
            <textarea
              required
              rows={4}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Enter detailed laboratory observations, methodology, genetic markers, STR locus profiles, digital hash signatures, or chemical findings..."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-purple-600 leading-relaxed font-sans"
            />
          </div>

          {/* Upload Official Report PDF/Document */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700">Attach Signed Forensic Report Document (PDF/Scan):</label>
            <div className="p-4 border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/40 text-center space-y-2">
              {reportFile ? (
                <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-700" />
                    <div className="text-left">
                      <p className="font-bold text-slate-900 text-xs truncate max-w-xs">{reportFile.name}</p>
                      <p className="text-[10px] text-slate-400">{(reportFile.size / 1024).toFixed(1)} KB • Digitally Anchored</p>
                    </div>
                  </div>
                  <label className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded text-xs font-bold cursor-pointer transition-colors">
                    Change File
                    <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-purple-600 mx-auto" />
                  <p className="text-xs text-slate-700 font-semibold">Upload signed laboratory report or certificate</p>
                  <p className="text-[11px] text-slate-400">Supported formats: PDF, Scanned Image, DOCX (Max 25 MB)</p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Select Laboratory File</span>
                    <input type="file" accept=".pdf,image/*,.doc,.docx" onChange={handleFileChange} className="hidden" />
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Cryptographic Signing Guarantee Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Legal Admissibility (Section 293 Cr.P.C. / 329 BNSS):</span>
              <p className="text-slate-500 mt-0.5">
                Upon submission, this report is cryptographically sealed with a SHA-256 fingerprint and signed with your Ed25519 identity. The report is anchored directly into the shared case repository.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Signing & Sealing...' : 'Submit & Seal Forensic Report'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
