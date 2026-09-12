/**
 * e-CASEVAULT Tool Registry
 * Phase 14 & Phase 15: Centralized, RBAC-Guarded Tool Execution Engine
 * Invariant: Never give the LLM direct database or execution access.
 */

import { AgentUser, ToolExecutionResult } from '../types';
import { executeGetCaseDetails } from '../tools/caseTools';
import { executeGetCaseEvidence, executeVerifyEvidenceIntegrity } from '../tools/evidenceTools';
import { executeGetForensicReports } from '../tools/forensicTools';
import { executeGetStatutorySection, executeSearchLegalKnowledge } from '../tools/legalTools';
import { executeGetDocumentExcerpt } from '../tools/documentTools';
import { HybridRetriever } from '../retrieval/hybridRetriever';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private hybridRetriever = HybridRetriever.getInstance();

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    user: AgentUser
  ): Promise<ToolExecutionResult> {
    switch (toolName) {
      case 'get_exact_section':
      case 'get_statutory_section': {
        const { act, section } = args;
        return executeGetStatutorySection(act, section);
      }

      case 'search_legal_provisions':
      case 'search_legal_knowledge': {
        const { query, actFilter, limit } = args;
        return executeSearchLegalKnowledge(query, actFilter, limit);
      }

      case 'hybrid_legal_search': {
        const { query, actFilter, limit } = args;
        const results = await this.hybridRetriever.retrieve(query, actFilter, limit || 5);
        return {
          toolName: 'hybrid_legal_search',
          isAuthorized: true,
          status: 'SUCCESS',
          data: results,
        };
      }

      case 'get_case_details':
      case 'get_case_facts': {
        const { caseId } = args;
        return executeGetCaseDetails(caseId, user);
      }

      case 'get_case_evidence': {
        const { caseId } = args;
        return executeGetCaseEvidence(caseId, user);
      }

      case 'verify_evidence_integrity':
      case 'verify_evidence_hash': {
        const { caseId, evidenceId } = args;
        return executeVerifyEvidenceIntegrity(caseId, evidenceId || '', user);
      }

      case 'get_forensic_reports': {
        const { caseId } = args;
        return executeGetForensicReports(caseId, user);
      }

      case 'get_document_excerpt': {
        const { caseId, documentId, maxChars } = args;
        return executeGetDocumentExcerpt(caseId, documentId, user, maxChars);
      }

      default:
        return {
          toolName,
          isAuthorized: false,
          status: 'DENIED',
          error: `Unrecognized or prohibited tool: ${toolName}`,
        };
    }
  }
}
