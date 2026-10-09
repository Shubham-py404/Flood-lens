-- Migration: 001_saved_places_alerts.sql
-- Feature 6: Saved Places & Proactive Escalation Alerts
-- Idempotent schema definition for saved_locations and user_alerts

-- Ensure PostGIS is active
CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure risk_level_enum exists
DO $$ BEGIN 
  CREATE TYPE risk_level_enum AS ENUM ('LOW', 'MODERATE', 'HIGH', 'SEVERE'); 
EXCEPTION 
  WHEN duplicate_object THEN null; 
END $$;

-- Table: saved_locations
CREATE TABLE IF NOT EXISTS saved_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL,
  label VARCHAR(100) NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  nearest_road_segment_id UUID REFERENCES road_segments(id) ON DELETE SET NULL,
  alert_on_risk_level risk_level_enum NOT NULL DEFAULT 'HIGH',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for saved_locations
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id ON saved_locations (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_locations_road_segment ON saved_locations (nearest_road_segment_id);
CREATE INDEX IF NOT EXISTS idx_saved_locations_geom ON saved_locations USING GIST (geom);

-- Table: user_alerts
CREATE TABLE IF NOT EXISTS user_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL,
  saved_location_id UUID REFERENCES saved_locations(id) ON DELETE CASCADE,
  road_segment_id UUID REFERENCES road_segments(id) ON DELETE CASCADE,
  previous_risk_level risk_level_enum NOT NULL,
  escalated_risk_level risk_level_enum NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for user_alerts
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_user_alerts_created_at ON user_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_alerts_dedup ON user_alerts (saved_location_id, road_segment_id, escalated_risk_level, created_at DESC);
