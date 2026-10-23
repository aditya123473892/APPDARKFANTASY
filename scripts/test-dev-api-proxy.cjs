const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createDevApiProxy } = require('./dev-api-proxy.cjs');

async function listen(server, hostname = '127.0.0.1') {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, hostname, resolve);
  });
  return server.address().port;
}

test('IPv6 backend selection reaches login with the correct Host header', async (t) => {
  const backend = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ path: req.url, host: req.headers.host }));
    });
  });
  const backendPort = await listen(backend, '::1');
  const proxy = http.createServer(createDevApiProxy(() => {}, backendPort, '::1'));
  const port = await listen(proxy);
  t.after(() => {
    proxy.closeAllConnections(); proxy.close();
    backend.closeAllConnections(); backend.close();
  });
  const result = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: 'POST' });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), {
    path: '/api/auth/login', host: `[::1]:${backendPort}`,
  });
  assert.throws(() => createDevApiProxy(() => {}, 9000, 'example.com'), /loopback/);
});

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

test('repeated login/profile requests do not reuse stale backend sockets', async (t) => {
  const sockets = new Set();
  const backend = http.createServer((req, res) => {
    sockets.add(req.socket);
    req.resume();
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: req.url }));
    });
  });
  const backendPort = await listen(backend);
  const proxy = http.createServer(createDevApiProxy((req, res) => res.end('metro'), backendPort));
  const port = await listen(proxy);
  t.after(() => {
    proxy.closeAllConnections(); proxy.close();
    backend.closeAllConnections(); backend.close();
  });
  for (let attempt = 0; attempt < 15; attempt++) {
    for (const path of ['/api/auth/login', '/api/auth/me']) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: path.endsWith('login') ? 'POST' : 'GET',
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).path, path);
    }
  }
  assert.equal(sockets.size, 30, 'each request uses a fresh connection to the restartable backend');
});
