import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const bbox = searchParams.get('bbox'); // format: minLng,minLat,maxLng,maxLat

    if (!bbox) {
        return NextResponse.json({ error: 'Missing bbox parameter' }, { status: 400 });
    }

    const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);

    if ([minLng, minLat, maxLng, maxLat].some(isNaN)) {
        return NextResponse.json({ error: 'Invalid bbox coordinates' }, { status: 400 });
    }

    try {
        const sql = `
      SELECT 
        id, 
        road_name, 
        current_risk_score, 
        current_risk_level, 
        risk_factors,
        ST_AsGeoJSON(geom) AS geometry
      FROM road_segments
      WHERE geom && ST_MakeEnvelope($1, $2, $3, $4, 4326);
    `;

        const result = await query(sql, [minLng, minLat, maxLng, maxLat]);

        // Format into a standard GeoJSON FeatureCollection
        const featureCollection = {
            type: 'FeatureCollection',
            features: result.rows.map((row) => ({
                type: 'Feature',
                // FIX: Force parse the PostGIS geometry string into a readable JSON object
                geometry: typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry,
                properties: {
                    id: row.id,
                    road_name: row.road_name,
                    current_risk_score: row.current_risk_score,
                    current_risk_level: row.current_risk_level,
                    risk_factors: row.risk_factors,
                },
            })),
        };

        return NextResponse.json(featureCollection);
    } catch (error) {
        console.error('Spatial Query Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}