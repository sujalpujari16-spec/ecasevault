/**
 * e-CASEVAULT Abstention Service
 * Determines when the AI must safely abstain rather than speculate.
 */

export interface AbstentionDecision {
  shouldAbstain: boolean;
  reason?: string;
  responseTemplate?: string;
}

export class AbstentionService {
  private static instance: AbstentionService;

  public static getInstance(): AbstentionService {
    if (!AbstentionService.instance) {
      AbstentionService.instance = new AbstentionService();
    }
    return AbstentionService.instance;
  }

  public evaluate(
    query: string,
    retrievedProvisionsCount: number,
    caseFound: boolean,
    requiresCase: boolean
  ): AbstentionDecision {
    if (requiresCase && !caseFound) {
      return {
        shouldAbstain: true,
        reason: 'CASE_NOT_FOUND',
        responseTemplate:
          '### 🛑 Case Record Required\n\nI could not find the specified case docket in the authorized precinct database. Please verify the Case/FIR number.',
      };
    }

    if (retrievedProvisionsCount === 0) {
      return {
        shouldAbstain: true,
        reason: 'INSUFFICIENT_STATUTORY_DATA',
        responseTemplate:
          '### ⚖️ Insufficient Legal Corpus Match\n\nI could not find an authoritative statutory provision in BNS, BNSS, or BSA corresponding to this inquiry. Please refine your search terms.',
      };
    }

    return { shouldAbstain: false };
  }
}
