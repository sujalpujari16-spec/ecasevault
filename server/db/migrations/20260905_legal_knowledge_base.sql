-- ==============================================================================
-- e-CASEVAULT ENTERPRISE MIGRATION: 20260905_legal_knowledge_base.sql
-- Substantive & Procedural Criminal Law Knowledge Base (BNS, BNSS, BSA 2023)
-- Reference: GSMS-B Indian Legal Sections & RAG Corpus
-- ==============================================================================

-- Enable pgvector extension if available on PostgreSQL / Supabase
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: legal_acts
CREATE TABLE IF NOT EXISTS legal_acts (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    enactment_year INTEGER NOT NULL,
    effective_date DATE DEFAULT '2024-07-01',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO legal_acts (code, name, enactment_year, effective_date, description)
VALUES 
    ('BNS', 'Bharatiya Nyaya Sanhita, 2023', 2023, '2024-07-01', 'Substantive penal law replacing the Indian Penal Code, 1860'),
    ('BNSS', 'Bharatiya Nagarik Suraksha Sanhita, 2023', 2023, '2024-07-01', 'Procedural criminal code replacing the Code of Criminal Procedure, 1973'),
    ('BSA', 'Bharatiya Sakshya Adhiniyam, 2023', 2023, '2024-07-01', 'Law of evidence replacing the Indian Evidence Act, 1872')
ON CONFLICT (code) DO NOTHING;

-- Table: legal_sections
CREATE TABLE IF NOT EXISTS legal_sections (
    id VARCHAR(50) PRIMARY KEY, -- e.g. BNS_103
    act_code VARCHAR(10) REFERENCES legal_acts(code) ON DELETE CASCADE,
    section_number VARCHAR(20) NOT NULL,
    section_title VARCHAR(500) NOT NULL,
    chapter VARCHAR(255) NOT NULL,
    official_text TEXT NOT NULL,
    simplified_explanation TEXT,
    punishment TEXT,
    cognizable BOOLEAN DEFAULT TRUE,
    bailable BOOLEAN DEFAULT FALSE,
    keywords TEXT[],
    sha256_hash VARCHAR(64) NOT NULL,
    version VARCHAR(20) DEFAULT '2026-v1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_sections_act_num ON legal_sections(act_code, section_number);
CREATE INDEX IF NOT EXISTS idx_legal_sections_title ON legal_sections USING gin(to_tsvector('english', section_title));
CREATE INDEX IF NOT EXISTS idx_legal_sections_text ON legal_sections USING gin(to_tsvector('english', official_text));

-- Table: legal_cross_references (Old vs New Criminal Law Mapping)
CREATE TABLE IF NOT EXISTS legal_cross_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_act VARCHAR(20) NOT NULL, -- IPC, CrPC, IEA
    legacy_section VARCHAR(20) NOT NULL,
    legacy_title VARCHAR(500) NOT NULL,
    new_act VARCHAR(10) REFERENCES legal_acts(code),
    new_section VARCHAR(20) NOT NULL,
    new_title VARCHAR(500) NOT NULL,
    key_changes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cross_ref_legacy ON legal_cross_references(legacy_act, legacy_section);
CREATE INDEX IF NOT EXISTS idx_cross_ref_new ON legal_cross_references(new_act, new_section);

-- Table: legal_embeddings (pgvector for semantic search)
CREATE TABLE IF NOT EXISTS legal_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id VARCHAR(50) REFERENCES legal_sections(id) ON DELETE CASCADE,
    chunk_index INTEGER DEFAULT 0,
    chunk_text TEXT NOT NULL,
    embedding vector(384), -- Supports MiniLM / local embeddings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: legal_query_audit (Traceability of Police Law Assistant queries)
CREATE TABLE IF NOT EXISTS legal_query_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    badge_number VARCHAR(50),
    case_id VARCHAR(50),
    query_text TEXT NOT NULL,
    matched_intent VARCHAR(50),
    retrieved_sections TEXT[],
    latency_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_query_audit_time ON legal_query_audit(created_at DESC);
