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
      SELECT r.id, r.road_name, r.elevation_m, r.historical_flood_count, r.current_risk_level,
      COALESCE(COUNT(c.id) FILTER (WHERE c.status != 'RESOLVED' AND c.last_reported_at >= NOW() - INTERVAL '60 minutes'), 0) as active_reports
      FROM road_segments r LEFT JOIN incident_clusters c ON r.id = c.road_segment_id GROUP BY r.id
    `;
        const roads = await query(sql);
        let totalAlertsCreated = 0;

        // 4. CALCULATE & UPDATE
        for (const road of roads.rows) {
            const previousRiskLevel = road.current_risk_level || 'LOW';
            const { totalScore, riskLevel: newRiskLevel, riskFactors } = calculateRiskScore(
                currentRainMm, parseFloat(road.elevation_m), parseInt(road.historical_flood_count), parseInt(road.active_reports)
            );

            // Update road segment with newly calculated risk score
            await query(
                `UPDATE road_segments SET current_risk_score = $1, current_risk_level = $2, risk_factors = $3, last_calculated_at = NOW() WHERE id = $4`,
                [totalScore, newRiskLevel, riskFactors, road.id]
            );

            // PROACTIVE ESCALATION DETECTION:
            const isEscalation =
                ((previousRiskLevel === 'LOW' || previousRiskLevel === 'MODERATE') &&
                    (newRiskLevel === 'HIGH' || newRiskLevel === 'SEVERE')) ||
                (previousRiskLevel === 'HIGH' && newRiskLevel === 'SEVERE');

            if (isEscalation) {
                // Find all active saved locations associated with this road segment
                const affectedSavedPlaces = await query(
                    `SELECT id, user_id, label, alert_on_risk_level
           FROM saved_locations
           WHERE nearest_road_segment_id = $1 AND is_active = TRUE`,
                    [road.id]
                );

                for (const place of affectedSavedPlaces.rows) {
                    if (place.alert_on_risk_level === 'SEVERE' && newRiskLevel !== 'SEVERE') {
                        continue;
                    }

                    const alertMessage = `⚠️ Flood Alert: Road segment "${road.road_name}" near your saved place "${place.label}" has escalated to ${newRiskLevel} flood risk (Score: ${totalScore}/100)!`;

                    const alertInsertRes = await query(
                        `INSERT INTO user_alerts (
              user_id,
              saved_location_id,
              road_segment_id,
              previous_risk_level,
              escalated_risk_level,
              message,
              is_read,
              created_at
            )
            SELECT $1, $2, $3, $4, $5, $6, FALSE, NOW()
            WHERE NOT EXISTS (
              SELECT 1 FROM user_alerts
              WHERE saved_location_id = $2
                AND road_segment_id = $3
                AND escalated_risk_level = $5
                AND created_at > NOW() - INTERVAL '3 hours'
            )
            RETURNING id;`,
                        [place.user_id, place.id, road.id, previousRiskLevel, newRiskLevel, alertMessage]
                    );

                    if (alertInsertRes.rowCount && alertInsertRes.rowCount > 0) {
                        totalAlertsCreated += alertInsertRes.rowCount;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Successfully evaluated ${roads.rowCount} roads.`,
            rain_mm: currentRainMm,
            alerts_generated: totalAlertsCreated,
        });

    } catch (error) {
        console.error('Risk Engine Error:', error);
        return NextResponse.json({ error: 'Failed to execute risk fusion engine' }, { status: 500 });
    }
}