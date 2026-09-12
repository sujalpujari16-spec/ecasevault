/**
 * e-CASEVAULT Hybrid Reranker
 * Phase 11: Composite Scoring and Disambiguation
 * Ensures exact title / exact section matches dominate over vague semantic proximity.
 */

import { LegalProvision } from '../legal/provisionService';

export interface RetrievalResult {
  provisionId: string;
  act: string;
  section: string;
  title: string;
  exactScore: number;
  keywordScore: number;
  vectorScore: number;
  finalScore: number;
  matchType: 'EXACT_SECTION' | 'EXACT_TITLE' | 'KEYWORD' | 'SEMANTIC' | 'RELATED';
  provision: LegalProvision;
}

export class Reranker {
  private static instance: Reranker;

  public static getInstance(): Reranker {
    if (!Reranker.instance) {
      Reranker.instance = new Reranker();
    }
    return Reranker.instance;
  }

  /**
   * Computes composite score and classifies match type.
   * Priority:
   * 1. EXACT_SECTION: finalScore = 1.00
   * 2. EXACT_TITLE: finalScore = 0.60 * exactTitle + 0.25 * keyword + 0.15 * vector (reaches ~0.98)
   * 3. KEYWORD: finalScore = 0.60 * keyword + 0.40 * vector
   * 4. SEMANTIC: finalScore = vectorScore
   */
  public rerank(
    provision: LegalProvision,
    exactScore: number,
    keywordScore: number,
    vectorScore: number,
    isExactSection: boolean = false
  ): RetrievalResult {
    let finalScore = 0;
    let matchType: RetrievalResult['matchType'] = 'SEMANTIC';

    if (isExactSection) {
      finalScore = 1.0;
      matchType = 'EXACT_SECTION';
    } else if (exactScore >= 0.95) {
      // Exact Title match (e.g., BNS 109 for "attempt to murder")
      finalScore = parseFloat((0.60 * exactScore + 0.25 * keywordScore + 0.15 * vectorScore).toFixed(3));
      matchType = 'EXACT_TITLE';
    } else if (keywordScore >= 0.6) {
      finalScore = parseFloat((0.65 * keywordScore + 0.35 * vectorScore).toFixed(3));
      matchType = 'KEYWORD';
    } else {
      finalScore = parseFloat((0.80 * vectorScore + 0.20 * keywordScore).toFixed(3));
      matchType = vectorScore > 0.5 ? 'SEMANTIC' : 'RELATED';
    }

    return {
      provisionId: provision.id,
      act: provision.actCode,
      section: provision.sectionNumber,
      title: provision.sectionTitle,
      exactScore: parseFloat(exactScore.toFixed(3)),
      keywordScore: parseFloat(keywordScore.toFixed(3)),
      vectorScore: parseFloat(vectorScore.toFixed(3)),
      finalScore: parseFloat(Math.min(1.0, Math.max(0.0, finalScore)).toFixed(3)),
      matchType,
      provision,
    };
  }
}
