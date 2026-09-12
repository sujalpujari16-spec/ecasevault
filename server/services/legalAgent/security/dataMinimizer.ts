/**
 * e-CASEVAULT Data Minimization Service
 * Phase 28: Minimizes context sent to the model to reduce leakage
 */

export interface MinimizationResult {
  sanitized: any;
  piiRedactedCount: number;
}

export class DataMinimizer {
  private static instance: DataMinimizer;

  public static getInstance(): DataMinimizer {
    if (!DataMinimizer.instance) {
      DataMinimizer.instance = new DataMinimizer();
    }
    return DataMinimizer.instance;
  }

  public redactString(text: string): { sanitized: string; count: number } {
    let count = 0;
    let out = text;

    // Phone numbers
    out = out.replace(/(?:\+91[\-\s]?)?[6789]\d{9}/g, () => {
      count++;
      return '[PHONE REDACTED]';
    });

    // Aadhaar numbers
    out = out.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, () => {
      count++;
      return '[AADHAAR REDACTED]';
    });

    // Bank Account Numbers
    out = out.replace(/\b\d{9,18}\b/g, (match) => {
      if (match.length >= 11) {
        count++;
        return '[ACCOUNT NO REDACTED]';
      }
      return match;
    });

    return { sanitized: out, count };
  }

  public minimizeCaseContext(caseRecord: any): MinimizationResult {
    if (!caseRecord) return { sanitized: null, piiRedactedCount: 0 };

    const str = JSON.stringify(caseRecord);
    const { sanitized, count } = this.redactString(str);
    const obj = JSON.parse(sanitized);

    // Strip unneeded fields: exclude binary hashes, full logs, raw file links
    delete obj.raw_file_buffer;
    delete obj.base64_payload;
    delete obj.server_secrets;

    return {
      sanitized: obj,
      piiRedactedCount: count,
    };
  }
}
