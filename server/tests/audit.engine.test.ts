import test from 'node:test';
import assert from 'node:assert/strict';
import { auditService, computeCanonicalEventHash } from '../services/auditService';
import { auditSecurityService } from '../services/auditSecurityService';

test('Central Audit Engine, Case Timeline & Security Rules Test Suite', async (t) => {

  await t.test('1. Canonical Event Logging & SHA-256 Hash Computation', async () => {
    const caseId = `CASE-TEST-AUD-${Date.now()}`;
    const event = await auditService.logAuditEvent({
      action: 'CASE_CREATED',
      eventType: 'CASE',
      userId: 'MH-POL-8842',
      userName: 'Inspector Rajesh Patil',
      userRole: 'POLICE',
      caseId: caseId,
      resourceType: 'CASE',
      resourceId: caseId,
      status: 'SUCCESS',
      reason: 'Initial case registration under Section 154 CrPC',
      afterData: { caseId, firNumber: '0431/2026', status: 'FIR Registered' },
      metadata: { station: 'Vashi Police Station', district: 'Navi Mumbai' },
    });

    assert.ok(event.id, 'Event should have a unique ID');
    assert.equal(event.caseId, caseId);
    assert.equal(event.action, 'CASE_CREATED');
    assert.equal(event.status, 'SUCCESS');
    assert.ok(event.eventHash, 'Event should have an eventHash');
    assert.equal(event.eventHash.length, 64, 'Event hash must be a 64-char hex SHA-256');
    assert.ok(event.fabricTxId, 'Critical action CASE_CREATED must have a Fabric transaction ID');
  });

  await t.test('2. Case-Specific Activity Timeline Querying', async () => {
    const caseId = `CASE-TIMELINE-${Date.now()}`;

    await auditService.logAuditEvent({
      action: 'CASE_CREATED',
      eventType: 'CASE',
      userId: 'MH-POL-8842',
      caseId: caseId,
      status: 'SUCCESS',
    });

    await auditService.logAuditEvent({
      action: 'FIR_REGISTERED',
      eventType: 'FIR',
      userId: 'MH-POL-8842',
      caseId: caseId,
      status: 'SUCCESS',
      resourceId: 'FIR-0431',
    });

    await auditService.logAuditEvent({
      action: 'EVIDENCE_REGISTERED',
      eventType: 'EVIDENCE',
      userId: 'MH-POL-8842',
      caseId: caseId,
      status: 'SUCCESS',
      resourceId: 'EV-102',
    });

    const timeline = await auditService.getCaseAuditEvents(caseId);
    assert.equal(timeline.length, 3, 'Should retrieve all 3 events logged for this specific case docket');
    assert.equal(timeline[0].action, 'EVIDENCE_REGISTERED', 'Most recent event should be first');
    assert.equal(timeline[2].action, 'CASE_CREATED', 'Initial event should be at the base');
  });

  await t.test('3. Cryptographic Single-Event Verification & Tamper Detection', async () => {
    const caseId = `CASE-TAMPER-${Date.now()}`;
    const event = await auditService.logAuditEvent({
      action: 'EVIDENCE_TRANSFERRED',
      eventType: 'EVIDENCE',
      userId: 'MH-POL-8842',
      userRole: 'POLICE',
      caseId: caseId,
      resourceType: 'EVIDENCE',
      resourceId: 'EV-999',
      status: 'SUCCESS',
      beforeData: { custodian: 'MH-POL-8842' },
      afterData: { custodian: 'FSL-MH-KALINA-042' },
    });

    // Verify valid event
    const verifyValid = await auditService.verifyEventIntegrity(event.id);
    assert.equal(verifyValid.isIntact, true, 'Cryptographic hash should match stored digest');
    assert.equal(verifyValid.computedHash, event.eventHash);

    // Tamper with payload in memory to simulate database modification
    event.reason = 'UNAUTHORIZED TAMPER MODIFICATION';
    const recalculatedTamper = computeCanonicalEventHash({
      action: event.action,
      eventType: event.eventType,
      userId: event.userId,
      userRole: event.userRole,
      caseId: event.caseId,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      status: event.status,
      reason: event.reason,
      beforeData: event.beforeData,
      afterData: event.afterData,
      metadata: event.metadata,
      createdAt: event.createdAt,
    });
    assert.notEqual(recalculatedTamper, event.eventHash, 'Tampered data must yield a different SHA-256 hash');
  });

  await t.test('4. Security Engine Rule A: 5 Failed Logins -> Possible Brute-Force Alert', async () => {
    const attackerBadge = `TARGET-USER-${Date.now()}`;

    // Simulate 5 failed logins within 10 minutes
    for (let i = 0; i < 5; i++) {
      await auditService.logAuditEvent({
        action: 'USER_LOGIN_FAILED',
        eventType: 'AUTH',
        userId: attackerBadge,
        status: 'FAILURE',
        reason: 'Invalid password hash match',
        ipAddress: '192.168.1.105',
      });
    }

    const anomalies = await auditSecurityService.evaluateSecurityRules({ lookbackMinutes: 10 });
    const bruteForceAnomaly = anomalies.find(
      (a) => a.ruleId === 'RULE_A' && a.targetUser === attackerBadge
    );

    assert.ok(bruteForceAnomaly, 'Rule A must detect brute-force activity after 5 failed logins');
    assert.equal(bruteForceAnomaly.severity, 'CRITICAL');
    assert.equal(bruteForceAnomaly.count, 5);
  });

  await t.test('5. Security Engine Rule B: 15 Unauthorized Accesses -> Repeated Denial Alert', async () => {
    const probingUser = `PROBING-OFFICER-${Date.now()}`;

    // Simulate 15 access denials
    for (let i = 0; i < 15; i++) {
      await auditService.logAuditEvent({
        action: 'ACCESS_DENIED_DEPARTMENT_ISOLATION',
        eventType: 'ACCESS',
        userId: probingUser,
        status: 'FAILURE',
        reason: 'Departmental Isolation: User cannot modify documents in other departments',
      });
    }

    const anomalies = await auditSecurityService.evaluateSecurityRules({ lookbackMinutes: 10 });
    const denialAnomaly = anomalies.find(
      (a) => a.ruleId === 'RULE_B' && a.targetUser === probingUser
    );

    assert.ok(denialAnomaly, 'Rule B must detect repeated access denials after 15 attempts');
    assert.equal(denialAnomaly.severity, 'HIGH');
  });

  await t.test('6. Security Engine Rule C: 20 Evidence Downloads -> Unusual Velocity Extraction Alert', async () => {
    const extractorUser = `EXTRACTOR-${Date.now()}`;

    // Simulate 20 downloads in 5 minutes
    for (let i = 0; i < 20; i++) {
      await auditService.logAuditEvent({
        action: 'EVIDENCE_DOWNLOADED',
        eventType: 'EVIDENCE',
        userId: extractorUser,
        status: 'SUCCESS',
        resourceId: `EV-${i}`,
      });
    }

    const anomalies = await auditSecurityService.evaluateSecurityRules({ lookbackMinutes: 5 });
    const downloadAnomaly = anomalies.find(
      (a) => a.ruleId === 'RULE_C' && a.targetUser === extractorUser
    );

    assert.ok(downloadAnomaly, 'Rule C must detect unusual evidence extraction after 20 downloads in 5 min');
    assert.equal(downloadAnomaly.severity, 'HIGH');
  });

  await t.test('7. Security Engine Rule D: Transferred Evidence with No Receipt -> Custody Gap Alert', async () => {
    const evidenceTag = `EV-CUSTODY-GAP-${Date.now()}`;
    const oldTimestamp = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(); // 36 hours ago

    // Log evidence transfer in the past without subsequent receipt
    await auditService.logAuditEvent({
      action: 'EVIDENCE_TRANSFERRED',
      eventType: 'EVIDENCE',
      userId: 'MH-POL-8842',
      resourceId: evidenceTag,
      status: 'SUCCESS',
      metadata: { evidenceId: evidenceTag, targetOfficer: 'FSL-MH-KALINA-042' },
    });

    // Evaluate rules with custodyGapHours = 0 to trigger on unreceived transfers
    const anomalies = await auditSecurityService.evaluateSecurityRules({
      lookbackMinutes: 1000,
      custodyGapHours: 0,
    });

    const gapAnomaly = anomalies.find(
      (a) => a.ruleId === 'RULE_D' && a.evidenceId === evidenceTag
    );

    assert.ok(gapAnomaly, 'Rule D must detect evidence transferred without corresponding receipt');
    assert.equal(gapAnomaly.severity, 'CRITICAL');
  });

  await t.test('8. Full Operational User Flow Demonstration (Step 11)', async () => {
    const demoCaseId = 'CASE-0431';

    // Step 1: Case created
    await auditService.logAuditEvent({
      action: 'CASE_CREATED',
      eventType: 'CASE',
      userId: 'MH-POL-8842',
      userRole: 'POLICE',
      caseId: demoCaseId,
      resourceType: 'CASE',
      resourceId: demoCaseId,
      status: 'SUCCESS',
      reason: 'Vashi Plaza Accident & Dangerous Driving Case created',
    });

    // Step 2: FIR registered
    await auditService.logAuditEvent({
      action: 'FIR_REGISTERED',
      eventType: 'FIR',
      userId: 'MH-POL-8842',
      userRole: 'POLICE',
      caseId: demoCaseId,
      resourceType: 'FIR',
      resourceId: '0431/2026',
      status: 'SUCCESS',
      reason: 'Bilingual Marathi CCTNS Form I.I.F.-I FIR registered',
      afterData: { firNumber: '0431', policeStation: 'वाशी', sections: ['280 BNS', '184 MV Act'] },
    });

    // Step 3: Document uploaded
    await auditService.logAuditEvent({
      action: 'DOCUMENT_UPLOADED',
      eventType: 'DOCUMENT',
      userId: 'MH-POL-8842',
      userRole: 'POLICE',
      caseId: demoCaseId,
      resourceType: 'DOCUMENT',
      resourceId: 'DOC-0431-FIR-SCAN',
      status: 'SUCCESS',
      reason: 'Uploaded original 9-page bilingual CCTNS FIR scan (0431 Publish FIR.pdf)',
    });

    // Step 4: Evidence registered
    await auditService.logAuditEvent({
      action: 'EVIDENCE_REGISTERED',
      eventType: 'EVIDENCE',
      userId: 'MH-POL-8842',
      userRole: 'POLICE',
      caseId: demoCaseId,
      resourceType: 'EVIDENCE',
      resourceId: 'EV-102',
      status: 'SUCCESS',
      reason: 'Seized vehicle dashcam storage card from MH 46 CL 9870',
    });

    // Step 5: Evidence transferred
    await auditService.logAuditEvent({
      action: 'EVIDENCE_TRANSFERRED',
      eventType: 'EVIDENCE',
      userId: 'MH-POL-8842',
      userRole: 'POLICE',
      caseId: demoCaseId,
      resourceType: 'EVIDENCE',
      resourceId: 'EV-102',
      status: 'SUCCESS',
      reason: 'Transferred custody from Police to Forensic Science Lab Kalina',
      beforeData: { custodian: 'MH-POL-8842 (POLICE)' },
      afterData: { custodian: 'FSL-MH-KALINA-042 (FORENSIC)' },
    });

    // Step 6: Forensic receives EV-102
    await auditService.logAuditEvent({
      action: 'EVIDENCE_RECEIVED',
      eventType: 'EVIDENCE',
      userId: 'FSL-MH-KALINA-042',
      userRole: 'FORENSIC',
      caseId: demoCaseId,
      resourceType: 'EVIDENCE',
      resourceId: 'EV-102',
      status: 'SUCCESS',
      reason: 'Forensic scientist acknowledges receipt and secures evidence in Kalina FSL Vault',
    });

    // Step 7: Upload forensic report
    await auditService.logAuditEvent({
      action: 'FORENSIC_REPORT_UPLOADED',
      eventType: 'DOCUMENT',
      userId: 'FSL-MH-KALINA-042',
      userRole: 'FORENSIC',
      caseId: demoCaseId,
      resourceType: 'DOCUMENT',
      resourceId: 'DOC-FSL-0431-ANALYSIS',
      status: 'SUCCESS',
      reason: 'Uploaded Dashcam Video Frame Authenticity & Crash Speed Vector Report',
    });

    // Step 8: Legal adds record
    await auditService.logAuditEvent({
      action: 'LEGAL_RECORD_CREATED',
      eventType: 'DOCUMENT',
      userId: 'PP-MUMBAI-01',
      userRole: 'LEGAL',
      caseId: demoCaseId,
      resourceType: 'DOCUMENT',
      resourceId: 'DOC-COURT-0431-REMAND',
      status: 'SUCCESS',
      reason: 'Public Prosecutor submitted Judicial Remand Application to JMFC Court Vashi',
    });

    // Step 9: Auditor verifies hash
    await auditService.logAuditEvent({
      action: 'EVIDENCE_HASH_VERIFIED',
      eventType: 'EVIDENCE',
      userId: 'AUD-MH-9901',
      userRole: 'AUDITOR',
      caseId: demoCaseId,
      resourceType: 'EVIDENCE',
      resourceId: 'EV-102',
      status: 'SUCCESS',
      reason: 'Independent Vigilance Auditor verified SHA-256 match against Hyperledger Fabric ledger',
    });

    // Query case timeline
    const caseEvents = await auditService.getCaseAuditEvents(demoCaseId);
    assert.equal(caseEvents.length, 9, 'All 9 statutory workflow events must be present in CASE-0431 timeline');

    // Verify all actions are present
    const actionNames = caseEvents.map((e) => e.action);
    assert.ok(actionNames.includes('CASE_CREATED'));
    assert.ok(actionNames.includes('FIR_REGISTERED'));
    assert.ok(actionNames.includes('DOCUMENT_UPLOADED'));
    assert.ok(actionNames.includes('EVIDENCE_REGISTERED'));
    assert.ok(actionNames.includes('EVIDENCE_TRANSFERRED'));
    assert.ok(actionNames.includes('EVIDENCE_RECEIVED'));
    assert.ok(actionNames.includes('FORENSIC_REPORT_UPLOADED'));
    assert.ok(actionNames.includes('LEGAL_RECORD_CREATED'));
    assert.ok(actionNames.includes('EVIDENCE_HASH_VERIFIED'));

    // Verify cryptographic integrity of all 9 events
    for (const evt of caseEvents) {
      const report = await auditService.verifyEventIntegrity(evt.id);
      assert.equal(report.isIntact, true, `Event ${evt.action} (${evt.id}) must have intact SHA-256 hash`);
    }

    // Global dashboard query by case
    const globalByCase = await auditService.getAllAuditEvents({ caseId: demoCaseId });
    assert.equal(globalByCase.events.length, 9, 'Global audit query by caseId must return all 9 events');

    // Global dashboard query by role
    const globalByForensic = await auditService.getAllAuditEvents({ caseId: demoCaseId, role: 'FORENSIC' });
    assert.equal(globalByForensic.events.length, 2, 'Global audit query for FORENSIC should return 2 events (RECEIVE and REPORT)');
  });
});
