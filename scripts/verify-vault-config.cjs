const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const result = spawnSync(
  process.execPath,
  ['node_modules/expo/bin/cli', 'config', '--type', 'introspect', '--json'],
  {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      EXPO_NO_DOTENV: '1',
      APP_VARIANT: 'development',
      EXPO_PUBLIC_API_URL: 'http://10.0.2.2:9000/api',
    },
  },
);
if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(1);
}
const config = JSON.parse(result.stdout);
const manifest = config._internal.modResults.android.manifest.manifest;
const app = manifest.application[0].$;
assert.equal(String(app['android:allowBackup']), 'false');
assert.equal(app['android:fullBackupContent'], '@xml/vault_backup_rules');
assert.equal(app['android:dataExtractionRules'], '@xml/vault_data_extraction_rules');
const permissions = manifest['uses-permission'] || [];
for (const name of [
  'READ_MEDIA_IMAGES',
  'READ_MEDIA_VIDEO',
  'READ_MEDIA_AUDIO',
  'ACCESS_MEDIA_LOCATION',
]) {
  const entry = permissions.find((p) => p.$['android:name'] === `android.permission.${name}`);
  assert.ok(
    !entry || entry.$['tools:node'] === 'remove',
    `Broad permission ${name} must be blocked`,
  );
}
console.log(
  'Android manifest verified: backup exclusions, private vault, no broad gallery-read/GPS permissions.',
);
