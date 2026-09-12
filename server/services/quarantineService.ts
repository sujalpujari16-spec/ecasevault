import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { documentValidationService, FileValidationResult } from './documentValidationService';
import { antivirusService, ScanResult } from './antivirusService';
import { securityService } from './securityService';
import { calculateServerSha256 } from './cryptoService';

const QUARANTINE_DIR = path.resolve(process.cwd(), 'storage/quarantine');

// Ensure quarantine staging directory exists with restricted permissions (0700)
if (!fs.existsSync(QUARANTINE_DIR)) {
  fs.mkdirSync(QUARANTINE_DIR, { recursive: true, mode: 0o700 });
}

export interface QuarantinedUpload {
  tempFilePath: string;
  sha256Hash: string;
  sanitizedFilename: string;
  detectedMimeType: string;
  fileBuffer: Buffer;
  fileSizeBytes: number;
  validation: FileValidationResult;
  scanResult: ScanResult;
  allowed?: boolean;
  quarantined?: boolean;
}

export const quarantineService = {
  /**
   * Securely shreds and unlinks a quarantined temporary file to avoid persistent infection.
   */
  async purgeQuarantineFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        const stats = await fs.promises.stat(filePath);
        // Overwrite file with zeroes before unlinking (data shredding)
        const zeroBuffer = Buffer.alloc(stats.size, 0);
        await fs.promises.writeFile(filePath, zeroBuffer);
        await fs.promises.unlink(filePath);
      }
    } catch (err: any) {
      console.warn(`[QUARANTINE PURGE WARNING] Could not wipe file ${filePath}:`, err.message);
    }
  },

  /**
   * Processes an uploaded file through the quarantine isolation pipeline:
   * 1. Stage in local quarantine directory with 0600 permissions
   * 2. Calculate cryptographic SHA-256 digest
   * 3. Magic-byte and MIME validation
   * 4. Antivirus Scan in Quarantine (ClamAV / Heuristics)
   * 5. If infected: shred file, log security event, reject
   * 6. If clean: return verified payload and clean up temp staging
   */
  async processUpload(params: {
    rawBuffer?: Buffer;
    buffer?: Buffer;
    originalFilename: string;
    declaredMimeType?: string;
    actorBadge?: string;
    uploaderBadge?: string;
    clientIp?: string;
    maxSizeBytes?: number;
    context?: string;
  }): Promise<QuarantinedUpload> {
    const rawBuffer = params.rawBuffer || params.buffer;
    if (!rawBuffer || !Buffer.isBuffer(rawBuffer)) {
      throw new TypeError('processUpload requires a valid Buffer (rawBuffer or buffer)');
    }
    const {
      originalFilename,
      declaredMimeType = 'application/octet-stream',
      clientIp = '127.0.0.1',
      maxSizeBytes = 50 * 1024 * 1024,
    } = params;
    const actorBadge = params.actorBadge || params.uploaderBadge || 'SYSTEM';

    const tempId = `quarantine_${crypto.randomUUID()}`;
    const tempFilePath = path.join(QUARANTINE_DIR, `${tempId}.tmp`);

    try {
      // 1. Stage in quarantine directory with restricted 0600 file mode
      await fs.promises.writeFile(tempFilePath, rawBuffer, { mode: 0o600 });

      // 2. Stream & compute cryptographic SHA-256 digest
      const sha256Hash = calculateServerSha256(rawBuffer);

      // 3. Deep MIME & Magic-byte validation
      const validation = documentValidationService.validateEvidenceUpload(
        rawBuffer,
        originalFilename,
        declaredMimeType,
        maxSizeBytes
      );

      if (!validation.isValid) {
        await this.purgeQuarantineFile(tempFilePath);
        await securityService.logAlert({
          alertType: 'MIME_SPOOFING_DETECTED',
          severity: 'HIGH',
          actorBadge,
          ipAddress: clientIp,
          details: `Quarantine rejected file '${originalFilename}': ${validation.error}`,
        });
        throw new Error(`Upload rejected for security compliance: ${validation.error}`);
      }

      // 4. ClamAV & Heuristic Antivirus Inspection
      const scanResult = await antivirusService.scanBuffer(rawBuffer, validation.sanitizedFilename);

      if (!scanResult.isClean) {
        await this.purgeQuarantineFile(tempFilePath);
        const threatName = scanResult.virusName || scanResult.threatName || 'Malware.Detected';
        await securityService.logAlert({
          alertType: 'MALWARE_DETECTED',
          severity: 'CRITICAL',
          actorBadge,
          ipAddress: clientIp,
          details: `Malware detected in quarantine file '${originalFilename}': ${threatName}. Staging file destroyed.`,
        });
        throw new Error(`Security Alert: Upload blocked by Antivirus Scanner: Threat detected [${threatName}]. Quarantine payload shredded.`);
      }

      // 5. Clean up quarantine staging file once verification completes
      await this.purgeQuarantineFile(tempFilePath);

      return {
        tempFilePath,
        sha256Hash,
        sanitizedFilename: validation.sanitizedFilename,
        detectedMimeType: validation.detectedMimeType,
        fileBuffer: rawBuffer,
        fileSizeBytes: rawBuffer.length,
        validation,
        scanResult,
        allowed: true,
        quarantined: false,
      };
    } catch (err: any) {
      // Ensure file is always shredded if an error occurs
      await this.purgeQuarantineFile(tempFilePath);
      throw err;
    }
  },
};
