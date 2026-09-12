import 'dotenv/config';
import { pool } from '../config/database';

export async function runLegalMigration() {
  console.log('[LEGAL MIGRATION] Executing structured legal & AI audit schema migration...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Create pgvector extension if supported
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    } catch (extErr: any) {
      console.warn('[LEGAL MIGRATION] pgvector extension not available on this host:', extErr.message);
    }
    
    // 2. Create legal_acts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS legal_acts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          act_code VARCHAR(20) NOT NULL UNIQUE,
          act_name TEXT NOT NULL,
          jurisdiction TEXT DEFAULT 'Union of India / Maharashtra',
          language VARCHAR(20) DEFAULT 'en',
          version VARCHAR(50) DEFAULT '2023 Enactments',
          effective_from DATE DEFAULT '2024-07-01',
          effective_to DATE,
          source_url TEXT,
          source_document TEXT,
          content_hash CHAR(64),
          status VARCHAR(20) DEFAULT 'ACTIVE',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 3. Create legal_provisions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS legal_provisions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          act_id UUID NOT NULL REFERENCES legal_acts(id) ON DELETE CASCADE,
          section_number VARCHAR(30) NOT NULL,
          section_title TEXT,
          chapter TEXT,
          subsection TEXT,
          provision_text TEXT NOT NULL,
          source_page INTEGER,
          source_document TEXT,
          effective_from DATE DEFAULT '2024-07-01',
          effective_to DATE,
          content_hash CHAR(64),
          search_vector TSVECTOR,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT uq_act_section UNIQUE(act_id, section_number)
      );
      CREATE INDEX IF NOT EXISTS idx_legal_provisions_lookup ON legal_provisions(act_id, section_number);
      CREATE INDEX IF NOT EXISTS idx_legal_provisions_title ON legal_provisions(lower(section_title));
      CREATE INDEX IF NOT EXISTS idx_legal_provisions_tsv ON legal_provisions USING GIN (search_vector);
    `);

    // 4. Create legal_chunks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS legal_chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          provision_id UUID NOT NULL REFERENCES legal_provisions(id) ON DELETE CASCADE,
          chunk_index INTEGER NOT NULL,
          chunk_text TEXT NOT NULL,
          token_count INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          CONSTRAINT uq_provision_chunk UNIQUE(provision_id, chunk_index)
      );
    `);

    // 5. Create ai_audit_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_audit_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id VARCHAR(100) NOT NULL,
          case_id VARCHAR(100),
          event_type VARCHAR(50) NOT NULL,
          query_hash CHAR(64),
          tool_name VARCHAR(100),
          status VARCHAR(20),
          sources JSONB,
          metadata JSONB,
          event_hash CHAR(64),
          fabric_tx_id VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_audit_events_user ON ai_audit_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_audit_events_type ON ai_audit_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_ai_audit_events_case ON ai_audit_events(case_id);
    `);

    await client.query('COMMIT');
    console.log('[LEGAL MIGRATION] ✅ Successfully verified and created legal & AI audit tables.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[LEGAL MIGRATION ERROR]', err);
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate_legal.ts')) {
  runLegalMigration().finally(() => pool.end());
}
