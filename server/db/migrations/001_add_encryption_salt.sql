-- Migration 001: Add encryption_salt column to evidence table
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS encryption_salt VARCHAR(100);
