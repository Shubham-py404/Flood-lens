<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# FloodLens — AI Agent Synchronization Reference

> **LAST SYNCED FROM CODEBASE:** 2026-10-09
> This section is the **single source of truth** for all agents. Do NOT invent names. Use ONLY what is listed here.

---

## 1. Golden Directives for AI Agents

* **No Hallucinations:** NEVER invent new database tables, columns, or API endpoints. Only use the names explicitly defined in this document.
* **Tech Stack:** Use Next.js 15 (App Router), Tailwind CSS v4, MapLibre GL JS v4+, and the AWS SDK. Do NOT use shadcn/ui unless it is added to `package.json` first.
* **Database:** We are using PostgreSQL with PostGIS on AWS RDS. Use the `pg` package and the shared `query()` helper from `lib/db.ts`. Always use `ST_` prefix functions for PostGIS spatial queries.
* **AWS Security:** All AWS API calls (S3, Bedrock, Cognito) MUST execute securely on the server via Server Actions or Route Handlers. Never expose credentials or AWS logic to the client.
* **MapLibre:** `maplibre-gl` v4+ is a sealed ES Module. Always use named exports (`Map`, `GeoJSONSource`, `setWorkerUrl`). Never mutate namespace properties. Always call `setWorkerUrl('/maplibre-gl-worker.mjs')` before `new Map()`.

---

## 2. Tech Stack (Locked)

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router |
| Styling | Tailwind CSS v4 (via `@tailwindcss/turbopack`) |
| Database | PostgreSQL + PostGIS on AWS RDS |
| DB Driver | `pg` (node-postgres) |
| Mapping | MapLibre GL JS v4+ |
| AI/Vision | AWS Bedrock (`anthropic.claude-3-5-sonnet-20240620-v1:0`) |
| File Storage | AWS S3 |
| Auth | AWS Cognito (user_id = Cognito Sub, VARCHAR(128)) |
| Language | TypeScript (strict) |

---

## 3. Database — PostgreSQL (`floodlens`)

### Extension
- `postgis` — required for all spatial operations. Always use `ST_` prefix functions.

### Custom ENUM Types
| Type Name | Values |
|---|---|
| `risk_level_enum` | `'LOW'`, `'MODERATE'`, `'HIGH'`, `'SEVERE'` |
| `report_status_enum` | `'PENDING'`, `'VERIFIED'`, `'RESOLVED'`, `'REJECTED'` |
| `verification_type_enum` | `'CONFIRM'`, `'RESOLVED'` |

---

