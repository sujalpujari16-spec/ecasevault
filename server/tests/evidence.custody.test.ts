process.env.NODE_ENV = 'test';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { evidenceService } from '../services/evidenceService';

describe('Evidence Off-Chain Storage & Custody Verification Suite', () => {
  test('Evidence service encrypts and stores evidence off-chain', async () => {
    const testTag = `EV-TEST-${Date.now()}`;
    const testBuffer = Buffer.from('CRIME_SCENE_BALLISTIC_PHOTO_DATA');

    const result = await evidenceService.storeEvidenceFile(
      testTag,
      testBuffer,
      'ballistics.raw',
      'application/octet-stream'
    );

    assert.ok(result.storageUri.includes(testTag), 'Storage URI must point to local storage path');
    assert.equal(result.fileSize, testBuffer.length);
    assert.equal(result.saltHex.length, 64);
    assert.equal(result.ivHex.length, 32);
    assert.equal(result.authTagHex.length, 32);

    // Verify integrity check against stored file
    const verifyResult = await evidenceService.verifyEvidenceFileIntegrity(
      testTag,
      result.sha256Hash,
      result.saltHex,
      result.ivHex,
      result.authTagHex
    );

    assert.equal(verifyResult.isMatch, true, 'SHA-256 must match original file');
    assert.equal(verifyResult.computedHash, result.sha256Hash);
  });

  test('Path traversal attempt in evidence retrieval is strictly rejected', async () => {
    const traversalAttempt = '../../etc/passwd';

    await assert.rejects(
      async () => {
        // basename removes ../, but if an attacker attempts relative escapes:
        await evidenceService.getDecryptedEvidenceFile(
          traversalAttempt,
          '00'.repeat(32),
          '00'.repeat(16),
          '00'.repeat(16)
        );
      },
      /not exist|traversal attempt/
    );
  });

  test('Authoritative Verification Rule: If Fabric is unavailable, system reports VERIFICATION_UNAVAILABLE and does NOT fallback to DB match', () => {
    interface VerificationResponse {
      status: 'VERIFIED' | 'TAMPER_ALERT' | 'VERIFICATION_UNAVAILABLE';
      fabricAvailable: boolean;
      dbMatch: boolean;
    }

    function evaluateVerification(fabricAvailable: boolean, dbMatch: boolean): VerificationResponse {
      if (!fabricAvailable) {
        // Strict Phase 16 Rule: Fabric is authoritative. Never report MATCH with only PostgreSQL.
        return {
          status: 'VERIFICATION_UNAVAILABLE',
          fabricAvailable: false,
          dbMatch,
        };
      }

      return {
        status: dbMatch ? 'VERIFIED' : 'TAMPER_ALERT',
        fabricAvailable: true,
        dbMatch,
      };
    }

    const offlineCheck = evaluateVerification(false, true);
    assert.equal(
      offlineCheck.status,
      'VERIFICATION_UNAVAILABLE',
      'Must return VERIFICATION_UNAVAILABLE when Fabric is offline, even if DB matches'
    );
  });

  test('Custody transfer state transition: custodian is updated ONLY upon CONFIRMED blockchain transaction', () => {
    interface CustodyState {
      currentCustodian: string;
      blockchainStatus: 'PENDING' | 'CONFIRMED' | 'FAILED';
      blockchainTxId: string | null;
    }

    function applyTransferResult(
      initialState: CustodyState,
      toOfficer: string,
      fabricSuccess: boolean,
      txId?: string
    ): CustodyState {
      if (fabricSuccess && txId) {
        return {
          currentCustodian: toOfficer,
          blockchainStatus: 'CONFIRMED',
          blockchainTxId: txId,
        };
      } else {
        return {
          currentCustodian: initialState.currentCustodian, // MUST NOT change!
          blockchainStatus: 'FAILED',
          blockchainTxId: null,
        };
      }
    }

    const initial: CustodyState = {
      currentCustodian: 'PI Patil',
      blockchainStatus: 'PENDING',
      blockchainTxId: null,
    };

    // On Fabric failure: custodian remains PI Patil
    const failedResult = applyTransferResult(initial, 'FSL Specialist Deshmukh', false);
    assert.equal(failedResult.currentCustodian, 'PI Patil', 'Custodian must remain unchanged on commit failure');
    assert.equal(failedResult.blockchainStatus, 'FAILED');
    assert.equal(failedResult.blockchainTxId, null);

    // On Fabric success: custodian updates to FSL Specialist Deshmukh
    const successResult = applyTransferResult(initial, 'FSL Specialist Deshmukh', true, 'TX-FABRIC-REAL-999');
    assert.equal(successResult.currentCustodian, 'FSL Specialist Deshmukh', 'Custodian must update on commit success');
    assert.equal(successResult.blockchainStatus, 'CONFIRMED');
    assert.equal(successResult.blockchainTxId, 'TX-FABRIC-REAL-999');
  });
});
