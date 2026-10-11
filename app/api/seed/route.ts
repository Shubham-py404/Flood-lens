import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        const insertQuery = `
      INSERT INTO road_segments (road_name, current_risk_level, current_risk_score, elevation_m, historical_flood_count, geom)
      VALUES 
        -- 1. SEVERE FLOOD (Red) - Outer Circle
        (
          'Outer Circle - Connaught Place', 
          'SEVERE', 
          85, 
          215, 
          4, 
          ST_GeomFromText('LINESTRING(77.2137 28.6315, 77.2167 28.6335, 77.2197 28.6315)', 4326)
        ),
        -- 2. HIGH RISK (Orange) - Radial Road
        (
          'Radial Road Number 4', 
          'HIGH', 
          65, 
          216, 
          2, 
          ST_GeomFromText('LINESTRING(77.2167 28.6335, 77.2180 28.6360)', 4326)
        ),
        -- 3. MODERATE RISK (Yellow) - Barakhamba Road
        (
          'Barakhamba Road', 
          'MODERATE', 
          35, 
          218, 
          0, 
          ST_GeomFromText('LINESTRING(77.2197 28.6315, 77.2250 28.6290)', 4326)
        ),
        -- 4. LOW RISK (Green) - Parliament Street
        (
          'Parliament Street', 
          'LOW', 
          10, 
          220, 
          0, 
          ST_GeomFromText('LINESTRING(77.2137 28.6315, 77.2100 28.6280)', 4326)
        )
    `;

        await query(insertQuery);

        return NextResponse.json({
            success: true,
            message: 'Dummy streets successfully inserted into PostGIS!'
        });
    } catch (error: any) {
        console.error('Seeding error:', error);
        return NextResponse.json({ error: 'Failed to insert data', details: error.message }, { status: 500 });
    }
}