### Table: `road_segments`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `road_name` | VARCHAR(255) | NOT NULL |
| `geom` | GEOMETRY(LineString, 4326) | NOT NULL — spatial index: `idx_road_segments_geom` |
| `elevation_m` | NUMERIC(6,2) | default 0.0 |
| `historical_flood_count` | INT | default 0 |
| `historical_risk_score` | NUMERIC(5,2) | default 0.0 |
| `drainage_capacity_score` | NUMERIC(5,2) | default 50.0 |
| `current_risk_score` | NUMERIC(5,2) | default 0.0 |
| `current_risk_level` | `risk_level_enum` | default `'LOW'` — index: `idx_road_segments_risk_level` |
| `risk_factors` | JSONB | keys: `rainfall_pct`, `elevation_pct`, `historical_pct`, `summary` |
| `last_calculated_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

---

### Table: `weather_snapshots`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `city_zone` | VARCHAR(100) | default `'pilot_area'` |
| `geom` | GEOMETRY(Point, 4326) | nullable |
| `precipitation_rate_mm_hr` | NUMERIC(6,2) | NOT NULL |
| `accumulation_1h_mm` | NUMERIC(6,2) | NOT NULL |
| `accumulation_24h_mm` | NUMERIC(6,2) | NOT NULL |
| `weather_code` | INT | nullable |
| `observed_at` | TIMESTAMPTZ | NOT NULL — index: `idx_weather_snapshots_observed_at DESC` |
| `created_at` | TIMESTAMPTZ | |

---

### Table: `incident_clusters`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `road_segment_id` | UUID FK → `road_segments(id)` | ON DELETE SET NULL |
| `geom` | GEOMETRY(Point, 4326) | NOT NULL — index: `idx_incident_clusters_geom` |
| `cluster_severity` | `risk_level_enum` | default `'MODERATE'` |
| `report_count` | INT | default 1 |
| `confirm_count` | INT | default 0 |
| `resolved_count` | INT | default 0 |
| `status` | `report_status_enum` | default `'VERIFIED'` — index: `idx_incident_clusters_status` |
| `first_reported_at` | TIMESTAMPTZ | |
| `last_reported_at` | TIMESTAMPTZ | |
| `resolved_at` | TIMESTAMPTZ | nullable |

---

### Table: `citizen_reports`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | VARCHAR(128) | Cognito Sub, nullable |
| `cluster_id` | UUID FK → `incident_clusters(id)` | ON DELETE SET NULL — index: `idx_citizen_reports_cluster_id` |
| `road_segment_id` | UUID FK → `road_segments(id)` | ON DELETE SET NULL |
| `geom` | GEOMETRY(Point, 4326) | NOT NULL — index: `idx_citizen_reports_geom` |
| `s3_image_key` | VARCHAR(512) | S3 object key, format: `reports/{timestamp}-{filename}` |
| `image_url` | TEXT | nullable |
| `voice_transcript` | TEXT | nullable |
| `user_reported_depth` | VARCHAR(50) | nullable |
| `description` | TEXT | nullable |
| `ai_analyzed` | BOOLEAN | default FALSE |
| `ai_is_flooded` | BOOLEAN | nullable |
| `ai_severity` | `risk_level_enum` | nullable |
| `ai_estimated_depth_cm` | INT | nullable |
| `ai_confidence` | NUMERIC(4,3) | nullable |
| `ai_visual_markers` | JSONB | default `'[]'` |
| `status` | `report_status_enum` | default `'PENDING'` |
| `admin_reviewed` | BOOLEAN | default FALSE |
| `created_at` | TIMESTAMPTZ | index: `idx_citizen_reports_created_at DESC` |

---

### Table: `report_verifications`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `cluster_id` | UUID FK → `incident_clusters(id)` | NOT NULL, ON DELETE CASCADE — index: `idx_report_verifications_cluster_id` |
| `user_id` | VARCHAR(128) | NOT NULL |
| `action` | `verification_type_enum` | NOT NULL |
| `user_geom` | GEOMETRY(Point, 4326) | NOT NULL |
| `distance_to_cluster_m` | NUMERIC(8,2) | nullable |
| `created_at` | TIMESTAMPTZ | |
| — | UNIQUE CONSTRAINT | `unique_user_cluster_verification` on `(cluster_id, user_id, action)` |

---

### Table: `saved_locations`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | VARCHAR(128) | NOT NULL — index: `idx_saved_locations_user_id` |
| `label` | VARCHAR(100) | NOT NULL |
| `geom` | GEOMETRY(Point, 4326) | NOT NULL |
| `nearest_road_segment_id` | UUID FK → `road_segments(id)` | ON DELETE SET NULL — index: `idx_saved_locations_road_segment` |
| `alert_on_risk_level` | `risk_level_enum` | default `'HIGH'` |
| `is_active` | BOOLEAN | default TRUE |
| `created_at` | TIMESTAMPTZ | |

---

### Table: `user_alerts`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | VARCHAR(128) | NOT NULL — index: `idx_user_alerts_user_id` (with `is_read`) |
| `saved_location_id` | UUID FK → `saved_locations(id)` | ON DELETE CASCADE |
| `road_segment_id` | UUID FK → `road_segments(id)` | ON DELETE CASCADE |
| `previous_risk_level` | `risk_level_enum` | NOT NULL |
| `escalated_risk_level` | `risk_level_enum` | NOT NULL |
| `message` | TEXT | NOT NULL |
| `is_read` | BOOLEAN | default FALSE |
| `created_at` | TIMESTAMPTZ | |

---

### Table: `model_evaluations`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `road_segment_id` | UUID FK → `road_segments(id)` | ON DELETE CASCADE |
| `incident_cluster_id` | UUID FK → `incident_clusters(id)` | ON DELETE CASCADE |
| `predicted_risk_score` | NUMERIC(5,2) | NOT NULL |
| `predicted_risk_level` | `risk_level_enum` | NOT NULL |
| `observed_severity` | `risk_level_enum` | NOT NULL |
| `observed_depth_cm` | INT | nullable |
| `is_false_negative` | BOOLEAN | GENERATED ALWAYS AS STORED |
| `is_accurate` | BOOLEAN | GENERATED ALWAYS AS STORED |
| `evaluated_at` | TIMESTAMPTZ | index: `idx_model_evaluations_evaluated_at DESC` |

---

## 4. Exported Functions & Singletons

### `lib/db.ts`
| Symbol | Signature | Purpose |
|---|---|---|
| `query<T>` | `(text: string, params?: any[]) => Promise<QueryResult<T>>` | Parameterized SQL query with dev logging |
| `pool` (default export) | `Pool` | Shared pg connection pool (HMR-safe via `global.globalPgPool`) |

### `lib/aws/s3.ts`
| Symbol | Signature | Purpose |
|---|---|---|
| `s3Client` | `S3Client` | Singleton AWS S3 client |
| `createPresignedUploadUrl` | `(filename: string, contentType: string) => Promise<{ uploadUrl: string; fileKey: string }>` | Generates a 15-min presigned PUT URL. Key format: `reports/{timestamp}-{filename}` |
| `getFileBufferFromS3` | `(fileKey: string) => Promise<Buffer>` | Downloads a file from S3 and returns it as a Node.js Buffer |

### `lib/aws/bedrock.ts`
| Symbol | Signature | Purpose |
|---|---|---|
| `bedrockClient` | `BedrockRuntimeClient` | Singleton AWS Bedrock client |
| `analyzeFloodImage` | `(imageBuffer: Buffer, mimeType: string) => Promise<FloodAnalysisResult>` | Sends image to Claude via Bedrock, returns structured flood analysis |

### `lib/init-db.ts`
| Symbol | Signature | Purpose |
|---|---|---|
| `initializeDatabase` | `() => Promise<void>` | Creates all extensions, ENUMs, tables, indices, and seeds pilot roads |

---

## 5. TypeScript Interfaces & Types

### `types/db.ts`
```ts
type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
type ReportStatus = 'PENDING' | 'VERIFIED' | 'RESOLVED' | 'REJECTED';
type VerificationType = 'CONFIRM' | 'RESOLVED';

