const endpoint = process.argv[2] || process.env.EXPO_PUBLIC_API_URL;
async function main() {
  if (!endpoint) throw new Error('Provide the public API URL ending in /api');
  const url = new URL(endpoint);
  const local = process.argv.includes('--local') && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, '') !== '/api')
    throw new Error('Use an HTTPS API URL ending in /api (or --local for loopback checks)');
  const request = (path, options) => fetch(`${url.origin}${path}`, { ...options, signal: AbortSignal.timeout(10000), redirect: 'error' });
  for (const path of ['/api/health/live', '/api/health/ready']) {
    const response = await request(path);
    const body = await response.json();
    if (!response.ok || !['ok', 'ready'].includes((body.data || body).status)) throw new Error(`${path} failed`);
    console.log(`${path}: OK`);
  }
  const invalid = await request('/api/auth/password/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' }, body: '{}',
  });
  if (invalid.status !== 400) throw new Error('Mobile auth route/validation contract is unavailable');
  console.log('Mobile auth route and JSON validation: OK');
  const polling = await request('/socket.io/?EIO=4&transport=polling');
  if (!polling.ok || !(await polling.text()).startsWith('0{')) throw new Error('Socket.IO polling handshake failed');
  console.log('Socket.IO through public origin: OK');
  if (process.env.APP_ORIGIN) {
    const cors = await request('/api/auth/password/login', { method: 'OPTIONS', headers: {
      Origin: process.env.APP_ORIGIN, 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-client-platform',
    } });
    if (!cors.ok || cors.headers.get('access-control-allow-origin') !== process.env.APP_ORIGIN ||
      !cors.headers.get('access-control-allow-headers')?.toLowerCase().includes('x-client-platform')) throw new Error('Browser CORS preflight failed');
    console.log('Configured browser origin: OK');
  }
  console.log('App integration smoke checks passed. Delivery providers and real user flows still need staging tests.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
