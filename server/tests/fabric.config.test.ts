import test from 'node:test';
import assert from 'node:assert';
import { fabricGateway, getOrgConfig } from '../services/fabricGateway';

test('Fabric Multi-Org Static Configuration Suite (Offline Validatable)', async (t) => {
  await t.test('1. Validates Multi-Org MSP IDs', () => {
    const policeConfig = getOrgConfig('POLICE');
    const fslConfig = getOrgConfig('FSL');
    const cyberConfig = getOrgConfig('CYBER');

    assert.strictEqual(policeConfig.mspId, 'PoliceOrgMSP');
    assert.strictEqual(fslConfig.mspId, 'FSLOrgMSP');
    assert.strictEqual(cyberConfig.mspId, 'CyberCellOrgMSP');
  });

  await t.test('2. Validates Channel and Chaincode Configuration', () => {
    const policeConfig = getOrgConfig('POLICE');
    assert.strictEqual(policeConfig.channelName, 'ecasevault-channel');
    assert.strictEqual(policeConfig.chaincodeName, 'ecasevault');
  });

  await t.test('3. Validates Absence of Simulated Memory Ledgers', () => {
    // getBlocks() was removed deliberately: an in-memory block accessor could
    // only ever return fabricated ledger data. Assert the accessor does not
    // exist at all, rather than calling it and inspecting its length.
    const gateway = fabricGateway as unknown as Record<string, unknown>;

    assert.strictEqual(
      gateway.getBlocks,
      undefined,
      'fabricGateway must expose no getBlocks() accessor — simulated in-memory ledgers are prohibited'
    );

    for (const forbidden of ['blocks', 'blockStore', 'memoryLedger', 'fakeLedger']) {
      assert.strictEqual(
        gateway[forbidden],
        undefined,
        `fabricGateway must not hold a "${forbidden}" store — ledger state lives only on Fabric`
      );
    }
  });
});
