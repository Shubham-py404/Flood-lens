export function calculateRiskScore(currentRainMm: number, elevationM: number, historyCount: number, activeReports: number) {
    // S_rain: Standardized rainfall score (maxes out at 50mm/hr)
    const S_rain = Math.min((currentRainMm / 50) * 100, 100);

    // S_elev: Lower elevation = higher vulnerability (baseline 230m)
    const S_elev = Math.max((230 - elevationM) / 20 * 100, 0);

    // S_hist: Based on historical flood count (maxes out at 5 historical floods)
    const S_hist = Math.min((historyCount / 5) * 100, 100);

    // S_reports: Crowdsourced ground-truth score (1 report = 50, 2+ reports = 100)
    const S_reports = Math.min(activeReports * 50, 100);

    // Fusion Formula: R = (0.45 * S_rain) + (0.25 * S_elev) + (0.15 * S_hist) + (0.15 * S_reports)
    const rawScore = (0.45 * S_rain) + (0.25 * S_elev) + (0.15 * S_hist) + (0.15 * S_reports);
    const totalScore = Math.min(Math.round(rawScore), 100);

    let riskLevel = 'LOW';
    if (totalScore >= 75) riskLevel = 'SEVERE';
    else if (totalScore >= 50) riskLevel = 'HIGH';
    else if (totalScore >= 25) riskLevel = 'MODERATE';

    const riskFactors = {
        rainfall_pct: Math.round(0.45 * S_rain),
        elevation_pct: Math.round(0.25 * S_elev),
        historical_pct: Math.round(0.15 * S_hist),
        reports_pct: Math.round(0.15 * S_reports),
        summary: activeReports > 0
            ? `Elevated by ${activeReports} active citizen report(s). Total score: ${totalScore}/100.`
            : `Live rainfall is ${currentRainMm}mm/hr. Total score: ${totalScore}/100.`
    };

    return { totalScore, riskLevel, riskFactors: JSON.stringify(riskFactors) };
}