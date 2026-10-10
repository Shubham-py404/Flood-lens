import { query } from './db';

export async function initializeDatabase() {
    console.log('--- Initializing Complete Database Schema ---');

    // 1. Core Extensions
    await query(`CREATE EXTENSION IF NOT EXISTS postgis;`);

    // 2. Custom Types
    await query(`
    DO $$ BEGIN CREATE TYPE risk_level_enum AS ENUM ('LOW', 'MODERATE', 'HIGH', 'SEVERE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE report_status_enum AS ENUM ('PENDING', 'VERIFIED', 'RESOLVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN CREATE TYPE verification_type_enum AS ENUM ('CONFIRM', 'RESOLVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);

    // 3. Tables & Indices (Ordered specifically to respect Foreign Key constraints)
    await query(`
    -- Base Table 1: road_segments
    CREATE TABLE IF NOT EXISTS road_segments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      road_name VARCHAR(255) NOT NULL,
      geom GEOMETRY(LineString, 4326) NOT NULL,
      elevation_m NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
      historical_flood_count INT NOT NULL DEFAULT 0,
      historical_risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
      drainage_capacity_score NUMERIC(5, 2) NOT NULL DEFAULT 50.0,
      current_risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
      current_risk_level risk_level_enum NOT NULL DEFAULT 'LOW',
      risk_factors JSONB DEFAULT '{}'::jsonb,
      last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_road_segments_geom ON road_segments USING GIST (geom);
    CREATE INDEX IF NOT EXISTS idx_road_segments_risk_level ON road_segments (current_risk_level); --[cite: 7]

    -- Base Table 2: weather_snapshots
    CREATE TABLE IF NOT EXISTS weather_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      city_zone VARCHAR(100) NOT NULL DEFAULT 'pilot_area',
      geom GEOMETRY(Point, 4326),
      precipitation_rate_mm_hr NUMERIC(6, 2) NOT NULL,
      accumulation_1h_mm NUMERIC(6, 2) NOT NULL,
      accumulation_24h_mm NUMERIC(6, 2) NOT NULL,
      weather_code INT,
      observed_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_weather_snapshots_observed_at ON weather_snapshots (observed_at DESC); --[cite: 7]

    -- Dependent Table 1: incident_clusters
    CREATE TABLE IF NOT EXISTS incident_clusters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      road_segment_id UUID REFERENCES road_segments(id) ON DELETE SET NULL,
      geom GEOMETRY(Point, 4326) NOT NULL,
      cluster_severity risk_level_enum NOT NULL DEFAULT 'MODERATE',
      report_count INT NOT NULL DEFAULT 1,
      confirm_count INT NOT NULL DEFAULT 0,
      resolved_count INT NOT NULL DEFAULT 0,
      status report_status_enum NOT NULL DEFAULT 'VERIFIED',
      first_reported_at TIMESTAMPTZ DEFAULT NOW(),
      last_reported_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_incident_clusters_geom ON incident_clusters USING GIST (geom);
    CREATE INDEX IF NOT EXISTS idx_incident_clusters_status ON incident_clusters (status); --[cite: 8]

    -- Dependent Table 2: citizen_reports
    CREATE TABLE IF NOT EXISTS citizen_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(128),
      cluster_id UUID REFERENCES incident_clusters(id) ON DELETE SET NULL,
      road_segment_id UUID REFERENCES road_segments(id) ON DELETE SET NULL,
      geom GEOMETRY(Point, 4326) NOT NULL,
      s3_image_key VARCHAR(512),
      image_url TEXT,
      voice_transcript TEXT,
      user_reported_depth VARCHAR(50),
      description TEXT,
      ai_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
      ai_is_flooded BOOLEAN,
      ai_severity risk_level_enum,
      ai_estimated_depth_cm INT,
      ai_confidence NUMERIC(4, 3),
      ai_visual_markers JSONB DEFAULT '[]'::jsonb,
      status report_status_enum NOT NULL DEFAULT 'PENDING',
      admin_reviewed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_citizen_reports_geom ON citizen_reports USING GIST (geom);
    CREATE INDEX IF NOT EXISTS idx_citizen_reports_cluster_id ON citizen_reports (cluster_id); --[cite: 9]
    CREATE INDEX IF NOT EXISTS idx_citizen_reports_created_at ON citizen_reports (created_at DESC); --[cite: 9]

    -- Dependent Table 3: report_verifications
    CREATE TABLE IF NOT EXISTS report_verifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cluster_id UUID NOT NULL REFERENCES incident_clusters(id) ON DELETE CASCADE,
      user_id VARCHAR(128) NOT NULL,
      action verification_type_enum NOT NULL,
      user_geom GEOMETRY(Point, 4326) NOT NULL,
      distance_to_cluster_m NUMERIC(8, 2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT unique_user_cluster_verification UNIQUE (cluster_id, user_id, action)
    );
    CREATE INDEX IF NOT EXISTS idx_report_verifications_cluster_id ON report_verifications (cluster_id); --[cite: 9]

    -- Dependent Table 4: saved_locations
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
    CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id ON saved_locations (user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_locations_road_segment ON saved_locations (nearest_road_segment_id);
    CREATE INDEX IF NOT EXISTS idx_saved_locations_geom ON saved_locations USING GIST (geom);

    -- Dependent Table 5: user_alerts
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
    CREATE INDEX IF NOT EXISTS idx_user_alerts_user_id ON user_alerts (user_id, is_read); --[cite: 10]

    -- Dependent Table 6: model_evaluations
    CREATE TABLE IF NOT EXISTS model_evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      road_segment_id UUID REFERENCES road_segments(id) ON DELETE CASCADE,
      incident_cluster_id UUID REFERENCES incident_clusters(id) ON DELETE CASCADE,
      predicted_risk_score NUMERIC(5, 2) NOT NULL,
      predicted_risk_level risk_level_enum NOT NULL,
      observed_severity risk_level_enum NOT NULL,
      observed_depth_cm INT,
      is_false_negative BOOLEAN GENERATED ALWAYS AS (
        predicted_risk_level IN ('LOW', 'MODERATE') AND observed_severity IN ('HIGH', 'SEVERE')
      ) STORED,
      is_accurate BOOLEAN GENERATED ALWAYS AS (
        predicted_risk_level = observed_severity
      ) STORED,
      evaluated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_model_evaluations_evaluated_at ON model_evaluations (evaluated_at DESC); --[cite: 11]
  `);

    // 4. Seed Pilot Roads (Only if empty)
    const countRes = await query('SELECT COUNT(*) FROM road_segments');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
        console.log('Seeding initial pilot roads...');
        await query(`
      INSERT INTO road_segments (road_name, geom, elevation_m, historical_flood_count, current_risk_score, current_risk_level, risk_factors)
      VALUES 
      (
        'Outer Ring Road (South Segment)',
        ST_GeomFromText('LINESTRING(77.2150 28.6300, 77.2180 28.6320, 77.2210 28.6350)', 4326),
        210.5, 4, 78.0, 'SEVERE',
        '{"rainfall_pct": 50, "elevation_pct": 30, "historical_pct": 20, "summary": "Low elevation basin prone to rapid storm accumulation"}'::jsonb
      ),
      (
        'Connaught Radial 1',
        ST_GeomFromText('LINESTRING(77.2120 28.6310, 77.2160 28.6315, 77.2190 28.6325)', 4326),
        216.0, 1, 35.0, 'MODERATE',
        '{"rainfall_pct": 70, "elevation_pct": 10, "historical_pct": 20, "summary": "Moderate surface runoff, drains functioning normally"}'::jsonb
      ),
      (
        'Barakhamba Avenue',
        ST_GeomFromText('LINESTRING(77.2200 28.6280, 77.2230 28.6310, 77.2270 28.6330)', 4326),
        222.0, 0, 12.0, 'LOW',
        '{"rainfall_pct": 20, "elevation_pct": 0, "historical_pct": 0, "summary": "Elevated ridge segment with minimal waterlogging risk"}'::jsonb
      );
    `);
    }

    console.log('--- Database Foundation Ready ---');
}

// 5. Execution Block (Allows running directly via tsx)
if (require.main === module || process.argv[1]?.includes('init-db')) {
    initializeDatabase()
        .then(() => {
            console.log('Successfully injected schema and seed data.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('Failed to initialize database:', err);
            process.exit(1);
        });
}