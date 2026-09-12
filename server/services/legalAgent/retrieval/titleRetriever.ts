/**
 * e-CASEVAULT Exact & Fuzzy Title Retriever
 * Phase 8: Section Title Matching
 * E.g., "attempt to murder sec" -> Section Title "Attempt to murder" -> BNS 109 = 1.00
 */

import { ProvisionService, LegalProvision } from '../legal/provisionService';

export interface TitleMatchResult {
  provision: LegalProvision;
  titleScore: number;
  matchType: 'EXACT_TITLE' | 'PARTIAL_TITLE';
}

export class TitleRetriever {
  private static instance: TitleRetriever;
  private provisionService: ProvisionService;

  private constructor() {
    this.provisionService = ProvisionService.getInstance();
  }

  public static getInstance(): TitleRetriever {
    if (!TitleRetriever.instance) {
      TitleRetriever.instance = new TitleRetriever();
    }
    return TitleRetriever.instance;
  }

  /**
   * Cleans query of meta-tokens like 'sec', 'section', 'what is', 'act'
   */
  public cleanConceptQuery(query: string): string {
    return query
      .toLowerCase()
      .replace(/\b(section|sec|kalm|कलम|act|law|in|under|the|of|what|is|for|give|me)\b/gi, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Matches query concept against statutory section titles
   */
  public matchTitle(
    query: string,
    actFilter?: 'BNS' | 'BNSS' | 'BSA'
  ): TitleMatchResult[] {
    const concept = this.cleanConceptQuery(query);
    if (!concept || concept.length < 3) return [];

    const all = this.provisionService.getAllProvisions(actFilter);
    const results: TitleMatchResult[] = [];

    for (const p of all) {
      const titleLower = p.sectionTitle.toLowerCase().trim();

      // 1. Exact Title Match (Score 1.00)
      if (titleLower === concept) {
        results.push({
          provision: p,
          titleScore: 1.0,
          matchType: 'EXACT_TITLE',
        });
        continue;
      }

      // 2. Normalized Title Equality (ignoring punctuation / trailing 's')
      const normalizedTitle = titleLower.replace(/[^a-z0-9\s]/g, '').trim();
      const normalizedConcept = concept.replace(/[^a-z0-9\s]/g, '').trim();
      if (normalizedTitle === normalizedConcept) {
        results.push({
          provision: p,
          titleScore: 0.98,
          matchType: 'EXACT_TITLE',
        });
        continue;
      }

      // 3. Strong prefix or containment with word boundaries
      // Note: "attempt to murder" must match "Attempt to murder" (1.0), NOT "Murder" (0.5)
      const words = normalizedConcept.split(' ').filter((w) => w.length > 2);
      if (words.length >= 2) {
        const titleRegex = new RegExp(`\\b${normalizedConcept}\\b`, 'i');
        if (titleRegex.test(normalizedTitle)) {
          // If the concept is contained inside title (e.g. concept "culpable homicide" in "Attempt to commit culpable homicide")
          results.push({
            provision: p,
            titleScore: 0.85,
            matchType: 'PARTIAL_TITLE',
          });
        }
      }
    }

    return results.sort((a, b) => b.titleScore - a.titleScore);
  }
}
