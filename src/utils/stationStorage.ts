/**
 * e-CASEVAULT — Maharashtra Police Station Jurisdictions & Precincts
 * 
 * Provides persistent station management allowing System Administrators
 * to register new police stations, view jurisdiction details, and integrate
 * newly registered stations dynamically across all case and officer forms.
 */

export interface PoliceStationDetail {
  id: string;
  name: string;
  zone: string;
  district: string;
  pi: string;
  strength: string;
  activeDockets: string;
  malkhanaStatus: string;
  contactNumber: string;
  address?: string;
  status: string;
  pincode?: string;
  isCustom?: boolean;
}

export const DEFAULT_POLICE_STATIONS: PoliceStationDetail[] = [
  {
    id: 'ANDHERI-PS',
    name: 'Andheri Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    pi: 'Inspector Rajesh Patil',
    strength: '42 Officers (8 Active IOs)',
    activeDockets: '14 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2683 0100',
    address: 'S. V. Road, Andheri West, Mumbai - 400058',
    status: 'Fully Integrated',
  },
  {
    id: 'BANDRA-PS',
    name: 'Bandra Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    pi: 'Inspector Sunil M. Kadam',
    strength: '38 Officers (6 Active IOs)',
    activeDockets: '11 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2642 0100',
    address: 'Hill Road, Bandra West, Mumbai - 400050',
    status: 'Fully Integrated',
  },
  {
    id: 'JUHU-PS',
    name: 'Juhu Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    pi: 'Inspector Mahesh T. Parab',
    strength: '30 Officers (5 Active IOs)',
    activeDockets: '8 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2618 0100',
    address: 'Juhu Tara Road, Juhu, Mumbai - 400049',
    status: 'Fully Integrated',
  },
  {
    id: 'VERSOVA-PS',
    name: 'Versova Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    pi: 'Inspector Prakash D. Gaikwad',
    strength: '32 Officers (5 Active IOs)',
    activeDockets: '9 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2636 0100',
    address: 'Yari Road, Versova, Andheri West, Mumbai - 400061',
    status: 'Fully Integrated',
  },
  {
    id: 'SANTACRUZ-PS',
    name: 'Santacruz Police Station, Mumbai',
    zone: 'Zone IX (Western Suburbs)',
    district: 'Mumbai Suburban',
    pi: 'Inspector Anand R. Desai',
    strength: '34 Officers (6 Active IOs)',
    activeDockets: '10 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2649 0100',
    address: 'Juhu Road, Santacruz West, Mumbai - 400054',
    status: 'Fully Integrated',
  },
  {
    id: 'KURLA-PS',
    name: 'Kurla Police Station, Mumbai',
    zone: 'Zone V (Eastern Suburbs)',
    district: 'Mumbai Suburban',
    pi: 'Inspector Ramesh N. Sawant',
    strength: '40 Officers (7 Active IOs)',
    activeDockets: '12 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2650 0100',
    address: 'LBS Marg, Kurla West, Mumbai - 400070',
    status: 'Fully Integrated',
  },
  {
    id: 'DADAR-PS',
    name: 'Dadar Police Station, Mumbai',
    zone: 'Zone V (Central Mumbai)',
    district: 'Mumbai City',
    pi: 'Senior PI Ramesh S. Shinde',
    strength: '36 Officers (6 Active IOs)',
    activeDockets: '13 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2414 0100',
    address: 'Dr. Babasaheb Ambedkar Road, Dadar East, Mumbai - 400014',
    status: 'Fully Integrated',
  },
  {
    id: 'COLABA-PS',
    name: 'Colaba Police Station, Mumbai',
    zone: 'Zone I (South Mumbai)',
    district: 'Mumbai City',
    pi: 'Senior PI Dilip M. Mane',
    strength: '35 Officers (6 Active IOs)',
    activeDockets: '7 Active Cases',
    malkhanaStatus: 'Vault Operational (SHA-256 Enabled)',
    contactNumber: '+91 22 2285 0100',
    address: 'Shahid Bhagat Singh Road, Colaba, Mumbai - 400005',
    status: 'Fully Integrated',
  }
];

const STATIONS_STORAGE_KEY = 'casevault_police_stations_v1';

export function getStoredStations(): PoliceStationDetail[] {
  if (typeof window === 'undefined') return DEFAULT_POLICE_STATIONS;
  try {
    const raw = localStorage.getItem(STATIONS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STATIONS_STORAGE_KEY, JSON.stringify(DEFAULT_POLICE_STATIONS));
      return DEFAULT_POLICE_STATIONS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const customIds = new Set(parsed.map((p: any) => p.id || p.name));
      const missingDefaults = DEFAULT_POLICE_STATIONS.filter(d => !customIds.has(d.id) && !customIds.has(d.name));
      return [...parsed, ...missingDefaults];
    }
    return DEFAULT_POLICE_STATIONS;
  } catch {
    return DEFAULT_POLICE_STATIONS;
  }
}

export function saveStation(station: Omit<PoliceStationDetail, 'id'> & { id?: string }): PoliceStationDetail {
  const current = getStoredStations();
  const id = station.id || `PS-${Date.now().toString(36).toUpperCase()}`;
  const newStation: PoliceStationDetail = {
    ...station,
    id,
    activeDockets: station.activeDockets || '0 Active Cases',
    malkhanaStatus: station.malkhanaStatus || 'Vault Operational (SHA-256 Enabled)',
    status: station.status || 'Fully Integrated',
    isCustom: true,
  };

  const updated = [newStation, ...current.filter(s => s.name !== newStation.name && s.id !== newStation.id)];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STATIONS_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('casevault:station-added', { detail: newStation }));
    } catch (e) {
      console.warn('Failed to save police station to localStorage:', e);
    }
  }
  return newStation;
}

export function getStationNames(): string[] {
  const stations = getStoredStations();
  return stations.map(s => s.name);
}
