/**
 * e-CASEVAULT Legal Act Service
 * Phase 4: Authoritative Legal Acts Registry
 */

export interface LegalAct {
  id: string;
  act_code: 'BNS' | 'BNSS' | 'BSA';
  act_name: string;
  jurisdiction: string;
  language: string;
  version: string;
  effective_from: string;
  effective_to?: string;
  source_document: string;
  status: 'ACTIVE' | 'ARCHIVED';
}

export const CANONICAL_ACTS: Record<'BNS' | 'BNSS' | 'BSA', LegalAct> = {
  BNS: {
    id: 'act-bns-2023',
    act_code: 'BNS',
    act_name: 'Bharatiya Nyaya Sanhita, 2023',
    jurisdiction: 'Union of India / State of Maharashtra',
    language: 'en',
    version: 'Act No. 45 of 2023',
    effective_from: '2024-07-01',
    source_document: 'Gazette of India, Extraordinary, Part II, Section 1',
    status: 'ACTIVE',
  },
  BNSS: {
    id: 'act-bnss-2023',
    act_code: 'BNSS',
    act_name: 'Bharatiya Nagarik Suraksha Sanhita, 2023',
    jurisdiction: 'Union of India / State of Maharashtra',
    language: 'en',
    version: 'Act No. 46 of 2023',
    effective_from: '2024-07-01',
    source_document: 'Gazette of India, Extraordinary, Part II, Section 1',
    status: 'ACTIVE',
  },
  BSA: {
    id: 'act-bsa-2023',
    act_code: 'BSA',
    act_name: 'Bharatiya Sakshya Adhiniyam, 2023',
    jurisdiction: 'Union of India / State of Maharashtra',
    language: 'en',
    version: 'Act No. 47 of 2023',
    effective_from: '2024-07-01',
    source_document: 'Gazette of India, Extraordinary, Part II, Section 1',
    status: 'ACTIVE',
  },
};

export class ActService {
  private static instance: ActService;

  public static getInstance(): ActService {
    if (!ActService.instance) {
      ActService.instance = new ActService();
    }
    return ActService.instance;
  }

  public getAct(actCode: string): LegalAct | null {
    const code = actCode.toUpperCase() as 'BNS' | 'BNSS' | 'BSA';
    return CANONICAL_ACTS[code] || null;
  }

  public getAllActs(): LegalAct[] {
    return Object.values(CANONICAL_ACTS);
  }

  public isValidAct(actCode: string): boolean {
    return ['BNS', 'BNSS', 'BSA'].includes(actCode.toUpperCase());
  }
}