interface RoadSegment { id, road_name, elevation_m, historical_flood_count,
  historical_risk_score, drainage_capacity_score, current_risk_score,
  current_risk_level: RiskLevel, risk_factors: { rainfall_pct?, elevation_pct?,
  historical_pct?, summary? }, last_calculated_at }

interface CitizenReport { id, user_id?, cluster_id?, road_segment_id?,
  s3_image_key?, image_url?, voice_transcript?, user_reported_depth?, description?,
  ai_analyzed, ai_is_flooded?, ai_severity?: RiskLevel, ai_estimated_depth_cm?,
  ai_confidence?, ai_visual_markers?: string[], status: ReportStatus, created_at }
```

### `types/geojson.ts`
```ts
interface GeoJsonLineStringGeometry { type: 'LineString'; coordinates: [number, number][] }
interface GeoJsonPointGeometry      { type: 'Point';       coordinates: [number, number] }
interface RoadFeatureProperties     { id, road_name, current_risk_score, current_risk_level: RiskLevel, risk_factors }
interface RoadFeatureCollection     { type: 'FeatureCollection'; features: Feature<GeoJsonLineStringGeometry, RoadFeatureProperties>[] }
```

### `lib/aws/bedrock.ts`
```ts
interface FloodAnalysisResult {
  is_flooded: boolean;
  severity: RiskLevel;
  estimated_depth_cm: number;
  visual_markers: string[];
  confidence: number;
}
```

---

## 6. API Routes (Implemented)

| Method | Route | File | Description |
|---|---|---|---|
| `GET` | `/api/risk/area?bbox=minLng,minLat,maxLng,maxLat` | `app/api/risk/area/route.ts` | Returns GeoJSON FeatureCollection of `road_segments` intersecting bbox using `ST_MakeEnvelope`. `ST_AsGeoJSON(geom)` is returned as a string and parsed via `JSON.parse()` in the route handler. |

### API Routes (Planned — not yet implemented)
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/reports/presigned-url` | Returns AWS S3 presigned PUT URL |
| `POST` | `/api/reports/submit` | Saves report to RDS, triggers Bedrock pipeline |
| `POST` | `/api/cron/sync-weather` | Fetches Open-Meteo data, recalculates risk scores |

---

## 7. React Components

