import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reportId, roadId, action } = body;

        if ((!reportId && !roadId) || !['CONFIRM', 'DISMISS'].includes(action)) {
            return NextResponse.json({ error: 'Valid reportId or roadId, and action (CONFIRM/DISMISS) required' }, { status: 400 });
        }

        if (roadId) {
            if (action === 'DISMISS') {
                await query(
                    `UPDATE road_segments 
                     SET current_risk_level = 'LOW', current_risk_score = 10, last_calculated_at = NOW() 
                     WHERE id = $1;`,
                    [roadId]
                );
                await query(
                    `UPDATE citizen_reports 
                     SET status = 'RESOLVED' 
                     WHERE road_segment_id = $1 AND status != 'REJECTED';`,
                    [roadId]
                );
            } else {
                await query(
                    `UPDATE road_segments 
                     SET current_risk_level = 'SEVERE', current_risk_score = 90, last_calculated_at = NOW() 
                     WHERE id = $1;`,
                    [roadId]
                );
            }
            return NextResponse.json({ success: true, roadId, action });
        }

        let sql;
        if (action === 'CONFIRM') {
            sql = `UPDATE citizen_reports SET status = 'VERIFIED' WHERE id = $1 RETURNING id, status;`;
        } else {
            sql = `UPDATE citizen_reports SET status = 'REJECTED' WHERE id = $1 RETURNING id, status;`;
        }

        const result = await query(sql, [reportId]);

        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, report: result.rows[0] });
    } catch (error) {
        console.error('Verification Error:', error);
        return NextResponse.json({ error: 'Failed to process verification' }, { status: 500 });
    }
}