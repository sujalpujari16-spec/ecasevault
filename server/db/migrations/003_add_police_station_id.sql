-- Migration 003: Add relational police_station_id column to cases table
ALTER TABLE cases ADD COLUMN IF NOT EXISTS police_station_id VARCHAR(50) REFERENCES police_stations(station_id);

-- Update existing records to link to ANDHERI-PS by default
UPDATE cases SET police_station_id = 'ANDHERI-PS' WHERE police_station_id IS NULL;

-- Create index on police_station_id for fast relational queries
CREATE INDEX IF NOT EXISTS idx_cases_police_station_id ON cases(police_station_id);
