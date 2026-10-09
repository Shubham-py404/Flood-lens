# FloodLens: AI Developer Context & Rules

## 1. Golden Directives for AI Agents
* **No Hallucinations:** NEVER invent new database tables, columns, or API endpoints. Only use the names explicitly defined in this document.
* **Tech Stack:** Use Next.js 14/15 (App Router), Tailwind CSS, shadcn/ui, MapLibre GL JS, and the AWS SDK.
* **Database:** We are using PostgreSQL with PostGIS on AWS RDS. Use standard SQL with the `pg` package or your configured ORM. Always utilize `ST_` prefix functions for PostGIS spatial queries.

## 2. Database Schema (Source of Truth)
Do not use any other column names. 

### Table: `road_segments`
* `id` (UUID, Primary Key)
* `road_name` (VARCHAR)
* `geom` (GEOMETRY: LineString, 4326)
* `current_risk_score` (NUMERIC, 0-100)
* `current_risk_level` (ENUM: 'LOW', 'MODERATE', 'HIGH', 'SEVERE')
* `risk_factors` (JSONB)

### Table: `citizen_reports`
* `id` (UUID, Primary Key)
* `cluster_id` (UUID, Foreign Key to incident_clusters)
* `geom` (GEOMETRY: Point, 4326)
* `s3_image_key` (VARCHAR)
* `voice_transcript` (TEXT)
* `ai_is_flooded` (BOOLEAN)
* `ai_severity` (ENUM: 'LOW', 'MODERATE', 'HIGH', 'SEVERE')
* `ai_estimated_depth_cm` (INT)
* `status` (ENUM: 'PENDING', 'VERIFIED', 'RESOLVED', 'REJECTED')

### Table: `saved_locations`
* `id` (UUID, Primary Key)
* `user_id` (VARCHAR - Cognito Sub)
* `geom` (GEOMETRY: Point, 4326)
* `nearest_road_segment_id` (UUID, Foreign Key)

## 3. Standardized API Routes
* `GET /api/risk/area?bbox=[minLng,minLat,maxLng,maxLat]` -> Returns GeoJSON FeatureCollection of road_segments.
* `POST /api/reports/presigned-url` -> Returns AWS S3 presigned PUT URL for image uploads.
* `POST /api/reports/submit` -> Saves the report to RDS and triggers the Bedrock AI pipeline.
* `POST /api/cron/sync-weather` -> Fetches Open-Meteo data, recalculates formula, and updates road_segments.

## 4. UI & State Guidelines
* Use standard React state or Zustand for client-side state.
* Client-side mapping relies entirely on MapLibre GL JS.
* All AWS API calls (S3, Bedrock, Cognito) MUST execute securely on the server via Server Actions or Route Handlers, never exposed to the client.