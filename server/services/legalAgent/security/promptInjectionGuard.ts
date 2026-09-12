/**
 * e-CASEVAULT Prompt Injection Guard
 * Phase 27: Strict separation of Untrusted Data vs Trusted Instructions
 * Treats FIR documents, witness statements, and evidence excerpts as UNTRUSTED DATA.
 */

export interface InjectionCheckResult {
  isSafe: boolean;
  sanitizedInput: string;
  flaggedPatterns: string[];
}

const MALICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?(?:previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+(?:in\s+developer\s+mode|unrestricted|DAN)/i,
  /reveal\s+(?:all\s+)?(?:evidence|passwords|credentials|keys|prompts)/i,
  /bypass\s+(?:security|rbac|authorization|policy)/i,
  /system\s*override/i,
  /disregard\s+(?:institutional|safety|legal)\s+rules/i,
  /dump\s+(?:database|tables|users|schema)/i,
];

export class PromptInjectionGuard {
  private static instance: PromptInjectionGuard;

  public static getInstance(): PromptInjectionGuard {
    if (!PromptInjectionGuard.instance) {
      PromptInjectionGuard.instance = new PromptInjectionGuard();
    }
    return PromptInjectionGuard.instance;
  }

  /**
   * Scans user queries or ingested document chunks for adversarial injection attempts
   */
  public scan(input: string): InjectionCheckResult {
    const flaggedPatterns: string[] = [];
    let isSafe = true;

    for (const pattern of MALICIOUS_PATTERNS) {
      if (pattern.test(input)) {
        flaggedPatterns.push(pattern.source);
        isSafe = false;
      }
    }

    // Neutralize any attempted delimiter escapes
    const sanitized = input
      .replace(/```system/gi, '```text')
      .replace(/\[SYSTEM_INSTRUCTION\]/gi, '[DATA_CONTENT]')
      .replace(/<system>/gi, '<data>');

    return {
      isSafe,
      sanitizedInput: sanitized,
      flaggedPatterns,
    };
  }

  /**
   * Enforces that case documents are wrapped in strictly demarcated UNTRUSTED_DATA delimiters
   */
  public wrapUntrustedData(label: string, data: string): string {
    const scan = this.scan(data);
    return `\n<UNTRUSTED_INVESTIGATIVE_DATA label="${label}">\n${scan.sanitizedInput}\n</UNTRUSTED_INVESTIGATIVE_DATA>\n`;
  }
}
