import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Plus,
  Search,
  CheckCircle2,
  Lock,
  Building2,
  Phone,
  Mail,
  X,
  Eye,
  EyeOff,
  Filter,
  Camera,
  Scale,
  Microscope,
  ShieldCheck,
  Briefcase,
  KeyRound,
  Copy,
  ExternalLink,
  LayoutGrid,
  List,
  Sparkles,
  BadgeCheck,
  ChevronRight
} from 'lucide-react';
import { OfficerProfile, UserSession, PoliceRole } from '../types';
import { apiClient } from '../services/apiClient';
import { canManageOfficers } from '../utils/policeWorkflow';
import { soundEffects } from './AudioEffects';
import { getStoredStations, saveStation, PoliceStationDetail } from '../utils/stationStorage';
import { 
  getStoredCourts, 
  saveCourt, 
  CourtDetail, 
  getStoredFslLabs, 
  saveFslLab, 
  ForensicLabDetail, 
  getStoredMembers, 
  saveMemberToLocalStore 
} from '../utils/institutionStorage';

interface MemberManagementViewProps {
  session: UserSession;
  onAuditAction?: (action: string, target: string, notes?: string) => void;
}

const RANKS_BY_ROLE: Record<PoliceRole, string[]> = {
  POLICE: [
    'Superintendent of Police (District Head)',
    'Deputy Superintendent of Police (Sub-Divisional Officer)',
    'Senior Police Inspector (Station In-Charge)',
    'Police Inspector',
    'Assistant Police Inspector',
    'Police Sub-Inspector (IO)',
    'Assistant Sub-Inspector',
    'Head Constable',
    'Police Constable',
  ],
  FORENSIC: [
    'Chief Forensic Scientist',
    'Senior Scientific Officer (DNA)',
    'Senior Scientific Officer (Ballistics)',
    'Senior Scientific Officer (Cyber Forensics)',
    'Scientific Assistant (Chemical)',
    'Chief Forensic Analyst',
    'Forensic Document Examiner',
  ],
  LEGAL: [
    'District & Sessions Judge',
    'Additional Sessions Judge',
    'Chief Metropolitan Magistrate',
    'Metropolitan Magistrate',
    'Special Public Prosecutor',
    'Chief Public Prosecutor',
    'Public Prosecutor',
    'Assistant Public Prosecutor',
    'Government Pleader / Legal Advisor',
  ],
  AUDITOR: [
    'Senior Vigilance & Security Auditor',
    'Chief Compliance Auditor',
    'Cyber Forensic & Ledger Auditor',
    'State Police Complaints Vigilance Inspector',
  ],
  ADMIN: [
    'System Administrator (Vault Ops)',
    'Central Command Infrastructure Officer',
    'State Security Operations Administrator',
  ],
};

interface DepartmentConfig {
  role: PoliceRole;
  title: string;
  shortLabel: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  headerGradient: string;
  borderClass: string;
  badgeClass: string;
  addBtnText: string;
  facilityBtnText?: string;
  facilityIcon?: React.ComponentType<{ className?: string }>;
  onFacilityClick?: () => void;
  dashboardLabel: string;
  badgePrefixHint: string;
}

