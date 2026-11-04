const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { checkRelease, publicHttps } = require('./check-release.cjs');
const { preflightArguments } = require('./eas-preflight.cjs');
const { releaseEnvironment } = require('./build-android.cjs');

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
  const production = preflightArguments({EAS_BUILD_PROFILE:'production',EAS_BUILD_PLATFORM:'android'});
  assert.ok(production.includes('--store'));assert.ok(production.includes('--platform=android'));
  const apk = preflightArguments({EAS_BUILD_PROFILE:'apk',EAS_BUILD_PLATFORM:'android'});
  assert.equal(apk.includes('--store'),false);
});

test('release branding, native targets, permissions and store profiles validate', async () => {
  const report = await checkRelease();
  assert.deepEqual(report.errors, []);
  assert.ok(report.checks.length >= 20);
  assert.ok(report.platforms.includes('ios') && report.platforms.includes('android'));
});

test('store preflight reports missing owner URLs and encryption declaration instead of claiming readiness', async () => {
  const env = { ...process.env };
  for (const key of Object.keys(env))
    if (
      /PRIVACY_POLICY_URL|TERMS_URL|SUPPORT_URL|ACCOUNT_DELETION_URL|NON_EXEMPT_ENCRYPTION/.test(
        key,
      )
    )
      delete env[key];
  const report = await checkRelease({ env, assets: false });
  assert.ok(report.ownerRequirements.some((value) => value.includes('PRIVACY_POLICY_URL')));
  assert.ok(report.ownerRequirements.some((value) => value.includes('NON_EXEMPT_ENCRYPTION')));
  const configured = {
    ...env,
    EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://darkfantasy.app/privacy',
    EXPO_PUBLIC_TERMS_URL: 'https://darkfantasy.app/terms',
    EXPO_PUBLIC_SUPPORT_URL: 'https://darkfantasy.app/support',
    EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://darkfantasy.app/account-deletion',
    IOS_USES_NON_EXEMPT_ENCRYPTION: 'true',
    GOOGLE_SERVICES_JSON: './test-firebase.json',
  };
  assert.equal(
    (await checkRelease({ env: configured, assets: false })).ownerRequirements.length,
    0,
  );
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

test('About links sanitize manifest data and recover from missing pages and browser failures', async () => {
  const manifest = {
    expoConfig: {
      version: '1.0.0',
      extra: {
        publicPages: {
          privacy: 'https://darkfantasy.app/privacy',
          terms: 'javascript:alert(1)',
          support: 'https://darkfantasy.app/support',
        },
      },
    },
  };
  const pages = load('src/config/publicPages.ts', {
    'expo-constants': { __esModule: true, default: manifest },
  });
  assert.equal(pages.publicPageUrl('terms'), undefined);
  const opened = [],
    errors = [];
  const { AboutScreen } = load('src/features/settings/screens/AboutScreen.tsx', {
    'react-native': {
      View: 'View',
      Linking: {
        openURL: async (url) => {
          opened.push(url);
          if (url.endsWith('support')) throw Error('offline');
        },
      },
    },
    'expo-constants': { __esModule: true, default: manifest },
    '@/components/layout': { Header: 'Header', Screen: 'Screen' },
    '@/components/BrandLogo': { BrandLogo: 'BrandLogo' },
    '@/components/ui': { Text: 'Text' },
    '@/components/ui/Toast': { toast: { error: (message) => errors.push(message) } },
    '@/config/publicPages': pages,
    '@/theme': { spacing: {} },
    '../components/SettingsRow': { SettingsGroup: 'Group', SettingsRow: 'Row' },
  });
  const nodes = (value) =>
    Array.isArray(value)
      ? value.flatMap(nodes)
      : value && typeof value === 'object'
        ? [value, ...nodes(value.props?.children)]
        : [];
  const rows = nodes(AboutScreen()).filter((node) => node.type === 'Row');
  rows[0].props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened[0], 'https://darkfantasy.app/privacy');
  rows[1].props.onPress();
  rows[2].props.onPress();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened.length, 2);
  assert.equal(errors.length, 2);
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
