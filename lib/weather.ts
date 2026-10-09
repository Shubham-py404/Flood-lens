export async function fetchLiveWeather(lat: number = 28.6315, lng: number = 77.2167) {
    const meteoRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,weather_code&daily=precipitation_sum&timezone=auto`,
        { cache: 'no-store' }
    );

    const weatherData = await meteoRes.json();

    return {
        currentRainMm: weatherData.current.precipitation || 0,
        weatherCode: weatherData.current.weather_code || 0,
        rain24hMm: weatherData.daily?.precipitation_sum?.[0] || weatherData.current.precipitation || 0
    };
}