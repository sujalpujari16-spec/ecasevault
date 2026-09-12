/**
 * e-CASEVAULT Vector Retriever
 * Phase 10: Vector semantic similarity search
 */

import { ProvisionService, LegalProvision } from '../legal/provisionService';
import { LocalEmbeddingEngine } from '../embeddings';

export interface VectorMatchResult {
  provision: LegalProvision;
  vectorScore: number;
}

export class VectorRetriever {
  private static instance: VectorRetriever;
  private provisionService: ProvisionService;
  private embeddingEngine: LocalEmbeddingEngine;

  private constructor() {
    this.provisionService = ProvisionService.getInstance();
    this.embeddingEngine = LocalEmbeddingEngine.getInstance();
  }

  public static getInstance(): VectorRetriever {
    if (!VectorRetriever.instance) {
      VectorRetriever.instance = new VectorRetriever();
    }
    return VectorRetriever.instance;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  public async searchVector(
    query: string,
    actFilter?: 'BNS' | 'BNSS' | 'BSA',
    limit: number = 20
  ): Promise<VectorMatchResult[]> {
    const queryEmb = await this.embeddingEngine.getEmbedding(query);
    const all = this.provisionService.getAllProvisions(actFilter);
    const scored: VectorMatchResult[] = [];

    // Calculate semantic similarity against provisions
    for (const p of all) {
      // Use pre-hashed embedding comparison from section title and text
      const provEmb = await this.embeddingEngine.getEmbedding(`${p.sectionTitle} ${p.cleanText.substring(0, 200)}`);
      const sim = this.cosineSimilarity(queryEmb.vector, provEmb.vector);
      if (sim > 0.3) {
        scored.push({
          provision: p,
          vectorScore: parseFloat(sim.toFixed(3)),
        });
      }
    }

    return scored.sort((a, b) => b.vectorScore - a.vectorScore).slice(0, limit);
  }
}
