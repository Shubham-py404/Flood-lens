import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFileBufferFromS3, getPresignedImageUrl } from '@/lib/aws/s3';
import { analyzeFloodImage } from '@/lib/aws/bedrock';

export async function POST(request: Request) {
    try {
        // We now receive lightweight JSON instead of a heavy FormData payload
        const { s3Key, lat, lng } = await request.json();

        if (!s3Key || !lat || !lng) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        // 1. Fetch image from S3 & Run Bedrock AI Vision
        const imageBuffer = await getFileBufferFromS3(s3Key);
        const aiResult = await analyzeFloodImage(imageBuffer, 'image/jpeg');
        const imageUrl = await getPresignedImageUrl(s3Key);

        // 2. Find nearest road segment
        const roadQuery = `
      SELECT id, current_risk_score, risk_factors 
      FROM road_segments
      WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50)
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1;
    `;
        const roadRes = await query(roadQuery, [longitude, latitude]);
        const nearestRoadId = (roadRes.rowCount ?? 0) > 0 ? roadRes.rows[0].id : null;

        // 3. Save Report
        const reportSql = `
      INSERT INTO citizen_reports (
        geom, road_segment_id, s3_image_key, image_url, status,
        ai_analyzed, ai_is_flooded, ai_severity, ai_estimated_depth_cm, ai_confidence, ai_visual_markers
      )
      VALUES (
        ST_SetSRID(ST_MakePoint($1, $2), 4326), $3, $4, $5, 'VERIFIED',
        TRUE, $6, $7, $8, $9, $10::jsonb
      ) RETURNING id;
    `;
        const reportRes = await query(reportSql, [
            longitude, latitude, nearestRoadId, s3Key, imageUrl,
            aiResult.is_flooded, aiResult.severity, aiResult.estimated_depth_cm,
            aiResult.confidence, JSON.stringify(aiResult.visual_markers)
        ]);

        // 4. Boost Risk Score
        if (nearestRoadId && aiResult.is_flooded && aiResult.confidence > 0.70) {
            const newScore = Math.min(parseFloat(roadRes.rows[0].current_risk_score) + 25, 100);
            const newLevel = newScore >= 75 ? 'SEVERE' : newScore >= 50 ? 'HIGH' : newScore >= 25 ? 'MODERATE' : 'LOW';

            const oldFactors = typeof roadRes.rows[0].risk_factors === 'string' ? JSON.parse(roadRes.rows[0].risk_factors) : roadRes.rows[0].risk_factors;
            oldFactors.summary = `CRITICAL: Boosted by AI-verified visual report. Estimated depth: ${aiResult.estimated_depth_cm}cm.`;

            await query(
                `UPDATE road_segments SET current_risk_score = $1, current_risk_level = $2, risk_factors = $3, last_calculated_at = NOW() WHERE id = $4`,
                [newScore, newLevel, JSON.stringify(oldFactors), nearestRoadId]
            );
        }

        return NextResponse.json({ success: true, reportId: reportRes.rows[0].id, ai_analysis: aiResult });
    } catch (error) {
        console.error('Report Submit Error:', error);
        return NextResponse.json({ error: 'Failed to process report' }, { status: 500 });
    }
}