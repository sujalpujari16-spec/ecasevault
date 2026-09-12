import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { authorizeRole } from '../middleware/rbac';
import { auditService } from '../services/auditService';
import { emitCaseEvent } from './events';

export const officersRouter = Router();

// Persistent storage path for dynamically provisioned personnel
const REGISTERED_OFFICERS_FILE = path.join(process.cwd(), 'server', 'data', 'registered_officers.json');

// Shared dynamic registered users map for instant authentication of Admin-created accounts
export const DYNAMIC_REGISTERED_USERS: Map<string, any> = new Map();

export function persistRegisteredOfficer(officer: any) {
  try {
    let list: any[] = [];
    if (fs.existsSync(REGISTERED_OFFICERS_FILE)) {
      try {
        list = JSON.parse(fs.readFileSync(REGISTERED_OFFICERS_FILE, 'utf-8'));
      } catch {
        list = [];
      }
    }
    const idx = list.findIndex(o => 
      (o.username && officer.username && o.username.toLowerCase() === officer.username.toLowerCase()) || 
      (o.badgeNo && officer.badgeNo && o.badgeNo.toLowerCase() === officer.badgeNo.toLowerCase())
    );
    if (idx >= 0) {
      list[idx] = officer;
    } else {
      list.unshift(officer);
    }
    fs.writeFileSync(REGISTERED_OFFICERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('[OFFICERS STORE PERSIST ERROR]', err);
  }
}

// Offline in-memory fallback roster of Maharashtra Police officers with station IOs
export const OFFLINE_OFFICERS_ROSTER: any[] = [
  {
    id: 'USR-IO-DADAR',
    badgeNo: 'MH-POL-DAD-401',
    badge_no: 'MH-POL-DAD-401',
    username: 'io.dadar@police.gov',
    name: 'Inspector Sachin R. Kadam (IO)',
    full_name: 'Inspector Sachin R. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'DADAR-PS',
    station: 'Dadar Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearanceLevel: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  {
    id: 'USR-IO-WORLI',
    badgeNo: 'MH-POL-WOR-101',
    badge_no: 'MH-POL-WOR-101',
    username: 'io.worli@police.gov',
    name: 'Inspector Arvind B. Shinde (IO)',
    full_name: 'Inspector Arvind B. Shinde (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'WORLI-PS',
    station: 'Worli Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearanceLevel: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  {
    id: 'USR-IO-BANDRA',
    badgeNo: 'MH-POL-BAN-201',
    badge_no: 'MH-POL-BAN-201',
    username: 'io.bandra@police.gov',
    name: 'Inspector Sunil M. Kadam (IO)',
    full_name: 'Inspector Sunil M. Kadam (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'BANDRA-PS',
    station: 'Bandra Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearanceLevel: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  {
    id: 'USR-IO-COLABA',
    badgeNo: 'MH-POL-COL-301',
    badge_no: 'MH-POL-COL-301',
    username: 'io.colaba@police.gov',
    name: 'Inspector Dilip M. Mane (IO)',
    full_name: 'Inspector Dilip M. Mane (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'COLABA-PS',
    station: 'Colaba Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearanceLevel: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
  {
    id: 'USR-IO-ANDHERI',
    badgeNo: 'MH-POL-8842',
    badge_no: 'MH-POL-8842',
    username: 'io.andheri@police.gov',
    name: 'Inspector Rajesh Patil (IO)',
    full_name: 'Inspector Rajesh Patil (IO)',
    rank: 'Police Inspector (IO)',
    role: 'POLICE',
    station_id: 'ANDHERI-PS',
    station: 'Andheri Police Station, Mumbai',
    department: 'POLICE_INVESTIGATION',
    clearanceLevel: 'CONFIDENTIAL',
    status: 'ACTIVE',
  },
];

// Auto-load any persistently registered officers from storage into memory maps
(function loadStoredOfficers() {
  try {
    if (fs.existsSync(REGISTERED_OFFICERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(REGISTERED_OFFICERS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach(u => {
          if (u.username) DYNAMIC_REGISTERED_USERS.set(u.username.toLowerCase(), u);
          if (u.badgeNo) DYNAMIC_REGISTERED_USERS.set(u.badgeNo.toLowerCase(), u);
          if (u.badge_no) DYNAMIC_REGISTERED_USERS.set(u.badge_no.toLowerCase(), u);
          const idx = OFFLINE_OFFICERS_ROSTER.findIndex(o => o.badgeNo === u.badgeNo || (o.username && u.username && o.username.toLowerCase() === u.username.toLowerCase()));
          if (idx >= 0) {
            OFFLINE_OFFICERS_ROSTER[idx] = u;
          } else {
            OFFLINE_OFFICERS_ROSTER.unshift(u);
          }
        });
      }
    }
  } catch (err) {
    console.error('[OFFICERS STORE LOAD ERROR]', err);
  }
})();

// Helper to filter offline roster by role / station
function getOfflineOfficersForUser(_user: any, filterRole?: string) {
  return OFFLINE_OFFICERS_ROSTER.filter(o => {
    if (o.status !== 'ACTIVE') return false;
    if (filterRole && o.role !== filterRole) return false;
    return true;
  });
}

// GET /api/officers — List all officers available across the police service (supports ?role=POLICE)
officersRouter.get('/', authenticateJwt, async (req: Request, res: Response) => {
  const user = req.user!;
  const filterRole = (req.query.role as string || '').toUpperCase();

  try {
    let query = `
      SELECT 
        u.id, 
        u.badge_no AS "badgeNo", 
        u.username, 
        u.full_name AS name, 
        u.rank, 
        u.role, 
        u.station_id, 
        ps.name AS station, 
        u.department, 
        u.clearance_level AS "clearanceLevel", 
        u.status,
        (SELECT COUNT(*)::int FROM cases c WHERE c.assigned_io_badge = u.badge_no AND c.status != 'Closed') AS "activeCasesCount"
      FROM users u
      LEFT JOIN police_stations ps ON u.station_id = ps.station_id
      WHERE u.status = 'ACTIVE'
    `;
    const params: any[] = [];
    if (filterRole) {
      params.push(filterRole);
      query += ` AND u.role = $1`;
    }
    query += ` ORDER BY u.full_name ASC`;

    try {
      const result = await pool.query(query, params);
      if (result.rows && result.rows.length > 0) {
        res.json({ success: true, count: result.rows.length, officers: result.rows });
        return;
      }
    } catch {
      // In offline / disconnected mode, fallback to memory roster
    }

    const fallbackList = getOfflineOfficersForUser(user, filterRole);
    res.json({ success: true, count: fallbackList.length, officers: fallbackList, source: 'OFFLINE_ROSTER' });
  } catch (err: any) {
    console.error('[OFFICERS GET ERROR]', err);
    const fallbackList = getOfflineOfficersForUser(user, filterRole);
    res.json({ success: true, count: fallbackList.length, officers: fallbackList, source: 'OFFLINE_ROSTER' });
  }
});

// GET /api/officers/:id — Get officer profile with authorization check
officersRouter.get('/:id', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;

  try {
    let target: any = null;
    try {
      const result = await pool.query(
        `SELECT u.id, u.badge_no AS "badgeNo", u.username, u.full_name AS name, u.rank, u.role, 
                u.station_id, ps.name AS station, u.department, u.clearance_level AS "clearanceLevel", u.status
         FROM users u
         LEFT JOIN police_stations ps ON u.station_id = ps.station_id
         WHERE u.id = $1 OR u.badge_no = $1 OR u.username = $1`,
        [id]
      );
      if (result.rows.length > 0) {
        target = result.rows[0];
      }
    } catch {
      // Fallback
    }

    if (!target) {
      target = OFFLINE_OFFICERS_ROSTER.find(
        o => o.id === id || o.badgeNo === id || o.username === id
      );
    }

    if (!target) {
      res.status(404).json({ success: false, error: 'Officer profile not found' });
      return;
    }

    // Access check by system role
    if (user.role === 'ADMIN' || user.role === 'AUDITOR') {
      // Full clearance to inspect officer profile
    } else if (user.role === 'POLICE') {
      const isSameStation = target.station_id === user.station_id || target.station === user.station;
      const isSelf = target.badgeNo === user.badgeNo;
      if (!isSameStation && !isSelf) {
        res.status(403).json({
          success: false,
          error: 'Access Denied: Cannot view officer profile outside your station jurisdiction',
          requestId: `REQ-${Date.now()}`,
        });
        return;
      }
    } else {
      const isSelf = target.badgeNo === user.badgeNo || target.id === user.userId || target.username === user.username;
      if (!isSelf) {
        res.status(403).json({
          success: false,
          error: 'Access Denied: You do not have clearance to view officer profiles outside your active assignments',
          requestId: `REQ-${Date.now()}`,
        });
        return;
      }
    }

    res.json({ success: true, officer: target });
  } catch (err: any) {
    console.error(`[OFFICER GET ERROR] ID ${id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to retrieve officer profile', requestId: `REQ-${Date.now()}` });
  }
});


async function resolveStationId(input: string | undefined, role: string = 'POLICE'): Promise<string> {
  const normRole = (role || 'POLICE').toUpperCase();
  const raw = (input || '').trim();

  // 1. Default role postings if empty
  if (!raw) {
    if (normRole === 'FORENSIC') return 'KALINA-FSL';
    if (normRole === 'LEGAL') return 'COURT-SESSIONS';
    if (normRole === 'AUDITOR') return 'VIGILANCE-CELL';
    if (normRole === 'JAIL') return 'ARTHUR-ROAD-JAIL';
    return 'ANDHERI-PS';
  }

  const upper = raw.toUpperCase();
  if (upper.includes('KALINA') || upper.includes('FORENSIC') || upper.includes('FSL')) return 'KALINA-FSL';
  if (upper.includes('COURT') || upper.includes('LEGAL') || upper.includes('SESSIONS') || upper.includes('PROSECUT')) return 'COURT-SESSIONS';
  if (upper.includes('ANDHERI')) return 'ANDHERI-PS';
  if (upper.includes('DADAR')) return 'DADAR-PS';
  if (upper.includes('WORLI')) return 'WORLI-PS';
  if (upper.includes('BANDRA')) return 'BANDRA-PS';
  if (upper.includes('COLABA')) return 'COLABA-PS';
  if (upper.includes('BORIVALI')) return 'BORIVALI-STF';
  if (upper.includes('KOREGAON') || upper.includes('PUNE')) return 'KP-PS';
  if (upper.includes('JAIL') || upper.includes('PRISON')) return 'ARTHUR-ROAD-JAIL';
  if (upper.includes('VIGILANCE') || upper.includes('AUDIT')) return 'VIGILANCE-CELL';
  if (upper.includes('HQ') || upper.includes('HEADQUARTERS')) return 'HQ-MUMBAI';

  // 2. Direct match or fuzzy match against police_stations table
  try {
    const directMatch = await pool.query(
      'SELECT station_id FROM police_stations WHERE station_id = $1 OR UPPER(name) = $2 LIMIT 1',
      [raw, upper]
    );
    if (directMatch.rows.length > 0) {
      return directMatch.rows[0].station_id;
    }

    const fuzzyMatch = await pool.query(
      'SELECT station_id FROM police_stations WHERE name ILIKE $1 LIMIT 1',
      [`%${raw}%`]
    );
    if (fuzzyMatch.rows.length > 0) {
      return fuzzyMatch.rows[0].station_id;
    }

    // 3. Insert new station to guarantee foreign key constraint users(station_id) REFERENCES police_stations(station_id) never fails
    const newId = raw.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().slice(0, 30) || `STN-${Date.now().toString(36).toUpperCase()}`;
    await pool.query(
      `INSERT INTO police_stations (station_id, name, zone, district, address, contact_number)
       VALUES ($1, $2, 'General Jurisdiction', 'Maharashtra', $2, '+91 22 2600 0000')
       ON CONFLICT (station_id) DO NOTHING`,
      [newId, raw]
    );
    return newId;
  } catch {
    if (normRole === 'FORENSIC') return 'KALINA-FSL';
    if (normRole === 'LEGAL') return 'COURT-SESSIONS';
    return 'ANDHERI-PS';
  }
}

// POST /api/officers — Provision personnel accounts (ADMIN only)
officersRouter.post('/', authenticateJwt, authorizeRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { badgeNo, username, fullName, rank, role, stationId, department, clearanceLevel, password, photoUrl } = req.body;

  if (!badgeNo || !username || !fullName || !rank || !role) {
    res.status(400).json({ success: false, error: 'Missing mandatory fields: badgeNo, username, fullName, rank, role' });
    return;
  }

  // Password validation & assignment (supports custom admin passwords)
  let effectivePassword = password;
  if (password && typeof password === 'string' && password.trim().length > 0) {
    if (password.trim().length < 6) {
      res.status(400).json({
        success: false,
        error: 'Bad Request: Initial password must be at least 6 characters long',
        requestId: `REQ-${Date.now()}`,
      });
      return;
    }
    effectivePassword = password.trim();
  } else {
    // Auto-generate compliant password if omitted
    effectivePassword = `${role.toLowerCase()}123`;
  }

  try {
    const id = `USR-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    const passwordHash = await bcrypt.hash(effectivePassword, 10);
    let assignedStation = await resolveStationId(stationId || user.station_id || user.station, role);

    const normalizedUsername = username.trim().toLowerCase();
    const dynamicUserRecord = {
      id,
      badgeNo,
      badge_no: badgeNo,
      username: normalizedUsername,
      name: fullName,
      fullName,
      full_name: fullName,
      rank,
      role: (role || 'POLICE').toUpperCase(),
      station_id: assignedStation,
      station: assignedStation,
      station_name: assignedStation,
      department: department || (role || 'POLICE').toUpperCase(),
      clearanceLevel: clearanceLevel || 'CONFIDENTIAL',
      clearance_level: clearanceLevel || 'CONFIDENTIAL',
      password_hash: passwordHash,
      plainPassword: effectivePassword,
      status: 'ACTIVE',
      activeCasesCount: 0,
      photoUrl: photoUrl || undefined,
    };

    // Always register in shared memory map for instant auth
    DYNAMIC_REGISTERED_USERS.set(normalizedUsername, dynamicUserRecord);
    DYNAMIC_REGISTERED_USERS.set(badgeNo.toLowerCase(), dynamicUserRecord);
    persistRegisteredOfficer(dynamicUserRecord);

    try {
      const insertResult = await pool.query(
        `INSERT INTO users (id, badge_no, username, password_hash, full_name, rank, role, station_id, department, clearance_level)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, badge_no, username, full_name, rank, role, station_id, department, clearance_level`,
        [
          id,
          badgeNo,
          normalizedUsername,
          passwordHash,
          fullName,
          rank,
          role.toUpperCase(),
          assignedStation,
          department || role.toUpperCase(),
          clearanceLevel || 'CONFIDENTIAL',
        ]
      );

      await auditService.log({
        actorBadge: user.badgeNo,
        actorName: user.username,
        actorRole: user.role,
        action: 'USER_CREATED',
        resourceType: 'USER',
        resourceId: badgeNo,
        ipAddress: req.ip,
        notes: `Provisioned personnel ${fullName} (${rank}, ${badgeNo}) as ${role} by ${user.role} ${user.badgeNo}`,
      });

      try {
        emitCaseEvent('OFFICER_CREATED', {
          id,
          badgeNo,
          username: normalizedUsername,
          name: fullName,
          rank,
          role: role.toUpperCase(),
          stationId: assignedStation,
        });
      } catch {}

      res.status(201).json({ success: true, officer: insertResult.rows[0], initialPassword: effectivePassword });
      return;
    } catch (dbErr: any) {
      // In offline / disconnected mode, create in memory roster
      const offlineOfficer = {
        ...dynamicUserRecord,
      };

      // Check if duplicate badgeNo exists
      const existingIdx = OFFLINE_OFFICERS_ROSTER.findIndex(o => o.badgeNo === badgeNo);
      if (existingIdx >= 0) {
        OFFLINE_OFFICERS_ROSTER[existingIdx] = offlineOfficer;
      } else {
        OFFLINE_OFFICERS_ROSTER.unshift(offlineOfficer);
      }

      await auditService.log({
        actorBadge: user.badgeNo,
        actorName: user.username,
        actorRole: user.role,
        action: 'USER_CREATED',
        resourceType: 'USER',
        resourceId: badgeNo,
        ipAddress: req.ip,
        notes: `Provisioned personnel ${fullName} (${rank}, ${badgeNo}) as ${role} by ${user.role} ${user.badgeNo} [In-Memory Ledger]`,
      });

      res.status(201).json({ success: true, officer: offlineOfficer, initialPassword: effectivePassword, offlineMode: true });
    }
  } catch (err: any) {
    console.error('[OFFICER PROVISION ERROR]', err);
    res.status(500).json({ success: false, error: 'Failed to provision officer', requestId: `REQ-${Date.now()}` });
  }
});

// PATCH /api/officers/:id — Update officer details (ADMIN only)
officersRouter.patch('/:id', authenticateJwt, authorizeRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const { rank, role, stationId, department, clearanceLevel, status } = req.body;

  try {
    // Look up target officer first
    const targetRes = await pool.query(
      `SELECT id, badge_no, username, role, station_id FROM users WHERE id = $1 OR badge_no = $1`,
      [id]
    );

    if (targetRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Officer not found' });
      return;
    }

    const target = targetRes.rows[0];

    const updateResult = await pool.query(
      `UPDATE users
       SET rank = COALESCE($1, rank),
           role = COALESCE($2, role),
           station_id = COALESCE($3, station_id),
           department = COALESCE($4, department),
           clearance_level = COALESCE($5, clearance_level),
           status = COALESCE($6, status)
       WHERE id = $7 OR badge_no = $7
       RETURNING id, badge_no, username, full_name, rank, role, station_id, department, clearance_level, status`,
      [rank, role, stationId, department, clearanceLevel, status, id]
    );

    await auditService.log({
      actorBadge: user.badgeNo,
      actorName: user.username,
      actorRole: user.role,
      action: 'USER_UPDATED',
      resourceType: 'USER',
      resourceId: target.badge_no,
      ipAddress: req.ip,
      notes: `Updated officer ${target.badge_no} by ${user.role} ${user.badgeNo}`,
    });

    res.json({ success: true, officer: updateResult.rows[0] });
  } catch (err: any) {
    console.error(`[OFFICER UPDATE ERROR] ID ${id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to update officer', requestId: `REQ-${Date.now()}` });
  }
});

// DELETE /api/officers/:id — Deactivate officer account (ADMIN only)
officersRouter.delete('/:id', authenticateJwt, authorizeRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;

  // Prevent self-deactivation
  if (id === user.userId || id === user.badgeNo || id === user.username) {
    res.status(400).json({ success: false, error: 'Self-deactivation is prohibited' });
    return;
  }

  try {
    const targetRes = await pool.query(
      `SELECT id, badge_no, username, full_name, role FROM users WHERE id = $1 OR badge_no = $1`,
      [id]
    );

    if (targetRes.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Officer not found' });
      return;
    }

    const target = targetRes.rows[0];

    await pool.query(
      `UPDATE users SET status = 'DISABLED' WHERE id = $1 OR badge_no = $1`,
      [id]
    );

    await auditService.log({
      actorBadge: user.badgeNo,
      actorName: user.username,
      actorRole: user.role,
      action: 'USER_DISABLED',
      resourceType: 'USER',
      resourceId: target.badge_no,
      ipAddress: req.ip,
      notes: `Deactivated officer profile for ${target.full_name} (${target.badge_no}) by ${user.role} ${user.badgeNo}`,
    });

    res.json({ success: true, message: 'Officer profile deactivated' });
  } catch (err: any) {
    console.error(`[OFFICER DEACTIVATE ERROR] ID ${id}:`, err);
    res.status(500).json({ success: false, error: 'Failed to deactivate officer', requestId: `REQ-${Date.now()}` });
  }
});
