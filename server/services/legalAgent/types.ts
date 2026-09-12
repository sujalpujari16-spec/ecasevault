/**
 * e-CASEVAULT Private Legal Intelligence Agent
 * Core Data Structures, Agent Context, and Tool Definitions
 * 
 * Strict Principle: Confidential police and judicial data remains within the
 * local environment with zero external API transmission.
 */

import { CanonicalRole } from '../../middleware/auth';

export interface AgentUser {
  userId: string;
  badgeNo: string;
  role: CanonicalRole;
  station: string;
  station_id?: string;
  username: string;
  name?: string;
  full_name?: string;
}

export interface AgentContext {
  user: AgentUser;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  externalAiAllowed: false; // Invariant: Always false
}

export interface CitationItem {
  id: string;
  type: 'STATUTE' | 'CASE_DOCKET' | 'EVIDENCE' | 'FORENSIC_REPORT' | 'COURT_RECORD';
  title: string;
  reference: string;
  sectionNumber?: string;
  act?: string;
  sha256Hash?: string;
  sourceSnippet?: string;
}

export interface ToolExecutionResult {
  toolName: string;
  isAuthorized: boolean;
  status: 'SUCCESS' | 'DENIED' | 'NOT_FOUND' | 'ERROR';
  data?: any;
  error?: string;
  dataMinimizationApplied?: boolean;
}

export interface AgentChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface AgentQueryResponse {
  answer: string;
  intent: 'SECTION_LOOKUP' | 'AMBIGUOUS' | 'CASE_ANALYSIS' | 'EVIDENCE_INQUIRY' | 'PROCEDURAL_GUIDANCE' | 'GENERAL_LEGAL' | 'LEGAL_CONCEPT' | 'PROCEDURE' | 'STATUTORY_LOOKUP';
  citations: CitationItem[];
  toolsExecuted: string[];
  executionTimeMs: number;
  modelUsed: string;
  externalApiUsed: false;
  validationStatus: 'GROUNDED_VERIFIED' | 'CITATIONS_VALIDATED' | 'ACCESS_RESTRICTED' | 'ABSTAINED_AMBIGUOUS_QUERY' | 'ABSTAINED_NOT_FOUND';
  dataMinimizationReport?: {
    piiFieldsRedacted: number;
    rawPayloadsExcluded: boolean;
  };
}

export interface StatutorySection {
  id: string;
  act: 'BNS' | 'BNSS' | 'BSA' | 'MV_ACT' | 'IT_ACT' | 'POCSO' | 'NI_ACT';
  sectionNumber: string;
  title: string;
  chapter: string;
  text: string;
  sha256: string;
  keywords: string[];
  cognizable?: boolean;
  bailable?: boolean;
  punishment?: string;
  offenceType?: string;
  crossReference?: {
    legacyAct: string;
    legacySection: string;
    notes?: string;
  };
}
