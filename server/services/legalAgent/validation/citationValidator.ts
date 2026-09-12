/**
 * e-CASEVAULT Citation Validator
 * Phase 19: Prevents hallucinated statutory sections (e.g., BNS 999)
 */

import { ProvisionService } from '../legal/provisionService';

export interface CitationValidationResult {
  isValid: boolean;
  validCitations: string[];
  hallucinatedCitations: string[];
}

export class CitationValidator {
  private static instance: CitationValidator;
  private provisionService = ProvisionService.getInstance();

  public static getInstance(): CitationValidator {
    if (!CitationValidator.instance) {
      CitationValidator.instance = new CitationValidator();
    }
    return CitationValidator.instance;
  }

  /**
   * Validates an array of section references (e.g., ["BNS_109", "BNS_999", "BNSS_173"])
   */
  public validateCitations(sourceIds: string[]): CitationValidationResult {
    const validCitations: string[] = [];
    const hallucinatedCitations: string[] = [];

    for (const id of sourceIds) {
      // Normalize ID format: "BNS_109" or "BNS Section 109" or "PROV-BNS-109"
      const match = id.match(/(BNS|BNSS|BSA)[_\s-]*(\d+[A-Z]?)/i);
      if (match) {
        const act = match[1].toUpperCase();
        const sec = match[2].toUpperCase();
        const provision = this.provisionService.getExactSection(act, sec);
        if (provision) {
          validCitations.push(`${act} Section ${sec}`);
        } else {
          hallucinatedCitations.push(id);
        }
      } else {
        // Unknown format
        hallucinatedCitations.push(id);
      }
    }

    return {
      isValid: hallucinatedCitations.length === 0,
      validCitations,
      hallucinatedCitations,
    };
  }

  /**
   * Scans text content for any fabricated statutory citations
   */
  public scanTextForHallucinations(text: string): string[] {
    const regex = /\b(bns|bnss|bsa)\s*(?:section|sec)?\.?\s*(\d+[A-Z]?)\b/gi;
    const hallucinations: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const act = match[1].toUpperCase();
      const sec = match[2].toUpperCase();
      if (sec === '2023' || sec === '2024') continue;

      const prov = this.provisionService.getExactSection(act, sec);
      if (!prov) {
        hallucinations.push(`${act} Section ${sec}`);
      }
    }

    return hallucinations;
  }
}
