import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  parseFirOcrText,
  getSampleFirText,
  getVashiSampleFirText,
  getPuneDeccanSampleFirText,
  normalizeMarathiOcrText,
  classifyFirDocument,
  validateBriefFactuality,
  extractGroundedNarrativeFacts,
  generateFactGroundedBrief,
} from '../../src/services/firOcrService.ts';
import { calculateServerSha256 } from '../services/cryptoService.ts';

describe('Source-Grounded FIR Brief & Multi-Document Verification Pipeline', () => {

  it('1. Real Vashi FIR (0431/2026): Extracts grounded debris transportation facts at Vashi Toll Naka', () => {
    const vashiText = getVashiSampleFirText();
    const result = parseFirOcrText(vashiText, 'Vashi Police Station, Navi Mumbai');

    // FIR & Station Particulars
    assert.ok(result.firNumber.includes('0431'), `Expected FIR 0431, got: ${result.firNumber}`);
    assert.strictEqual(result.policeStation, 'Vashi Police Station, Navi Mumbai');
    assert.ok(result.district?.includes('नवी मुंबई'), `Expected district नवी मुंबई, got: ${result.district}`);

    // Incident Date & Time (~01:10 hrs at Vashi Toll Naka)
    assert.strictEqual(result.filedDate, '2026-09-06');
    assert.strictEqual(result.incidentDate, '2026-09-06');
    assert.ok(result.locationOfIncident.includes('वाशी टोल नाका') || result.locationOfIncident.includes('Vashi Toll Naka'),
      `Occurrence must be Vashi Toll Naka, got: ${result.locationOfIncident}`);
    assert.ok(!result.locationOfIncident.includes('वाशी प्लाझा'), 'Must NOT invent Vashi Plaza Signal location');

    // Penal Sections: BNS 280, 62
    assert.ok(result.selectedSections.includes('Sec 280 BNS'), `Must detect Sec 280 BNS, got: ${result.selectedSections.join(', ')}`);
    assert.ok(result.selectedSections.includes('Sec 62 BNS'), `Must detect Sec 62 BNS, got: ${result.selectedSections.join(', ')}`);

    // All 6 dumpers must be extracted from pages 5-6
    const vehicleEntities = result.entities.filter(e => e.type === 'VEHICLE').map(e => e.value);
    const expectedDumpers = [
      'MH 46 CL 9870',
      'MH 46 DC 8030',
      'MH 03 ES 5060',
      'MH 43 CQ 5015',
      'MH 43 CQ 5295',
      'MH 43 CK 8885'
    ];
    for (const dumper of expectedDumpers) {
      assert.ok(vehicleEntities.includes(dumper), `Must extract dumper vehicle ${dumper}`);
    }

    // Grounded Automatic Brief Facts
    assert.ok(result.groundedBrief, 'Must produce grounded brief report');
    assert.strictEqual(result.groundedBrief.isReliable, true);
    assert.strictEqual(result.groundedBrief.sourcePages, 'Pages 5–6', 'Narrative must be sourced from Pages 5-6');
    assert.strictEqual(result.groundedBrief.validationStatus, 'GROUNDED_VERIFIED');

    // Check summary narrative content
    const brief = result.incidentDescription;
    assert.ok(brief.includes('वाशी टोल नाका'), 'Summary must contain true incident location: Vashi Toll Naka');
    assert.ok(brief.includes('01:10'), 'Summary must contain incident time 01:10');
    assert.ok(brief.includes('डेब्रिज'), 'Summary must describe debris transportation');
    assert.ok(brief.includes('डंपर'), 'Summary must describe dumpers');

    // STRICT NEGATIVE CONSTRAINTS: Must NOT contain invented accident/CCTV elements
    assert.ok(!brief.includes('धडक'), 'Summary must NOT contain collision (धडक)');
    assert.ok(!brief.includes('अपघात'), 'Summary must NOT describe as generic traffic accident (अपघात)');
    assert.ok(!brief.includes('सीसीटीव्ही'), 'Summary must NOT fabricate CCTV surveillance');
    assert.ok(!brief.includes('पलायन'), 'Summary must NOT fabricate fleeing (पलायन)');
    assert.ok(!brief.includes('वाशी प्लाझा'), 'Summary must NOT fabricate Vashi Plaza Signal');
  });

  it('2. Cyber Crime FIR (Andheri 04821/2026): Extracts corporate banking fraud narrative without vehicle contamination', () => {
    const cyberText = getSampleFirText();
    const result = parseFirOcrText(cyberText, 'Andheri Police Station, Mumbai');

    assert.ok(result.firNumber.includes('04821'));
    assert.strictEqual(result.crimeCategory, 'Cyber Crime');
    assert.ok(result.locationOfIncident.includes('Andheri') || result.locationOfIncident.includes('BKC'));
    assert.ok(result.selectedSections.includes('Sec 66C IT Act') || result.selectedSections.includes('Sec 66D IT Act'));

    const brief = result.incidentDescription;
    assert.ok(brief.toLowerCase().includes('banking') || brief.toLowerCase().includes('phishing') || brief.toLowerCase().includes('remote access'),
      'Cyber brief must summarize illicit banking portal compromise');

    // Must NOT contain dumper or debris facts
    assert.ok(!brief.includes('डेब्रिज'), 'Cyber FIR brief must NOT contain debris facts');
    assert.ok(!brief.includes('डंपर'), 'Cyber FIR brief must NOT contain dumper vehicles');
    assert.ok(!brief.includes('वाशी'), 'Cyber FIR brief must NOT contain Vashi location');
  });

  it('3. Burglary / Theft FIR (Pune Deccan 0188/2026): Extracts jewelry workshop break-in narrative', () => {
    const puneText = getPuneDeccanSampleFirText();
    const result = parseFirOcrText(puneText, 'Deccan Police Station, Pune');

    assert.ok(result.firNumber.includes('0188'));
    assert.strictEqual(result.policeStation, 'Deccan Police Station, Pune');
    assert.ok(result.locationOfIncident.includes('प्रभात रोड') || result.locationOfIncident.includes('Prabhat Road'));
    assert.strictEqual(result.crimeCategory, 'Theft / House Breaking');
    assert.ok(result.selectedSections.includes('Sec 305 BNS'));

    const brief = result.incidentDescription;
    assert.ok(brief.includes('प्रभात रोड'), 'Must specify Prabhat Road location');
    assert.ok(brief.includes('कुलूप') || brief.includes('चोरी'), 'Must summarize break-in / theft');
    assert.ok(!brief.includes('डेब्रिज'), 'Theft brief must NOT contain debris');
    assert.ok(!brief.includes('डंपर'), 'Theft brief must NOT contain dumpers');
    assert.ok(!brief.includes('cyber'), 'Theft brief must NOT contain cyber terms');
  });

  it('4. Multi-Document Dynamic Differentiation: Brief changes strictly according to uploaded FIR', () => {
    const vashiBrief = parseFirOcrText(getVashiSampleFirText()).incidentDescription;
    const cyberBrief = parseFirOcrText(getSampleFirText()).incidentDescription;
    const puneBrief = parseFirOcrText(getPuneDeccanSampleFirText()).incidentDescription;

    // All 3 briefs must be completely distinct
    assert.notStrictEqual(vashiBrief, cyberBrief, 'Vashi and Cyber briefs must be completely different');
    assert.notStrictEqual(vashiBrief, puneBrief, 'Vashi and Pune briefs must be completely different');
    assert.notStrictEqual(cyberBrief, puneBrief, 'Cyber and Pune briefs must be completely different');

    // Verify key factual grounding markers
    assert.ok(vashiBrief.includes('वाशी टोल नाका') && vashiBrief.includes('डेब्रिज'));
    assert.ok(cyberBrief.toLowerCase().includes('banking'));
    assert.ok(puneBrief.includes('प्रभात रोड') && puneBrief.includes('चोरी'));
  });

  it('5. Factuality Validation Engine: Strips hallucinated claims not supported by source text', () => {
    const facts = extractGroundedNarrativeFacts(
      'दिनांक 06/09/2026 रोजी मध्यरात्री सुमारे 01:10 वाजता वाशी टोल नाका येथे डंपरमधून डेब्रिज वाहतूक करताना आढळून आले.',
      'वाशी टोल नाका, वाशी, नवी मुंबई',
      ['Sec 280 BNS', 'Sec 62 BNS'],
      'वाशी टोल नाका, वाशी, नवी मुंबई',
      '2026-09-06',
      '01:10'
    );

    // Provide a brief that attempts to hallucinate a collision at Vashi Plaza and CCTV fleeing
    const hallucinatedBrief = 'दिनांक 06/09/2026 रोजी मध्यरात्री सुमारे 01:10 वाजता वाशी टोल नाका येथे डेब्रिज वाहतूक करताना आढळून आले. संशयित वाहनाने वाशी प्लाझा येथे धडक देऊन पलायन केले. जवळच असलेल्या सीसीटीव्ही कॅमेऱ्यातून फुटेज जप्त करण्यात आले.';
    const sourceText = 'दिनांक 06/09/2026 रोजी मध्यरात्री सुमारे 01:10 वाजता वाशी टोल नाका येथे डेब्रिज वाहतूक करताना आढळून आले.';

    const validation = validateBriefFactuality(hallucinatedBrief, facts, sourceText);

    // Unsupported sentences must be stripped
    assert.strictEqual(validation.status, 'UNSUPPORTED_CLAIMS_REMOVED');
    assert.ok(validation.removedSentences.length >= 2, 'Must remove unsupported collision and CCTV sentences');
    assert.ok(!validation.verifiedBrief.includes('धडक'), 'Verified brief must not contain collision claim');
    assert.ok(!validation.verifiedBrief.includes('सीसीटीव्ही'), 'Verified brief must not contain CCTV claim');
    assert.ok(!validation.verifiedBrief.includes('पलायन'), 'Verified brief must not contain fleeing claim');
    assert.ok(validation.verifiedBrief.includes('डेब्रिज'), 'Grounded claims must be preserved');
  });

  it('6. Rejection of Unreliable Documents: Avoids generating plausible fake briefs for non-FIR text', () => {
    const nonFirDocument = `
      RESUME / CURRICULUM VITAE
      Name: Amit Verma
      Designation: Software Developer
      Experience: 5 years in TypeScript & React
    `;

    const result = parseFirOcrText(nonFirDocument);
    assert.strictEqual(result.isRecognizedFir, false, 'Non-FIR document must fail classification');
    assert.strictEqual(result.groundedBrief?.validationStatus, 'UNABLE_TO_RELIABLY_EXTRACT');
    assert.strictEqual(result.groundedBrief?.isReliable, false);
    assert.strictEqual(result.incidentDescription, 'Unable to reliably extract the complaint narrative. Please retry document processing.');
  });

  it('7. Marathi OCR Normalizer: Corrects broken ligatures and preserves Marathi source', () => {
    const corruptedText = `
      भातीय Ûयाय संद¡ता कलम 280, 62
      Ĥम खब Đ. 0431 / 2026
      माद¡ती
      पोलीस ठाÖयाव: वाशी
      तĐारदार: पोलीस अधिकारी
      घटना स थळ: वाशी टोल नाका
    `;

    const normalized = normalizeMarathiOcrText(corruptedText);
    assert.ok(normalized.includes('भारतीय न्याय संहिता'));
    assert.ok(normalized.includes('प्रथम खबर क्र.'));
    assert.ok(normalized.includes('पोलीस ठाणे'));
    assert.ok(normalized.includes('तक्रारदार'));
    assert.ok(normalized.includes('घटनास्थळ'));
  });

  it('8. Cryptographic Integrity: Computes SHA-256 digest of original FIR document buffer', () => {
    const mockFirDocument = Buffer.from(getVashiSampleFirText(), 'utf-8');
    const hash = calculateServerSha256(mockFirDocument);

    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64, 'SHA-256 hash must be exactly 64 hex characters');

    // Tampering test
    const tamperedDocument = Buffer.from(getVashiSampleFirText() + '\nMODIFIED_TEXT', 'utf-8');
    const tamperedHash = calculateServerSha256(tamperedDocument);
    assert.notStrictEqual(hash, tamperedHash, 'Tampered document must yield a different SHA-256 hash');
  });

});

