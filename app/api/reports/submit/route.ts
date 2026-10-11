import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getFileBufferFromS3 } from '@/lib/aws/s3';
import { analyzeFloodImage } from '@/lib/aws/bedrock';
import type { RiskLevel } from '@/types/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawBody: any = body;

    const lat = body.latitude !== undefined ? Number(body.latitude) : (rawBody.lat !== undefined ? Number(rawBody.lat) : undefined);
    const lng = body.longitude !== undefined ? Number(body.longitude) : (rawBody.lng !== undefined ? Number(rawBody.lng) : undefined);
    const s3Key = body.s3_image_key || rawBody.s3Key || null;
    const userSeverityRating = rawBody.userSeverityRating;

    // 1. Strict Validation
    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Valid latitude and longitude coordinates are required' }, { status: 400 });
    }

    let aiAnalysis: any = null;
    const bucketName = process.env.S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || 'floodlens-incident-media';
    const region = process.env.AWS_REGION || 'us-east-1';
    const imageUrl = s3Key ? `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}` : null;

    // 2. AWAITED Bedrock AI Execution (Prevents Serverless Premature Termination)
    if (s3Key) {
      console.log(`Processing image ${s3Key} synchronously through AWS Bedrock...`);
      try {
        const imageBuffer = await getFileBufferFromS3(s3Key);
        const ext = s3Key.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

        aiAnalysis = await analyzeFloodImage(imageBuffer, mimeType);
        console.log('Bedrock Analysis Complete:', aiAnalysis);
      } catch (aiErr) {
        console.error('Bedrock AI failed, falling back gracefully to manual user rating:', aiErr);
      }
    }

    // 3. Fusion: Decide final truth based on AI (if exists) or Manual Rating
    const sevMap: Record<number, RiskLevel> = {
      1: 'LOW',
      2: 'MODERATE',
      3: 'MODERATE',
      4: 'HIGH',
      5: 'SEVERE',
    };
    const depthMap: Record<number, number> = {
      1: 10,
      2: 20,
      3: 35,
      4: 50,
      5: 75,
    };

    const isFlooded = aiAnalysis ? aiAnalysis.is_flooded : (userSeverityRating ? userSeverityRating >= 3 : true);
    const estimatedDepth = aiAnalysis
      ? aiAnalysis.estimated_depth_cm
      : (userSeverityRating ? (depthMap[Number(userSeverityRating)] || userSeverityRating * 10) : 25);
    const confidence = aiAnalysis ? aiAnalysis.confidence : 1.0;
    const severity: RiskLevel = aiAnalysis
      ? aiAnalysis.severity
      : (userSeverityRating ? sevMap[Number(userSeverityRating)] || 'MODERATE' : 'MODERATE');
    const visualMarkers = aiAnalysis ? JSON.stringify(aiAnalysis.visual_markers || []) : JSON.stringify([]);

    // 4. Spatial Attachment to nearest road segment
    let roadSegmentId: string | null = null;
    try {
      const roadMatch = await query<{ id: string }>(
        `SELECT id FROM road_segments 
         WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 100) 
         ORDER BY ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) ASC 
         LIMIT 1;`,
        [lng, lat]
      );
      if (roadMatch.rows.length > 0) {
        roadSegmentId = roadMatch.rows[0].id;
      }
    } catch (spatialErr) {
      console.warn('Road segment spatial lookup warning:', spatialErr);
    }

    // 5. Hard Insert into PostGIS Database (Proper Schema & SRID 4326)
    const insertSql = `
      INSERT INTO citizen_reports (
        road_segment_id,
        geom,
        s3_image_key,
        image_url,
        user_reported_depth,
        description,
        ai_analyzed,
        ai_is_flooded,
        ai_severity,
        ai_estimated_depth_cm,
        ai_confidence,
        ai_visual_markers,
        status,
        created_at
      )
      VALUES (
        $1,
        ST_SetSRID(ST_MakePoint($2, $3), 4326),
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13::jsonb,
        'VERIFIED',
        NOW()
      )
      RETURNING id, status, created_at;
    `;

    const dbRes = await query<{ id: string; status: string }>(insertSql, [
      roadSegmentId,
      lng,
      lat,
      s3Key,
      imageUrl,
      `Severity ${userSeverityRating || 3}/5`,
      userSeverityRating ? `Citizen rating: ${userSeverityRating}/5` : 'Direct citizen report',
      Boolean(aiAnalysis),
      isFlooded,
      severity,
      estimatedDepth,
      confidence,
      visualMarkers,
    ]);

    const newReportId = dbRes.rows[0].id;
    console.log(`✅ Successfully saved report ${newReportId} to PostGIS!`);

    // 6. Return actual synced data back to frontend Modal
    return NextResponse.json({
      success: true,
      report_id: newReportId,
      road_segment_id: roadSegmentId,
      status: 'VERIFIED',
      ai_analysis: aiAnalysis || {
        is_flooded: isFlooded,
        severity,
        estimated_depth_cm: estimatedDepth,
        confidence,
        manual_only: !s3Key,
      },
    });
  } catch (error: any) {
    console.error('Fatal Submit API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process citizen report' },
      { status: 500 }
    );
  }
}
