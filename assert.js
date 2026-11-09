const assert = require('assert');
const http = require('http');
const { server } = require('./MissionControl');

const endpoints = ['/api/data', '/api/dashboard', '/api/agents', '/api/crew_summary', '/api/channels', '/api/tasks', '/api/calendar', '/api/activity', '/api/memory', '/api/deploy', '/'];
function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:4173${path}`, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

server.listen(4173, '127.0.0.1', async () => {
  try {
    for (const endpoint of endpoints) {
      const result = await request(endpoint);
      assert.strictEqual(result.status, 200, `${endpoint} status`);
      assert.ok(result.body.length > 0, `${endpoint} body`);
      if (endpoint.startsWith('/api/')) {
        const json = JSON.parse(result.body);
        if (endpoint === '/api/deploy') {
          assert.ok(json.available !== undefined, 'deploy has available flag');
          assert.ok(Array.isArray(json.recent_commits), 'deploy has recent_commits array');
        }
        if (endpoint === '/api/agents') {
          for (const a of (json.items || [])) {
            assert.notStrictEqual(a.current_task, 'Executing runtime instructions', 'no fabricated task strings');
          }
        }
      }
    }
    console.log('MISSION_CONTROL_SMOKE_OK');
  } finally {
    server.close();
  }
});
