-- ============================================================================
-- e-CASEVAULT — PostgreSQL Relational Database Schema
-- Production Database DDL Schema for Maharashtra Police Digital Case & Evidence Vault
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. POLICE STATIONS TABLE
CREATE TABLE IF NOT EXISTS police_stations (
    station_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    zone VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS & STAKEHOLDERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    badge_no VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    rank VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('POLICE', 'FORENSIC', 'LEGAL', 'AUDITOR', 'ADMIN')),
    station_id VARCHAR(50) REFERENCES police_stations(station_id),
    department VARCHAR(50) NOT NULL DEFAULT 'POLICE',
    clearance_level VARCHAR(50) NOT NULL DEFAULT 'CONFIDENTIAL',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CASES & DIGITAL DOCKETS TABLE
CREATE TABLE IF NOT EXISTS cases (
    id VARCHAR(50) PRIMARY KEY,
    fir_number VARCHAR(100) UNIQUE NOT NULL,
    case_title VARCHAR(255) NOT NULL,
    police_station VARCHAR(255) NOT NULL,
    police_station_id VARCHAR(50) REFERENCES police_stations(station_id),
    jurisdiction_zone VARCHAR(100) NOT NULL,
    crime_type VARCHAR(100) NOT NULL,
    incident_date DATE NOT NULL,
    incident_time VARCHAR(20),
    incident_location TEXT NOT NULL,
    date_logged DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'FIR Registered',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    severity VARCHAR(30) NOT NULL DEFAULT 'STANDARD',
    lead_investigator VARCHAR(255) NOT NULL DEFAULT 'Inspector',
    lead_investigator_badge VARCHAR(50),
    investigating_officer_id VARCHAR(50),
    assigned_io VARCHAR(255),
    assigned_io_badge VARCHAR(50),
    pi_in_charge VARCHAR(255),
    supervising_dysp VARCHAR(255),
    summary_notes TEXT,
    fir_hard_copy_url TEXT,
    fir_hard_copy_file_name VARCHAR(255),
    department_in_charge VARCHAR(50) NOT NULL DEFAULT 'POLICE',
    ipc_sections TEXT[],
    blockchain_status VARCHAR(20) DEFAULT 'PENDING',
    blockchain_tx_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CASE ASSIGNMENTS TABLE (Need-to-Know RBAC)
CREATE TABLE IF NOT EXISTS case_assignments (
    assignment_id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_badge VARCHAR(50),
    user_id VARCHAR(50),
    officer_id VARCHAR(50),
    officer_name VARCHAR(255),
    assignment_role VARCHAR(50) DEFAULT 'Lead Investigator',
    access_level VARCHAR(50) DEFAULT 'FULL',
    assigned_by VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    removed_at TIMESTAMP WITH TIME ZONE,
    removed_by VARCHAR(50),
    removal_reason TEXT
);


-- 5. EVIDENCE ITEMS TABLE
CREATE TABLE IF NOT EXISTS evidence (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_tag VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    collected_by VARCHAR(255) NOT NULL,
    collected_by_badge VARCHAR(50) NOT NULL,
    collection_date DATE NOT NULL,
    location_found TEXT NOT NULL,
    storage_locker VARCHAR(100) NOT NULL,
    current_custodian VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Collected & Sealed',
    original_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    is_integrity_verified BOOLEAN DEFAULT TRUE,
    storage_uri TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    encryption_algorithm VARCHAR(50) DEFAULT 'AES-256-GCM',
    encryption_salt VARCHAR(100),
    encryption_iv VARCHAR(100),
    encryption_auth_tag VARCHAR(100),
    notes TEXT,
    blockchain_status VARCHAR(20) DEFAULT 'PENDING',
    blockchain_tx_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. CHAIN OF CUSTODY TRANSFERS TABLE
CREATE TABLE IF NOT EXISTS evidence_transfers (
    transfer_id VARCHAR(50) PRIMARY KEY,
    evidence_id VARCHAR(50) NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    from_officer VARCHAR(255) NOT NULL,
    from_role VARCHAR(50) NOT NULL,
    to_officer VARCHAR(255) NOT NULL,
    to_role VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    action TEXT NOT NULL,
    condition TEXT NOT NULL,
    seal_intact BOOLEAN DEFAULT TRUE,
    digital_signature TEXT NOT NULL,
    blockchain_status VARCHAR(20) DEFAULT 'PENDING',
    blockchain_tx_id VARCHAR(100),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. FINGERPRINT RECORDS TABLE
CREATE TABLE IF NOT EXISTS fingerprints (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id VARCHAR(50) REFERENCES evidence(id),
    print_type VARCHAR(50) NOT NULL,
    finger_position VARCHAR(50) NOT NULL,
    recovered_from TEXT NOT NULL,
    recovered_location TEXT NOT NULL,
    collected_by VARCHAR(255) NOT NULL,
    quality VARCHAR(20) NOT NULL,
    forensic_status VARCHAR(50) NOT NULL DEFAULT 'Pending Examination',
    examination_result VARCHAR(50),
    scan_file_hash VARCHAR(64) NOT NULL,
    blockchain_tx_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ACCESS REQUESTS TABLE
CREATE TABLE IF NOT EXISTS access_requests (
    request_id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    requested_by_badge VARCHAR(50) NOT NULL REFERENCES users(badge_no),
    requested_by_name VARCHAR(255) NOT NULL,
    requested_by_rank VARCHAR(50) NOT NULL,
    purpose VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    access_level VARCHAR(50) NOT NULL,
    duration_days INT NOT NULL DEFAULT 7,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    blockchain_tx_id VARCHAR(100)
);

-- 9. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actor_badge VARCHAR(50) NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50),
    ip_address VARCHAR(45) NOT NULL DEFAULT '127.0.0.1',
    hash_verified BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- 10. SECURITY ALERTS TABLE
CREATE TABLE IF NOT EXISTS security_alerts (
    id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    alert_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'INFO')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    case_id VARCHAR(50),
    evidence_id VARCHAR(50),
    actor_badge VARCHAR(50),
    ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INVESTIGATING', 'RESOLVED'))
);

-- 11. LOGIN ATTEMPTS TABLE (Brute-Force & Lockout Audit)
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    success BOOLEAN NOT NULL,
    reason TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. CASE REPOSITORY DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS case_repository_documents (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    description TEXT,
    classification VARCHAR(50) NOT NULL DEFAULT 'CONFIDENTIAL',
    storage_uri TEXT,
    sha256_hash VARCHAR(64) NOT NULL,
    digital_signature TEXT,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    uploaded_by VARCHAR(255) NOT NULL,
    uploaded_by_badge VARCHAR(50) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blockchain_tx_id VARCHAR(100),
    blockchain_status VARCHAR(20) DEFAULT 'CONFIRMED',
    is_verified BOOLEAN DEFAULT TRUE,
    clamav_status VARCHAR(20) DEFAULT 'CLEAN'
);

-- Backward compatibility table: documents
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL,
    classification VARCHAR(50) NOT NULL DEFAULT 'CONFIDENTIAL',
    created_by VARCHAR(255) NOT NULL,
    created_by_badge VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    current_version_id VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'
);

-- 12b. FIR RECORDS TABLE (CCTNS Form IIF-I Formal Crime Docket)
CREATE TABLE IF NOT EXISTS fir_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    fir_number VARCHAR(100) NOT NULL,
    police_station VARCHAR(255) NOT NULL,
    incident_date DATE,
    incident_location TEXT,
    acts_sections TEXT[],
    complainant_details JSONB,
    accused_details JSONB,
    brief_facts TEXT,
    registered_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12c. CASE MEMBERS TABLE (Team Collaboration & Direct Access)
CREATE TABLE IF NOT EXISTS case_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id VARCHAR(50),
    member_role VARCHAR(50) NOT NULL DEFAULT 'INVESTIGATOR',
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT TRUE,
    can_close BOOLEAN DEFAULT FALSE,
    granted_by VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12d. CASE ACCESS GRANTS TABLE (Cross-Station Time-Bounded Clearance)
CREATE TABLE IF NOT EXISTS case_access_grants (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_badge VARCHAR(50) NOT NULL,
    user_id VARCHAR(50),
    permission VARCHAR(50) NOT NULL DEFAULT 'VIEW',
    granted_by VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);

-- 12e. PROFILES TABLE (Stakeholder Directory)
CREATE TABLE IF NOT EXISTS profiles (
    id VARCHAR(50) PRIMARY KEY,
    badge_no VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    rank VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    station_id VARCHAR(50),
    department VARCHAR(50) DEFAULT 'POLICE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. DOCUMENT VERSIONS TABLE (Immutable Version History)
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

-- 14. FORENSIC REQUESTS TABLE
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

-- 15. LEGAL COURT RECORDS TABLE
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

-- 16. PRISONERS TABLE (Jail Department)
CREATE TABLE IF NOT EXISTS prisoners (
    id VARCHAR(50) PRIMARY KEY,
    prisoner_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE SET NULL,
    warrant_id VARCHAR(50),
    custody_status VARCHAR(50) NOT NULL DEFAULT 'IN_CUSTODY' CHECK (custody_status IN ('IN_CUSTODY', 'TRANSFERRED', 'RELEASED', 'COURT_HEARING', 'PAROLE')),
    admission_date DATE NOT NULL,
    release_date DATE,
    jail_location VARCHAR(255) NOT NULL DEFAULT 'Arthur Road Central Prison, Mumbai',
    cell_ward VARCHAR(50),
    custody_type VARCHAR(50) NOT NULL DEFAULT 'JUDICIAL_CUSTODY_REMAND',
    remand_expiry_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. CUSTODY RECORDS TABLE
CREATE TABLE IF NOT EXISTS custody_records (
    id VARCHAR(50) PRIMARY KEY,
    prisoner_id VARCHAR(50) NOT NULL REFERENCES prisoners(id) ON DELETE CASCADE,
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    officer_in_charge VARCHAR(255) NOT NULL,
    notes TEXT NOT NULL,
    document_hash VARCHAR(64),
    facility_location VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. CRIMINAL HISTORY TABLE (NCRB / SCRB Module)
CREATE TABLE IF NOT EXISTS criminal_history (
    id VARCHAR(50) PRIMARY KEY,
    person_identifier VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    aliases TEXT[],
    case_id VARCHAR(50) REFERENCES cases(id) ON DELETE SET NULL,
    case_number VARCHAR(100) NOT NULL,
    offence VARCHAR(255) NOT NULL,
    ipc_sections TEXT[],
    case_status VARCHAR(50) NOT NULL DEFAULT 'CONVICTED',
    court_outcome TEXT,
    record_date DATE NOT NULL,
    source VARCHAR(100) NOT NULL DEFAULT 'SCRB Maharashtra',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. WARRANTS TABLE
CREATE TABLE IF NOT EXISTS warrants (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    warrant_number VARCHAR(100) UNIQUE NOT NULL,
    warrant_type VARCHAR(50) NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    issued_date DATE NOT NULL,
    valid_until DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXECUTED', 'RECALLED', 'EXPIRED')),
    issued_by VARCHAR(255) NOT NULL,
    court_name VARCHAR(255) NOT NULL,
    document_ref VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20. HEARINGS TABLE
CREATE TABLE IF NOT EXISTS hearings (
    id VARCHAR(50) PRIMARY KEY,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    hearing_date TIMESTAMP WITH TIME ZONE NOT NULL,
    court VARCHAR(255) NOT NULL,
    hearing_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'ADJOURNED', 'CONCLUDED')),
    summary TEXT,
    judge_or_magistrate VARCHAR(255),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. ROLES & PERMISSIONS TABLES (Structured RBAC)
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(50) REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(50) REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- INDEXES FOR HIGH-PERFORMANCE RBAC, CASE REPO & AUDIT QUERIES
CREATE INDEX IF NOT EXISTS idx_cases_station ON cases(police_station);
CREATE INDEX IF NOT EXISTS idx_cases_lead_investigator ON cases(lead_investigator_badge);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON case_assignments(user_badge);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence(original_hash);
CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_dept ON documents(department);
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_hash ON document_versions(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_forensic_case ON forensic_requests(case_id);
CREATE INDEX IF NOT EXISTS idx_legal_case ON legal_records(case_id);
CREATE INDEX IF NOT EXISTS idx_prisoners_case ON prisoners(case_id);
CREATE INDEX IF NOT EXISTS idx_custody_prisoner ON custody_records(prisoner_id);
CREATE INDEX IF NOT EXISTS idx_criminal_history_person ON criminal_history(person_identifier);
CREATE INDEX IF NOT EXISTS idx_warrants_case ON warrants(case_id);
CREATE INDEX IF NOT EXISTS idx_hearings_case ON hearings(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_badge);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(username, attempted_at);

-- ============================================================================
-- 20. BIOMETRIC IDENTITY & CASE LINK (PERSON REGISTRY & RELATIONSHIPS)
-- ============================================================================

-- 20.1 CENTRAL PERSON REGISTRY (NOT A "CRIMINAL DATABASE")
CREATE TABLE IF NOT EXISTS persons (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    alias VARCHAR(255),
    date_of_birth DATE,
    gender VARCHAR(20),
    photo_url TEXT,
    national_id VARCHAR(50),
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20.2 BIOMETRIC PROFILES (FACIAL EMBEDDINGS)
CREATE TABLE IF NOT EXISTS biometric_profiles (
    id VARCHAR(50) PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    embedding TEXT NOT NULL, -- 128-d or 512-d normalized facial vector
    model_version VARCHAR(50) DEFAULT 'MobileFaceNet-v2-128d',
    photo_hash VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20.3 PERSON-CASE RELATIONSHIPS
CREATE TABLE IF NOT EXISTS person_case_relationships (
    id VARCHAR(50) PRIMARY KEY,
    person_id VARCHAR(50) NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ACCUSED', 'SUSPECT', 'PERSON_OF_INTEREST', 'VICTIM', 'WITNESS')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    verified_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(person_id, case_id, role)
);

-- 20.4 BIOMETRIC SEARCH AUDIT LOG (WITH ABUSE DETECTION & BLOCKCHAIN ANCHOR)
CREATE TABLE IF NOT EXISTS biometric_searches (
    id VARCHAR(50) PRIMARY KEY,
    officer_badge VARCHAR(50) NOT NULL,
    officer_name VARCHAR(255) NOT NULL,
    case_id VARCHAR(50) NOT NULL REFERENCES cases(id),
    purpose VARCHAR(100) NOT NULL, -- CCTV investigation, Missing person, Evidence identification, Suspect verification, Other
    justification TEXT NOT NULL,
    candidates_count INT NOT NULL DEFAULT 0,
    confirmed_person_id VARCHAR(50) REFERENCES persons(id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    flagged_abuse BOOLEAN DEFAULT FALSE,
    abuse_reason TEXT,
    audit_tx_id VARCHAR(100),
    sha256_hash VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 20.5 CANDIDATES RETURNED PER SEARCH
CREATE TABLE IF NOT EXISTS biometric_search_candidates (
    id VARCHAR(50) PRIMARY KEY,
    search_id VARCHAR(50) NOT NULL REFERENCES biometric_searches(id) ON DELETE CASCADE,
    person_id VARCHAR(50) NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5, 4) NOT NULL,
    rank INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
CREATE INDEX IF NOT EXISTS idx_biometric_profiles_person ON biometric_profiles(person_id);
CREATE INDEX IF NOT EXISTS idx_person_case_person ON person_case_relationships(person_id);
CREATE INDEX IF NOT EXISTS idx_person_case_case ON person_case_relationships(case_id);
CREATE INDEX IF NOT EXISTS idx_person_case_role ON person_case_relationships(role);
CREATE INDEX IF NOT EXISTS idx_biometric_searches_officer ON biometric_searches(officer_badge);
CREATE INDEX IF NOT EXISTS idx_biometric_searches_case ON biometric_searches(case_id);
CREATE INDEX IF NOT EXISTS idx_biometric_searches_flagged ON biometric_searches(flagged_abuse);

-- 21. UNIFIED CENTRAL AUDIT EVENTS TABLE
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    user_id VARCHAR(100),
    user_role VARCHAR(50),
    case_id VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    reason TEXT,
    before_data JSONB,
    after_data JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    event_hash CHAR(64),
    fabric_tx_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_case_time ON audit_events(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action_time ON audit_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_events(resource_type, resource_id);