export const MemberManagementView: React.FC<MemberManagementViewProps> = ({ session, onAuditAction }) => {
  const userRole = session.role;
  const isAdmin = userRole === 'ADMIN';
  const isAuditor = userRole === 'AUDITOR';
  const canSeeAll = isAdmin || isAuditor;
  const canAddMembers = isAdmin;

  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | PoliceRole>(
    canSeeAll ? 'ALL' : (userRole as PoliceRole)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [stationFilter, setStationFilter] = useState('ALL');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [viewStyle, setViewStyle] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAddCourtModalOpen, setIsAddCourtModalOpen] = useState(false);
  const [isAddLabModalOpen, setIsAddLabModalOpen] = useState(false);
  const [isAddStationModalOpen, setIsAddStationModalOpen] = useState(false);

  // Member Form State
  const [memberName, setMemberName] = useState('');
  const [memberUsername, setMemberUsername] = useState('');
  const [memberPassword, setMemberPassword] = useState('pass123');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PoliceRole>('POLICE');
  const [selectedRank, setSelectedRank] = useState(RANKS_BY_ROLE['POLICE'][5]);
  const [assignedInstitution, setAssignedInstitution] = useState('Andheri Police Station, Mumbai');
  const [badgeNumber, setBadgeNumber] = useState('');
  const [memberContact, setMemberContact] = useState('+91 98200 XXXXX');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhotoUrl, setMemberPhotoUrl] = useState('');

  // Institution lists state
  const [stations, setStations] = useState<PoliceStationDetail[]>([]);
  const [courts, setCourts] = useState<CourtDetail[]>([]);
  const [fslLabs, setFslLabs] = useState<ForensicLabDetail[]>([]);

  // New Court Form
  const [courtName, setCourtName] = useState('');
  const [courtType, setCourtType] = useState<CourtDetail['type']>('SESSIONS_COURT');
  const [courtDistrict, setCourtDistrict] = useState('Mumbai City');
  const [courtBench, setCourtBench] = useState('Principal Sessions Bench');
  const [courtJudge, setCourtJudge] = useState('Principal Sessions Judge');
  const [courtRegistrar, setCourtRegistrar] = useState('Court Registrar');
  const [courtContact, setCourtContact] = useState('+91 22 2265 1400');
  const [courtAddress, setCourtAddress] = useState('');

  // New Lab Form
  const [labName, setLabName] = useState('');
  const [labDivision, setLabDivision] = useState<ForensicLabDetail['division']>('REGIONAL_FSL');
  const [labCity, setLabCity] = useState('Mumbai');
  const [labDirector, setLabDirector] = useState('Dr. Director, FSL');
  const [labContact, setLabContact] = useState('+91 22 2667 0766');
  const [labAddress, setLabAddress] = useState('');
  const [labSpecialization, setLabSpecialization] = useState('DNA, Ballistics, Toxicology');

  // New Station Form
  const [stationName, setStationName] = useState('');
  const [stationZone, setStationZone] = useState('Zone IX (Western Suburbs)');
  const [stationDistrict, setStationDistrict] = useState('Mumbai Suburban');
  const [stationPI, setStationPI] = useState('Inspector In-Charge');
  const [stationContact, setStationContact] = useState('+91 22 2683 0100');
  const [stationAddress, setStationAddress] = useState('');

  const refreshInstitutions = () => {
    setStations(getStoredStations());
    setCourts(getStoredCourts());
    setFslLabs(getStoredFslLabs());
  };

  useEffect(() => {
    refreshInstitutions();
    const handleEvents = () => refreshInstitutions();
    window.addEventListener('casevault:station-added', handleEvents);
    window.addEventListener('casevault:court-added', handleEvents);
    window.addEventListener('casevault:fsl-lab-added', handleEvents);
    return () => {
      window.removeEventListener('casevault:station-added', handleEvents);
      window.removeEventListener('casevault:court-added', handleEvents);
      window.removeEventListener('casevault:fsl-lab-added', handleEvents);
    };
  }, []);

  // Update default ranks and institution when role changes in modal
  const applyRoleDefaults = (role: PoliceRole) => {
    setSelectedRole(role);
    const defaultRanks = RANKS_BY_ROLE[role] || [];
    if (defaultRanks.length > 0) {
      setSelectedRank(defaultRanks[0]);
    }

    if (role === 'POLICE') {
      setAssignedInstitution(stations[0]?.name || 'Andheri Police Station, Mumbai');
      setBadgeNumber(`MH-POL-${Math.floor(1000 + Math.random() * 9000)}`);
      setMemberPassword('police123');
    } else if (role === 'FORENSIC') {
      setAssignedInstitution(fslLabs[0]?.name || 'State Forensic Science Laboratory (FSL), Kalina');
      setBadgeNumber(`FSL-MH-KALINA-${Math.floor(100 + Math.random() * 900)}`);
      setMemberPassword('fsl123');
    } else if (role === 'LEGAL') {
      setAssignedInstitution(courts[0]?.name || 'City Civil & Sessions Court, Mumbai');
      setBadgeNumber(`BAR-MH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setMemberPassword('court123');
    } else if (role === 'AUDITOR') {
      setAssignedInstitution('State Police Headquarters Vigilance & Audit Wing, Colaba');
      setBadgeNumber(`AUD-MH-${Math.floor(1000 + Math.random() * 9000)}`);
      setMemberPassword('auditor123');
    } else if (role === 'ADMIN') {
      setAssignedInstitution('Maharashtra Police Central Command, Mumbai');
      setBadgeNumber(`ADM-MH-${Math.floor(100 + Math.random() * 900)}`);
      setMemberPassword('admin123');
    }
  };

  // Open modal pre-configured for a specific department
  const openAddMemberModalForRole = (role: PoliceRole) => {
    soundEffects.playSnap();
    setMemberName('');
    setMemberUsername('');
    setMemberPhotoUrl('');
    applyRoleDefaults(role);
    setIsAddMemberModalOpen(true);
  };

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

  // Suggest username when name changes
  const handleNameChange = (name: string) => {
    setMemberName(name);
    if (!memberUsername || memberUsername.includes('@') || memberUsername.includes('.')) {
      const parts = name.trim().toLowerCase().replace(/^(dr\.|adv\.|inspector|psi|pi|sp|shri|smt)\s*/i, '').split(/\s+/).filter(Boolean);
      const firstName = parts[0] || (selectedRole === 'ADMIN' ? 'system' : 'officer');
      const lastName = parts.length > 1 ? parts[parts.length - 1] : (selectedRole === 'ADMIN' ? 'admin' : (selectedRole === 'POLICE' ? 'patil' : selectedRole === 'FORENSIC' ? 'sharma' : selectedRole === 'LEGAL' ? 'deshmukh' : 'jadhav'));
      const safeFirst = firstName.replace(/[^a-z0-9]/g, '');
      const safeLast = lastName.replace(/[^a-z0-9]/g, '');
      setMemberUsername(`${safeFirst}.${safeLast}@ecasevault.com`);
    }
  };

  const showNotice = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const fetchOfficers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.getOfficers();
      const loaded: OfficerProfile[] = [];

      if (res && res.success && Array.isArray(res.officers)) {
        res.officers.forEach((o: any) => {
          loaded.push({
            id: o.id || o.badgeNo,
            name: o.name || o.full_name || o.username,
            badgeNo: o.badgeNo || o.badge_no,
            rank: o.rank,
            station: o.station || o.station_id || 'Maharashtra Police Command',
            unit: o.department || o.role,
            contact: o.contact || '+91 98200 XXXXX',
            activeCases: Number(o.activeCasesCount ?? 0),
            completedCases: 0,
            currentWorkload: 'Optimal',
            status: o.status || 'ACTIVE_ON_DUTY',
            role: (o.role || 'POLICE').toUpperCase() as PoliceRole,
            email: `${(o.username || o.badgeNo || '').toLowerCase().replace(/[^a-z0-9]/g, '.')}@casevault.gov.in`,
            photoUrl: o.photoUrl || o.photo_url || undefined,
          });
        });
      }

      // Merge local custom created members
      const stored = getStoredMembers();
      stored.forEach(m => {
        if (!loaded.some(l => l.badgeNo.toLowerCase() === m.badgeNo.toLowerCase() || (l as any).username === m.username)) {
          loaded.unshift({
            id: m.id,
            name: m.fullName,
            badgeNo: m.badgeNo,
            rank: m.rank,
            station: m.stationOrInstitution,
            unit: m.department || m.role,
            contact: m.contactNumber || '+91 98200 XXXXX',
            activeCases: 0,
            completedCases: 0,
            currentWorkload: 'Optimal',
            status: 'ACTIVE_ON_DUTY',
            role: m.role,
            email: m.email || `${m.username}@casevault.gov.in`,
            photoUrl: m.photoUrl,
            username: m.username,
          } as any);
        }
      });

      setOfficers(loaded);
    } catch (err) {
      console.warn('Failed to load officers from backend, loading stored local roster', err);
      const stored = getStoredMembers();
      const mapped: OfficerProfile[] = stored.map(m => ({
        id: m.id,
        name: m.fullName,
        badgeNo: m.badgeNo,
        rank: m.rank,
        station: m.stationOrInstitution,
        unit: m.department || m.role,
        contact: m.contactNumber || '+91 98200 XXXXX',
        activeCases: 0,
        completedCases: 0,
        currentWorkload: 'Optimal',
        status: 'ACTIVE_ON_DUTY',
        role: m.role,
        email: m.email,
        photoUrl: m.photoUrl,
      }));
      setOfficers(mapped);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOfficers();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotice('Photo file exceeds 5MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMemberPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !badgeNumber.trim() || !memberUsername.trim()) return;

    soundEffects.playStamp();
    const finalPassword = memberPassword.trim() || `${selectedRole.toLowerCase()}123`;
    const finalUsername = memberUsername.trim().toLowerCase();

    // 1. Save to local persistent storage
    saveMemberToLocalStore({
      id: `USR-${Date.now().toString(36).toUpperCase()}`,
      username: finalUsername,
      password: finalPassword,
      fullName: memberName.trim(),
      badgeNo: badgeNumber.trim(),
      rank: selectedRank,
      role: selectedRole,
      stationOrInstitution: assignedInstitution,
      department: selectedRole,
      clearanceLevel: 'CONFIDENTIAL',
      contactNumber: memberContact,
      email: memberEmail || `${finalUsername}@mahapolice.gov.in`,
      photoUrl: memberPhotoUrl || undefined,
      status: 'ACTIVE_ON_DUTY',
      createdAt: new Date().toISOString(),
    });

    // 2. Call Backend API
    try {
      await apiClient.createOfficer({
        badgeNo: badgeNumber.trim(),
        username: finalUsername,
        password: finalPassword,
        fullName: memberName.trim(),
        rank: selectedRank,
        role: selectedRole,
        stationId: assignedInstitution,
        department: selectedRole,
        clearanceLevel: 'CONFIDENTIAL',
        photoUrl: memberPhotoUrl || undefined,
      });
    } catch {
      // Offline local store already saved
    }

    await fetchOfficers();
    onAuditAction?.('MEMBER_CREATED', `${memberName} (${badgeNumber})`, `Role: ${selectedRole}, Facility: ${assignedInstitution}`);
    showNotice(`✅ ${selectedRole} member ${memberName} created! Login ID: "${finalUsername}" | Password: "${finalPassword}". User can now sign in to the ${selectedRole} Dashboard.`);

    setIsAddMemberModalOpen(false);
    setMemberName('');
    setMemberUsername('');
    setMemberPhotoUrl('');
  };

  // Add Court Handler
  const handleCreateCourt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courtName.trim()) return;

    soundEffects.playStamp();
    const created = saveCourt({
      name: courtName.trim(),
      type: courtType,
      district: courtDistrict,
      bench: courtBench,
      presidingJudge: courtJudge,
      chiefRegistrar: courtRegistrar,
      contactNumber: courtContact,
      address: courtAddress,
      status: 'Operational (e-Filing Live)',
    });

    refreshInstitutions();
    setAssignedInstitution(created.name);
    setIsAddCourtModalOpen(false);
    showNotice(`Court "${created.name}" registered successfully.`);
    setCourtName('');
  };

  // Add Forensic Lab Handler
  const handleCreateLab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!labName.trim()) return;

    soundEffects.playStamp();
    const created = saveFslLab({
      name: labName.trim(),
      division: labDivision,
      city: labCity,
      director: labDirector,
      contactNumber: labContact,
      address: labAddress,
      activeSpecializations: labSpecialization.split(',').map(s => s.trim()),
      status: 'Accredited (ISO/IEC 17025)',
    });

    refreshInstitutions();
    setAssignedInstitution(created.name);
    setIsAddLabModalOpen(false);
    showNotice(`Forensic Laboratory "${created.name}" registered successfully.`);
    setLabName('');
  };

  // Add Police Station Handler
  const handleCreateStation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationName.trim()) return;

    soundEffects.playStamp();
    const created = saveStation({
      name: stationName.trim(),
      zone: stationZone,
      district: stationDistrict,
      pi: stationPI,
      strength: '36 Officers (6 Active IOs)',
      activeDockets: '0 Active Cases',
      malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
      contactNumber: stationContact,
      address: stationAddress,
      status: 'Fully Integrated',
    });

    refreshInstitutions();
    setAssignedInstitution(created.name);
    setIsAddStationModalOpen(false);
    showNotice(`Police Station "${created.name}" registered successfully.`);
    setStationName('');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    soundEffects.playSnap();
    showNotice(`Copied ${label}: "${text}" to clipboard!`);
  };

  // Section configurations for each department
  const DEPARTMENTS: DepartmentConfig[] = [
    {
      role: 'POLICE',
      title: 'Police Department Personnel',
      shortLabel: 'Police Officers',
      subtitle: 'Superintendents (SP), DySP, Station Inspectors, IOs, and Malkhana Custodians',
      icon: Briefcase,
      accentColor: 'text-blue-700',
      headerGradient: 'from-blue-900 to-indigo-950 text-white',
      borderClass: 'border-blue-200 bg-blue-50/20',
      badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
      addBtnText: '+ Add Police Officer',
      facilityBtnText: '+ Add Police Station',
      facilityIcon: Building2,
      onFacilityClick: () => {
        soundEffects.playSnap();
        setIsAddStationModalOpen(true);
      },
      dashboardLabel: 'Police Dashboard',
      badgePrefixHint: 'e.g. MH-POL-8842',
    },
    {
      role: 'FORENSIC',
      title: 'Forensic Science Laboratories (FSL)',
      shortLabel: 'Forensic Scientists',
      subtitle: 'Ballistics, Cyber Forensics, DNA Profiling, Chemical & Toxicology Lab Scientists',
      icon: Microscope,
      accentColor: 'text-purple-700',
      headerGradient: 'from-purple-900 to-slate-900 text-white',
      borderClass: 'border-purple-200 bg-purple-50/20',
      badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
      addBtnText: '+ Add FSL Scientist',
      facilityBtnText: '+ Add Forensic Lab',
      facilityIcon: Microscope,
      onFacilityClick: () => {
        soundEffects.playSnap();
        setIsAddLabModalOpen(true);
      },
      dashboardLabel: 'Forensic Lab Desk',
      badgePrefixHint: 'e.g. FSL-MH-KALINA-568',
    },
    {
      role: 'LEGAL',
      title: 'Judiciary & Public Prosecution',
      shortLabel: 'Courts & Judicial Members',
      subtitle: 'Sessions Judges, Metropolitan Magistrates, Special Public Prosecutors & Legal Advisors',
      icon: Scale,
      accentColor: 'text-amber-800',
      headerGradient: 'from-amber-950 to-slate-900 text-white',
      borderClass: 'border-amber-200 bg-amber-50/20',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      addBtnText: '+ Add Court Member',
      facilityBtnText: '+ Add Court of Law',
      facilityIcon: Scale,
      onFacilityClick: () => {
        soundEffects.playSnap();
        setIsAddCourtModalOpen(true);
      },
      dashboardLabel: 'Court & Prosecution Desk',
      badgePrefixHint: 'e.g. BAR-MH-2026-042',
    },
    {
      role: 'AUDITOR',
      title: 'State Vigilance & Compliance Auditors',
      shortLabel: 'Vigilance Auditors',
      subtitle: 'Independent Chain-of-Custody Vigilance, Evidence Vault & Blockchain Ledger Auditors',
      icon: ShieldCheck,
      accentColor: 'text-emerald-700',
      headerGradient: 'from-emerald-950 to-slate-900 text-white',
      borderClass: 'border-emerald-200 bg-emerald-50/20',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      addBtnText: '+ Add Vigilance Auditor',
      dashboardLabel: 'Vigilance Desk',
      badgePrefixHint: 'e.g. AUD-MH-4421',
    },
    {
      role: 'ADMIN',
      title: 'System & Vault Command Administrators',
      shortLabel: 'System Admins',
      subtitle: 'Central Command Infrastructure, Cryptographic Vault & Root Operations Administrators',
      icon: KeyRound,
      accentColor: 'text-rose-700',
      headerGradient: 'from-slate-900 to-slate-950 text-white',
      borderClass: 'border-slate-300 bg-slate-50/30',
      badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
      addBtnText: '+ Add System Admin',
      dashboardLabel: 'Command Root Desk',
      badgePrefixHint: 'e.g. ADM-MH-102',
    },
  ];

  // Helper to filter officers for a given department
  const getOfficersForRole = (role: PoliceRole) => {
    return officers.filter(o => {
      const matchesRole = o.role === role;
      const matchesSearch = !searchQuery ||
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.badgeNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (o.station && o.station.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (o.rank && o.rank.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((o as any).username && (o as any).username.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStation = stationFilter === 'ALL' || o.station === stationFilter;
      return matchesRole && matchesSearch && matchesStation;
    });
  };

  // Departments to render based on activeTab and caller permissions
  const visibleDepartments = !canSeeAll
    ? DEPARTMENTS.filter((d) => d.role === userRole)
    : activeTab === 'ALL'
    ? DEPARTMENTS
    : DEPARTMENTS.filter((d) => d.role === activeTab);

  // Top title text and badge based on role
  const headerTitle = !canSeeAll
    ? userRole === 'POLICE'
      ? 'Police Officers & Station Directory'
      : userRole === 'FORENSIC'
      ? 'Forensic Scientists (FSL) & Laboratory Roster'
      : 'Courts, Prosecutors & Judicial Roster'
    : isAuditor
    ? 'Institutional Personnel & Vigilance Inspection Roster'
    : 'Institutional Personnel & Department Roster';

  const headerSubtitle = !canSeeAll
    ? userRole === 'POLICE'
      ? 'Official active duty police personnel and investigating officers assigned across Maharashtra Police stations.'
      : userRole === 'FORENSIC'
      ? 'Directorate of Forensic Science Laboratories experts, chemical examiners and DNA analysts.'
      : 'District & sessions judges, magistrates, public prosecutors, and court judicial officers.'
    : isAuditor
    ? 'Read-only vigilance audit of all registered personnel across Maharashtra Police, Forensic Laboratories, Courts, and System Administration.'
    : 'Separate dedicated management sections for Police Officers, Forensic Scientists (FSL), Courts & Judges, Vigilance Auditors, and System Admins. Add new members directly inside their respective department section.';

  return (
    <div className="space-y-6">
      {/* Success Toast */}
      <AnimatePresence>
        {successNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-[#182f4d] text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-blue-400/40"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {headerTitle}
              </h1>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 font-bold text-[10px] rounded uppercase">
                {canSeeAll ? 'Central Registry' : `${userRole} Directory`}
              </span>
              {isAuditor && (
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 font-bold text-[10px] rounded uppercase flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-purple-700" />
                  View-Only Vigilance
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {headerSubtitle}
            </p>
          </div>

          {/* Quick Roster View Controls */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewStyle('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewStyle === 'grid' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Card Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewStyle('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  viewStyle === 'table' ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Roster Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span>Table Roster</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pillar Summary Counters */}
        {canSeeAll ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">
            {DEPARTMENTS.map((dept) => {
              const count = officers.filter((o) => o.role === dept.role).length;
              const Icon = dept.icon;
              const isSelected = activeTab === dept.role;
              return (
                <button
                  key={dept.role}
                  type="button"
                  onClick={() => {
                    soundEffects.playSnap();
                    setActiveTab(activeTab === dept.role ? 'ALL' : dept.role);
                  }}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#182f4d] text-white border-[#182f4d] shadow-xs ring-2 ring-blue-500/20'
                      : 'bg-slate-50/80 hover:bg-slate-100/80 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isSelected ? 'text-blue-200' : 'text-slate-500'
                      }`}
                    >
                      {dept.shortLabel}
                    </span>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-300' : dept.accentColor}`} />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-xl font-extrabold tracking-tight">{count}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-500'}`}>
                      Personnel
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-50 text-blue-900 border border-blue-200 font-bold text-xs rounded-lg flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-700" />
                <span>Active Personnel: <strong>{officers.filter((o) => o.role === userRole).length}</strong></span>
              </span>
              <span className="text-slate-500 font-medium">
                Showing exclusively {userRole === 'POLICE' ? 'Maharashtra Police personnel' : userRole === 'FORENSIC' ? 'FSL Scientific personnel' : 'Judicial court personnel'}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Badge: <span className="text-slate-700 font-bold">{session.badgeNo}</span> • Station: <span className="text-slate-700 font-bold">{session.station || 'Central Desk'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Section Tabs */}
        {canSeeAll ? (
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                soundEffects.playSnap();
                setActiveTab('ALL');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-[#182f4d] text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              📋 All Sections ({officers.length})
            </button>
            {DEPARTMENTS.map((dept) => {
              const count = officers.filter((o) => o.role === dept.role).length;
              const isTabActive = activeTab === dept.role;
              return (
                <button
                  key={dept.role}
                  type="button"
                  onClick={() => {
                    soundEffects.playSnap();
                    setActiveTab(dept.role);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isTabActive
                      ? 'bg-[#182f4d] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{dept.shortLabel}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isTabActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 bg-[#182f4d] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5">
              <span>{userRole === 'POLICE' ? 'Police Officers' : userRole === 'FORENSIC' ? 'Forensic Scientists' : 'Courts & Judicial Members'}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {officers.filter((o) => o.role === userRole).length}
              </span>
            </span>
          </div>
        )}

        {/* Search & Location Filter */}
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, ID, rank, or facility..."
              className="w-full sm:w-64 pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600"
            />
          </div>

          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-600 bg-white"
          >
            <option value="ALL">All Jurisdictions & Precincts</option>
            {[...new Set(officers.map(o => o.station).filter(Boolean))].map(stn => (
              <option key={stn} value={stn}>{stn}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Roster Sections */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
          Loading institutional personnel roster...
        </div>
      ) : (
        <div className="space-y-8">
          {visibleDepartments.map(dept => {
            const deptOfficers = getOfficersForRole(dept.role);
            const DeptIcon = dept.icon;
            const FacilityIcon = dept.facilityIcon || Building2;

            return (
              <section
                key={dept.role}
                id={`section-${dept.role}`}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs"
              >
                {/* Section Header Bar */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                      <DeptIcon className={`w-6 h-6 ${dept.accentColor}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                          {dept.title}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${dept.badgeClass}`}>
                          {deptOfficers.length} {deptOfficers.length === 1 ? 'Member' : 'Members'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {dept.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Section Action Buttons: + Add Member and + Add Facility (Admin only; Auditor view-only) */}
                  {canManageOfficers(session) ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {dept.facilityBtnText && dept.onFacilityClick && (
                        <button
                          type="button"
                          onClick={dept.onFacilityClick}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs"
                        >
                          <FacilityIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span>{dept.facilityBtnText}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openAddMemberModalForRole(dept.role)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{dept.addBtnText}</span>
                      </button>
                    </div>
                  ) : isAuditor ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold rounded-xl shadow-2xs">
                      <ShieldCheck className="w-4 h-4 text-purple-700" />
                      <span>Auditor Oversight (View Only)</span>
                    </div>
                  ) : null}
                </div>

                {/* Section Content: Officers List */}
                <div className="p-4 sm:p-5">
                  {deptOfficers.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
                      <DeptIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-700">
                        No {dept.shortLabel} found
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        {searchQuery 
                          ? `No ${dept.shortLabel.toLowerCase()} match your search query "${searchQuery}".` 
                          : canManageOfficers(session)
                          ? `No personnel currently registered in the ${dept.title}. Click below to add the first member.`
                          : `No personnel currently registered in the ${dept.title}. Contact Central Command / System Administrator to provision personnel.`}
                      </p>
                      {canManageOfficers(session) && (
                        <button
                          type="button"
                          onClick={() => openAddMemberModalForRole(dept.role)}
                          className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{dept.addBtnText}</span>
                        </button>
                      )}
                    </div>
                  ) : viewStyle === 'grid' ? (
                    /* CARD GRID VIEW */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {deptOfficers.map((officer) => {
                        const usernameToDisplay = (officer as any).username || (officer.email ? officer.email.split('@')[0] : officer.badgeNo.toLowerCase());

                        return (
                          <div
                            key={officer.id || officer.badgeNo}
                            className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
                          >
                            <div>
                              {/* Top Bar with Designation & Status */}
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${dept.badgeClass}`}>
                                  {officer.rank}
                                </span>
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Active Duty
                                </span>
                              </div>

                              {/* Officer Identity */}
                              <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-700 font-bold text-sm shadow-2xs">
                                  {officer.photoUrl ? (
                                    <img src={officer.photoUrl} alt={officer.name} className="w-full h-full object-cover" />
                                  ) : (
                                    officer.name.slice(0, 2).toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-bold text-slate-900 truncate">
                                    {officer.name}
                                  </h3>
                                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    ID/Badge: <span className="font-semibold text-slate-800">{officer.badgeNo}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Credentials Box */}
                              <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 text-[10px]">Official Login ID:</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(usernameToDisplay, 'Login ID')}
                                    className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold cursor-pointer"
                                    title="Click to copy Login ID"
                                  >
                                    <span>{usernameToDisplay}</span>
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-200/60 pt-1 text-[10px]">
                                  <span className="text-slate-500">Access Scope:</span>
                                  <span className="text-blue-900 font-bold">{dept.dashboardLabel}</span>
                                </div>
                              </div>

                              {/* Assigned Institution */}
                              <div className="mt-2.5 flex items-start gap-1.5 text-xs text-slate-600">
                                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                <span className="truncate">{officer.station}</span>
                              </div>
                            </div>

                            {/* Card Footer */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {officer.contact}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(usernameToDisplay, 'Login ID')}
                                className="text-blue-600 hover:underline font-medium text-[10px] cursor-pointer"
                              >
                                Copy Credentials
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* COMPACT TABLE ROSTER VIEW */
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">Member Name</th>
                            <th className="py-2.5 px-3">Designation / Rank</th>
                            <th className="py-2.5 px-3">Badge / Official ID</th>
                            <th className="py-2.5 px-3">Assigned Facility</th>
                            <th className="py-2.5 px-3">Official Login ID</th>
                            <th className="py-2.5 px-3">Contact</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {deptOfficers.map(officer => {
                            const usernameToDisplay = (officer as any).username || (officer.email ? officer.email.split('@')[0] : officer.badgeNo.toLowerCase());
                            return (
                              <tr key={officer.id || officer.badgeNo} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden text-slate-700 font-bold text-xs">
                                    {officer.photoUrl ? (
                                      <img src={officer.photoUrl} alt={officer.name} className="w-full h-full object-cover" />
                                    ) : (
                                      officer.name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <span className="truncate max-w-[180px]">{officer.name}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-medium">{officer.rank}</td>
                                <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{officer.badgeNo}</td>
                                <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">{officer.station}</td>
                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(usernameToDisplay, 'Login ID')}
                                    className="font-mono text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>{usernameToDisplay}</span>
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono">{officer.contact}</td>
                                <td className="py-2.5 px-3">
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Active Duty
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(usernameToDisplay, 'Login ID')}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold cursor-pointer"
                                  >
                                    Copy ID
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: PROVISION NEW MEMBER ================= */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-600" />
                  <span>
                    {selectedRole === 'POLICE' ? 'Provision Police Officer' :
                     selectedRole === 'FORENSIC' ? 'Provision Forensic Scientist (FSL)' :
                     selectedRole === 'LEGAL' ? 'Provision Court Member & Judiciary' :
                     selectedRole === 'AUDITOR' ? 'Provision Vigilance Auditor' :
                     'Provision System Administrator'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assign official credentials. Member will automatically be routed strictly to their dedicated dashboard on login.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4">
              {/* Department Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Department & Target Dashboard Access *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { role: 'POLICE', label: '👮 Police Officer', desc: 'Police Dashboard' },
                    { role: 'FORENSIC', label: '🔬 FSL Scientist', desc: 'Forensic Lab Desk' },
                    { role: 'LEGAL', label: '⚖️ Court Member', desc: 'Court & Prosecution' },
                    { role: 'AUDITOR', label: '🛡️ Vigilance Auditor', desc: 'Vigilance Desk' },
                    { role: 'ADMIN', label: '⚡ System Admin', desc: 'Command Admin' },
                  ].map(item => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => applyRoleDefaults(item.role as PoliceRole)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        selectedRole === item.role
                          ? 'bg-[#182f4d] text-white border-[#182f4d] shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{item.label}</div>
                      <div className={`text-[10px] mt-0.5 truncate ${selectedRole === item.role ? 'text-blue-200' : 'text-slate-400'}`}>
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Full Name & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name & Salutation *
                  </label>
                  <input
                    type="text"
                    value={memberName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={
                      selectedRole === 'POLICE' ? 'e.g. Inspector Ramesh K. Pawar' :
                      selectedRole === 'FORENSIC' ? 'e.g. Dr. Smita Rao (Sr. Scientist)' :
                      selectedRole === 'LEGAL' ? 'e.g. Hon. A. S. Deshmukh or Adv. PP' :
                      'e.g. Officer Vikram V. Patil'
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {selectedRole === 'POLICE' ? 'Official Police Badge Number *' :
                     selectedRole === 'FORENSIC' ? 'FSL Scientist ID *' :
                     selectedRole === 'LEGAL' ? 'Bar Council / Judicial ID *' :
                     selectedRole === 'AUDITOR' ? 'Auditor ID *' : 'Admin ID *'}
                  </label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder={
                      selectedRole === 'POLICE' ? 'MH-POL-8842' :
                      selectedRole === 'FORENSIC' ? 'FSL-MH-KALINA-568' :
                      selectedRole === 'LEGAL' ? 'BAR-MH-2026-042' :
                      selectedRole === 'AUDITOR' ? 'AUD-MH-4421' : 'ADM-MH-102'
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              {/* Credentials (ID & Password) */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span>Login Credentials (Official Member ID & Password)</span>
                  </div>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-300">
                    Auto-routes to {selectedRole} Dashboard
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Official Username / Login ID *
                    </label>
                    <input
                      type="text"
                      value={memberUsername}
                      onChange={(e) => setMemberUsername(e.target.value)}
                      placeholder={selectedRole === 'POLICE' ? 'rajesh.patil@ecasevault.com' : selectedRole === 'FORENSIC' ? 'neha.sharma@ecasevault.com' : selectedRole === 'LEGAL' ? 'amit.deshmukh@ecasevault.com' : 'username@ecasevault.com'}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-blue-600"
                      required
                    />
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-500 font-medium">Domain:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const base = memberUsername.includes('@') ? memberUsername.split('@')[0] : (memberUsername || 'rajesh.patil');
                          setMemberUsername(`${base}@ecasevault.com`);
                        }}
                        className={`px-1.5 py-0.5 text-[9.5px] font-mono rounded border transition-all cursor-pointer ${
                          memberUsername.endsWith('@ecasevault.com')
                            ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-2xs'
                            : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
                        }`}
                      >
                        @ecasevault.com
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base = memberUsername.includes('@') ? memberUsername.split('@')[0] : (memberUsername || 'rajesh.patil');
                          setMemberUsername(`${base}@${getRoleDomain(selectedRole)}`);
                        }}
                        className={`px-1.5 py-0.5 text-[9.5px] font-mono rounded border transition-all cursor-pointer ${
                          memberUsername.endsWith(`@${getRoleDomain(selectedRole)}`)
                            ? 'bg-[#182f4d] text-white border-[#182f4d] font-semibold shadow-2xs'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        @{getRoleDomain(selectedRole)}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Used by member to sign in directly into {selectedRole} portal</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Login Password *</span>
                      <button
                        type="button"
                        onClick={() => setMemberPassword(`${selectedRole.toLowerCase()}123`)}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                      >
                        Reset Default
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={memberPassword}
                        onChange={(e) => setMemberPassword(e.target.value)}
                        placeholder="Set password (min 6 characters)"
                        className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none focus:border-blue-600"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Min 6 characters</p>
                  </div>
                </div>
              </div>

              {/* Rank & Institution Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Designation / Rank *
                  </label>
                  <select
                    value={selectedRank}
                    onChange={(e) => setSelectedRank(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 bg-white"
                  >
                    {(RANKS_BY_ROLE[selectedRole] || []).map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>
                      {selectedRole === 'FORENSIC' ? 'Forensic Science Lab *' :
                       selectedRole === 'LEGAL' ? 'Assigned Court / Bench *' :
                       selectedRole === 'POLICE' ? 'Police Station *' :
                       'Assigned Facility *'}
                    </span>
                    {selectedRole === 'LEGAL' && (
                      <button
                        type="button"
                        onClick={() => setIsAddCourtModalOpen(true)}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                      >
                        + New Court
                      </button>
                    )}
                    {selectedRole === 'FORENSIC' && (
                      <button
                        type="button"
                        onClick={() => setIsAddLabModalOpen(true)}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                      >
                        + New Lab
                      </button>
                    )}
                    {selectedRole === 'POLICE' && (
                      <button
                        type="button"
                        onClick={() => setIsAddStationModalOpen(true)}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                      >
                        + New Station
                      </button>
                    )}
                  </label>
                  <select
                    value={assignedInstitution}
                    onChange={(e) => setAssignedInstitution(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 bg-white"
                  >
                    {selectedRole === 'FORENSIC' && fslLabs.map(l => (
                      <option key={l.id} value={l.name}>{l.name} ({l.city})</option>
                    ))}
                    {selectedRole === 'LEGAL' && courts.map(c => (
                      <option key={c.id} value={c.name}>{c.name} ({c.district})</option>
                    ))}
                    {selectedRole === 'POLICE' && stations.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {(selectedRole === 'AUDITOR' || selectedRole === 'ADMIN') && (
                      <>
                        <option value="State Police Headquarters Vigilance & Audit Wing, Colaba">State Police Headquarters Vigilance, Colaba</option>
                        <option value="Maharashtra Police Central Command, Mumbai">Maharashtra Police Central Command, Mumbai</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Photo Upload & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={memberContact}
                    onChange={(e) => setMemberContact(e.target.value)}
                    placeholder="+91 98200 XXXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Official Photo (Optional)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span>{memberPhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    {memberPhotoUrl && (
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-300">
                        <img src={memberPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-xl shadow cursor-pointer"
                >
                  Confirm & Provision Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD COURT ================= */}
      {isAddCourtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-600" />
                Register New Court of Law
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCourtModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCourt} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Court Name *</label>
                <input
                  type="text"
                  value={courtName}
                  onChange={(e) => setCourtName(e.target.value)}
                  placeholder="e.g. Special PMLA & CBI Court, Mumbai"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Court Tier</label>
                  <select
                    value={courtType}
                    onChange={(e) => setCourtType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="SESSIONS_COURT">Sessions Court</option>
                    <option value="MAGISTRATE_COURT">Magistrate Court</option>
                    <option value="SPECIAL_COURT">Special Court (NDPS/CBI)</option>
                    <option value="HIGH_COURT">High Court</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">District / City</label>
                  <input
                    type="text"
                    value={courtDistrict}
                    onChange={(e) => setCourtDistrict(e.target.value)}
                    placeholder="e.g. Mumbai Suburban"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Presiding Judge</label>
                <input
                  type="text"
                  value={courtJudge}
                  onChange={(e) => setCourtJudge(e.target.value)}
                  placeholder="e.g. Hon'ble Principal Sessions Judge"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Complex Address</label>
                <input
                  type="text"
                  value={courtAddress}
                  onChange={(e) => setCourtAddress(e.target.value)}
                  placeholder="e.g. Old Secretariat Building, Fort, Mumbai - 400032"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCourtModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Register Court
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD FORENSIC LAB ================= */}
      {isAddLabModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Microscope className="w-4 h-4 text-purple-600" />
                Register Forensic Science Laboratory (FSL)
              </h3>
              <button
                type="button"
                onClick={() => setIsAddLabModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLab} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Laboratory Name *</label>
                <input
                  type="text"
                  value={labName}
                  onChange={(e) => setLabName(e.target.value)}
                  placeholder="e.g. Regional Forensic Science Laboratory, Kolhapur"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Division</label>
                  <select
                    value={labDivision}
                    onChange={(e) => setLabDivision(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="REGIONAL_FSL">Regional FSL</option>
                    <option value="CENTRAL_FSL">Central State FSL</option>
                    <option value="CYBER_DIGITAL">Cyber & Digital Forensics</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Region</label>
                  <input
                    type="text"
                    value={labCity}
                    onChange={(e) => setLabCity(e.target.value)}
                    placeholder="e.g. Kolhapur"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lab Director</label>
                <input
                  type="text"
                  value={labDirector}
                  onChange={(e) => setLabDirector(e.target.value)}
                  placeholder="e.g. Dr. Ramesh P. Deshmukh"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Specializations (Comma separated)</label>
                <input
                  type="text"
                  value={labSpecialization}
                  onChange={(e) => setLabSpecialization(e.target.value)}
                  placeholder="DNA Profiling, Ballistics, Chemical, Cyber"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLabModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Register FSL Lab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD POLICE STATION ================= */}
      {isAddStationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                Register New Police Station
              </h3>
              <button
                type="button"
                onClick={() => setIsAddStationModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStation} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Police Station Name *</label>
                <input
                  type="text"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  placeholder="e.g. Oshiwara Police Station, Mumbai"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Zone</label>
                  <input
                    type="text"
                    value={stationZone}
                    onChange={(e) => setStationZone(e.target.value)}
                    placeholder="Zone IX (Western Suburbs)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
                  <input
                    type="text"
                    value={stationDistrict}
                    onChange={(e) => setStationDistrict(e.target.value)}
                    placeholder="Mumbai Suburban"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PI / Station In-Charge</label>
                <input
                  type="text"
                  value={stationPI}
                  onChange={(e) => setStationPI(e.target.value)}
                  placeholder="Inspector Name"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Station Address</label>
                <input
                  type="text"
                  value={stationAddress}
                  onChange={(e) => setStationAddress(e.target.value)}
                  placeholder="Station Road, Mumbai"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStationModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Register Station
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
