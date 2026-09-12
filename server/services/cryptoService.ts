import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const AES_ALGORITHM = 'aes-256-gcm';

function getMasterKey(): string {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY || (process.env.NODE_ENV === 'production' ? undefined : '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is required in production');
  }
  return masterKey;
}

/**
 * Calculates standard SHA-256 hexadecimal hash digest.
 */
export function calculateServerSha256(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Encrypts a binary file buffer using AES-256-GCM with random salt and IV.
 */
export function encryptBuffer(buffer: Buffer): {
  encryptedData: Buffer;
  saltHex: string;
  ivHex: string;
  authTagHex: string;
  sha256Hash: string;
} {
  const sha256Hash = calculateServerSha256(buffer);
  const salt = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const masterKey = getMasterKey();
  const key = crypto.scryptSync(masterKey, salt, 32);

  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  const encryptedData = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData,
    saltHex: salt.toString('hex'),
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    sha256Hash,
  };
}

/**
 * Decrypts an AES-256-GCM encrypted evidence buffer.
 */
export function decryptBuffer(
  encryptedData: Buffer,
  saltHex: string,
  ivHex: string,
  authTagHex: string
): Buffer {
  const masterKey = getMasterKey();
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const key = crypto.scryptSync(masterKey, salt, 32);
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

/**
 * Asymmetric Digital Signature Infrastructure using Ed25519.
 * Provides cryptographically sound non-repudiation for chain-of-custody and approvals.
 */
export interface AsymmetricSignatureRecord {
  signatureHex: string;
  algorithm: 'Ed25519';
  publicKeyHex: string;
  publicKeyPem: string;
  publicKeyId: string;
  signedPayloadHash: string;
  canonicalPayload: string;
  signerBadge: string;
  timestamp: string;
}

// Persistent officer keypair cache & storage
const officerKeyCache = new Map<string, { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject; publicKeyPem: string }>();
const KEYS_DIR = path.resolve(process.cwd(), 'storage/keys');

if (!fs.existsSync(KEYS_DIR)) {
  fs.mkdirSync(KEYS_DIR, { recursive: true, mode: 0o700 });
}

/**
 * Securely retrieves or provisions a dedicated Ed25519 asymmetric keypair for an officer badge.
 * Private keys are strictly confined to the server environment and persisted securely in storage/keys/.
 */
export function getOfficerSigningKeypair(officerBadge: string): {
  publicKey: crypto.KeyObject;
  privateKey: crypto.KeyObject;
  publicKeyPem: string;
} {
  if (officerKeyCache.has(officerBadge)) {
    return officerKeyCache.get(officerBadge)!;
  }

  const safeBadge = (officerBadge || 'SYS-SIGNER').replace(/[^a-zA-Z0-9_-]/g, '_');
  const privPath = path.join(KEYS_DIR, `${safeBadge}.priv.pem`);
  const pubPath = path.join(KEYS_DIR, `${safeBadge}.pub.pem`);

  // Load existing persistent keys if present
  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    try {
      const privPem = fs.readFileSync(privPath, 'utf8');
      const pubPem = fs.readFileSync(pubPath, 'utf8');
      const privateKey = crypto.createPrivateKey({ key: privPem, format: 'pem', type: 'pkcs8' });
      const publicKey = crypto.createPublicKey({ key: pubPem, format: 'pem', type: 'spki' });
      const entry = { publicKey, privateKey, publicKeyPem: pubPem };
      officerKeyCache.set(officerBadge, entry);
      return entry;
    } catch (err) {
      console.warn(`[CRYPTO SERVICE] Failed to load keypair for ${officerBadge}, regenerating:`, err);
    }
  }

  // Generate new keypair if not already persisted
  const keypair = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  try {
    fs.writeFileSync(privPath, privateKeyPem, { mode: 0o600 });
    fs.writeFileSync(pubPath, publicKeyPem, { mode: 0o644 });
  } catch (err) {
    console.error(`[CRYPTO SERVICE] Failed to persist keypair for ${officerBadge}:`, err);
  }

  const entry = {
    publicKey: keypair.publicKey,
    privateKey: keypair.privateKey,
    publicKeyPem,
  };

  officerKeyCache.set(officerBadge, entry);
  return entry;
}

