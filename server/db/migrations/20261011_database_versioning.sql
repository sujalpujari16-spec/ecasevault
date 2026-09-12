-- ============================================================================
-- e-CASEVAULT ENTERPRISE - DATABASE ROW VERSIONING & AUDIT HISTORY
-- Implements audit tracking for core tables matching canonical schema
-- ============================================================================

-- 1. Create a generic history table for Cases
CREATE TABLE IF NOT EXISTS cases_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_case_id VARCHAR(50) NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('UPDATE', 'DELETE')),
    changed_by_user VARCHAR(50),
    
    -- The snapshot of the data BEFORE the change
    fir_number TEXT NOT NULL,
    case_title TEXT NOT NULL,
    crime_type TEXT NOT NULL,
    incident_date DATE,
    incident_location TEXT,
    police_station TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_io_badge VARCHAR(50),
    
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_history_original_id ON cases_history(original_case_id);

-- 2. Create the Trigger Function for Cases
CREATE OR REPLACE FUNCTION log_cases_version_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO cases_history (
            original_case_id, action, changed_by_user,
            fir_number, case_title,
            crime_type, incident_date, incident_location,
            police_station, status, assigned_io_badge
        ) VALUES (
            OLD.id, 'UPDATE', OLD.assigned_io_badge,
            OLD.fir_number, OLD.case_title,
            OLD.crime_type, OLD.incident_date, OLD.incident_location,
            OLD.police_station, OLD.status, OLD.assigned_io_badge
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO cases_history (
            original_case_id, action, changed_by_user,
            fir_number, case_title,
            crime_type, incident_date, incident_location,
            police_station, status, assigned_io_badge
        ) VALUES (
            OLD.id, 'DELETE', OLD.assigned_io_badge,
            OLD.fir_number, OLD.case_title,
            OLD.crime_type, OLD.incident_date, OLD.incident_location,
            OLD.police_station, OLD.status, OLD.assigned_io_badge
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the Trigger to the Cases table
DROP TRIGGER IF EXISTS trigger_log_cases_history ON cases;
CREATE TRIGGER trigger_log_cases_history
    AFTER UPDATE OR DELETE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION log_cases_version_history();

-- ============================================================================
-- 4. Create a generic history table for Evidence
CREATE TABLE IF NOT EXISTS evidence_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_evidence_id VARCHAR(50) NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('UPDATE', 'DELETE')),
    changed_by_user VARCHAR(50),
    
    -- Snapshot
    case_id VARCHAR(50) NOT NULL,
    evidence_tag TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    current_custodian TEXT,
    
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_history_original_id ON evidence_history(original_evidence_id);

-- 5. Create the Trigger Function for Evidence
CREATE OR REPLACE FUNCTION log_evidence_version_history()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO evidence_history (
            original_evidence_id, action, changed_by_user,
            case_id, evidence_tag, category, description,
            status, current_custodian
        ) VALUES (
            OLD.id, 'UPDATE', OLD.collected_by_badge,
            OLD.case_id, OLD.evidence_tag, OLD.category, OLD.description,
            OLD.status, OLD.current_custodian
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO evidence_history (
            original_evidence_id, action, changed_by_user,
            case_id, evidence_tag, category, description,
            status, current_custodian
        ) VALUES (
            OLD.id, 'DELETE', OLD.collected_by_badge,
            OLD.case_id, OLD.evidence_tag, OLD.category, OLD.description,
            OLD.status, OLD.current_custodian
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Attach the Trigger to the Evidence table
DROP TRIGGER IF EXISTS trigger_log_evidence_history ON evidence;
CREATE TRIGGER trigger_log_evidence_history
    AFTER UPDATE OR DELETE ON evidence
    FOR EACH ROW
    EXECUTE FUNCTION log_evidence_version_history();

