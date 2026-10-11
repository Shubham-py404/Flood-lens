import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    // Attempt to lookup IP location using reliable IP geocoding services
    const res = await fetch('https://ipwho.is/', {
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.latitude && data.longitude) {
        return NextResponse.json({
          lat: Number(data.latitude),
          lng: Number(data.longitude),
          city: data.city || 'Local Area',
          region: data.region || '',
          country: data.country || 'India',
        });
      }
    }

    // Secondary fallback
    const res2 = await fetch('http://ip-api.com/json', {
      next: { revalidate: 3600 },
    });

    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.status === 'success' && data2.lat && data2.lon) {
        return NextResponse.json({
          lat: Number(data2.lat),
          lng: Number(data2.lon),
          city: data2.city || 'Local Area',
          region: data2.regionName || '',
          country: data2.country || 'India',
        });
      }
    }

    return NextResponse.json({
      lat: 28.6315,
      lng: 77.2167,
      city: 'Delhi',
      region: 'NCR',
      country: 'India',
    });
  } catch (error) {
    return NextResponse.json({
      lat: 28.6315,
      lng: 77.2167,
      city: 'Delhi',
      region: 'NCR',
      country: 'India',
    });
  }
}
