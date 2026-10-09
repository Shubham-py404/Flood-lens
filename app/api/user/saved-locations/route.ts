import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';
import { RiskLevel } from '@/types/db';

const VALID_RISK_LEVELS: RiskLevel[] = ['LOW', 'MODERATE', 'HIGH', 'SEVERE'];

export async function GET(request: Request) {
    try {
        const userId = getAuthenticatedUserId(request);

        const sql = `
            SELECT 
                sl.id,
                sl.user_id,
                sl.label,
                ST_X(sl.geom)::float AS longitude,
                ST_Y(sl.geom)::float AS latitude,
                sl.nearest_road_segment_id,
                rs.road_name AS nearest_road_name,
                rs.current_risk_level AS nearest_road_risk_level,
                rs.current_risk_score::float AS nearest_road_risk_score,
                sl.alert_on_risk_level,
                sl.is_active,
                sl.created_at
            FROM saved_locations sl
            LEFT JOIN road_segments rs ON sl.nearest_road_segment_id = rs.id
            WHERE sl.user_id = $1 AND sl.is_active = TRUE
            ORDER BY sl.created_at DESC;
        `;

        const result = await query(sql, [userId]);

        return NextResponse.json({
            saved_locations: result.rows,
            count: result.rowCount,
        });
    } catch (error) {
        console.error('Failed to fetch saved locations:', error);
        return NextResponse.json(
            { error: 'Internal server error fetching saved locations' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const userId = getAuthenticatedUserId(request);
        const body = await request.json().catch(() => null);

        if (!body) {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
        }

        const { label, latitude, longitude, alert_on_risk_level = 'HIGH' } = body;

        // Validation
        if (!label || typeof label !== 'string' || label.trim().length === 0 || label.trim().length > 100) {
            return NextResponse.json(
                { error: 'Field "label" is required and must be between 1 and 100 characters.' },
                { status: 400 }
            );
        }

        const lat = Number(latitude);
        const lng = Number(longitude);

        if (isNaN(lat) || lat < -90 || lat > 90) {
            return NextResponse.json(
                { error: 'Field "latitude" must be a valid number between -90 and 90.' },
                { status: 400 }
            );
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
            return NextResponse.json(
                { error: 'Field "longitude" must be a valid number between -180 and 180.' },
                { status: 400 }
            );
        }

        if (!VALID_RISK_LEVELS.includes(alert_on_risk_level)) {
            return NextResponse.json(
                { error: `Field "alert_on_risk_level" must be one of: ${VALID_RISK_LEVELS.join(', ')}` },
                { status: 400 }
            );
        }

        const trimmedLabel = label.trim();

        // 1. PostGIS Spatial Road Match: Find nearest road segment within 5,000 meters
        const roadMatchSql = `
            SELECT 
                id, 
                road_name, 
                current_risk_level, 
                current_risk_score::float AS current_risk_score,
                ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters
            FROM road_segments
            WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 5000)
            ORDER BY distance_meters ASC
            LIMIT 1;
        `;

        const roadMatchRes = await query(roadMatchSql, [lng, lat]);
        const nearestRoad = roadMatchRes.rows[0] || null;

        // 2. Insert into saved_locations
        const insertSql = `
            INSERT INTO saved_locations (
                user_id,
                label,
                geom,
                nearest_road_segment_id,
                alert_on_risk_level,
                is_active
            )
            VALUES (
                $1,
                $2,
                ST_SetSRID(ST_MakePoint($3, $4), 4326),
                $5,
                $6,
                TRUE
            )
            RETURNING 
                id,
                user_id,
                label,
                ST_X(geom)::float AS longitude,
                ST_Y(geom)::float AS latitude,
                nearest_road_segment_id,
                alert_on_risk_level,
                is_active,
                created_at;
        `;

        const insertRes = await query(insertSql, [
            userId,
            trimmedLabel,
            lng,
            lat,
            nearestRoad ? nearestRoad.id : null,
            alert_on_risk_level,
        ]);

        const savedLocation = insertRes.rows[0];

        return NextResponse.json(
            {
                success: true,
                saved_location: {
                    ...savedLocation,
                    nearest_road_name: nearestRoad ? nearestRoad.road_name : null,
                    nearest_road_risk_level: nearestRoad ? nearestRoad.current_risk_level : null,
                    nearest_road_risk_score: nearestRoad ? nearestRoad.current_risk_score : null,
                    distance_to_road_m: nearestRoad ? Math.round(nearestRoad.distance_meters) : null,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Failed to create saved location:', error);
        return NextResponse.json(
            { error: 'Internal server error creating saved location' },
            { status: 500 }
        );
    }
}