/**
 * Creates an authentic Ed25519 asymmetric digital signature over a canonical payload.
 */
export function signPayloadAsymmetric(officerBadge: string, payload: any): AsymmetricSignatureRecord {
  const { privateKey, publicKeyPem } = getOfficerSigningKeypair(officerBadge);
  const timestamp = new Date().toISOString();

  const serializedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const canonicalPayload = JSON.stringify({
    signer: officerBadge,
    payload: serializedPayload,
    timestamp,
  });

  const signedPayloadHash = calculateServerSha256(canonicalPayload);
  const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey);
  const signatureHex = signature.toString('hex');
  const publicKeyId = `KEY-ED25519-${calculateServerSha256(publicKeyPem).substring(0, 16).toUpperCase()}`;

  return {
    signatureHex,
    algorithm: 'Ed25519',
    publicKeyHex: publicKeyPem,
    publicKeyPem,
    publicKeyId,
    signedPayloadHash,
    canonicalPayload,
    signerBadge: officerBadge,
    timestamp,
  };
}

/**
 * Verifies an Ed25519 digital signature against the signer's public key.
 */
export function verifyDigitalSignature(
  canonicalPayload: string,
  signatureHex: string,
  publicKeyPem: string
): boolean {
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    const signatureBuffer = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, Buffer.from(canonicalPayload, 'utf8'), publicKey, signatureBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Legacy wrapper: Returns an Ed25519 asymmetric digital signature string.
 */
export function signPayload(officerBadge: string, payload: string): string {
  const result = signPayloadAsymmetric(officerBadge, payload);
  return `ED25519:${result.publicKeyId}:${result.signatureHex}`;
}

/**
 * Verifies if an evidence hash matches the stored blockchain SHA-256 record.
 */
export function verifyHashMatch(storedHash: string, currentContent: string | Buffer): {
  isVerified: boolean;
  computedHash: string;
} {
  const computedHash = calculateServerSha256(currentContent);
  return {
    isVerified: storedHash.toLowerCase() === computedHash.toLowerCase(),
    computedHash,
  };
}

export const cryptoService = {
  calculateSHA256: calculateServerSha256,
  generateEncryptionKey(): Buffer {
    return crypto.randomBytes(32);
  },
  encryptDocument(content: string | Buffer, key: Buffer): { cipherText: Buffer; iv: Buffer; authTag: Buffer } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const cipherText = Buffer.concat([cipher.update(buf), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { cipherText, iv, authTag };
  },
  decryptDocument(cipherText: Buffer, key: Buffer, iv: Buffer, authTag: Buffer): Buffer {
    const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(cipherText), decipher.final()]);
  },
  generateEd25519KeyPair() {
    const keypair = crypto.generateKeyPairSync('ed25519');
    return {
      publicKey: keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKey: keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    };
  },
  signDigest(digest: string, privateKeyPem: string): string {
    const privateKey = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem', type: 'pkcs8' });
    const signature = crypto.sign(null, Buffer.from(digest, 'utf8'), privateKey);
    return signature.toString('hex');
  },
  verifySignature(digest: string, signatureHex: string, publicKeyPem: string): boolean {
    try {
      const publicKey = crypto.createPublicKey({ key: publicKeyPem, format: 'pem', type: 'spki' });
      return crypto.verify(null, Buffer.from(digest, 'utf8'), publicKey, Buffer.from(signatureHex, 'hex'));
    } catch {
      return false;
    }
  },
  encryptBuffer,
  decryptBuffer,
  signPayloadAsymmetric,
  verifyDigitalSignature,
  getOfficerSigningKeypair,
};
