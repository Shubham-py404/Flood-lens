import { NextRequest, NextResponse } from 'next/server';

interface SearchResultItem {
  place_id: number | string;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  distance_km?: number;
}

// Calculate great-circle distance between two coordinates in kilometers (Haversine formula)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const userLatStr = searchParams.get('lat');
  const userLngStr = searchParams.get('lng');

  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  const query = q.trim();
  const userLat = userLatStr ? parseFloat(userLatStr) : null;
  const userLng = userLngStr ? parseFloat(userLngStr) : null;

  try {
    const rawResults: SearchResultItem[] = [];
    const seenIds = new Set<string>();

    const addItems = (items: any[]) => {
      for (const item of items) {
        const id = String(item.place_id || `${item.lat},${item.lon}`);
        if (!seenIds.has(id) && item.lat && item.lon) {
          seenIds.add(id);
          rawResults.push({
            place_id: id,
            name: item.name || (item.display_name ? item.display_name.split(',')[0].trim() : undefined),
            display_name: item.display_name || item.name || query,
            lat: String(item.lat),
            lon: String(item.lon),
          });
        }
      }
    };

    const headers = {
      'User-Agent': 'TerraPulseApp/1.0 (contact@terrapulse.app)',
      'Accept-Language': 'en',
    };

    // Primary search query to OpenStreetMap Nominatim
    // Biased around user's active viewpoint if available
    let nominatimPrimary = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=15&addressdetails=1`;

    if (userLat !== null && userLng !== null) {
      const minLon = userLng - 0.4;
      const maxLon = userLng + 0.4;
      const minLat = userLat - 0.4;
      const maxLat = userLat + 0.4;
      nominatimPrimary += `&viewbox=${minLon.toFixed(4)},${maxLat.toFixed(4)},${maxLon.toFixed(4)},${minLat.toFixed(4)}&bounded=0`;
    } else {
      nominatimPrimary += `&countrycodes=in`;
    }

    const primaryRes = await fetch(nominatimPrimary, {
      headers,
      next: { revalidate: 60 },
    }).catch(() => null);

    if (primaryRes && primaryRes.ok) {
      const data = await primaryRes.json();
      if (Array.isArray(data)) addItems(data);
    }

    // Secondary Indian search if primary returned few matches
    if (rawResults.length < 5) {
      const indiaUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&limit=10&addressdetails=1&countrycodes=in`;
      const indiaRes = await fetch(indiaUrl, { headers, next: { revalidate: 60 } }).catch(() => null);
      if (indiaRes && indiaRes.ok) {
        const indiaData = await indiaRes.json();
        if (Array.isArray(indiaData)) addItems(indiaData);
      }
    }

    // Step 3: Fast Multi-Source Fallback (Photon geocoder by Komoot)
    // Indexes POIs, amenities, businesses, and parks from OpenStreetMap
    if (rawResults.length < 6) {
      try {
        let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`;
        if (userLat !== null && userLng !== null) {
          photonUrl += `&lat=${userLat}&lon=${userLng}`;
        }
        const photonRes = await fetch(photonUrl, { next: { revalidate: 60 } }).catch(() => null);
        if (photonRes && photonRes.ok) {
          const photonData = await photonRes.json();
          if (photonData?.features && Array.isArray(photonData.features)) {
            for (const f of photonData.features) {
              const props = f.properties || {};
              const coords = f.geometry?.coordinates;
              if (coords && coords.length >= 2) {
                const lon = coords[0];
                const lat = coords[1];
                const id = `photon-${props.osm_id || `${lat},${lon}`}`;
                if (!seenIds.has(id)) {
                  seenIds.add(id);
                  const name = props.name || query;
                  const parts = [
                    props.name,
                    props.street,
                    props.district || props.locality,
                    props.city,
                    props.state,
                    props.country,
                  ].filter(Boolean);
                  rawResults.push({
                    place_id: id,
                    name,
                    display_name: parts.join(', '),
                    lat: String(lat),
                    lon: String(lon),
                  });
                }
              }
            }
          }
        }
      } catch (photonErr) {
        console.warn('Photon fallback error:', photonErr);
      }
    }

    // Step 4: Semantic Landmark / Area Resolution via Search Engine suggestions
    // If the place is not directly tagged in OSM (e.g. popular local cafe or newly opened store)
    // we extract known locality anchors from autocomplete suggestions (e.g. "cafe wink anand vihar" -> Anand Vihar)
    const hasNearbyMatch = rawResults.some(
      (r) =>
        userLat !== null &&
        userLng !== null &&
        getDistanceKm(userLat, userLng, parseFloat(r.lat), parseFloat(r.lon)) < 50
    );

    if (rawResults.length === 0 || !hasNearbyMatch) {
      try {
        const suggestRes = await fetch(
          `https://www.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`
        ).catch(() => null);

        if (suggestRes && suggestRes.ok) {
          const suggestData = await suggestRes.json();
          const suggestions: string[] = Array.isArray(suggestData[1]) ? suggestData[1] : [];

          // Look for geographical tokens after the query
          const geoCandidates = suggestions
            .map((s) => s.replace(new RegExp('^' + query + '\\s*', 'i'), '').trim())
            .filter(
              (s) =>
                s.length >= 3 &&
                !/^(photos|offers|reviews|menu|price|owner|timing|contact|image|video)$/i.test(s)
            );

          for (const candidate of geoCandidates.slice(0, 5)) {
            const candidateUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              candidate
            )}&limit=1&countrycodes=in`;
            const candidateRes = await fetch(candidateUrl, { headers }).catch(() => null);
            if (candidateRes && candidateRes.ok) {
              const candidateData = await candidateRes.json();
              if (Array.isArray(candidateData) && candidateData.length > 0) {
                const loc = candidateData[0];
                const fallbackId = `resolved-${loc.place_id}`;
                if (!seenIds.has(fallbackId)) {
                  seenIds.add(fallbackId);
                  const cleanCandidateName = candidate.charAt(0).toUpperCase() + candidate.slice(1);
                  rawResults.push({
                    place_id: fallbackId,
                    name: `${query.charAt(0).toUpperCase() + query.slice(1)} (${cleanCandidateName})`,
                    display_name: `${query.charAt(0).toUpperCase() + query.slice(1)}, ${loc.display_name}`,
                    lat: String(loc.lat),
                    lon: String(loc.lon),
                  });
                }
              }
            }
          }
        }
      } catch (semanticErr) {
        console.warn('Semantic landmark fallback error:', semanticErr);
      }
    }

    // Step 5: Distance Calculation & Strictly Sort Top-to-Bottom from Closest to Farthest
    const referenceLat = userLat ?? 28.6315;
    const referenceLng = userLng ?? 77.2167;

    const formattedResults = rawResults.map((item) => {
      const itemLat = parseFloat(item.lat);
      const itemLon = parseFloat(item.lon);
      const dist =
        !isNaN(itemLat) && !isNaN(itemLon)
          ? getDistanceKm(referenceLat, referenceLng, itemLat, itemLon)
          : 999999;
      return {
        ...item,
        distance_km: Math.round(dist * 10) / 10,
      };
    });

    // Strictly sort: Closest distance top to bottom
    formattedResults.sort((a, b) => (a.distance_km ?? 999999) - (b.distance_km ?? 999999));

    return NextResponse.json(formattedResults);
  } catch (error) {
    console.error('Geo search proxy error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
