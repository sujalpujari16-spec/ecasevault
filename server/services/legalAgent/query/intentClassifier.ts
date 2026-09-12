/**
 * e-CASEVAULT Intent Classifier
 * Categorizes user inquiries into structured operational intents.
 */

export type QueryIntent =
  | 'SECTION_LOOKUP'
  | 'LEGAL_CONCEPT'
  | 'CASE_ANALYSIS'
  | 'FACT_TO_LAW'
  | 'EVIDENCE_INTEGRITY'
  | 'AMBIGUOUS'
  | 'PROCEDURE';

export class IntentClassifier {
  private static instance: IntentClassifier;

  public static getInstance(): IntentClassifier {
    if (!IntentClassifier.instance) {
      IntentClassifier.instance = new IntentClassifier();
    }
    return IntentClassifier.instance;
  }

  public classify(
    normalizedQuery: string,
    hasCaseId: boolean,
    hasBareSectionOnly: boolean
  ): QueryIntent {
    const q = normalizedQuery.toLowerCase();

    if (hasBareSectionOnly) {
      return 'AMBIGUOUS';
    }

    if (hasCaseId) {
      if (/tamper|modified|altered|hash|integrity|validat|fabric|blockchain/i.test(q)) {
        return 'EVIDENCE_INTEGRITY';
      }
      if (/relevant\s*provision|sections?\s*apply|charge\s*sheet|which\s*(?:bns|law)|facts?\s*(?:to|and)\s*law/i.test(q)) {
        return 'FACT_TO_LAW';
      }
      return 'CASE_ANALYSIS';
    }

    if (/\b(bns|bnss|bsa)\b[\s,:\.-]*(?:section)?\.?\s*\d+/i.test(q) ||
        /(?:section)?\.?\s*\d+[\s,:\.-]*\b(bns|bnss|bsa)\b/i.test(q)) {
      return 'SECTION_LOOKUP';
    }

    if (/procedure|how\s*to\s*(?:arrest|seize|record)|timeline|remand|bail\s*procedure|custody\s*rules/i.test(q)) {
      return 'PROCEDURE';
    }

    return 'LEGAL_CONCEPT';
  }
}
