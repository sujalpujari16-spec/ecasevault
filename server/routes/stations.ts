import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../config/database';
import { authenticateJwt } from '../middleware/auth';
import { authorizeRole } from '../middleware/rbac';
import { auditService } from '../services/auditService';

export const stationsRouter = Router();

export interface ServerPoliceStation {
  id: string;
  name: string;
  zone: string;
  district: string;
  state: string;
  inChargePI: string;
  contactNumber: string;
  address?: string;
  malkhanaStatus: string;
  strength?: string;
  activeDockets?: string;
  status: string;
}

export const OFFLINE_STATIONS_STORE: ServerPoliceStation[] = [
  {
    id: 'ANDHERI-PS',
    name: 'Andheri Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    inChargePI: 'Inspector Rajesh Patil',
    contactNumber: '+91 22 2683 0100',
    address: 'S. V. Road, Andheri West, Mumbai - 400058',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '42 Officers (8 Active IOs)',
    activeDockets: '14 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'BANDRA-PS',
    name: 'Bandra Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    inChargePI: 'Inspector Sunil M. Kadam',
    contactNumber: '+91 22 2642 0100',
    address: 'Hill Road, Bandra West, Mumbai - 400050',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '38 Officers (6 Active IOs)',
    activeDockets: '11 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'JUHU-PS',
    name: 'Juhu Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    inChargePI: 'Inspector Mahesh T. Parab',
    contactNumber: '+91 22 2618 0100',
    address: 'Juhu Tara Road, Juhu, Mumbai - 400049',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '30 Officers (5 Active IOs)',
    activeDockets: '8 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'VERSOVA-PS',
    name: 'Versova Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    inChargePI: 'Inspector Prakash D. Gaikwad',
    contactNumber: '+91 22 2636 0100',
    address: 'Yari Road, Versova, Andheri West, Mumbai - 400061',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '32 Officers (5 Active IOs)',
    activeDockets: '9 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'SANTACRUZ-PS',
    name: 'Santacruz Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    inChargePI: 'Inspector Anand R. Desai',
    contactNumber: '+91 22 2649 0100',
    address: 'Juhu Road, Santacruz West, Mumbai - 400054',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '34 Officers (6 Active IOs)',
    activeDockets: '10 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'KURLA-PS',
    name: 'Kurla Police Station, Mumbai',
    zone: 'Zone V (Eastern Suburbs)',
    district: 'Mumbai Suburban',
    state: 'Maharashtra',
    inChargePI: 'Inspector Ramesh N. Sawant',
    contactNumber: '+91 22 2650 0100',
    address: 'LBS Marg, Kurla West, Mumbai - 400070',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '40 Officers (7 Active IOs)',
    activeDockets: '12 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'DADAR-PS',
    name: 'Dadar Police Station, Mumbai',
    zone: 'Zone V (Central Mumbai)',
    district: 'Mumbai City',
    state: 'Maharashtra',
    inChargePI: 'Senior PI Ramesh S. Shinde',
    contactNumber: '+91 22 2414 0100',
    address: 'Dr. Babasaheb Ambedkar Road, Dadar East, Mumbai - 400014',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '36 Officers (6 Active IOs)',
    activeDockets: '13 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'COLABA-PS',
    name: 'Colaba Police Station, Mumbai',
    zone: 'Zone I (South Mumbai)',
    district: 'Mumbai City',
    state: 'Maharashtra',
    inChargePI: 'Senior PI Dilip M. Mane',
    contactNumber: '+91 22 2285 0100',
    address: 'Shahid Bhagat Singh Road, Colaba, Mumbai - 400005',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '35 Officers (6 Active IOs)',
    activeDockets: '7 Active Cases',
    status: 'Fully Integrated',
  },
  {
    id: 'WORLI-PS',
    name: 'Worli Police Station, Mumbai',
    zone: 'Zone III (South Central Mumbai)',
    district: 'Mumbai City',
    state: 'Maharashtra',
    inChargePI: 'Senior PI Arvind B. Shinde',
    contactNumber: '+91 22 2430 0100',
    address: 'Dr. Annie Besant Road, Worli, Mumbai - 400018',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    strength: '36 Officers (6 Active IOs)',
    activeDockets: '10 Active Cases',
    status: 'Fully Integrated',
  }
];

