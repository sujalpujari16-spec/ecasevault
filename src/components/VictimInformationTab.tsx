import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Users,
  UserPlus,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Clock,
  FileText,
  Upload,
  X
} from 'lucide-react';
import { VictimRecord, CaseFile, UserSession } from '../types';
import { canViewVictimDetails } from '../utils/policeWorkflow';
import { soundEffects } from './AudioEffects';
import { apiClient } from '../services/apiClient';

interface VictimInformationTabProps {
  caseFile: CaseFile;
  session: UserSession;
  onUpdateCase: (updated: CaseFile, auditAction?: string, auditNotes?: string) => void;
}

const PROTECTION_COLORS: Record<VictimRecord['protectionStatus'], string> = {
  'Safe': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Review Required': 'bg-amber-50 text-amber-700 border-amber-200',
  'Protection Provided': 'bg-blue-50 text-blue-700 border-blue-200',
  'At Risk': 'bg-red-50 text-red-700 border-red-200'
};

export const VictimInformationTab: React.FC<VictimInformationTabProps> = ({
  caseFile,
  session,
  onUpdateCase
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [accessReason, setAccessReason] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedVictimIndex, setSelectedVictimIndex] = useState<number>(0);

  // Form state for adding a new victim
  const [vName, setVName] = useState('');
  const [vAge, setVAge] = useState('32');
  const [vGender, setVGender] = useState<VictimRecord['gender']>('Female');
  const [vContact, setVContact] = useState('');
  const [vAddress, setVAddress] = useState('');
  const [vRelationship, setVRelationship] = useState<VictimRecord['relationshipToIncident']>('Complainant / Victim');
  const [vStatementStatus, setVStatementStatus] = useState<VictimRecord['statementStatus']>('Pending');
  const [vProtection, setVProtection] = useState<VictimRecord['protectionStatus']>('Safe');
  const [vNotes, setVNotes] = useState('');
  const [vPhotoUrl, setVPhotoUrl] = useState<string>('');

  const allVictims: VictimRecord[] = 
    (Array.isArray(caseFile.victimRecords) && caseFile.victimRecords.length > 0)
      ? caseFile.victimRecords
      : (caseFile.victimRecord ? [caseFile.victimRecord] : []);

  const activeIndex = selectedVictimIndex < allVictims.length ? selectedVictimIndex : 0;
  const victim = allVictims[activeIndex] || null;
  const canView = canViewVictimDetails(session);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setVPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRevealRequest = () => {
    setIsConfirmModalOpen(true);
  };

  const handleConfirmReveal = () => {
    if (!accessReason.trim()) return;
    soundEffects.playStamp();
    setIsRevealed(true);
    setIsConfirmModalOpen(false);
    onUpdateCase(
      caseFile,
      'VICTIM_DATA_ACCESSED',
      `Sensitive victim data for ${victim?.name || 'Victim'} accessed by ${session.officerName} (${session.badgeNo}). Reason: ${accessReason}`
    );
    setAccessReason('');
  };

  const handleAddVictim = (e: React.FormEvent) => {
    e.preventDefault();
    soundEffects.playStamp();
    const newVictim: VictimRecord = {
      id: `VIC-${caseFile.id.slice(-6)}-${Date.now().toString(36).toUpperCase()}`,
      caseId: caseFile.id,
      name: vName.trim(),
      age: parseInt(vAge) || 0,
      gender: vGender,
      contact: vContact,
      address: vAddress,
      relationshipToIncident: vRelationship,
      statementStatus: vStatementStatus,
      protectionStatus: vProtection,
      supportReferralNotes: vNotes,
      photoUrl: vPhotoUrl || undefined,
      isSensitiveRestricted: true
    };

    const updatedVictimRecords = [...allVictims, newVictim];

    onUpdateCase(
      { 
        ...caseFile, 
        victimRecord: updatedVictimRecords[0],
        victimRecords: updatedVictimRecords 
      },
      'VICTIM_RECORD_CREATED',
      `Registered victim record for ${newVictim.name} in case ${caseFile.id}`
    );

    // Auto enroll in biometric registry if photo attached
    if (newVictim.photoUrl && newVictim.photoUrl.length > 50) {
      apiClient.enrollIdentity({
        name: newVictim.name,
        alias: newVictim.name,
        photoUrl: newVictim.photoUrl,
        caseId: caseFile.id,
        role: 'VICTIM'
      }).catch(err => console.warn('Auto biometric enroll notice:', err));
    }

    setIsAddModalOpen(false);
    setSelectedVictimIndex(updatedVictimRecords.length - 1);
  };

  // Mask helper
  const mask = (text: string) => {
    if (!text) return 'Restricted';
    const parts = text.split(' ');
    return parts.map(p => p.length > 1 ? p[0] + '*'.repeat(p.length - 1) : '*').join(' ');
  };

  const maskPhone = (phone: string) => phone ? '+91 XXXXX XXXXX' : 'Restricted';
  const maskAddress = () => 'Restricted — Access Required';

  if (!victim && !canView) {
    return (
      <div className="text-center py-12">
        <Lock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-500 font-medium">Victim information restricted</p>
        <p className="text-xs text-slate-400 mt-1">Authorisation required to view this module</p>
      </div>
    );
  }

  const renderAddVictimModal = () => (
    <AnimatePresence>
      {isAddModalOpen && (
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
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add Victim / Complainant Record</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddVictim} className="p-5 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>This information is protected under Section 73 BSA victim privacy policy. All access is logged in the audit trail.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Full Name *</label>
                  <input required value={vName} onChange={e => setVName(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#182f4d]" placeholder="Full legal name" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Age</label>
                  <input type="number" value={vAge} onChange={e => setVAge(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#182f4d]" placeholder="Age" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Gender</label>
                  <select value={vGender} onChange={e => setVGender(e.target.value as VictimRecord['gender'])} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-[#182f4d]">
                    {['Male', 'Female', 'Other', 'Not Disclosed'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Contact</label>
                  <input value={vContact} onChange={e => setVContact(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#182f4d]" placeholder="+91 98200 00000" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Relationship</label>
                  <select value={vRelationship} onChange={e => setVRelationship(e.target.value as VictimRecord['relationshipToIncident'])} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-[#182f4d]">
                    {['Complainant / Victim', 'Victim', 'Complainant', 'Guardian of Victim'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Address</label>
                  <input value={vAddress} onChange={e => setVAddress(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#182f4d]" placeholder="Full residential / official address" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Statement Status</label>
                  <select value={vStatementStatus} onChange={e => setVStatementStatus(e.target.value as VictimRecord['statementStatus'])} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-[#182f4d]">
                    {['Recorded', 'Pending', 'Refused', 'Through Advocate'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Protection Status</label>
                  <select value={vProtection} onChange={e => setVProtection(e.target.value as VictimRecord['protectionStatus'])} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white outline-none focus:border-[#182f4d]">
                    {['Safe', 'Review Required', 'Protection Provided', 'At Risk'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Victim Photograph</label>
                  <div className="flex items-center gap-3">
                    {vPhotoUrl ? (
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                        <img src={vPhotoUrl} alt="Victim preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setVPhotoUrl('')}
                          className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs text-slate-600">
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Upload Victim Photo</span>
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Support / Referral Notes</label>
                  <textarea rows={2} value={vNotes} onChange={e => setVNotes(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:border-[#182f4d] resize-none" placeholder="Support services, legal aid, protection notes..." />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-[#182f4d] rounded-lg cursor-pointer">Save Victim Record</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (allVictims.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
          <User className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500 font-medium">No victim records added</p>
          <p className="text-xs text-slate-400 mt-1">
            Add victim / complainant information to this case docket
          </p>
          {(session.role === 'POLICE' || (session.role as string) === 'PI' || (session.role as string) === 'OFFICER' || session.role === 'ADMIN') && (
            <button
              onClick={() => {
                setVName('');
                setVAge('30');
                setVContact('');
                setVAddress('');
                setVPhotoUrl('');
                setVNotes('');
                setIsAddModalOpen(true);
              }}
              className="mt-4 px-4 py-2 bg-[#182f4d] text-white text-xs font-semibold rounded-lg hover:bg-[#11233b] cursor-pointer"
            >
              + Add Victim Record
            </button>
          )}
        </div>
        {renderAddVictimModal()}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Multiple Victims Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <span className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5 mr-1">
            <Users className="w-4 h-4 text-blue-600" />
            Registered Victims ({allVictims.length}):
          </span>
          {allVictims.map((v, idx) => {
            const isSelected = activeIndex === idx;
            return (
              <button
                key={v.id || idx}
                type="button"
                onClick={() => {
                  setSelectedVictimIndex(idx);
                  setIsRevealed(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#182f4d] text-white shadow-xs ring-2 ring-blue-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span className="capitalize">{isRevealed && isSelected ? v.name : (v.name || `Victim #${idx + 1}`)}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {v.protectionStatus}
                </span>
              </button>
            );
          })}
        </div>

        {(session.role === 'POLICE' || (session.role as string) === 'PI' || (session.role as string) === 'OFFICER' || session.role === 'ADMIN') && (
          <button
            type="button"
            onClick={() => {
              setVName('');
              setVAge('28');
              setVGender('Female');
              setVContact('');
              setVAddress('');
              setVPhotoUrl('');
              setVNotes('');
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-2xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Another Victim</span>
          </button>
        )}
      </div>

      {/* Header card */}
      <div className="flex items-start justify-between bg-gradient-to-br from-[#182f4d]/5 to-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#182f4d] overflow-hidden flex items-center justify-center shrink-0 border border-slate-200">
            {victim.photoUrl ? (
              <img src={victim.photoUrl} alt={victim.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-[#182f4d] font-mono">{victim.id}</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">Victim Information</p>
            <p className="text-[11px] text-slate-500">Case: {victim.caseId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 text-[10px] font-bold rounded-lg border ${PROTECTION_COLORS[victim.protectionStatus]}`}>
            {victim.protectionStatus}
          </span>
          {victim.isSensitiveRestricted && (
            <span className="px-2 py-1 text-[10px] font-bold rounded-lg border bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Protected
            </span>
          )}
        </div>
      </div>

      {/* Privacy notice */}
      {!isRevealed && victim.isSensitiveRestricted && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-amber-800">Sensitive Data — Access Restricted</p>
            <p className="text-xs text-amber-700 mt-1">
              Full personal details (name, contact, address) are masked. Authorised officers may reveal this information. All access is permanently recorded in the audit log.
            </p>
          </div>
        </div>
      )}

      {/* Victim Details Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Personal Details</span>
          {victim.isSensitiveRestricted && canView && (
            <button
              onClick={isRevealed ? () => setIsRevealed(false) : handleRevealRequest}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                isRevealed
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-[#182f4d] text-white hover:bg-[#11233b]'
              }`}
            >
              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {isRevealed ? 'Hide Details' : 'Reveal Sensitive Details'}
            </button>
          )}
        </div>
        <div className="p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Name</p>
            <p className={`text-sm mt-0.5 font-semibold ${isRevealed ? 'text-slate-900' : 'text-slate-400 italic'}`}>
              {isRevealed ? victim.name : mask(victim.name)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Age / Gender</p>
            <p className="text-sm mt-0.5 font-semibold text-slate-900">
              {victim.age} yrs — {victim.gender}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Contact</p>
            <p className={`text-sm mt-0.5 font-semibold ${isRevealed ? 'text-slate-900' : 'text-slate-400 italic'}`}>
              {isRevealed ? victim.contact : maskPhone(victim.contact)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Relationship to Incident</p>
            <p className="text-sm mt-0.5 font-semibold text-slate-900">{victim.relationshipToIncident}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Address</p>
            <p className={`text-sm mt-0.5 font-semibold ${isRevealed ? 'text-slate-900' : 'text-slate-400 italic'}`}>
              {isRevealed ? victim.address : maskAddress()}
            </p>
          </div>
        </div>
      </div>

      {/* Statement & Protection */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Statement Status
          </p>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg ${
            victim.statementStatus === 'Recorded' ? 'bg-emerald-100 text-emerald-800' :
            victim.statementStatus === 'Pending' ? 'bg-amber-100 text-amber-800' :
            'bg-slate-100 text-slate-700'
          }`}>
            {victim.statementStatus === 'Recorded' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
            {victim.statementStatus}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Protection Status
          </p>
          <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-lg border ${PROTECTION_COLORS[victim.protectionStatus]}`}>
            {victim.protectionStatus}
          </span>
        </div>
      </div>

      {/* Victim Documents & Videos Upload Section */}
      {(isRevealed || !victim.isSensitiveRestricted) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-500" /> Victim Statements & Media
            </p>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#182f4d] text-white rounded-lg cursor-pointer hover:bg-[#11233b] transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload File/Video
              <input type="file" multiple accept="video/*,.pdf,.doc,.docx,image/*" className="hidden" onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  soundEffects.playStamp();
                  const newFiles = Array.from(e.target.files).map((f: File) => ({
                    id: Math.random().toString(),
                    name: f.name,
                    type: f.type.startsWith('video') ? 'Video' : 'Document',
                    date: new Date().toISOString().split('T')[0],
                    size: (f.size / 1024 / 1024).toFixed(2) + ' MB'
                  }));
                  const updatedVictim = { ...victim, documents: [...((victim as any).documents || []), ...newFiles] };
                  
                  const updatedVictims = [...allVictims];
                  updatedVictims[activeIndex] = updatedVictim;
                  
                  onUpdateCase(
                    { ...caseFile, victimRecord: updatedVictims[0], victimRecords: updatedVictims },
                    'VICTIM_DOC_UPLOADED',
                    `Uploaded ${newFiles.length} files to victim record`
                  );
                }
              }} />
            </label>
          </div>
          
          {(victim as any).documents && (victim as any).documents.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {(victim as any).documents.map((doc: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300">
                  <div className="flex items-center gap-2">
                    {doc.type === 'Video' ? <div className="w-8 h-8 rounded bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-[10px]">VID</div> : <div className="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px]">DOC</div>}
                    <div>
                      <p className="text-xs font-bold text-slate-700 line-clamp-1">{doc.name}</p>
                      <p className="text-[10px] text-slate-500">{doc.date} • {doc.size}</p>
                    </div>
                  </div>
                  <a href="#" className="text-[10px] font-bold text-blue-600 hover:underline">View</a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-slate-300 rounded-lg bg-white mt-2">
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No documents or videos uploaded yet</p>
            </div>
          )}
        </div>
      )}

      {/* Reveal Confirmation Modal */}
      <AnimatePresence>
        {isConfirmModalOpen && (
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
              className="bg-white rounded-2xl border border-red-200 shadow-2xl max-w-sm w-full p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Sensitive Data Access</h3>
                  <p className="text-xs text-red-700 mt-0.5">Your action will be permanently recorded</p>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                You are about to view protected victim information for <strong>Case {caseFile.id}</strong>. This action will be logged in the audit trail with your name, badge number, timestamp, and reason.
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reason for Access *</label>
                <input
                  type="text"
                  value={accessReason}
                  onChange={e => setAccessReason(e.target.value)}
                  placeholder="e.g. Recording victim statement — coordination required"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-red-400 outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReveal}
                  disabled={!accessReason.trim()}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg cursor-pointer hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm Access
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Victim Modal */}
      {renderAddVictimModal()}
    </div>
  );
};
