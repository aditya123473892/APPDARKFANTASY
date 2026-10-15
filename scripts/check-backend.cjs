const os = require('node:os');
const fs = require('node:fs');
const configured = fs
  .readFileSync('.env.mobile', 'utf8')
  .match(/^EXPO_PUBLIC_API_URL=(.+)$/m)?.[1]
  .trim();
const addresses = Object.entries(os.networkInterfaces()).flatMap(([name, entries]) =>
  entries.filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, ip: a.address })),
);
console.log('PC network addresses:', addresses);
console.log('Configured mobile API:', configured);
const urls = new Set([
  'http://127.0.0.1:9000/api/auth/me',
  'http://127.0.0.1:8081/status',
  `${configured}/auth/me`,
  ...addresses.map((a) => `http://${a.ip}:9000/api/auth/me`),
]);
Promise.all(
  [...urls].map(async (url) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      console.log(url, response.status, (await response.text()).slice(0, 250));
    } catch (error) {
      console.log(url, error.message, error.cause?.code || '');
    }
  }),
);

if (process.argv.includes('--probe-auth')) {
  (async () => {
    const response = await fetch(`${configured}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `network-check-${require('node:crypto').randomUUID()}@example.invalid`,
        password: 'network-probe-only',
      }),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    console.log(
      'Login endpoint:',
      response.status,
      'backend status:',
      result.statusCode,
      result.message,
    );
    const socket = await fetch(`${new URL(configured).origin}/socket.io/?EIO=4&transport=polling`, {
      signal: AbortSignal.timeout(5000),
    });
    const handshake = await socket.text();
    console.log(
      'Chat polling endpoint:',
      socket.status,
      handshake.startsWith('0{') ? 'Engine.IO handshake OK' : 'Unexpected handshake',
    );
  })().catch((error) => {
    console.error('Auth probe failed:', error.message);
    process.exitCode = 1;
  });
}
