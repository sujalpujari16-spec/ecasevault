process.env.NODE_ENV = 'test';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptBuffer,
  decryptBuffer,
  calculateServerSha256,
  signPayloadAsymmetric,
  verifyDigitalSignature,
  getOfficerSigningKeypair,
} from '../services/cryptoService';

describe('Cryptographic Engine & Asymmetric Digital Signatures', () => {
  test('AES-256-GCM encrypts and decrypts buffer with unique salt and iv', () => {
    const rawPayload = Buffer.from('CONFIDENTIAL_CASE_EVIDENCE_RECORD_2026');
    const { encryptedData, saltHex, ivHex, authTagHex, sha256Hash } = encryptBuffer(rawPayload);

    assert.ok(encryptedData.length > 0, 'Encrypted buffer should not be empty');
    assert.equal(saltHex.length, 64, 'Salt should be 32 bytes (64 hex characters)');
    assert.equal(ivHex.length, 32, 'IV should be 16 bytes (32 hex characters)');
    assert.equal(authTagHex.length, 32, 'Auth tag should be 16 bytes (32 hex characters)');

    // Verify SHA-256 of original plaintext
    const expectedHash = calculateServerSha256(rawPayload);
    assert.equal(sha256Hash, expectedHash, 'Computed hash must match calculateServerSha256');

    // Decrypt and verify matching plaintext
    const decrypted = decryptBuffer(encryptedData, saltHex, ivHex, authTagHex);
    assert.deepEqual(decrypted, rawPayload, 'Decrypted buffer must match original plaintext');
  });

  test('AES-256-GCM fails decryption if auth tag is tampered', () => {
    const rawPayload = Buffer.from('CRIME_SCENE_FORENSIC_DATA');
    const { encryptedData, saltHex, ivHex } = encryptBuffer(rawPayload);

    // Tampered auth tag
    const fakeAuthTagHex = '00'.repeat(16);

    assert.throws(() => {
      decryptBuffer(encryptedData, saltHex, ivHex, fakeAuthTagHex);
    }, /Unsupported state or unable to authenticate data|Authentication failed/);
  });

  test('Ed25519 produces genuine asymmetric digital signature and verifies authentic payload', () => {
    const officerBadge = 'MH-TEST-IO-99';
    const payload = {
      caseId: 'MH-MUM-2026-TEST01',
      evidenceTag: 'EV-MH-2026-999',
      action: 'CUSTODY_TRANSFER',
      from: 'PI Patil',
      to: 'FSL Lead Forensics',
    };

    const signatureRecord = signPayloadAsymmetric(officerBadge, payload);

    assert.equal(signatureRecord.algorithm, 'Ed25519', 'Must use genuine Ed25519 algorithm');
    assert.equal(signatureRecord.signatureHex.length, 128, 'Ed25519 signature is exactly 64 bytes (128 hex chars)');
    assert.ok(signatureRecord.publicKeyPem.includes('BEGIN PUBLIC KEY'), 'Must export valid SPKI PEM public key');

    // Verify authentic payload
    const isValid = verifyDigitalSignature(
      signatureRecord.canonicalPayload,
      signatureRecord.signatureHex,
      signatureRecord.publicKeyPem
    );
    assert.equal(isValid, true, 'Authentic Ed25519 digital signature must verify successfully');
  });

  test('Ed25519 signature verification strictly rejects tampered payload', () => {
    const officerBadge = 'MH-TEST-IO-99';
    const originalPayload = { caseId: 'CASE-01', amount: 50000 };
    const signatureRecord = signPayloadAsymmetric(officerBadge, originalPayload);

    // Tampered payload
    const tamperedPayload = JSON.stringify({ caseId: 'CASE-01', amount: 999999 });

    const isValid = verifyDigitalSignature(
      tamperedPayload,
      signatureRecord.signatureHex,
      signatureRecord.publicKeyPem
    );
    assert.equal(isValid, false, 'Signature verification must reject tampered content');
  });

  test('Ed25519 rejects verification with a different officer public key', () => {
    const officer1Badge = 'MH-OFFICER-ALPHA';
    const officer2Badge = 'MH-OFFICER-BETA';

    const sigRecord = signPayloadAsymmetric(officer1Badge, 'CONFIDENTIAL_DISPATCH');
    const officer2Keys = getOfficerSigningKeypair(officer2Badge);

    const isValid = verifyDigitalSignature(
      sigRecord.canonicalPayload,
      sigRecord.signatureHex,
      officer2Keys.publicKeyPem
    );
    assert.equal(isValid, false, 'Signature verification must reject a different officer public key');
  });
});
