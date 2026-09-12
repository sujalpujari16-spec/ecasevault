/**
 * e-CASEVAULT — Maharashtra Institutional Ecosystem Storage
 * 
 * Provides persistent management for:
 * 1. Courts of Law & Judicial Benches (High Court, Sessions, Magistrate, Special NDPS)
 * 2. Forensic Science Laboratories (State Central FSL Kalina, Regional FSLs, Cyber Labs)
 * 3. Police Precincts & Stations
 */

export interface CourtDetail {
  id: string;
  name: string;
  type: 'SUPREME_COURT' | 'HIGH_COURT' | 'SESSIONS_COURT' | 'MAGISTRATE_COURT' | 'SPECIAL_COURT';
  district: string;
  bench: string;
  presidingJudge: string;
  chiefRegistrar: string;
  contactNumber: string;
  address: string;
  status: string;
  isCustom?: boolean;
}

export interface ForensicLabDetail {
  id: string;
  name: string;
  division: 'CENTRAL_FSL' | 'REGIONAL_FSL' | 'CYBER_DIGITAL' | 'BALLISTICS_EXPLOSIVES' | 'DNA_BIOLOGY';
  city: string;
  director: string;
  contactNumber: string;
  address: string;
  activeSpecializations: string[];
  status: string;
  isCustom?: boolean;
}

export const DEFAULT_COURTS: CourtDetail[] = [
  {
    id: 'BOMBAY-HC',
    name: 'Bombay High Court (Appellate Side)',
    type: 'HIGH_COURT',
    district: 'Mumbai',
    bench: 'Principal Bench, Mumbai',
    presidingJudge: 'Hon\'ble Chief Justice',
    chiefRegistrar: 'Registrar General, High Court',
    contactNumber: '+91 22 2267 2200',
    address: 'Dr. Kane Road, Fort, Mumbai - 400032',
    status: 'Operational (e-Filing Live)',
  },
  {
    id: 'MUMBAI-SESSIONS',
    name: 'City Civil & Sessions Court, Mumbai',
    type: 'SESSIONS_COURT',
    district: 'Mumbai City',
    bench: 'Principal Sessions Bench',
    presidingJudge: 'Principal Judge & Sessions Judge',
    chiefRegistrar: 'Chief Administrative Officer (Court Ops)',
    contactNumber: '+91 22 2265 1400',
    address: 'Old Secretariat Building, Fort, Mumbai - 400032',
    status: 'Operational (e-Filing Live)',
  },
  {
    id: 'ANDHERI-MM-COURT',
    name: 'Metropolitan Magistrate Court, Andheri (Court 10 & 22)',
    type: 'MAGISTRATE_COURT',
    district: 'Mumbai Suburban',
    bench: 'Suburban Magistrate Division',
    presidingJudge: 'Additional Chief Metropolitan Magistrate',
    chiefRegistrar: 'Registrar (Andheri Division)',
    contactNumber: '+91 22 2683 4410',
    address: 'Railway Colony, Near Andheri Station, Mumbai - 400069',
    status: 'Operational (e-Filing Live)',
  },
  {
    id: 'PUNE-SESSIONS',
    name: 'District & Sessions Court, Shivajinagar, Pune',
    type: 'SESSIONS_COURT',
    district: 'Pune',
    bench: 'Principal District Bench',
    presidingJudge: 'Principal District Judge',
    chiefRegistrar: 'Registrar, Pune Judicial Complex',
    contactNumber: '+91 20 2553 4100',
    address: 'Shivajinagar, Pune - 411005',
    status: 'Operational (e-Filing Live)',
  },
  {
    id: 'SPECIAL-NDPS-MUMBAI',
    name: 'Special NDPS & PMLA Court, Greater Mumbai',
    type: 'SPECIAL_COURT',
    district: 'Mumbai',
    bench: 'Special Judicial Division',
    presidingJudge: 'Special Sessions Judge (NDPS Act)',
    chiefRegistrar: 'Registrar (Special Courts)',
    contactNumber: '+91 22 2262 8900',
    address: 'City Civil Court Complex, Fort, Mumbai - 400001',
    status: 'Operational (e-Filing Live)',
  },
];

export const DEFAULT_FSL_LABS: ForensicLabDetail[] = [
  {
    id: 'KALINA-FSL',
    name: 'State Forensic Science Laboratory (FSL), Kalina',
    division: 'CENTRAL_FSL',
    city: 'Mumbai',
    director: 'Dr. Neha V. Sawant, Ph.D.',
    contactNumber: '+91 22 2667 0766',
    address: 'Vidyanagari, Hans Bhugra Marg, Kalina, Santacruz East, Mumbai - 400098',
    activeSpecializations: ['DNA Profiling', 'Ballistics', 'Toxicology', 'Cyber Forensics', 'Lie Detection'],
    status: 'Accredited (ISO/IEC 17025)',
  },
  {
    id: 'PUNE-RFSL',
    name: 'Regional Forensic Science Laboratory, Pune',
    division: 'REGIONAL_FSL',
    city: 'Pune',
    director: 'Dr. Ravindra M. Joshi',
    contactNumber: '+91 20 2565 1200',
    address: 'Ganeshkhind Road, University Gate, Pune - 411007',
    activeSpecializations: ['Biology & Serology', 'Chemistry', 'Questioned Documents', 'Physics'],
    status: 'Accredited (ISO/IEC 17025)',
  },
  {
    id: 'BKC-CYBER-FSL',
    name: 'Maharashtra Cyber Digital Forensics Command Center',
    division: 'CYBER_DIGITAL',
    city: 'Mumbai',
    director: 'Dr. Amitav S. Sen (Director, Cyber Forensics)',
    contactNumber: '+91 22 2650 9900',
    address: 'Cyber Bhawan, G-Block, Bandra Kurla Complex (BKC), Mumbai - 400051',
    activeSpecializations: ['Mobile Extraction (UFED)', 'Cloud Forensics', 'Hardware Triage', 'Cryptocurrency Tracing'],
    status: 'Operational (24/7 Response)',
  },
  {
    id: 'NAGPUR-RFSL',
    name: 'Regional Forensic Science Laboratory, Nagpur',
    division: 'REGIONAL_FSL',
    city: 'Nagpur',
    director: 'Dr. Sunil K. Gedam',
    contactNumber: '+91 712 256 0400',
    address: 'Civil Lines, Near High Court, Nagpur - 440001',
    activeSpecializations: ['Toxicology', 'Ballistics & Explosives', 'DNA Fingerprinting'],
    status: 'Accredited (ISO/IEC 17025)',
  },
  {
    id: 'NASHIK-RFSL',
    name: 'Regional Forensic Science Laboratory, Nashik',
    division: 'REGIONAL_FSL',
    city: 'Nashik',
    director: 'Dr. Pradeep B. Patil',
    contactNumber: '+91 253 231 1800',
    address: 'Trimbak Road, Maharashtra Police Academy Campus, Nashik - 422002',
    activeSpecializations: ['Forensic Chemistry', 'Narcotics Analysis', 'Vehicle Identification'],
    status: 'Accredited (ISO/IEC 17025)',
  },
];

