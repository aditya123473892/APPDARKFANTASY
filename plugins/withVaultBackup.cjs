const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = function withVaultBackup(config) {
  config = withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0].$;
    app['android:allowBackup'] = 'false';
    app['android:fullBackupContent'] = '@xml/vault_backup_rules';
    app['android:dataExtractionRules'] = '@xml/vault_data_extraction_rules';
    return config;
  });
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      await fs.mkdir(dir, { recursive: true });
      // Expo documentDirectory is files/; DB and WAL live under that same vault root.
      // Exclude secure-store preferences too: never transfer device-specific keys.
      const excludes =
        '<exclude domain="file" path="vault/"/><exclude domain="sharedpref" path="SecureStore"/>';
      await fs.writeFile(
        path.join(dir, 'vault_backup_rules.xml'),
        `<?xml version="1.0" encoding="utf-8"?><full-backup-content>${excludes}</full-backup-content>`,
      );
      await fs.writeFile(
        path.join(dir, 'vault_data_extraction_rules.xml'),
        `<?xml version="1.0" encoding="utf-8"?><data-extraction-rules><cloud-backup>${excludes}</cloud-backup><device-transfer>${excludes}</device-transfer></data-extraction-rules>`,
      );
      return config;
    },
  ]);
};
