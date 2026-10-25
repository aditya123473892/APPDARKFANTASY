const fs = require('node:fs');
const os = require('node:os');

fs.mkdirSync('.expo', { recursive: true });
async function check() {
  const interfaces = os.networkInterfaces();
  const address = (interfaces['Wi-Fi'] || []).find(
    (entry) => entry.family === 'IPv4' && !entry.internal,
  )?.address || '127.0.0.1';
  const targets = {
    backend: 'http://[::1]:9000/api',
    expo: `http://${address}:8081/status`,
    proxy: `http://${address}:8081/api`,
  };
  const results = await Promise.all(Object.entries(targets).map(async ([name, url]) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      await response.arrayBuffer();
      return [name, response.status];
    } catch {
      return [name, 'DOWN'];
    }
  }));
  const healthy = results.every(([, status]) => status === 200);
  const line = `${new Date().toLocaleTimeString()} ${healthy ? 'OK' : 'CHECK'} ${results
    .map(([name, status]) => `${name}=${status}`).join(' ')} Expo Go: exp://${address}:8081`;
  console.log(line);
  fs.appendFileSync('.expo/lan-health.log', `${line}\n`);
  if (process.argv.includes('--once')) process.exitCode = healthy ? 0 : 1;
  else setTimeout(check, 15000);
}
check();
