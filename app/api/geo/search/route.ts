import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      q.trim()
    )}&limit=6&addressdetails=1&countrycodes=in`;

    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'TerraPulseApp/1.0 (contact@terrapulse.app)',
        'Accept-Language': 'en',
      },
      next: { revalidate: 120 },
    });

    if (!res.ok) {
      return NextResponse.json([]);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Geo search proxy error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
