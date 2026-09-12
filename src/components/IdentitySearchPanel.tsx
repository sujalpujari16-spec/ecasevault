import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  Search, 
  UserCheck, 
  Shield, 
  CheckCircle2, 
  FileText, 
  FolderLock, 
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  UserPlus,
  UserX,
  SlidersHorizontal,
  X,
  Eye,
  Check,
  Ban
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { CaseFile, UserSession } from '../types';
import { soundEffects } from './AudioEffects';
import { 
  detectFacesInImage, 
  loadImage, 
  DetectedFaceCrop, 
  FaceQualityReport 
} from '../utils/faceEmbedding';

interface IdentitySearchPanelProps {
  session: UserSession;
  cases: CaseFile[];
  onOpenCase?: (caseFile: CaseFile) => void;
}

interface Candidate {
  personId: string;
  name: string;
  alias?: string;
  dateOfBirth: string;
  gender: string;
  photoUrl: string;
  similarity: number; // 0.0 - 1.0
  rank: number;
  matchedReference?: string;
  matchTier?: 'HIGH' | 'MODERATE' | 'LOW';
}

interface CaseAssociation {
  id: string;
  personId: string;
  caseId: string;
  caseTitle?: string;
  crimeType?: string;
  role: 'ACCUSED' | 'SUSPECT' | 'PERSON_OF_INTEREST' | 'VICTIM' | 'WITNESS';
  status: string;
  notes?: string;
  verifiedAt: string;
  verifiedBy: string;
  contactMasked?: boolean;
}

