import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { biometricService } from '../services/biometricService';

const JWT_SECRET = process.env.JWT_SECRET || 'casevault-insecure-dev-secret-change-in-prod-min32chars';

function generateToken(role: string, badgeNo = 'MH-POL-1827', name = 'PI Vikram R. Shinde') {
  return jwt.sign(
    {
      userId: 'usr_test_bio',
      badgeNo,
      name,
      role,
      station: 'Andheri Police Station, Mumbai',
      department: 'POLICE_INVESTIGATION',
      clearanceLevel: 'SECRET'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Biometric Identity & Case Link (Candidate Matching & Privacy)', () => {
  it('1. Mandatory pre-requisites: Rejects searches missing Case ID, Purpose, or Justification', async () => {
    // Missing Case ID
    await assert.rejects(
      async () => {
        await biometricService.searchCandidates({
          officerBadge: 'MH-POL-1827',
          officerName: 'PI Vikram R. Shinde',
          caseId: '',
          purpose: 'CCTV investigation',
          justification: 'Suspect match from Bandra CCTV'
        });
      },
      /Case ID is mandatory/
    );

    // Missing Purpose
    await assert.rejects(
      async () => {
        await biometricService.searchCandidates({
          officerBadge: 'MH-POL-1827',
          officerName: 'PI Vikram R. Shinde',
          caseId: 'CR-2026-001',
          purpose: '',
          justification: 'Suspect match from Bandra CCTV'
        });
      },
      /Investigative purpose is required/
    );

    // Inadequate Justification
    await assert.rejects(
      async () => {
        await biometricService.searchCandidates({
          officerBadge: 'MH-POL-1827',
          officerName: 'PI Vikram R. Shinde',
          caseId: 'CR-2026-001',
          purpose: 'CCTV investigation',
          justification: 'test'
        });
      },
      /Written justification/
    );
  });

  it('2. Multi-Candidate Matching: Returns ranked candidates rather than forcing a single identity', async () => {
    const res = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde',
      caseId: 'CR-2026-001',
      purpose: 'CCTV investigation',
      justification: 'Surveillance camera match from Bandra jeweler armed dacoity timestamp 14:22'
    });

    assert.ok(res.searchId.startsWith('BIO-2026-'));
    assert.ok(Array.isArray(res.candidates));
    assert.ok(res.candidates.length >= 2, 'Should return multiple candidates for human officer review');

    // Assert candidates are ranked descending by similarity
    for (let i = 0; i < res.candidates.length - 1; i++) {
      assert.ok(
        res.candidates[i].similarity >= res.candidates[i + 1].similarity,
        'Candidates must be ordered descending by similarity'
      );
    }

    // Top candidate Rahul Sharma
    assert.equal(res.candidates[0].personId, 'PER-00182');
    assert.equal(res.candidates[0].name, 'Rahul Sharma');
    assert.ok(res.candidates[0].similarity > 0.90, 'Top candidate similarity should be >90%');
  });

  it('3. Statutory Witness Protection: WITNESS relationships are strictly omitted from search results', async () => {
    // Execute search
    const searchRes = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde',
      caseId: 'CR-2026-001',
      purpose: 'CCTV investigation',
      justification: 'CCTV frame facial crop matching against person registry'
    });

    // Officer explicitly confirms identity of Person PER-00182 (Rahul Sharma)
    const confirmRes = await biometricService.confirmIdentity({
      searchId: searchRes.searchId,
      personId: 'PER-00182',
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde'
    });

    assert.equal(confirmRes.confirmedPerson.id, 'PER-00182');
    assert.equal(confirmRes.confirmedPerson.name, 'Rahul Sharma');

    // In the underlying database, PER-00182 has 4 relationships:
    // - CR-2026-001: ACCUSED
    // - CR-2026-1032: VICTIM
    // - CR-2026-1098: WITNESS (MUST BE EXCLUDED)
    // - CR-2026-1142: ACCUSED
    
    // CRITICAL ASSERTION:
    const witnessAssociations = confirmRes.caseAssociations.filter(a => a.role === 'WITNESS');
    assert.equal(witnessAssociations.length, 0, 'WITNESS relationships must NEVER be returned by biometric search');

    // Assert that CR-2026-1098 is completely missing from results
    const homicideWitnessCase = confirmRes.caseAssociations.find(a => a.caseId === 'CR-2026-1098');
    assert.equal(homicideWitnessCase, undefined, 'Case CR-2026-1098 where person is a witness must be omitted');

    // Assert that non-witness associations are returned
    const accusedCases = confirmRes.caseAssociations.filter(a => a.role === 'ACCUSED');
    assert.ok(accusedCases.length >= 2, 'Accused relationships must be preserved');

    // Assert witness exclusion counter is reported
    assert.ok(confirmRes.witnessCountExcluded >= 1, 'Reported excluded witness records count');
  });

  it('4. Victim Protection: VICTIM personal contact information is masked', async () => {
    const searchRes = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1941',
      officerName: 'PSI Sneha P. Kulkarni',
      caseId: 'CR-2026-1032',
      purpose: 'Suspect verification',
      justification: 'Investigation into extortion dead-drop surveillance'
    });

    const confirmRes = await biometricService.confirmIdentity({
      searchId: searchRes.searchId,
      personId: 'PER-00182',
      officerBadge: 'MH-POL-1941',
      officerName: 'PSI Sneha P. Kulkarni'
    });

    const victimAssoc = confirmRes.caseAssociations.find(a => a.role === 'VICTIM');
    assert.ok(victimAssoc, 'Victim association exists in authorized case history');
    assert.equal(victimAssoc.contactMasked, true, 'Contact data must be flagged as masked under Sec 73 BSA');
  });

  it('5. Blockchain Audit Anchoring: Searches generate Fabric TX ID and SHA-256 Digest', async () => {
    const searchRes = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde',
      caseId: 'CR-2026-001',
      purpose: 'Evidence identification',
      justification: 'Forensic photo recovery comparison'
    });

    const confirmRes = await biometricService.confirmIdentity({
      searchId: searchRes.searchId,
      personId: 'PER-00182',
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde'
    });

    assert.ok(confirmRes.auditTxId.length > 5, 'Fabric Transaction ID must be generated');
    assert.equal(confirmRes.sha256Hash.length, 64, 'SHA-256 Digest must be 64 hexadecimal characters');
  });

  it('6. Abuse Detection: Flags high-volume searches across disproportionately few cases', async () => {
    const abusiveBadge = 'MH-POL-ABUSE-99';

    // Run 5 rapid searches on the same case
    let lastResult: any;
    for (let i = 0; i < 5; i++) {
      lastResult = await biometricService.searchCandidates({
        officerBadge: abusiveBadge,
        officerName: 'Suspicious User',
        caseId: 'CR-2026-001',
        purpose: 'CCTV investigation',
        justification: `Rapid search iteration ${i + 1} without new case authorization`
      });
    }

    assert.equal(lastResult.flaggedAbuse, true, '5th rapid search on single case must trigger abuse flag');
    assert.ok(lastResult.abuseReason?.includes('High-frequency searches'), 'Abuse reason explains high velocity');

    // Auditor telemetry reports flagged search
    const stats = biometricService.getBiometricAuditStats();
    assert.ok(stats.flaggedSearches >= 1, 'Auditor stats must include flagged searches');
    const officerStat = stats.officerBreakdown.find(o => o.officerBadge === abusiveBadge);
    assert.ok(officerStat && officerStat.flaggedCount >= 1, 'Officer breakdown reflects flagged status');
  });

  it('7. Role Isolation: Generates valid tokens for POLICE and AUDITOR roles', () => {
    const policeToken = generateToken('POLICE');
    const auditorToken = generateToken('AUDITOR');
    const adminToken = generateToken('ADMIN');

    const decodedPolice = jwt.verify(policeToken, JWT_SECRET) as any;
    const decodedAuditor = jwt.verify(auditorToken, JWT_SECRET) as any;
    const decodedAdmin = jwt.verify(adminToken, JWT_SECRET) as any;

    assert.equal(decodedPolice.role, 'POLICE');
    assert.equal(decodedAuditor.role, 'AUDITOR');
    assert.equal(decodedAdmin.role, 'ADMIN');
  });

  it('8. Real Vector Cosine Similarity: Distinguishes matching vs non-matching facial embeddings', async () => {
    // Generate a matching embedding for Rahul Sharma's frontal mugshot
    const rahulFrontal = biometricService.generateReferenceVector('Rahul Sharma Rocky 1989-04-14 Frontal', 0);
    const rahulSearch = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde',
      caseId: 'CR-2026-001',
      purpose: 'CCTV investigation',
      justification: 'Comparison against enrolled mugshot coordinate space',
      queryEmbedding: rahulFrontal
    });

    assert.equal(rahulSearch.candidates[0].personId, 'PER-00182');
    assert.ok(rahulSearch.candidates[0].similarity >= 0.95, 'Matching vector must have high cosine similarity');

    // Generate an unrelated embedding for an unknown external photo
    const unknownFace = biometricService.generateReferenceVector('Completely Unrelated Person in Snow Jacket', 0);
    const unknownSearch = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde',
      caseId: 'CR-2026-001',
      purpose: 'CCTV investigation',
      justification: 'Comparison of external unknown face against police registry',
      queryEmbedding: unknownFace
    });

    // Top similarity for an unrelated face must be low/moderate, NOT hardcoded 0.93!
    assert.ok(
      unknownSearch.candidates[0].similarity < 0.65,
      `Unrelated face similarity (${unknownSearch.candidates[0].similarity}) must be below high confidence threshold (0.65)`
    );
  });

  it('9. Search Scope: CASE_PERSONS_ONLY restricts candidates to active case dossier', async () => {
    // Case CR-2026-002 only has Amit Patil (PER-00731) associated
    const res = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde',
      caseId: 'CR-2026-002',
      purpose: 'Suspect verification',
      justification: 'Testing case-scoped suspect retrieval',
      searchScope: 'CASE_PERSONS_ONLY'
    });

    assert.ok(res.candidates.length >= 1);
    assert.equal(res.candidates[0].personId, 'PER-00731', 'Must only return suspects associated with CR-2026-002');
  });

  it('10. Dynamic Biometric Enrollment: New profile is immediately searchable via vector similarity', async () => {
    const testEmbedding = biometricService.generateReferenceVector('Test Suspect 999 Special Seed', 0);
    const enrollRes = await biometricService.enrollPerson({
      name: 'Devendra K. Rathod',
      alias: 'Deva',
      dateOfBirth: '1994-05-12',
      gender: 'Male',
      photoUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&fit=crop',
      embedding: testEmbedding,
      caseId: 'CR-2026-001',
      role: 'SUSPECT',
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde'
    });

    assert.ok(enrollRes.person.id.startsWith('PER-'));
    assert.equal(enrollRes.person.name, 'Devendra K. Rathod');

    // Search using the same testEmbedding
    const searchRes = await biometricService.searchCandidates({
      officerBadge: 'MH-POL-1827',
      officerName: 'PI Vikram R. Shinde',
      caseId: 'CR-2026-001',
      purpose: 'Verification',
      justification: 'Verify newly enrolled suspect in central registry',
      queryEmbedding: testEmbedding
    });

    assert.equal(searchRes.candidates[0].personId, enrollRes.person.id, 'Newly enrolled suspect must be top match');
    assert.ok(searchRes.candidates[0].similarity >= 0.98, 'Exact embedding match should achieve ~1.0 similarity');
  });
});
