import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const sql = `
      SELECT 
        r.id,
        COALESCE(s.road_name, 'Reported Hazard') as road_name,
        ST_X(r.geom::geometry) as lng,
        ST_Y(r.geom::geometry) as lat,
        r.ai_severity as severity,
        COALESCE(r.ai_estimated_depth_cm, 20) as depth,
        r.image_url,
        r.created_at
      FROM citizen_reports r
      LEFT JOIN road_segments s ON r.road_segment_id = s.id
      WHERE r.status != 'REJECTED' AND r.status != 'RESOLVED'
      ORDER BY r.created_at DESC
      LIMIT 100;
    `;

    const result = await query(sql);

    const incidents = result.rows.map((row: any) => {
      let timeAgo = 'Just now';
      if (row.created_at) {
        const diffMs = Date.now() - new Date(row.created_at).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) {
          timeAgo = `${Math.max(1, diffMins)}m ago`;
        } else {
          timeAgo = `${Math.floor(diffMins / 60)}h ago`;
        }
      }

      return {
        id: row.id,
        road_name: row.road_name,
        lng: Number(row.lng),
        lat: Number(row.lat),
        severity: row.severity || 'MODERATE',
        depth: row.depth,
        image_url: row.image_url,
        time: timeAgo,
      };
    });

    return NextResponse.json({ incidents });
  } catch (error) {
    console.error('Error fetching active reports:', error);
    return NextResponse.json({ incidents: [] });
  }
}
