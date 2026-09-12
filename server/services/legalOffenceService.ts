/**
 * e-CASEVAULT Legal Offence Entity & Provision Mapping Service
 * Discovers and maps criminal offences to distinct statutory provision roles:
 * - PRIMARY: Core substantive definition or charging provision (e.g. BNS 101 for Murder)
 * - PUNISHMENT: Prescribed penal sentence provision (e.g. BNS 103 for Murder)
 * - CONDITIONAL: Aggravating circumstances triggered only if specific facts exist (e.g. BNS 103(2))
 * - PROCEDURAL: Compulsory investigation guidelines under BNSS (e.g. BNSS 173, BNSS 187)
 * - EVIDENTIARY: Compulsory evidence admissibility standards under BSA (e.g. BSA 39, BSA 63)
 * - RELATED: Ancillary or inchoate provisions (e.g. BNS 109, BNS 61)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LegalClassificationService, AuthoritativeClassification } from './legalClassificationService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LegalOffence {
  offence_id: string;
  canonical_name: string;
  aliases: string[];
  keywords: string[];
  description: string;
}

export interface OffenceProvisionItem {
  act: string;
  section: string;
  title: string;
  role: 'PRIMARY' | 'PUNISHMENT' | 'CONDITIONAL' | 'PROCEDURAL' | 'EVIDENTIARY' | 'RELATED' | 'DEFINITION';
  why_relevant: string;
  trigger_condition?: string;
  priority: number;
  classification?: AuthoritativeClassification;
}

export interface OffenceProvisionMapping {
  offence_id: string;
  primary: OffenceProvisionItem[];
  punishment: OffenceProvisionItem[];
  conditional: OffenceProvisionItem[];
  procedural: OffenceProvisionItem[];
  evidentiary: OffenceProvisionItem[];
  related: OffenceProvisionItem[];
}

export interface StructuredOffenceResult {
  offence: LegalOffence;
  primaryProvisions: OffenceProvisionItem[];
  punishmentProvisions: OffenceProvisionItem[];
  conditionalProvisions: Array<OffenceProvisionItem & { conditionSatisfied: boolean; note: string }>;
  proceduralProvisions: OffenceProvisionItem[];
  evidentiaryProvisions: OffenceProvisionItem[];
  relatedProvisions: OffenceProvisionItem[];
  negativeExclusions: Array<{ section: string; act: string; warning: string }>;
  summary: string;
}

export class LegalOffenceService {
  private static instance: LegalOffenceService;
  private offences: LegalOffence[] = [];
  private mappings: Map<string, OffenceProvisionMapping> = new Map();
  private classificationService = LegalClassificationService.getInstance();
  private initialized = false;

  private constructor() {}

  public static getInstance(): LegalOffenceService {
    if (!LegalOffenceService.instance) {
      LegalOffenceService.instance = new LegalOffenceService();
    }
    return LegalOffenceService.instance;
  }

  public initialize(): void {
    if (this.initialized) return;

    try {
      const offencesPath = path.resolve(__dirname, '../data/legal/legal_offences.json');
      const mappingsPath = path.resolve(__dirname, '../data/legal/offence_provisions.json');

      if (fs.existsSync(offencesPath)) {
        const raw = fs.readFileSync(offencesPath, 'utf-8');
        const data = JSON.parse(raw);
        this.offences = data.offences || [];
      }

      if (fs.existsSync(mappingsPath)) {
        const raw = fs.readFileSync(mappingsPath, 'utf-8');
        const data = JSON.parse(raw);
        const mapList: OffenceProvisionMapping[] = data.mappings || [];
        for (const m of mapList) {
          // Enrich with authoritative procedural classification
          const enrich = (items: OffenceProvisionItem[]) =>
            items.map((item) => ({
              ...item,
              classification: this.classificationService.getClassification(item.act, item.section),
            }));

          this.mappings.set(m.offence_id, {
            offence_id: m.offence_id,
            primary: enrich(m.primary || []),
            punishment: enrich(m.punishment || []),
            conditional: enrich(m.conditional || []),
            procedural: enrich(m.procedural || []),
            evidentiary: enrich(m.evidentiary || []),
            related: enrich(m.related || []),
          });
        }
      }

      this.initialized = true;
    } catch (err) {
      console.error('[LegalOffenceService] Failed to load offence entities and mappings:', err);
      this.initialized = true;
    }
  }

  /**
   * Identifies criminal offence from user query
   */
  public detectOffence(query: string): LegalOffence | null {
    this.initialize();

    const q = query.toLowerCase();

    // Check specific compound offences first (e.g. attempt to murder before murder)
    const sorted = [...this.offences].sort((a, b) => {
      const maxLenA = Math.max(...a.aliases.map((al) => al.length));
      const maxLenB = Math.max(...b.aliases.map((al) => al.length));
      return maxLenB - maxLenA;
    });

    for (const off of sorted) {
      for (const alias of off.aliases) {
        const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (pattern.test(q)) {
          return off;
        }
      }
    }

    return null;
  }

  /**
   * Resolves full structured legal advisory for an offence
   */
  public getStructuredOffenceAdvisory(offence: LegalOffence, incidentFacts: string): StructuredOffenceResult {
    this.initialize();

    const mapping = this.mappings.get(offence.offence_id) || {
      offence_id: offence.offence_id,
      primary: [],
      punishment: [],
      conditional: [],
      procedural: [],
      evidentiary: [],
      related: [],
    };

    const textLower = incidentFacts.toLowerCase();

    // Evaluate conditional provisions
    const evaluatedConditional: StructuredOffenceResult['conditionalProvisions'] = mapping.conditional.map((cond) => {
      let conditionSatisfied = false;
      let note = 'Condition NOT met in incident facts. Do not charge unless specific aggravating factors are established.';

      if (offence.offence_id === 'MURDER' && cond.section.includes('103(2)')) {
        const hasMob =
          /\b(5|five|group|mob|lynch\w*|gang|caste|race|religion|community|acting in concert)\b/i.test(textLower);
        if (hasMob) {
          conditionSatisfied = true;
          note = 'APPLICABLE: Facts indicate group of 5+ persons or mob lynching on grounds of identity/caste/religion.';
        } else {
          note = 'CONDITIONAL (OFFICER WARNING): Applies ONLY IF murder was committed by 5+ persons acting in concert on grounds of race, caste, sex, language, or religion.';
        }
      } else if (offence.offence_id === 'DRUNK_DRIVING') {
        if (cond.section === '281') {
          const hasRash = /\b(rash|speeding|reckless|zig-zag|weaving|dangerous|erratic)\b/i.test(textLower);
          conditionSatisfied = hasRash;
          note = hasRash
            ? 'APPLICABLE: Factual evidence indicates observable reckless/rash vehicle navigation.'
            : 'CONDITIONAL: Charge ONLY IF observable rash or negligent driving occurred on a public road.';
        } else if (cond.section === '125') {
          const hasEndanger = /\b(endanger|pedestrian|bystander|near miss|collision|risk)\b/i.test(textLower);
          conditionSatisfied = hasEndanger;
          note = hasEndanger
            ? 'APPLICABLE: Overt act actively jeopardized personal safety of road users.'
            : 'CONDITIONAL: Charge ONLY IF overt danger to personal safety is proven.';
        }
      } else if (offence.offence_id === 'THEFT' && cond.section === '305') {
        const hasDwelling = /\b(house|home|flat|building|car|bus|train|vehicle|temple|mosque|church|worship)\b/i.test(textLower);
        conditionSatisfied = hasDwelling;
        note = hasDwelling
          ? 'APPLICABLE: Theft committed inside building, dwelling house, means of transport, or place of worship.'
          : 'CONDITIONAL: Applies ONLY IF theft was committed inside a dwelling place or vehicle.';
      } else if (offence.offence_id === 'RAPE' && cond.section === '65') {
        const isMinor = /\b(minor|child|girl|16|12|years old|school|juvenile)\b/i.test(textLower);
        conditionSatisfied = isMinor;
        note = isMinor
          ? 'APPLICABLE: Victim is under 16 or 12 years of age (enhanced punishment / death penalty).'
          : 'CONDITIONAL: Applies ONLY IF victim is a minor under statutory age thresholds.';
      }

      return {
        ...cond,
        conditionSatisfied,
        note,
      };
    });

    // Negative exclusions (Crucial legal boundaries)
    const negativeExclusions: StructuredOffenceResult['negativeExclusions'] = [];
    if (offence.offence_id === 'MURDER') {
      negativeExclusions.push({
        act: 'BNS',
        section: '106',
        warning: 'Causing death by negligence (BNS 106) does NOT apply when there is intentional killing or knowledge amounting to murder.',
      });
      negativeExclusions.push({
        act: 'BNS',
        section: '1',
        warning: 'BNS Section 1 is an administrative enactment title and commencement section, NOT an offence provision.',
      });
      negativeExclusions.push({
        act: 'BNS',
        section: '46',
        warning: 'BNS Section 46 is a general definition of Abettor and must NOT be cited as the primary murder charge unless specific abetment is being investigated.',
      });
    } else if (offence.offence_id === 'DRUNK_DRIVING') {
      const hasFatality = /\b(dead|death|died|killed|fatality)\b/i.test(textLower);
      if (!hasFatality) {
        negativeExclusions.push({
          act: 'BNS',
          section: '106',
          warning: 'CRITICAL OFFICER WARNING: BNS Section 106 (Causing death by negligence) is STRICTLY NOT APPLICABLE. DO NOT CHARGE UNLESS A HUMAN CASUALTY / DEATH OCCURRED.',
        });
      }
    }

    let summary = `Legal incident identified as ${offence.canonical_name}. Under Bharatiya criminal law, the matter is governed primarily under ${mapping.primary.map((p) => `${p.act} Section ${p.section}`).join(', ')}.`;

    if (offence.offence_id === 'MURDER') {
      summary = `MURDER STATUTORY ADVISORY: The primary statutory definition is **BNS Section 101 (Murder)**. The mandatory punishment is prescribed under **BNS Section 103 (Punishment for murder)** (Death or imprisonment for life and fine). **BNS Section 103(2)** governs mob lynching or group murder on identity grounds and applies only when specific conditions are met. Relevant BNSS procedures govern investigation, FIR registration (BNSS 173), and remand (BNSS 187).`;
    } else if (offence.offence_id === 'DRUNK_DRIVING') {
      summary = `DRUNK DRIVING ENFORCEMENT ADVISORY: The primary substantive charge is **Motor Vehicles Act 1988, Section 185** (BAC > 30mg/100ml). BNS Section 281 and 125 are conditional upon proof of observable rash driving. BNS Section 106 is excluded unless death occurred. Mandatory electronic audio-video recording under BNSS Section 105 and medical blood analysis within 2 hours under MV Act Section 204 are compulsory.`;
    }

    return {
      offence,
      primaryProvisions: mapping.primary,
      punishmentProvisions: mapping.punishment,
      conditionalProvisions: evaluatedConditional,
      proceduralProvisions: mapping.procedural,
      evidentiaryProvisions: mapping.evidentiary,
      relatedProvisions: mapping.related,
      negativeExclusions,
      summary,
    };
  }
}
