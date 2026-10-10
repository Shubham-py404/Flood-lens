import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthenticatedUserId } from '@/lib/auth';

export async function GET(request: Request) {
    try {
        const userId = getAuthenticatedUserId(request);
        const { searchParams } = new URL(request.url);
        const onlyUnread = searchParams.get('unread') === 'true';

        let sql = `
            SELECT 
                ua.id,
                ua.user_id,
                ua.saved_location_id,
                COALESCE(sl.label, 'Saved Place') AS saved_location_label,
                ST_X(sl.geom)::float AS longitude,
                ST_Y(sl.geom)::float AS latitude,
                ua.road_segment_id,
                COALESCE(rs.road_name, 'Monitored Road') AS road_name,
                ua.previous_risk_level,
                ua.escalated_risk_level,
                ua.message,
                ua.is_read,
                ua.created_at
            FROM user_alerts ua
            LEFT JOIN saved_locations sl ON ua.saved_location_id = sl.id
            LEFT JOIN road_segments rs ON ua.road_segment_id = rs.id
            WHERE ua.user_id = $1
        `;

        const params: unknown[] = [userId];

        if (onlyUnread) {
            sql += ` AND ua.is_read = FALSE`;
        }

        sql += ` ORDER BY ua.is_read ASC, ua.created_at DESC LIMIT 50;`;

        const result = await query(sql, params);

        // Fetch unread count for badges
        const countRes = await query(
            `SELECT COUNT(*)::int AS count FROM user_alerts WHERE user_id = $1 AND is_read = FALSE;`,
            [userId]
        );
        const unreadCount = countRes.rows[0]?.count || 0;

        return NextResponse.json({
            alerts: result.rows,
            total: result.rowCount,
            unread_count: unreadCount,
        });
    } catch (error) {
        console.error('Failed to fetch user alerts:', error);
        return NextResponse.json(
            { error: 'Internal server error fetching alerts' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = getAuthenticatedUserId(request);
        const body = await request.json().catch(() => ({}));

        const { alert_ids, mark_all } = body;

        if (mark_all) {
            const result = await query(
                `UPDATE user_alerts SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE;`,
                [userId]
            );
            return NextResponse.json({
                success: true,
                message: 'All alerts marked as read',
                updated_count: result.rowCount,
            });
        }

        if (Array.isArray(alert_ids) && alert_ids.length > 0) {
            const result = await query(
                `UPDATE user_alerts SET is_read = TRUE WHERE user_id = $1 AND id = ANY($2::uuid[]);`,
                [userId, alert_ids]
            );
            return NextResponse.json({
                success: true,
                message: 'Selected alerts marked as read',
                updated_count: result.rowCount,
            });
        }

        return NextResponse.json(
            { error: 'Provide either mark_all: true or an array of alert_ids' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Failed to update alert status:', error);
        return NextResponse.json(
            { error: 'Internal server error updating alert status' },
            { status: 500 }
        );
    }
}
