import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldCheck, 
  Users, 
  Lock, 
  KeyRound, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Building2, 
  UserCheck, 
  UserX, 
  RefreshCw, 
  Edit3,
  Sliders,
  FileCheck,
  Camera,
  Upload,
  X,
  Phone,
  Shield,
  Eye,
  EyeOff,
  UserPlus,
  FolderLock,
  RotateCcw,
  FileText
} from 'lucide-react';
import { OfficerProfile, UserSession, PoliceRole, CaseFile } from '../types';
import { apiClient } from '../services/apiClient';
import { ROLE_PERMISSIONS, RANKS_BY_CREATOR, getDynamicStationList } from '../utils/policeWorkflow';
import { soundEffects } from './AudioEffects';
import { getStoredStations, saveStation, PoliceStationDetail } from '../utils/stationStorage';
import { saveMemberToLocalStore, getStoredCourts, getStoredFslLabs } from '../utils/institutionStorage';

interface AdministrationViewProps {
  session: UserSession;
  onAuditAction?: (action: string, target: string) => void;
  cases?: CaseFile[];
  onOpenCaseDetails?: (caseFile: CaseFile) => void;
  onReassignIO?: (caseFile: CaseFile) => void;
}

export const AdministrationView: React.FC<AdministrationViewProps> = ({
  session,
  onAuditAction,
  cases = [],
  onOpenCaseDetails,
  onReassignIO,
}) => {
  const [activeTab, setActiveTab] = useState<'OFFICERS' | 'CASES' | 'STATIONS' | 'ACCESS_POLICIES'>('OFFICERS');
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStationFilter, setSelectedStationFilter] = useState('ALL');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'POLICE' | 'FORENSIC' | 'LEGAL' | 'AUDITOR'>('ALL');

  // Case Oversight & IO Reassignment Filters
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [caseStationFilter, setCaseStationFilter] = useState('ALL');
  const [caseIOStatusFilter, setCaseIOStatusFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');

  const caseStations = useMemo(() => {
    const list = new Set<string>();
    cases.forEach(c => {
      if (c.policeStation) list.add(c.policeStation);
    });
    return Array.from(list);
  }, [cases]);

  const filteredCasesList = useMemo(() => {
    return cases.filter(c => {
      if (caseStationFilter !== 'ALL' && !c.policeStation.toLowerCase().includes(caseStationFilter.toLowerCase())) return false;
      const hasIO = Boolean(c.officers?.assignedIO || (c as any).investigating_officer_id);
      if (caseIOStatusFilter === 'ASSIGNED' && !hasIO) return false;
      if (caseIOStatusFilter === 'UNASSIGNED' && hasIO) return false;
      if (caseSearchQuery.trim()) {
        const q = caseSearchQuery.toLowerCase();
        const str = `${c.id} ${c.firNumber} ${c.caseTitle} ${c.policeStation} ${c.officers?.assignedIO || ''} ${c.officers?.assignedIOBadge || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });
  }, [cases, caseSearchQuery, caseStationFilter, caseIOStatusFilter]);
  
  // Create / Edit Officer State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [officerName, setOfficerName] = useState('');
  const [officerUsername, setOfficerUsername] = useState('');
  const [officerPassword, setOfficerPassword] = useState('police123');
  const [showOfficerPassword, setShowOfficerPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PoliceRole>('POLICE');
  const [officerRank, setOfficerRank] = useState('Police Sub-Inspector (IO)');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [stationName, setStationName] = useState('Andheri Police Station, Mumbai');
  const [unitName, setUnitName] = useState('Crime & Cyber Cell');
  const [contactNumber, setContactNumber] = useState('');
  const [officerPhotoUrl, setOfficerPhotoUrl] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Stations Management State
  const [stationsList, setStationsList] = useState<PoliceStationDetail[]>([]);
  const [isAddStationModalOpen, setIsAddStationModalOpen] = useState(false);
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('ALL');

  // New Station Form State
  const [newStationName, setNewStationName] = useState('');
  const [newStationZone, setNewStationZone] = useState('Zone IX (Western Suburbs)');
  const [newStationDistrict, setNewStationDistrict] = useState('Mumbai Suburban');
  const [newStationPI, setNewStationPI] = useState('');
  const [newStationStrength, setNewStationStrength] = useState('36 Officers (6 Active IOs)');
  const [newStationContact, setNewStationContact] = useState('+91 22 2683 0100');
  const [newStationAddress, setNewStationAddress] = useState('');
  const [newStationMalkhana, setNewStationMalkhana] = useState('Vault Operational (SHA-256 Enabled)');

  const refreshStations = () => {
    setStationsList(getStoredStations());
  };

  React.useEffect(() => {
    refreshStations();
    const handleStationEvent = () => refreshStations();
    window.addEventListener('casevault:station-added', handleStationEvent);
    return () => window.removeEventListener('casevault:station-added', handleStationEvent);
  }, []);

  const getRoleDomain = (role: PoliceRole) => {
    switch (role) {
      case 'FORENSIC': return 'forensic.com';
      case 'LEGAL': return 'legal.com';
      case 'AUDITOR': return 'auditor.com';
      case 'ADMIN': return 'admin.com';
      case 'POLICE':
      default: return 'police.com';
    }
  };

  const updateUsernameForRole = (name: string, role: PoliceRole, domainType: 'ecasevault' | 'role' = 'ecasevault') => {
    const domain = domainType === 'ecasevault' ? 'ecasevault.com' : getRoleDomain(role);
    const clean = name.trim().toLowerCase().replace(/^(dr\.|adv\.|inspector|psi|pi|sp|shri|smt)\s*/i, '').split(/\s+/).filter(Boolean);
    const firstName = clean[0] || (role === 'ADMIN' ? 'system' : 'officer');
    const lastName = clean.length > 1 ? clean[clean.length - 1] : (role === 'ADMIN' ? 'admin' : (role === 'POLICE' ? 'patil' : role === 'FORENSIC' ? 'sharma' : role === 'LEGAL' ? 'deshmukh' : 'jadhav'));
    const safeFirst = firstName.replace(/[^a-z0-9]/g, '');
    const safeLast = lastName.replace(/[^a-z0-9]/g, '');
    setOfficerUsername(`${safeFirst}.${safeLast}@${domain}`);
  };

  const handleNameInput = (val: string) => {
    setOfficerName(val);
    if (!officerUsername || officerUsername.includes('@') || officerUsername.includes('.')) {
      updateUsernameForRole(val, selectedRole);
    }
  };

  const handleRoleChange = (newRole: PoliceRole) => {
    setSelectedRole(newRole);
    const defaultRanks = RANKS_BY_CREATOR[newRole] || [];
    if (defaultRanks.length > 0) {
      setOfficerRank(defaultRanks[0]);
    }

    if (newRole === 'POLICE') {
      setStationName(stationsList[0]?.name || 'Andheri Police Station, Mumbai');
      setUnitName('Crime & Cyber Cell');
      if (!badgeNumber || /^(MH|FSL|BAR|AUD|ADM)-/.test(badgeNumber)) {
        setBadgeNumber(`MH-POL-${Math.floor(1000 + Math.random() * 9000)}`);
      }
      if (officerPassword.endsWith('123')) {
        setOfficerPassword('police123');
      }
    } else if (newRole === 'FORENSIC') {
      setStationName('State Forensic Science Laboratory (FSL), Kalina');
      setUnitName('Ballistics & Cyber Division');
      if (!badgeNumber || /^(MH|FSL|BAR|AUD|ADM)-/.test(badgeNumber)) {
        setBadgeNumber(`FSL-MH-KALINA-${Math.floor(100 + Math.random() * 900)}`);
      }
      if (officerPassword.endsWith('123')) {
        setOfficerPassword('fsl123');
      }
    } else if (newRole === 'LEGAL') {
      setStationName('City Civil & Sessions Court, Mumbai');
      setUnitName('Directorate of Public Prosecution');
      if (!badgeNumber || /^(MH|FSL|BAR|AUD|ADM)-/.test(badgeNumber)) {
        setBadgeNumber(`BAR-MH-2026-${Math.floor(100 + Math.random() * 900)}`);
      }
      if (officerPassword.endsWith('123')) {
        setOfficerPassword('court123');
      }
    } else if (newRole === 'AUDITOR') {
      setStationName('State Police Headquarters Vigilance & Audit Wing, Colaba');
      setUnitName('Statutory Vigilance Inspection');
      if (!badgeNumber || /^(MH|FSL|BAR|AUD|ADM)-/.test(badgeNumber)) {
        setBadgeNumber(`AUD-MH-${Math.floor(1000 + Math.random() * 9000)}`);
      }
      if (officerPassword.endsWith('123')) {
        setOfficerPassword('audit123');
      }
    } else if (newRole === 'ADMIN') {
      setStationName('Maharashtra Police Central Command, Mumbai');
      setUnitName('Central Vault Infrastructure');
      if (!badgeNumber || /^(MH|FSL|BAR|AUD|ADM)-/.test(badgeNumber)) {
        setBadgeNumber(`ADM-MH-${Math.floor(100 + Math.random() * 900)}`);
      }
      if (officerPassword.endsWith('123')) {
        setOfficerPassword('admin123');
      }
    }

    if (officerName) {
      updateUsernameForRole(officerName, newRole);
    }
  };

  const handleOpenEnlistModal = (role: PoliceRole) => {
    soundEffects.playSnap();
    handleRoleChange(role);
    setIsAddModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotice('Photo exceeds 5MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setOfficerPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationName.trim()) return;

    soundEffects.playStamp();
    const created = saveStation({
      name: newStationName.trim(),
      zone: newStationZone,
      district: newStationDistrict,
      pi: newStationPI.trim() || 'Inspector In-Charge',
      strength: newStationStrength || '30 Officers (5 Active IOs)',
      activeDockets: '0 Active Cases',
      malkhanaStatus: newStationMalkhana,
      contactNumber: newStationContact,
      address: newStationAddress,
      status: 'Fully Integrated',
    });

    try {
      await apiClient.createStation({
        name: created.name,
        zone: created.zone,
        district: created.district,
        pi: created.pi,
        strength: created.strength,
        contactNumber: created.contactNumber,
        address: created.address,
        malkhanaStatus: created.malkhanaStatus,
      });
    } catch {
      // Local persistent store succeeded
    }

    refreshStations();
    showNotice(`Police station "${created.name}" successfully registered into Maharashtra Police Network.`);
    onAuditAction?.('STATION_REGISTERED', created.name);

    // Reset station form
    setNewStationName('');
    setNewStationPI('');
    setNewStationAddress('');
    setIsAddStationModalOpen(false);
  };

  const fetchOfficers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getOfficers();
      if (res && res.success && Array.isArray(res.officers)) {
        const mapped: OfficerProfile[] = res.officers.map((o: any) => ({
          id: o.id || o.badgeNo,
          name: o.name || o.full_name || o.username,
          badgeNo: o.badgeNo || o.badge_no,
          rank: o.rank,
          role: (o.role || 'POLICE').toUpperCase() as PoliceRole,
          station: o.station || o.station_id || 'Andheri Police Station',
          unit: o.department || 'Investigation Wing',
          contact: o.contact || '+91 98200 XXXXX',
          activeCases: Number(o.activeCasesCount ?? 0),
          completedCases: 0,
          currentWorkload: 'Optimal',
          status: 'ACTIVE_ON_DUTY',
          photoUrl: o.photoUrl || o.photo_url || undefined,
        }));
        setOfficers(mapped);
      }
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchOfficers();
  }, []);

  const showNotice = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 3500);
  };

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerName.trim() || !badgeNumber.trim()) return;

    soundEffects.playStamp();
    const finalUsername = (officerUsername.trim() || badgeNumber.toLowerCase().replace(/[^a-z0-9]/g, '')).toLowerCase();
    const finalPassword = officerPassword.trim() || `${selectedRole.toLowerCase()}123`;

    // Save to local store for offline sync
    saveMemberToLocalStore({
      id: `USR-${Date.now().toString(36).toUpperCase()}`,
      username: finalUsername,
      password: finalPassword,
      fullName: officerName.trim(),
      badgeNo: badgeNumber.trim(),
      rank: officerRank,
      role: selectedRole,
      stationOrInstitution: stationName,
      department: unitName || selectedRole,
      clearanceLevel: 'CONFIDENTIAL',
      contactNumber: contactNumber,
      photoUrl: officerPhotoUrl || undefined,
      status: 'ACTIVE_ON_DUTY',
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await apiClient.createOfficer({
        badgeNo: badgeNumber.trim(),
        username: finalUsername,
        password: finalPassword,
        fullName: officerName.trim(),
        rank: officerRank,
        role: selectedRole,
        stationId: stationName,
        department: unitName || selectedRole,
        clearanceLevel: 'CONFIDENTIAL',
        photoUrl: officerPhotoUrl || undefined,
      });
      await fetchOfficers();
      setIsAddModalOpen(false);
      setOfficerPhotoUrl('');
      showNotice(`✅ ${selectedRole} member ${officerName} enlisted! Login ID: "${finalUsername}" | Password: "${finalPassword}". Member will automatically log in directly to ${selectedRole} Portal.`);
      onAuditAction?.('CREATED_OFFICER', `${officerName} (${badgeNumber}) - Role: ${selectedRole}`);

      setOfficerName('');
      setOfficerUsername('');
      setBadgeNumber('');
      setContactNumber('');
    } catch (err: any) {
      await fetchOfficers();
      setIsAddModalOpen(false);
      showNotice(`✅ ${selectedRole} member ${officerName} enlisted locally! Login ID: "${finalUsername}" | Password: "${finalPassword}". Member will automatically log in directly to ${selectedRole} Portal.`);
    }
  };

  const handleToggleStatus = (officerId: string, currentStatus: string) => {
    soundEffects.playSnap();
    const newStatus = currentStatus === 'ACTIVE_ON_DUTY' ? 'ON_LEAVE' : 'ACTIVE_ON_DUTY';
    setOfficers(prev => prev.map(o => o.id === officerId ? { ...o, status: newStatus as any } : o));
    showNotice(`Duty status updated for Officer ID: ${officerId}`);
    onAuditAction?.('UPDATED_OFFICER_STATUS', `${officerId} -> ${newStatus}`);
  };

  const handleResetCredentials = (officerName: string, badgeNo: string) => {
    soundEffects.playStamp();
    showNotice(`Emergency PKI credentials and digital token refreshed for ${officerName} (${badgeNo}).`);
    onAuditAction?.('RESET_CREDENTIALS', `${badgeNo}`);
  };

  const filteredOfficers = officers.filter(o => {
    const matchesSearch = 
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.badgeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.station.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStation = selectedStationFilter === 'ALL' || o.station.includes(selectedStationFilter);
    const matchesRole = selectedRoleFilter === 'ALL' || (o.role && o.role.toUpperCase() === selectedRoleFilter);
    return matchesSearch && matchesStation && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Command Administration & Access Management
            </h2>
            <span className="px-2 py-0.5 bg-purple-100 text-purple-900 font-mono text-[10px] font-bold rounded">
              ROOT AUTHORIZATION
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure duty rosters, jurisdictional territorial assignments, cryptographic permissions, and RBAC matrix.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenEnlistModal('POLICE')}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>+ Enlist Police Officer</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenEnlistModal('FORENSIC')}
            className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>🔬 + Enlist Forensic Expert</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenEnlistModal('LEGAL')}
            className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <span>⚖️ + Enlist Lawyer / Prosecutor</span>
          </button>
          <button
            type="button"
            onClick={() => {
              soundEffects.playSnap();
              setIsAddStationModalOpen(true);
            }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Building2 className="w-4 h-4" />
            <span>+ Add Police Station</span>
          </button>
        </div>
      </div>

      {successNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            soundEffects.playSnap();
            setActiveTab('OFFICERS');
          }}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'OFFICERS'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Officer Registry & Workload ({officers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playSnap();
            setActiveTab('CASES');
          }}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'CASES'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FolderLock className="w-4 h-4" />
          <span>Case Oversight & IO Reassignment ({cases.length})</span>
        </button>



        <button
          type="button"
          onClick={() => {
            soundEffects.playSnap();
            setActiveTab('STATIONS');
          }}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'STATIONS'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Territorial Stations & Zones</span>
        </button>

        <button
          type="button"
          onClick={() => {
            soundEffects.playSnap();
            setActiveTab('ACCESS_POLICIES');
          }}
          className={`pb-3 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'ACCESS_POLICIES'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Statutory Security Policies</span>
        </button>
      </div>

      {/* TAB 1: OFFICERS DIRECTORY */}
      {activeTab === 'OFFICERS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter officers by name, badge, station, or rank..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600"
              />
            </div>
            <select
              value={selectedStationFilter}
              onChange={(e) => setSelectedStationFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">All Police Stations</option>
              {stationsList.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Quick Institutional Role Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('ALL')}
              className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer " + (selectedRoleFilter === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50')}
            >
              All Members ({officers.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('POLICE')}
              className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 " + (selectedRoleFilter === 'POLICE' ? 'bg-blue-700 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-blue-50')}
            >
              <span>👮 Police Officers ({officers.filter(o => !o.role || o.role === 'POLICE').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('FORENSIC')}
              className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 " + (selectedRoleFilter === 'FORENSIC' ? 'bg-purple-700 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-purple-50')}
            >
              <span>🔬 Forensic Scientists ({officers.filter(o => o.role === 'FORENSIC').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('LEGAL')}
              className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 " + (selectedRoleFilter === 'LEGAL' ? 'bg-amber-700 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50')}
            >
              <span>⚖️ Lawyers & Prosecutors ({officers.filter(o => o.role === 'LEGAL').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRoleFilter('AUDITOR')}
              className={"px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 " + (selectedRoleFilter === 'AUDITOR' ? 'bg-emerald-700 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-emerald-50')}
            >
              <span>🛡️ Vigilance Auditors ({officers.filter(o => o.role === 'AUDITOR').length})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOfficers.length === 0 ? (
              <div className="col-span-full p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center shadow-2xs space-y-3 my-2">
                <Shield className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No Officers Enlisted Yet</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  The personnel roster is completely clean. Click the "+ Enlist New Officer" button above to add custom police officers, forensic scientists, prosecutors, or auditors.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Enlist New Officer</span>
                </button>
              </div>
            ) : (
              filteredOfficers.map((officer) => (
              <div key={officer.id} className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {officer.photoUrl ? (
                      <img
                        src={officer.photoUrl}
                        alt={officer.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-300 shadow-2xs shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-300 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                        {officer.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{officer.name}</h4>
                      <p className="text-[11px] text-slate-500 font-mono font-medium">{officer.badgeNo}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                    officer.status === 'ACTIVE_ON_DUTY'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {officer.status === 'ACTIVE_ON_DUTY' ? 'Active' : 'On Leave'}
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rank:</span>
                    <span className="font-semibold text-slate-800">{officer.rank}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Station:</span>
                    <span className="font-medium text-slate-700">{officer.station}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Cases:</span>
                    <span className="font-bold text-blue-900">{officer.activeCases} Assigned</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(officer.id, officer.status)}
                    className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    {officer.status === 'ACTIVE_ON_DUTY' ? 'Mark On Leave' : 'Set Active'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetCredentials(officer.name, officer.badgeNo)}
                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer transition-colors"
                    title="Reset PKI Token"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )))}
          </div>
        </div>
      )}



      {/* TAB 2: CASE OVERSIGHT & IO REASSIGNMENT */}
      {activeTab === 'CASES' && (
        <div className="space-y-4">
          {/* Header Overview Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-[10px] font-bold rounded uppercase bg-blue-100 text-blue-900 border border-blue-200">
                    Statewide Case Oversight
                  </span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 font-mono text-[10px] font-bold rounded">
                    Admin IO Reassignment Authority
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight mt-1">
                  Investigating Officer Designation & Case Reallocation Desk
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
                  Inspect all active cases registered across Maharashtra Police Stations (Dadar, Worli, Bandra, Colaba, Andheri, etc.). View current Investigating Officers, evaluate case ownership, and reassign or replace an IO anytime performance or administrative requirements demand.
                </p>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <div className="text-base font-bold text-slate-900 font-mono">{cases.length}</div>
                  <div className="text-[10px] text-slate-500 font-semibold">Total Cases</div>
                </div>
                <div className="px-3.5 py-2 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <div className="text-base font-bold text-blue-900 font-mono">
                    {cases.filter(c => c.officers?.assignedIO).length}
                  </div>
                  <div className="text-[10px] text-blue-700 font-semibold">With Lead IO</div>
                </div>
                <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <div className="text-base font-bold text-amber-900 font-mono">
                    {cases.filter(c => !c.officers?.assignedIO).length}
                  </div>
                  <div className="text-[10px] text-amber-700 font-semibold">Pending IO</div>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={caseSearchQuery}
                onChange={(e) => setCaseSearchQuery(e.target.value)}
                placeholder="Search cases by Case ID, FIR, Crime Title, IO Name or Badge..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-blue-600 font-medium"
              />
            </div>

            {/* Station Filter */}
            <select
              value={caseStationFilter}
              onChange={(e) => setCaseStationFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="ALL">All Police Stations ({cases.length})</option>
              {caseStations.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {/* IO Assignment Status Filter */}
            <select
              value={caseIOStatusFilter}
              onChange={(e) => setCaseIOStatusFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-semibold text-slate-700"
            >
              <option value="ALL">All IO Statuses</option>
              <option value="ASSIGNED">Lead IO Assigned</option>
              <option value="UNASSIGNED">Unassigned (Needs IO)</option>
            </select>
          </div>

          {/* Cases Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Case ID / FIR</th>
                    <th className="py-3 px-4">Crime & Classification</th>
                    <th className="py-3 px-4">Police Station</th>
                    <th className="py-3 px-4">Investigating Officer (IO)</th>
                    <th className="py-3 px-4 text-center">Priority</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCasesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <FolderLock className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <div className="font-bold text-slate-700">No cases matched your filter criteria</div>
                        <div className="text-[11px] text-slate-400">Try adjusting your search query or station filter</div>
                      </td>
                    </tr>
                  ) : (
                    filteredCasesList.map((c) => {
                      const hasIO = Boolean(c.officers?.assignedIO);
                      const ioBadge = c.officers?.assignedIOBadge || (c as any).investigating_officer_id;
                      const ioName = c.officers?.assignedIO || (c as any).assigned_io;

                      return (
                        <tr key={c.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-bold text-blue-900">{c.id}</div>
                            <div className="text-[10px] text-slate-400 font-mono">FIR: {c.firNumber}</div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <div className="font-bold text-slate-900 truncate">{c.caseTitle}</div>
                            <div className="text-[10px] text-slate-500 truncate">{c.crimeType}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800">{c.policeStation}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.jurisdictionZone || 'Zonal Command'}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            {hasIO ? (
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                  <span>{ioName}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {ioBadge && (
                                    <span className="font-mono text-[10px] px-1.5 py-0.2 bg-blue-100 text-blue-800 font-bold rounded">
                                      {ioBadge}
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-semibold text-[9px] rounded border border-emerald-200">
                                    Lead IO Active
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded font-semibold text-[10px]">
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>No IO Assigned</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                              c.priority === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                              c.priority === 'HIGH' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {c.priority}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700">
                              {c.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  soundEffects.playSnap();
                                  onReassignIO?.(c);
                                }}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 font-bold text-[10px] rounded-lg cursor-pointer transition-colors border border-red-200 flex items-center gap-1 shadow-2xs"
                                title="Change or reassign Investigating Officer"
                              >
                                <RotateCcw className="w-3 h-3 text-red-600" />
                                <span>{hasIO ? 'Change IO' : 'Assign IO'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  soundEffects.playSnap();
                                  onOpenCaseDetails?.(c);
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[10px] rounded-lg cursor-pointer transition-colors border border-slate-200 flex items-center gap-1 shadow-2xs"
                              >
                                <Eye className="w-3 h-3 text-slate-500" />
                                <span>Inspect</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STATIONS & JURISDICTIONS */}
      {activeTab === 'STATIONS' && (
        <div className="space-y-4">
          {/* Station Filters & Action Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-1 items-center gap-2 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={stationSearchQuery}
                  onChange={(e) => setStationSearchQuery(e.target.value)}
                  placeholder="Search stations by name, zone, PI, or district..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <select
                value={selectedZoneFilter}
                onChange={(e) => setSelectedZoneFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">All Zones & Ranges</option>
                <option value="Zone IX">Zone IX (Western Suburbs)</option>
                <option value="Zone V">Zone V (Central/Eastern)</option>
                <option value="Zone I">Zone I (South Mumbai)</option>
                <option value="Zone XI">Zone XI (North Mumbai)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                soundEffects.playSnap();
                setIsAddStationModalOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Police Station</span>
            </button>
          </div>

          {/* Station Summary Counter */}
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
            <span>
              Showing {stationsList.filter(s => {
                const matchQuery = !stationSearchQuery || 
                  s.name.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                  s.zone.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                  s.pi.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                  s.district.toLowerCase().includes(stationSearchQuery.toLowerCase());
                const matchZone = selectedZoneFilter === 'ALL' || s.zone.includes(selectedZoneFilter);
                return matchQuery && matchZone;
              }).length} of {stationsList.length} Territorial Precincts
            </span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All Vault Malkhanas Operational
            </span>
          </div>

          {/* Stations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stationsList.filter(s => {
              const matchQuery = !stationSearchQuery || 
                s.name.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                s.zone.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                s.pi.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
                s.district.toLowerCase().includes(stationSearchQuery.toLowerCase());
              const matchZone = selectedZoneFilter === 'ALL' || s.zone.includes(selectedZoneFilter);
              return matchQuery && matchZone;
            }).map((stn, idx) => (
              <div key={stn.id || idx} className="p-5 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{stn.name}</h4>
                      {stn.isCustom && (
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[9px] font-bold rounded">
                          Admin Enrolled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-blue-700 font-semibold mt-0.5">{stn.zone}</p>
                    {stn.district && (
                      <p className="text-[11px] text-slate-400">{stn.district}</p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    {stn.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Station In-Charge:</span>
                    <span className="font-semibold text-slate-800">{stn.pi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Personnel Strength:</span>
                    <span className="font-medium text-slate-700">{stn.strength}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Dockets:</span>
                    <span className="font-bold text-slate-900">{stn.activeDockets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Malkhana Protocol:</span>
                    <span className="font-medium text-emerald-700">{stn.malkhanaStatus}</span>
                  </div>
                  {stn.contactNumber && (
                    <div className="flex justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-400">Phone:</span>
                      <span className="font-mono text-slate-700">{stn.contactNumber}</span>
                    </div>
                  )}
                  {stn.address && (
                    <div className="pt-1 text-[11px] text-slate-500 truncate">
                      <MapPin className="w-3 h-3 inline mr-1 text-slate-400" />
                      {stn.address}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ACCESS POLICIES */}
      {activeTab === 'ACCESS_POLICIES' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Statutory IT & Criminal Procedure Code Security Directives
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                Section 157 & 173 Cr.P.C. Compliance
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Investigating officers must record all spot panchnamas, seizure memos, and witness statements within the chronological diary. Docket closure is strictly governed by multi-tier signoff ending with District SP.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-600" />
                Evidence Tamper-Resistance & SHA-256 Sealing
              </h4>
              <p className="text-slate-600 leading-relaxed">
                All physical and digital artifacts deposited in the station Malkhana are tagged with SHA-256 cryptographic fingerprints. Any modification triggers an automated alert in the statutory audit log.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CREATE OFFICER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-700" />
                <h3 className="text-base font-bold text-slate-900">
                  {selectedRole === 'POLICE' ? 'Enlist New Police Officer' :
                   selectedRole === 'FORENSIC' ? 'Enlist New Forensic Scientist (FSL)' :
                   selectedRole === 'LEGAL' ? 'Enlist New Court / Legal Officer' :
                   selectedRole === 'AUDITOR' ? 'Enlist New Vigilance Auditor' :
                   selectedRole === 'ADMIN' ? 'Enlist New System Administrator' :
                   `Enlist New ${selectedRole} Member`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Prominent Institutional Role Switcher Tabs */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 p-1.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleRoleChange('POLICE')}
                className={"py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer " + (selectedRole === 'POLICE' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200')}
              >
                <span>👮 Police</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('FORENSIC')}
                className={"py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer " + (selectedRole === 'FORENSIC' ? 'bg-purple-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200')}
              >
                <span>🔬 Forensic</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('LEGAL')}
                className={"py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer " + (selectedRole === 'LEGAL' ? 'bg-amber-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200')}
              >
                <span>⚖️ Lawyer</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('AUDITOR')}
                className={"py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer " + (selectedRole === 'AUDITOR' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200')}
              >
                <span>🛡️ Auditor</span>
              </button>
            </div>

            <form onSubmit={handleCreateOfficer} className="space-y-3.5 text-xs">
              {/* Officer Photograph Upload */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">{selectedRole === "FORENSIC" ? "Forensic Scientist Official Portrait / Lab ID" : selectedRole === "LEGAL" ? "Advocate / Public Prosecutor Bar Portrait" : "Officer Official Photograph / Service Portrait"}</label>
                {officerPhotoUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <img
                      src={officerPhotoUrl}
                      alt="Officer Preview"
                      className="w-16 h-16 rounded-xl object-cover border-2 border-blue-800 shadow-xs shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800">Portrait Attached</p>
                      <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Ready for service identity verification
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <label className="text-[11px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer">
                          Change Photo
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                        </label>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setOfficerPhotoUrl('')}
                          className="text-[11px] font-semibold text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-blue-600 bg-slate-50 hover:bg-slate-100/80 rounded-xl cursor-pointer transition-colors group">
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-600 mb-1 transition-colors" />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-blue-900">
                      Upload Officer Photograph
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Passport size photo / Uniform service portrait (JPG, PNG, WebP)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">{selectedRole === "FORENSIC" ? "Forensic Expert Full Name *" : selectedRole === "LEGAL" ? "Prosecutor / Lawyer Full Name *" : "Officer Full Name *"}</label>
                <input
                  type="text"
                  value={officerName}
                  onChange={(e) => handleNameInput(e.target.value)}
                  placeholder="e.g. PSI Sandeep R. Kulkarni"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">Institutional Department / Role *</label>
                <select
                  value={selectedRole}
                  onChange={(e) => handleRoleChange(e.target.value as PoliceRole)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                >
                  <option value="POLICE">POLICE — Law Enforcement & Station Operations</option>
                  <option value="FORENSIC">FORENSIC — Forensic Science Laboratory (FSL)</option>
                  <option value="LEGAL">LEGAL — Prosecution & Judiciary Legal Counsel</option>
                  <option value="JAIL">JAIL — Prison Authority & Custody Administration</option>
                  <option value="NCRB">NCRB — National & State Crime Records Bureau</option>
                  <option value="AUDITOR">AUDITOR — Vigilance & Cryptographic Compliance</option>
                  <option value="ADMIN">ADMIN — Enterprise System Administration</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Designation / Rank *</label>
                  <select
                    value={officerRank}
                    onChange={(e) => setOfficerRank(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  >
                    {(RANKS_BY_CREATOR[selectedRole] || []).map((rk) => (
                      <option key={rk} value={rk}>{rk}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">{selectedRole === "FORENSIC" ? "FSL Accession / Scientist ID *" : selectedRole === "LEGAL" ? "Bar Council / Prosecution ID *" : "Badge / Service Number *"}</label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder="e.g. MH-PSI-5920"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Login Credentials: ID & Password */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-700" />
                    <span>Official Member Portal Credentials</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-300">
                    Auto-routes to {selectedRole} Portal
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 block text-[11px]">
                      Official Login ID / Username *
                    </label>
                    <input
                      type="text"
                      value={officerUsername}
                      onChange={(e) => setOfficerUsername(e.target.value)}
                      placeholder={selectedRole === 'POLICE' ? 'rajesh.patil@ecasevault.com' : selectedRole === 'FORENSIC' ? 'neha.sharma@ecasevault.com' : selectedRole === 'LEGAL' ? 'amit.deshmukh@ecasevault.com' : 'username@ecasevault.com'}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs outline-none focus:border-blue-600 shadow-2xs"
                      required
                      minLength={3}
                    />
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-500 font-medium">Domain:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const base = officerUsername.includes('@') ? officerUsername.split('@')[0] : (officerUsername || 'rajesh.patil');
                          setOfficerUsername(`${base}@ecasevault.com`);
                        }}
                        className={`px-1.5 py-0.5 text-[9.5px] font-mono rounded border transition-all cursor-pointer ${
                          officerUsername.endsWith('@ecasevault.com')
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                            : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
                        }`}
                      >
                        @ecasevault.com
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = officerUsername.includes('@') ? officerUsername.split('@')[0] : (officerUsername || 'rajesh.patil');
                          setOfficerUsername(`${base}@${getRoleDomain(selectedRole)}`);
                        }}
                        className={`px-1.5 py-0.5 text-[9.5px] font-mono rounded border transition-all cursor-pointer ${
                          officerUsername.endsWith(`@${getRoleDomain(selectedRole)}`)
                            ? 'bg-[#182f4d] text-white border-[#182f4d] font-semibold shadow-2xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        @{getRoleDomain(selectedRole)}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">e.g. {selectedRole === 'POLICE' ? 'rajesh.patil@ecasevault.com or rajesh.patil@police.com' : selectedRole === 'FORENSIC' ? 'neha.sharma@ecasevault.com or neha.sharma@forensic.com' : selectedRole === 'LEGAL' ? 'amit.deshmukh@ecasevault.com or amit.deshmukh@legal.com' : 'user@ecasevault.com'}</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-800 flex items-center justify-between text-[11px]">
                      <span>Login Password *</span>
                      <button
                        type="button"
                        onClick={() => setOfficerPassword(`${selectedRole.toLowerCase()}123`)}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                      >
                        Reset Default
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type={showOfficerPassword ? 'text' : 'password'}
                        value={officerPassword}
                        onChange={(e) => setOfficerPassword(e.target.value)}
                        placeholder="Min 6 chars"
                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-xs outline-none focus:border-blue-600 shadow-2xs"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowOfficerPassword(!showOfficerPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showOfficerPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Min 6 characters</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">
                    {selectedRole === 'FORENSIC' ? 'Forensic Laboratory Posting *' :
                     selectedRole === 'LEGAL' ? 'Court / Directorate Posting *' :
                     selectedRole === 'AUDITOR' ? 'Vigilance Bureau Headquarters *' :
                     'Station Posting *'}
                  </label>
                  <select
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  >
                    {selectedRole === 'FORENSIC' ? (
                      getStoredFslLabs().map((lab) => (
                        <option key={lab.id || lab.name} value={lab.name}>
                          {lab.name} ({lab.city})
                        </option>
                      ))
                    ) : selectedRole === 'LEGAL' ? (
                      getStoredCourts().map((court) => (
                        <option key={court.id || court.name} value={court.name}>
                          {court.name} ({court.district})
                        </option>
                      ))
                    ) : (
                      stationsList.map((stn) => (
                        <option key={stn.id || stn.name} value={stn.name}>
                          {stn.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Duty Unit</label>
                  <input
                    type="text"
                    value={unitName}
                    onChange={(e) => setUnitName(e.target.value)}
                    placeholder="e.g. Crime & Cyber Cell"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">Emergency Contact</label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+91 98200 XXXXX"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg cursor-pointer shadow-xs"
                >
                  Confirm & Provision
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* REGISTER NEW POLICE STATION MODAL */}
      {isAddStationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Register New Police Station</h3>
                  <p className="text-[11px] text-slate-500">Add jurisdictional police station to Maharashtra Police Network</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddStationModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStation} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-800">Police Station Name *</label>
                <input
                  type="text"
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  placeholder="e.g. Khar Police Station, Mumbai"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Zone / Commissionarate *</label>
                  <input
                    type="text"
                    value={newStationZone}
                    onChange={(e) => setNewStationZone(e.target.value)}
                    placeholder="e.g. Zone IX (Western Suburbs)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">District / Division *</label>
                  <input
                    type="text"
                    value={newStationDistrict}
                    onChange={(e) => setNewStationDistrict(e.target.value)}
                    placeholder="e.g. Mumbai Suburban"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Station In-Charge (Senior PI)</label>
                  <input
                    type="text"
                    value={newStationPI}
                    onChange={(e) => setNewStationPI(e.target.value)}
                    placeholder="e.g. Senior PI Sanjay R. Kulkarni"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Personnel Strength</label>
                  <input
                    type="text"
                    value={newStationStrength}
                    onChange={(e) => setNewStationStrength(e.target.value)}
                    placeholder="e.g. 36 Officers (6 Active IOs)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Official Landline / Contact</label>
                  <input
                    type="text"
                    value={newStationContact}
                    onChange={(e) => setNewStationContact(e.target.value)}
                    placeholder="+91 22 2604 0100"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-800">Evidence Malkhana Vault Status</label>
                  <select
                    value={newStationMalkhana}
                    onChange={(e) => setNewStationMalkhana(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                  >
                    <option value="Vault Operational (SHA-256 Enabled)">Vault Operational (SHA-256 Enabled)</option>
                    <option value="Vault Operational">Vault Operational</option>
                    <option value="Pending Malkhana Audit">Pending Malkhana Audit</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-800">Station Address & Jurisdiction Area</label>
                <textarea
                  value={newStationAddress}
                  onChange={(e) => setNewStationAddress(e.target.value)}
                  placeholder="e.g. S. V. Road, Near Railway Station, Khar West, Mumbai - 400052"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p>
                  Registering this station will automatically enroll its jurisdiction across e-CASEVAULT, enabling FIR dockets, investigating officer postings, and digital evidence vault seals.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStationModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Register Station</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
