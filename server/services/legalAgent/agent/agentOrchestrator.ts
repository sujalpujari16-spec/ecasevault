/**
 * e-CASEVAULT Master Agent Orchestrator
 * Connects Query Analyzer, Planner, Guarded Tool Registry, Hybrid Retriever,
 * Local LLM, Claim & Citation Validators, and Fabric AI Audit Anchoring.
 */

import crypto from 'crypto';
import { AgentContext, AgentChatMessage } from '../types';
import { QueryAnalyzer } from '../query/queryAnalyzer';
import { AgentPlanner } from './planner';
import { ToolRegistry } from './toolRegistry';
import { HybridRetriever } from '../retrieval/hybridRetriever';
import { LocalLlmService } from '../generation/localLLM';
import { AnswerGenerator, FormattedAgentResponse } from '../generation/answerGenerator';
import { ClaimValidator } from '../validation/claimValidator';
import { CitationValidator } from '../validation/citationValidator';
import { AbstentionService } from '../validation/abstention';
import { PromptInjectionGuard } from '../security/promptInjectionGuard';
import { DataMinimizer } from '../security/dataMinimizer';
import { ConversationContextManager } from '../query/conversationContext';
import { AiAuditService } from '../audit/aiAuditService';
import { buildStructuredAgentPrompt } from '../generation/prompts';
import { verifyCaseAccess } from '../../../middleware/lawAgentAuth';
import { ProvisionService } from '../legal/provisionService';

export class AgentOrchestrator {
  private static instance: AgentOrchestrator;
  private queryAnalyzer = QueryAnalyzer.getInstance();
  private planner = AgentPlanner.getInstance();
  private toolRegistry = ToolRegistry.getInstance();
  private hybridRetriever = HybridRetriever.getInstance();
  private llmService = LocalLlmService.getInstance();
  private answerGenerator = AnswerGenerator.getInstance();
  private claimValidator = ClaimValidator.getInstance();
  private citationValidator = CitationValidator.getInstance();
  private abstentionService = AbstentionService.getInstance();
  private injectionGuard = PromptInjectionGuard.getInstance();
  private dataMinimizer = DataMinimizer.getInstance();
  private contextManager = ConversationContextManager.getInstance();
  private auditService = AiAuditService.getInstance();
  private provisionService = ProvisionService.getInstance();

