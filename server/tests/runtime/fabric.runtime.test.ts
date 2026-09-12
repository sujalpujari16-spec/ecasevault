import { fabricGateway, getOrgConfig } from '../../services/fabricGateway';

async function runFabricRuntimeTest() {
  console.log('======================================================');
  console.log('  e-CASEVAULT — Fabric Live Runtime Integration Test');
  console.log('======================================================');

  const policeConfig = getOrgConfig('POLICE');
  console.log('[STEP 1] Checking Target Fabric Endpoint:', policeConfig.peerEndpoint);

  // 1. Live Peer Connectivity Check
  const isConnected = await fabricGateway.checkConnection('POLICE');
  if (!isConnected) {
    console.error('❌ [FABRIC RUNTIME FAILED] Hyperledger Fabric peer is OFFLINE or UNREACHABLE.');
    console.error('   A live running Fabric network is strictly required for runtime integration verification.');
    console.error('   Start the network using: ./blockchain/network/network.sh all');
    process.exit(1);
  }
  console.log('✓ Connected to Fabric Peer:', policeConfig.peerEndpoint);

  // 2. Channel & Contract Access
  console.log('[STEP 2] Accessing Channel and Contract...');
  const contract = await fabricGateway.getContract('POLICE');
  if (!contract) {
    console.error('❌ [FABRIC RUNTIME FAILED] Unable to obtain contract handle on channel', policeConfig.channelName);
    process.exit(1);
  }
  console.log('✓ Obtained contract handle on channel:', policeConfig.channelName);

  // 3. Execute Real Read Query (EvaluateTransaction)
  console.log('[STEP 3] Executing Real Ledger Query...');
  const testCaseId = 'MH-MUM-2026-004821';
  try {
    const caseResult = await fabricGateway.getCase(testCaseId);
    console.log('✓ Genesis Case query successful:', caseResult.firNumber || caseResult.caseId);
  } catch (err: any) {
    console.error(`❌ [FABRIC RUNTIME FAILED] Read query failed: ${err.message}`);
    process.exit(1);
  }

  // 4. Submit Real Transaction & Verify Commit
  console.log('[STEP 4] Submitting Real Live Transaction...');
  const probeEvidenceId = `EV-PROBE-${Date.now().toString(36).toUpperCase()}`;
  const probeHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  
  const submitResult = await fabricGateway.registerEvidence(
    probeEvidenceId,
    testCaseId,
    'TAG-PROBE',
    probeHash,
    'Digital Proof',
    'MH-POL-8842',
    'Locker 1'
  );
  console.log('✓ Transaction committed with TX ID:', submitResult.transactionId);

  // 5. Verify Resulting Ledger State
  console.log('[STEP 5] Verifying Resulting Ledger State...');
  const verifyResult = await fabricGateway.verifyEvidenceHash(probeEvidenceId, probeHash);
  if (verifyResult !== 'VERIFIED_INTEGRITY_MATCH') {
    console.error('❌ [FABRIC RUNTIME FAILED] Evidence verification returned:', verifyResult);
    process.exit(1);
  }
  console.log('✓ Evidence integrity match confirmed on live ledger');

  console.log('======================================================');
  console.log('  LIVE FABRIC RUNTIME INTEGRATION TEST PASSED');
  console.log('======================================================');
}

runFabricRuntimeTest().catch((err) => {
  console.error('❌ [FABRIC RUNTIME TEST ERROR]', err);
  process.exit(1);
});
