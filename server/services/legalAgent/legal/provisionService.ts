/**
 * e-CASEVAULT Structured Legal Provision Service
 * Phase 4 & Phase 20: Clean, Authoritative Statutory Provisions
 * Eliminates the "[Context: ...]" bug permanently at the storage/service layer.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../../../config/database';
import { ActService } from './actService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface LegalProvision {
  id: string;
  actCode: 'BNS' | 'BNSS' | 'BSA';
  sectionNumber: string;
  sectionTitle: string;
  chapter: string;
  provisionText: string;
  cleanText: string;
  sourceDocument: string;
  effectiveFrom: string;
  contentHash: string;
  keywords: string[];
}

export class ProvisionService {
  private static instance: ProvisionService;
  private provisions: Map<string, LegalProvision> = new Map(); // Key: `${act}:${sec}`
  private titleIndex: Map<string, LegalProvision[]> = new Map(); // Key: lowercase title
  private initialized = false;

  private constructor() {}

  public static getInstance(): ProvisionService {
    if (!ProvisionService.instance) {
      ProvisionService.instance = new ProvisionService();
    }
    return ProvisionService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const dataFilePath = path.resolve(__dirname, '../../../data/legal/bns_bnss_bsa_sections.json');
      if (!fs.existsSync(dataFilePath)) {
        console.warn('[ProvisionService] bns_bnss_bsa_sections.json not found at', dataFilePath);
        this.initialized = true;
        return;
      }

      const raw = fs.readFileSync(dataFilePath, 'utf8');
      const items = JSON.parse(raw);

      for (const item of items) {
        // Normalize act
        let actCode: 'BNS' | 'BNSS' | 'BSA' = 'BNS';
        const rawAct = (item.act || item.chunk_id || '').toUpperCase();
        if (rawAct.includes('BNSS')) actCode = 'BNSS';
        else if (rawAct.includes('BSA')) actCode = 'BSA';
        else actCode = 'BNS';

        const sectionNumber = String(item.section_number || '').trim();
        const sectionTitle = String(item.section_title || '').trim();
        const chapter = String(item.chapter || '').trim();
        const rawText = String(item.text || '').trim();

        // PHASE 20: Strip "[Context: This section is from...]" permanently!
        const cleanText = rawText.replace(/^\[Context:.*?\]\s*/i, '').trim();

        const contentHash = crypto
          .createHash('sha256')
          .update(`${actCode}:${sectionNumber}:${cleanText}`)
          .digest('hex');

        // Extract keywords from title and text
        const keywords = Array.from(
          new Set(
            `${sectionTitle} ${cleanText.substring(0, 300)}`
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, ' ')
              .split(/\s+/)
              .filter((w) => w.length > 3)
          )
        );

        const provision: LegalProvision = {
          id: `PROV-${actCode}-${sectionNumber}`,
          actCode,
          sectionNumber,
          sectionTitle,
          chapter,
          provisionText: cleanText,
          cleanText,
          sourceDocument: item.source_label || `${actCode} 2023`,
          effectiveFrom: '2024-07-01',
          contentHash,
          keywords,
        };

        const lookupKey = `${actCode}:${sectionNumber}`.toUpperCase();
        this.provisions.set(lookupKey, provision);

        // Populate title index
        const normalizedTitle = sectionTitle.toLowerCase().trim();
        const existing = this.titleIndex.get(normalizedTitle) || [];
        existing.push(provision);
        this.titleIndex.set(normalizedTitle, existing);
      }

      console.log(`[ProvisionService] ✅ Loaded ${this.provisions.size} clean statutory provisions into authoritative cache.`);
      this.initialized = true;

      // Asynchronously sync to PostgreSQL if database connection is available
      this.syncToDatabase().catch((syncErr) => {
        // Non-blocking note if local database is offline
      });
    } catch (err: any) {
      console.error('[ProvisionService] Initialization error:', err.message);
      this.initialized = true;
    }
  }

  /**
   * Syncs loaded in-memory provisions to PostgreSQL legal_acts & legal_provisions tables
   */
  private async syncToDatabase(): Promise<void> {
    try {
      const client = await pool.connect();
      try {
        const actService = ActService.getInstance();
        for (const act of actService.getAllActs()) {
          await client.query(
            `INSERT INTO legal_acts (id, act_code, act_name, jurisdiction, version, effective_from, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (act_code) DO NOTHING`,
            [act.id, act.act_code, act.act_name, act.jurisdiction, act.version, act.effective_from, act.status]
          );
        }

        const actMap = new Map<string, string>();
        const actRes = await client.query('SELECT id, act_code FROM legal_acts');
        for (const row of actRes.rows) {
          actMap.set(row.act_code, row.id);
        }

        for (const prov of this.provisions.values()) {
          const actId = actMap.get(prov.actCode);
          if (actId) {
            await client.query(
              `INSERT INTO legal_provisions 
               (act_id, section_number, section_title, chapter, provision_text, source_document, content_hash, search_vector)
               VALUES ($1, $2, $3, $4, $5, $6, $7, to_tsvector('english', $8))
               ON CONFLICT (act_id, section_number) DO UPDATE
               SET provision_text = EXCLUDED.provision_text,
                   section_title = EXCLUDED.section_title,
                   chapter = EXCLUDED.chapter,
                   content_hash = EXCLUDED.content_hash,
                   search_vector = to_tsvector('english', $8)`,
              [
                actId,
                prov.sectionNumber,
                prov.sectionTitle,
                prov.chapter,
                prov.cleanText,
                prov.sourceDocument,
                prov.contentHash,
                `${prov.sectionTitle} ${prov.cleanText}`,
              ]
            );
          }
        }
        console.log('[ProvisionService] ✅ Synchronized provisions to PostgreSQL legal_provisions.');
      } finally {
        client.release();
      }
    } catch {
      // Offline fallback is expected in test/offline environments
    }
  }

  /**
   * Deterministic exact section lookup (Phase 7)
   */
  public getExactSection(actCode: string, sectionNumber: string): LegalProvision | null {
    const key = `${actCode.trim().toUpperCase()}:${sectionNumber.trim().toUpperCase()}`;
    return this.provisions.get(key) || null;
  }

  /**
   * Exact title match (Phase 8) e.g. "Attempt to murder"
   */
  public getProvisionsByExactTitle(title: string): LegalProvision[] {
    const key = title.toLowerCase().trim();
    return this.titleIndex.get(key) || [];
  }

  public getAllProvisions(actFilter?: 'BNS' | 'BNSS' | 'BSA'): LegalProvision[] {
    const all = Array.from(this.provisions.values());
    if (!actFilter) return all;
    return all.filter((p) => p.actCode === actFilter);
  }

  public getById(id: string): LegalProvision | null {
    for (const p of this.provisions.values()) {
      if (p.id === id) return p;
    }
    return null;
  }
}
