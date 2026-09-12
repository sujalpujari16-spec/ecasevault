/**
 * e-CASEVAULT Agent Planner
 * Phase 13: Dynamic Agentic Planning Engine
 */

import { QueryAnalysis } from '../query/queryAnalyzer';

export interface PlanStep {
  stepId: string;
  name: string;
  toolRequired?: string;
  description: string;
}

export interface ExecutionPlan {
  intent: string;
  steps: PlanStep[];
}

export class AgentPlanner {
  private static instance: AgentPlanner;

  public static getInstance(): AgentPlanner {
    if (!AgentPlanner.instance) {
      AgentPlanner.instance = new AgentPlanner();
    }
    return AgentPlanner.instance;
  }

  public createPlan(analysis: QueryAnalysis): ExecutionPlan {
    switch (analysis.intent) {
      case 'AMBIGUOUS':
        return {
          intent: 'AMBIGUOUS',
          steps: [
            {
              stepId: 'clarify',
              name: 'generateClarificationRequest',
              description: 'Request user clarification between BNS, BNSS, and BSA statutes.',
            },
          ],
        };

      case 'SECTION_LOOKUP':
        return {
          intent: 'SECTION_LOOKUP',
          steps: [
            { stepId: '1', name: 'resolveAct', description: 'Validate target Act and Section' },
            { stepId: '2', name: 'exactSectionSearch', toolRequired: 'getExactSection', description: 'Deterministic section retrieval' },
            { stepId: '3', name: 'verifySource', description: 'Verify SHA-256 provenance hash' },
            { stepId: '4', name: 'generateExplanation', description: 'Format clear legal explanation' },
            { stepId: '5', name: 'validateAnswer', description: 'Validate claims and citations' },
          ],
        };

      case 'CASE_ANALYSIS':
        return {
          intent: 'CASE_ANALYSIS',
          steps: [
            { stepId: '1', name: 'verifyCaseAccess', description: 'Check officer jurisdictional clearance' },
            { stepId: '2', name: 'getCaseFacts', toolRequired: 'getCaseDetails', description: 'Retrieve minimized case facts' },
            { stepId: '3', name: 'getRelevantEvidence', toolRequired: 'getEvidenceMetadata', description: 'Retrieve evidence items' },
            { stepId: '4', name: 'searchLegalProvisions', toolRequired: 'hybridLegalSearch', description: 'Find relevant statutory sections' },
            { stepId: '5', name: 'compareFactsWithLaw', description: 'Match case narrative with criminal provisions' },
            { stepId: '6', name: 'generateAnalysis', description: 'Generate investigative advisory' },
            { stepId: '7', name: 'validateAnswer', description: 'Run claim and citation validator' },
          ],
        };

      case 'FACT_TO_LAW':
        return {
          intent: 'FACT_TO_LAW',
          steps: [
            { stepId: '1', name: 'verifyCaseAccess', description: 'Check case permission' },
            { stepId: '2', name: 'extractFacts', toolRequired: 'getCaseDetails', description: 'Extract atomic facts from FIR' },
            { stepId: '3', name: 'searchLegalProvisions', toolRequired: 'hybridLegalSearch', description: 'Query statutory database' },
            { stepId: '4', name: 'compareElements', description: 'Compare statutory elements against facts' },
            { stepId: '5', name: 'missingEvidenceCheck', description: 'Identify evidentiary gaps' },
            { stepId: '6', name: 'generateAdvisory', description: 'Produce advisory analysis' },
            { stepId: '7', name: 'validateAnswer', description: 'Validate citations and claims' },
          ],
        };

      case 'EVIDENCE_INTEGRITY':
        return {
          intent: 'EVIDENCE_INTEGRITY',
          steps: [
            { stepId: '1', name: 'verifyCaseAccess', description: 'Verify case permission' },
            { stepId: '2', name: 'getEvidenceMetadata', toolRequired: 'getEvidenceMetadata', description: 'Fetch evidence record' },
            { stepId: '3', name: 'verifyCurrentHash', toolRequired: 'verifyEvidenceHash', description: 'Compute current SHA-256' },
            { stepId: '4', name: 'checkFabricRecord', toolRequired: 'verifyFabricRecord', description: 'Compare with Hyperledger Fabric ledger' },
            { stepId: '5', name: 'generateIntegrityReport', description: 'Produce verification summary' },
          ],
        };

      case 'PROCEDURE':
      case 'LEGAL_CONCEPT':
      default:
        return {
          intent: 'LEGAL_CONCEPT',
          steps: [
            { stepId: '1', name: 'hybridLegalSearch', toolRequired: 'hybridLegalSearch', description: 'Hybrid exact, keyword, and vector search' },
            { stepId: '2', name: 'rerankProvisions', description: 'Rerank candidates using composite scorer' },
            { stepId: '3', name: 'generateExplanation', description: 'Generate structured advisory' },
            { stepId: '4', name: 'validateClaims', description: 'Run claim validator' },
            { stepId: '5', name: 'validateCitations', description: 'Run citation validator' },
          ],
        };
    }
  }
}
