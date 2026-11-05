const fs = require('node:fs');
const path = require('node:path');
const { getPngInfo } = require('@expo/image-utils');
const { validateAuthBuild } = require('./auth-build-config.cjs');

const root = path.resolve(__dirname, '..');
const legalRoutes = ['privacy', 'terms', 'support', 'account-deletion'];
function publicHttps(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !/^(localhost|127\.|\[::1\]|example\.)/.test(url.hostname) &&
      !/\.(invalid|test|example)$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

async function checkRelease({ env = process.env, platform = 'all', assets = true } = {}) {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
  const production = eas.build.production;
  const buildEnv = {
    ...env,
    ...production.env,
    APP_VARIANT: 'production',
    EAS_BUILD_PROFILE: 'production',
  };
  const previous = { ...process.env };
  let config;
  try {
    Object.assign(process.env, buildEnv);
    config = require('../app.config.js')({ config: app });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
  const checks = [],
    errors = [],
    ownerRequirements = [];
  const check = (ok, message) => (ok ? checks : errors).push(message);
  validateAuthBuild(buildEnv, { development: false });
  check(
    config.platforms.includes('android') && config.platforms.includes('ios'),
    'Android and iOS release targets',
  );
  check(
    !!config.android.package && !!config.ios.bundleIdentifier,
    'Stable Android package and iOS bundle identifiers',
  );
  check(
    production.distribution === 'store' &&
      production.android.buildType === 'app-bundle' &&
      production.ios.simulator === false,
    'AAB and iOS device store profiles',
  );
  check(
    eas.cli.appVersionSource === 'remote' && production.autoIncrement === true,
    'Unique build numbers managed by EAS',
  );
  check(
    config.android.blockedPermissions.includes('android.permission.READ_MEDIA_IMAGES') &&
      config.android.blockedPermissions.includes('android.permission.READ_MEDIA_VIDEO'),
    'Android system picker without broad photo/video permissions',
  );
  check(
    config.android.allowBackup === false &&
      config.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads === false,
    'Protected local backup and HTTPS release networking',
  );
  const splash = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  )?.[1];
  check(
    !!splash?.image && !splash?.android?.drawable && !!splash?.dark?.image,
    'Branded light and dark splash screens',
  );
  check(!!config.extra.eas.projectId, 'Existing EAS project linked');

  if (assets) {
    const files = [
      [config.icon, 1024, false],
      [config.android.adaptiveIcon.foregroundImage, 1024, true],
      [config.android.adaptiveIcon.monochromeImage, 1024, true],
      [splash.image, 1024, true],
      [splash.dark.image, 1024, true],
      ['./assets/branding/notification.png', 96, true],
      [config.web.favicon, 64, false],
    ];
    for (const [file, size, transparent] of files) {
      try {
        const bytes = fs.readFileSync(path.resolve(root, file));
        const image = await getPngInfo(path.resolve(root, file));
        check(image.width === size && image.height === size, `${file}: ${size} x ${size} PNG`);
        const hasAlpha = bytes[25] === 6 || bytes[25] === 4;
        check(transparent ? hasAlpha : !hasAlpha, `${file}: correct alpha format`);
      } catch {
        errors.push(`${file}: missing or unreadable image`);
      }
    }
  }
  // Legal pages ship inside the app; the backend serves the same text publicly for the
  // Play Console privacy policy and account deletion fields.
  check(
    legalRoutes.every((route) => fs.existsSync(path.join(root, 'app', 'legal', `${route}.tsx`))) &&
      fs.existsSync(path.join(root, 'app', 'age-check.tsx')),
    'In-app privacy policy, terms, support, account deletion and 18+ check',
  );
  const legalPages = Object.fromEntries(
    legalRoutes.map((route) => [route, `${config.extra.apiUrl.replace(/\/$/, '')}/legal/${route}`]),
  );
  check(
    Object.values(legalPages).every(publicHttps),
    'Public HTTPS legal pages for the store listing',
  );
  // The backend source is a separate repository and is absent from EAS build workers.
  if (fs.existsSync(path.join(root, 'dfbackend', 'package.json')))
    check(require('./sync-legal.cjs').isCurrent(), 'Backend legal pages match the app text');
  if (platform !== 'ios' && !config.android.googleServicesFile)
    ownerRequirements.push(
      'Add google-services.json as the EAS file variable GOOGLE_SERVICES_JSON (production environment) and upload the FCM V1 key in EAS credentials, or Android push notifications will not work. See store/PLAY_STORE.md.',
    );
  if (assets && config.android.googleServicesFile) {
    try {
      const google = JSON.parse(
        fs.readFileSync(path.resolve(root, config.android.googleServicesFile), 'utf8'),
      );
      check(
        google.client?.some(
          (client) =>
            client.client_info?.android_client_info?.package_name === config.android.package,
        ),
        'Firebase Android client matches app package',
      );
    } catch {
      errors.push('GOOGLE_SERVICES_JSON is not a readable Firebase configuration file');
    }
  }
  if (platform !== 'android' && !['true', 'false'].includes(env.IOS_USES_NON_EXEMPT_ENCRYPTION))
    ownerRequirements.push(
      'Confirm IOS_USES_NON_EXEMPT_ENCRYPTION for the vault encryption used by this app',
    );
  return {
    checks,
    errors,
    ownerRequirements,
    legalPages,
    identifiers: { android: config.android.package, ios: config.ios.bundleIdentifier },
    platforms: config.platforms,
  };
}

if (require.main === module) {
  const platform =
    process.argv.find((value) => value.startsWith('--platform='))?.split('=')[1] || 'all';
  checkRelease({ platform })
    .then((report) => {
      if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
      else {
        for (const message of report.checks) console.log(`PASS ${message}`);
        for (const message of report.errors) console.error(`FAIL ${message}`);
        for (const message of report.ownerRequirements) console.log(`REQUIRED ${message}`);
        for (const [page, url] of Object.entries(report.legalPages))
          console.log(`PAGE ${page}: ${url}`);
        console.log(
          'Native device checks, store credentials and console declarations remain separate release checks.',
        );
      }
      if (
        report.errors.length ||
        (process.argv.includes('--store') && report.ownerRequirements.length)
      )
        process.exitCode = 1;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
module.exports = { checkRelease, publicHttps };
