/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Local Vector Retriever & Statutory Ranker
 */

import { StatutorySection } from './types';
import { LocalEmbeddingEngine } from './embeddings';
import { LegalRagService } from '../legalRagService';

export interface RankedSearchResult {
  section: StatutorySection;
  score: number;
  matchType: 'EXACT_SECTION' | 'KEYWORD_MATCH' | 'SEMANTIC_SIMILARITY';
}

const GENERIC_LEGAL_TERMS = new Set([
  'bharatiya', 'nyaya', 'sanhita', 'nagarik', 'suraksha', 'sakshya', 'adhiniyam',
  '2023', '2024', 'section', 'sec', 'act', 'law', 'explain', 'what', 'is', 'the',
  'under', 'punishment', 'for', 'provisions', 'procedure', 'cases', 'ipc', 'crpc', 'offence', 'offences'
]);

const CANONICAL_TOPIC_MAPPINGS: { pattern: RegExp; act: string; section: string }[] = [
  { pattern: /\b(theft|stolen|chori|stealing)\b/i, act: 'BNS', section: '303' },
  { pattern: /\b(murder|homicide|mob\s*lynching)\b/i, act: 'BNS', section: '103' },
  { pattern: /\b(culpable\s*homicide)\b/i, act: 'BNS', section: '105' },
  { pattern: /\b(rash\s*driv\w*|negligent\s*driv\w*)\b/i, act: 'BNS', section: '281' },
  { pattern: /\b(hit\s*and\s*run)\b/i, act: 'BNS', section: '106' },
  { pattern: /\b(search\s*and\s*seizure|audio\s*video\s*recording|videograph\w*)\b/i, act: 'BNSS', section: '105' },
  { pattern: /\b(fir|first\s*information\s*report|zero\s*fir)\b/i, act: 'BNSS', section: '173' },
  { pattern: /\b(electronic\s*record|electronic\s*evidence|65b|digital\s*evidence)\b/i, act: 'BSA', section: '63' },
  { pattern: /\b(remand|police\s*custody|custodial)\b/i, act: 'BNSS', section: '187' },
  { pattern: /\b(cheating|fraud|420)\b/i, act: 'BNS', section: '318' },
  { pattern: /\b(robbery)\b/i, act: 'BNS', section: '309' },
  { pattern: /\b(extortion)\b/i, act: 'BNS', section: '308' },
  { pattern: /\b(bail|anticipatory\s*bail)\b/i, act: 'BNSS', section: '480' },
];

export class LocalLegalRetriever {
  private static instance: LocalLegalRetriever;
  private embeddingEngine: LocalEmbeddingEngine;

  private constructor() {
    this.embeddingEngine = LocalEmbeddingEngine.getInstance();
  }

  public static getInstance(): LocalLegalRetriever {
    if (!LocalLegalRetriever.instance) {
      LocalLegalRetriever.instance = new LocalLegalRetriever();
    }
    return LocalLegalRetriever.instance;
  }

  /**
   * Retrieves and ranks statutory provisions using dual local retrieval:
   * exact section match + canonical topic lookup + keyword relevance + local vector cosine similarity.
   */
  public async retrieveRelevantSections(
    query: string,
    actFilter?: 'BNS' | 'BNSS' | 'BSA',
    limit: number = 5
  ): Promise<RankedSearchResult[]> {
    const ragService = LegalRagService.getInstance();
    await ragService.initialize();

    const allSections = ragService.getAllSections(actFilter);
    const cleanQuery = query.toLowerCase().trim();

    // 1. Direct section number pattern matching (e.g., "103", "section 185", "bnss 173")
    const exactMatch = cleanQuery.match(/\b(bns|bnss|bsa)?\s*(?:section|sec)?\.?\s*(\d+[A-Z]?)\b/i);
    const targetSection = exactMatch && exactMatch[2] !== '2023' && exactMatch[2] !== '2024' ? exactMatch[2].toUpperCase() : null;
    const targetAct = exactMatch && exactMatch[1] ? exactMatch[1].toUpperCase() : null;

    // Check canonical topic matches in query
    const matchedCanonical = CANONICAL_TOPIC_MAPPINGS.filter(m => m.pattern.test(cleanQuery));

    const queryEmbedding = await this.embeddingEngine.getEmbedding(cleanQuery);
    const scored: RankedSearchResult[] = [];

    for (const sec of allSections) {
      let score = 0;
      let matchType: RankedSearchResult['matchType'] = 'SEMANTIC_SIMILARITY';

      // Exact Section Number Match gets top boost
      if (targetSection && sec.sectionNumber.toUpperCase() === targetSection) {
        if (!targetAct || sec.act === targetAct) {
          score += 10.0;
          matchType = 'EXACT_SECTION';
        }
      }

      // Canonical Topic Match gets top boost (e.g. Theft -> BNS 303)
      for (const cm of matchedCanonical) {
        if (sec.act === cm.act && sec.sectionNumber === cm.section) {
          score += 12.0;
          matchType = 'EXACT_SECTION';
        }
      }

      // Title Match
      const secTitleLower = sec.title.toLowerCase();
      if (cleanQuery.includes(secTitleLower) && secTitleLower.length > 3) {
        score += 4.0;
        matchType = 'KEYWORD_MATCH';
      }

      // Keyword Occurrences (excluding generic legal stop terms)
      for (const kw of sec.keywords) {
        const kwLower = kw.toLowerCase();
        if (GENERIC_LEGAL_TERMS.has(kwLower)) continue;
        if (cleanQuery.includes(kwLower) && kwLower.length > 2) {
          score += 1.5;
          matchType = 'KEYWORD_MATCH';
        }
      }

      // Text semantic overlap
      const secText = `${sec.title} ${sec.chapter} ${sec.keywords.join(' ')}`;
      const secEmbedding = await this.embeddingEngine.getEmbedding(secText);
      const sim = this.embeddingEngine.cosineSimilarity(queryEmbedding.vector, secEmbedding.vector);
      score += sim * 2.0;

      if (score > 0.3) {
        scored.push({
          section: sec as any,
          score,
          matchType,
        });
      }
    }

    // Sort descending by relevance score
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }
}
