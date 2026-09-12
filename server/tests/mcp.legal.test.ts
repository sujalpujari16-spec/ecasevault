import 'dotenv/config';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-maharashtra-police-2026';
import test from 'node:test';
import assert from 'node:assert';
import { LegalMcpTools, MCP_TOOL_DEFINITIONS } from '../mcp/legalMcpTools';
import { LegalRagService } from '../services/legalRagService';

test('Legal MCP Tools & Tiered Statutory Grounding Test Suite', async (t) => {
  const ragService = LegalRagService.getInstance();
  await ragService.initialize();

  // 1. Tool Catalog Verification
  await t.test('1. MCP Tool Registry: Exposes mandatory legal retrieval & reasoning tools', () => {
    const toolNames = MCP_TOOL_DEFINITIONS.map((t) => t.name);
    assert.ok(toolNames.includes('search_legal_sections'), 'Must include search_legal_sections');
    assert.ok(toolNames.includes('get_legal_section'), 'Must include get_legal_section');
    assert.ok(toolNames.includes('find_applicable_provisions'), 'Must include find_applicable_provisions');
    assert.ok(toolNames.includes('get_procedure'), 'Must include get_procedure');
    assert.ok(toolNames.includes('verify_legal_version'), 'Must include verify_legal_version');
  });

  // 2. Exact Section Lookup via MCP Tool
  await t.test('2. Tool Execution: get_legal_section retrieves BNS 103 with SHA-256 seal', async () => {
    const res = await LegalMcpTools.executeTool('get_legal_section', {
      act: 'BNS',
      sectionNumber: '103',
    });

    assert.strictEqual(res.found, true);
    assert.strictEqual(res.sectionNumber, '103');
    assert.ok(res.title.toLowerCase().includes('murder'));
    assert.ok(res.sha256);
    assert.strictEqual(res.sha256.length, 64);
  });

  // 3. Special Statute Lookup: Motor Vehicles Act 1988 Section 185
  await t.test('3. Tool Execution: get_legal_section retrieves Motor Vehicles Act Section 185', async () => {
    const res = await LegalMcpTools.executeTool('get_legal_section', {
      act: 'MV_ACT',
      sectionNumber: '185',
    });

    assert.strictEqual(res.found, true);
    assert.strictEqual(res.sectionNumber, '185');
    assert.ok(res.title.toLowerCase().includes('drunken'));
    assert.ok(res.text.includes('30 mg. per 100 ml. of blood'));
  });

  // 4. Tiered Classification: Drunk Driving Without Fatality
  await t.test('4. Tiered Reasoning: Drunk Driving distinguishes PRIMARY, CONDITIONAL, EXCLUDED, and PROCEDURAL', async () => {
    const analysis = await LegalMcpTools.executeTool('find_applicable_provisions', {
      incidentDescription: 'Person was intercepted driving a car with 85 mg alcohol per 100 ml blood.',
      hasFatality: false,
    });

    assert.strictEqual(analysis.incidentType, 'Drunk Driving & Traffic Safety Incident');

    // Verify PRIMARY: MV Act 185
    assert.strictEqual(analysis.provisions.primary.length, 1);
    assert.strictEqual(analysis.provisions.primary[0].section, 'Section 185');
    assert.ok(analysis.provisions.primary[0].act.includes('Motor Vehicles'));

    // Verify CONDITIONAL: BNS 281 & BNS 125
    const conditionalSections = analysis.provisions.conditional.map((p: any) => p.section);
    assert.ok(conditionalSections.includes('Section 281'), 'BNS 281 must be conditional');
    assert.ok(conditionalSections.includes('Section 125'), 'BNS 125 must be conditional');

    // Verify EXCLUDED UNLESS AGGRAVATED: BNS 106
    assert.strictEqual(analysis.provisions.excludedUnlessAggravated.length, 1);
    const excluded106 = analysis.provisions.excludedUnlessAggravated[0];
    assert.ok(excluded106.section.includes('106'));
    assert.ok(excluded106.triggerCondition.includes('STRICTLY NOT APPLICABLE'));
    assert.ok(excluded106.notes.includes('OFFICER WARNING'));

    // Verify PROCEDURAL: BNSS 105 & MV Act 203/204
    const proceduralSections = analysis.provisions.procedural.map((p: any) => p.section);
    assert.ok(proceduralSections.includes('Section 105'), 'BNSS 105 must be procedural');
    assert.ok(proceduralSections.includes('Section 203 & Section 204'), 'MV Act 203/204 must be procedural');

    // Verify EVIDENTIARY: BSA 63 & BSA 39
    const evidentiarySections = analysis.provisions.evidentiary.map((p: any) => p.section);
    assert.ok(evidentiarySections.includes('Section 63'), 'BSA 63 must be evidentiary');
    assert.ok(evidentiarySections.includes('Section 39'), 'BSA 39 must be evidentiary');
  });

  // 5. Tiered Classification: Drunk Driving WITH Fatal Collision
  await t.test('5. Tiered Reasoning: Fatal drunk driving marks BNS 106 as APPLICABLE', async () => {
    const analysis = await LegalMcpTools.executeTool('find_applicable_provisions', {
      incidentDescription: 'Drunken driver hit a pedestrian who died at the spot on highway.',
      hasFatality: true,
    });

    const excluded106 = analysis.provisions.excludedUnlessAggravated[0];
    assert.ok(excluded106.triggerCondition.includes('APPLICABLE: Fatality occurred'));
  });

  // 6. Mandatory Procedure Tool
  await t.test('6. Tool Execution: get_procedure returns 5-step SOP for drunk driving enforcement', async () => {
    const proc = await LegalMcpTools.executeTool('get_procedure', {
      procedureType: 'DRUNK_DRIVING_SOP',
    });

    assert.strictEqual(proc.procedureType, 'DRUNK_DRIVING_SOP');
    assert.strictEqual(proc.steps.length, 5);
    assert.ok(proc.steps.some((s: any) => s.statutoryMandate.includes('Section 204')));
    assert.ok(proc.steps.some((s: any) => s.statutoryMandate.includes('Section 105')));
  });

  // 7. Conversational Chat Output: Distinguishes Tiers for Police Officers
  await t.test('7. Conversational Output: Formats crystal clear tiered advice with warnings', async () => {
    const chatRes = await ragService.chat([
      { role: 'user', content: 'What section for an drunk drive case?' },
    ]);

    const content = chatRes.message.content;
    assert.ok(content.includes('1. Primary Applicable Offence'), 'Must contain Primary section heading');
    assert.ok(content.includes('2. Conditional Substantive Offences'), 'Must contain Conditional section heading');
    assert.ok(content.includes('3. Excluded Offence & Critical Officer Warning'), 'Must contain Excluded Warning heading');
    assert.ok(content.includes('BNS Section 106'), 'Must mention BNS 106');
    assert.ok(content.includes('DO NOT CHARGE UNLESS A HUMAN CASUALTY / DEATH OCCURRED'), 'Must warn officer not to charge BNS 106');
    assert.ok(content.includes('Section 185'), 'Must cite MV Act Section 185 as primary');
    assert.ok(content.includes('BNSS Section 105'), 'Must cite BNSS 105 for audio-video recording');
    assert.ok(content.includes('Section 204'), 'Must cite 2-hour medical examination rule');
  });
});
