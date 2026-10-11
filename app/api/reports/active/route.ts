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

    const SAMPLE_HAZARDS = [
      '/sample-hazards/ring_road_flood.jpg',
      '/sample-hazards/connaught_waterlog.jpg',
      '/sample-hazards/underpass_hazard.jpg',
    ];

    const incidents = result.rows.map((row: any, idx: number) => {
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

      let resolvedImageUrl = row.image_url;
      if (!resolvedImageUrl || typeof resolvedImageUrl !== 'string' || resolvedImageUrl.trim() === '') {
        const lowerRoad = (row.road_name || '').toLowerCase();
        if (lowerRoad.includes('ring')) {
          resolvedImageUrl = '/sample-hazards/ring_road_flood.jpg';
        } else if (lowerRoad.includes('connaught') || lowerRoad.includes('radial') || lowerRoad.includes('circle')) {
          resolvedImageUrl = '/sample-hazards/connaught_waterlog.jpg';
        } else if (lowerRoad.includes('barakhamba') || lowerRoad.includes('underpass') || lowerRoad.includes('parliament')) {
          resolvedImageUrl = '/sample-hazards/underpass_hazard.jpg';
        } else {
          resolvedImageUrl = SAMPLE_HAZARDS[idx % SAMPLE_HAZARDS.length];
        }
      }

      return {
        id: row.id,
        road_name: row.road_name,
        lng: Number(row.lng),
        lat: Number(row.lat),
        severity: row.severity || 'MODERATE',
        depth: row.depth,
        image_url: resolvedImageUrl,
        time: timeAgo,
      };
    });

    return NextResponse.json({ incidents });
  } catch (error) {
    console.error('Error fetching active reports:', error);
    return NextResponse.json({ incidents: [] });
  }
}
