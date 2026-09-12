-- ============================================================================
-- Migration 005: Canonical 5 Roles & Case Repository Document Management System
-- ============================================================================

-- 1. Update Users Table Role Constraint to 5 Canonical Stakeholder Roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN'));

-- 2. Update Cases Table to reflect Case Repository ownership
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lead_investigator VARCHAR(255);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS lead_investigator_badge VARCHAR(50);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS department_in_charge VARCHAR(50) DEFAULT 'POLICE';

-- Populate lead investigator from previous assigned_io if available
UPDATE cases SET 
    lead_investigator = COALESCE(assigned_io, pi_in_charge, 'Station Investigating Team'),
    lead_investigator_badge = COALESCE(assigned_io_badge, 'MH-POL-01')
WHERE lead_investigator IS NULL;

-- 3. Create Case Repository Documents Table
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL CHECK (department IN ('POLICE', 'FORENSIC', 'LEGAL')),
    classification VARCHAR(50) NOT NULL DEFAULT 'CONFIDENTIAL',
    created_by VARCHAR(255) NOT NULL,
    created_by_badge VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    current_version_id VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
);

-- 4. Create Document Versions Table
CREATE TABLE IF NOT EXISTS document_versions (
    id VARCHAR(50) PRIMARY KEY,
    document_id VARCHAR(50) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL,
    signed_by VARCHAR(50) NOT NULL,
    clamav_status VARCHAR(20) NOT NULL DEFAULT 'CLEAN',
    blockchain_tx_id VARCHAR(100),
    supersedes_version_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Create Forensic Requests Table
CREATE TABLE IF NOT EXISTS forensic_requests (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id VARCHAR(50) REFERENCES evidence(id),
    request_type VARCHAR(100) NOT NULL,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'UNDER_EXAMINATION', 'REPORT_FILED', 'REJECTED')),
    requested_by VARCHAR(50) NOT NULL,
    assigned_to VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Create Legal Records Table
CREATE TABLE IF NOT EXISTS legal_records (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    record_type VARCHAR(100) NOT NULL,
    court_name VARCHAR(255) NOT NULL,
    hearing_date DATE,
    judge_or_magistrate VARCHAR(255),
    summary TEXT NOT NULL,
    document_id VARCHAR(50) REFERENCES documents(id),
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_dept ON documents(department);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_hash ON document_versions(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_forensic_case ON forensic_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case ON legal_records(case_id);
