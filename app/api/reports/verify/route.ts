import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { reportId, action } = await request.json();

        if (!reportId || !['CONFIRM', 'DISMISS'].includes(action)) {
            return NextResponse.json({ error: 'Valid reportId and action (CONFIRM/DISMISS) required' }, { status: 400 });
        }

        let sql;
        if (action === 'CONFIRM') {
            // For MVP: 1 confirm instantly verifies the report to boost the risk score
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