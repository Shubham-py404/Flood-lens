/**
 * Dynamic Geocoding and Environmental Utilities
 */

export interface ReverseGeoResult {
  formattedName: string;
  suburb?: string;
  city?: string;
  state?: string;
}

/**
 * Reverse geocodes coordinates to meaningful district/suburb and city names
 * with an aggressive abort timeout so it never stalls page renders.
 */
export async function getDynamicLocationName(lat: number, lng: number): Promise<string> {
  const fallback = `${lat.toFixed(3)}° N, ${lng.toFixed(3)}° E`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      {
        headers: {
          'User-Agent': 'FloodLens/1.0 (https://floodlens.org; contact@floodlens.org)',
          'Accept-Language': 'en',
        },
        signal: controller.signal,
        next: { revalidate: 86400 }, // Cache geocode for 24h
      }
    );
    clearTimeout(timeoutId);

    if (geoRes.ok) {
      const data = await geoRes.json();
      const addr = data.address || {};
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict;
      const city = addr.city || addr.town || addr.city_district || addr.state_district || addr.county;
      const state = addr.state;

      if (suburb && city) {
        return `${suburb}, ${city}`;
      } else if (suburb && state) {
        return `${suburb}, ${state}`;
      } else if (city) {
        return `${city}${state ? `, ${state}` : ''}`;
      }
    }
  } catch {
    // If geocoding times out or fails, fall back to coordinate representation
  }

  return fallback;
}

/**
 * Computes Indian National Air Quality Index (CPCB / NAQI)
 * according to Central Pollution Control Board standard breakpoints.
 */
export function calculateIndiaAQI(pm2_5: number, pm10: number): {
  aqi: number;
  category: string;
  color: string;
} {
  function getSubIndex(val: number, breakpoints: { clo: number; chi: number; ilo: number; ihi: number }[]) {
    for (const b of breakpoints) {
      if (val >= b.clo && val <= b.chi) {
        return Math.round(((b.ihi - b.ilo) / (b.chi - b.clo)) * (val - b.clo) + b.ilo);
      }
    }
    return val > 380 ? 500 : 0;
  }

  // CPCB 24-hr standard breakpoints for PM2.5 (µg/m³)
  const bp25 = [
    { clo: 0, chi: 30, ilo: 0, ihi: 50 },
    { clo: 30.1, chi: 60, ilo: 51, ihi: 100 },
    { clo: 60.1, chi: 90, ilo: 101, ihi: 200 },
    { clo: 90.1, chi: 120, ilo: 201, ihi: 300 },
    { clo: 120.1, chi: 250, ilo: 301, ihi: 400 },
    { clo: 250.1, chi: 380, ilo: 401, ihi: 500 },
  ];

  // CPCB 24-hr standard breakpoints for PM10 (µg/m³)
  const bp10 = [
    { clo: 0, chi: 50, ilo: 0, ihi: 50 },
    { clo: 50.1, chi: 100, ilo: 51, ihi: 100 },
    { clo: 100.1, chi: 250, ilo: 101, ihi: 200 },
    { clo: 250.1, chi: 350, ilo: 201, ihi: 300 },
    { clo: 350.1, chi: 430, ilo: 301, ihi: 400 },
    { clo: 430.1, chi: 510, ilo: 401, ihi: 500 },
  ];

  const sub25 = getSubIndex(pm2_5, bp25);
  const sub10 = getSubIndex(pm10, bp10);
  const aqi = Math.max(sub25, sub10);

  let category = 'Good';
  let color = '#22c55e';

  if (aqi <= 50) {
    category = 'Good';
    color = '#22c55e';
  } else if (aqi <= 100) {
    category = 'Satisfactory';
    color = '#84cc16';
  } else if (aqi <= 200) {
    category = 'Moderate';
    color = '#eab308';
  } else if (aqi <= 300) {
    category = 'Poor';
    color = '#f97316';
  } else if (aqi <= 400) {
    category = 'Very Poor';
    color = '#ef4444';
  } else {
    category = 'Severe';
    color = '#881337';
  }

  return { aqi, category, color };
}
