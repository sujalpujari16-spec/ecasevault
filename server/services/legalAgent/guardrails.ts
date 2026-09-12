/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Post-Generation Guardrails & Factuality Validation Layer
 */

import { LegalRagService } from '../legalRagService';
import { LegalValidationService } from '../legalValidationService';

export interface GuardrailValidationResult {
  isValid: boolean;
  sanitizedContent: string;
  hallucinationsRemoved: string[];
  verifiedSections: string[];
}

export class AgentGuardrails {
  private static validationService = LegalValidationService.getInstance();

  /**
   * Verifies that every section cited in the generated answer exists in the authoritative legal corpus.
   * If a section does not exist or has invalid chapter/classification, it flags or sanitizes the response.
   */
  public static validateGeneratedAnswer(
    content: string,
    authorizedCaseData?: any
  ): GuardrailValidationResult {
    const ragService = LegalRagService.getInstance();
    const hallucinationsRemoved: string[] = [];
    const verifiedSections: string[] = [];

    // Extract all mentions of BNS, BNSS, BSA sections
    const citeMatches = content.matchAll(/\b(BNS|BNSS|BSA)\s*(?:Section|Sec)?\.?\s*(\d+[A-Z]?)\b/gi);
    const checkedCitations = new Set<string>();

    for (const match of citeMatches) {
      const act = match[1].toUpperCase() as 'BNS' | 'BNSS' | 'BSA';
      const secNum = match[2];

      // 2023 / 2024 is the enactment year of the Sanhitas, not a section number
      if (secNum === '2023' || secNum === '2024') continue;

      const key = `${act}-${secNum}`;

      if (checkedCitations.has(key)) continue;
      checkedCitations.add(key);

      let sectionObj = ragService.getSection(act, secNum);
      if (!sectionObj) {
        // Fallback check against authoritative cross reference database
        const inCrossRef = ragService.getCrossReferenceTable().some(
          cr => cr.newAct === act && cr.newSection === secNum
        );
        if (!inCrossRef) {
          // Hallucinated section detected
          hallucinationsRemoved.push(`Unknown or invalid statutory section cited: ${act} Section ${secNum}`);
        } else {
          verifiedSections.push(`${act} Sec ${secNum}`);
        }
      } else {
        verifiedSections.push(`${act} Sec ${secNum}`);
      }
    }

    // Check Case-level claims: If case data exists, ensure status claims match
    if (authorizedCaseData) {
      const isActuallyClosed = authorizedCaseData.status?.toLowerCase().includes('closed');
      const claimsClosed = /has\s+been\s+closed|case\s+is\s+closed/i.test(content);
      if (claimsClosed && !isActuallyClosed) {
        hallucinationsRemoved.push('Unsupported case status claim: Case claimed to be closed when status is Under Investigation.');
      }
    }

    let sanitized = content;
    // Strip hallucinated claims if needed
    for (const h of hallucinationsRemoved) {
      if (h.includes('Unknown or invalid statutory section cited:')) {
        const secPart = h.split(':')[1]?.trim();
        if (secPart) {
          sanitized = sanitized.replace(new RegExp(`\\b${secPart}\\b`, 'gi'), `[UNVERIFIED SECTION REMOVED]`);
        }
      }
    }

    return {
      isValid: hallucinationsRemoved.length === 0,
      sanitizedContent: sanitized,
      hallucinationsRemoved,
      verifiedSections,
    };
  }
}
