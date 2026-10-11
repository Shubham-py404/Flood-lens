import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { NearbyIncidentCard } from '@/types/api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '28.6315');
  const lng = parseFloat(searchParams.get('lng') || '77.2167');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  try {
    const sql = `
      SELECT 
        r.id,
        COALESCE(s.road_name, 'Reported Hazard') as road_name,
        ST_X(r.geom::geometry) as lng,
        ST_Y(r.geom::geometry) as lat,
        ROUND(ST_DistanceSphere(r.geom::geometry, ST_MakePoint($1, $2)))::integer as distance_m,
        COALESCE(r.ai_severity, 'MODERATE') as severity,
        COALESCE(r.ai_estimated_depth_cm, 20) as depth_cm,
        r.image_url,
        r.created_at,
        r.description,
        r.status,
        COALESCE(c.confirm_count, 0) as confirm_count,
        COALESCE(c.resolved_count, 0) as resolved_count
      FROM citizen_reports r
      LEFT JOIN road_segments s ON r.road_segment_id = s.id
      LEFT JOIN incident_clusters c ON r.cluster_id = c.id
      WHERE r.status != 'REJECTED'
      ORDER BY r.created_at DESC
      LIMIT $3;
    `;

    const result = await query(sql, [lng, lat, limit]);

    const items: NearbyIncidentCard[] = result.rows.map((row: any) => {
      let timeAgo = 'Just now';
      if (row.created_at) {
        const diffMs = Date.now() - new Date(row.created_at).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) {
          timeAgo = `${Math.max(1, diffMins)}m ago`;
        } else if (diffMins < 1440) {
          timeAgo = `${Math.floor(diffMins / 60)}h ago`;
        } else {
          timeAgo = `${Math.floor(diffMins / 1440)}d ago`;
        }
      }

      return {
        id: row.id,
        road_name: row.road_name,
        lat: Number(row.lat),
        lng: Number(row.lng),
        distance_m: Number(row.distance_m || 0),
        severity: row.severity,
        depth_cm: row.depth_cm,
        image_url: row.image_url,
        time_ago: timeAgo,
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        confirm_count: Number(row.confirm_count || 0),
        resolved_count: Number(row.resolved_count || 0),
        status: row.status,
        description: row.description,
      };
    });

    return NextResponse.json({
      items,
      count: items.length,
      user_coords: { lat, lng },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=10',
      },
    });
  } catch (error) {
    console.error('Error fetching nearby insights:', error);
    return NextResponse.json({ items: [], count: 0 }, { status: 500 });
  }
}
