/**
 * e-CASEVAULT Exact Section Retriever
 * Phase 7: Deterministic statutory section lookup
 */

import { ProvisionService, LegalProvision } from '../legal/provisionService';

export interface ExactSectionMatch {
  act: 'BNS' | 'BNSS' | 'BSA';
  section: string;
  provision: LegalProvision;
}

export class ExactRetriever {
  private static instance: ExactRetriever;
  private provisionService: ProvisionService;

  private constructor() {
    this.provisionService = ProvisionService.getInstance();
  }

  public static getInstance(): ExactRetriever {
    if (!ExactRetriever.instance) {
      ExactRetriever.instance = new ExactRetriever();
    }
    return ExactRetriever.instance;
  }

  /**
   * Attempts to parse an exact section query (e.g., "BNS 109", "Section 109 BNS", "BNSS sec 173")
   */
  public parseExactQuery(query: string): { act: 'BNS' | 'BNSS' | 'BSA' | null; section: string | null } {
    const clean = query.trim();

    // Pattern: [Act] [Section] or [Section] [Act]
    const p1 = clean.match(/\b(bns|bnss|bsa)\b[\s,:\.-]*(?:section|sec|kalm|कलम)?\.?\s*(\d+[A-Z]?)\b/i);
    if (p1 && p1[2] !== '2023' && p1[2] !== '2024') {
      return { act: p1[1].toUpperCase() as any, section: p1[2].toUpperCase() };
    }

    const p2 = clean.match(/(?:section|sec|kalm|कलम)\.?\s*(\d+[A-Z]?)\b[\s,:\.-]*\b(bns|bnss|bsa)\b/i);
    if (p2 && p2[1] !== '2023' && p2[1] !== '2024') {
      return { act: p2[2].toUpperCase() as any, section: p2[1].toUpperCase() };
    }

    // Bare section number without Act: e.g. "sec 33", "section 109"
    const p3 = clean.match(/^(?:section|sec|kalm|कलम)?\.?\s*(\d+[A-Z]?)$/i);
    if (p3 && p3[1] !== '2023' && p3[1] !== '2024') {
      return { act: null, section: p3[1].toUpperCase() };
    }

    return { act: null, section: null };
  }

  /**
   * Retrieves exact provision if Act and Section are both specified
   */
  public getExact(act: string, section: string): ExactSectionMatch | null {
    const actCode = act.toUpperCase() as 'BNS' | 'BNSS' | 'BSA';
    const provision = this.provisionService.getExactSection(actCode, section);
    if (!provision) return null;
    return {
      act: actCode,
      section,
      provision,
    };
  }
}
