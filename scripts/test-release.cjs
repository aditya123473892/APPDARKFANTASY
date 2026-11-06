const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { checkRelease, publicHttps } = require('./check-release.cjs');
const { preflightArguments } = require('./eas-preflight.cjs');
const { releaseEnvironment, nativeBuildEnvironment } = require('./build-android.cjs');

test('local Android builds recover a stale JAVA_HOME using Android Studio while preserving valid custom JDKs', () => {
  const studio = path.join('C:\\Program Files', 'Android', 'Android Studio', 'jbr');
  const sdk = path.join('C:\\Local', 'Android', 'Sdk');
  const installed = new Set([path.join(studio, 'bin', 'java.exe'), sdk]);
  const original = {
    JAVA_HOME: 'C:\\removed-jdk',
    LOCALAPPDATA: 'C:\\Local',
    ProgramFiles: 'C:\\Program Files',
  };
  const options = { platform: 'win32', exists: (file) => installed.has(file) };
  const resolved = nativeBuildEnvironment(original, options);
  assert.equal(resolved.JAVA_HOME, studio);
  assert.equal(resolved.ANDROID_HOME, sdk);
  assert.equal(original.JAVA_HOME, 'C:\\removed-jdk');
  const custom = 'C:\\custom-jdk';
  installed.add(path.join(custom, 'bin', 'java.exe'));
  assert.equal(
    nativeBuildEnvironment({ ...original, JAVA_HOME: custom }, options).JAVA_HOME,
    custom,
  );
  assert.equal(
    nativeBuildEnvironment(original, { ...options, platform: 'linux' }).JAVA_HOME,
    original.JAVA_HOME,
  );
});

test('direct native release config supplies the internal APK endpoint without importing backend secrets', () => {
  const previous = { ...process.env };
  try {
    for (const key of [
      'APP_VARIANT',
      'EAS_BUILD_PROFILE',
      'EXPO_PUBLIC_API_URL',
      'EXPO_DEV_API_PROXY',
      'EXPO_PUBLIC_DEV_API_PROXY',
    ])
      delete process.env[key];
    process.env.NODE_ENV = 'production';
    process.env.AWS_SECRET = 'synthetic-build-only-secret';
    const config = require('../app.config.js')({ config: { plugins: [] } });
    assert.equal(config.extra.apiUrl, require('../eas.json').build.apk.env.EXPO_PUBLIC_API_URL);
    assert.equal(process.env.EXPO_PUBLIC_API_URL, config.extra.apiUrl);
    assert.equal(process.env.EXPO_PUBLIC_DEV_API_PROXY, 'false');
    assert.equal(config.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
    assert.equal(JSON.stringify(config).includes('synthetic-build-only-secret'), false);
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:9000/api';
    assert.throws(() => require('../app.config.js')({ config: { plugins: [] } }), /HTTPS/);
    delete process.env.EXPO_PUBLIC_API_URL;
    process.env.EAS_BUILD_PROFILE = 'production';
    assert.throws(
      () => require('../app.config.js')({ config: { plugins: [] } }),
      /must be configured/,
    );
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test('local APK builds replace development settings and preserve native build credentials', () => {
  const development = {
    APP_VARIANT: 'development',
    EAS_BUILD_PROFILE: 'development',
    NODE_ENV: 'development',
    EXPO_PUBLIC_API_URL: 'http://localhost:9000/api',
    EXPO_DEV_API_PROXY: 'true',
    EXPO_PUBLIC_DEV_API_PROXY: 'true',
    GOOGLE_SERVICES_JSON: './local-firebase.json',
  };
  const env = releaseEnvironment(development);
  assert.equal(env.EXPO_PUBLIC_API_URL, require('../eas.json').build.apk.env.EXPO_PUBLIC_API_URL);
  assert.equal(env.APP_VARIANT, 'production');
  assert.equal(env.EAS_BUILD_PROFILE, 'apk');
  assert.equal(env.NODE_ENV, 'production');
  assert.equal(env.EXPO_NO_DOTENV, '1');
  assert.equal(env.EXPO_DEV_API_PROXY, 'false');
  assert.equal(env.EXPO_PUBLIC_DEV_API_PROXY, 'false');
  assert.equal(env.GOOGLE_SERVICES_JSON, development.GOOGLE_SERVICES_JSON);
  assert.equal(development.APP_VARIANT, 'development');
});

test('EAS archive retains application sources and local native modules while excluding generated projects', () => {
  const ignore = require('ignore')().add(fs.readFileSync('.easignore', 'utf8'));
  function checkSources(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory()) checkSources(file);
      else assert.equal(ignore.ignores(file), false, `EAS must include ${file}`);
    }
  }
  checkSources('app');
  checkSources('src');
  assert.equal(ignore.ignores('modules/pin-kdf/android/build.gradle'), false);
  assert.equal(ignore.ignores('plugins/withVaultBackup.cjs'), false);
  for (const file of ['store/README.md', 'android/app/build.gradle', 'ios/Podfile'])
    assert.equal(ignore.ignores(file), true, `EAS must exclude ${file}`);
});

test('EAS production builds enforce store requirements while internal APK builds remain testable', () => {
  const production = preflightArguments({
    EAS_BUILD_PROFILE: 'production',
    EAS_BUILD_PLATFORM: 'android',
  });
  assert.ok(production.includes('--store'));
  assert.ok(production.includes('--platform=android'));
  const apk = preflightArguments({ EAS_BUILD_PROFILE: 'apk', EAS_BUILD_PLATFORM: 'android' });
  assert.equal(apk.includes('--store'), false);
});

test('release branding, native targets, permissions and store profiles validate', async () => {
  const report = await checkRelease();
  assert.deepEqual(report.errors, []);
  assert.ok(report.checks.length >= 20);
  assert.ok(report.platforms.includes('ios') && report.platforms.includes('android'));
});

test('store preflight reports missing push and encryption setup, and lists public legal pages', async () => {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (/GOOGLE_SERVICES_JSON|NON_EXEMPT_ENCRYPTION/.test(key)) delete env[key];
  const report = await checkRelease({ env, assets: false });
  assert.deepEqual(report.errors, []);
  assert.ok(report.ownerRequirements.some((value) => value.includes('GOOGLE_SERVICES_JSON')));
  assert.ok(report.ownerRequirements.some((value) => value.includes('NON_EXEMPT_ENCRYPTION')));
  // An Android-only store build needs only the Firebase file.
  const android = await checkRelease({ env, assets: false, platform: 'android' });
  assert.equal(android.ownerRequirements.length, 1);
  assert.equal(report.legalPages.privacy, 'https://api.darkfantasy.club/api/legal/privacy');
  assert.equal(
    report.legalPages['account-deletion'],
    'https://api.darkfantasy.club/api/legal/account-deletion',
  );
  const configured = {
    ...env,
    IOS_USES_NON_EXEMPT_ENCRYPTION: 'true',
    GOOGLE_SERVICES_JSON: './test-firebase.json',
  };
  assert.equal(
    (await checkRelease({ env: configured, assets: false })).ownerRequirements.length,
    0,
  );
});

test('store builds sign in with email and password, like the tested APK', () => {
  const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  assert.equal(eas.build.production.env.EXPO_PUBLIC_PHONE_AUTH_REQUIRED, 'false');
  assert.equal(eas.build.production.android.buildType, 'app-bundle');
});

test('public store links reject placeholders, credentials and insecure or malformed URLs', () => {
  for (const value of [
    '',
    undefined,
    'http://darkfantasy.app/privacy',
    'javascript:alert(1)',
    'https://user:secret@darkfantasy.app/',
    'https://localhost/privacy',
    'https://example.com/privacy',
    'https://demo.invalid/privacy',
  ])
    assert.equal(publicHttps(value), false, value);
  assert.equal(publicHttps('https://darkfantasy.app/privacy'), true);
});

function load(file, modules = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => modules[name] ?? require(name),
    URL,
    console,
  });
  return exports;
}

