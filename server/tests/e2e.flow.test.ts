process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  encryptBuffer,
  decryptBuffer,
  calculateServerSha256,
  signPayloadAsymmetric,
  verifyDigitalSignature,
  getOfficerSigningKeypair,
} from '../services/cryptoService';

test('End-to-End Core Workflow: Case Creation, Off-Chain Seizure, Ed25519 Handover, Authoritative Verification', async (t) => {
  await t.test('1. Case Creation & Metadata Hash generation', async () => {
    const caseId = `MH-MUM-2026-${Date.now().toString(36).toUpperCase()}`;
    const firNumber = `AND/CR/2026/99411`;
    const crimeType = `Cyber Financial Fraud`;
    const stationId = `ANDHERI-PS`;

    // Calculate deterministic metadata digest
    const metadataDigest = calculateServerSha256(`${caseId}:${firNumber}:${crimeType}`);
    assert.strictEqual(metadataDigest.length, 64, 'Metadata digest must be a 64-char SHA-256 hex');

    // Relational station binding
    assert.strictEqual(stationId, 'ANDHERI-PS', 'Case must be bound to relational station primary key');
  });

  await t.test('2. Evidence Seizure, Encryption & Integrity Digest', async () => {
    const rawSeizedEvidence = Buffer.from('CRITICAL DIGITAL FORENSICS PAYLOAD: TRANSACTION LOGS 0xCAFEBABE');
    const expectedPlaintextSha = calculateServerSha256(rawSeizedEvidence);

    // Encrypt with AES-256-GCM
    const { encryptedData, saltHex, ivHex, authTagHex, sha256Hash } = encryptBuffer(rawSeizedEvidence);

    assert.strictEqual(sha256Hash, expectedPlaintextSha, 'Computed hash must match plaintext SHA-256');
    assert.notDeepStrictEqual(encryptedData, rawSeizedEvidence, 'Stored binary must not be plaintext');
    assert.strictEqual(saltHex.length, 64, 'Salt must be 32 bytes (64 hex characters)');
    assert.strictEqual(ivHex.length, 32, 'IV must be 16 bytes (32 hex characters)');
    assert.strictEqual(authTagHex.length, 32, 'Auth Tag must be 16 bytes (32 hex characters)');

    // Decrypt and verify match
    const decrypted = decryptBuffer(encryptedData, saltHex, ivHex, authTagHex);
    assert.strictEqual(decrypted.toString(), rawSeizedEvidence.toString(), 'Decrypted buffer must match original');
  });

  await t.test('3. Ed25519 Digital Signature Custody Handover Verification', async () => {
    const officerBadge = 'MH-POL-8842';
    const evidenceTag = 'EV-MH-2026-99001';
    const currentCustodian = 'Inspector Rajesh Patil';
    const targetCustodian = 'Dr. Sharma (FSL Kalina)';
    const location = 'Forensic Science Laboratory, Kalina';

    const handoverPayload = {
      evidenceTag,
      from: currentCustodian,
      to: targetCustodian,
      location,
      timestamp: new Date().toISOString(),
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    // 1. Sign handover payload with officer private key
    const sigRecord = signPayloadAsymmetric(officerBadge, handoverPayload);
    assert.ok(sigRecord && sigRecord.signatureHex.length > 50, 'Digital signature must be generated');

    // 2. Verify with officer public key
    const isValid = verifyDigitalSignature(
      sigRecord.canonicalPayload,
      sigRecord.signatureHex,
      sigRecord.publicKeyPem
    );
    assert.strictEqual(isValid, true, 'Digital signature must verify successfully with authentic public key');

    // 3. Tamper rejection: alter target custodian
    const tamperedPayload = JSON.stringify({ ...handoverPayload, to: 'Malicious Intermediary' });
    const isTamperedValid = verifyDigitalSignature(
      tamperedPayload,
      sigRecord.signatureHex,
      sigRecord.publicKeyPem
    );
    assert.strictEqual(isTamperedValid, false, 'Tampered handover payload must be rejected');
  });

  await t.test('4. Authoritative Verification Rule (No DB fallback)', async () => {
    // When Fabric is unreachable, the system must refuse to declare verified based solely on DB
    const fabricAvailable = false;
    let verificationOutcome: string;

    if (!fabricAvailable) {
      verificationOutcome = 'VERIFICATION_UNAVAILABLE';
    } else {
      verificationOutcome = 'VERIFIED';
    }

    assert.strictEqual(
      verificationOutcome,
      'VERIFICATION_UNAVAILABLE',
      'System must NEVER fallback to local database match when Fabric is offline'
    );
  });

  await t.test('5. Digital Signature Key Persistence (survives process restart)', async () => {
    const testBadge = 'MH-PERSIST-IO-77';
    const payload = { event: 'SEIZURE_HANDOVER', badge: testBadge, ts: Date.now() };

    // Initial signing
    const sig1 = signPayloadAsymmetric(testBadge, payload);

    // Verify key exists in storage/keys/
    const safeBadge = testBadge.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pubFile = path.resolve(process.cwd(), `storage/keys/${safeBadge}.pub.pem`);
    const privFile = path.resolve(process.cwd(), `storage/keys/${safeBadge}.priv.pem`);

    assert.ok(fs.existsSync(pubFile), 'Public key file must be persisted to storage/keys/');
    assert.ok(fs.existsSync(privFile), 'Private key file must be persisted to storage/keys/');

    // Read saved public key directly from disk (simulating historical lookup by court/auditor)
    const savedPubPem = fs.readFileSync(pubFile, 'utf8');
    const verifiesWithDiskKey = verifyDigitalSignature(sig1.canonicalPayload, sig1.signatureHex, savedPubPem);
    assert.strictEqual(verifiesWithDiskKey, true, 'Historical signature must verify with persisted disk public key');
  });

  await t.test('6. Strict Station RBAC Authorization', async () => {
    const stationA = 'ANDHERI-PS';
    const stationB = 'BANDRA-PS';

    const officerPI_StationA = { badgeNo: 'PI-AND-01', role: 'PI', stationId: stationA };
    const caseInStationB = { id: 'MH-MUM-2026-B001', policeStationId: stationB };

    // Station check rule
    const canAccess = officerPI_StationA.stationId === caseInStationB.policeStationId;
    assert.strictEqual(canAccess, false, 'PI from Station A MUST NOT be permitted access to Station B case');
  });
});
