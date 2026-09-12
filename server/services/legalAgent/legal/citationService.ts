/**
 * e-CASEVAULT Citation Service
 * Standardizes statutory citations and provenance metadata.
 */

export interface FormattedCitation {
  id: string;
  act: string;
  sectionNumber: string;
  title: string;
  chapter?: string;
  sourceLabel: string;
  contentHash: string;
}

export class CitationService {
  private static instance: CitationService;

  public static getInstance(): CitationService {
    if (!CitationService.instance) {
      CitationService.instance = new CitationService();
    }
    return CitationService.instance;
  }

  public formatCitation(
    act: string,
    sectionNumber: string,
    title: string,
    contentHash: string,
    chapter?: string
  ): FormattedCitation {
    const cleanAct = act.toUpperCase();
    const cleanSec = sectionNumber.trim();
    return {
      id: `CITE-${cleanAct}-${cleanSec}`,
      act: cleanAct,
      sectionNumber: cleanSec,
      title,
      chapter,
      sourceLabel: `${cleanAct} Section ${cleanSec} — ${title}`,
      contentHash,
    };
  }

  public formatCitationBlock(citations: FormattedCitation[]): string {
    if (!citations || citations.length === 0) return '';
    const items = citations
      .map(
        (c) =>
          `• **${c.act} Section ${c.sectionNumber}** — ${c.title} \`[SHA-256: ${c.contentHash.substring(0, 16)}...]\``
      )
      .join('\n');
    return `\n\n---\n### 📚 Authoritative Statutory Citations\n${items}`;
  }
}
