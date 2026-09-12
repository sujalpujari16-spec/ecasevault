import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { documentValidationService } from '../services/documentValidationService.js';
import { antivirusService } from '../services/antivirusService.js';
import { cryptoService } from '../services/cryptoService.js';
import { auditService } from '../services/auditService.js';
import { documentRepoService } from '../services/documentRepoService.js';
import { canUploadForDepartment, canVerifyIntegrity, canCreateCase, normaliseRole } from '../../src/utils/policeWorkflow.js';
import type { PoliceRole, RepoDepartment } from '../../src/types.js';

describe('5-Stakeholder Roles & Case Repository Architecture Suite', () => {

  describe('1. Stakeholder Roles & Normalization', () => {
    test('Canonical 5 roles are properly defined and recognized', () => {
      const canonicalRoles: PoliceRole[] = ['POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'];
      canonicalRoles.forEach(role => {
        assert.equal(normaliseRole(role), role);
      });
    });

    test('Legacy rank aliases map cleanly to canonical POLICE role', () => {
      const legacyPoliceRanks = ['SP', 'DySP', 'PI', 'PSI', 'IO', 'OFFICER', 'CONSTABLE', 'INVESTIGATOR'];
      legacyPoliceRanks.forEach(rank => {
        assert.equal(normaliseRole(rank), 'POLICE', `Rank ${rank} should map to POLICE`);
      });
      assert.equal(normaliseRole('SUPERVISOR'), 'ADMIN');
    });

    test('Departmental upload authorization enforces strict isolation', () => {
      // POLICE can only upload to POLICE department
      assert.equal(canUploadForDepartment('POLICE', 'POLICE'), true);
      assert.equal(canUploadForDepartment('POLICE', 'FORENSIC'), false);
      assert.equal(canUploadForDepartment('POLICE', 'LEGAL'), false);

      // FORENSIC can only upload to FORENSIC department
      assert.equal(canUploadForDepartment('FORENSIC', 'FORENSIC'), true);
      assert.equal(canUploadForDepartment('FORENSIC', 'POLICE'), false);
      assert.equal(canUploadForDepartment('FORENSIC', 'LEGAL'), false);

      // LEGAL can only upload to LEGAL department
      assert.equal(canUploadForDepartment('LEGAL', 'LEGAL'), true);
      assert.equal(canUploadForDepartment('LEGAL', 'POLICE'), false);
      assert.equal(canUploadForDepartment('LEGAL', 'FORENSIC'), false);

      // AUDITOR and ADMIN cannot upload case documents
      const departments: RepoDepartment[] = ['POLICE', 'FORENSIC', 'LEGAL'];
      departments.forEach(dept => {
        assert.equal(canUploadForDepartment('AUDITOR', dept), false, `AUDITOR should not upload to ${dept}`);
        assert.equal(canUploadForDepartment('ADMIN', dept), false, `ADMIN should not upload to ${dept}`);
      });
    });

    test('Auditor and Stakeholder inspection capabilities', () => {
      // All 5 roles can inspect cryptographic integrity
      assert.equal(canVerifyIntegrity('AUDITOR'), true);
      assert.equal(canVerifyIntegrity('POLICE'), true);
      assert.equal(canVerifyIntegrity('FORENSIC'), true);
      assert.equal(canVerifyIntegrity('LEGAL'), true);
      assert.equal(canVerifyIntegrity('ADMIN'), true);

      // Only POLICE can initiate FIR/Case creation
      assert.equal(canCreateCase('POLICE'), true);
      assert.equal(canCreateCase('FORENSIC'), false);
      assert.equal(canCreateCase('LEGAL'), false);
      assert.equal(canCreateCase('AUDITOR'), false);
    });
  });

  describe('2. Document Security Pipeline (Validation, Antivirus, Crypto)', () => {
    test('Magic byte validation verifies genuine file signatures and rejects fraudulent files', () => {
      // Genuine PDF header
      const validPdfBuffer = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('Mock PDF Content')]);
      const validCheck = documentValidationService.validateFile(validPdfBuffer, 'fir_report.pdf', 'application/pdf');
      assert.equal(validCheck.isValid, true);
      assert.equal(validCheck.detectedMimeType, 'application/pdf');

      // Fraudulent file (PNG extension but PDF header)
      const fraudCheck = documentValidationService.validateFile(validPdfBuffer, 'photo.png', 'image/png');
      assert.equal(fraudCheck.isValid, false);
      assert.ok(fraudCheck.error?.includes('Spoofing') || fraudCheck.error?.includes('Mismatch'));

      // Path traversal rejection
      const traversalCheck = documentValidationService.validateFile(validPdfBuffer, '../../../etc/passwd.pdf', 'application/pdf');
      assert.equal(traversalCheck.isValid, false);
      assert.ok(traversalCheck.error?.includes('Path traversal'));

      // Dangerous double extension rejection
      const doubleExtCheck = documentValidationService.validateFile(validPdfBuffer, 'report.php.pdf', 'application/pdf');
      assert.equal(doubleExtCheck.isValid, false);
      assert.ok(doubleExtCheck.error?.includes('dangerous'));
    });

    test('Antivirus scanner detects and isolates infected files (EICAR standard)', async () => {
      const cleanBuffer = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('Police Charge Sheet - Clean')]);
      const cleanResult = await antivirusService.scanBuffer(cleanBuffer, 'chargesheet.pdf');
      assert.equal(cleanResult.isClean, true);

      // EICAR standard test signature
      const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
      const infectedBuffer = Buffer.from(eicarString);
      const infectedResult = await antivirusService.scanBuffer(infectedBuffer, 'infected.exe');
      assert.equal(infectedResult.isClean, false);
      assert.ok(infectedResult.virusName?.includes('EICAR') || infectedResult.details?.includes('Infected'));
    });

    test('AES-256-GCM encryption & Ed25519 digital signatures ensure authenticity and privacy', () => {
      const plainText = 'Strictly Confidential State Forensic DNA Profiling Report';
      const key = cryptoService.generateEncryptionKey();

      // Encryption & Decryption
      const encrypted = cryptoService.encryptDocument(plainText, key);
      assert.ok(encrypted.cipherText.length > 0);
      assert.ok(encrypted.iv.length > 0);
      assert.ok(encrypted.authTag.length > 0);

      const decrypted = cryptoService.decryptDocument(encrypted.cipherText, key, encrypted.iv, encrypted.authTag);
      assert.equal(decrypted.toString('utf-8'), plainText);

      // Ed25519 asymmetric signature
      const keypair = cryptoService.generateEd25519KeyPair();
      const digest = cryptoService.calculateSHA256(plainText);
      const signature = cryptoService.signDigest(digest, keypair.privateKey);

      const isSignatureValid = cryptoService.verifySignature(digest, signature, keypair.publicKey);
      assert.equal(isSignatureValid, true, 'Valid signature should verify with public key');

      // Tampered digest check
      const tamperedDigest = cryptoService.calculateSHA256(plainText + ' [TAMPERED]');
      const isTamperedValid = cryptoService.verifySignature(tamperedDigest, signature, keypair.publicKey);
      assert.equal(isTamperedValid, false, 'Tampered digest must fail signature verification');
    });
  });

  describe('3. Case Repository End-to-End Docket Lifecycle', () => {
    const TEST_CASE_ID = 'CR-2026-STAKEHOLDER-TEST-001';
    const TEST_FIR_NO = 'FIR-TEST-MUMBAI-001';

    test('Stakeholders can store versioned documents in shared Case Repository', async () => {
      const pdfContent = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('Official Initial FIR Registration Memo')]);

      // 1. POLICE uploads Initial FIR
      const policeDoc = await documentRepoService.storeDocument({
        caseId: TEST_CASE_ID,
        firNumber: TEST_FIR_NO,
        department: 'POLICE',
        documentType: 'FIR',
        title: 'Primary Registered FIR Docket',
        description: 'First Information Report lodged at Station',
        uploadedBy: 'Officer Patil',
        uploaderBadge: 'MH-POL-01',
        uploaderRole: 'POLICE',
        station: 'ANDHERI-PS',
        fileBuffer: pdfContent,
        originalFilename: 'fir_record.pdf',
        mimeType: 'application/pdf',
      });

      assert.ok(policeDoc.id);
      assert.equal(policeDoc.caseId, TEST_CASE_ID);
      assert.equal(policeDoc.department, 'POLICE');
      assert.equal(policeDoc.version, 1);
      assert.equal(policeDoc.clamavStatus, 'CLEAN');
      assert.ok(policeDoc.sha256Hash.length === 64);
      assert.ok(policeDoc.digitalSignature.length > 20);

      // 2. FORENSIC uploads Toxicology Report to same Case Repository
      const forensicContent = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('Forensic Chemistry Analysis - No Toxins Found')]);
      const forensicDoc = await documentRepoService.storeDocument({
        caseId: TEST_CASE_ID,
        firNumber: TEST_FIR_NO,
        department: 'FORENSIC',
        documentType: 'FSL_REPORT',
        title: 'Toxicology & Chemical Analysis Report',
        description: 'FSL Kalina certified examination',
        uploadedBy: 'Dr. Shinde',
        uploaderBadge: 'FSL-MUM-892',
        uploaderRole: 'FORENSIC',
        station: 'FSL-KALINA',
        fileBuffer: forensicContent,
        originalFilename: 'fsl_report.pdf',
        mimeType: 'application/pdf',
      });

      assert.equal(forensicDoc.caseId, TEST_CASE_ID);
      assert.equal(forensicDoc.department, 'FORENSIC');
      assert.equal(forensicDoc.version, 1);

      // 3. Document Repository lists all documents for the shared FIR
      const allDocs = documentRepoService.getDocumentsByCase(TEST_CASE_ID);
      assert.ok(allDocs.length >= 2, 'Shared repository should hold both POLICE and FORENSIC docket documents');

      const policeDeptDocs = documentRepoService.getDocumentsByCase(TEST_CASE_ID, 'POLICE');
      assert.equal(policeDeptDocs.length, 1);
      assert.equal(policeDeptDocs[0].department, 'POLICE');

      const forensicDeptDocs = documentRepoService.getDocumentsByCase(TEST_CASE_ID, 'FORENSIC');
      assert.equal(forensicDeptDocs.length, 1);
      assert.equal(forensicDeptDocs[0].department, 'FORENSIC');
    });

    test('Document Repository enforces non-destructive versioning (v1 -> v2) with previousVersionHash', async () => {
      const v1Content = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('Seizure Memo Draft v1')]);
      const v2Content = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('Seizure Memo Final v2 with Panchas Signature')]);

      const docV1 = await documentRepoService.storeDocument({
        caseId: TEST_CASE_ID,
        firNumber: TEST_FIR_NO,
        department: 'POLICE',
        documentType: 'SEIZURE_MEMO',
        title: 'Spot Seizure Memo of Weapon',
        description: 'Draft Memo',
        uploadedBy: 'IO Shinde',
        uploaderBadge: 'MH-POL-02',
        uploaderRole: 'POLICE',
        station: 'ANDHERI-PS',
        fileBuffer: v1Content,
        originalFilename: 'seizure_memo.pdf',
        mimeType: 'application/pdf',
      });
      assert.equal(docV1.version, 1);

      // Upload version 2 with same title and documentType
      const docV2 = await documentRepoService.storeDocument({
        caseId: TEST_CASE_ID,
        firNumber: TEST_FIR_NO,
        department: 'POLICE',
        documentType: 'SEIZURE_MEMO',
        title: 'Spot Seizure Memo of Weapon',
        description: 'Final version with Panch signatures',
        uploadedBy: 'IO Shinde',
        uploaderBadge: 'MH-POL-02',
        uploaderRole: 'POLICE',
        station: 'ANDHERI-PS',
        fileBuffer: v2Content,
        originalFilename: 'seizure_memo_final.pdf',
        mimeType: 'application/pdf',
      });

      assert.equal(docV2.version, 2, 'Second upload must automatically increment version to v2');
      assert.equal(docV2.previousVersionHash, docV1.sha256Hash, 'v2 must record cryptographic hash of v1');

      // Both versions remain accessible and intact in the repository
      const v1Retrieved = documentRepoService.getDocumentById(docV1.id);
      const v2Retrieved = documentRepoService.getDocumentById(docV2.id);
      assert.ok(v1Retrieved);
      assert.ok(v2Retrieved);
      assert.notEqual(v1Retrieved?.sha256Hash, v2Retrieved?.sha256Hash);
    });

    test('Cryptographic integrity verification validates SHA-256 and Ed25519 signature', async () => {
      const content = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.from('Bail Hearing Opposition Affidavit')]);

      const legalDoc = await documentRepoService.storeDocument({
        caseId: TEST_CASE_ID,
        firNumber: TEST_FIR_NO,
        department: 'LEGAL',
        documentType: 'COURT_ORDER',
        title: 'Public Prosecutor Bail Opposition Submission',
        description: 'Filed before Sessions Court',
        uploadedBy: 'Adv. Deshmukh',
        uploaderBadge: 'MH-BAR-5541',
        uploaderRole: 'LEGAL',
        station: 'SESSIONS-COURT-MUMBAI',
        fileBuffer: content,
        originalFilename: 'bail_opposition.pdf',
        mimeType: 'application/pdf',
      });

      const verification = await documentRepoService.verifyDocumentIntegrity(legalDoc.id);
      assert.equal(verification.isValid, true);
      assert.equal(verification.sha256Match, true);
      assert.equal(verification.signatureValid, true);
      assert.equal(verification.details.department, 'LEGAL');
    });

    test('Infected document upload is immediately quarantined and blocked from Case Repository', async () => {
      const eicarBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');

      await assert.rejects(
        async () => {
          await documentRepoService.storeDocument({
            caseId: TEST_CASE_ID,
            firNumber: TEST_FIR_NO,
            department: 'POLICE',
            documentType: 'CASE_DIARY',
            title: 'Infected Note',
            description: 'Malware test',
            uploadedBy: 'Hacker',
            uploaderBadge: 'MALWARE-01',
            uploaderRole: 'POLICE',
            station: 'ANDHERI-PS',
            fileBuffer: eicarBuffer,
            originalFilename: 'note.pdf',
            mimeType: 'application/pdf',
          });
        },
        /Security Alert: Upload blocked by Antivirus Scanner/
      );
    });

    test('Hash-chained audit log maintains cryptographic tamper resistance', async () => {
      const log1 = await auditService.recordEvent({
        action: 'CASE_REPOSITORY_INIT',
        performedBy: 'MH-POL-01',
        role: 'POLICE',
        details: { caseId: TEST_CASE_ID, status: 'INITIALIZED' },
      });

      const log2 = await auditService.recordEvent({
        action: 'EVIDENCE_TRANSFERRED_TO_FORENSIC',
        performedBy: 'MH-POL-01',
        role: 'POLICE',
        details: { caseId: TEST_CASE_ID, destination: 'FSL-KALINA' },
      });

      assert.equal(log2.prevHash, log1.hash, 'Consecutive audit entry must chain to previous entry hash');

      const chainIntegrity = await auditService.verifyChainIntegrity();
      assert.equal(chainIntegrity.isValid, true, 'Audit log hash chain must verify');
    });
  });
});
