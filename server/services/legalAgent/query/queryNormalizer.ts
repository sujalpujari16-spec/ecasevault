/**
 * e-CASEVAULT Query Normalizer
 * Handles whitespace, Marathi/Devanagari transliteration, and criminal term mapping.
 */

export class QueryNormalizer {
  private static instance: QueryNormalizer;

  public static getInstance(): QueryNormalizer {
    if (!QueryNormalizer.instance) {
      QueryNormalizer.instance = new QueryNormalizer();
    }
    return QueryNormalizer.instance;
  }

  public normalize(query: string): { normalized: string; language: 'en' | 'mr' } {
    let text = query.trim();
    let language: 'en' | 'mr' = 'en';

    // Detect Devanagari script (Marathi / Hindi)
    if (/[\u0900-\u097F]/.test(text)) {
      language = 'mr';
      text = text
        .replace(/कलम/g, 'section')
        .replace(/कायदा/g, 'act')
        .replace(/खून/g, 'murder')
        .replace(/चोरी/g, 'theft')
        .replace(/फसवणूक/g, 'cheating')
        .replace(/पुरावा/g, 'evidence')
        .replace(/गुन्हा/g, 'crime')
        .replace(/जामीन/g, 'bail');
    }

    // Transliterated Marathi tokens
    text = text
      .replace(/\bkalm\b/gi, 'section')
      .replace(/\bchori\b/gi, 'theft')
      .replace(/\bkhun\b/gi, 'murder')
      .replace(/\bfir\s*dakhil\b/gi, 'fir registration')
      .replace(/\bjameen\b/gi, 'bail');

    return {
      normalized: text.replace(/\s+/g, ' ').trim(),
      language,
    };
  }
}
