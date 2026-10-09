/**
 * Test Suite for Citizen Reporting Feature (Plain Node.js ESM)
 */

async function runTests() {
  const baseUrl = 'http://localhost:3000';
  let passed = 0;
  let total = 0;

  function assert(testName, condition, details) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`, details || '');
    }
  }

  console.log('\n--- STARTING CITIZEN REPORTING TEST SUITE ---\n');

  // Test 1: Presigned URL - Missing payload
  try {
    const res = await fetch(`${baseUrl}/api/reports/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert('Presigned URL rejects empty body with 400', res.status === 400);
  } catch (err) {
    assert('Presigned URL empty body check', false, err);
  }

  // Test 2: Presigned URL - Invalid content type
  try {
    const res = await fetch(`${baseUrl}/api/reports/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test.exe', contentType: 'application/octet-stream' }),
    });
    assert('Presigned URL rejects disallowed file type with 400', res.status === 400);
  } catch (err) {
    assert('Presigned URL disallowed file type check', false, err);
  }

  // Test 3: Presigned URL - Valid payload
  try {
    const res = await fetch(`${baseUrl}/api/reports/presigned-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'street_flooding.jpg', contentType: 'image/jpeg' }),
    });
    const data = await res.json();
    assert(
      'Presigned URL returns uploadUrl and fileKey with valid filename',
      res.status === 200 && typeof data.uploadUrl === 'string' && typeof data.fileKey === 'string'
    );
  } catch (err) {
    assert('Presigned URL valid generation check', false, err);
  }

  // Test 4: Report Submit - Missing Coordinates
  try {
    const res = await fetch(`${baseUrl}/api/reports/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Flooding without GPS' }),
    });
    assert('Report submission rejects missing coordinates with 400', res.status === 400);
  } catch (err) {
    assert('Report submission coordinate rejection check', false, err);
  }

  // Test 5: Report Submit - Valid Voice / Text Report
  try {
    const res = await fetch(`${baseUrl}/api/reports/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.6315,
        longitude: 77.2167,
        voice_transcript: 'Water is knee-deep near Connaught Radial',
        depth_estimate: 'Knee-deep (15-50cm)',
        description: 'Two vehicles stalled in inner lane',
      }),
    });
    const data = await res.json();
    assert(
      'Report submission accepts valid report and returns 201',
      res.status === 201 && data.success === true && !!data.report_id
    );
  } catch (err) {
    assert('Report submission valid report check', false, err);
  }

  // Test 6: Report Submit - Valid Photo Attached Report
  try {
    const res = await fetch(`${baseUrl}/api/reports/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 28.6300,
        longitude: 77.2150,
        s3_image_key: 'reports/flood-test-123.jpg',
        depth_estimate: 'Waist-deep (50-100cm)',
      }),
    });
    const data = await res.json();
    assert(
      'Report submission accepts photo S3 key and initiates record',
      res.status === 201 && data.success === true && data.status === 'PENDING'
    );
  } catch (err) {
    assert('Report submission photo payload check', false, err);
  }

  console.log(`\n--- RESULTS: ${passed}/${total} TESTS PASSED ---\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
