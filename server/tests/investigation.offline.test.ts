process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-maharashtra-police-2026';

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OFFLINE_SAMPLE_CASES } from '../routes/cases';
import { mapDbRowToCaseFile, DEFAULT_SAMPLE_CASES } from '../../src/utils/caseMapper';

describe('ICJS 5 Pillars & Special Investigation Data Verification Suite', () => {
  it('1. OFFLINE_SAMPLE_CASES contains all mandatory seed dockets', () => {
    assert.strictEqual(OFFLINE_SAMPLE_CASES.length >= 5, true);
    for (const c of OFFLINE_SAMPLE_CASES) {
      assert.ok(c.id, 'Case must have ID');
      assert.ok(c.fir_number, 'Case must have FIR number');
      assert.ok(c.case_title, 'Case must have title');
      assert.ok(c.police_station, 'Case must have police station');
      assert.ok(c.created_at, 'Case must have created_at timestamp');
    }
  });

  it('2. mapDbRowToCaseFile successfully maps all 5 ICJS Pillars without error', () => {
    for (const sample of OFFLINE_SAMPLE_CASES) {
      const mapped = mapDbRowToCaseFile(sample);
      
      // Pillar 1: Police CCTNS
      assert.ok(mapped.cctnsForms, 'Pillar 1 CCTNS forms must exist');
      assert.ok(mapped.cctnsForms.iif1_fir.firNumber, 'IIF-1 FIR number required');
      assert.ok(mapped.cctnsForms.iif2_crimeDetails.spotPanchanamaNumber, 'IIF-2 spot panchanama required');
      assert.ok(mapped.cctnsForms.iif5_finalChargesheet?.chargeSheetNumber, 'IIF-5 chargesheet required');
      assert.ok(mapped.cctnsForms.iif6_nikalNamuna?.courtDisposalNumber, 'IIF-6 court disposal required');
      
      // Pillar 2: Judiciary (e-Courts)
      assert.ok(Array.isArray(mapped.courtRecords), 'Pillar 2 court records must be array');
      assert.ok(mapped.courtRecords.length > 0, 'Must have at least 1 court record');
      assert.ok(mapped.courtRecords[0].rcNumber, 'Court document must have RC / CNR number');
      
      // Pillar 3: Forensics (FSL)
      assert.ok(Array.isArray(mapped.forensicRequests), 'Pillar 3 forensic requests must be array');
      
      // Pillar 4: Prisons (e-Prisons)
      assert.ok(Array.isArray(mapped.prisonRecords), 'Pillar 4 prison records must be array');
      assert.ok(mapped.prisonRecords.length > 0, 'Must have prison records');
      assert.ok(mapped.prisonRecords[0].prisonerNumber, 'Prison record must have prisoner number');
      assert.ok(Array.isArray(mapped.prisonRecords[0].transferRecords), 'Prison transfer records must be array');

      // Pillar 5: NCRB Intelligence
      assert.ok(mapped.ncrbDossier, 'Pillar 5 NCRB dossier must exist');
      assert.ok(mapped.ncrbDossier.dossierId, 'NCRB dossier ID required');
      assert.ok(Array.isArray(mapped.ncrbDossier.interStateLinks), 'NCRB inter-state links must be array');
    }
  });

  it('3. Specialized Investigation Records (1930 Cyber, Bank Notices, MLC & CDR) are properly attached', () => {
    const caseItem = DEFAULT_SAMPLE_CASES[0];
    
    // Bank Notices
    assert.ok(Array.isArray(caseItem.bankNotices), 'bankNotices must be array');
    assert.strictEqual(caseItem.bankNotices.length >= 2, true);
    assert.ok(caseItem.bankNotices[0].accountNumber, 'Account number required');
    assert.ok(caseItem.bankNotices[0].noticeSection, 'Notice section required');

    // 1930 Cyber Tracing
    assert.ok(caseItem.cyberTracing, 'cyberTracing must exist');
    assert.ok(caseItem.cyberTracing.helplineTicket1930, '1930 helpline ticket required');
    assert.ok(caseItem.cyberTracing.stolenDeviceIMEI, 'IMEI required');
    assert.ok(caseItem.cyberTracing.sec41ANoticeToBuyer, 'Section 41A notice required');

    // Hospital MLC
    assert.ok(caseItem.medicoLegalCase, 'medicoLegalCase must exist');
    assert.ok(caseItem.medicoLegalCase.mlcNumber, 'MLC number required');
    assert.ok(caseItem.medicoLegalCase.hospitalName, 'Hospital name required');
    assert.ok(caseItem.medicoLegalCase.examiningDoctorRegNo, 'Doctor MMC reg number required');

    // Call Data Records (CDR)
    assert.ok(Array.isArray(caseItem.cdrRecords), 'cdrRecords must be array');
    assert.strictEqual(caseItem.cdrRecords.length >= 2, true);
    assert.ok(caseItem.cdrRecords[0].towerCellId, 'Tower cell ID required');
    assert.ok(caseItem.cdrRecords[0].callerNumber, 'Caller number required');
    assert.ok(caseItem.cdrRecords[0].sha256Digest, 'CDR hash digest required');
  });
});
