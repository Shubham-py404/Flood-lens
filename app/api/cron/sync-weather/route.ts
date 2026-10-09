import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { fetchLiveWeather } from '@/lib/weather';
import { calculateRiskScore } from '@/lib/risk-engine';

export async function POST(request: Request) {
    const url = new URL(request.url);

    // 1. SECURITY CHECK
    const authHeader = request.headers.get('authorization');
    const querySecret = url.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${expectedSecret}` && querySecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const simulatedRain = url.searchParams.get('rain');

        // 2. FETCH WEATHER
        const { currentRainMm, rain24hMm, weatherCode } = simulatedRain
            ? { currentRainMm: parseFloat(simulatedRain), rain24hMm: parseFloat(simulatedRain) * 5, weatherCode: 65 }
            : await fetchLiveWeather();

        await query(
            `INSERT INTO weather_snapshots (precipitation_rate_mm_hr, accumulation_1h_mm, accumulation_24h_mm, weather_code, observed_at) VALUES ($1, $2, $3, $4, NOW())`,
            [currentRainMm, currentRainMm, rain24hMm, weatherCode]
        );

        // 3. FETCH BASELINES & ACTIVE REPORTS
        const sql = `
      SELECT r.id, r.elevation_m, r.historical_flood_count,
      COALESCE(COUNT(c.id) FILTER (WHERE c.status != 'RESOLVED' AND c.last_reported_at >= NOW() - INTERVAL '60 minutes'), 0) as active_reports
      FROM road_segments r LEFT JOIN incident_clusters c ON r.id = c.road_segment_id GROUP BY r.id
    `;
        const roads = await query(sql);

        // 4. CALCULATE & UPDATE
        for (const road of roads.rows) {
            const { totalScore, riskLevel, riskFactors } = calculateRiskScore(
                currentRainMm, parseFloat(road.elevation_m), parseInt(road.historical_flood_count), parseInt(road.active_reports)
            );

            await query(
                `UPDATE road_segments SET current_risk_score = $1, current_risk_level = $2, risk_factors = $3, last_calculated_at = NOW() WHERE id = $4`,
                [totalScore, riskLevel, riskFactors, road.id]
            );
        }

        return NextResponse.json({ success: true, message: `Evaluated ${roads.rowCount} roads.`, rain_mm: currentRainMm });
    } catch (error) {
        console.error('Risk Engine Error:', error);
        return NextResponse.json({ error: 'Failed to execute risk fusion engine' }, { status: 500 });
    }
}