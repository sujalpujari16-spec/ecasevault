/**
 * e-CASEVAULT Query Analyzer
 * Phase 12: Structured Query Decomposition and Ambiguity Detection
 */

import { QueryNormalizer } from './queryNormalizer';
import { IntentClassifier, QueryIntent } from './intentClassifier';

export interface QueryAnalysis {
  rawQuery: string;
  normalizedQuery: string;
  intent: QueryIntent;
  act: 'BNS' | 'BNSS' | 'BSA' | null;
  section: string | null;
  concept: string | null;
  caseId: string | null;
  language: 'en' | 'mr';
  requiresCaseData: boolean;
  requiresEvidenceData: boolean;
  ambiguity: boolean;
  possibleActs?: ('BNS' | 'BNSS' | 'BSA')[];
  ambiguityReason?: string;
}

export class QueryAnalyzer {
  private static instance: QueryAnalyzer;
  private normalizer = QueryNormalizer.getInstance();
  private classifier = IntentClassifier.getInstance();

  public static getInstance(): QueryAnalyzer {
    if (!QueryAnalyzer.instance) {
      QueryAnalyzer.instance = new QueryAnalyzer();
    }
    return QueryAnalyzer.instance;
  }

  public analyze(query: string, activeCaseId?: string | null): QueryAnalysis {
    const { normalized, language } = this.normalizer.normalize(query);

    // 1. Detect Act
    let act: 'BNS' | 'BNSS' | 'BSA' | null = null;
    if (/\bbns\b/i.test(normalized)) act = 'BNS';
    else if (/\bbnss\b/i.test(normalized)) act = 'BNSS';
    else if (/\bbsa\b/i.test(normalized)) act = 'BSA';

    // 2. Detect Section
    let section: string | null = null;
    const secMatch = normalized.match(/\b(?:section|sec|kalm)?\.?\s*(\d+[A-Z]?)\b/i);
    if (secMatch && secMatch[1] !== '2023' && secMatch[1] !== '2024') {
      section = secMatch[1].toUpperCase();
    }

    // 3. Detect Case Docket / FIR ID
    let caseId: string | null = null;
    const caseMatch = normalized.match(/\b(CASE[-\s]?\d{4}[-\s]?\d+|CASE[-\s]?\d+|FIR[-\s]?[A-Z0-9\/-]+|CR[-\s]?\d+)\b/i) ||
      normalized.match(/\b(0431|0142|0188|04821)\b/i);

    if (caseMatch) {
      caseId = caseMatch[1].replace(/\s+/g, '-').toUpperCase();
    } else if (activeCaseId) {
      caseId = activeCaseId;
    }

    // 4. Ambiguity Detection (e.g., "sec 33" without specified Act)
    const isBareSectionOnly = Boolean(section && !act && !caseId && normalized.split(' ').length <= 3 && !/murder|theft|robbery|bail/i.test(normalized));
    const ambiguity = isBareSectionOnly;

    // 5. Concept Extraction
    let concept: string | null = null;
    if (!section && !caseId) {
      concept = normalized
        .replace(/\b(section|sec|kalm|act|law|under|in|for|what|is|explain|tell|me|about)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } else if (section && !act) {
      concept = `Section ${section}`;
    }

    // 6. Classify Intent
    const intent = this.classifier.classify(normalized, Boolean(caseId), isBareSectionOnly);

    return {
      rawQuery: query,
      normalizedQuery: normalized,
      intent,
      act,
      section,
      concept,
      caseId,
      language,
      requiresCaseData: intent === 'CASE_ANALYSIS' || intent === 'FACT_TO_LAW' || intent === 'EVIDENCE_INTEGRITY',
      requiresEvidenceData: intent === 'EVIDENCE_INTEGRITY',
      ambiguity,
      possibleActs: ambiguity ? ['BNS', 'BNSS', 'BSA'] : undefined,
      ambiguityReason: ambiguity ? `Section ${section} exists in BNS, BNSS, and BSA. Please clarify which Act you mean.` : undefined,
    };
  }
}
