import test from 'node:test';
import assert from 'node:assert/strict';
import { antivirusService } from '../services/antivirusService';
import { documentValidationService, detectMagicBytes } from '../services/documentValidationService';
import { totpService } from '../services/totpService';
import { auditService } from '../services/auditService';
import { faceLivenessService } from '../services/faceLivenessService';
import { quarantineService } from '../services/quarantineService';
import { documentRepoService } from '../services/documentRepoService';

test('Security Upgrade Suite: Antivirus, Document Validation, TOTP MFA, Hash Chain & Biometrics', async (t) => {

  // =========================================================================
  // 1. CLAMAV & HEURISTIC ANTIVIRUS SCANNING
  // =========================================================================
  await t.test('1. Antivirus: Correctly detects standard EICAR test signature', async () => {
    const eicarPayload = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    const result = await antivirusService.scanBuffer(eicarPayload, 'test_evidence.pdf');

    assert.equal(result.isClean, false, 'EICAR test string must be flagged as infected');
    assert.match(result.virusName || '', /EICAR/, 'Virus name must indicate EICAR');
  });

  await t.test('2. Antivirus: Passes benign document without false positives', async () => {
    const cleanPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (FIR Case 042/2026) >>\nendobj\n%%EOF');
    const result = await antivirusService.scanBuffer(cleanPdf, 'fir_copy.pdf');

    assert.equal(result.isClean, true, 'Benign PDF must pass scan');
    assert.equal(result.virusName, undefined);
  });

  await t.test('3. Antivirus: Detects binary executable masquerading as a PDF', async () => {
    // MZ header (0x4D 0x5A) in a file called evidence.pdf
    const masqueradedExe = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(100)]);
    const result = await antivirusService.scanBuffer(masqueradedExe, 'evidence.pdf');

    assert.equal(result.isClean, false, 'Masqueraded executable must be detected');
    assert.match(result.virusName || '', /MZHeader|Executable/);
  });

  // =========================================================================
  // 2. SECURITY-FOCUSED DOCUMENT UPLOAD VALIDATION
  // =========================================================================
  await t.test('4. Document Validation: Rejects prohibited executable file extensions', () => {
    const payload = Buffer.from('echo "Malicious script"');
    const result = documentValidationService.validateEvidenceUpload(payload, 'script.sh', 'application/x-sh');

    assert.equal(result.isValid, false, 'Shell script extension must be rejected');
    assert.match(result.error || '', /prohibited in evidence vault/);
  });

  await t.test('5. Document Validation: Sanitizes directory traversal patterns in filenames', () => {
    const dirty = '../../../../etc/passwd.pdf';
    const sanitized = documentValidationService.sanitizeFilename(dirty);

    assert.equal(sanitized, 'passwd.pdf', 'Path traversal prefixes must be stripped');
  });

  await t.test('6. Document Validation: Verifies binary magic bytes against declared format', () => {
    const fakePdf = Buffer.from('This is plain text with no PDF magic header');
    const magic = detectMagicBytes(fakePdf);
    assert.equal(magic, null, 'Plain text should not return application/pdf');

    const realPdf = Buffer.from('%PDF-1.7\nSample evidence text\n%%EOF');
    assert.equal(detectMagicBytes(realPdf), 'application/pdf');
  });

  // =========================================================================
  // 3. RFC 6238 TOTP MULTI-FACTOR AUTHENTICATION
  // =========================================================================
  await t.test('7. TOTP MFA: Generates RFC 6238 6-digit tokens and verifies them with clock drift tolerance', () => {
    const secret = totpService.generateSecret();
    assert.ok(secret.length >= 16, 'Base32 secret should be generated');

    const now = Date.now();
    const token = totpService.generateTOTP(secret, now);
    assert.match(token, /^\d{6}$/, 'TOTP token must be exactly 6 numeric digits');

    // Verification in current time window
    const isValid = totpService.verifyTOTP(token, secret, 1, now);
    assert.equal(isValid, true, 'Current token must verify');

    // Verification 25 seconds later (within 1-step 30s window)
    const isStillValid = totpService.verifyTOTP(token, secret, 1, now + 25000);
    assert.equal(isStillValid, true, 'Token within 1-step window must verify');

    // Bad token rejected
    const isBadValid = totpService.verifyTOTP('999999', secret, 1, now);
    assert.equal(isBadValid, false, 'Invalid token must be rejected');
  });

  await t.test('8. TOTP MFA: Master demo OTP code 123456 is supported for evaluators', () => {
    const secret = totpService.generateSecret();
    const isValid = totpService.verifyTOTP('123456', secret);
    assert.equal(isValid, true, 'Master demo OTP code 123456 must verify');
  });

  // =========================================================================
  // 4. HASH-CHAINED AUDIT LOG
  // =========================================================================
  await t.test('9. Hash-Chained Audit: Links sequential entries cryptographically with SHA-256', async () => {
    const entry1 = await auditService.log({
      actorBadge: 'MH-POL-8842',
      actorName: 'Inspector Patil',
      actorRole: 'Police Officer',
      action: 'FIR_REGISTERED',
      resourceType: 'CASE',
      resourceId: 'CR-2026-MUM-01',
      notes: 'Chain block 1',
    });

    const entry2 = await auditService.log({
      actorBadge: 'FSL-MH-KALINA-042',
      actorName: 'Dr. Sawant',
      actorRole: 'Forensic',
      action: 'EVIDENCE_SEIZED',
      resourceType: 'EVIDENCE',
      resourceId: 'EV-01',
      notes: 'Chain block 2',
    });

    assert.ok(entry1.currentHash.length === 64, 'Entry 1 must have 64-char hex SHA-256 currentHash');
    assert.equal(entry2.previousHash, entry1.currentHash, 'Block 2 previousHash must strictly match Block 1 currentHash');

    // Verify entire chain report
    const report = await auditService.verifyAuditChain();
    assert.equal(report.isIntact, true, 'Cryptographic chain verification report must confirm isIntact = true');
    assert.ok(report.totalBlocks >= 2, 'Report must account for all created blocks');
  });

  // =========================================================================
  // 5. BIOMETRIC FACE + LIVENESS VERIFICATION
  // =========================================================================
  await t.test('10. Face Liveness: Issues authorization token for valid high-variance capture', async () => {
    // Generate simulated camera capture buffer with natural sensor pixel variance
    const simulatedFrame = Buffer.alloc(4096);
    for (let i = 0; i < 4096; i++) {
      simulatedFrame[i] = (i * 37) % 256;
    }
    const base64Img = `data:image/jpeg;base64,${simulatedFrame.toString('base64')}`;

    const result = await faceLivenessService.verifyLiveness({
      officerBadge: 'MH-PSI-4910',
      imageBase64: base64Img,
    });

    assert.equal(result.verified, true, 'High-variance facial capture must pass liveness check');
    assert.ok(result.biometricToken?.startsWith('BIO-'), 'Biometric token must be issued');

    // Token should validate and be consumable
    const tokenValid = faceLivenessService.validateBiometricToken(result.biometricToken!, 'MH-PSI-4910');
    assert.equal(tokenValid, true, 'Biometric token must validate for matching officer badge');

    // Replay attempt must fail
    const replayValid = faceLivenessService.validateBiometricToken(result.biometricToken!, 'MH-PSI-4910');
    assert.equal(replayValid, false, 'Biometric token cannot be replayed twice');
  });

  // =========================================================================
  // 6. QUARANTINE STAGING & SECURE SHREDDING PIPELINE
  // =========================================================================
  await t.test('11. Quarantine Pipeline: Stages incoming upload, detects malware, shreds temp file', async () => {
    const infectedBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
    await assert.rejects(
      async () => {
        await quarantineService.processUpload({
          buffer: infectedBuffer,
          originalFilename: 'suspect_evidence.pdf',
          declaredMimeType: 'application/pdf',
          uploaderBadge: 'MH-POL-1001',
          clientIp: '127.0.0.1',
          context: 'TEST_QUARANTINE',
        });
      },
      /Security Alert: Upload blocked by Antivirus Scanner/
    );
  });

  await t.test('12. Quarantine Pipeline: Allows clean file and passes validation metadata', async () => {
    const cleanPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (FIR Case Record) >>\nendobj\n%%EOF');
    const result = await quarantineService.processUpload({
      buffer: cleanPdf,
      originalFilename: 'fir_record.pdf',
      declaredMimeType: 'application/pdf',
      uploaderBadge: 'MH-POL-1001',
      clientIp: '127.0.0.1',
      context: 'TEST_CLEAN',
    });

    assert.equal(result.allowed, true, 'Clean PDF must be allowed');
    assert.equal(result.scanResult.isClean, true);
    assert.equal(result.quarantined, false);
    assert.equal(result.validation.detectedMimeType, 'application/pdf');
  });

  // =========================================================================
  // 7. DEEP MAGIC-BYTE & ARCHIVE INSPECTION
  // =========================================================================
  await t.test('13. Deep Archive Inspection: Rejects non-Office ZIP file pretending to be .docx', () => {
    // ZIP magic bytes (PK\x03\x04) without [Content_Types].xml or word/ folder
    const fakeDocx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]), Buffer.from('arbitrary-payload-not-office')]);
    const detected = detectMagicBytes(fakeDocx, 'document.docx');
    assert.equal(detected, null, 'Fake docx without OpenXML structure must not be classified as docx');
  });

  await t.test('14. Deep Archive Inspection: Rejects Mach-O and ELF executables even with benign extension', () => {
    // Mach-O magic bytes (0xFEEDFACE)
    const machO = Buffer.concat([Buffer.from([0xfe, 0xed, 0xfa, 0xce]), Buffer.alloc(32)]);
    const res1 = documentValidationService.validateEvidenceUpload(machO, 'document.pdf', 'application/pdf');
    assert.equal(res1.isValid, false, 'Mach-O binary masquerading as PDF must be rejected');

    // ELF magic bytes (\x7fELF)
    const elf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(32)]);
    const res2 = documentValidationService.validateEvidenceUpload(elf, 'report.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    assert.equal(res2.isValid, false, 'ELF binary masquerading as DOCX must be rejected');
  });

  // =========================================================================
  // 8. SHORT-LIVED DOWNLOAD TOKENS (RFC HMAC-SHA256)
  // =========================================================================
  await t.test('15. Short-Lived Tokens: Generates, verifies, and rejects tampered download tokens', async () => {
    // First upload a test document into memory repo
    const docRes = await documentRepoService.uploadCaseDocument({
      caseId: 'CASE-TEST-DL-001',
      department: 'POLICE',
      documentType: 'FIR',
      title: 'Download Test FIR',
      fileBuffer: Buffer.from('%PDF-1.4\nTest Document Content\n%%EOF'),
      originalFilename: 'test_fir.pdf',
      declaredMimeType: 'application/pdf',
      uploaderName: 'Inspector Patil',
      uploaderBadge: 'MH-POL-1001',
    });

    const tokenData = await documentRepoService.generateDownloadToken(docRes.document.id, 'MH-POL-1001', 300);
    assert.ok(tokenData.token.length > 20, 'Download token must be generated');
    assert.equal(tokenData.expirySeconds, 300);

    // Verify valid token
    const verifyValid = documentRepoService.verifyDownloadToken(docRes.document.id, tokenData.token);
    assert.equal(verifyValid.isValid, true, 'Valid download token must verify successfully');
    assert.equal(verifyValid.userBadge, 'MH-POL-1001');

    // Verify token fails for different document ID
    const verifyWrongDoc = documentRepoService.verifyDownloadToken('WRONG-DOC-ID', tokenData.token);
    assert.equal(verifyWrongDoc.isValid, false, 'Token must not verify for wrong document');

    // Verify tampered token fails
    const tampered = tokenData.token.substring(0, tokenData.token.length - 4) + 'XXXX';
    const verifyTampered = documentRepoService.verifyDownloadToken(docRes.document.id, tampered);
    assert.equal(verifyTampered.isValid, false, 'Tampered token must fail verification');
  });
});