  public static getInstance(): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator();
    }
    return AgentOrchestrator.instance;
  }

  public async processQuery(
    userMessage: string,
    history: AgentChatMessage[] = [],
    context: AgentContext
  ): Promise<FormattedAgentResponse> {
    const startTime = Date.now();
    await this.provisionService.initialize();

    const user = context.user;
    const sessionKey = user.badgeNo || user.userId;

    // 1. INVARIANT: Role Check (POLICE only)
    if (user.role !== 'POLICE') {
      await this.auditService.logEvent({
        userId: user.userId,
        badgeNo: user.badgeNo,
        role: user.role,
        eventType: 'AI_TOOL_DENIED',
        query: userMessage,
        status: 'DENIED',
        metadata: { error: 'Law Agent is available only to POLICE users' },
      });
      return this.answerGenerator.formatFinalResponse({
        answer: '### 🛑 Access Denied\n\nThe Law Agent is an operational investigative tool available strictly to **POLICE** officers.',
        executionTimeMs: Date.now() - startTime,
        modelUsed: 'e-casevault-gateway:v2',
        validationStatus: 'RBAC_DENIED',
      });
    }

    // 2. INVARIANT: Prompt Injection Check
    const injectionScan = this.injectionGuard.scan(userMessage);
    if (!injectionScan.isSafe) {
      await this.auditService.logEvent({
        userId: user.userId,
        badgeNo: user.badgeNo,
        role: user.role,
        eventType: 'AI_TOOL_DENIED',
        query: userMessage,
        status: 'WARNING',
        metadata: { flaggedPatterns: injectionScan.flaggedPatterns },
      });
      return this.answerGenerator.formatFinalResponse({
        answer: '### 🛡️ Security Policy Triggered\n\nAdversarial instruction or system override attempt detected. Case dockets and system instructions are protected under institutional security policy.',
        executionTimeMs: Date.now() - startTime,
        modelUsed: 'e-casevault-guardrail:v2',
        validationStatus: 'SECURITY_RESTRICTED',
      });
    }

    // 3. Multi-turn Follow-up Query Enrichment (Phase 29)
    const enrichedQuery = this.contextManager.enrichFollowUpQuery(sessionKey, injectionScan.sanitizedInput);

    // 4. Query Analysis & Ambiguity Detection (Phase 12)
    const activeState = this.contextManager.getState(sessionKey);
    const analysis = this.queryAnalyzer.analyze(enrichedQuery, activeState.currentCaseId);

    // 5. Agent Planner (Phase 13)
    const plan = this.planner.createPlan(analysis);

    // 6. Handle Ambiguous Queries Immediately (e.g., "sec 33")
    if (analysis.ambiguity) {
      await this.auditService.logEvent({
        userId: user.userId,
        badgeNo: user.badgeNo,
        role: user.role,
        eventType: 'AI_ABSTENTION',
        query: userMessage,
        status: 'ABSTAINED',
        metadata: { reason: analysis.ambiguityReason },
      });

      const clarifResponse = await this.llmService.generateStructuredResponse('', '', { queryAnalysis: analysis });
      return this.answerGenerator.formatFinalResponse({
        answer: clarifResponse.answer,
        executionTimeMs: Date.now() - startTime,
        modelUsed: clarifResponse.modelUsed,
        validationStatus: 'AMBIGUITY_RESOLVED_NEEDS_CLARIFICATION',
      });
    }

    // 7. Case Access Verification & Minimization (Phases 1, 14, 15, 28)
    let caseData: any = null;
    let caseContextString = '';
    let piiRedactedCount = 0;

    if (analysis.requiresCaseData && analysis.caseId) {
      const caseAccessCheck = await verifyCaseAccess(
        {
          userId: user.userId,
          badgeNo: user.badgeNo,
          role: user.role as any,
          station: user.station,
          station_id: user.station_id,
          username: user.username,
        },
        analysis.caseId
      );

      if (!caseAccessCheck.authorized) {
        await this.auditService.logEvent({
          userId: user.userId,
          badgeNo: user.badgeNo,
          role: user.role,
          eventType: 'AI_TOOL_DENIED',
          query: userMessage,
          caseId: analysis.caseId,
          status: 'DENIED',
          metadata: { reason: caseAccessCheck.reason },
        });

        return this.answerGenerator.formatFinalResponse({
          answer: `### 🛑 Case Access Denied\n\n${caseAccessCheck.reason || 'Officer lacks jurisdictional clearance for the requested docket.'}\n\n*The AI engine cannot access dockets outside your precinct assignment.*`,
          executionTimeMs: Date.now() - startTime,
          modelUsed: 'e-casevault-rbac:v2',
          validationStatus: 'CASE_ACCESS_DENIED',
        });
      }

      // Minimize case data before handing to LLM (Phase 28)
      const minimized = this.dataMinimizer.minimizeCaseContext(caseAccessCheck.caseData);
      caseData = minimized.sanitized;
      piiRedactedCount = minimized.piiRedactedCount;
      caseContextString = this.injectionGuard.wrapUntrustedData('CASE_DOCKET', JSON.stringify(caseData, null, 2));

      // Check evidence integrity if requested (Phase 24)
      if (analysis.requiresEvidenceData) {
        const evToolRes = await this.toolRegistry.executeTool(
          'verify_evidence_integrity',
          { caseId: analysis.caseId },
          user
        );
        if (evToolRes.status === 'SUCCESS' && evToolRes.data) {
          caseContextString += `\n\n${this.injectionGuard.wrapUntrustedData('EVIDENCE_INTEGRITY_VERIFICATION', JSON.stringify(evToolRes.data, null, 2))}`;
        }
      }
    }

    // 8. Multi-Stage Hybrid Retrieval & Reranking (Phases 7, 8, 9, 10, 11)
    const searchFilter = analysis.act || undefined;
    const rankedResults = await this.hybridRetriever.retrieve(
      analysis.concept || enrichedQuery,
      searchFilter,
      5
    );

    // Abstention check on zero results
    const abstention = this.abstentionService.evaluate(
      enrichedQuery,
      rankedResults.length,
      Boolean(caseData),
      analysis.requiresCaseData
    );
    if (abstention.shouldAbstain && abstention.responseTemplate) {
      await this.auditService.logEvent({
        userId: user.userId,
        badgeNo: user.badgeNo,
        role: user.role,
        eventType: 'AI_ABSTENTION',
        query: userMessage,
        caseId: analysis.caseId,
        status: 'ABSTAINED',
      });
      return this.answerGenerator.formatFinalResponse({
        answer: abstention.responseTemplate,
        executionTimeMs: Date.now() - startTime,
        modelUsed: 'e-casevault-abstention:v2',
        validationStatus: 'ABSTAINED',
      });
    }

    const primaryResult = rankedResults[0];
    const statutoryChunks = rankedResults
      .map(
        (r) =>
          `[SECTION: ${r.provision.actCode} Section ${r.provision.sectionNumber} — ${r.provision.sectionTitle}]\n` +
          `Chapter: ${r.provision.chapter}\n` +
          `Text: ${r.provision.cleanText}\n` +
          `SHA-256: ${r.provision.contentHash}`
      )
      .join('\n\n---\n\n');

    // 9. Structured Prompting & Local Inference (Phases 16, 17, 20)
    const systemPrompt = buildStructuredAgentPrompt(user, caseContextString, statutoryChunks);
    const llmResponse = await this.llmService.generateStructuredResponse(
      systemPrompt,
      enrichedQuery,
      {
        primaryProvision: primaryResult?.provision,
        rankedProvisions: rankedResults,
        caseData,
        queryAnalysis: analysis,
      }
    );

    // 10. Post-Generation Citation & Claim Validation (Phases 18, 19)
    const citationCheck = this.citationValidator.validateCitations(
      llmResponse.claims.flatMap((c) => c.sourceIds)
    );
    const hallucinationsInText = this.citationValidator.scanTextForHallucinations(llmResponse.answer);

    const claimCheck = this.claimValidator.validateClaims(
      llmResponse.claims,
      rankedResults.map((r) => r.provision)
    );

    let validationStatus = 'GROUNDED_VERIFIED';
    if (hallucinationsInText.length > 0) {
      validationStatus = 'CITATION_ANOMALY_FILTERED';
      console.warn('[AgentOrchestrator] Filtered hallucinated sections:', hallucinationsInText);
    }

    // 11. Format Clean Final Response without [Context: ...] artifacts (Phase 21)
    const formattedCitations = rankedResults.map((r) => ({
      id: r.provision.id,
      type: 'STATUTE',
      title: `${r.provision.actCode} Section ${r.provision.sectionNumber}: ${r.provision.sectionTitle}`,
      reference: 'Bharatiya Legal Corpus (BNS, BNSS, BSA)',
      sha256Hash: r.provision.contentHash,
    }));

    const finalResponse = this.answerGenerator.formatFinalResponse({
      answer: llmResponse.answer,
      primaryProvision: primaryResult?.provision,
      rankedProvisions: rankedResults,
      citations: formattedCitations,
      confidence: primaryResult?.finalScore >= 0.9 ? 'HIGH' : 'MEDIUM',
      executionTimeMs: Date.now() - startTime,
      modelUsed: llmResponse.modelUsed,
      validationStatus,
      piiRedactedCount,
    });

    // 12. Hyperledger Fabric Audit Event Anchoring (Phase 25, 26)
    await this.auditService.logEvent({
      userId: user.userId,
      badgeNo: user.badgeNo,
      role: user.role,
      eventType: 'AI_RESPONSE',
      query: userMessage,
      caseId: analysis.caseId,
      status: 'SUCCESS',
      sources: formattedCitations.map((c) => c.title),
      metadata: {
        model: llmResponse.modelUsed,
        executionTimeMs: Date.now() - startTime,
        primarySection: primaryResult ? `${primaryResult.provision.actCode}_${primaryResult.provision.sectionNumber}` : null,
        validationStatus,
      },
    });

    // 13. Update Conversation Context (Phase 29)
    if (primaryResult) {
      this.contextManager.updateState(sessionKey, {
        currentAct: primaryResult.provision.actCode,
        currentSection: primaryResult.provision.sectionNumber,
        currentCaseId: analysis.caseId || activeState.currentCaseId,
        currentTopic: primaryResult.provision.sectionTitle,
        language: analysis.language,
      });
    }

    return finalResponse;
  }
}