const STORAGE_KEY_COURTS = 'casevault_custom_courts_v1';
const STORAGE_KEY_FSL_LABS = 'casevault_custom_fsl_labs_v1';
const STORAGE_KEY_REGISTERED_MEMBERS = 'casevault_custom_registered_members_v1';

export function getStoredCourts(): CourtDetail[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COURTS);
    if (!raw) return DEFAULT_COURTS;
    const custom: CourtDetail[] = JSON.parse(raw);
    const combined = [...DEFAULT_COURTS];
    for (const c of custom) {
      if (!combined.some(item => item.id === c.id)) {
        combined.push(c);
      }
    }
    return combined;
  } catch {
    return DEFAULT_COURTS;
  }
}

export function saveCourt(court: Omit<CourtDetail, 'id'> & { id?: string }): CourtDetail {
  const courts = getStoredCourts();
  const id = court.id || `COURT-${Date.now().toString(36).toUpperCase()}`;
  const newCourt: CourtDetail = {
    ...court,
    id,
    isCustom: true,
  };

  const customOnly: CourtDetail[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COURTS);
    if (raw) customOnly.push(...JSON.parse(raw));
  } catch { /* ignore */ }

  const existingIdx = customOnly.findIndex(c => c.id === id);
  if (existingIdx >= 0) {
    customOnly[existingIdx] = newCourt;
  } else {
    customOnly.push(newCourt);
  }

  localStorage.setItem(STORAGE_KEY_COURTS, JSON.stringify(customOnly));
  window.dispatchEvent(new CustomEvent('casevault:court-added', { detail: newCourt }));
  return newCourt;
}

export function getStoredFslLabs(): ForensicLabDetail[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FSL_LABS);
    if (!raw) return DEFAULT_FSL_LABS;
    const custom: ForensicLabDetail[] = JSON.parse(raw);
    const combined = [...DEFAULT_FSL_LABS];
    for (const l of custom) {
      if (!combined.some(item => item.id === l.id)) {
        combined.push(l);
      }
    }
    return combined;
  } catch {
    return DEFAULT_FSL_LABS;
  }
}

export function saveFslLab(lab: Omit<ForensicLabDetail, 'id'> & { id?: string }): ForensicLabDetail {
  const id = lab.id || `FSL-${Date.now().toString(36).toUpperCase()}`;
  const newLab: ForensicLabDetail = {
    ...lab,
    id,
    isCustom: true,
  };

  const customOnly: ForensicLabDetail[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FSL_LABS);
    if (raw) customOnly.push(...JSON.parse(raw));
  } catch { /* ignore */ }

  const existingIdx = customOnly.findIndex(l => l.id === id);
  if (existingIdx >= 0) {
    customOnly[existingIdx] = newLab;
  } else {
    customOnly.push(newLab);
  }

  localStorage.setItem(STORAGE_KEY_FSL_LABS, JSON.stringify(customOnly));
  window.dispatchEvent(new CustomEvent('casevault:fsl-lab-added', { detail: newLab }));
  return newLab;
}

export interface RegisteredMemberRecord {
  id: string;
  username: string;
  password: string;
  fullName: string;
  badgeNo: string;
  rank: string;
  role: 'POLICE' | 'FORENSIC' | 'LEGAL' | 'AUDITOR' | 'ADMIN';
  stationOrInstitution: string;
  department: string;
  clearanceLevel: string;
  contactNumber?: string;
  email?: string;
  photoUrl?: string;
  status: 'ACTIVE_ON_DUTY' | 'ON_LEAVE' | 'SPECIAL_INVESTIGATION_CELL';
  createdAt: string;
}

export function getStoredMembers(): RegisteredMemberRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_MEMBERS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveMemberToLocalStore(member: RegisteredMemberRecord): void {
  try {
    const members = getStoredMembers();
    const idx = members.findIndex(m => m.username.toLowerCase() === member.username.toLowerCase() || m.badgeNo === member.badgeNo);
    if (idx >= 0) {
      members[idx] = member;
    } else {
      members.unshift(member);
    }
    localStorage.setItem(STORAGE_KEY_REGISTERED_MEMBERS, JSON.stringify(members));
    window.dispatchEvent(new CustomEvent('casevault:member-registered', { detail: member }));
  } catch (e) {
    console.error('Failed to save member locally:', e);
  }
}
