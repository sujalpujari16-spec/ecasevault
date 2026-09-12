-- ============================================================================
-- Migration 002: Add blockchain_status tracking to cases and evidence tables
-- ============================================================================

ALTER TABLE cases ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS blockchain_tx_id VARCHAR(100);

ALTER TABLE evidence ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(20) DEFAULT 'PENDING';

ALTER TABLE evidence_transfers ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(20) DEFAULT 'PENDING';
