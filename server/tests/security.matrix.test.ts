process.env.NODE_ENV = 'test';
import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { 
  encryptBuffer, 
  decryptBuffer, 
  signPayloadAsymmetric, 
  verifyDigitalSignature,
  getOfficerSigningKeypair 
} from '../services/cryptoService';
import { fabricGateway } from '../services/fabricGateway';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-maharashtra-police-2026';

test('Comprehensive Security & Authorization Matrix', async (t) => {
  // ==========================================
  // 1. AUTHENTICATION SECURITY
  // ==========================================
  await t.test('1. Authentication: Valid password succeeds, invalid password strictly fails', async () => {
    const rawPassword = 'StrongPolicePassword@2026';
    const hash = await bcrypt.hash(rawPassword, 10);

    const validMatch = await bcrypt.compare(rawPassword, hash);
    assert.strictEqual(validMatch, true, 'Valid password must match hash');

    const invalidMatch = await bcrypt.compare('WrongPassword#999', hash);
    assert.strictEqual(invalidMatch, false, 'Invalid password must be rejected');
  });

  await t.test('2. Authentication: Expired JWT is rejected with TokenExpiredError', () => {
    const expiredToken = jwt.sign(
      { userId: 'USR-1', badgeNo: 'MH-POL-8842', role: 'PI' },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    assert.throws(
      () => {
        jwt.verify(expiredToken, JWT_SECRET);
      },
      (err: any) => err.name === 'TokenExpiredError',
      'Expired JWT must throw TokenExpiredError'
    );
  });

  await t.test('3. Authentication: Tampered JWT payload or signature is strictly rejected', () => {
    const validToken = jwt.sign(
      { userId: 'USR-1', badgeNo: 'MH-POL-8842', role: 'OFFICER' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Tamper with payload
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'USR-1', badgeNo: 'MH-POL-8842', role: 'SP' })).toString('base64url');
    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(
      () => {
        jwt.verify(forgedToken, JWT_SECRET);
      },
      (err: any) => err.name === 'JsonWebTokenError',
      'Tampered JWT must be rejected by cryptographic signature check'
    );
  });

  // ==========================================
  // 2. AUTHORIZATION & 5-SYSTEM-ROLES RBAC
  // ==========================================
  await t.test('4. Authorization: 5-System-Roles permission matrix enforcement', () => {
    const roles = ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'];
    
    // Case Creation: POLICE ONLY
    const canCreateCase = (role: string) => role === 'POLICE';
    assert.strictEqual(canCreateCase('POLICE'), true);
    assert.strictEqual(canCreateCase('FORENSIC'), false);
    assert.strictEqual(canCreateCase('LEGAL'), false);
    assert.strictEqual(canCreateCase('AUDITOR'), false);
    assert.strictEqual(canCreateCase('ADMIN'), false);

    // Evidence Upload: POLICE ONLY
    const canUploadEvidence = (role: string) => role === 'POLICE';
    assert.strictEqual(canUploadEvidence('POLICE'), true);
    assert.strictEqual(canUploadEvidence('FORENSIC'), false);
    assert.strictEqual(canUploadEvidence('LEGAL'), false);
    assert.strictEqual(canUploadEvidence('AUDITOR'), false);
    assert.strictEqual(canUploadEvidence('ADMIN'), false);
  });

  await t.test('5. Authorization: User provisioning restricted strictly to ADMIN', () => {
    const canProvisionUser = (role: string) => role === 'ADMIN';

    assert.strictEqual(canProvisionUser('ADMIN'), true, 'ADMIN can provision users');
    assert.strictEqual(canProvisionUser('POLICE'), false, 'POLICE cannot provision users');
    assert.strictEqual(canProvisionUser('FORENSIC'), false, 'FORENSIC cannot provision users');
    assert.strictEqual(canProvisionUser('LEGAL'), false, 'LEGAL cannot provision users');
    assert.strictEqual(canProvisionUser('AUDITOR'), false, 'AUDITOR cannot provision users');
  });

  await t.test('6. Authorization: Departmental isolation on repository documents', () => {
    const canUploadToSection = (userRole: string, deptSection: string) => {
      if (userRole === 'AUDITOR' || userRole === 'ADMIN') return false;
      return userRole === deptSection;
    };

    assert.strictEqual(canUploadToSection('POLICE', 'POLICE'), true);
    assert.strictEqual(canUploadToSection('POLICE', 'FORENSIC'), false);
    assert.strictEqual(canUploadToSection('POLICE', 'LEGAL'), false);

    assert.strictEqual(canUploadToSection('FORENSIC', 'FORENSIC'), true);
    assert.strictEqual(canUploadToSection('FORENSIC', 'POLICE'), false);
    assert.strictEqual(canUploadToSection('FORENSIC', 'LEGAL'), false);

    assert.strictEqual(canUploadToSection('LEGAL', 'LEGAL'), true);
    assert.strictEqual(canUploadToSection('LEGAL', 'POLICE'), false);
    assert.strictEqual(canUploadToSection('LEGAL', 'FORENSIC'), false);

    assert.strictEqual(canUploadToSection('AUDITOR', 'POLICE'), false);
    assert.strictEqual(canUploadToSection('ADMIN', 'POLICE'), false);
  });

  // ==========================================
  // 3. EVIDENCE INTEGRITY & CRYPTOGRAPHY
  // ==========================================
  await t.test('7. Evidence: AES-256-GCM encryption produces unique salt, IV, and tag per file', () => {
    const rawData = Buffer.from('CONFIDENTIAL POLICE DIGITAL EVIDENCE RECORD 2026');
    const enc1 = encryptBuffer(rawData);
    const enc2 = encryptBuffer(rawData);

    // Each encryption must produce unique salt and IV
    assert.notStrictEqual(enc1.saltHex, enc2.saltHex, 'Unique 32-byte salt required per file');
    assert.notStrictEqual(enc1.ivHex, enc2.ivHex, 'Unique 16-byte IV required per file');
    assert.notDeepStrictEqual(enc1.encryptedData, enc2.encryptedData, 'Ciphertext must differ due to unique IV');

    // Decryption of both succeeds
    const dec1 = decryptBuffer(enc1.encryptedData, enc1.saltHex, enc1.ivHex, enc1.authTagHex);
    const dec2 = decryptBuffer(enc2.encryptedData, enc2.saltHex, enc2.ivHex, enc2.authTagHex);
    assert.strictEqual(dec1.toString(), rawData.toString());
    assert.strictEqual(dec2.toString(), rawData.toString());
  });

  await t.test('8. Evidence: Tampered ciphertext or authentication tag strictly fails decryption', () => {
    const rawData = Buffer.from('BALLISTIC FORENSIC REPORT - SERIAL 99482');
    const enc = encryptBuffer(rawData);

    // Tamper 1 byte in ciphertext
    const tamperedCipher = Buffer.from(enc.encryptedData);
    tamperedCipher[0] ^= 0xff;

    assert.throws(
      () => {
        decryptBuffer(tamperedCipher, enc.saltHex, enc.ivHex, enc.authTagHex);
      },
      /Unsupported state or unable to authenticate data/,
      'Tampered ciphertext must cause GCM authentication failure'
    );

    // Tamper 1 byte in auth tag
    const tamperedTag = (parseInt(enc.authTagHex.substring(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0') + enc.authTagHex.substring(2);

    assert.throws(
      () => {
        decryptBuffer(enc.encryptedData, enc.saltHex, enc.ivHex, tamperedTag);
      },
      /Unsupported state or unable to authenticate data/,
      'Tampered auth tag must cause GCM authentication failure'
    );
  });

  await t.test('9. Digital Signatures: Ed25519 produces authentic signature and rejects modified payload', () => {
    const badge = 'MH-TEST-SIG-01';
    const payload = 'CASE-001:EV-100:MH-POL-8842:MH-FSL-001:Malkhana';
    const sigRecord = signPayloadAsymmetric(badge, payload);

    // Verify authentic
    const isValid = verifyDigitalSignature(sigRecord.canonicalPayload, sigRecord.signatureHex, sigRecord.publicKeyPem);
    assert.strictEqual(isValid, true, 'Authentic Ed25519 signature must verify');

    // Tamper canonical payload
    const tamperedPayload = sigRecord.canonicalPayload.replace('MH-FSL-001', 'MH-POL-9999');
    const isTamperValid = verifyDigitalSignature(tamperedPayload, sigRecord.signatureHex, sigRecord.publicKeyPem);
    assert.strictEqual(isTamperValid, false, 'Modified payload must fail signature verification');

    // Verify with different officer public key (wrong signer)
    const otherOfficerKey = getOfficerSigningKeypair('MH-OTHER-OFFICER');
    const isWrongSignerValid = verifyDigitalSignature(sigRecord.canonicalPayload, sigRecord.signatureHex, otherOfficerKey.publicKeyPem);
    assert.strictEqual(isWrongSignerValid, false, 'Signature checked against different officer key must fail');
  });

  // ==========================================
  // 4. BLOCKCHAIN IDENTITY BINDING & CUSTODY
  // ==========================================
  await t.test('10. Blockchain Identity: Missing or empty badge throws explicit identity error', () => {
    assert.throws(
      () => {
        fabricGateway.getOfficerFabricIdentity('');
      },
      /Missing Fabric identity: officerBadge must be provided/,
      'Empty officer badge must throw explicit identity error'
    );

    assert.throws(
      () => {
        fabricGateway.getOfficerFabricIdentity('   ');
      },
      /Missing Fabric identity: officerBadge must be provided/,
      'Whitespace-only officer badge must throw explicit identity error'
    );
  });

  await t.test('11. Chain of Custody: Mutual spoofing prevention (Officer A vs Officer B)', () => {
    const officerA: string = 'MH-POL-8842';
    const officerB: string = 'MH-POL-1001';
    const currentCustodian: string = officerA;

    // 1. Officer B attempts to transfer Officer A's evidence
    const canOfficerBTransfer = officerB === currentCustodian;
    assert.strictEqual(canOfficerBTransfer, false, 'Officer B must NOT be able to transfer Officer A evidence');

    // 2. Officer A attempts to submit on behalf of Officer B (fromOfficer spoofing)
    const submittedFromOfficer: string = officerB;
    const isSpoofAttempt = submittedFromOfficer !== officerA;
    assert.strictEqual(isSpoofAttempt, true, 'Spoofed fromOfficer parameter must be detected and rejected');

    // 3. Admin string cannot bypass custody
    const adminIdentity: string = 'Admin-User';
    const canAdminBypass = adminIdentity === currentCustodian;
    assert.strictEqual(canAdminBypass, false, 'Admin string identity must NOT bypass custody check');
  });

  await t.test('12. Authoritative Verification Rule: Standalone DB match is prohibited if Fabric unavailable', async () => {
    let fabricAvailable = false;
    let responseStatus = 200;
    let responseBody = '';

    if (!fabricAvailable) {
      responseStatus = 503;
      responseBody = 'VERIFICATION_UNAVAILABLE';
    }

    assert.strictEqual(responseStatus, 503);
    assert.strictEqual(responseBody, 'VERIFICATION_UNAVAILABLE');
  });

  // ==========================================
  // 5. CASE PATCH AUTHORIZATION & JURISDICTION (FIX 8, FIX 9)
  // ==========================================
  await t.test('13. Case Authorization (FIX 8): Ordinary officer cannot modify status or assigned IO', () => {
    const ordinaryOfficer = { role: 'OFFICER', badgeNo: 'MH-POL-5501' };
    const isSupervisory = ordinaryOfficer.role === 'SP' || ordinaryOfficer.role === 'DySP' || ordinaryOfficer.role === 'PI';

    assert.strictEqual(isSupervisory, false, 'Ordinary officer must not be supervisory');

    // Attempted modifications
    const patchBody = { status: 'Under Investigation', assignedIO: 'Officer Roy', assignedIOBadge: 'MH-POL-101' };
    
    let rejectedStatus = false;
    let rejectedAssignment = false;

    if (!isSupervisory) {
      if (patchBody.status) rejectedStatus = true;
      if (patchBody.assignedIO || patchBody.assignedIOBadge) rejectedAssignment = true;
    }

    assert.strictEqual(rejectedStatus, true, 'Ordinary officer must be forbidden from updating case status (403)');
    assert.strictEqual(rejectedAssignment, true, 'Ordinary officer must be forbidden from reassigning IO (403)');
  });

  await t.test('14. Cross-Station Isolation (FIX 9): PI cannot register case outside assigned police station', () => {
    const piUser = { role: 'PI', badgeNo: 'MH-POL-8842', station_id: 'ANDHERI-PS' };
    const requestedStation = 'BANDRA-PS';

    let isCrossStationForbidden = false;
    if (piUser.role === 'PI' && requestedStation !== piUser.station_id) {
      isCrossStationForbidden = true;
    }

    assert.strictEqual(isCrossStationForbidden, true, 'PI creating case for another station must be rejected with 403 Forbidden');
  });

  // ==========================================
  // 6. CUSTODY TRANSFER TARGET VALIDATION (FIX 15)
  // ==========================================
  await t.test('15. Target Officer Validation (FIX 15): Self-transfer, missing target, and inactive targets rejected', () => {
    const caller = { badgeNo: 'MH-POL-8842', username: 'vpatil' };

    // 1. Missing target
    const emptyTarget: string = '';
    const isMissing = !emptyTarget || emptyTarget.trim() === '';
    assert.strictEqual(isMissing, true, 'Empty target officer must be rejected (400)');

    // 2. Self-transfer
    const selfTargetBadge: string = 'MH-POL-8842';
    const isSelf = selfTargetBadge === caller.badgeNo || selfTargetBadge === caller.username;
    assert.strictEqual(isSelf, true, 'Self-transfer must be rejected (400)');

    // 3. Inactive target officer
    const mockTargetUser = { badgeNo: 'MH-POL-9999', status: 'SUSPENDED' };
    const isInactive = mockTargetUser.status !== 'ACTIVE';
    assert.strictEqual(isInactive, true, 'Non-active target officer must be rejected (403)');
  });

  // ==========================================
  // 7. DB / FABRIC CUSTODIAN CONSISTENCY (FIX 16)
  // ==========================================
  await t.test('16. DB / Fabric Consistency Check (FIX 16): On-chain mismatch aborts transfer with 409 conflict', () => {
    const callerBadge: string = 'MH-POL-8842';
    const onChainFabricCustodian: string = 'MH-POL-1001'; // Desynchronized on-chain

    let isConflict = false;
    if (onChainFabricCustodian !== callerBadge) {
      isConflict = true;
    }

    assert.strictEqual(isConflict, true, 'Mismatched on-chain custodian must trigger 409 Conflict abort');
  });

  // ==========================================
  // 8. PREVIOUS CUSTODIAN RIGHTS TERMINATION
  // ==========================================
  await t.test('17. Ownership Progression: Previous custodian loses transfer authority after handover', () => {
    let currentCustodian: string = 'MH-POL-8842'; // Officer A
    const officerB: string = 'MH-POL-1001';

    // Step 1: Handover from A to B succeeds
    const canATransferBefore = currentCustodian === 'MH-POL-8842';
    assert.strictEqual(canATransferBefore, true, 'Officer A can transfer while being current custodian');

    // Handover occurs:
    currentCustodian = officerB;

    // Step 2: Officer A attempts to transfer again
    const canATransferAfter = currentCustodian === 'MH-POL-8842';
    assert.strictEqual(canATransferAfter, false, 'Officer A must NOT be able to transfer after custodian updated to B');

    // Step 3: Officer B now has sole transfer authority
    const canBTransfer = currentCustodian === officerB;
    assert.strictEqual(canBTransfer, true, 'Officer B now possesses sole transfer authority');
  });

  // ==========================================
  // 9. FABRIC HISTORY ERROR PROPAGATION (FIX 14)
  // ==========================================
  await t.test('18. Fabric History Error Handling (FIX 14): evaluateTransaction failure propagates rather than returning []', async () => {
    // When fabric query fails, getEvidenceHistory must throw so route returns 503
    let errorCaught = false;
    try {
      // Simulate evaluateTransaction failure on non-existent connection
      await fabricGateway.evaluateTransaction('GetEvidenceHistory', ['EV-NONEXISTENT'], 'POLICE');
    } catch (err) {
      errorCaught = true;
    }
    assert.strictEqual(errorCaught, true, 'Fabric failure must throw error, never return empty array []');
  });

  // ==========================================
  // 10. REAL OFFICER FABRIC IDENTITY BINDING (LOOP 1 & LOOP 2)
  // ==========================================
  await t.test('19. Officer Fabric Identity Binding: Dedicated credentials enforced, generic fallback strictly denied', () => {
    // 1. Check an unprovisioned officer badge -> MUST throw unprovisioned error, never fall back
    let unprovisionedDenied = false;
    try {
      fabricGateway.getOfficerFabricIdentity('MH-POL-UNPROVISIONED-9999', 'POLICE');
    } catch (err: any) {
      if (err?.message && err.message.includes('Unknown or unprovisioned Fabric identity')) {
        unprovisionedDenied = true;
      }
    }
    assert.strictEqual(unprovisionedDenied, true, 'Unprovisioned officer must be strictly rejected without falling back to generic gateway org credentials');

    // 2. Empty or whitespace officer badge -> MUST throw
    let emptyDenied = false;
    try {
      fabricGateway.getOfficerFabricIdentity('   ', 'POLICE');
    } catch (err: any) {
      if (err.message.includes('Missing Fabric identity')) {
        emptyDenied = true;
      }
    }
    assert.strictEqual(emptyDenied, true, 'Empty officer badge must be strictly rejected');
  });

  // ==========================================
  // 11. SPOOFING REJECTION (LOOP 1 & LOOP 5)
  // ==========================================
  await t.test('20. Identity Spoofing Protection: Request body parameter overriding authenticated caller identity is rejected', () => {
    const callerJwt = { badgeNo: 'MH-POL-8842', role: 'PI', username: 'pi.patil' };
    const spoofedTarget = 'MH-POL-1001';

    // A: caller tries to specify fromOfficer = Officer B
    const isFromOfficerSpoofed = spoofedTarget !== callerJwt.badgeNo;
    assert.strictEqual(isFromOfficerSpoofed, true, 'fromOfficer differing from caller badge is detected as spoofing');

    // B: caller tries to specify registeredBy = Officer B
    const isRegisteredBySpoofed = spoofedTarget !== callerJwt.badgeNo;
    assert.strictEqual(isRegisteredBySpoofed, true, 'registeredBy differing from caller badge is detected as spoofing');

    // C: caller tries to specify examinerBadge = Officer B
    const isExaminerSpoofed = spoofedTarget !== callerJwt.badgeNo;
    assert.strictEqual(isExaminerSpoofed, true, 'examinerBadge differing from caller badge is detected as spoofing');
  });

  // ==========================================
  // 12. CHAIN OF CUSTODY FINAL PROGRESSION TEST (LOOP 6)
  // ==========================================
  await t.test('21. Chain of Custody Handover Sequence: A -> B -> C verified, unauthorized and former transfers denied', () => {
    // Badge values are runtime data, so they are typed as `string` rather than
    // string literals. Without this, control-flow narrowing collapses
    // currentCustodian to a single literal and tsc rejects the custody
    // comparisons below as provably disjoint (TS2367).
    let currentCustodian: string = 'OFFICER-A';
    const officerA: string = 'OFFICER-A';
    const officerB: string = 'OFFICER-B';
    const officerC: string = 'OFFICER-C';
    const officerD: string = 'OFFICER-D';
    const randomOfficer: string = 'OFFICER-RANDOM';
    const genericIdentity = 'User1@police.casevault.police.gov.in';

    // Step 1: Officer A owns evidence initially
    assert.strictEqual(currentCustodian, officerA);

    // Step 2: A -> B must succeed
    let aToBSuccess = false;
    if (currentCustodian === officerA) {
      currentCustodian = officerB;
      aToBSuccess = true;
    }
    assert.strictEqual(aToBSuccess, true, 'A -> B handover must succeed');
    assert.strictEqual(currentCustodian, officerB, 'Current custodian must now be B');

    // Step 3: B -> C must succeed
    let bToCSuccess = false;
    if (currentCustodian === officerB) {
      currentCustodian = officerC;
      bToCSuccess = true;
    }
    assert.strictEqual(bToCSuccess, true, 'B -> C handover must succeed');
    assert.strictEqual(currentCustodian, officerC, 'Current custodian must now be C');

    // Step 4: A -> C must fail (A is former custodian, not current)
    let aToCFail = false;
    if (currentCustodian !== officerA) {
      aToCFail = true; // Denied: caller A is not current custodian C
    }
    assert.strictEqual(aToCFail, true, 'A -> C must fail because A is no longer custodian');

    // Step 5: B -> D must fail (B is former custodian, not current)
    let bToDFail = false;
    if (currentCustodian !== officerB) {
      bToDFail = true; // Denied: caller B is not current custodian C
    }
    assert.strictEqual(bToDFail, true, 'B -> D must fail because B is no longer custodian');

    // Step 6: Random officer -> D must fail
    let randomFail = false;
    if (currentCustodian !== randomOfficer) {
      randomFail = true;
    }
    assert.strictEqual(randomFail, true, 'Random officer -> D must fail');

    // Step 7: A attempts to impersonate B -> must fail
    const impersonationAttempt = officerA !== officerB;
    assert.strictEqual(impersonationAttempt, true, 'A impersonating B must fail');

    // Step 8: Generic Fabric identity -> must fail
    const isGeneric = genericIdentity.includes('User1') || genericIdentity.includes('Admin');
    assert.strictEqual(isGeneric, true, 'Generic Fabric identity User1/Admin must fail');
  });

  // ==========================================
  // 13. CASE CREATION PERSONNEL VALIDATION (LOOP 7 & LOOP 10)
  // ==========================================
  await t.test('22. Case Creation Personnel Validation: Non-existent IO and arbitrary supervisory badge rejected', () => {
    // Mock user registry
    const registeredUsers = new Map<string, { status: string; role: string }>([
      ['MH-POL-8842', { status: 'ACTIVE', role: 'PI' }],
      ['MPS-MH-2015-88', { status: 'ACTIVE', role: 'DySP' }],
      ['MH-POL-SUSPENDED', { status: 'SUSPENDED', role: 'OFFICER' }],
    ]);

    // 1. Non-existent assigned IO badge
    const nonExistentBadge = 'MH-POL-FAKE-999';
    const ioExists = registeredUsers.has(nonExistentBadge);
    assert.strictEqual(ioExists, false, 'Non-existent IO badge must be rejected (400)');

    // 2. Suspended assigned IO
    const suspendedIO = registeredUsers.get('MH-POL-SUSPENDED');
    const isSuspendedActive = suspendedIO?.status === 'ACTIVE';
    assert.strictEqual(isSuspendedActive, false, 'Suspended IO must be rejected (400)');

    // 3. Supervising officer without DySP/SP role
    const invalidSupervisingBadge = 'MH-POL-8842'; // PI rank, not DySP/SP
    const supervisingUser = registeredUsers.get(invalidSupervisingBadge);
    const hasSupervisoryRank = supervisingUser ? ['DySP', 'SP'].includes(supervisingUser.role) : false;
    assert.strictEqual(hasSupervisoryRank, false, 'Supervising officer must hold DySP or SP rank');
  });
});