test('release runtime uses the validated native endpoint when no public variable was inlined', () => {
  const evaluate = (apiUrl, configured = {}) => {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync('src/config/env.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      URL,
      __DEV__: false,
      process: { env: configured },
      require: () => ({ __esModule: true, default: { expoConfig: { extra: { apiUrl } } } }),
    });
    return exports.env;
  };
  assert.equal(
    evaluate('https://api.darkfantasy.club/api').apiUrl,
    'https://api.darkfantasy.club/api',
  );
  assert.equal(
    evaluate('https://api.darkfantasy.club/api', {
      EXPO_PUBLIC_API_URL: 'https://staging.example.test/api',
    }).apiUrl,
    'https://staging.example.test/api',
  );
  assert.throws(() => evaluate('http://localhost:9000/api'), /HTTPS/);
  assert.throws(() => evaluate(undefined));
});

test('About opens the bundled legal and support pages inside the app', () => {
  const opened = [];
  const { AboutScreen } = load('src/features/settings/screens/AboutScreen.tsx', {
    'react-native': { View: 'View' },
    'expo-constants': { __esModule: true, default: { expoConfig: { version: '1.0.0' } } },
    'expo-router': { useRouter: () => ({ push: (path) => opened.push(path) }) },
    '@/components/layout': { Header: 'Header', Screen: 'Screen' },
    '@/components/BrandLogo': { BrandLogo: 'BrandLogo' },
    '@/components/ui': { Text: 'Text' },
    '@/theme': { spacing: {} },
    '../components/SettingsRow': { SettingsGroup: 'Group', SettingsRow: 'Row' },
  });
  const nodes = (value) =>
    Array.isArray(value)
      ? value.flatMap(nodes)
      : value && typeof value === 'object'
        ? [value, ...nodes(value.props?.children)]
        : [];
  for (const row of nodes(AboutScreen()).filter((node) => node.type === 'Row')) row.props.onPress();
  assert.deepEqual(opened, [
    '/legal/privacy',
    '/legal/terms',
    '/legal/support',
    '/legal/account-deletion',
  ]);
  for (const route of ['privacy', 'terms', 'support', 'account-deletion'])
    assert.ok(fs.existsSync(`app/legal/${route}.tsx`), route);
});

test('the backend serves the same legal text as the app', () => {
  if (!fs.existsSync('dfbackend/package.json')) return;
  assert.ok(require('./sync-legal.cjs').isCurrent(), 'run npm run legal:sync');
});

test('Android media picking does not request broad gallery access', () => {
  let requested = 0;
  const { RecentMediaGrid } = load('src/features/create-post/RecentMediaGrid.tsx', {
    'expo-media-library/legacy': {
      requestPermissionsAsync: () => {
        requested++;
      },
    },
    'expo-image': {},
    '@expo/vector-icons': {},
    react: { useState: (value) => [value, () => {}] },
    'react-native': { Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 360 }) },
    '@/components/ui/Pressable': {},
    '@/components/ui/Text': { Text: 'Text' },
    '@/theme/useTheme': { useTheme: () => ({ theme: { colors: {} } }) },
    '@/theme': { spacing: {} },
    '@/features/feed/presentation': {},
    './singleMedia': {},
    '@/services/externalActivity': {},
  });
  const tree = RecentMediaGrid({ selected: [], onSelect() {}, onError() {}, disabled: false });
  assert.equal(tree.type, 'Text');
  assert.match(tree.props.children, /Choose media/);
  assert.equal(requested, 0);
});