### `components/map/MapView.tsx`
- **Type:** `'use client'` — full-screen map view
- **State:** `selectedRoad: any | null` — set on `roads-layer` click
- **MapLibre Source:** `'roads'` (GeoJSON, type: `geojson`)
- **MapLibre Layer:** `'roads-layer'` (type: `line`) — color driven by `current_risk_level` match expression
- **Risk colors:** `LOW=#22c55e`, `MODERATE=#eab308`, `HIGH=#f97316`, `SEVERE=#ef4444`, fallback=`#94a3b8`
- **Worker fix:** `setWorkerUrl('/maplibre-gl-worker.mjs')` (file copied to `public/`)
- **Data fetch:** `GET /api/risk/area?bbox=...` triggered on `load` and `moveend`
- **Children:** `<RiskLegend />`, `<RoadDetailDrawer road={selectedRoad} onClose={...} />`

### `components/map/RiskLegend.tsx`
- **Type:** Server-safe (no directives) — purely decorative overlay
- **Position:** `absolute bottom-6 right-6`
- **Levels displayed:** Severe (75-100), High (50-74), Moderate (25-49), Low (0-24)

### `components/map/RoadDetailDrawer.tsx`
- **Props:** `road: any | null`, `onClose: () => void`
- **Helper:** `getRiskColor(level: string)` — returns Tailwind class string per risk level
- **Reads from `road`:** `road_name`, `current_risk_level`, `current_risk_score`, `risk_factors.rainfall_pct`, `risk_factors.elevation_pct`, `risk_factors.historical_pct`, `risk_factors.summary`
- **Note:** `risk_factors` is safely parsed from string (MapLibre serializes JSON properties as strings)

---

## 8. Environment Variables

| Variable | Used In | Description |
|---|---|---|
| `DATABASE_URL` | `lib/db.ts` | Full PostgreSQL connection string |
| `AWS_REGION` | `lib/aws/s3.ts`, `lib/aws/bedrock.ts` | AWS region (default: `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | `lib/aws/s3.ts`, `lib/aws/bedrock.ts` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | `lib/aws/s3.ts`, `lib/aws/bedrock.ts` | IAM secret key |
| `S3_BUCKET_NAME` | `lib/aws/s3.ts` | S3 bucket name (e.g., `floodlens-incident-media`) |
| `BEDROCK_MODEL_ID` | `lib/aws/bedrock.ts` | Default: `anthropic.claude-3-5-sonnet-20240620-v1:0` |
| `CRON_SECRET` | (planned) API cron routes | Shared secret for securing cron endpoints |
| `NEXT_PUBLIC_MAP_STYLE_URL` | `MapView.tsx` | MapLibre style URL |
| `NEXT_PUBLIC_DEFAULT_LAT` | `MapView.tsx` | Default map center latitude |
| `NEXT_PUBLIC_DEFAULT_LNG` | `MapView.tsx` | Default map center longitude |
| `NEXT_PUBLIC_DEFAULT_ZOOM` | `MapView.tsx` | Default map zoom level |

---

## 9. npm Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Run production build |
| `lint` | `eslint` | Run ESLint |
| `db:init` | `tsx -r dotenv/config lib/init-db.ts dotenv_config_path=.env.local` | Initialize DB schema and seed data |

---

## 10. Golden Rules for All Agents

1. **No hallucinations** — never use column/function/table names not listed above.
2. **All AWS calls** (S3, Bedrock, Cognito) MUST be server-side only (Route Handlers or Server Actions). Never expose to client.
3. **MapLibre worker** — always call `setWorkerUrl('/maplibre-gl-worker.mjs')` before `new Map()`. The worker file lives in `public/maplibre-gl-worker.mjs`.
4. **maplibre-gl v4+** is a sealed ES module — never mutate its namespace properties. Use named exports (`Map`, `GeoJSONSource`, `setWorkerUrl`, etc.).
5. **Spatial queries** — always use `ST_` PostGIS functions with SRID `4326`.
6. **`risk_factors` JSONB** — always serialize/deserialize carefully; MapLibre may return it as a string.
7. **`ST_AsGeoJSON(geom)`** — returns a TEXT string from PostgreSQL, not a JSON object. Always call `JSON.parse()` on it in the route handler before sending the response.
8. **Connection pooling** — always use `query()` from `lib/db.ts`, never create raw `Pool` or `Client` instances directly.
