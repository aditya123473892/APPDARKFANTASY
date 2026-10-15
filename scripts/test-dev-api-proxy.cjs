const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createDevApiProxy } = require('./dev-api-proxy.cjs');

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server.address().port;
}

test('Metro proxy forwards API bodies, auth headers, uploads and Socket.IO polling', async (t) => {
  const backend = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ url: req.url, method: req.method, auth: req.headers.authorization, body }),
      );
    });
  });
  const backendPort = await listen(backend);
  const proxy = http.createServer(createDevApiProxy((req, res) => res.end('metro'), backendPort));
  const port = await listen(proxy);
  t.after(() => {
    proxy.closeAllConnections();
    proxy.close();
    backend.closeAllConnections();
    backend.close();
  });
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { Authorization: 'Bearer test-only' },
    body: '{"username":"test"}',
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    url: '/api/auth/login',
    method: 'POST',
    auth: 'Bearer test-only',
    body: '{"username":"test"}',
  });
  for (const path of ['/uploads/photo.jpg', '/socket.io/?EIO=4&transport=polling']) {
    const result = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal((await result.json()).url, path);
  }
  assert.equal(await (await fetch(`http://127.0.0.1:${port}/status`)).text(), 'metro');
});
