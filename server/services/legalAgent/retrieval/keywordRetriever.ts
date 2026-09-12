/**
 * e-CASEVAULT Keyword Retriever
 * Phase 9: Full-Text and Keyword Matcher
 */

import { ProvisionService, LegalProvision } from '../legal/provisionService';

export interface KeywordMatchResult {
  provision: LegalProvision;
  keywordScore: number;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'by', 'is', 'are',
  'what', 'which', 'who', 'how', 'under', 'section', 'sec', 'kalm', 'act', 'code', 'law'
]);

export class KeywordRetriever {
  private static instance: KeywordRetriever;
  private provisionService: ProvisionService;

  private constructor() {
    this.provisionService = ProvisionService.getInstance();
  }

  public static getInstance(): KeywordRetriever {
    if (!KeywordRetriever.instance) {
      KeywordRetriever.instance = new KeywordRetriever();
    }
    return KeywordRetriever.instance;
  }

  public searchKeywords(
    query: string,
    actFilter?: 'BNS' | 'BNSS' | 'BSA',
    limit: number = 20
  ): KeywordMatchResult[] {
    const tokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

    if (tokens.length === 0) return [];

    const all = this.provisionService.getAllProvisions(actFilter);
    const scored: KeywordMatchResult[] = [];

    for (const p of all) {
      const title = p.sectionTitle.toLowerCase();
      const text = p.cleanText.toLowerCase();

      let matchCount = 0;
      let titleHits = 0;

      for (const token of tokens) {
        let hit = false;
        if (title.includes(token)) {
          titleHits += 1;
          hit = true;
        }
        if (text.includes(token)) {
          hit = true;
        }
        if (hit) matchCount += 1;
      }

      if (matchCount > 0) {
        // Base score based on ratio of matched tokens
        const tokenRatio = matchCount / tokens.length;
        const titleBonus = (titleHits / tokens.length) * 0.4;
        const rawScore = Math.min(1.0, tokenRatio * 0.6 + titleBonus);

        scored.push({
          provision: p,
          keywordScore: parseFloat(rawScore.toFixed(3)),
        });
      }
    }

    return scored.sort((a, b) => b.keywordScore - a.keywordScore).slice(0, limit);
  }
}
