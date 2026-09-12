import test from 'node:test';
import assert from 'node:assert/strict';
import { translations, SUPPORTED_LANGUAGES } from '../../src/i18n/translations';

test('Multilingual Support Suite: English, Marathi, and Hindi Localization', async (t) => {
  await t.test('1. Supported Languages: Contains English, Marathi, and Hindi with badges', () => {
    assert.equal(SUPPORTED_LANGUAGES.length, 3, 'Must have exactly 3 languages');
    const codes = SUPPORTED_LANGUAGES.map(l => l.code);
    assert.deepEqual(codes, ['en', 'mr', 'hi'], 'Must support en, mr, hi');

    const marathi = SUPPORTED_LANGUAGES.find(l => l.code === 'mr');
    assert.equal(marathi?.nativeLabel, 'मराठी');
    assert.equal(marathi?.badge, 'मराठी');

    const hindi = SUPPORTED_LANGUAGES.find(l => l.code === 'hi');
    assert.equal(hindi?.nativeLabel, 'हिन्दी');
    assert.equal(hindi?.badge, 'हिंदी');
  });

  await t.test('2. Key Parity: All keys defined in English are translated into Marathi and Hindi', () => {
    const enKeys = Object.keys(translations.en);
    const mrKeys = Object.keys(translations.mr);
    const hiKeys = Object.keys(translations.hi);

    assert.ok(enKeys.length >= 35, 'Must have at least 35 key translations');

    for (const key of enKeys) {
      assert.ok(key in translations.mr, `Marathi translation missing for key: ${key}`);
      assert.ok(translations.mr[key].length > 0, `Marathi translation empty for key: ${key}`);

      assert.ok(key in translations.hi, `Hindi translation missing for key: ${key}`);
      assert.ok(translations.hi[key].length > 0, `Hindi translation empty for key: ${key}`);
    }

    assert.equal(mrKeys.length, enKeys.length, 'Marathi key count must match English');
    assert.equal(hiKeys.length, enKeys.length, 'Hindi key count must match English');
  });

  await t.test('3. Linguistic Accuracy: Marathi terms match Maharashtra Police conventions', () => {
    assert.equal(translations.mr['app.title'], 'ई-केस व्हॉल्ट');
    assert.equal(translations.mr['app.subtitle'], 'डिजिटल पुरावा व्यवस्थापन प्रणाली');
    assert.equal(translations.mr['app.register_fir'], 'नवीन एफआयआर नोंदवा');
    assert.equal(translations.mr['nav.all_cases'], 'सर्व खटले (केसेस)');
    assert.equal(translations.mr['nav.evidence_vault'], 'डिजिटल पुरावा व्हॉल्ट');
    assert.equal(translations.mr['role.POLICE'], 'पोलीस (तपास विभाग)');
    assert.equal(translations.mr['role.FORENSIC'], 'फॉरेन्सिक (न्यायवैद्यक प्रयोगशाळा - कलिना)');
    assert.equal(translations.mr['role.LEGAL'], 'विधी व न्याय (सरकारी अभियोक्ता)');
  });

  await t.test('4. Linguistic Accuracy: Hindi terms match Official Police & Judicial terminology', () => {
    assert.equal(translations.hi['app.title'], 'ई-केस वॉल्ट');
    assert.equal(translations.hi['app.subtitle'], 'डिजिटल साक्ष्य प्रबंधन प्रणाली');
    assert.equal(translations.hi['app.register_fir'], 'नई प्राथमिकी (FIR) दर्ज करें');
    assert.equal(translations.hi['nav.all_cases'], 'सभी मामले (केस)');
    assert.equal(translations.hi['nav.evidence_vault'], 'डिजिटल साक्ष्य वॉल्ट');
    assert.equal(translations.hi['role.POLICE'], 'पुलिस (जांच विभाग)');
    assert.equal(translations.hi['role.FORENSIC'], 'फोरेंसिक (न्यायालयिक विज्ञान प्रयोगशाला - कलीना)');
    assert.equal(translations.hi['role.LEGAL'], 'कानूनी व अभियोजन (लोक अभियोजक)');
  });
});
