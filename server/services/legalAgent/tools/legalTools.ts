/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Statutory Corpus & Criminal Law Knowledge Tools
 */

import { ToolExecutionResult } from '../types';
import { LegalRagService } from '../../legalRagService';

export async function executeSearchLegalKnowledge(
  query: string,
  actFilter?: 'BNS' | 'BNSS' | 'BSA' | 'ALL',
  limit: number = 5
): Promise<ToolExecutionResult> {
  const ragService = LegalRagService.getInstance();
  await ragService.initialize();

  const validatedFilter = actFilter === 'ALL' ? undefined : actFilter;
  const result = await ragService.query(query, validatedFilter, limit);

  const sections = result.retrievedSections.map(r => ({
    act: r.section.act,
    sectionNumber: r.section.sectionNumber,
    title: r.section.title,
    chapter: r.section.chapter,
    cognizable: r.section.cognizable,
    bailable: r.section.bailable,
    punishment: r.section.punishment,
    textExcerpt: r.section.text.substring(0, 300) + (r.section.text.length > 300 ? '...' : ''),
    relevanceScore: r.relevanceScore,
    matchReason: r.matchReason,
    sha256Digest: r.section.sha256,
  }));

  return {
    toolName: 'search_legal_knowledge',
    isAuthorized: true,
    status: 'SUCCESS',
    data: {
      query,
      intent: result.intent,
      totalRetrieved: sections.length,
      primaryApplicable: result.groundedAnalysis.recommendedProvisions,
      sections,
      proceduralRequirements: result.groundedAnalysis.investigationChecklist,
      evidentiaryStandards: result.groundedAnalysis.evidenceAdmissibilityChecklist,
    },
  };
}

export async function executeGetStatutorySection(
  act: string,
  sectionNumber: string
): Promise<ToolExecutionResult> {
  const ragService = LegalRagService.getInstance();
  await ragService.initialize();

  const normalizedAct = act.toUpperCase() as 'BNS' | 'BNSS' | 'BSA';
  const section = ragService.getSection(normalizedAct, sectionNumber);

  if (!section) {
    return {
      toolName: 'get_statutory_section',
      isAuthorized: true,
      status: 'NOT_FOUND',
      error: `Section ${sectionNumber} of ${act} not found in the verified Maharashtra Legal Corpus.`,
    };
  }

  return {
    toolName: 'get_statutory_section',
    isAuthorized: true,
    status: 'SUCCESS',
    data: {
      act: section.act,
      sectionNumber: section.sectionNumber,
      title: section.title,
      chapter: section.chapter,
      text: section.text,
      cognizable: section.cognizable,
      bailable: section.bailable,
      punishment: section.punishment,
      crossReference: section.crossReference,
      sha256: section.sha256,
    },
  };
}
