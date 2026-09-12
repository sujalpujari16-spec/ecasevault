-- Migration 004: Update evidence_transfers for Ed25519 digital signature and safe blockchain consistency
ALTER TABLE evidence_transfers ALTER COLUMN digital_signature TYPE TEXT;
ALTER TABLE evidence_transfers ALTER COLUMN blockchain_tx_id DROP NOT NULL;
ALTER TABLE evidence_transfers ADD COLUMN IF NOT EXISTS blockchain_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE evidence_transfers ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE evidence_transfers ADD COLUMN IF NOT EXISTS failure_reason TEXT;
