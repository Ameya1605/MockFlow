const BASE_URL = 'http://localhost:3939';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { response, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  let passed = 0;
  let failed = 0;
  let firstGetResponse = null;
  let createdId = null;

  const logResult = (ok, description, reason) => {
    if (ok) {
      passed += 1;
      console.log(`✅ PASS: ${description}`);
    } else {
      failed += 1;
      console.log(`❌ FAIL: ${description} — ${reason}`);
    }
  };

  try {
    const first = await request('/api/users');
    const second = await request('/api/users');

    try {
      assert(first.response.ok, 'GET /api/users should return 200');
      assert(second.response.ok, 'GET /api/users second call should return 200');
      assert(Array.isArray(first.body), 'First GET response should be a JSON array');
      assert(Array.isArray(second.body), 'Second GET response should be a JSON array');
      assert(first.body.length > 0, 'First GET response should contain at least one record');
      assert(second.body.length > 0, 'Second GET response should contain at least one record');
      assert(JSON.stringify(first.body) === JSON.stringify(second.body), 'Two consecutive GET responses should be deeply equal to prove caching');
      firstGetResponse = first.body;
      logResult(true, 'GET /api/users twice returns matching cached arrays', '');
    } catch (error) {
      logResult(false, 'GET /api/users twice returns matching cached arrays', error.message);
    }
  } catch (error) {
    logResult(false, 'GET /api/users twice returns matching cached arrays', error.message);
  }

  try {
    const payload = { name: 'Ada Lovelace', email: 'ada@example.com' };
    const created = await request('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    assert(created.response.status === 201, 'POST /api/users should return 201');
    assert(created.body && typeof created.body === 'object', 'POST response should be a JSON object');
    assert(typeof created.body.id === 'string' && created.body.id.length > 0, 'Created record should include an id');
    assert(created.body.name === payload.name, 'Created record should preserve the sent name');
    assert(created.body.email === payload.email, 'Created record should preserve the sent email');
    createdId = created.body.id;
    logResult(true, 'POST /api/users creates a record with the sent fields', '');
  } catch (error) {
    logResult(false, 'POST /api/users creates a record with the sent fields', error.message);
  }

  try {
    const afterPost = await request('/api/users');
    assert(afterPost.response.ok, 'GET /api/users after POST should return 200');
    assert(Array.isArray(afterPost.body), 'GET /api/users after POST should return an array');
    assert(afterPost.body.length === firstGetResponse.length + 1, 'Array length should increase by exactly 1 after POST');
    const adaRecord = afterPost.body.find((item) => item.email === 'ada@example.com');
    assert(Boolean(adaRecord), 'Created record should appear in the refreshed GET response');
    logResult(true, 'GET /api/users after POST shows the new record', '');
  } catch (error) {
    logResult(false, 'GET /api/users after POST shows the new record', error.message);
  }

  try {
    const updated = await request(`/api/users/${createdId}`, {
      method: 'PUT',
      body: JSON.stringify({ isActive: false }),
    });

    assert(updated.response.status === 200, 'PUT /api/users/:id should return 200');
    assert(updated.body && typeof updated.body === 'object', 'PUT response should be a JSON object');
    assert(updated.body.isActive === false, 'Updated record should reflect the patch');
    logResult(true, 'PUT /api/users/:id updates the record', '');
  } catch (error) {
    logResult(false, 'PUT /api/users/:id updates the record', error.message);
  }

  try {
    const deleted = await request(`/api/users/${createdId}`, { method: 'DELETE' });
    assert(deleted.response.status === 204, 'DELETE /api/users/:id should return 204');
    logResult(true, 'DELETE /api/users/:id removes the record', '');
  } catch (error) {
    logResult(false, 'DELETE /api/users/:id removes the record', error.message);
  }

  try {
    const deletedAgain = await request(`/api/users/${createdId}`, { method: 'DELETE' });
    assert(deletedAgain.response.status === 404, 'Second DELETE /api/users/:id should return 404');
    logResult(true, 'Second DELETE /api/users/:id returns 404', '');
  } catch (error) {
    logResult(false, 'Second DELETE /api/users/:id returns 404', error.message);
  }

  console.log(`\nSummary: ${passed}/${passed + failed} passed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
