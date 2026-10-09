import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // 1. SECURITY CHECK: Validate the Cron Secret
    const authHeader = request.headers.get('authorization');
    const querySecret = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    // Allow passing the secret either via Authorization header or URL query parameter
    if (authHeader !== `Bearer ${expectedSecret}` && querySecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // HACKATHON DEMO FEATURE: Allow forcing a specific rainfall amount
    const simulatedRain = searchParams.get('rain');

    try {
        let currentRainMm = 0;
        let weatherCode = 0;

        if (simulatedRain) {
            currentRainMm = parseFloat(simulatedRain);
            weatherCode = 65;
        } else {
            const meteoRes = await fetch(
                'https://api.open-meteo.com/v1/forecast?latitude=28.6315&longitude=77.2167&current=precipitation,weather_code',
                { cache: 'no-store' }
            );
            const weatherData = await meteoRes.json();
            currentRainMm = weatherData.current.precipitation;
            weatherCode = weatherData.current.weather_code;
        }

        // Log the weather snapshot
        await query(
            `INSERT INTO weather_snapshots (precipitation_rate_mm_hr, accumulation_1h_mm, accumulation_24h_mm, weather_code, observed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
            [currentRainMm, currentRainMm, currentRainMm * 5, weatherCode]
        );

        // Fetch road baseline data including current_risk_level to detect transitions
        const roads = await query(
            'SELECT id, road_name, elevation_m, historical_flood_count, current_risk_level FROM road_segments'
        );

        let totalAlertsCreated = 0;

        // Calculate new risk scores and detect transitions
        for (const road of roads.rows) {
            const previousRiskLevel = road.current_risk_level || 'LOW';

            const rainPct = Math.min((currentRainMm / 50) * 100, 100) * 0.45;
            const elevationPct = Math.max((230 - road.elevation_m) / 20 * 100, 0) * 0.25;
            const historyPct = Math.min((road.historical_flood_count / 5) * 100, 100) * 0.30;

            const totalScore = Math.min(Math.round(rainPct + elevationPct + historyPct), 100);

            let newRiskLevel = 'LOW';
            if (totalScore >= 75) newRiskLevel = 'SEVERE';
            else if (totalScore >= 50) newRiskLevel = 'HIGH';
            else if (totalScore >= 25) newRiskLevel = 'MODERATE';

            const riskFactors = JSON.stringify({
                rainfall_pct: Math.round(rainPct),
                elevation_pct: Math.round(elevationPct),
                historical_pct: Math.round(historyPct),
                summary: `Live rainfall is ${currentRainMm}mm/hr. Total calculated risk score is ${totalScore}/100.`
            });

            // Update road segment with newly calculated risk score
            await query(
                `UPDATE road_segments 
         SET current_risk_score = $1, current_risk_level = $2, risk_factors = $3, last_calculated_at = NOW() 
         WHERE id = $4`,
                [totalScore, newRiskLevel, riskFactors, road.id]
            );

            // PROACTIVE ESCALATION DETECTION:
            // Detect transitions from LOW/MODERATE to HIGH/SEVERE, or escalation from HIGH to SEVERE
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
                    // Check if place's sensitivity matches (e.g. if set to SEVERE, only alert on SEVERE)
                    if (place.alert_on_risk_level === 'SEVERE' && newRiskLevel !== 'SEVERE') {
                        continue;
                    }

                    const alertMessage = `⚠️ Flood Alert: Road segment "${road.road_name}" near your saved place "${place.label}" has escalated to ${newRiskLevel} flood risk (Score: ${totalScore}/100)!`;

                    // Idempotent alert creation: avoid duplicates if an identical escalation alert was created recently
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
                        [
                            place.user_id,
                            place.id,
                            road.id,
                            previousRiskLevel,
                            newRiskLevel,
                            alertMessage,
                        ]
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