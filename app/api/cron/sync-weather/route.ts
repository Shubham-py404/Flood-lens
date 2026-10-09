import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    const url = new URL(request.url);

    // 1. SECURITY CHECK
    const authHeader = request.headers.get('authorization');
    const querySecret = url.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (authHeader !== `Bearer ${expectedSecret}` && querySecret !== expectedSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const simulatedRain = url.searchParams.get('rain');

    try {
        let currentRainMm = 0;
        let rain24hMm = 0;
        let weatherCode = 0;

        // 2. WEATHER FETCH (Including 24h accumulation per spec)
        if (simulatedRain) {
            currentRainMm = parseFloat(simulatedRain);
            rain24hMm = currentRainMm * 5;
            weatherCode = 65;
        } else {
            const meteoRes = await fetch(
                'https://api.open-meteo.com/v1/forecast?latitude=28.6315&longitude=77.2167&current=precipitation,weather_code&daily=precipitation_sum&timezone=auto',
                { cache: 'no-store' }
            );
            const weatherData = await meteoRes.json();
            currentRainMm = weatherData.current.precipitation || 0;
            weatherCode = weatherData.current.weather_code || 0;
            rain24hMm = weatherData.daily?.precipitation_sum?.[0] || currentRainMm;
        }

        // Log the weather snapshot
        await query(
            `INSERT INTO weather_snapshots (precipitation_rate_mm_hr, accumulation_1h_mm, accumulation_24h_mm, weather_code, observed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
            [currentRainMm, currentRainMm, rain24hMm, weatherCode]
        );

        // 3. FETCH BASELINES & ACTIVE CROWDSOURCED REPORTS (S_reports)
        // We join the incident_clusters table to see if there are active, unresolved reports from the last 60 minutes
        const sql = `
      SELECT 
        r.id, 
        r.elevation_m, 
        r.historical_flood_count,
        COALESCE(COUNT(c.id) FILTER (WHERE c.status != 'RESOLVED' AND c.last_reported_at >= NOW() - INTERVAL '60 minutes'), 0) as active_reports
      FROM road_segments r
      LEFT JOIN incident_clusters c ON r.id = c.road_segment_id
      GROUP BY r.id
    `;
        const roads = await query(sql);

        // 4. COMPOSITE CALCULATION & SIGNAL NORMALIZATION (0-100 Scale)
        for (const road of roads.rows) {
            // S_rain: Standardized rainfall score (maxes out at 50mm/hr)
            const S_rain = Math.min((currentRainMm / 50) * 100, 100);

            // S_elev: Lower elevation = higher vulnerability (baseline 230m)
            const S_elev = Math.max((230 - parseFloat(road.elevation_m)) / 20 * 100, 0);

            // S_hist: Based on historical flood count (maxes out at 5 historical floods)
            const S_hist = Math.min((parseInt(road.historical_flood_count) / 5) * 100, 100);

            // S_reports: Crowdsourced ground-truth score (1 report = 50, 2+ reports = 100)
            const activeReports = parseInt(road.active_reports);
            const S_reports = Math.min(activeReports * 50, 100);

            // Fusion Formula: R = (0.45 * S_rain) + (0.25 * S_elev) + (0.15 * S_hist) + (0.15 * S_reports)
            const rawScore = (0.45 * S_rain) + (0.25 * S_elev) + (0.15 * S_hist) + (0.15 * S_reports);
            const totalScore = Math.min(Math.round(rawScore), 100);

            // Determine Category
            let riskLevel = 'LOW';
            if (totalScore >= 75) riskLevel = 'SEVERE';
            else if (totalScore >= 50) riskLevel = 'HIGH';
            else if (totalScore >= 25) riskLevel = 'MODERATE';

            // Plaintext explanation for UI Drawer
            const riskFactors = JSON.stringify({
                rainfall_pct: Math.round(0.45 * S_rain),
                elevation_pct: Math.round(0.25 * S_elev),
                historical_pct: Math.round(0.15 * S_hist),
                reports_pct: Math.round(0.15 * S_reports),
                summary: activeReports > 0
                    ? `Elevated by ${activeReports} active citizen report(s). Total score: ${totalScore}/100.`
                    : `Live rainfall is ${currentRainMm}mm/hr. Total score: ${totalScore}/100.`
            });

            // 5. DATABASE UPDATE
            await query(
                `UPDATE road_segments 
         SET current_risk_score = $1, current_risk_level = $2, risk_factors = $3, last_calculated_at = NOW() 
         WHERE id = $4`,
                [totalScore, riskLevel, riskFactors, road.id]
            );
        }

        return NextResponse.json({
            success: true,
            message: `Successfully evaluated ${roads.rowCount} roads.`,
            rain_mm: currentRainMm
        });

    } catch (error) {
        console.error('Risk Engine Error:', error);
        return NextResponse.json({ error: 'Failed to execute risk fusion engine' }, { status: 500 });
    }
}