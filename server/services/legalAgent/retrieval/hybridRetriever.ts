/**
 * e-CASEVAULT Hybrid Legal Retriever
 * Phase 11: Exact + Title + Keyword + Vector + Reranking Pipeline
 */

import { ProvisionService, LegalProvision } from '../legal/provisionService';
import { ExactRetriever } from './exactRetriever';
import { TitleRetriever } from './titleRetriever';
import { KeywordRetriever } from './keywordRetriever';
import { VectorRetriever } from './vectorRetriever';
import { Reranker, RetrievalResult } from './reranker';

export class HybridRetriever {
  private static instance: HybridRetriever;
  private provisionService: ProvisionService;
  private exactRetriever: ExactRetriever;
  private titleRetriever: TitleRetriever;
  private keywordRetriever: KeywordRetriever;
  private vectorRetriever: VectorRetriever;
  private reranker: Reranker;

  private constructor() {
    this.provisionService = ProvisionService.getInstance();
    this.exactRetriever = ExactRetriever.getInstance();
    this.titleRetriever = TitleRetriever.getInstance();
    this.keywordRetriever = KeywordRetriever.getInstance();
    this.vectorRetriever = VectorRetriever.getInstance();
    this.reranker = Reranker.getInstance();
  }

  public static getInstance(): HybridRetriever {
    if (!HybridRetriever.instance) {
      HybridRetriever.instance = new HybridRetriever();
    }
    return HybridRetriever.instance;
  }

  public async retrieve(
    query: string,
    actFilter?: 'BNS' | 'BNSS' | 'BSA',
    limit: number = 5
  ): Promise<RetrievalResult[]> {
    await this.provisionService.initialize();

    const cleanQuery = query.trim();

    // 1. Check for Exact Section Lookup (Phase 7)
    const exactParsed = this.exactRetriever.parseExactQuery(cleanQuery);
    if (exactParsed.section && (exactParsed.act || actFilter)) {
      const act = (exactParsed.act || actFilter)!;
      const exactMatch = this.exactRetriever.getExact(act, exactParsed.section);
      if (exactMatch) {
        const top = this.reranker.rerank(exactMatch.provision, 1.0, 1.0, 1.0, true);
        return [top];
      }
    }

    // 2. Title Matching (Phase 8)
    const titleMatches = this.titleRetriever.matchTitle(cleanQuery, actFilter);
    const titleScoreMap = new Map<string, number>();
    for (const tm of titleMatches) {
      titleScoreMap.set(tm.provision.id, tm.titleScore);
    }

    // 3. Keyword Search (Phase 9)
    const keywordMatches = this.keywordRetriever.searchKeywords(cleanQuery, actFilter, 25);
    const keywordScoreMap = new Map<string, number>();
    for (const km of keywordMatches) {
      keywordScoreMap.set(km.provision.id, km.keywordScore);
    }

    // 4. Vector Similarity (Phase 10)
    const vectorMatches = await this.vectorRetriever.searchVector(cleanQuery, actFilter, 25);
    const vectorScoreMap = new Map<string, number>();
    for (const vm of vectorMatches) {
      vectorScoreMap.set(vm.provision.id, vm.vectorScore);
    }

    // 5. Aggregate candidate provisions
    const candidateMap = new Map<string, LegalProvision>();
    for (const tm of titleMatches) candidateMap.set(tm.provision.id, tm.provision);
    for (const km of keywordMatches) candidateMap.set(km.provision.id, km.provision);
    for (const vm of vectorMatches) candidateMap.set(vm.provision.id, vm.provision);

    // 6. Rerank candidates with composite scoring (Phase 11)
    const results: RetrievalResult[] = [];
    for (const [id, provision] of candidateMap.entries()) {
      const exactTitleScore = titleScoreMap.get(id) || 0.0;
      const keywordScore = keywordScoreMap.get(id) || 0.0;
      const vectorScore = vectorScoreMap.get(id) || 0.0;

      const ranked = this.reranker.rerank(
        provision,
        exactTitleScore,
        keywordScore,
        vectorScore,
        false
      );
      results.push(ranked);
    }

    // Sort by finalScore descending
    results.sort((a, b) => b.finalScore - a.finalScore);

    return results.slice(0, limit);
  }
}