export const IdentitySearchPanel: React.FC<IdentitySearchPanelProps> = ({ session, cases, onOpenCase }) => {
  // Case & Search Form State
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0]?.id || 'CR-2026-001');
  const [purpose, setPurpose] = useState<string>('CCTV investigation');
  const [justification, setJustification] = useState<string>('Bandra commercial jeweler CCTV frame matching for suspect verification.');
  const [searchScope, setSearchScope] = useState<'ALL_PERSONS' | 'CASE_PERSONS_ONLY'>('ALL_PERSONS');

  // Image & Face Detection State
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isDetectingFaces, setIsDetectingFaces] = useState<boolean>(false);
  const [detectedFaces, setDetectedFaces] = useState<DetectedFaceCrop[]>([]);
  const [selectedFace, setSelectedFace] = useState<DetectedFaceCrop | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Search Results State
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [reviewCandidate, setReviewCandidate] = useState<Candidate | null>(null);

  // Human Confirmation State
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [confirmedPerson, setConfirmedPerson] = useState<any | null>(null);
  const [caseAssociations, setCaseAssociations] = useState<CaseAssociation[] | null>(null);
  const [witnessCountExcluded, setWitnessCountExcluded] = useState<number>(0);
  const [auditInfo, setAuditInfo] = useState<{ auditTxId: string; sha256Hash: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Enrollment Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [enrollName, setEnrollName] = useState<string>('');
  const [enrollAlias, setEnrollAlias] = useState<string>('');
  const [enrollRole, setEnrollRole] = useState<'SUSPECT' | 'PERSON_OF_INTEREST' | 'ACCUSED'>('SUSPECT');
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);

  // Run face detection on imagePreview change
  useEffect(() => {
    let isCurrent = true;
    async function analyzeCurrentPhoto() {
      if (!imagePreview) {
        setDetectedFaces([]);
        setSelectedFace(null);
        return;
      }
      setIsDetectingFaces(true);
      try {
        const img = await loadImage(imagePreview);
        if (!isCurrent) return;
        const faces = await detectFacesInImage(img);
        if (!isCurrent) return;
        setDetectedFaces(faces);
        if (faces.length > 0) {
          setSelectedFace(faces[0]);
        } else {
          setSelectedFace(null);
        }
      } catch (err) {
        console.warn('Face detection analysis note:', err);
      } finally {
        if (isCurrent) setIsDetectingFaces(false);
      }
    }
    analyzeCurrentPhoto();
    return () => {
      isCurrent = false;
    };
  }, [imagePreview]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setImagePreview(dataUrl);
        setCandidates(null);
        setConfirmedPerson(null);
        setCaseAssociations(null);
        setReviewCandidate(null);
        setErrorMessage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadPreset = (type: 'cctv1' | 'cctv2') => {
    soundEffects.playSnap();
    setCandidates(null);
    setConfirmedPerson(null);
    setCaseAssociations(null);
    setReviewCandidate(null);
    setErrorMessage(null);

    if (type === 'cctv1') {
      setImagePreview('https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&fit=crop');
      setSelectedCaseId(cases[0]?.id || 'CR-2026-001');
      setPurpose('CCTV investigation');
      setJustification('Jeweler shop CCTV frame matching for suspect verification.');
    } else {
      setImagePreview('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&fit=crop');
      setSelectedCaseId(cases[1]?.id || 'CR-2026-002');
      setPurpose('Suspect verification');
      setJustification('ATM camera capture cross-verification for debit fraud inquiry.');
    }
  };

  // Search matching records using real vector embedding
  const handleSearch = async () => {
    if (!selectedCaseId) {
      setErrorMessage('Please select an active Case Docket.');
      return;
    }
    if (!justification || justification.trim().length < 5) {
      setErrorMessage('Please enter a written justification (minimum 5 characters) for statutory audit.');
      return;
    }
    if (!selectedFace && !imagePreview) {
      setErrorMessage('Please upload a photo or CCTV frame.');
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);
    setConfirmedPerson(null);
    setCaseAssociations(null);
    setReviewCandidate(null);
    soundEffects.playSnap();

    try {
      const queryEmbedding = selectedFace?.embedding;
      const res = await apiClient.searchIdentity({
        caseId: selectedCaseId,
        purpose,
        justification,
        queryEmbedding,
        imageBase64: imagePreview || selectedFace?.cropDataUrl,
        searchScope
      });

      if (res && res.success) {
        setSearchId(res.searchId);
        setCandidates(res.candidates || []);
      } else {
        setErrorMessage(res?.error || 'No response from biometric search engine.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error executing search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Officer confirms candidate identity
  const handleConfirmIdentity = async (candidate: Candidate) => {
    if (!searchId) return;

    setIsConfirming(true);
    setErrorMessage(null);
    soundEffects.playSnap();

    try {
      const res = await apiClient.confirmIdentity(searchId, candidate.personId);
      if (res && res.success) {
        soundEffects.playStamp();
        setConfirmedPerson(res.confirmedPerson);
        setCaseAssociations(res.caseAssociations || []);
        setWitnessCountExcluded(res.witnessCountExcluded || 0);
        setAuditInfo({
          auditTxId: res.auditTxId,
          sha256Hash: res.sha256Hash
        });
        setReviewCandidate(null);
      } else {
        setErrorMessage(res?.error || 'Failed to retrieve case records.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error confirming record.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Enroll new face in registry
  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollName.trim()) return;

    setIsEnrolling(true);
    setErrorMessage(null);
    try {
      const embedding = selectedFace?.embedding;
      const photoUrl = selectedFace?.cropDataUrl || imagePreview;

      const res = await apiClient.enrollIdentity({
        name: enrollName.trim(),
        alias: enrollAlias.trim() || undefined,
        photoUrl,
        embedding,
        caseId: selectedCaseId,
        role: enrollRole
      });

      if (res && res.success) {
        soundEffects.playStamp();
        setIsEnrollModalOpen(false);
        setEnrollName('');
        setEnrollAlias('');
        // Re-trigger search to immediately find newly enrolled person
        handleSearch();
      } else {
        setErrorMessage(res?.error || 'Failed to enroll person.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error enrolling person in biometric database.');
    } finally {
      setIsEnrolling(false);
    }
  };

  // Single matched candidate determination:
  // If top candidate has high similarity (>= 0.82), that face IS PRESENT in police records.
  // Show ONLY that face record; do not display other candidate faces.
  const matchedCandidate = (candidates && candidates.length > 0 && candidates[0].similarity >= 0.82)
    ? candidates[0]
    : null;
  const isFacePresent = Boolean(matchedCandidate);
  const topSimilarity = matchedCandidate ? matchedCandidate.similarity : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Face & Photo Search
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase bg-blue-100 text-blue-900 border border-blue-200">
              Biometric Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Detect faces in CCTV footage or photos, validate image quality, and search against registered face embeddings.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
          <Shield className="w-4 h-4 text-blue-700 shrink-0" />
          <span>Logged Officer: <strong>{session.officerName}</strong> ({session.badgeNo})</span>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Upload, Face Detection & Search Context */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-700" />
                1. Upload CCTV / Photo Still
              </h2>
              {isDetectingFaces && (
                <span className="text-[11px] text-blue-600 font-semibold animate-pulse flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Detecting faces...
                </span>
              )}
            </div>

            {/* Photo Preview Dropzone */}
            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
              {imagePreview ? (
                <div className="relative w-full aspect-4/3 max-h-56 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Target Frame"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-white/95 hover:bg-white text-slate-800 text-xs font-bold rounded-lg shadow-sm border border-slate-200 cursor-pointer"
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview('');
                        setCandidates(null);
                        setDetectedFaces([]);
                        setSelectedFace(null);
                        setReviewCandidate(null);
                        setConfirmedPerson(null);
                      }}
                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg shadow-sm border border-red-200 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[190px] rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/20 flex flex-col items-center justify-center p-6 cursor-pointer transition-all group"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center mb-2.5 text-blue-600 transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Upload CCTV Still or Photo</span>
                  <span className="text-[11px] text-slate-500 mt-1 text-center">
                    Click to browse or drag and drop an image
                  </span>
                  <span className="text-[10px] text-slate-400 mt-2 px-2.5 py-0.5 bg-slate-100 rounded-full font-mono">
                    JPEG, PNG, WebP up to 10MB
                  </span>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />

              {/* Sample Presets */}
              <div className="w-full flex items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-200 text-xs">
                <span className="text-slate-500 font-medium">Quick Presets:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadPreset('cctv1')}
                    className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                  >
                    Sample 1 (CCTV)
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('cctv2')}
                    className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 shadow-2xs cursor-pointer transition-colors"
                  >
                    Sample 2 (ATM)
                  </button>
                </div>
              </div>
            </div>

            {/* Multiple Faces Detection Selector */}
            {detectedFaces.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-700" />
                    {detectedFaces.length} Face{detectedFaces.length > 1 ? 's' : ''} Detected in Frame
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    {detectedFaces.length > 1 ? 'Select a face to search' : 'Primary face focused'}
                  </span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {detectedFaces.map((face, idx) => {
                    const isSelected = selectedFace?.id === face.id;
                    return (
                      <button
                        key={face.id}
                        type="button"
                        onClick={() => {
                          setSelectedFace(face);
                          soundEffects.playSnap();
                        }}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <img
                          src={face.cropDataUrl}
                          alt={face.label}
                          className="w-10 h-10 rounded object-cover border border-slate-200"
                        />
                        <div className="text-left text-[11px] pr-2">
                          <div className={`font-bold ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                            {face.label}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {face.width}x{face.height}px
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quality Assessment Check Card */}
            {selectedFace && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-200/60">
                  <span className="font-bold text-slate-800">Face Quality Diagnostics</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                    selectedFace.quality.overall === 'GOOD'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : selectedFace.quality.overall === 'FAIR'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    Quality: {selectedFace.quality.overall}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Crop Resolution</span>
                    <span className="font-semibold text-slate-800">
                      {selectedFace.quality.resolution.width} × {selectedFace.quality.resolution.height}px
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Sharpness / Focus</span>
                    <span className="font-semibold text-slate-800">
                      {selectedFace.quality.sharpness.status === 'GOOD' ? 'Sharp' : selectedFace.quality.sharpness.text}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Lighting</span>
                    <span className="font-semibold text-slate-800">
                      {selectedFace.quality.lighting.text}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Estimated Pose</span>
                    <span className="font-semibold text-slate-800">
                      {selectedFace.quality.pose.text}
                    </span>
                  </div>
                </div>

                {selectedFace.quality.recommendations.length > 0 && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{selectedFace.quality.recommendations[0]}</span>
                  </p>
                )}
              </div>
            )}

            {/* Case & Purpose Inputs */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Active Case Docket *
                </label>
                <select
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firNumber || c.id} — {(c.caseTitle || c.crimeType || '').slice(0, 36)}...
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Search Scope
                </label>
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value as any)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="ALL_PERSONS">Central Person Registry (All Police Records)</option>
                  <option value="CASE_PERSONS_ONLY">Active Case Associated Persons Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Search Reason *
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="CCTV Footage Face Identification">CCTV Footage Face Identification</option>
                  <option value="Suspect Spotting Verification">Suspect Spotting Verification</option>
                  <option value="Custody / Arrest Intake">Custody / Arrest Intake</option>
                  <option value="Unidentified Suspect Dossier Search">Unidentified Suspect Dossier Search</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Investigation Note (Statutory Audit)
                </label>
                <input
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="e.g. Bandra commercial jeweler CCTV footage suspect verification"
                  className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="flex-1 py-2.5 px-4 bg-[#182f4d] hover:bg-[#12243b] text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Matching Vector Embeddings...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Search Matching Records</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(true)}
                  title="Enroll this face as a new person in police registry"
                  className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-blue-700" />
                  <span className="hidden sm:inline">Enroll Face</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Search Results, Candidate Verification & Case Dockets */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 min-h-[420px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-blue-700" />
                2. Search Results {candidates ? (isFacePresent ? '— Face Present in Records' : '— Face Not Present') : ''}
              </h2>
              {searchId && (
                <span className="text-[11px] text-slate-500 font-mono">
                  Search ID: {searchId}
                </span>
              )}
            </div>

            {/* Empty State before Search */}
            {!candidates && !isSearching && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
                <Search className="w-12 h-12 stroke-1 text-slate-300 mb-3" />
                <p className="text-xs font-semibold text-slate-600">No active search results</p>
                <p className="text-[11px] text-slate-400 max-w-xs mt-1">
                  Upload a photo or CCTV still on the left and click "Search Matching Records" to check if the face is present in police records.
                </p>
              </div>
            )}

            {/* Searching Spinner */}
            {isSearching && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                <div>
                  <p className="text-xs font-bold text-slate-700">Calculating 128-D Cosine Similarities</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Searching registered reference embeddings...</p>
                </div>
              </div>
            )}

            {/* Search Results Display */}
            {candidates && !isSearching && (
              <div className="space-y-4">
                {!isFacePresent || !matchedCandidate ? (
                  <div className="flex flex-col items-center justify-center py-14 px-6 text-center bg-slate-50/70 border border-dashed border-slate-300 rounded-2xl">
                    <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-3.5 text-slate-400 shadow-2xs">
                      <UserX className="w-8 h-8 text-slate-400" />
                    </div>
                    <span className="px-3 py-0.5 bg-red-100 text-red-800 text-[11px] font-bold rounded-full mb-2 border border-red-200">
                      NOT FOUND IN DATABASE
                    </span>
                    <h3 className="text-base font-bold text-slate-900">
                      Face Not Present in Police Records
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
                      The scanned face does not match any registered suspect, accused, victim, or person of interest in police records.
                    </p>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => setIsEnrollModalOpen(true)}
                        className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <UserPlus className="w-4 h-4" />
                        Enroll Face as New Person of Interest
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Status Alert Banner */}
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-emerald-950">Face Present in Police Records</h3>
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-bold rounded-full">
                              VERIFIED MATCH
                            </span>
                          </div>
                          <p className="text-xs text-emerald-800 mt-0.5">
                            Individual positively identified with {(matchedCandidate.similarity * 100).toFixed(1)}% vector confidence.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ONLY that single matching candidate is shown */}
                    <div className="bg-slate-50 hover:bg-white rounded-xl border-2 border-emerald-500/50 p-4 flex flex-col justify-between gap-4 transition-all shadow-xs">
                      <div className="flex items-start gap-4">
                        <img
                          src={matchedCandidate.photoUrl}
                          alt={matchedCandidate.name}
                          className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-400 shrink-0 bg-white shadow-2xs"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-900 capitalize truncate">
                              {matchedCandidate.name}
                            </h3>
                            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              {(matchedCandidate.similarity * 100).toFixed(0)}% Similarity
                            </span>
                          </div>

                          {matchedCandidate.alias && (
                            <p className="text-xs text-blue-700 font-semibold truncate mt-0.5">
                              Alias: "{matchedCandidate.alias}"
                            </p>
                          )}

                          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                            <div>
                              <span className="text-slate-400 block text-[10px]">DOB / Gender</span>
                              <span className="font-semibold text-slate-800">{matchedCandidate.dateOfBirth} • {matchedCandidate.gender}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Registry Identifier</span>
                              <span className="font-mono font-bold text-slate-800">{matchedCandidate.personId}</span>
                            </div>
                          </div>

                          <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                            <span>Reference: <strong className="text-slate-700">{matchedCandidate.matchedReference || 'Case Dossier Photo'}</strong></span>
                            <span className="text-[10px] text-emerald-700 font-bold">1 Verified Identity Match</span>
                          </div>
                        </div>
                      </div>

                      {/* Review & Case Link Action */}
                      <button
                        type="button"
                        onClick={() => setReviewCandidate(matchedCandidate)}
                        className="w-full py-2.5 px-4 bg-[#182f4d] hover:bg-[#11233b] text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Eye className="w-4 h-4 text-blue-300" />
                        <span>Review & Verify Identity (Retrieve Authorized Case History)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirmed Candidate & Case Connections Dossier */}
            {confirmedPerson && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                {/* Green Verification Banner */}
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-emerald-950">
                        Identity Confirmed: {confirmedPerson.name} ({confirmedPerson.id})
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        Verified by {session.officerName} ({session.badgeNo}). Authorized case dossier unlocked.
                      </div>
                    </div>
                  </div>

                  {witnessCountExcluded > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-white/80 text-emerald-800 border border-emerald-300 rounded">
                      {witnessCountExcluded} Witness Record Protected
                    </span>
                  )}
                </div>

                {/* Case Associations Table */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-700" />
                    Authorized Case Associations ({caseAssociations?.length || 0})
                  </h3>

                  {caseAssociations && caseAssociations.length > 0 ? (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                          <tr>
                            <th className="px-3 py-2">Docket ID</th>
                            <th className="px-3 py-2">Case Title / Offense</th>
                            <th className="px-3 py-2">Role</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {caseAssociations.map((assoc) => (
                            <tr key={assoc.id} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                {assoc.caseId}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-semibold text-slate-800 truncate max-w-xs">
                                  {assoc.caseTitle || assoc.caseId}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate max-w-xs">
                                  {assoc.crimeType || 'Penal Investigation'}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                  assoc.role === 'ACCUSED'
                                    ? 'bg-red-100 text-red-800'
                                    : assoc.role === 'SUSPECT'
                                    ? 'bg-amber-100 text-amber-800'
                                    : assoc.role === 'VICTIM'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {assoc.role}
                                </span>
                                {assoc.contactMasked && (
                                  <span className="block text-[9px] text-blue-600 mt-0.5 font-medium">
                                    PII Masked (Sec 73 BSA)
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-slate-600 text-[11px]">
                                {assoc.status}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matchingCase = cases.find(c => c.id === assoc.caseId);
                                    if (matchingCase && onOpenCase) {
                                      onOpenCase(matchingCase);
                                    }
                                  }}
                                  className="text-blue-700 hover:text-blue-900 font-bold inline-flex items-center gap-1 text-[11px] cursor-pointer"
                                >
                                  <span>View Docket</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                      No authorized case history associated with this identity.
                    </div>
                  )}
                </div>

                {/* Fabric Blockchain Audit Anchoring Footer */}
                {auditInfo && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-500 space-y-1">
                    <div className="flex items-center justify-between">
                      <span>Hyperledger Fabric TX: <strong>{auditInfo.auditTxId}</strong></span>
                      <span className="text-emerald-700 font-bold">● Ledger Committed</span>
                    </div>
                    <div className="truncate">
                      SHA-256 Digest: {auditInfo.sha256Hash}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Human Verification Modal */}
      {reviewCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">Officer Identity Verification</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewCandidate(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              In accordance with Section 73 of Bharatiya Sakshya Adhiniyam, biometric search results must be reviewed by the investigating officer before authorized records are unmasked.
            </p>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <div>
                <span className="text-[10px] text-slate-500 font-bold block mb-1.5">Query Face / CCTV Still</span>
                <img
                  src={selectedFace?.cropDataUrl || imagePreview}
                  alt="Query"
                  className="w-24 h-24 mx-auto rounded-lg object-cover border border-slate-300 bg-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Active Frame</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold block mb-1.5">Enrolled Police Reference</span>
                <img
                  src={reviewCandidate.photoUrl}
                  alt="Reference"
                  className="w-24 h-24 mx-auto rounded-lg object-cover border border-slate-300 bg-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block font-semibold text-slate-800">
                  {reviewCandidate.matchedReference || 'Frontal Mugshot'}
                </span>
              </div>
            </div>

            {/* Candidate Details */}
            <div className="space-y-1 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-bold text-slate-900">{reviewCandidate.name}</span>
              </div>
              {reviewCandidate.alias && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Known Alias:</span>
                  <span className="font-semibold text-blue-700">"{reviewCandidate.alias}"</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Person ID:</span>
                <span className="font-mono text-slate-700">{reviewCandidate.personId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Calculated Similarity:</span>
                <span className="font-bold text-emerald-700">{reviewCandidate.similarity.toFixed(2)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReviewCandidate(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Reject / Not a Match
              </button>
              <button
                type="button"
                onClick={() => handleConfirmIdentity(reviewCandidate)}
                disabled={isConfirming}
                className="flex-1 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-sm cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                {isConfirming ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Identity</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Face Modal */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">Enroll Face in Registry</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEnrollModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnrollSubmit} className="space-y-3 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <img
                  src={selectedFace?.cropDataUrl || imagePreview}
                  alt="Face to enroll"
                  className="w-16 h-16 rounded-lg object-cover border border-slate-300 bg-white shrink-0"
                />
                <div>
                  <div className="font-bold text-slate-800">128-D Embedding Extracted</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Ready to enroll into PostgreSQL vector database and anchor to Fabric ledger.
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Name / Suspect Identifier *
                </label>
                <input
                  type="text"
                  value={enrollName}
                  onChange={(e) => setEnrollName(e.target.value)}
                  placeholder="e.g. Rahul Sharma or Unidentified Suspect #2"
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alias (Optional)
                </label>
                <input
                  type="text"
                  value={enrollAlias}
                  onChange={(e) => setEnrollAlias(e.target.value)}
                  placeholder="e.g. Rocky"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Investigative Role
                </label>
                <select
                  value={enrollRole}
                  onChange={(e) => setEnrollRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="SUSPECT">SUSPECT</option>
                  <option value="PERSON_OF_INTEREST">PERSON OF INTEREST</option>
                  <option value="ACCUSED">ACCUSED</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsEnrollModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEnrolling || !enrollName.trim()}
                  className="flex-1 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isEnrolling ? 'Enrolling...' : 'Save & Enroll'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
