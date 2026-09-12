-- ============================================================================
-- MAHARASHTRA POLICE DIGITAL EVIDENCE VAULT (e-CASEVAULT)
-- SUPABASE ENTERPRISE DATABASE MIGRATION & RLS POLICIES
-- Target: Supabase PostgreSQL
-- ============================================================================

-- Enable pgcrypto for UUID generation if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE (Linked to auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN')),
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    employee_id TEXT UNIQUE NOT NULL,
    badge_no TEXT,
    station_id TEXT,
    station_name TEXT,
    clearance_level TEXT NOT NULL DEFAULT 'CONFIDENTIAL',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_badge_no ON profiles(badge_no);

-- ============================================================================
-- 2. CASES TABLE (Central Case Repository Anchor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT UNIQUE NOT NULL,
    fir_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    crime_type TEXT NOT NULL,
    incident_date DATE,
    incident_time TIME,
    incident_location TEXT,
    police_station TEXT NOT NULL,
    jurisdiction_zone TEXT DEFAULT 'Mumbai Metropolitan',
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'FIR Registered' CHECK (status IN (
        'FIR Registered',
        'Investigation Ongoing',
        'Evidence Pending',
        'Forensic Examination',
        'Legal Review',
        'Charge Sheet / Court Process',
        'Closed'
    )),
    classification TEXT NOT NULL DEFAULT 'CONFIDENTIAL' CHECK (classification IN ('CONFIDENTIAL', 'RESTRICTED', 'SECRET')),
    lead_investigator UUID REFERENCES profiles(id) ON DELETE SET NULL,
    lead_investigator_name TEXT,
    lead_investigator_badge TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number);
CREATE INDEX IF NOT EXISTS idx_cases_fir_number ON cases(fir_number);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_police_station ON cases(police_station);

-- ============================================================================
-- 3. FIR RECORDS TABLE (First Information Report Document Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS fir_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    fir_number TEXT NOT NULL,
    fir_date DATE NOT NULL DEFAULT CURRENT_DATE,
    police_station TEXT NOT NULL,
    sections_of_law TEXT[] NOT NULL DEFAULT '{}',
    complainant_details JSONB,
    incident_description TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fir_records_case_id ON fir_records(case_id);

-- ============================================================================
-- 4. CASE MEMBERS TABLE (Cross-Departmental Case Collaboration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS case_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    department TEXT NOT NULL CHECK (department IN ('POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN')),
    access_level TEXT NOT NULL DEFAULT 'READ_WRITE' CHECK (access_level IN ('READ_ONLY', 'READ_WRITE', 'ADMIN')),
    added_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(case_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_case_members_case_id ON case_members(case_id);
CREATE INDEX IF NOT EXISTS idx_case_members_user_id ON case_members(user_id);

-- ============================================================================
-- 5. DOCUMENTS TABLE (First-Class DMS Documents in Case Repository)
-- ============================================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    department TEXT NOT NULL CHECK (department IN ('POLICE', 'FORENSIC', 'LEGAL')),
    classification TEXT NOT NULL DEFAULT 'CONFIDENTIAL' CHECK (classification IN ('CONFIDENTIAL', 'RESTRICTED', 'SECRET')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    current_version_id UUID,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department);

-- ============================================================================
-- 6. DOCUMENT VERSIONS TABLE (Non-Destructive Versioning & Crypto Signatures)
-- ============================================================================
CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    storage_bucket TEXT NOT NULL DEFAULT 'case-documents',
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    sha256_hash TEXT NOT NULL,
    signature TEXT NOT NULL,
    signing_key_id TEXT NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blockchain_tx_id TEXT,
    blockchain_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (blockchain_status IN ('PENDING', 'CONFIRMED', 'FAILED', 'UNAVAILABLE')),
    change_summary TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supersedes_version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
    UNIQUE(document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_sha256 ON document_versions(sha256_hash);

-- Add foreign key back to documents.current_version_id
ALTER TABLE documents 
ADD CONSTRAINT fk_documents_current_version 
FOREIGN KEY (current_version_id) REFERENCES document_versions(id) ON DELETE SET NULL;

-- ============================================================================
-- 7. EVIDENCE TABLE (Physical & Digital Seized Evidence Items)
-- ============================================================================
CREATE TABLE IF NOT EXISTS evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_number TEXT UNIQUE NOT NULL,
    evidence_type TEXT NOT NULL,
    description TEXT NOT NULL,
    collection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    collection_location TEXT NOT NULL,
    collected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    current_custodian UUID REFERENCES profiles(id) ON DELETE SET NULL,
    hash TEXT NOT NULL,
    storage_path TEXT,
    status TEXT NOT NULL DEFAULT 'SEIZED_IN_MALKHANA' CHECK (status IN (
        'SEIZED_IN_MALKHANA',
        'TRANSFERRED_TO_FSL',
        'UNDER_FORENSIC_EXAMINATION',
        'RETURNED_FROM_FSL',
        'PRODUCED_IN_COURT',
        'DISPOSED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_case_id ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_number ON evidence(evidence_number);

-- ============================================================================
-- 8. EVIDENCE TRANSFERS TABLE (Immutable Chain of Custody)
-- ============================================================================
CREATE TABLE IF NOT EXISTS evidence_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    from_user UUID REFERENCES profiles(id) ON DELETE SET NULL,
    to_user UUID REFERENCES profiles(id) ON DELETE SET NULL,
    from_department TEXT NOT NULL,
    to_department TEXT NOT NULL,
    transfer_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    remarks TEXT,
    previous_hash TEXT NOT NULL,
    new_hash TEXT NOT NULL,
    blockchain_tx_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_transfers_evidence_id ON evidence_transfers(evidence_id);

-- ============================================================================
-- 9. FORENSIC REQUESTS TABLE (Police <-> Forensic Collaboration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS forensic_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'RECEIVED_AT_LAB', 'UNDER_ANALYSIS', 'REPORT_FILED')),
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('NORMAL', 'HIGH', 'URGENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_forensic_requests_case_id ON forensic_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_forensic_requests_evidence_id ON forensic_requests(evidence_id);

-- ============================================================================
-- 10. LEGAL RECORDS TABLE (Prosecution & Court Proceedings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS legal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL,
    court_name TEXT NOT NULL,
    court_case_number TEXT,
    hearing_date DATE,
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_records_case_id ON legal_records(case_id);

-- ============================================================================
-- 11. AUDIT LOGS TABLE (Cryptographically Linked Audit Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    previous_log_hash TEXT,
    log_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_case_id ON audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- 12. BLOCKCHAIN ANCHORS TABLE (Hyperledger Fabric Immutable Proof Records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS blockchain_anchors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    version_id UUID REFERENCES document_versions(id) ON DELETE SET NULL,
    hash TEXT NOT NULL,
    network TEXT NOT NULL DEFAULT 'Hyperledger Fabric 2.5',
    channel TEXT NOT NULL DEFAULT 'ecasevault-channel',
    chaincode TEXT NOT NULL DEFAULT 'ecasevault',
    transaction_id TEXT,
    block_number BIGINT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'UNAVAILABLE')),
    anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blockchain_anchors_hash ON blockchain_anchors(hash);
CREATE INDEX IF NOT EXISTS idx_blockchain_anchors_case_id ON blockchain_anchors(case_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE fir_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockchain_anchors ENABLE ROW LEVEL SECURITY;

-- Helper function: Get current user profile ID from auth.uid()
CREATE OR REPLACE FUNCTION get_current_profile_id()
RETURNS UUID AS $$
    SELECT id FROM profiles WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Helper function: Get current user role from auth.uid()
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
    SELECT role FROM profiles WHERE auth_user_id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Helper function: Check if current user is member of case
CREATE OR REPLACE FUNCTION is_case_member(cid UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM case_members 
        WHERE case_id = cid AND user_id = get_current_profile_id()
    ) OR get_current_user_role() IN ('AUDITOR', 'ADMIN');
$$ LANGUAGE sql STABLE;

-- PROFILES POLICIES
CREATE POLICY "Profiles readable by authenticated users"
ON profiles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Profiles updateable by self or admin"
ON profiles FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid() OR get_current_user_role() = 'ADMIN');

-- CASES POLICIES
CREATE POLICY "Cases readable by case members, auditors, and admins"
ON cases FOR SELECT TO authenticated
USING (is_case_member(id));

CREATE POLICY "Cases insertable by Police and Admin"
ON cases FOR INSERT TO authenticated
WITH CHECK (get_current_user_role() IN ('POLICE', 'ADMIN'));

CREATE POLICY "Cases updateable by case members with read-write access"
ON cases FOR UPDATE TO authenticated
USING (
    get_current_user_role() = 'ADMIN' OR (
        get_current_user_role() = 'POLICE' AND is_case_member(id)
    )
);

-- CASE MEMBERS POLICIES
CREATE POLICY "Case members visible to case members"
ON case_members FOR SELECT TO authenticated
USING (is_case_member(case_id));

CREATE POLICY "Case members addable by Police lead or Admin"
ON case_members FOR INSERT TO authenticated
WITH CHECK (get_current_user_role() IN ('POLICE', 'ADMIN'));

-- DOCUMENTS POLICIES
CREATE POLICY "Documents readable by case members"
ON documents FOR SELECT TO authenticated
USING (is_case_member(case_id));

CREATE POLICY "Documents insertable by authorized department roles"
ON documents FOR INSERT TO authenticated
WITH CHECK (
    is_case_member(case_id) AND (
        (get_current_user_role() = 'POLICE' AND department = 'POLICE') OR
        (get_current_user_role() = 'FORENSIC' AND department = 'FORENSIC') OR
        (get_current_user_role() = 'LEGAL' AND department = 'LEGAL')
    )
);

-- DOCUMENT VERSIONS POLICIES
CREATE POLICY "Document versions readable by case members"
ON document_versions FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM documents 
        WHERE documents.id = document_versions.document_id 
        AND is_case_member(documents.case_id)
    )
);

-- EVIDENCE POLICIES
CREATE POLICY "Evidence readable by case members"
ON evidence FOR SELECT TO authenticated
USING (is_case_member(case_id));

CREATE POLICY "Evidence insertable by Police"
ON evidence FOR INSERT TO authenticated
WITH CHECK (get_current_user_role() IN ('POLICE', 'ADMIN'));

-- AUDIT LOGS POLICIES (Read-Only for Auditor & Admin; Append-only for all)
CREATE POLICY "Audit logs readable by Auditor and Admin"
ON audit_logs FOR SELECT TO authenticated
USING (get_current_user_role() IN ('AUDITOR', 'ADMIN', 'POLICE', 'FORENSIC', 'LEGAL'));

CREATE POLICY "Audit logs appendable by all authenticated users"
ON audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- BLOCKCHAIN ANCHORS POLICIES (Read-Only for all; Append-only for system)
CREATE POLICY "Blockchain anchors readable by all case stakeholders"
ON blockchain_anchors FOR SELECT TO authenticated
USING (true);

-- ============================================================================
-- SEED PROFILES (Official Demo Stakeholder Users)
-- ============================================================================
INSERT INTO profiles (id, auth_user_id, full_name, role, department, designation, employee_id, badge_no, station_id, station_name, clearance_level)
VALUES 
(
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    'Inspector Vikram K. Patil',
    'POLICE',
    'POLICE',
    'Police Inspector (Station Operations)',
    'EMP-POL-8842',
    'MH-POL-8842',
    'ANDHERI-PS',
    'Andheri Police Station, Mumbai',
    'CONFIDENTIAL'
),
(
    '00000000-0000-0000-0000-000000000002',
    '22222222-2222-2222-2222-222222222222',
    'Dr. Neha V. Sawant, Ph.D.',
    'FORENSIC',
    'FORENSIC',
    'Chief Forensic Scientist',
    'EMP-FSL-0042',
    'FSL-MH-KALINA-042',
    'KALINA-FSL',
    'State Forensic Science Laboratory, Kalina, Mumbai',
    'TOP_SECRET_INVESTIGATION'
),
(
    '00000000-0000-0000-0000-000000000003',
    '33333333-3333-3333-3333-333333333333',
    'Adv. Shrikant Deshpande',
    'LEGAL',
    'LEGAL',
    'Public Prosecutor',
    'EMP-LEG-0582',
    'BAR-MH-2011-582',
    'COURT-SESSIONS',
    'Directorate of Public Prosecution, Mumbai Sessions Court',
    'RESTRICTED'
),
(
    '00000000-0000-0000-0000-000000000004',
    '44444444-4444-4444-4444-444444444444',
    'S. K. Iyer',
    'AUDITOR',
    'AUDITOR',
    'Senior Vigilance & Security Auditor',
    'EMP-AUD-9901',
    'AUD-MH-9901',
    'HQ-COLABA',
    'State Police Headquarters, Colaba, Mumbai',
    'TOP_SECRET_INVESTIGATION'
),
(
    '00000000-0000-0000-0000-000000000005',
    '55555555-5555-5555-5555-555555555555',
    'System Administrator (Vault Ops)',
    'ADMIN',
    'ADMIN',
    'System Administrator',
    'EMP-ADM-0001',
    'ADM-MH-001',
    'CENTRAL-OPS',
    'Maharashtra Police Central Command, Mumbai',
    'TOP_SECRET_INVESTIGATION'
)
ON CONFLICT (id) DO NOTHING;
