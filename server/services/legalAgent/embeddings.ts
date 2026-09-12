/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Local Embeddings Engine
 * 
 * Generates vector representations strictly locally:
 * 1. Checks local Ollama embedding endpoint (http://localhost:11434/api/embeddings)
 * 2. If Ollama is offline or unavailable, uses high-dimensional deterministic
 *    n-gram legal hashing vectorizer with cosine-similarity geometry.
 * ZERO data is sent to external embedding services.
 */

export interface EmbeddingVector {
  vector: number[];
  dimensions: number;
  provider: 'ollama_local' | 'local_deterministic_ngram';
}

export class LocalEmbeddingEngine {
  private static instance: LocalEmbeddingEngine;
  private readonly ollamaBaseUrl: string;
  private readonly embeddingModel: string;
  private isOllamaAvailable: boolean | null = null;

  private constructor() {
    this.ollamaBaseUrl = process.env.LLM_BASE_URL || 'http://localhost:11434';
    this.embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
  }

  public static getInstance(): LocalEmbeddingEngine {
    if (!LocalEmbeddingEngine.instance) {
      LocalEmbeddingEngine.instance = new LocalEmbeddingEngine();
    }
    return LocalEmbeddingEngine.instance;
  }

  /**
   * Generates a normalized embedding vector for text
   */
  public async getEmbedding(text: string): Promise<EmbeddingVector> {
    const cleanText = text.trim().toLowerCase();

    // 1. Try local Ollama if configured
    if (this.isOllamaAvailable !== false) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1200);

        const res = await fetch(`${this.ollamaBaseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.embeddingModel,
            prompt: cleanText,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.ok) {
          const data: any = await res.json();
          if (data.embedding && Array.isArray(data.embedding)) {
            this.isOllamaAvailable = true;
            return {
              vector: this.normalizeVector(data.embedding),
              dimensions: data.embedding.length,
              provider: 'ollama_local',
            };
          }
        }
      } catch {
        this.isOllamaAvailable = false;
      }
    }

    // 2. High-Dimensional Local Deterministic N-Gram Vectorizer (100% offline, zero network)
    const dimensions = 128;
    const vector = new Array(dimensions).fill(0);

    // Hash word unigrams and bigrams into geometric hypersphere
    const tokens = cleanText.split(/[\s,.;:()"'`\-]+/i).filter(t => t.length > 1);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const h1 = this.hashString(token) % dimensions;
      vector[Math.abs(h1)] += 1.0;

      if (i < tokens.length - 1) {
        const bigram = `${token}_${tokens[i + 1]}`;
        const h2 = this.hashString(bigram) % dimensions;
        vector[Math.abs(h2)] += 1.5;
      }
    }

    return {
      vector: this.normalizeVector(vector),
      dimensions,
      provider: 'local_deterministic_ngram',
    };
  }

  /**
   * Calculates cosine similarity between two normalized vectors
   */
  public cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(0, Math.min(1, dot));
  }

  private normalizeVector(v: number[]): number[] {
    let sumSq = 0;
    for (const x of v) sumSq += x * x;
    const mag = Math.sqrt(sumSq) || 1;
    return v.map(x => x / mag);
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
