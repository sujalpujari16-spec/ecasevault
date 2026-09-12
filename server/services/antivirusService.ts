import net from 'net';
import crypto from 'crypto';

export interface ScanResult {
  isClean: boolean;
  isInfected?: boolean;
  virusName?: string;
  threatName?: string;
  engine: 'ClamAV-Daemon' | 'Heuristic-Engine';
  scanDurationMs: number;
  threatDetails?: string;
  details?: string;
}

// Standard EICAR Antivirus Test Signature (standard test file string for AV scanners)
const EICAR_SIGNATURE = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

// Known malicious script patterns & polyglot signatures
const MALICIOUS_PATTERNS: Array<{ pattern: RegExp | string; name: string }> = [
  { pattern: EICAR_SIGNATURE, name: 'EICAR-Test-Signature.Standard' },
  { pattern: /<\?php[\s\S]{0,100}(?:eval|system|exec|passthru|shell_exec|base64_decode)/i, name: 'WebShell.PHP.PolyglotInjection' },
  { pattern: /<script[\s\S]{0,100}(?:document\.cookie|window\.location|fetch\(["']http)/i, name: 'MaliciousScript.XSS.Payload' },
  { pattern: /powershell(?:\.exe)?\s+(?:-[eE]n?c?o?d?e?d?C?o?m?m?a?n?d?|-nop|-w\s+hidden)/i, name: 'Trojan.PowerShell.SuspiciousExecution' },
  { pattern: /cmd(?:\.exe)?\s+\/[ck]\s+(?:curl|certutil|bitsadmin|powershell)/i, name: 'Suspicious.Cmd.DownloaderPayload' },
  { pattern: /__import__\(['"]os['"]\)\.system/i, name: 'Exploit.Python.SystemExecution' },
];

/**
 * High-performance Antivirus scanner supporting both ClamAV daemon socket/TCP
 * and an embedded fallback heuristic/signature engine with zero external downtime.
 */
export const antivirusService = {
  /**
   * Scans a file buffer for viruses, malware signatures, and embedded polyglot threats.
   */
  async scanBuffer(buffer: Buffer, filename: string): Promise<ScanResult> {
    const startTime = Date.now();

    // 1. Try ClamAV daemon via TCP if configured
    const clamHost = process.env.CLAMAV_HOST;
    const clamPort = parseInt(process.env.CLAMAV_PORT || '3310', 10);

    if (clamHost) {
      try {
        const daemonResult = await this.scanWithClamDaemon(buffer, clamHost, clamPort);
        if (daemonResult) {
          const isClean = daemonResult.isClean;
          return {
            ...daemonResult,
            isInfected: !isClean,
            threatName: daemonResult.virusName,
            details: daemonResult.threatDetails,
            scanDurationMs: Date.now() - startTime,
          };
        }
      } catch (err) {
        // ClamAV daemon connection failed; gracefully fallback to heuristic engine
        console.warn(`[ANTIVIRUS] ClamAV daemon at ${clamHost}:${clamPort} unreachable, falling back to local heuristic scanner.`);
      }
    }

    // 2. Embedded High-Performance Signature & Heuristic Scanner
    const heuristicResult = this.scanHeuristics(buffer, filename);
    const isClean = heuristicResult.isClean;
    return {
      ...heuristicResult,
      isInfected: !isClean,
      threatName: heuristicResult.virusName,
      details: heuristicResult.threatDetails,
      scanDurationMs: Date.now() - startTime,
    };
  },

  /**
   * Performs signature and heuristic checks against the buffer.
   */
  scanHeuristics(buffer: Buffer, filename: string): Omit<ScanResult, 'scanDurationMs'> {
    // Check 1: EICAR test signature
    const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 65536));
    if (bufferString.includes(EICAR_SIGNATURE)) {
      return {
        isClean: false,
        virusName: 'EICAR-Test-Signature.Standard',
        engine: 'Heuristic-Engine',
        threatDetails: 'Detected standard EICAR antivirus test signature in payload.',
      };
    }

    // Check 2: Raw byte inspection for DOS/PE Windows executables (MZ header)
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      // Check if file is masquerading as a non-executable (e.g. .pdf, .jpg, .png)
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (['pdf', 'png', 'jpg', 'jpeg', 'mp4', 'docx', 'xlsx', 'txt'].includes(ext)) {
        return {
          isClean: false,
          virusName: 'Masqueraded.Executable.MZHeader',
          engine: 'Heuristic-Engine',
          threatDetails: `File ${filename} has extension .${ext} but starts with executable MZ header (0x4D5A).`,
        };
      }
    }

    // Check 3: Raw byte inspection for Linux ELF binaries (0x7F 'E' 'L' 'F')
    if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (['pdf', 'png', 'jpg', 'jpeg', 'mp4', 'docx', 'xlsx', 'txt'].includes(ext)) {
        return {
          isClean: false,
          virusName: 'Masqueraded.Binary.ELFHeader',
          engine: 'Heuristic-Engine',
          threatDetails: `File ${filename} has extension .${ext} but starts with ELF executable binary header.`,
        };
      }
    }

    // Check 4: Inspect text/script content for web shell or execution patterns
    for (const { pattern, name } of MALICIOUS_PATTERNS) {
      if (typeof pattern === 'string') {
        if (bufferString.includes(pattern)) {
          return {
            isClean: false,
            virusName: name,
            engine: 'Heuristic-Engine',
            threatDetails: `Pattern match for ${name}`,
          };
        }
      } else if (pattern.test(bufferString)) {
        return {
          isClean: false,
          virusName: name,
          engine: 'Heuristic-Engine',
          threatDetails: `Pattern match for ${name}`,
        };
      }
    }

    // Passed all heuristic and signature checks
    return {
      isClean: true,
      engine: 'Heuristic-Engine',
    };
  },

  /**
   * Scans buffer against ClamAV clamd daemon using the INSTREAM command.
   */
  async scanWithClamDaemon(buffer: Buffer, host: string, port: number): Promise<Omit<ScanResult, 'scanDurationMs'> | null> {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let responseData = '';

      client.setTimeout(5000);

      client.connect(port, host, () => {
        // Send INSTREAM command
        client.write('zINSTREAM\0');

        // Stream buffer in chunks prefixed with 4-byte big-endian chunk lengths
        const chunkSize = 2048;
        for (let i = 0; i < buffer.length; i += chunkSize) {
          const chunk = buffer.subarray(i, i + chunkSize);
          const lengthHeader = Buffer.alloc(4);
          lengthHeader.writeUInt32BE(chunk.length, 0);
          client.write(lengthHeader);
          client.write(chunk);
        }

        // Send 0-length chunk to denote end of stream
        const endHeader = Buffer.alloc(4);
        endHeader.writeUInt32BE(0, 0);
        client.write(endHeader);
      });

      client.on('data', (data) => {
        responseData += data.toString('utf8');
      });

      client.on('end', () => {
        client.destroy();
        const trimmed = responseData.trim();
        if (trimmed.includes('OK')) {
          resolve({
            isClean: true,
            engine: 'ClamAV-Daemon',
          });
        } else if (trimmed.includes('FOUND')) {
          const match = trimmed.match(/stream:\s+(.+)\s+FOUND/);
          resolve({
            isClean: false,
            virusName: match ? match[1] : 'ClamAV.Threat.Detected',
            engine: 'ClamAV-Daemon',
            threatDetails: trimmed,
          });
        } else {
          resolve({
            isClean: true,
            engine: 'ClamAV-Daemon',
          });
        }
      });

      client.on('timeout', () => {
        client.destroy();
        reject(new Error('ClamAV socket timed out'));
      });

      client.on('error', (err) => {
        client.destroy();
        reject(err);
      });
    });
  },
};

export const scanBuffer = (buffer: Buffer, filename: string) => antivirusService.scanBuffer(buffer, filename);
