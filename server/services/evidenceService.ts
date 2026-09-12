import fs from 'fs';
import path from 'path';
import { encryptBuffer, decryptBuffer, calculateServerSha256 } from './cryptoService';
import { supabaseAdmin, SUPABASE_BUCKET_EVIDENCE } from '../config/supabase';

const STORAGE_DIR = path.resolve(process.cwd(), 'storage/evidence');

// Ensure encrypted evidence storage directory exists on disk
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export const evidenceService = {
  /**
   * Encrypts and writes a file payload to Supabase private storage and disk off-chain, and records metadata.
   */
  async storeEvidenceFile(
    evidenceTag: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    caseId?: string
  ): Promise<{
    storageUri: string;
    sha256Hash: string;
    saltHex: string;
    ivHex: string;
    authTagHex: string;
    fileSize: number;
  }> {
    const { encryptedData, saltHex, ivHex, authTagHex, sha256Hash } = encryptBuffer(fileBuffer);
    const safeTag = path.basename(evidenceTag);
    const filePath = path.join(STORAGE_DIR, `${safeTag}.enc`);

    // Write encrypted binary payload to disk off-chain as local cache
    await fs.promises.writeFile(filePath, encryptedData);

    let storageUri = `file://${filePath}`;

    // Upload to Supabase Storage private bucket using deterministic path
    try {
      const storageKey = caseId ? `cases/${caseId}/evidence/${safeTag}.enc` : `${safeTag}.enc`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from(SUPABASE_BUCKET_EVIDENCE)
        .upload(storageKey, encryptedData, {
          contentType: 'application/octet-stream',
          upsert: true,
        });
      if (!uploadError) {
        storageUri = `supabase://${SUPABASE_BUCKET_EVIDENCE}/${storageKey}`;
      } else {
        console.warn(`[SUPABASE EVIDENCE] Storage upload warning:`, uploadError.message);
      }
    } catch (err: any) {
      console.warn(`[SUPABASE EVIDENCE] Storage upload exception:`, err.message);
    }

    return {
      storageUri,
      sha256Hash,
      saltHex,
      ivHex,
      authTagHex,
      fileSize: fileBuffer.length,
    };
  },

  /**
   * Helper to retrieve encrypted payload from authoritative storage (Supabase / Object Storage) or local cache
   */
  async fetchEncryptedPayload(evidenceTag: string, storageUri?: string): Promise<Buffer> {
    const safeTag = path.basename(evidenceTag);
    if (storageUri && storageUri.startsWith('supabase://')) {
      try {
        const parts = storageUri.replace('supabase://', '').split('/');
        const bucket = parts[0];
        const key = parts.slice(1).join('/');
        const { data, error } = await supabaseAdmin.storage.from(bucket).download(key);
        if (!error && data) {
          const arrayBuf = await data.arrayBuffer();
          return Buffer.from(arrayBuf);
        }
      } catch (err: any) {
        console.warn(`[SUPABASE EVIDENCE DOWNLOAD] Failed from Supabase, trying cache:`, err?.message);
      }
    }
    const filePath = path.join(STORAGE_DIR, `${safeTag}.enc`);
    if (fs.existsSync(filePath)) {
      return fs.promises.readFile(filePath);
    }
    throw new Error(`Evidence storage file ${safeTag}.enc does not exist in primary storage or cache`);
  },

  /**
   * Reads an encrypted evidence file from authoritative storage, decrypts it, and verifies its current SHA-256 digest.
   */
  async verifyEvidenceFileIntegrity(
    evidenceTag: string,
    storedOriginalHash: string,
    saltHex: string,
    ivHex: string,
    authTagHex: string,
    storageUri?: string
  ): Promise<{
    isMatch: boolean;
    computedHash: string;
    decryptedBuffer?: Buffer;
  }> {
    try {
      const encryptedPayload = await this.fetchEncryptedPayload(evidenceTag, storageUri);
      const decryptedBuffer = decryptBuffer(encryptedPayload, saltHex, ivHex, authTagHex);
      const computedHash = calculateServerSha256(decryptedBuffer);

      return {
        isMatch: storedOriginalHash.toLowerCase() === computedHash.toLowerCase(),
        computedHash,
        decryptedBuffer,
      };
    } catch {
      return { isMatch: false, computedHash: 'FILE_NOT_FOUND' };
    }
  },

  /**
   * Securely retrieves and decrypts an evidence file with path traversal guards.
   */
  async getDecryptedEvidenceFile(
    evidenceTag: string,
    saltHex: string,
    ivHex: string,
    authTagHex: string,
    storageUri?: string
  ): Promise<{ decryptedBuffer: Buffer; filePath: string }> {
    const safeTag = path.basename(evidenceTag);
    const filePath = path.join(STORAGE_DIR, `${safeTag}.enc`);

    const encryptedPayload = await this.fetchEncryptedPayload(evidenceTag, storageUri);
    const decryptedBuffer = decryptBuffer(encryptedPayload, saltHex, ivHex, authTagHex);
    return { decryptedBuffer, filePath };
  },
};

