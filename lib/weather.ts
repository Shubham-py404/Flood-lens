export async function fetchLiveWeather(lat: number = 28.6315, lng: number = 77.2167) {
  try {
    const meteoRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=precipitation,weather_code&daily=precipitation_sum&timezone=auto`,
      { cache: 'no-store' }
    );
    
    if (!meteoRes.ok) throw new Error(`Weather API returned ${meteoRes.status}`);
    
    const weatherData = await meteoRes.json();
    
    return {
      currentRainMm: weatherData.current?.precipitation || 0,
      weatherCode: weatherData.current?.weather_code || 0,
      rain24hMm: weatherData.daily?.precipitation_sum?.[0] || weatherData.current?.precipitation || 0
    };
  } catch (error) {
    console.error("Weather fetch failed, falling back to 0mm:", error);
    // Graceful fallback prevents the cron job from crashing
    return { currentRainMm: 0, weatherCode: 0, rain24hMm: 0 }; 
  }
}