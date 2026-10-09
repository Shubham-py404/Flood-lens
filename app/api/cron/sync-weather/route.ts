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

        // Fetch road baseline data
        const roads = await query('SELECT id, elevation_m, historical_flood_count FROM road_segments');

        // Calculate new risk scores
        for (const road of roads.rows) {
            const rainPct = Math.min((currentRainMm / 50) * 100, 100) * 0.45;
            const elevationPct = Math.max((230 - road.elevation_m) / 20 * 100, 0) * 0.25;
            const historyPct = Math.min((road.historical_flood_count / 5) * 100, 100) * 0.30;

            const totalScore = Math.min(Math.round(rainPct + elevationPct + historyPct), 100);

            let riskLevel = 'LOW';
            if (totalScore >= 75) riskLevel = 'SEVERE';
            else if (totalScore >= 50) riskLevel = 'HIGH';
            else if (totalScore >= 25) riskLevel = 'MODERATE';

            const riskFactors = JSON.stringify({
                rainfall_pct: Math.round(rainPct),
                elevation_pct: Math.round(elevationPct),
                historical_pct: Math.round(historyPct),
                summary: `Live rainfall is ${currentRainMm}mm/hr. Total calculated risk score is ${totalScore}/100.`
            });

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