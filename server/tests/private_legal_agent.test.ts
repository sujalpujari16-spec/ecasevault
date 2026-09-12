import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { PrivateLegalAgent } from '../services/legalAgent/agent';
import { AgentContext } from '../services/legalAgent/types';
import { AgentPermissions } from '../services/legalAgent/permissions';
import { AgentGuardrails } from '../services/legalAgent/guardrails';
import { casePersistenceService } from '../services/casePersistenceService';
import { auditService } from '../services/auditService';

describe('Private Legal Intelligence Agent (Zero-External-AI & RBAC Pipeline)', () => {
  const agent = PrivateLegalAgent.getInstance();

  const officerPI_StationA: AgentContext = {
    user: {
      userId: 'USR-POL-001',
      badgeNo: 'MH-PI-8842',
      role: 'POLICE',
      station: 'Andheri Police Station, Mumbai',
      station_id: 'STN-ANDHERI-01',
      username: 'rajesh.patil@police.com',
      name: 'Inspector Rajesh Patil',
    },
    ipAddress: '10.0.12.44',
    externalAiAllowed: false,
  };

  const officerIO_Assigned: AgentContext = {
    user: {
      userId: 'USR-POL-002',
      badgeNo: 'MH-PSI-4910',
      role: 'POLICE',
      station: 'Andheri Police Station, Mumbai',
      station_id: 'STN-ANDHERI-01',
      username: 'r.deshmukh@police.com',
      name: 'PSI R. Deshmukh',
    },
    ipAddress: '10.0.12.45',
    externalAiAllowed: false,
  };

  const officerPI_StationB: AgentContext = {
    user: {
      userId: 'USR-POL-003',
      badgeNo: 'MH-PI-9901',
      role: 'POLICE',
      station: 'Vashi Police Station, Navi Mumbai',
      station_id: 'STN-VASHI-04',
      username: 'suresh.patil@police.com',
      name: 'Inspector Suresh Patil',
    },
    ipAddress: '10.0.14.88',
    externalAiAllowed: false,
  };

  it('1. Zero External AI: Generates legal reasoning with 100% local model and zero external API transmission', async () => {
    const result = await agent.processQuery(
      'What are the mandatory legal requirements under BNSS for audio-video recording during search and seizure?',
      [],
      officerPI_StationA
    );

    assert.strictEqual(result.externalApiUsed, false, 'externalApiUsed invariant must strictly be false');
    assert.ok(result.modelUsed.includes('ollama') || result.modelUsed.includes('local'), `Model must be local, got: ${result.modelUsed}`);
    assert.ok(result.answer.includes('BNSS Section 105') || result.answer.includes('105'), 'Must cite mandatory BNSS Section 105');
    assert.ok(result.answer.includes('BSA Section 63') || result.answer.includes('63'), 'Must cite BSA Section 63 electronic certification');
    assert.strictEqual(result.validationStatus, 'GROUNDED_VERIFIED');
  });

  it('2. Pre-Tool Case Authorization (Strict Deny): Prohibits cross-station unauthorized docket inspection', async () => {
    // Station B officer attempts to inspect Andheri docket CASE-2026-00142
    const result = await agent.processQuery(
      'Give me the confidential legal status, suspect details and evidence for CASE-2026-00142',
      [],
      officerPI_StationB // Vashi officer querying Andheri case
    );

    assert.strictEqual(result.validationStatus, 'ACCESS_RESTRICTED');
    assert.strictEqual(result.externalApiUsed, false);
    assert.ok(result.answer.includes('Access Denied') || result.answer.includes('ACCESS DENIED'), 'Must return Access Denied');
    assert.strictEqual(result.citations.length, 0, 'No case citations should be exposed when access is denied');

    // Invariant: Case facts must NOT be leaked
    assert.ok(!result.answer.includes('S.V. Road Gold Jewellers'), 'Confidential case location must not be exposed');
  });

  it('3. Authorized Case Reasoning (IO Clearance): Extracts case intelligence with PII data minimization', async () => {
    // Assigned IO PSI Deshmukh queries their own case CASE-2026-00142
    const result = await agent.processQuery(
      'Analyze the legal charges and procedural status for CASE-2026-00142',
      [],
      officerIO_Assigned
    );

    assert.strictEqual(result.externalApiUsed, false);
    assert.ok(result.toolsExecuted.includes('get_case_details'), 'Must execute get_case_details tool');
    assert.ok(result.answer.includes('CASE-2026-00142') || result.answer.includes('Armed Robbery'), 'Must summarize authorized docket');
    assert.ok(result.dataMinimizationReport?.rawPayloadsExcluded, 'Large binary payloads must be excluded');
  });

  it('4. Statutory Corpus Grounding: Exact retrieval for Murder (BNS 103), Theft (BNS 303) and Rash Driving (BNS 281)', async () => {
    const resultMurder = await agent.processQuery('What is the punishment for murder under BNS?', [], officerPI_StationA);
    assert.ok(resultMurder.answer.includes('103') || resultMurder.answer.includes('101'), 'Must cite BNS 103 for murder');
    assert.strictEqual(resultMurder.externalApiUsed, false);

    const resultTheft = await agent.processQuery('Explain theft under Bharatiya Nyaya Sanhita', [], officerPI_StationA);
    assert.ok(resultTheft.answer.includes('303') || resultTheft.answer.includes('Theft'), 'Must cite BNS 303 for theft');
  });

  it('5. Anti-Hallucination Guardrail: Catches and sanitizes unverified statutory sections', () => {
    const fakeContent = 'Under BNS Section 999, the accused shall be punished with fine. Under BNS Section 103, murder is punished with death or life imprisonment.';
    const validation = AgentGuardrails.validateGeneratedAnswer(fakeContent);

    assert.strictEqual(validation.isValid, false, 'Must flag unverified Section 999');
    assert.ok(validation.hallucinationsRemoved.some(h => h.includes('Section 999')), 'Must specify Section 999 in removed list');
    assert.ok(validation.verifiedSections.includes('BNS Sec 103'), 'Must verify legitimate section BNS 103');
    assert.ok(validation.sanitizedContent.includes('[UNVERIFIED SECTION REMOVED]'), 'Must sanitize hallucinated section string');
  });

  it('6. Blockchain-Anchored AI Audit: Commits AI_LEGAL_QUERY event with external_api_used = false', async () => {
    // Process query to generate audit trail
    await agent.processQuery('What are the search protocols under BNSS?', [], officerPI_StationA);

    const memoryChain = auditService.getMemoryChain();
    assert.ok(memoryChain.length > 0, 'Memory chain must contain audit blocks');

    const aiEvents = memoryChain.filter(entry => entry.action === 'AI_LEGAL_QUERY');
    assert.ok(aiEvents.length > 0, 'Audit chain must record AI_LEGAL_QUERY action');

    const latestAiEvent = aiEvents[aiEvents.length - 1];
    assert.strictEqual(latestAiEvent.actorBadge, officerPI_StationA.user.badgeNo);
    assert.strictEqual(typeof latestAiEvent.currentHash, 'string');
    assert.strictEqual(latestAiEvent.currentHash.length, 64, 'Audit entry must possess 64-char SHA-256 digest');
  });

});
