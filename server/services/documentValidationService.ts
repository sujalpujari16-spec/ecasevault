import path from 'path';

export interface FileValidationResult {
  isValid: boolean;
  sanitizedFilename: string;
  detectedMimeType: string;
  fileSizeBytes: number;
  error?: string;
}

// Prohibited dangerous extensions that could lead to remote code execution or malware
const PROHIBITED_EXTENSIONS = new Set([
  'exe', 'dll', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh',
  'msc', 'msi', 'msp', 'com', 'scr', 'hta', 'cpl', 'jar', 'apk', 'elf', 'bin', 'ps1',
  'py', 'rb', 'php', 'phtml', 'asp', 'aspx', 'jsp'
]);

// Allowed digital evidence extensions
const ALLOWED_EXTENSIONS = new Set([
  // Documents
  'pdf', 'txt', 'csv', 'rtf', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'json', 'xml',
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg',
  // Audio / Video / Forensics
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'mp3', 'wav', 'aac', 'ogg', 'm4a', 'flac',
  // Forensic dumps / Compressed archives
  'zip', 'tar', 'gz', '7z', 'rar', 'pcap', 'pcapng', 'dd', 'raw', 'e01', 'eml', 'msg'
]);

/**
 * Helper to inspect raw buffer for ZIP entries without extracting.
 */
export function hasZipEntryPattern(buffer: Buffer, entryPattern: string): boolean {
  return buffer.includes(Buffer.from(entryPattern, 'utf8'));
}

/**
 * Validates binary magic numbers to guarantee the uploaded file matches its declared format,
 * blocking MIME-spoofing and hidden executable payloads.
 */
export function detectMagicBytes(buffer: Buffer, expectedFilenameOrExt?: string): string | null {
  if (buffer.length < 4) return null;

  // Rejection of executable headers masquerading as documents
  // Windows DOS/PE (MZ)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return 'application/x-dosexec';
  }

  // Linux ELF (\x7FELF)
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return 'application/x-elf';
  }

  // Mach-O (macOS binaries)
  if (
    (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && (buffer[3] === 0xce || buffer[3] === 0xcf)) ||
    (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
    (buffer[0] === 0xce && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
    (buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe)
  ) {
    return 'application/x-mach-binary';
  }

  // PDF (%PDF-)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }

  // PNG (\x89PNG\r\n\x1a\n)
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }

  // JPEG (\xFF\xD8\xFF)
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // GIF (GIF87a or GIF89a)
  if (buffer.toString('ascii', 0, 4) === 'GIF8') {
    return 'image/gif';
  }

  // ZIP and Office OpenXML formats (PK\x03\x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    // Deep inspection of internal ZIP directory structure for Office documents
    const hasContentTypes = hasZipEntryPattern(buffer, '[Content_Types].xml');
    if (hasContentTypes && (hasZipEntryPattern(buffer, 'word/') || hasZipEntryPattern(buffer, 'word/document.xml'))) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; // docx
    }
    if (hasContentTypes && (hasZipEntryPattern(buffer, 'xl/') || hasZipEntryPattern(buffer, 'xl/workbook.xml'))) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; // xlsx
    }
    if (hasContentTypes && (hasZipEntryPattern(buffer, 'ppt/') || hasZipEntryPattern(buffer, 'ppt/presentation.xml'))) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'; // pptx
    }

    if (expectedFilenameOrExt) {
      const ext = path.extname(expectedFilenameOrExt).toLowerCase() || expectedFilenameOrExt.toLowerCase();
      if (['.docx', '.xlsx', '.pptx', 'docx', 'xlsx', 'pptx'].includes(ext)) {
        return null; // Lacks OpenXML structure, cannot be valid docx/xlsx/pptx
      }
    }

    return 'application/zip';
  }

  // WebP (RIFF....WEBP)
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }

  // MP4 / QuickTime (....ftyp)
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4';
  }

  // PCAP capture file (\xD4\xC3\xB2\xA1 or \xA1\xB2\xC3\xD4)
  if (
    (buffer[0] === 0xd4 && buffer[1] === 0xc3 && buffer[2] === 0xb2 && buffer[3] === 0xa1) ||
    (buffer[0] === 0xa1 && buffer[1] === 0xb2 && buffer[2] === 0xc3 && buffer[3] === 0xd4)
  ) {
    return 'application/vnd.tcpdump.pcap';
  }

  return null;
}

