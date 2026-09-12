/**
 * e-CASEVAULT — Central Cryptographic Hashing Service
 * 
 * Provides unified SHA-256 computation across all application subsystems,
 * ensuring standardized digests for files, structured metadata, and
 * chained tamper-evident event blocks.
 */

import crypto from 'crypto';

/**
 * Calculates a standard SHA-256 hexadecimal digest from a Buffer or string.
 */
export function sha256(data: Buffer | string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Serializes event fields into a deterministic canonical string for hash generation.
 * Format: caseId|entityId|entityType|action|actorId|fileHash|dataHash|timestamp
 */
export function buildCanonicalEventData(fields: {
  caseId?: string;
  entityId: string;
  entityType: string;
  action: string;
  actorId: string;
  fileHash?: string;
  dataHash?: string;
  timestamp: string;
}): string {
  return [
    fields.caseId || 'GLOBAL',
    fields.entityId,
    fields.entityType.toUpperCase(),
    fields.action.toUpperCase(),
    fields.actorId,
    fields.fileHash || '',
    fields.dataHash || '',
    fields.timestamp,
  ].join('|');
}

/**
 * Computes an event hash mathematically chained to the preceding event hash:
 * Event Hash = SHA256(previousHash | canonicalEventData)
 */
export function createEventHash(canonicalEventData: string, previousHash: string): string {
  const payload = `${previousHash}|${canonicalEventData}`;
  return sha256(payload);
}

export const hashService = {
  sha256,
  buildCanonicalEventData,
  createEventHash,
};

