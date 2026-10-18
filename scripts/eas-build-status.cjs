const { execFileSync } = require('node:child_process');
const id = process.argv[2];
if (!/^[0-9a-f-]{36}$/.test(id || '')) throw new Error('Provide a build UUID');
const raw = execFileSync(process.execPath, ['scripts/eas-vault.cjs', 'build:view', id, '--json'], {
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
});
const build = JSON.parse(raw.slice(raw.indexOf('{')));
console.log(
  JSON.stringify({
    id: build.id,
    status: build.status,
    artifacts: build.artifacts,
    error: build.error,
  }),
);
if (process.argv.includes('--logs') || process.argv.includes('--doctor') || process.argv.includes('--tail'))
  (async () => {
    for (const url of build.logFiles || []) {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const text = await response.text();
      const relevant = text.split('\n').map(line => {
        try { const entry = JSON.parse(line); return entry.phase === 'READ_PACKAGE_JSON' || entry.phase === 'SPIN_UP_BUILDER' ? '' : `${entry.phase}: ${entry.msg || entry.err?.message || ''}`; }
        catch { return line; }
      }).filter(line => process.argv.includes('--doctor') ? line.startsWith('RUN_EXPO_DOCTOR:') : /error|ERR|missing|fail|QuickCrypto|nitro|base64|BUILD SUCCESS/i.test(line) && !line.includes('checkKotlinGradlePluginConfigurationErrors') && !line.includes('w: file:'));
      const tail = text.split('\n').filter(Boolean).slice(-12).map(line => { try { const entry = JSON.parse(line); return `${entry.phase}: ${entry.msg || entry.err?.message || ''}`; } catch { return line; } });
      console.log((process.argv.includes('--tail') ? tail : relevant).join('\n').replace(/https?:\/\/[^\s"<>]+/g, '[URL redacted]'));
    }
  })().catch(() => {
    console.error('Could not retrieve build logs.');
    process.exitCode = 1;
  });
