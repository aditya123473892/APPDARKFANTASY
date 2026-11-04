const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {AndroidConfig} = require('expo/config-plugins');

async function main() {
  const directory=path.resolve(process.argv[2]||'.expo/native-store-check');
  const manifest=await AndroidConfig.Manifest.readAndroidManifestAsync(path.join(directory,'android/app/src/main/AndroidManifest.xml'));
  const active=(manifest.manifest['uses-permission']||[]).filter(row=>row.$['tools:node']!=='remove').map(row=>row.$['android:name']);
  for(const permission of ['READ_MEDIA_IMAGES','READ_MEDIA_VIDEO','READ_EXTERNAL_STORAGE','SYSTEM_ALERT_WINDOW','REQUEST_INSTALL_PACKAGES'])
    assert.ok(!active.includes('android.permission.'+permission),`Release permission must be removed: ${permission}`);
  const app=manifest.manifest.application[0];
  assert.equal(app.$['android:allowBackup'],'false');
  assert.equal(app.$['android:usesCleartextTraffic'],'false');
  assert.ok(app.$['android:icon'].includes('ic_launcher'));
  const metadata=app['meta-data']||[];
  assert.ok(metadata.some(row=>row.$['android:name']==='com.google.firebase.messaging.default_notification_channel_id'&&row.$['android:value']==='social'));
  const rules=fs.readFileSync(path.join(directory,'android/app/src/main/res/xml/vault_data_extraction_rules.xml'),'utf8');
  assert.ok(rules.includes('SecureStore')&&rules.includes('vault/'));
  console.log('Generated Android manifest: permissions, launcher icon, notification channel, HTTPS and backup rules passed.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
