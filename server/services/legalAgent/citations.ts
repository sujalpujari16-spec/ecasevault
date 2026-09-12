/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Citation Generator & Provenance Engine
 */

import { CitationItem } from './types';
import { LegalRagService } from '../legalRagService';

export class CitationEngine {
  /**
   * Builds traceable statutory citations from retrieved sections
   */
  public static buildStatutoryCitations(sections: any[]): CitationItem[] {
    const citations: CitationItem[] = [];

    for (const s of sections) {
      citations.push({
        id: `CITE-${s.act}-${s.sectionNumber}`,
        type: 'STATUTE',
        title: `${s.act} Section ${s.sectionNumber}: ${s.title}`,
        reference: `The Bharatiya Criminal Laws (Gazette Notification 2023) — ${s.act} Section ${s.sectionNumber}`,
        sectionNumber: s.sectionNumber,
        act: s.act,
        sha256Hash: s.sha256 || s.sha256Digest,
        sourceSnippet: s.text ? s.text.substring(0, 150) + '...' : undefined,
      });
    }

    return citations;
  }

  /**
   * Builds case docket citation if authorized case was consulted
   */
  public static buildCaseCitation(caseData: any): CitationItem {
    return {
      id: `CITE-CASE-${caseData.id}`,
      type: 'CASE_DOCKET',
      title: `Docket ${caseData.firNumber || caseData.id}: ${caseData.caseTitle}`,
      reference: `e-CASEVAULT Case Registry — Police Station: ${caseData.policeStation}`,
      sha256Hash: caseData.blockchainTxId || 'REGISTERED_DOCKET',
      sourceSnippet: `Status: ${caseData.status} | IO: ${caseData.assignedIo || 'Unassigned'}`,
    };
  }

  /**
   * Formats a clean footer of citations for Markdown presentation
   */
  public static formatCitationBlock(citations: CitationItem[]): string {
    if (!citations || citations.length === 0) return '';

    let block = `\n\n---\n### 📚 Grounded Legal & Docket Sources\n`;
    for (const c of citations) {
      if (c.type === 'STATUTE') {
        block += `- **${c.title}** (${c.reference})\n`;
        if (c.sha256Hash) {
          block += `  *Corpus Integrity Digest*: \`${c.sha256Hash.substring(0, 16)}...\`\n`;
        }
      } else if (c.type === 'CASE_DOCKET') {
        block += `- **${c.title}**\n  *Source*: ${c.reference}\n`;
      }
    }

    return block;
  }
}
