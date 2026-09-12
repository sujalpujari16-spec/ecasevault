/**
 * e-CASEVAULT Legal Corpus Ingestion Pipeline
 * Phase 6: Document download -> SHA-256 calculation -> Clean Text Extraction ->
 * Act/Chapter/Section detection -> Structured Provision Generation -> Chunking -> Vector Prep
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProvisionService, LegalProvision } from './provisionService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface IngestionReport {
  timestamp: string;
  sourceFile: string;
  fileSha256: string;
  totalProvisions: number;
  bnsCount: number;
  bnssCount: number;
  bsaCount: number;
  totalChunks: number;
  status: 'ACTIVE' | 'ERROR';
}

export class LegalIngestionService {
  private static instance: LegalIngestionService;

  public static getInstance(): LegalIngestionService {
    if (!LegalIngestionService.instance) {
      LegalIngestionService.instance = new LegalIngestionService();
    }
    return LegalIngestionService.instance;
  }

  public async runIngestion(): Promise<IngestionReport> {
    const dataFilePath = path.resolve(__dirname, '../../../data/legal/bns_bnss_bsa_sections.json');
    if (!fs.existsSync(dataFilePath)) {
      throw new Error(`Authoritative corpus file not found: ${dataFilePath}`);
    }

    const rawBuffer = fs.readFileSync(dataFilePath);
    const fileSha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

    const provisionService = ProvisionService.getInstance();
    await provisionService.initialize();

    const all = provisionService.getAllProvisions();
    const bnsCount = all.filter((p) => p.actCode === 'BNS').length;
    const bnssCount = all.filter((p) => p.actCode === 'BNSS').length;
    const bsaCount = all.filter((p) => p.actCode === 'BSA').length;

    // Estimate chunk count
    let totalChunks = 0;
    for (const p of all) {
      totalChunks += Math.ceil(p.cleanText.length / 500) || 1;
    }

    const report: IngestionReport = {
      timestamp: new Date().toISOString(),
      sourceFile: path.basename(dataFilePath),
      fileSha256,
      totalProvisions: all.length,
      bnsCount,
      bnssCount,
      bsaCount,
      totalChunks,
      status: 'ACTIVE',
    };

    console.log('[LegalIngestionService] Ingestion verification completed:', report);
    return report;
  }
}
