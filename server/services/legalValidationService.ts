/**
 * e-CASEVAULT Post-Generation Legal Validation Service
 * Validates legal assertions before output to prevent hallucinated sections,
 * false classifications, or miscategorized procedural rules.
 */

import { LegalClassificationService } from './legalClassificationService';

export interface LegalValidationReport {
  isValid: boolean;
  sectionExists: boolean;
  act: string;
  section: string;
  errors: string[];
  validatedClassification?: {
    cognizable: boolean;
    bailable: boolean;
    triable_by: string;
    source: string;
  };
}

export class LegalValidationService {
  private static instance: LegalValidationService;
  private classificationService = LegalClassificationService.getInstance();

  private validActs = new Set(['BNS', 'BNSS', 'BSA', 'MV_ACT', 'MOTOR_VEHICLES_ACT', 'IT_ACT', 'POCSO', 'NI_ACT']);

  private constructor() {}

  public static getInstance(): LegalValidationService {
    if (!LegalValidationService.instance) {
      LegalValidationService.instance = new LegalValidationService();
    }
    return LegalValidationService.instance;
  }

  /**
   * Validates a statutory citation claim
   */
  public validateCitation(
    act: string,
    section: string,
    claimedCognizable?: boolean,
    claimedBailable?: boolean
  ): LegalValidationReport {
    const errors: string[] = [];
    const cleanAct = act.toUpperCase().replace(/\s+/g, '_');
    const cleanSec = section.replace(/^(?:SECTION|SEC)?\.?\s*/i, '').trim();
    let sectionExists = true;

    // 1. Act validation
    const actRecognized = Array.from(this.validActs).some((va) => cleanAct.includes(va));
    if (!actRecognized) {
      errors.push(`Unrecognized Act: "${act}". Valid codes are BNS, BNSS, BSA, MV_ACT, IT_ACT, POCSO, NI_ACT.`);
    }

    // 2. Section number validation (Rejects hallucinated sections e.g. BNS 999)
    const secNum = parseInt(cleanSec, 10);
    if (cleanAct.includes('BNS') && !cleanAct.includes('BNSS')) {
      if (isNaN(secNum) || secNum < 1 || secNum > 358) {
        sectionExists = false;
        errors.push(`Invalid BNS Section ${cleanSec}. Bharatiya Nyaya Sanhita contains exactly 358 sections (Sections 1 to 358). Section does not exist.`);
      }
    } else if (cleanAct.includes('BNSS')) {
      if (isNaN(secNum) || secNum < 1 || secNum > 531) {
        sectionExists = false;
        errors.push(`Invalid BNSS Section ${cleanSec}. Bharatiya Nagarik Suraksha Sanhita contains exactly 531 sections (Sections 1 to 531). Section does not exist.`);
      }
    } else if (cleanAct.includes('BSA')) {
      if (isNaN(secNum) || secNum < 1 || secNum > 170) {
        sectionExists = false;
        errors.push(`Invalid BSA Section ${cleanSec}. Bharatiya Sakshya Adhiniyam contains exactly 170 sections (Sections 1 to 170). Section does not exist.`);
      }
    }

    // 3. Authoritative classification verification
    const authoritative = this.classificationService.getClassification(cleanAct, cleanSec);

    if (claimedCognizable !== undefined && authoritative.cognizable !== claimedCognizable) {
      errors.push(
        `Cognizable status mismatch: Section ${cleanSec} is officially ${authoritative.cognizable ? 'COGNIZABLE' : 'NON-COGNIZABLE'} under ${authoritative.classification_source}, but was reported as ${claimedCognizable ? 'COGNIZABLE' : 'NON-COGNIZABLE'}.`
      );
    }

    if (claimedBailable !== undefined && authoritative.bailable !== claimedBailable) {
      errors.push(
        `Bailable status mismatch: Section ${cleanSec} is officially ${authoritative.bailable ? 'BAILABLE' : 'NON-BAILABLE'} under ${authoritative.classification_source}, but was reported as ${claimedBailable ? 'BAILABLE' : 'NON-BAILABLE'}.`
      );
    }

    return {
      isValid: errors.length === 0,
      sectionExists,
      act,
      section: cleanSec,
      errors,
      validatedClassification: {
        cognizable: authoritative.cognizable,
        bailable: authoritative.bailable,
        triable_by: authoritative.triable_by,
        source: authoritative.classification_source,
      },
    };
  }
}
