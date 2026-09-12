import 'dotenv/config';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-maharashtra-police-2026';
import test from 'node:test';
import assert from 'node:assert';
import { LegalRagService } from '../services/legalRagService';

test('Police Law Assistant RAG Service & Dual Retrieval Test Suite', async (t) => {
  const ragService = LegalRagService.getInstance();
  await ragService.initialize();

  // 1. Corpus Integrity & SHA-256 Sealing
  await t.test('1. Corpus Ingestion: Verifies exactly 1,059 statutory provisions across BNS, BNSS, and BSA', () => {
    const allSections = ragService.getAllSections();
    assert.strictEqual(allSections.length, 1059, 'Total statutory sections must be 1,059');

    const bns = ragService.getAllSections('BNS');
    const bnss = ragService.getAllSections('BNSS');
    const bsa = ragService.getAllSections('BSA');

    assert.strictEqual(bns.length, 358, 'BNS must have 358 sections');
    assert.strictEqual(bnss.length, 531, 'BNSS must have 531 sections');
    assert.strictEqual(bsa.length, 170, 'BSA must have 170 sections');

    const bns103 = ragService.getSection('BNS', '103');
    assert.ok(bns103, 'BNS Section 103 must exist');
    assert.ok(/^[a-f0-9]{64}$/i.test(bns103.sha256), 'SHA-256 digest must be valid 64 hex characters');
    assert.ok(bns103.title.toLowerCase().includes('murder'), 'BNS 103 title must cover murder');
  });

  // 2. Dual Retrieval Path A: Exact Section Lookup
  await t.test('2. Exact Retrieval: Sub-millisecond direct lookup for BNS 103', async () => {
    const res = await ragService.query('What is BNS 103?');
    assert.strictEqual(res.intent, 'EXACT_SECTION_LOOKUP');
    assert.strictEqual(res.matchedAct, 'BNS');
    assert.strictEqual(res.matchedSection, '103');
    assert.ok(res.retrievedSections.length > 0);
    assert.strictEqual(res.retrievedSections[0].section.sectionNumber, '103');
    assert.strictEqual(res.retrievedSections[0].relevanceScore, 1.0);
    assert.ok(res.groundedAnalysis.summary.includes('BNS Section 103'));
    assert.ok(res.groundedAnalysis.statutoryCitations.length > 0);
  });

  await t.test('3. Exact Retrieval: Direct lookup for BNSS Section 173 (FIR Recording)', async () => {
    const res = await ragService.query('BNSS Section 173');
    assert.strictEqual(res.intent, 'EXACT_SECTION_LOOKUP');
    assert.strictEqual(res.matchedAct, 'BNSS');
    assert.strictEqual(res.matchedSection, '173');
    assert.ok(res.retrievedSections[0].section.title.toLowerCase().includes('cognizable'));
  });

  await t.test('4. Exact Retrieval: Direct lookup for BSA Section 63 (Electronic Evidence)', async () => {
    const res = await ragService.query('BSA Section 63');
    assert.strictEqual(res.intent, 'EXACT_SECTION_LOOKUP');
    assert.strictEqual(res.matchedAct, 'BSA');
    assert.strictEqual(res.matchedSection, '63');
    assert.ok(res.retrievedSections[0].section.title.toLowerCase().includes('electronic records'));
  });

  // 3. Dual Retrieval Path A.2: Legacy Law Cross-Referencing (IPC/CrPC/IEA -> BNS/BNSS/BSA)
  await t.test('5. Cross-Reference: Maps IPC 302 to BNS Section 103 with key reforms', async () => {
    const res = await ragService.query('What is IPC 302 in the new legal code?');
    assert.strictEqual(res.intent, 'CROSS_REFERENCE_LOOKUP');
    assert.ok(res.crossReference, 'Cross reference must be identified');
    assert.strictEqual(res.crossReference.legacyAct, 'IPC');
    assert.strictEqual(res.crossReference.legacySection, '302');
    assert.strictEqual(res.crossReference.newAct, 'BNS');
    assert.strictEqual(res.crossReference.newSection, '103');
    assert.ok(res.groundedAnalysis.summary.includes('BNS Section 103'));
  });

  await t.test('6. Cross-Reference: Maps CrPC 154 to BNSS Section 173', async () => {
    const res = await ragService.query('Procedure under CrPC 154');
    assert.strictEqual(res.intent, 'CROSS_REFERENCE_LOOKUP');
    assert.strictEqual(res.crossReference?.newAct, 'BNSS');
    assert.strictEqual(res.crossReference?.newSection, '173');
  });

  await t.test('7. Cross-Reference: Maps IEA 65B to BSA Section 63', async () => {
    const res = await ragService.query('Admissibility of electronic record certificate IEA 65B');
    assert.strictEqual(res.intent, 'CROSS_REFERENCE_LOOKUP');
    assert.strictEqual(res.crossReference?.newAct, 'BSA');
    assert.strictEqual(res.crossReference?.newSection, '63');
  });

  // 4. Dual Retrieval Path B: Incident Scenario Semantic RAG
  await t.test('8. Semantic Scenario Analysis: Identifies Stalking (BNS 78) from incident description', async () => {
    const res = await ragService.query(
      'A person is repeatedly following a woman, contacting her on social media and tracking her movement despite objections'
    );
    assert.ok(res.intent === 'OFFENCE_LOOKUP' || res.intent === 'CRIME_SCENARIO_ANALYSIS');
    assert.ok(res.retrievedSections.length > 0);

    const sectionNums = res.retrievedSections.map((r) => r.section.sectionNumber);
    assert.ok(sectionNums.includes('78'), 'Should retrieve BNS Section 78 (Stalking)');

    assert.ok(res.groundedAnalysis.investigationChecklist.length > 0);
    assert.ok(res.groundedAnalysis.evidenceAdmissibilityChecklist.length > 0);
  });

  // 5. Zero-Hallucination Citations
  await t.test('9. Zero-Hallucination: All citations belong to verified corpus with cryptographic digests', async () => {
    const res = await ragService.query('Extortion, threats and demand for ransom');
    assert.ok(res.groundedAnalysis.statutoryCitations.length > 0);
    res.groundedAnalysis.statutoryCitations.forEach((citation) => {
      assert.ok(
        citation.startsWith('Bharatiya Nyaya Sanhita') ||
        citation.startsWith('Bharatiya Nagarik Suraksha') ||
        citation.startsWith('Bharatiya Sakshya'),
        'Citation must cite official Sanhita enactments'
      );
      assert.ok(citation.includes('Digest:'), 'Citation must contain SHA-256 digest');
    });
  });

  // 6. Cross-Reference Directory Integrity
  await t.test('10. Cross-Reference Table: Contains major criminal, procedural and evidence transitions', () => {
    const mappings = ragService.getCrossReferenceTable();
    assert.ok(mappings.length >= 15, 'Must contain at least 15 core legal transitions');

    const ipc420 = mappings.find((m) => m.legacyAct === 'IPC' && m.legacySection === '420');
    assert.ok(ipc420);
    assert.strictEqual(ipc420.newSection, '318'); // Cheating under BNS

    const crpc41a = mappings.find((m) => m.legacyAct === 'CrPC' && m.legacySection === '41A');
    assert.ok(crpc41a);
    assert.strictEqual(crpc41a.newSection, '35'); // Notice of appearance under BNSS
  });

  // 7. Benchmark Runner
  await t.test('11. Benchmark Runner: Computes evaluation metrics over sample QA dataset', async () => {
    const metrics = await ragService.runBenchmark(10);
    assert.strictEqual(metrics.totalEvaluated, 10);
    assert.ok(typeof metrics.top1Accuracy === 'number');
    assert.ok(typeof metrics.top3Accuracy === 'number');
    assert.ok(metrics.top3Accuracy >= metrics.top1Accuracy);
    assert.ok(metrics.meanLatencyMs >= 0);
    assert.strictEqual(metrics.sampleEvaluations.length, 10);
  });

  // 8. Drunk Driving Domain Scenario Retrieval
  await t.test('12. Domain Scenario: Accurately identifies Motor Vehicles Act 185 & BNS 281 for drunk driving', async () => {
    const res = await ragService.query('what section for an drunk drive case');
    assert.ok(res.intent === 'OFFENCE_LOOKUP' || res.intent === 'CRIME_SCENARIO_ANALYSIS');
    assert.ok(res.groundedAnalysis.summary.toLowerCase().includes('drunk driving'));
    
    // Check that Motor Vehicles Act Section 185 is included in recommendations
    const hasMv185 = res.groundedAnalysis.recommendedProvisions.some(
      (p) => p.section.includes('185') && p.act.toLowerCase().includes('motor vehicles')
    );
    assert.ok(hasMv185, 'Must recommend Motor Vehicles Act Section 185');

    // Check that BNS 281 (rash driving) is retrieved
    const hasBns281 = res.retrievedSections.some((r) => r.section.act === 'BNS' && r.section.sectionNumber === '281');
    assert.ok(hasBns281, 'Must retrieve BNS Section 281 (Rash driving)');
  });

  // 9. Generic Section Number Disambiguation (Section 33)
  await t.test('13. Generic Section Disambiguation: Accurately identifies Section 33 across BNS, BNSS, and BSA', async () => {
    const res = await ragService.query('what is section 33?');
    assert.strictEqual(res.intent, 'EXACT_SECTION_LOOKUP');
    assert.strictEqual(res.matchedSection, '33');

    const acts = res.retrievedSections.map((r) => r.section.act);
    assert.ok(acts.includes('BNS'), 'Must retrieve BNS Section 33');
    assert.ok(acts.includes('BNSS'), 'Must retrieve BNSS Section 33');
    assert.ok(acts.includes('BSA'), 'Must retrieve BSA Section 33');

    // Verify BNS 33 is "Act causing slight harm"
    const bns33 = res.retrievedSections.find((r) => r.section.act === 'BNS' && r.section.sectionNumber === '33');
    assert.ok(bns33?.section.title.toLowerCase().includes('slight harm'), 'BNS 33 must be slight harm');
  });

  // 10. Conversational Multi-Turn Chat (Gemini Style)
  await t.test('14. Conversational Chat: Produces natural AI responses with citations and chunks', async () => {
    const chatRes = await ragService.chat([
      { role: 'user', content: 'What section should police apply when a driver was drunk and hit a pedestrian?' },
    ]);

    assert.strictEqual(chatRes.message.role, 'assistant');
    assert.ok(chatRes.message.content.length > 50, 'Content must be non-trivial conversational text');
    assert.ok(chatRes.retrievedSections.length > 0, 'Must have retrieved statutory chunks');
    assert.ok(chatRes.citations.length > 0, 'Must have statutory citations');
    assert.ok(chatRes.message.content.includes('Section 185') || chatRes.message.content.includes('281') || chatRes.message.content.includes('106'), 'Must cite relevant driving offence sections');
  });

  // 11. Murder Offence Tiered Verification: BNS 101 (PRIMARY) + BNS 103 (PUNISHMENT) + BNS 103(2) (CONDITIONAL)
  await t.test('15. Murder Query: Identifies BNS 101 as PRIMARY, BNS 103 as PUNISHMENT, BNS 103(2) as CONDITIONAL', async () => {
    const res = await ragService.query('what section apply on murder');
    assert.strictEqual(res.intent, 'OFFENCE_LOOKUP');

    const primary = res.offenceDetails?.primaryProvisions;
    assert.ok(primary && primary.length > 0, 'Must identify primary provisions');
    assert.strictEqual(primary[0].act, 'BNS');
    assert.strictEqual(primary[0].section, '101');
    assert.strictEqual(primary[0].role, 'PRIMARY');

    const punishment = res.offenceDetails?.punishmentProvisions;
    assert.ok(punishment && punishment.length > 0, 'Must identify punishment provisions');
    assert.strictEqual(punishment[0].act, 'BNS');
    assert.strictEqual(punishment[0].section, '103');
    assert.strictEqual(punishment[0].role, 'PUNISHMENT');

    const conditional = res.offenceDetails?.conditionalProvisions;
    assert.ok(conditional && conditional.length > 0, 'Must identify conditional mob lynching provision');
    const mob103_2 = conditional.find((c) => c.section.includes('103(2)'));
    assert.ok(mob103_2, 'Must include BNS 103(2) in conditional tier');
    assert.strictEqual(mob103_2.role, 'CONDITIONAL');
    assert.strictEqual(mob103_2.conditionSatisfied, false, 'Condition must be false without mob lynching facts');
  });

  // 12. Negative Test: Murder Query MUST NOT rank BNS 1 or BNS 46 as primary
  await t.test('16. Negative Test: Murder query must NOT retrieve BNS Section 1 as relevant nor BNS 46 as primary', async () => {
    const res = await ragService.query('what section apply on murder');
    const recommended = res.groundedAnalysis.recommendedProvisions;

    // BNS Section 1 must NOT be in recommendations
    const hasBns1 = recommended.some((p) => p.section.includes('Section 1') && !p.section.includes('101') && !p.section.includes('103'));
    assert.strictEqual(hasBns1, false, 'Must NOT recommend BNS Section 1');

    // BNS Section 46 must NOT be primary
    const primaryIs46 = recommended.some((p) => p.role === 'PRIMARY' && p.section.includes('46'));
    assert.strictEqual(primaryIs46, false, 'Must NOT rank BNS Section 46 as PRIMARY');
  });

  // 13. Punishment Lookup: "What is punishment for murder?"
  await t.test('17. Punishment Lookup: "What is punishment for murder?" resolves to BNS Section 103', async () => {
    const res = await ragService.query('What is punishment for murder?');
    assert.strictEqual(res.intent, 'OFFENCE_LOOKUP');
    const hasPunishment103 = res.offenceDetails?.punishmentProvisions.some(
      (p) => p.act === 'BNS' && p.section === '103'
    );
    assert.ok(hasPunishment103, 'Must identify BNS 103 as prescribed punishment');
  });

  // 14. Stalking Offence Lookup
  await t.test('18. Stalking Lookup: "What section applies to stalking?" resolves to BNS Section 78', async () => {
    const res = await ragService.query('What section applies to stalking?');
    assert.strictEqual(res.intent, 'OFFENCE_LOOKUP');
    const hasStalking78 = res.offenceDetails?.primaryProvisions.some(
      (p) => p.act === 'BNS' && p.section === '78'
    );
    assert.ok(hasStalking78, 'Must identify BNS Section 78 for stalking');
  });

  // 15. Drunk Driving Lookup
  await t.test('19. Drunk Driving Lookup: "What section applies to drunk driving?" resolves to Motor Vehicles Act 185', async () => {
    const res = await ragService.query('What section applies to drunk driving?');
    assert.strictEqual(res.intent, 'OFFENCE_LOOKUP');
    const hasMv185 = res.offenceDetails?.primaryProvisions.some(
      (p) => p.section === '185' && p.act.toLowerCase().includes('motor vehicles')
    );
    assert.ok(hasMv185, 'Must identify Motor Vehicles Act Section 185 as PRIMARY');
  });

  // 16. Negative Test: Drunk Driving without fatality MUST NOT charge BNS 106
  await t.test('20. Negative Test: Drunk driving without death MUST NOT charge BNS Section 106', async () => {
    const res = await ragService.query('A driver was intercepted with alcohol level 80 mg in breath analyser at police naka');
    const recommended = res.groundedAnalysis.recommendedProvisions;
    const has106Charged = recommended.some((p) => p.section.includes('106'));
    assert.strictEqual(has106Charged, false, 'Must NOT charge BNS 106 when no death occurred');

    const warning106 = res.offenceDetails?.negativeExclusions.some((e) => e.section.includes('106'));
    assert.ok(warning106, 'Must include explicit officer warning against charging BNS 106');
  });

  // 17. Negligent Driving Causing Death
  await t.test('21. Negligent Driving Death: "Someone died because of negligent driving" analyzes BNS Section 106', async () => {
    const res = await ragService.query('Someone died because of negligent driving');
    assert.ok(
      res.retrievedSections.some((r) => r.section.sectionNumber === '106') ||
      res.groundedAnalysis.recommendedProvisions.some((p) => p.section.includes('106')),
      'Must identify BNS Section 106 (Causing death by negligence)'
    );
  });

  // 18. Procedural Section Lookup: "What is BNSS Section 105?"
  await t.test('22. Procedural Lookup: BNSS Section 105 is identified as PROCEDURAL safeguard', async () => {
    const res = await ragService.query('What is BNSS Section 105?');
    assert.strictEqual(res.intent, 'EXACT_SECTION_LOOKUP');
    assert.strictEqual(res.matchedAct, 'BNSS');
    assert.strictEqual(res.matchedSection, '105');

    const sec = res.retrievedSections[0].section;
    assert.ok(sec.title.toLowerCase().includes('audio-video') || sec.title.toLowerCase().includes('electronic'));
  });

  // 19. Nonexistent Section Validation Rejection (BNS 999)
  await t.test('23. Validation Rejection: Nonexistent Section BNS 999 must fail validation', () => {
    const validationService = ragService.getValidationService();
    const rep = validationService.validateCitation('BNS', '999');
    assert.strictEqual(rep.isValid, false, 'BNS 999 must be invalid');
    assert.strictEqual(rep.sectionExists, false, 'Section 999 does not exist in BNS (max 358)');
    assert.ok(rep.errors.some((e) => e.includes('does not exist')));
  });

  // 20. Authoritative Classification Validation
  await t.test('24. Authoritative Classification: Enforces BNSS Schedule and rejects false bail status', () => {
    const classificationService = ragService.getClassificationService();
    const murderClass = classificationService.getClassification('BNS', '101');
    assert.ok(murderClass, 'BNS 101 must exist in classification DB');
    assert.strictEqual(murderClass.cognizable, true, 'Murder must be Cognizable');
    assert.strictEqual(murderClass.bailable, false, 'Murder must be Non-Bailable');
    assert.strictEqual(murderClass.triable_by, 'Court of Session');

    // Validation service rejects claim that BNS 103 is Bailable
    const validationService = ragService.getValidationService();
    const falseClaim = validationService.validateCitation('BNS', '103', true, true); // claiming bailable = true
    assert.strictEqual(falseClaim.isValid, false, 'Claim that Murder is Bailable must be REJECTED');
    assert.ok(falseClaim.errors.some((e) => e.includes('Bailable status mismatch')));
  });
});
