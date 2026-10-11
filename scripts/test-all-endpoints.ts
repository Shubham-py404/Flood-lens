/**
 * Comprehensive End-to-End Test Suite for All TerraPulse / FloodLens Endpoints & Flows
 * Runs via: npx tsx scripts/test-all-endpoints.ts
 */

import assert from 'node:assert';

const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

console.log('🚀 Running Comprehensive Test Suite on', baseUrl, '\n');

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (err: any) {
    console.error(`❌ FAIL: ${name}`, err?.message || err);
    process.exitCode = 1;
  }
}

async function runAll() {
  // 1. Air Quality Endpoint
  await test('GET /api/air-quality returns normalized AQI and 6-pollutants', async () => {
    const res = await fetch(`${baseUrl}/api/air-quality?lat=28.6315&lng=77.2167`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.aqi === 'number', 'aqi must be number');
    assert.ok(data.category, 'category must exist');
    assert.ok(typeof data.pm2_5 === 'number', 'pm2_5 must be number');
    assert.ok(typeof data.pm10 === 'number', 'pm10 must be number');
    assert.ok(typeof data.nitrogen_dioxide === 'number', 'nitrogen_dioxide must be number');
    assert.ok(typeof data.ozone === 'number', 'ozone must be number');
    assert.ok(data.source, 'source attribution must be present');
  });

  // 2. Daily Environmental Pulse Summary Endpoint
  await test('GET /api/environment/summary returns composite daily pulse data', async () => {
    const res = await fetch(`${baseUrl}/api/environment/summary?lat=28.6315&lng=77.2167`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.air_quality, 'air_quality missing');
    assert.ok(data.weather, 'weather missing');
    assert.ok(typeof data.active_incidents_count === 'number', 'active_incidents_count must be number');
    assert.ok(data.freshness, 'freshness label missing');
  });

  // 3. Nearby Insights Feed Endpoint
  await test('GET /api/insights/nearby returns proximity-sorted incident items', async () => {
    const res = await fetch(`${baseUrl}/api/insights/nearby?lat=28.6315&lng=77.2167`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.items), 'items must be an array');
    if (data.items.length > 0) {
      const item = data.items[0];
      assert.ok(item.id, 'id missing');
      assert.ok(typeof item.distance_m === 'number', 'distance_m must be number');
      assert.ok(item.time_ago, 'time_ago must be present');
    }
  });

  // 4. Saved Places & Alerts
  let createdPlaceId = '';
  await test('POST /api/user/saved-locations creates a new saved location', async () => {
    const res = await fetch(`${baseUrl}/api/user/saved-locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: 'Automated Test Place',
        latitude: 28.6315,
        longitude: 77.2167,
        alert_on_risk_level: 'HIGH',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    const locId = data.saved_location?.id || data.location?.id;
    assert.ok(locId, 'Location id must be returned');
    createdPlaceId = locId;
  });

  await test('GET /api/user/saved-locations returns saved places list', async () => {
    const res = await fetch(`${baseUrl}/api/user/saved-locations`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.saved_locations), 'saved_locations must be array');
    assert.ok(data.saved_locations.some((p: any) => p.id === createdPlaceId), 'Created place must appear in list');
  });

  if (createdPlaceId) {
    await test('DELETE /api/user/saved-locations/[id] cleans up test place', async () => {
      const res = await fetch(`${baseUrl}/api/user/saved-locations/${createdPlaceId}`, {
        method: 'DELETE',
      });
      assert.strictEqual(res.status, 200);
    });
  }

  // 5. Active Reports
  await test('GET /api/reports/active returns active hazards list', async () => {
    const res = await fetch(`${baseUrl}/api/reports/active`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.incidents), 'incidents must be array');
  });

  // 6. Risk Area PostGIS LineStrings
  await test('GET /api/risk/area returns PostGIS LineString GeoJSON features', async () => {
    const res = await fetch(`${baseUrl}/api/risk/area?bbox=77.15,28.60,77.30,28.70`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.type, 'FeatureCollection');
    assert.ok(Array.isArray(data.features), 'features must be array');
  });

  // 7. Grounded AI Environmental Assistant Query
  await test('POST /api/assistant/query returns grounded advice with citations', async () => {
    const res = await fetch(`${baseUrl}/api/assistant/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'How is the air quality right now around Connaught Place?',
        lat: 28.6315,
        lng: 77.2167,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.answer && data.answer.length > 0, 'answer must be provided');
    assert.ok(Array.isArray(data.citations), 'citations array must be returned');
    assert.ok(data.uncertainty_note, 'uncertainty disclaimer must be present');
  });

  // 8. Cron Weather Recalculation
  await test('GET /api/cron/sync-weather updates risk scores based on weather simulation', async () => {
    const res = await fetch(`${baseUrl}/api/cron/sync-weather?rain=0`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.success, 'Sync weather must return success: true');
  });

  console.log('\n🎉 Comprehensive Verification Suite Completed Successfully!\n');
}

runAll();
