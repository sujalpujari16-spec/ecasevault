-- Migration 006: Central Audit Trail & Event Store for Maharashtra Police e-CaseVault
-- Author: Maharashtra Police State Cyber & Crime Branch
-- Provides tamper-evident canonical event storage indexed by case_id, user_id, action, and timestamp.

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

-- Case Activity Timeline Index
CREATE INDEX IF NOT EXISTS idx_audit_case_time
ON audit_events(case_id, created_at DESC);

-- Officer Activity History Index
CREATE INDEX IF NOT EXISTS idx_audit_user_time
ON audit_events(user_id, created_at DESC);

-- Action Type Index
CREATE INDEX IF NOT EXISTS idx_audit_action_time
ON audit_events(action, created_at DESC);

-- Global Chronological Feed Index
CREATE INDEX IF NOT EXISTS idx_audit_time
ON audit_events(created_at DESC);

-- Resource Linkage Index
CREATE INDEX IF NOT EXISTS idx_audit_resource
ON audit_events(resource_type, resource_id);
