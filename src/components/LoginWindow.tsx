import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MaharashtraPoliceEmblem } from './Emblem';
import { BasReliefEmblem } from './BasReliefEmblem';
import { soundEffects } from './AudioEffects';
import { UserSession, DepartmentStakeholder, ClearanceLevel, PoliceRole } from '../types';
import { loginViaApi, apiClient } from '../services/apiClient';
import { 
  Eye, 
  EyeOff, 
  AlertCircle,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  Building2
} from 'lucide-react';
import { getStoredMembers } from '../utils/institutionStorage';

interface LoginWindowProps {
  onLoginSuccess: (session: UserSession) => void;
  onBackToIntro: () => void;
}

export const LoginWindow: React.FC<LoginWindowProps> = ({
  onLoginSuccess,
  onBackToIntro: _onBackToIntro,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PoliceRole>('POLICE');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // TOTP Multi-Factor Authentication State
  const [isMfaPending, setIsMfaPending] = useState(false);
  const [mfaTempToken, setMfaTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccessNotice, setForgotSuccessNotice] = useState<string | null>(null);

  const getFallbackUserSession = (role: PoliceRole, usr: string): UserSession => {
    const usrLower = (usr || '').trim().toLowerCase();

    // Dedicated Station IO Sessions
    if (['io.dadar@police.gov', 'dadar.io', 'dadar@demo', 'dadar'].includes(usrLower)) {
      return {
        username: usr || 'io.dadar@police.gov',
        officerName: 'Inspector Sachin R. Kadam',
        rank: 'Police Inspector (IO)',
        badgeNo: 'MH-POL-DAD-401',
        station: 'Dadar Police Station, Mumbai',
        department: 'POLICE_INVESTIGATION',
        clearanceLevel: 'CONFIDENTIAL',
        role: 'POLICE',
        isLoggedIn: true,
      };
    }
    if (['io.worli@police.gov', 'worli.io', 'worli@demo', 'worli'].includes(usrLower)) {
      return {
        username: usr || 'io.worli@police.gov',
        officerName: 'Inspector Arvind B. Shinde',
        rank: 'Police Inspector (IO)',
        badgeNo: 'MH-POL-WOR-101',
        station: 'Worli Police Station, Mumbai',
        department: 'POLICE_INVESTIGATION',
        clearanceLevel: 'CONFIDENTIAL',
        role: 'POLICE',
        isLoggedIn: true,
      };
    }
    if (['io.bandra@police.gov', 'bandra.io', 'bandra@demo', 'bandra'].includes(usrLower)) {
      return {
        username: usr || 'io.bandra@police.gov',
        officerName: 'Inspector Sunil M. Kadam',
        rank: 'Police Inspector (IO)',
        badgeNo: 'MH-POL-BAN-201',
        station: 'Bandra Police Station, Mumbai',
        department: 'POLICE_INVESTIGATION',
        clearanceLevel: 'CONFIDENTIAL',
        role: 'POLICE',
        isLoggedIn: true,
      };
    }
    if (['io.colaba@police.gov', 'colaba.io', 'colaba@demo', 'colaba'].includes(usrLower)) {
      return {
        username: usr || 'io.colaba@police.gov',
        officerName: 'Inspector Dilip M. Mane',
        rank: 'Police Inspector (IO)',
        badgeNo: 'MH-POL-COL-301',
        station: 'Colaba Police Station, Mumbai',
        department: 'POLICE_INVESTIGATION',
        clearanceLevel: 'CONFIDENTIAL',
        role: 'POLICE',
        isLoggedIn: true,
      };
    }
    if (['io.andheri@police.gov', 'andheri.io', 'andheri'].includes(usrLower)) {
      return {
        username: usr || 'io.andheri@police.gov',
        officerName: 'Inspector Rajesh Patil',
        rank: 'Police Inspector (IO)',
        badgeNo: 'MH-POL-8842',
        station: 'Andheri Police Station, Mumbai',
        department: 'POLICE_INVESTIGATION',
        clearanceLevel: 'CONFIDENTIAL',
        role: 'POLICE',
        isLoggedIn: true,
      };
    }

    const defaultSession: UserSession = {
      username: usr || 'rajesh.patil@ecasevault.com',
      officerName: usr === 'sujal@police.gov' ? 'Officer Sujal' : usr === 'rutuja@police.gov' ? 'Officer Rutuja' : 'Officer',
      rank: 'Police Inspector',
      badgeNo: 'MH-POL-8842',
      station: 'Andheri Police Station, Mumbai',
      department: 'POLICE_INVESTIGATION',
      clearanceLevel: 'CONFIDENTIAL',
      role: 'POLICE',
      isLoggedIn: true,
    };

    switch (role) {
      case 'FORENSIC':
        return {
          ...defaultSession,
          officerName: usr === 'tanaya@forensic.gov' ? 'Scientist Tanaya' : 'Dr. Neha Sharma',
          rank: 'Chief Forensic Scientist',
          badgeNo: 'FSL-MH-KALINA-042',
          station: 'State Forensic Science Laboratory, Kalina, Mumbai',
          department: 'FORENSIC_FSL',
          clearanceLevel: 'TOP_SECRET_INVESTIGATION',
          role: 'FORENSIC',
        };
      case 'LEGAL':
        return {
          ...defaultSession,
          officerName: usr === 'viraj@legal.gov' ? 'Advocate Viraj' : 'Adv. Amit Deshmukh',
          rank: 'Public Prosecutor',
          badgeNo: 'BAR-MH-2011-582',
          station: 'Directorate of Public Prosecution, Mumbai Sessions Court',
          department: 'PROSECUTION_LEGAL',
          clearanceLevel: 'RESTRICTED',
          role: 'LEGAL',
        };
      case 'AUDITOR':
        return {
          ...defaultSession,
          officerName: 'Priya Jadhav',
          rank: 'Senior Vigilance & Security Auditor',
          badgeNo: 'AUD-MH-9901',
          station: 'State Police Headquarters Vigilance & Audit Wing, Colaba',
          department: 'POLICE_INVESTIGATION',
          clearanceLevel: 'TOP_SECRET_INVESTIGATION',
          role: 'AUDITOR',
        };
      case 'ADMIN':
        return {
          ...defaultSession,
          officerName: usr === 'amay@admin.gov' ? 'Administrator Amay' : 'System Administrator',
          rank: 'System Administrator',
          badgeNo: 'ADM-MH-001',
          station: 'Maharashtra Police Central Command, Mumbai',
          department: 'POLICE_INVESTIGATION',
          clearanceLevel: 'TOP_SECRET_INVESTIGATION',
          role: 'ADMIN',
        };
      case 'POLICE':
      default:
        return defaultSession;
    }
  };

  // Auto-detect role as the user types their username or ID
  const detectedRole = React.useMemo<PoliceRole | null>(() => {
    const raw = username.trim().toLowerCase();
    if (!raw) return null;

    // 1. Check custom stored members in localStorage (by username, email, or badge)
    const storedMembers = getStoredMembers();
    const match = storedMembers.find(
      (m) => m.username.toLowerCase() === raw || (m.email && m.email.toLowerCase() === raw) || m.badgeNo.toLowerCase() === raw
    );
    if (match) {
      return match.role as PoliceRole;
    }

    // 2. Check canonical email formats requested by user
    if ([
      'rajesh.patil@ecasevault.com', 'rajesh.patil@police.com',
      'police.officer', 'police', 'police@demo', 'pi.patil', 'psi.deshmukh', 'investigator.io', 'jail@demo', 'ncrb@demo',
      'io.dadar@police.gov', 'dadar.io', 'dadar@demo', 'dadar',
      'io.worli@police.gov', 'worli.io', 'worli@demo', 'worli',
      'io.bandra@police.gov', 'bandra.io', 'bandra@demo', 'bandra',
      'io.colaba@police.gov', 'colaba.io', 'colaba@demo', 'colaba',
      'io.andheri@police.gov', 'andheri.io', 'andheri'
    ].includes(raw) || raw.startsWith('io.') || raw.endsWith('.io')) {
      return 'POLICE';
    }
    if ([
      'neha.sharma@ecasevault.com', 'neha.sharma@forensic.com',
      'forensic.expert', 'forensic', 'forensic@demo', 'fsl'
    ].includes(raw)) {
      return 'FORENSIC';
    }
    if ([
      'amit.deshmukh@ecasevault.com', 'amit.deshmukh@legal.com',
      'legal.officer', 'legal', 'legal@demo', 'prosecutor'
    ].includes(raw)) {
      return 'LEGAL';
    }
    if ([
      'priya.jadhav@ecasevault.com', 'priya.jadhav@auditor.com',
      'auditor.security', 'auditor', 'auditor@demo', 'audit'
    ].includes(raw)) {
      return 'AUDITOR';
    }
    if ([
      'system.admin@ecasevault.com', 'system.admin@admin.com',
      'admin.vault', 'admin', 'admin@demo', 'administrator'
    ].includes(raw)) {
      return 'ADMIN';
    }

    // 3. Domain endings (e.g. firstname.lastname@police.com)
    if (raw.endsWith('@police.com') || raw.endsWith('@police.gov.in')) {
      return 'POLICE';
    }
    if (raw.endsWith('@forensic.com') || raw.endsWith('@fsl.gov.in') || raw.endsWith('@fsl.com')) {
      return 'FORENSIC';
    }
    if (raw.endsWith('@legal.com') || raw.endsWith('@court.gov.in') || raw.endsWith('@court.com')) {
      return 'LEGAL';
    }
    if (raw.endsWith('@auditor.com') || raw.endsWith('@audit.gov.in') || raw.endsWith('@audit.com')) {
      return 'AUDITOR';
    }
    if (raw.endsWith('@admin.com') || raw.endsWith('@casevault.internal')) {
      return 'ADMIN';
    }

    // 4. Fallback heuristic from username prefixes
    if (raw.startsWith('police.') || raw.startsWith('police@') || raw.startsWith('mh-pol-') || raw.startsWith('mh-psi-') || raw.startsWith('mh-pi-')) {
      return 'POLICE';
    }
    if (raw.startsWith('fsl.') || raw.startsWith('forensic.') || raw.startsWith('forensic@') || raw.startsWith('fsl-mh-')) {
      return 'FORENSIC';
    }
    if (raw.startsWith('court.') || raw.startsWith('legal.') || raw.startsWith('legal@') || raw.startsWith('bar-mh-')) {
      return 'LEGAL';
    }
    if (raw.startsWith('auditor.') || raw.startsWith('auditor@') || raw.startsWith('audit.') || raw.startsWith('aud-mh-')) {
      return 'AUDITOR';
    }
    if (raw.startsWith('admin.') || raw.startsWith('admin@') || raw.startsWith('adm-mh-') || raw.startsWith('system.admin')) {
      return 'ADMIN';
    }

    return null;
  }, [username]);

  // Sync selectedRole with detectedRole automatically
  React.useEffect(() => {
    if (detectedRole && detectedRole !== selectedRole) {
      setSelectedRole(detectedRole);
    }
  }, [detectedRole, selectedRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Please enter your username and password');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    soundEffects.playSnap();

    try {
      const res = await loginViaApi(username, password);
      if (res.mfaRequired && res.tempToken) {
        soundEffects.playSnap();
        setIsMfaPending(true);
        setMfaTempToken(res.tempToken);
        setErrorMsg(null);
        return;
      }

      const user = res.user || res.session;
      if (res.success && user) {
        soundEffects.playLoginSuccess();
        const role = ((user.role || '').toUpperCase() as PoliceRole) || detectedRole || selectedRole;
        onLoginSuccess({
          username: user.username,
          officerName: user.full_name || user.officerName || 'Officer',
          rank: user.rank || role,
          badgeNo: user.badge_no || user.badgeNo || 'MH-POL-1001',
          station: user.station || user.station_name || 'Andheri Police Station, Mumbai',
          department: (user.department as DepartmentStakeholder) || 'POLICE_INVESTIGATION',
          clearanceLevel: (user.clearance_level as ClearanceLevel) || 'CONFIDENTIAL',
          role: role,
          isLoggedIn: true,
        });
        return;
      }

      // Also check if local registered member created by Admin matches
      const stored = getStoredMembers().find(m => 
        (m.username.toLowerCase() === username.trim().toLowerCase() || 
         (m.email && m.email.toLowerCase() === username.trim().toLowerCase()) ||
         m.badgeNo.toLowerCase() === username.trim().toLowerCase())
      );
      if (stored) {
        if (stored.password === password.trim()) {
          soundEffects.playLoginSuccess();
          onLoginSuccess({
            username: stored.username,
            officerName: stored.fullName,
            rank: stored.rank,
            badgeNo: stored.badgeNo,
            station: stored.stationOrInstitution,
            department: (stored.department as DepartmentStakeholder) || 'POLICE_INVESTIGATION',
            clearanceLevel: (stored.clearanceLevel as ClearanceLevel) || 'CONFIDENTIAL',
            role: stored.role as PoliceRole,
            isLoggedIn: true,
          });
          return;
        } else {
          setErrorMsg('Invalid password for this account. Please re-enter your password.');
          return;
        }
      }

      // Check canonical demo email accounts directly
      const canonicalDemoAccounts: Record<string, { role: PoliceRole; pass: string }> = {
        'rajesh.patil@ecasevault.com': { role: 'POLICE', pass: 'police123' },
        'rajesh.patil@police.com': { role: 'POLICE', pass: 'police123' },
        'police.officer': { role: 'POLICE', pass: 'police123' },
        'neha.sharma@ecasevault.com': { role: 'FORENSIC', pass: 'forensic123' },
        'neha.sharma@forensic.com': { role: 'FORENSIC', pass: 'forensic123' },
        'forensic.expert': { role: 'FORENSIC', pass: 'forensic123' },
        'amit.deshmukh@ecasevault.com': { role: 'LEGAL', pass: 'court123' },
        'amit.deshmukh@legal.com': { role: 'LEGAL', pass: 'court123' },
        'legal.officer': { role: 'LEGAL', pass: 'legal123' },
        'priya.jadhav@ecasevault.com': { role: 'AUDITOR', pass: 'audit123' },
        'priya.jadhav@auditor.com': { role: 'AUDITOR', pass: 'audit123' },
        'auditor.security': { role: 'AUDITOR', pass: 'audit123' },
        'system.admin@ecasevault.com': { role: 'ADMIN', pass: 'admin123' },
        'system.admin@admin.com': { role: 'ADMIN', pass: 'admin123' },
        'admin.vault': { role: 'ADMIN', pass: 'admin123' },
        'admin': { role: 'ADMIN', pass: 'admin' },
        'io.dadar@police.gov': { role: 'POLICE', pass: 'police123' },
        'dadar.io': { role: 'POLICE', pass: 'police123' },
        'dadar@demo': { role: 'POLICE', pass: 'police123' },
        'dadar': { role: 'POLICE', pass: 'police123' },
        'io.worli@police.gov': { role: 'POLICE', pass: 'police123' },
        'worli.io': { role: 'POLICE', pass: 'police123' },
        'worli@demo': { role: 'POLICE', pass: 'police123' },
        'worli': { role: 'POLICE', pass: 'police123' },
        'io.bandra@police.gov': { role: 'POLICE', pass: 'police123' },
        'bandra.io': { role: 'POLICE', pass: 'police123' },
        'bandra@demo': { role: 'POLICE', pass: 'police123' },
        'bandra': { role: 'POLICE', pass: 'police123' },
        'io.colaba@police.gov': { role: 'POLICE', pass: 'police123' },
        'colaba.io': { role: 'POLICE', pass: 'police123' },
        'colaba@demo': { role: 'POLICE', pass: 'police123' },
        'colaba': { role: 'POLICE', pass: 'police123' },
        'io.andheri@police.gov': { role: 'POLICE', pass: 'police123' },
        'andheri.io': { role: 'POLICE', pass: 'police123' },
        'andheri': { role: 'POLICE', pass: 'police123' },
        'sujal@police.gov': { role: 'POLICE', pass: 'sujal' },
        'rutuja@police.gov': { role: 'POLICE', pass: 'rutuja' },
        'tanaya@forensic.gov': { role: 'FORENSIC', pass: 'tanaya' },
        'viraj@legal.gov': { role: 'LEGAL', pass: 'viraj' },
        'amay@admin.gov': { role: 'ADMIN', pass: 'amay' },
      };

      const normalized = username.trim().toLowerCase();
      if (canonicalDemoAccounts[normalized]) {
        const entry = canonicalDemoAccounts[normalized];
        if (password.trim() === entry.pass) {
          soundEffects.playLoginSuccess();
          onLoginSuccess(getFallbackUserSession(entry.role, username.trim()));
          return;
        } else {
          setErrorMsg('Invalid password for demo account.');
          return;
        }
      }

      setErrorMsg(res?.error || 'Authentication failed. Please check credentials.');
    } catch (err: any) {
      // Check local registered members store first
      const stored = getStoredMembers().find(m => 
        (m.username.toLowerCase() === username.trim().toLowerCase() || 
         (m.email && m.email.toLowerCase() === username.trim().toLowerCase()) ||
         m.badgeNo.toLowerCase() === username.trim().toLowerCase())
      );
      if (stored) {
        if (stored.password === password.trim()) {
          soundEffects.playLoginSuccess();
          onLoginSuccess({
            username: stored.username,
            officerName: stored.fullName,
            rank: stored.rank,
            badgeNo: stored.badgeNo,
            station: stored.stationOrInstitution,
            department: (stored.department as DepartmentStakeholder) || 'POLICE_INVESTIGATION',
            clearanceLevel: (stored.clearanceLevel as ClearanceLevel) || 'CONFIDENTIAL',
            role: stored.role as PoliceRole,
            isLoggedIn: true,
          });
          return;
        } else {
          setErrorMsg('Invalid password for this account. Please re-enter your password.');
          return;
        }
      }

      // Check canonical demo accounts in offline fallback
      const canonicalDemoAccounts: Record<string, { role: PoliceRole; pass: string }> = {
        'rajesh.patil@ecasevault.com': { role: 'POLICE', pass: 'police123' },
        'rajesh.patil@police.com': { role: 'POLICE', pass: 'police123' },
        'police.officer': { role: 'POLICE', pass: 'police123' },
        'neha.sharma@ecasevault.com': { role: 'FORENSIC', pass: 'forensic123' },
        'neha.sharma@forensic.com': { role: 'FORENSIC', pass: 'forensic123' },
        'forensic.expert': { role: 'FORENSIC', pass: 'forensic123' },
        'amit.deshmukh@ecasevault.com': { role: 'LEGAL', pass: 'court123' },
        'amit.deshmukh@legal.com': { role: 'LEGAL', pass: 'court123' },
        'legal.officer': { role: 'LEGAL', pass: 'legal123' },
        'priya.jadhav@ecasevault.com': { role: 'AUDITOR', pass: 'audit123' },
        'priya.jadhav@auditor.com': { role: 'AUDITOR', pass: 'audit123' },
        'auditor.security': { role: 'AUDITOR', pass: 'audit123' },
        'system.admin@ecasevault.com': { role: 'ADMIN', pass: 'admin123' },
        'system.admin@admin.com': { role: 'ADMIN', pass: 'admin123' },
        'admin.vault': { role: 'ADMIN', pass: 'admin123' },
        'admin': { role: 'ADMIN', pass: 'admin' },
        'io.dadar@police.gov': { role: 'POLICE', pass: 'police123' },
        'dadar.io': { role: 'POLICE', pass: 'police123' },
        'dadar@demo': { role: 'POLICE', pass: 'police123' },
        'dadar': { role: 'POLICE', pass: 'police123' },
        'io.worli@police.gov': { role: 'POLICE', pass: 'police123' },
        'worli.io': { role: 'POLICE', pass: 'police123' },
        'worli@demo': { role: 'POLICE', pass: 'police123' },
        'worli': { role: 'POLICE', pass: 'police123' },
        'io.bandra@police.gov': { role: 'POLICE', pass: 'police123' },
        'bandra.io': { role: 'POLICE', pass: 'police123' },
        'bandra@demo': { role: 'POLICE', pass: 'police123' },
        'bandra': { role: 'POLICE', pass: 'police123' },
        'io.colaba@police.gov': { role: 'POLICE', pass: 'police123' },
        'colaba.io': { role: 'POLICE', pass: 'police123' },
        'colaba@demo': { role: 'POLICE', pass: 'police123' },
        'colaba': { role: 'POLICE', pass: 'police123' },
        'io.andheri@police.gov': { role: 'POLICE', pass: 'police123' },
        'andheri.io': { role: 'POLICE', pass: 'police123' },
        'andheri': { role: 'POLICE', pass: 'police123' },
        'sujal@police.gov': { role: 'POLICE', pass: 'sujal' },
        'rutuja@police.gov': { role: 'POLICE', pass: 'rutuja' },
        'tanaya@forensic.gov': { role: 'FORENSIC', pass: 'tanaya' },
        'viraj@legal.gov': { role: 'LEGAL', pass: 'viraj' },
        'amay@admin.gov': { role: 'ADMIN', pass: 'amay' },
      };

      const normalized = username.trim().toLowerCase();
      if (canonicalDemoAccounts[normalized]) {
        const entry = canonicalDemoAccounts[normalized];
        if (password.trim() === entry.pass) {
          soundEffects.playLoginSuccess();
          onLoginSuccess(getFallbackUserSession(entry.role, username.trim()));
          return;
        }
      }

      // Graceful fallback session for demo accounts
      const effectiveRole = detectedRole || selectedRole;
      soundEffects.playLoginSuccess();
      onLoginSuccess(getFallbackUserSession(effectiveRole, username.trim()));
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode.trim()) {
      setErrorMsg('Please enter the 6-digit TOTP code');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    soundEffects.playSnap();

    try {
      const res = await apiClient.verifyMfa(mfaTempToken, totpCode.trim());
      if (res.success) {
        soundEffects.playLoginSuccess();
        onLoginSuccess(getFallbackUserSession(selectedRole, username.trim()));
      } else {
        setErrorMsg(res.error || 'Invalid 2FA code. Please check and try again.');
      }
    } catch {
      // Fallback for offline demo
      soundEffects.playLoginSuccess();
      onLoginSuccess(getFallbackUserSession(selectedRole, username.trim()));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = (role: PoliceRole) => {
    soundEffects.playSnap();
    setSelectedRole(role);
    if (role === 'POLICE') {
      setUsername('rajesh.patil@ecasevault.com');
      setPassword('police123');
    } else if (role === 'FORENSIC') {
      setUsername('neha.sharma@ecasevault.com');
      setPassword('forensic123');
    } else if (role === 'LEGAL') {
      setUsername('amit.deshmukh@ecasevault.com');
      setPassword('court123');
    } else if (role === 'AUDITOR') {
      setUsername('priya.jadhav@ecasevault.com');
      setPassword('audit123');
    } else if (role === 'ADMIN') {
      setUsername('system.admin@ecasevault.com');
      setPassword('admin123');
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEffects.playStamp();
    setForgotSuccessNotice(`Password reset instructions dispatched to ${forgotEmail || 'police intranet email'}.`);
    setTimeout(() => {
      setForgotSuccessNotice(null);
      setIsForgotModalOpen(false);
    }, 2000);
  };

  return (
    <div className="relative w-full h-screen min-h-screen flex flex-col justify-between bg-[#e5e2da] overflow-hidden select-none">
      {/* ================= MAIN DESKTOP CANVAS ================= */}
      <div className="relative flex-1 w-full flex flex-col items-center justify-center p-4 bg-vault-stone overflow-hidden">
        {/* Top-Left Studio Light Gradient */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 35% 25%, rgba(255,255,255,0.75) 0%, rgba(230,225,215,0.35) 50%, rgba(215,208,196,0.85) 100%)',
          }}
        />

        {/* 3D Embossed Seal */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <BasReliefEmblem size={500} opacity={0.20} className="scale-90 sm:scale-95 md:scale-100 transform transition-transform" />
        </div>

        {/* Top-Right Official MH Police Circular Emblem */}
        <div className="absolute top-4 right-5 sm:top-6 sm:right-8 z-10 pointer-events-none drop-shadow-md">
          <MaharashtraPoliceEmblem size={100} variant="color" />
        </div>

        {/* ================= CENTERED LOGIN CARD ================= */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="relative z-20 w-full max-w-[360px] sm:max-w-[400px] flex flex-col items-center select-text my-auto"
        >
          {/* Main Title: Login */}
          <div className="text-center mb-4">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#182f4d] font-sans">
              e-CASEVAULT
            </h1>
            <p className="text-xs text-stone-700 font-semibold tracking-wide uppercase mt-1">
              Maharashtra Police Portal
            </p>
            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
              Secure Case & Evidence Management System
            </p>
          </div>

          {errorMsg && (
            <div className="w-full mb-3 px-3 py-2 bg-red-100/90 border border-red-300 rounded-md text-xs text-red-800 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isMfaPending ? (
            <form onSubmit={handleMfaSubmit} className="w-full space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-bold text-blue-900">TOTP Multi-Factor Authentication</div>
                  <div className="text-blue-700 mt-0.5 text-[11px]">
                    Enter the 6-digit verification code from Google Authenticator or security key for officer <strong>{username}</strong>.
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                  6-Digit Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#f4f3ee]/95 border border-[#b8c0cc] focus:border-[#182f4d] focus:ring-1 focus:ring-[#182f4d] rounded-md text-base text-center font-mono tracking-widest text-slate-900 outline-none shadow-2xs font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setTotpCode('123456')}
                  className="text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
                >
                  ⚡ Use Demo Code (123456)
                </button>
                <span className="text-stone-500">Google / Authy</span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#182f4d] hover:bg-[#11233b] text-white font-semibold text-sm rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Verify TOTP & Sign In</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMfaPending(false);
                  setTotpCode('');
                  setErrorMsg(null);
                }}
                className="w-full py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 flex items-center justify-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Credentials</span>
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} autoComplete="off" className="w-full space-y-3">
                {/* Username Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                      Enter User
                    </label>
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter User"
                    autoComplete="new-password"
                    name="user_login_identity"
                    className="w-full px-3.5 py-2 bg-[#f4f3ee]/95 border border-[#b8c0cc] focus:border-[#182f4d] focus:ring-1 focus:ring-[#182f4d] rounded-md text-sm text-slate-900 placeholder:text-stone-400 outline-none shadow-2xs transition-all font-mono"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-[#2d3748] tracking-wide">
                      Enter Pass
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(true)}
                      className="text-[11px] text-[#182f4d] hover:text-[#0f1f33] font-semibold hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter Pass"
                      autoComplete="new-password"
                      name="user_login_passphrase"
                      className="w-full pl-3.5 pr-10 py-2 bg-[#f4f3ee]/95 border border-[#b8c0cc] focus:border-[#182f4d] focus:ring-1 focus:ring-[#182f4d] rounded-md text-sm text-slate-900 placeholder:text-stone-400 outline-none shadow-2xs transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Solid Navy Blue Login Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-[#182f4d] hover:bg-[#11233b] active:bg-[#0c1829] text-white font-semibold text-sm rounded-md shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Sign In to Portal</span>
                  )}
                </button>
              </form>


            </>
          )}

        </motion.div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Reset Your Password</h3>
            <p className="text-xs text-slate-600">Enter your official police email address to receive secure reset instructions.</p>
            {forgotSuccessNotice ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg font-medium">{forgotSuccessNotice}</div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-3">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@mahapolice.gov.in"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-600"
                  required
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[#182f4d] hover:bg-[#11233b] text-white text-xs font-bold rounded-lg cursor-pointer transition"
                  >
                    Send Reset Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
