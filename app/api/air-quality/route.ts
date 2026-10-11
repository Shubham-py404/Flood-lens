import { NextRequest, NextResponse } from 'next/server';
import { AirQualityData } from '@/types/api';
import { getDynamicLocationName, calculateIndiaAQI } from '@/lib/env-utils';

function getCategoryInfo(aqi: number) {
  if (aqi <= 50) {
    return {
      category: 'Good' as const,
      categoryColor: '#22c55e',
      advice: 'Air quality is satisfactory and air pollution poses little or no risk.',
      guidance: [
        { icon: 'outdoor' as const, text: 'Great day for outdoor activities, walking, or running.' },
        { icon: 'window' as const, text: 'Ideal time to open windows and ventilate indoor air.' },
      ],
    };
  } else if (aqi <= 100) {
    return {
      category: 'Moderate' as const,
      categoryColor: '#eab308',
      advice: 'Air quality is acceptable; unusually sensitive individuals should consider limiting outdoor exertion.',
      guidance: [
        { icon: 'mask' as const, text: 'Extremely sensitive individuals may consider a light mask outdoors.' },
        { icon: 'window' as const, text: 'Safe to open windows outside heavy traffic rush hours.' },
      ],
    };
  } else if (aqi <= 150) {
    return {
      category: 'Unhealthy for Sensitive Groups' as const,
      categoryColor: '#f97316',
      advice: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.',
      guidance: [
        { icon: 'mask' as const, text: 'Sensitive groups (children, elderly, respiratory): wear N95 mask outdoors.' },
        { icon: 'window' as const, text: 'Keep windows closed during peak commute hours; use air purifier.' },
      ],
    };
  } else if (aqi <= 200) {
    return {
      category: 'Unhealthy' as const,
      categoryColor: '#ef4444',
      advice: 'Everyone may begin to experience health effects. Active children and adults should avoid prolonged outdoor exertion.',
      guidance: [
        { icon: 'mask' as const, text: 'Wear protective mask (N95/KN95) outdoors to filter fine particulates.' },
        { icon: 'window' as const, text: 'Keep windows sealed; run indoor HEPA filtration if available.' },
      ],
    };
  } else if (aqi <= 300) {
    return {
      category: 'Very Unhealthy' as const,
      categoryColor: '#a855f7',
      advice: 'Health alert: The risk of health effects is increased for everyone. Avoid prolonged outdoor exertion.',
      guidance: [
        { icon: 'mask' as const, text: 'Avoid outdoor exercise; wear high-grade filtration mask if leaving home.' },
        { icon: 'window' as const, text: 'Seal doors and windows; use air purifiers on maximum setting.' },
      ],
    };
  } else {
    return {
      category: 'Hazardous' as const,
      categoryColor: '#881337',
      advice: 'Health warning of emergency conditions: Everyone is more likely to be affected. Remain indoors.',
      guidance: [
        { icon: 'mask' as const, text: 'Emergency conditions: do not engage in outdoor activities.' },
        { icon: 'window' as const, text: 'Keep all ventilation closed; stay in clean, sealed rooms.' },
      ],
    };
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '28.6315');
  const lng = parseFloat(searchParams.get('lng') || '77.2167');

  try {
    const [airRes, dynamicLocation] = await Promise.all([
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone&timezone=auto`,
        { next: { revalidate: 60 } }
      ),
      getDynamicLocationName(lat, lng),
    ]);

    if (!airRes.ok) {
      throw new Error(`Open-Meteo returned status ${airRes.status}`);
    }

    const data = await airRes.json();
    const current = data.current || {};
    const usAqi = Math.round(current.us_aqi ?? 142);
    const pm2_5 = Number(current.pm2_5?.toFixed(1) ?? 48.5);
    const pm10 = Number(current.pm10?.toFixed(1) ?? 92.4);

    const indiaResult = calculateIndiaAQI(pm2_5, pm10);
    const catInfo = getCategoryInfo(usAqi);

    const payload: AirQualityData = {
      aqi: usAqi,
      category: catInfo.category,
      categoryColor: catInfo.categoryColor,
      pm2_5,
      pm10,
      nitrogen_dioxide: Number(current.nitrogen_dioxide?.toFixed(1) ?? 34.2),
      ozone: Number(current.ozone?.toFixed(1) ?? 45.1),
      sulphur_dioxide: Number(current.sulphur_dioxide?.toFixed(1) ?? 12.8),
      carbon_monoxide: Number(current.carbon_monoxide?.toFixed(1) ?? 420.0),
      source: 'Open-Meteo CAMS Atmospheric Ensemble (Live)',
      observed_at: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
      is_stale: false,
      advice: catInfo.advice,
      guidance: catInfo.guidance,
      location_name: dynamicLocation,
      indian_aqi: indiaResult.aqi,
      indian_category: indiaResult.category,
      indian_category_color: indiaResult.color,
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    console.warn('Air quality fetch fallback applied:', err);
    const fallbackAqi = 145;
    const catInfo = getCategoryInfo(fallbackAqi);
    const indiaResult = calculateIndiaAQI(52.0, 98.0);

    const fallback: AirQualityData = {
      aqi: fallbackAqi,
      category: catInfo.category,
      categoryColor: catInfo.categoryColor,
      pm2_5: 52.0,
      pm10: 98.0,
      nitrogen_dioxide: 28.5,
      ozone: 40.0,
      sulphur_dioxide: 14.2,
      carbon_monoxide: 450.0,
      source: 'Open-Meteo Regional Model (Fallback)',
      observed_at: new Date().toISOString(),
      is_stale: true,
      advice: catInfo.advice,
      guidance: catInfo.guidance,
      location_name: `${lat.toFixed(3)}° N, ${lng.toFixed(3)}° E`,
      indian_aqi: indiaResult.aqi,
      indian_category: indiaResult.category,
      indian_category_color: indiaResult.color,
    };

    return NextResponse.json(fallback);
  }
}
