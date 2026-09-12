import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { hashService, sha256, buildCanonicalEventData, createEventHash } from '../services/hashService';
import { blockchainEventService } from '../services/blockchainEventService';

describe('Tamper-Evident Blockchain Activity Hash-Chain Suite', () => {
  const testDataDir = path.resolve(process.cwd(), 'server/data');
  const eventsFile = path.join(testDataDir, 'blockchain_events.json');

  it('1. Hash Service: buildCanonicalEventData formats fields deterministically', () => {
    const fields = {
      caseId: 'CASE-001',
      entityId: 'ENT-001',
      entityType: 'CASE',
      action: 'CASE_CREATED',
      actorId: 'MH-POL-001',
      timestamp: '2026-09-11T12:00:00.000Z',
    };

    const canonical = buildCanonicalEventData(fields);
    assert.strictEqual(
      canonical,
      'CASE-001|ENT-001|CASE|CASE_CREATED|MH-POL-001|||2026-09-11T12:00:00.000Z'
    );
    assert.strictEqual(sha256(canonical).length, 64);
  });

  it('2. Hash Service: createEventHash produces SHA-256 linking previousHash', () => {
    const prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
    const canonical = 'CASE-001|ENT-001|CASE|CASE_CREATED|MH-POL-001|||2026-09-11T12:00:00.000Z';
    const eventHash = createEventHash(canonical, prevHash);

    assert.strictEqual(typeof eventHash, 'string');
    assert.strictEqual(eventHash.length, 64);

    // Verify mathematical link: eventHash === sha256(prevHash + '|' + canonical)
    const expected = sha256(`${prevHash}|${canonical}`);
    assert.strictEqual(eventHash, expected);
  });

  it('3. Blockchain Event Service: Creates sequential chained events with distinct file & event hashes', async () => {
    const testCaseId = `CASE-TEST-${Date.now()}`;

    // Event 1: DOCUMENT_UPLOADED with raw fileHash
    const rawFileBytes = Buffer.from('Official Maharashtra FIR Test Document Scan Bytes');
    const fileHash = sha256(rawFileBytes);

    const ev1 = await blockchainEventService.createBlockchainEvent({
      caseId: testCaseId,
      entityId: `FIR-DOC-${Date.now()}`,
      entityType: 'DOCUMENT',
      action: 'DOCUMENT_UPLOADED',
      actorId: 'MH-POL-TEST',
      actorName: 'Testing Officer',
      fileHash: fileHash,
      metadata: { fileName: 'fir_scan.pdf', fileSize: rawFileBytes.length }
    });

    assert.strictEqual(ev1.action, 'DOCUMENT_UPLOADED');
    assert.strictEqual(ev1.fileHash, fileHash);
    assert.notStrictEqual(ev1.eventHash, fileHash, 'File content hash and event block hash must be separate cryptographic hashes');
    assert.strictEqual(ev1.eventHash.length, 64);

    // Event 2: CASE_CREATED chained to Event 1
    const ev2 = await blockchainEventService.createBlockchainEvent({
      caseId: testCaseId,
      entityId: testCaseId,
      entityType: 'CASE',
      action: 'CASE_CREATED',
      actorId: 'MH-POL-TEST',
      actorName: 'Testing Officer',
      metadata: { firNumber: 'FIR/TEST/2026/01', crimeType: 'Investigation' }
    });

    assert.strictEqual(ev2.action, 'CASE_CREATED');
    assert.strictEqual(ev2.previousHash, ev1.eventHash, 'Event 2 previousHash must strictly equal Event 1 eventHash');

    // Event 3: EVIDENCE_CREATED chained to Event 2
    const ev3 = await blockchainEventService.createBlockchainEvent({
      caseId: testCaseId,
      entityId: `EVD-${Date.now()}`,
      entityType: 'EVIDENCE',
      action: 'EVIDENCE_CREATED',
      actorId: 'MH-POL-TEST',
      actorName: 'Testing Officer',
      fileHash: sha256('Evidence digital payload'),
      metadata: { evidenceTag: 'TAG-TEST-001', category: 'Digital Storage' }
    });

    assert.strictEqual(ev3.action, 'EVIDENCE_CREATED');
    assert.strictEqual(ev3.previousHash, ev2.eventHash, 'Event 3 previousHash must strictly equal Event 2 eventHash');
  });

  it('4. Chain Verification: Full chain integrity check passes with 100% fidelity', async () => {
    const report = await blockchainEventService.verifyEventChainIntegrity();

    assert.strictEqual(report.isIntact, true, 'Blockchain event chain must be intact');
    assert.ok(report.totalEvents >= 3, 'Must have recorded test events');
    assert.ok(report.details.includes('100% SHA-256 mathematical fidelity'));
  });

  it('5. Tamper-Evident Guard: Any altered block breaks mathematical verification', async () => {
    const events = blockchainEventService.getAllEvents();
    assert.ok(events.length >= 2);

    // Deep clone events and tamper with the latest event action
    const tamperedEvents = JSON.parse(JSON.stringify(events));
    tamperedEvents[tamperedEvents.length - 1].action = 'UNAUTHORIZED_MUTATION';

    const tamperedReport = blockchainEventService.verifyEventChainIntegrity(tamperedEvents);
    assert.strictEqual(tamperedReport.isIntact, false, 'Tampered block must fail cryptographic verification');
    assert.strictEqual(tamperedReport.brokenLinkIndex, tamperedEvents.length - 1);
    assert.ok(tamperedReport.details.includes('Data Tampering Detected'));

    // Untampered chain remains intact
    const originalReport = blockchainEventService.verifyEventChainIntegrity();
    assert.strictEqual(originalReport.isIntact, true);
  });
});