// GET /api/stations — List all active police stations
stationsRouter.get('/', authenticateJwt, async (_req: Request, res: Response): Promise<void> => {
  try {
    try {
      const result = await pool.query(
        'SELECT station_id as id, name, zone, district, state, in_charge_pi as "inChargePI", contact_number as "contactNumber", address, malkhana_status as "malkhanaStatus" FROM police_stations ORDER BY name ASC'
      );
      if (result.rows.length > 0) {
        res.json({ success: true, stations: result.rows });
        return;
      }
    } catch {
      // Fallback to offline store
    }
    res.json({ success: true, stations: OFFLINE_STATIONS_STORE, offline: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve police stations' });
  }
});

// POST /api/stations — Register a new police station (ADMIN only)
stationsRouter.post('/', authenticateJwt, authorizeRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { name, zone, district, inChargePI, pi, contactNumber, address, malkhanaStatus, strength, pincode } = req.body;

  if (!name || !name.trim()) {
    res.status(400).json({ success: false, error: 'Police station name is required.' });
    return;
  }

  const cleanName = name.trim();
  const stationId = `PS-${cleanName.substring(0, 4).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const effectivePI = inChargePI || pi || 'Inspector In-Charge';
  const effectiveZone = zone || 'Zone IX (Western Suburbs)';
  const effectiveDistrict = district || 'Mumbai Suburban';
  const effectiveContact = contactNumber || '+91 22 2000 0000';
  const effectiveMalkhana = malkhanaStatus || 'Vault Operational (SHA-256 Enabled)';
  const effectiveStrength = strength || '30 Officers (5 Active IOs)';

  const newStation: ServerPoliceStation = {
    id: stationId,
    name: cleanName,
    zone: effectiveZone,
    district: effectiveDistrict,
    state: 'Maharashtra',
    inChargePI: effectivePI,
    contactNumber: effectiveContact,
    address: address || '',
    malkhanaStatus: effectiveMalkhana,
    strength: effectiveStrength,
    activeDockets: '0 Active Cases',
    status: 'Fully Integrated',
  };

  try {
    try {
      await pool.query(
        `INSERT INTO police_stations (station_id, name, zone, district, state, in_charge_pi, contact_number, address, malkhana_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (station_id) DO NOTHING`,
        [stationId, cleanName, effectiveZone, effectiveDistrict, 'Maharashtra', effectivePI, effectiveContact, address || '', effectiveMalkhana]
      );
    } catch {
      // Database unavailable, continuing with offline roster
    }

    // Add to in-memory store
    const existingIdx = OFFLINE_STATIONS_STORE.findIndex(s => s.name.toLowerCase() === cleanName.toLowerCase());
    if (existingIdx >= 0) {
      OFFLINE_STATIONS_STORE[existingIdx] = newStation;
    } else {
      OFFLINE_STATIONS_STORE.unshift(newStation);
    }

    await auditService.log({
      actorBadge: user.badgeNo,
      actorName: user.username,
      actorRole: user.role,
      action: 'STATION_CREATED',
      resourceType: 'POLICE_STATION',
      resourceId: stationId,
      ipAddress: req.ip,
      notes: `Admin registered police station "${cleanName}" in ${effectiveZone}, In-Charge: ${effectivePI}`,
    });

    res.status(201).json({ success: true, station: newStation });
  } catch (err: any) {
    console.error('[STATION CREATION ERROR]', err);
    res.status(500).json({ success: false, error: 'Failed to register police station' });
  }
});