export const documentValidationService = {
  /**
   * Sanitizes a filename to protect against Path Traversal, null-byte injection, and control characters.
   */
  sanitizeFilename(originalName: string): string {
    // Strip directory path
    let clean = path.basename(originalName);
    // Remove null bytes and control chars
    clean = clean.replace(/[\x00-\x1f\x7f]/g, '');
    // Replace dangerous characters with underscore
    clean = clean.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Ensure filename is not empty or dots only
    if (!clean || clean.replace(/\./g, '').length === 0) {
      clean = `evidence_${Date.now()}`;
    }
    return clean;
  },

  /**
   * Comprehensive security check of evidence upload.
   */
  validateEvidenceUpload(
    buffer: Buffer,
    originalName: string,
    declaredMimeType: string,
    maxSizeBytes = 50 * 1024 * 1024
  ): FileValidationResult {
    // 1. Check file size
    if (!buffer || buffer.length === 0) {
      return {
        isValid: false,
        sanitizedFilename: originalName,
        detectedMimeType: declaredMimeType,
        fileSizeBytes: 0,
        error: 'Upload rejected: File buffer is empty (0 bytes).',
      };
    }

    if (buffer.length > maxSizeBytes) {
      return {
        isValid: false,
        sanitizedFilename: originalName,
        detectedMimeType: declaredMimeType,
        fileSizeBytes: buffer.length,
        error: `Upload rejected: File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${(maxSizeBytes / (1024 * 1024)).toFixed(0)} MB.`,
      };
    }

    // 2. Path traversal attack rejection
    if (originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
      return {
        isValid: false,
        sanitizedFilename: this.sanitizeFilename(originalName),
        detectedMimeType: declaredMimeType,
        fileSizeBytes: buffer.length,
        error: 'Security violation: Path traversal attempt detected in filename.',
      };
    }

    // 3. Dangerous double-extension detection (e.g., file.php.pdf)
    const nameParts = originalName.split('.');
    if (nameParts.length > 2) {
      for (let i = 1; i < nameParts.length - 1; i++) {
        if (PROHIBITED_EXTENSIONS.has(nameParts[i].toLowerCase())) {
          return {
            isValid: false,
            sanitizedFilename: this.sanitizeFilename(originalName),
            detectedMimeType: declaredMimeType,
            fileSizeBytes: buffer.length,
            error: `Security violation: Hidden dangerous extension '.${nameParts[i]}' detected in multi-extension file.`,
          };
        }
      }
    }

    // 4. Sanitize filename and extract extension
    const sanitizedFilename = this.sanitizeFilename(originalName);
    const ext = sanitizedFilename.split('.').pop()?.toLowerCase() || '';

    // 5. Reject explicitly prohibited executable/script extensions
    if (PROHIBITED_EXTENSIONS.has(ext)) {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: declaredMimeType,
        fileSizeBytes: buffer.length,
        error: `Security violation: File extension '.${ext}' is prohibited in evidence vault to prevent code execution.`,
      };
    }

    // 4. Verify extension is within allowed evidence types
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: declaredMimeType,
        fileSizeBytes: buffer.length,
        error: `Upload rejected: File extension '.${ext}' is not supported in the legal evidence vault.`,
      };
    }

    // 5. Inspect magic bytes for binary format verification
    const magicMime = detectMagicBytes(buffer);

    // Check for hidden executable headers
    if (magicMime && (magicMime === 'application/x-dosexec' || magicMime === 'application/x-elf' || magicMime === 'application/x-mach-binary')) {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: magicMime,
        fileSizeBytes: buffer.length,
        error: `MIME Spoofing detected: Executable binary header detected in file '${originalName}'.`,
      };
    }

    // If file claims to be PDF or image, enforce magic byte consistency
    if (ext === 'pdf' && magicMime && magicMime !== 'application/pdf') {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: magicMime,
        fileSizeBytes: buffer.length,
        error: `MIME Spoofing detected: File declares '.pdf' but header indicates '${magicMime}'.`,
      };
    }

    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext) && magicMime && !magicMime.startsWith('image/')) {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: magicMime,
        fileSizeBytes: buffer.length,
        error: `MIME Spoofing detected: File declares an image extension but magic header indicates '${magicMime}'.`,
      };
    }

    // Deep inspection for Office OpenXML documents
    if (ext === 'docx' && magicMime !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: magicMime || 'application/octet-stream',
        fileSizeBytes: buffer.length,
        error: `Document validation failed: File has .docx extension but lacks valid Word document OpenXML structure.`,
      };
    }

    if (ext === 'xlsx' && magicMime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: magicMime || 'application/octet-stream',
        fileSizeBytes: buffer.length,
        error: `Document validation failed: File has .xlsx extension but lacks valid Excel workbook OpenXML structure.`,
      };
    }

    if (ext === 'pptx' && magicMime !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return {
        isValid: false,
        sanitizedFilename,
        detectedMimeType: magicMime || 'application/octet-stream',
        fileSizeBytes: buffer.length,
        error: `Document validation failed: File has .pptx extension but lacks valid PowerPoint OpenXML structure.`,
      };
    }

    return {
      isValid: true,
      sanitizedFilename,
      detectedMimeType: magicMime || declaredMimeType || 'application/octet-stream',
      fileSizeBytes: buffer.length,
    };
  },

  validateFile(
    buffer: Buffer,
    originalName: string,
    declaredMimeType = 'application/octet-stream',
    maxSizeBytes?: number
  ): FileValidationResult {
    return this.validateEvidenceUpload(buffer, originalName, declaredMimeType, maxSizeBytes);
  },
};

export const validateUploadedDocument = (buffer: Buffer, filename: string, declaredMimeType?: string) =>
  documentValidationService.validateFile(buffer, filename, declaredMimeType);
