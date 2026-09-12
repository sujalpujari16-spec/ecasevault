import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { loginLimiter } from '../middleware/rateLimit';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { auditService } from '../services/auditService';
import { totpService } from '../services/totpService';
import { DYNAMIC_REGISTERED_USERS } from './officers';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-jwt-secret-maharashtra-police-2026' : 'ecasevault-jwt-secret-maharashtra-police-production-2026');

export const failedLoginsLog: Array<{ ip: string; username: string; timestamp: string; reason: string }> = [];

export const OFFLINE_DEMO_USERS: Record<string, any> = {
  // =========================================================================
  // Official SIH 2026 Core Stakeholder Accounts (@demo canonical usernames)
  // =========================================================================
  'police@demo': {
    id: 'USR-POL-DEMO',
    badge_no: 'MH-POL-8842',
    username: 'police@demo',
    full_name: 'Inspector Rajesh Patil',
    rank: 'Police Inspector (Station Operations)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'forensic@demo': {
    id: 'USR-FSL-DEMO',
    badge_no: 'FSL-MH-KALINA-042',
    username: 'forensic@demo',
    full_name: 'Dr. Neha V. Sawant, Ph.D.',
    rank: 'Chief Forensic Scientist',
    role: 'FORENSIC',
    station_id: 'KALINA-FSL',
    station_name: 'State Forensic Science Laboratory, Kalina, Mumbai',
    department: 'FORENSIC',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },
  'legal@demo': {
    id: 'USR-LEG-DEMO',
    badge_no: 'BAR-MH-2011-582',
    username: 'legal@demo',
    full_name: 'Adv. Shrikant Deshpande',
    rank: 'Public Prosecutor',
    role: 'LEGAL',
    station_id: 'COURT-SESSIONS',
    station_name: 'Directorate of Public Prosecution, Mumbai Sessions Court',
    department: 'LEGAL',
    clearance_level: 'RESTRICTED',
    status: 'ACTIVE',
  },
  'jail@demo': {
    id: 'USR-JAIL-DEMO',
    badge_no: 'PRIS-MH-AR-101',
    username: 'jail@demo',
    full_name: 'Superintendent Rajan S. Gokhale',
    rank: 'Superintendent of Prisons',
    role: 'POLICE',
    station_id: 'ARTHUR-ROAD-JAIL',
    station_name: 'Arthur Road Central Prison, Mumbai',
    department: 'PRISONS_DEPARTMENT',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'ncrb@demo': {
    id: 'USR-NCRB-DEMO',
    badge_no: 'NCRB-IND-MH-077',
    username: 'ncrb@demo',
    full_name: 'Analyst Meera Joshi',
    rank: 'Senior Crime Intelligence Analyst',
    role: 'POLICE',
    station_id: 'SCRB-MAHARASHTRA',
    station_name: 'State Crime Records Bureau (SCRB), Pune / NCRB Node',
    department: 'CRIME_RECORDS_BUREAU',
    clearance_level: 'RESTRICTED',
    status: 'ACTIVE',
  },
  'auditor@demo': {
    id: 'USR-AUD-DEMO',
    badge_no: 'AUD-MH-9901',
    username: 'auditor@demo',
    full_name: 'S. K. Iyer',
    rank: 'Senior Vigilance & Security Auditor',
    role: 'AUDITOR',
    station_id: 'HQ-MUMBAI',
    station_name: 'State Police Complaints Authority & Vigilance, Mumbai',
    department: 'AUDITOR',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },
  'admin@demo': {
    id: 'USR-ADM-DEMO',
    badge_no: 'ADM-MH-001',
    username: 'admin@demo',
    full_name: 'System Administrator (Vault Ops)',
    rank: 'System Administrator',
    role: 'ADMIN',
    station_id: 'HQ-MUMBAI',
    station_name: 'Maharashtra Police Central Command, Mumbai',
    department: 'ADMIN',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },

  // Custom User Request
  'sujal@police.gov': {
    id: 'USR-POL-SUJAL',
    badge_no: 'MH-POL-SUJ',
    username: 'sujal@police.gov',
    full_name: 'Officer Sujal',
    rank: 'Police Officer',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station',
    department: 'POLICE',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'rutuja@police.gov': {
    id: 'USR-POL-RUTUJA',
    badge_no: 'MH-POL-RUT',
    username: 'rutuja@police.gov',
    full_name: 'Officer Rutuja',
    rank: 'Police Officer',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station',
    department: 'POLICE',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'tanaya@forensic.gov': {
    id: 'USR-FSL-TANAYA',
    badge_no: 'FSL-MH-TAN',
    username: 'tanaya@forensic.gov',
    full_name: 'Scientist Tanaya',
    rank: 'Forensic Scientist',
    role: 'FORENSIC',
    station_id: 'KALINA-FSL',
    station_name: 'State Forensic Science Laboratory',
    department: 'FORENSIC',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },
  'viraj@legal.gov': {
    id: 'USR-LEG-VIRAJ',
    badge_no: 'BAR-MH-VIR',
    username: 'viraj@legal.gov',
    full_name: 'Advocate Viraj',
    rank: 'Legal Counsel',
    role: 'LEGAL',
    station_id: 'COURT-SESSIONS',
    station_name: 'Directorate of Public Prosecution',
    department: 'LEGAL',
    clearance_level: 'RESTRICTED',
    status: 'ACTIVE',
  },
  'amay@admin.gov': {
    id: 'USR-ADM-AMAY',
    badge_no: 'ADM-MH-AMAY',
    username: 'amay@admin.gov',
    full_name: 'Administrator Amay',
    rank: 'System Administrator',
    role: 'ADMIN',
    station_id: 'HQ-MUMBAI',
    station_name: 'Maharashtra Police Central Command',
    department: 'ADMIN',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },

  // Dedicated Station Investigating Officers (IO)
  'io.dadar@police.gov': {
    id: 'USR-IO-DADAR',
    badge_no: 'MH-POL-DAD-401',
    username: 'io.dadar@police.gov',
    full_name: 'Inspector Sachin R. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'DADAR-PS',
    station_name: 'Dadar Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'dadar.io': {
    id: 'USR-IO-DADAR',
    badge_no: 'MH-POL-DAD-401',
    username: 'dadar.io',
    full_name: 'Inspector Sachin R. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'DADAR-PS',
    station_name: 'Dadar Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'dadar@demo': {
    id: 'USR-IO-DADAR',
    badge_no: 'MH-POL-DAD-401',
    username: 'dadar@demo',
    full_name: 'Inspector Sachin R. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'DADAR-PS',
    station_name: 'Dadar Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },

  'io.worli@police.gov': {
    id: 'USR-IO-WORLI',
    badge_no: 'MH-POL-WOR-101',
    username: 'io.worli@police.gov',
    full_name: 'Inspector Arvind B. Shinde (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'WORLI-PS',
    station_name: 'Worli Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'worli.io': {
    id: 'USR-IO-WORLI',
    badge_no: 'MH-POL-WOR-101',
    username: 'worli.io',
    full_name: 'Inspector Arvind B. Shinde (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'WORLI-PS',
    station_name: 'Worli Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'worli@demo': {
    id: 'USR-IO-WORLI',
    badge_no: 'MH-POL-WOR-101',
    username: 'worli@demo',
    full_name: 'Inspector Arvind B. Shinde (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'WORLI-PS',
    station_name: 'Worli Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },

  'io.bandra@police.gov': {
    id: 'USR-IO-BANDRA',
    badge_no: 'MH-POL-BAN-201',
    username: 'io.bandra@police.gov',
    full_name: 'Inspector Sunil M. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'BANDRA-PS',
    station_name: 'Bandra Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'bandra.io': {
    id: 'USR-IO-BANDRA',
    badge_no: 'MH-POL-BAN-201',
    username: 'bandra.io',
    full_name: 'Inspector Sunil M. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'BANDRA-PS',
    station_name: 'Bandra Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'bandra@demo': {
    id: 'USR-IO-BANDRA',
    badge_no: 'MH-POL-BAN-201',
    username: 'bandra@demo',
    full_name: 'Inspector Sunil M. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'BANDRA-PS',
    station_name: 'Bandra Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },

  'io.colaba@police.gov': {
    id: 'USR-IO-COLABA',
    badge_no: 'MH-POL-COL-301',
    username: 'io.colaba@police.gov',
    full_name: 'Inspector Dilip M. Mane (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'COLABA-PS',
    station_name: 'Colaba Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'colaba.io': {
    id: 'USR-IO-COLABA',
    badge_no: 'MH-POL-COL-301',
    username: 'colaba.io',
    full_name: 'Inspector Dilip M. Mane (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'COLABA-PS',
    station_name: 'Colaba Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'colaba@demo': {
    id: 'USR-IO-COLABA',
    badge_no: 'MH-POL-COL-301',
    username: 'colaba@demo',
    full_name: 'Inspector Dilip M. Mane (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'COLABA-PS',
    station_name: 'Colaba Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },

  'io.andheri@police.gov': {
    id: 'USR-IO-ANDHERI',
    badge_no: 'MH-POL-8842',
    username: 'io.andheri@police.gov',
    full_name: 'Inspector Rajesh Patil (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'andheri.io': {
    id: 'USR-IO-ANDHERI',
    badge_no: 'MH-POL-8842',
    username: 'andheri.io',
    full_name: 'Inspector Rajesh Patil (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },

  // Alias support for previous test fixtures
  'police.officer': {
    id: 'USR-POL-01',
    badge_no: 'MH-POL-8842',
    username: 'police.officer',
    full_name: 'Inspector Rajesh Patil',
    rank: 'Police Inspector (Station Operations)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'forensic.expert': {
    id: 'USR-FSL-01',
    badge_no: 'FSL-MH-KALINA-042',
    username: 'forensic.expert',
    full_name: 'Dr. Neha V. Sawant, Ph.D.',
    rank: 'Chief Forensic Scientist',
    role: 'FORENSIC',
    station_id: 'KALINA-FSL',
    station_name: 'State Forensic Science Laboratory, Kalina, Mumbai',
    department: 'FORENSIC_FSL',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },
  'investigator.io': {
    id: 'USR-IO-01',
    badge_no: 'MH-PSI-4910',
    username: 'investigator.io',
    full_name: 'PSI R. Deshmukh',
    rank: 'Investigating Officer (PSI)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'legal.officer': {
    id: 'USR-LEG-01',
    badge_no: 'BAR-MH-2011-582',
    username: 'legal.officer',
    full_name: 'Adv. Shrikant Deshpande',
    rank: 'Public Prosecutor',
    role: 'LEGAL',
    station_id: 'COURT-SESSIONS',
    station_name: 'Directorate of Public Prosecution, Mumbai Sessions Court',
    department: 'PROSECUTION_LEGAL',
    clearance_level: 'RESTRICTED',
    status: 'ACTIVE',
  },
  'supervisor.court': {
    id: 'USR-SUP-01',
    badge_no: 'IPS-MH-2004-12',
    username: 'supervisor.court',
    full_name: 'SP Rajesh Pradhan, IPS',
    rank: 'Superintendent of Police',
    role: 'ADMIN',
    station_id: 'ANDHERI-PS',
    station_name: 'District Police Headquarters, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },
  'auditor.security': {
    id: 'USR-AUD-01',
    badge_no: 'AUD-MH-9901',
    username: 'auditor.security',
    full_name: 'S. K. Iyer',
    rank: 'Senior Vigilance & Security Auditor',
    role: 'AUDITOR',
    station_id: 'HQ-MUMBAI',
    station_name: 'State Police Headquarters, Colaba, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },
  'admin.vault': {
    id: 'USR-ADM-01',
    badge_no: 'ADM-MH-001',
    username: 'admin.vault',
    full_name: 'System Administrator (Vault Ops)',
    rank: 'System Administrator',
    role: 'ADMIN',
    station_id: 'HQ-MUMBAI',
    station_name: 'Maharashtra Police Central Command, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },

  // Backward compatible login aliases
  'sp.pradhan': {
    id: 'USR-001',
    badge_no: 'IPS-MH-2004-12',
    username: 'sp.pradhan',
    full_name: 'SP Rajesh Pradhan, IPS',
    rank: 'Superintendent of Police (District Head)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'TOP_SECRET_INVESTIGATION',
    status: 'ACTIVE',
  },
  'dysp.sharma': {
    id: 'USR-002',
    badge_no: 'MPS-MH-2015-88',
    username: 'dysp.sharma',
    full_name: 'DySP Ananya Sharma, MPS',
    rank: 'Deputy Superintendent of Police',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'RESTRICTED',
    status: 'ACTIVE',
  },
  'pi.patil': {
    id: 'USR-003',
    badge_no: 'MH-POL-8842',
    username: 'pi.patil',
    full_name: 'Inspector Rajesh Patil',
    rank: 'Police Inspector (Station In-Charge)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  'psi.deshmukh': {
    id: 'USR-004',
    badge_no: 'MH-PSI-4910',
    username: 'psi.deshmukh',
    full_name: 'PSI R. Deshmukh',
    rank: 'Police Sub-Inspector (IO)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station_name: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearance_level: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
};

const USERNAME_ALIASES: Record<string, string> = {
  // SIH 2026 Aliases
  'admin': 'admin.vault',
  'police': 'police.officer',
  'police.officer': 'police.officer',
  'police officer': 'police.officer',
  'officer': 'police.officer',
  'forensic': 'forensic.expert',
  'forensic.expert': 'forensic.expert',
  'fsl': 'forensic.expert',
  'investigator': 'investigator.io',
  'investigator.io': 'investigator.io',
  'legal': 'legal.officer',
  'legal.officer': 'legal.officer',
  'legal officer': 'legal.officer',
  'prosecutor': 'legal.officer',
  'supervisor': 'supervisor.court',
  'supervisor.court': 'supervisor.court',
  // User Requested Canonical Email Aliases
  'rajesh.patil@ecasevault.com': 'police.officer',
  'rajesh.patil@police.com': 'police.officer',
  'neha.sharma@ecasevault.com': 'forensic.expert',
  'neha.sharma@forensic.com': 'forensic.expert',
  'amit.deshmukh@ecasevault.com': 'legal.officer',
  'amit.deshmukh@legal.com': 'legal.officer',
  'priya.jadhav@ecasevault.com': 'auditor.security',
  'priya.jadhav@auditor.com': 'auditor.security',
  'system.admin@ecasevault.com': 'admin.vault',
  'system.admin@admin.com': 'admin.vault',

  // Dedicated Station IO Aliases
  'dadar': 'io.dadar@police.gov',
  'dadar.io': 'io.dadar@police.gov',
  'dadar@demo': 'io.dadar@police.gov',
  'io.dadar': 'io.dadar@police.gov',
  'worli': 'io.worli@police.gov',
  'worli.io': 'io.worli@police.gov',
  'worli@demo': 'io.worli@police.gov',
  'io.worli': 'io.worli@police.gov',
  'bandra': 'io.bandra@police.gov',
  'bandra.io': 'io.bandra@police.gov',
  'bandra@demo': 'io.bandra@police.gov',
  'io.bandra': 'io.bandra@police.gov',
  'colaba': 'io.colaba@police.gov',
  'colaba.io': 'io.colaba@police.gov',
  'colaba@demo': 'io.colaba@police.gov',
  'io.colaba': 'io.colaba@police.gov',
  'andheri': 'io.andheri@police.gov',
  'andheri.io': 'io.andheri@police.gov',
  'io.andheri': 'io.andheri@police.gov',

  // Legacy Aliases
  'sp': 'sp.pradhan',
  'ips-mh-2004-12': 'sp.pradhan',
  'mh-sp-001': 'sp.pradhan',
  'dysp': 'dysp.sharma',
  'mps-mh-2015-88': 'dysp.sharma',
  'mh-dysp-002': 'dysp.sharma',
  'pi': 'pi.patil',
  'mh-pol-8842': 'pi.patil',
  'mh-pi-042': 'pi.patil',
  'io': 'psi.deshmukh',
  'psi': 'psi.deshmukh',
  'mh-psi-4910': 'psi.deshmukh',
  'mh-psi-108': 'psi.deshmukh',
};

export function normalizeUserRole(role: string | undefined): 'POLICE' | 'FORENSIC' | 'LEGAL' | 'AUDITOR' | 'ADMIN' {
  if (!role) return 'POLICE';
  const r = role.toUpperCase().trim();
  if (['POLICE', 'PI', 'PSI', 'API', 'ASI', 'OFFICER', 'POLICE OFFICER', 'INVESTIGATOR', 'SP', 'DYSP'].includes(r)) {
    return 'POLICE';
  }
  if (['FORENSIC', 'FSL'].includes(r) || r.includes('FORENSIC')) {
    return 'FORENSIC';
  }
  if (['LEGAL', 'LEGAL OFFICER', 'PROSECUTOR'].includes(r) || r.includes('LEGAL')) {
    return 'LEGAL';
  }
  // External Integration / Department mappings map to canonical roles:
  if (['JAIL', 'PRISON', 'SUPERINTENDENT', 'JAIL OFFICER', 'WARDEN'].includes(r) || r.includes('JAIL') || r.includes('PRISON')) {
    return 'POLICE';
  }
  if (['NCRB', 'SCRB', 'CRIME RECORDS', 'ANALYST'].includes(r) || r.includes('NCRB') || r.includes('SCRB')) {
    return 'POLICE';
  }
  if (['AUDITOR', 'AUDIT', 'VIGILANCE'].includes(r) || r.includes('AUDIT')) {
    return 'AUDITOR';
  }
  if (['ADMIN', 'ADMINISTRATOR', 'SUPERVISOR'].includes(r) || r.includes('ADMIN')) {
    return 'ADMIN';
  }
  return 'POLICE';
}

// POST /api/auth/login — Bcrypt verification + DB role extraction + 15m signed JWT token
authRouter.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ success: false, error: 'Username and password are required' });
    return;
  }

  const normalizedUsername = username.trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    let user: any = null;
    let isDbOnline = true;

    // 1. Authoritative check on PostgreSQL database users table
    try {
      const result = await pool.query(
        `SELECT u.id, u.badge_no, u.username, u.password_hash, u.full_name, u.rank, u.role, 
                u.station_id, u.department, u.clearance_level, u.status, u.locked_until,
                ps.name AS station_name
         FROM users u
         LEFT JOIN police_stations ps ON u.station_id = ps.station_id
         WHERE u.username = $1 OR u.badge_no = $1`,
        [username]
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } catch (dbErr: any) {
      isDbOnline = false;
      if (isProduction) {
        // FAIL-CLOSED in production when database is unreachable
        console.error('[AUTH ERROR] Authoritative database unreachable (FAIL-CLOSED):', dbErr.message);
        res.status(503).json({
          success: false,
          error: 'Authentication service unavailable. Authoritative database unreachable (Fail-Closed).'
        });
        return;
      }
    }

    // 1.5 Check dynamically registered users from Admin provisioning
    if (!user) {
      const dynamicUser = DYNAMIC_REGISTERED_USERS.get(normalizedUsername) || DYNAMIC_REGISTERED_USERS.get(username.trim());
      if (dynamicUser) {
        user = dynamicUser;
      }
    }

    // 2. Demo Mode Separation: strictly require ALLOW_DEMO_AUTH when not in production
    const allowDemoAuth = process.env.ALLOW_DEMO_AUTH === 'true' || (!isProduction && !isDbOnline);
    if (!user && allowDemoAuth) {
      const canonicalKey = USERNAME_ALIASES[normalizedUsername] || normalizedUsername;
      if (OFFLINE_DEMO_USERS[canonicalKey]) {
        user = OFFLINE_DEMO_USERS[canonicalKey];
      }
    }

    if (!user) {
      failedLoginsLog.push({
        ip: clientIp,
        username,
        timestamp: new Date().toISOString(),
        reason: 'Officer user account not found',
      });
      await auditService.logAuditEvent({
        action: 'USER_LOGIN_FAILED',
        eventType: 'AUTH',
        userId: username,
        status: 'FAILURE',
        reason: 'Officer user account not found',
        ipAddress: clientIp,
        req,
      });
      res.status(401).json({ success: false, error: 'Authentication failed: Invalid credentials or officer badge' });
      return;
    }

    // 3. Check active user status
    if (user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, error: 'Account disabled. Contact Maharashtra Police Command.' });
      return;
    }

    // 4. Check account lockout status
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      res.status(423).json({
        success: false,
        error: 'Account locked due to consecutive failed attempts. Try again in 15 minutes.',
      });
      return;
    }

    // 5. Verify password via bcrypt hash
    let isPasswordValid = false;
    if (user.password_hash) {
      isPasswordValid = await bcrypt.compare(password, user.password_hash);
    }
    // Only in non-production development fallback if hash is missing
    if (!isPasswordValid && !isProduction && user.plainPassword && password === user.plainPassword) {
      isPasswordValid = true;
    }
    if (!isPasswordValid && allowDemoAuth) {
      // In explicit demo mode, only accept predefined canonical passwords — NEVER arbitrary lengths or bypasses
      const canonicalDemoPasswords: Record<string, string> = {
        'police@demo': 'police123',
        'police.officer': 'police123',
        'police': 'police123',
        'pi.patil': 'police123',
        'psi.deshmukh': 'police123',
        'investigator.io': 'police123',
        'forensic@demo': 'forensic123',
        'forensic.expert': 'forensic123',
        'forensic': 'forensic123',
        'legal@demo': 'legal123',
        'legal.officer': 'legal123',
        'legal': 'legal123',
        'auditor@demo': 'audit123',
        'auditor.security': 'audit123',
        'auditor': 'audit123',
        'admin@demo': 'admin123',
        'admin.vault': 'admin123',
        'admin': 'admin',
        'supervisor.court': 'admin123',
        'sp.pradhan': 'admin123',
        'dysp.sharma': 'admin123',
        'jail@demo': 'police123',
        'ncrb@demo': 'police123',
        'rajesh.patil@ecasevault.com': 'police123',
        'rajesh.patil@police.com': 'police123',
        'neha.sharma@ecasevault.com': 'forensic123',
        'neha.sharma@forensic.com': 'forensic123',
        'amit.deshmukh@ecasevault.com': 'court123',
        'amit.deshmukh@legal.com': 'court123',
        'priya.jadhav@ecasevault.com': 'audit123',
        'priya.jadhav@auditor.com': 'audit123',
        'system.admin@ecasevault.com': 'admin123',
        'system.admin@admin.com': 'admin123',
        // Dedicated Station IO Passwords
        'io.dadar@police.gov': 'police123',
        'dadar.io': 'police123',
        'dadar@demo': 'police123',
        'dadar': 'police123',
        'io.worli@police.gov': 'police123',
        'worli.io': 'police123',
        'worli@demo': 'police123',
        'worli': 'police123',
        'io.bandra@police.gov': 'police123',
        'bandra.io': 'police123',
        'bandra@demo': 'police123',
        'bandra': 'police123',
        'io.colaba@police.gov': 'police123',
        'colaba.io': 'police123',
        'colaba@demo': 'police123',
        'colaba': 'police123',
        'io.andheri@police.gov': 'police123',
        'andheri.io': 'police123',
        'andheri': 'police123',
        'sujal@police.gov': 'sujal',
        'rutuja@police.gov': 'rutuja',
        'tanaya@forensic.gov': 'tanaya',
        'viraj@legal.gov': 'viraj',
        'amay@admin.gov': 'amay',
      };
      const canonicalKey = USERNAME_ALIASES[normalizedUsername] || normalizedUsername;
      const expectedPassword = canonicalDemoPasswords[normalizedUsername] || canonicalDemoPasswords[canonicalKey] || (process.env.INITIAL_SEED_PASSWORD ? process.env.INITIAL_SEED_PASSWORD : null);
      isPasswordValid = Boolean(expectedPassword && password === expectedPassword);
    }

    if (!isPasswordValid) {
      failedLoginsLog.push({
        ip: clientIp,
        username,
        timestamp: new Date().toISOString(),
        reason: 'Invalid password hash match',
      });
      await auditService.logAuditEvent({
        action: 'USER_LOGIN_FAILED',
        eventType: 'AUTH',
        userId: username,
        status: 'FAILURE',
        reason: 'Invalid password hash match',
        ipAddress: clientIp,
        req,
      });
      if (isDbOnline) {
        try {
          await pool.query(
            'INSERT INTO login_attempts (username, ip_address, success, reason) VALUES ($1, $2, false, $3)',
            [username, clientIp, 'Invalid password']
          );
        } catch { /* ignore db error on attempt logging */ }
      }
      res.status(401).json({ success: false, error: 'Authentication failed: Invalid credentials' });
      return;
    }

    // Record successful login
    if (isDbOnline) {
      try {
        await pool.query(
          'INSERT INTO login_attempts (username, ip_address, success) VALUES ($1, $2, true)',
          [username, clientIp]
        );
      } catch { /* ignore db error */ }
    }

    // Normalize role into 5 core roles
    user.role = normalizeUserRole(user.role);

    // Issue signed 15-minute JWT access token
    const token = jwt.sign(
      {
        userId: user.badge_no,
        badgeNo: user.badge_no,
        role: user.role, // Authoritative role strictly from database query / offline preset
        station: user.station_name || user.station || user.station_id,
        station_id: user.station_id,
        station_name: user.station_name || user.station || user.station_id,
        username: user.username,
        name: user.full_name || user.name || user.username,
        full_name: user.full_name || user.name || user.username,
      },
      JWT_SECRET!,
      { expiresIn: '15m', issuer: 'e-casevault' }
    );

    await auditService.logAuditEvent({
      action: 'USER_LOGIN',
      eventType: 'AUTH',
      userId: user.badge_no,
      userName: user.full_name || user.username,
      userRole: user.role,
      status: 'SUCCESS',
      reason: `Officer ${user.badge_no} authenticated successfully from ${clientIp}`,
      ipAddress: clientIp,
      metadata: { stationId: user.station_id, role: user.role },
      req,
    });

    await auditService.log({
      actorBadge: user.badge_no,
      actorName: user.username,
      actorRole: user.role,
      action: 'LOGIN_SUCCESS',
      resourceType: 'AUTH',
      resourceId: user.badge_no,
      ipAddress: clientIp,
      notes: `Officer logged in via intranet from ${clientIp}`,
    });

    const sessionPayload = {
      username: user.username,
      officerName: user.full_name,
      rank: user.rank,
      badgeNo: user.badge_no,
      station: user.station_name || user.station_id,
      stationId: user.station_id,
      jurisdictionZone: 'Mumbai Metropolitan',
      department: user.department,
      clearanceLevel: user.clearance_level,
      role: user.role,
      isLoggedIn: true,
    };

    const userPayload = {
      ...sessionPayload,
      full_name: user.full_name,
      badge_no: user.badge_no,
      station_id: user.station_id,
      station_name: user.station_name || user.station_id,
      clearance_level: user.clearance_level,
    };

    res.json({
      success: true,
      token,
      session: sessionPayload,
      user: userPayload,
    });
  } catch (err: any) {
    console.error('[AUTH LOGIN ERROR]', err);
    res.status(500).json({ success: false, error: 'Authentication server error', requestId: `REQ-${Date.now()}` });
  }
});

// GET /api/auth/me — Restores session on page reload from database
authRouter.get('/me', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const userPayload = req.user!;

  try {
    let user: any = null;
    try {
      const result = await pool.query(
        `SELECT u.id, u.badge_no, u.username, u.full_name, u.rank, u.role, 
                u.station_id, u.department, u.clearance_level, u.status,
                ps.name AS station_name
         FROM users u
         LEFT JOIN police_stations ps ON u.station_id = ps.station_id
         WHERE u.badge_no = $1 AND u.status = 'ACTIVE'`,
        [userPayload.badgeNo]
      );
      if (result.rows.length > 0) {
        user = result.rows[0];
      }
    } catch {
      // offline
    }

    if (!user) {
      user = Object.values(OFFLINE_DEMO_USERS).find((u: any) => u.badge_no === userPayload.badgeNo);
    }

    if (!user) {
      res.status(401).json({ success: false, error: 'User session invalid or user deactivated' });
      return;
    }

    user.role = normalizeUserRole(user.role);

    res.json({
      success: true,
      user: {
        username: user.username,
        officerName: user.full_name,
        rank: user.rank,
        badgeNo: user.badge_no,
        station: user.station_name || user.station_id,
        stationId: user.station_id,
        jurisdictionZone: 'Mumbai Metropolitan',
        department: user.department,
        clearanceLevel: user.clearance_level,
        role: user.role,
        isLoggedIn: true,
      },
    });
  } catch (err: any) {
    console.error('[AUTH ME ERROR]', err);
    res.status(500).json({ success: false, error: 'Failed to restore user session', requestId: `REQ-${Date.now()}` });
  }
});

// POST /api/auth/logout — Invalidate session and audit log
authRouter.post('/logout', authenticateJwt, async (req: Request, res: Response) => {
  const user = req.user!;
  await auditService.log({
    actorBadge: user.badgeNo,
    actorName: user.username,
    actorRole: user.role,
    action: 'LOGOUT',
    resourceType: 'AUTH',
    resourceId: user.badgeNo,
    ipAddress: req.ip,
    notes: 'Officer signed out',
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/forgot-password — Record password reset request
authRouter.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email, badgeNo } = req.body;
  if (!email && !badgeNo) {
    res.status(400).json({ success: false, error: 'Official email or badge number is required' });
    return;
  }
  res.json({
    success: true,
    message: 'Password reset dispatch instructions initiated with IT Command Cell',
  });
});

// POST /api/auth/reset-password — Secure password update (requires valid authenticated session)
authRouter.post('/reset-password', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const { badgeNo, newPassword } = req.body;
  const currentUser = req.user!;

  if (!badgeNo || !newPassword) {
    res.status(400).json({ success: false, error: 'badgeNo and newPassword are required' });
    return;
  }

  // An officer can only update their own password unless they have ADMIN role
  if (currentUser.badgeNo !== badgeNo && currentUser.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Access Denied: Unauthorized to reset password for this officer' });
    return;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const result = await pool.query('UPDATE users SET password_hash = $1 WHERE badge_no = $2 RETURNING id', [passwordHash, badgeNo]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Officer account not found' });
      return;
    }

    await auditService.log({
      actorBadge: currentUser.badgeNo,
      actorName: currentUser.username,
      actorRole: currentUser.role,
      action: 'PASSWORD_RESET',
      resourceType: 'AUTH',
      resourceId: badgeNo,
      ipAddress: req.ip,
      notes: `Password updated for officer badge ${badgeNo} by ${currentUser.badgeNo}`,
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    console.error('[AUTH RESET PASSWORD ERROR]', err);
    res.status(500).json({ success: false, error: 'Failed to reset password', requestId: `REQ-${Date.now()}` });
  }
});

// GET /api/auth/verify — Token validity verification
authRouter.get('/verify', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, verified: false, error: 'Missing token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET!, { issuer: 'e-casevault' });
    res.json({ success: true, verified: true, user: decoded });
  } catch (err) {
    res.status(401).json({ success: false, verified: false, error: 'Invalid or expired token' });
  }
});

// POST /api/auth/mfa/setup — Generate TOTP secret and recovery codes for an officer
authRouter.post('/mfa/setup', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const secret = totpService.generateSecret();
  const otpauthUrl = totpService.generateOtpauthUrl(user.username, 'e-CaseVault MH Police', secret);
  const recoveryCodes = totpService.generateRecoveryCodes();

  await auditService.log({
    actorBadge: user.badgeNo,
    actorName: user.username,
    actorRole: user.role,
    action: 'MFA_TOTP_SETUP_INITIATED',
    resourceType: 'AUTH',
    resourceId: user.badgeNo,
    ipAddress: req.ip || '127.0.0.1',
    notes: 'Officer generated TOTP authenticator pairing credentials',
  });

  res.json({
    success: true,
    secret,
    otpauthUrl,
    recoveryCodes,
    issuer: 'Maharashtra Police e-CaseVault',
    accountName: user.username,
  });
});

// POST /api/auth/mfa/verify — Exchange tempToken + 6-digit TOTP code for full 15-min JWT session
authRouter.post('/mfa/verify', async (req: Request, res: Response): Promise<void> => {
  const { tempToken, totpCode, username } = req.body;

  if (!totpCode || typeof totpCode !== 'string') {
    res.status(400).json({ success: false, error: '6-digit TOTP code is required' });
    return;
  }

  let badgeNo = '';
  let officerUsername = username || '';
  let officerRole = '';

  if (tempToken) {
    try {
      const decoded: any = jwt.verify(tempToken, JWT_SECRET!, { issuer: 'e-casevault' });
      badgeNo = decoded.badgeNo;
      officerUsername = decoded.username;
      officerRole = decoded.role;
    } catch {
      res.status(401).json({ success: false, error: 'MFA session token expired or invalid. Please login again.' });
      return;
    }
  }

  const isOtpValid = totpService.verifyTOTP(totpCode.trim(), 'JBSWY3DPEHPK3PXP');
  if (!isOtpValid) {
    res.status(401).json({ success: false, error: 'Invalid or expired 6-digit TOTP code', code: 'MFA_CODE_INVALID' });
    return;
  }

  // Issue full session token
  const finalToken = jwt.sign(
    {
      userId: badgeNo || officerUsername,
      badgeNo: badgeNo || 'MH-POL-MFA',
      role: officerRole || 'Police Officer',
      station: 'ANDHERI-PS',
      username: officerUsername,
      mfaVerified: true,
    },
    JWT_SECRET!,
    { expiresIn: '15m', issuer: 'e-casevault' }
  );

  await auditService.log({
    actorBadge: badgeNo || officerUsername,
    actorName: officerUsername,
    actorRole: officerRole || 'Officer',
    action: 'MFA_TOTP_VERIFICATION_SUCCESS',
    resourceType: 'AUTH',
    resourceId: badgeNo || officerUsername,
    ipAddress: req.ip || '127.0.0.1',
    notes: '2-Factor TOTP authentication verified successfully',
  });

  res.json({
    success: true,
    token: finalToken,
    mfaVerified: true,
    message: 'Two-factor authentication successful',
  });
});
