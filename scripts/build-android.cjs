const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { validateAuthBuild } = require('./auth-build-config.cjs');

const root = path.resolve(__dirname, '..');

function releaseEnvironment(env = process.env) {
  // Direct Gradle builds do not receive EAS profile variables. Keep the local
  // APK aligned with that profile and exclude development dotenv overrides.
  return {
    ...env,
    ...require('../eas.json').build.apk.env,
    EAS_BUILD_PROFILE: 'apk',
    NODE_ENV: 'production',
    EXPO_NO_DOTENV: '1',
  };
}

function main() {
  const env = releaseEnvironment();
  validateAuthBuild(env);
  if (
    process.platform === 'win32' &&
    !env.ANDROID_HOME &&
    !env.ANDROID_SDK_ROOT &&
    env.LOCALAPPDATA
  ) {
    const sdk = path.join(env.LOCALAPPDATA, 'Android', 'Sdk');
    if (existsSync(sdk)) env.ANDROID_HOME = sdk;
  }
  const android = path.join(root, 'android');
  if (!existsSync(path.join(android, 'gradlew.bat'))) {
    console.error(
      'Generate the Android project first with Expo prebuild. See RELEASE_OPERATIONS.md.',
    );
    return 1;
  }
  const verify = process.argv.includes('--verify');
  const tasks = verify
    ? [':expo-constants:createReleaseExpoConfig', ':app:createBundleReleaseJsAndAssets']
    : [':app:assembleRelease'];
  const windows = process.platform === 'win32';
  console.log(
    `Building Android with the EAS apk profile (${verify ? 'config and bundle verification' : 'release APK'}).`,
  );
  const result = spawnSync(
    windows ? 'cmd.exe' : './gradlew',
    windows
      ? ['/d', '/c', 'gradlew.bat', ...tasks, '--console=plain']
      : [...tasks, '--console=plain'],
    { cwd: android, env, stdio: 'inherit' },
  );
  if (result.error) console.error(result.error.message);
  return result.status ?? 1;
}

if (require.main === module) process.exitCode = main();
module.exports = { releaseEnvironment };
