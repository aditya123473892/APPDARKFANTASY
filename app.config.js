const { validateAuthBuild } = require('./scripts/auth-build-config.cjs');
module.exports = ({ config }) => {
  // Only an explicit dev profile opts into cleartext. Every other config fails closed.
  const development =
    process.env.APP_VARIANT === 'development' &&
    !['production', 'preview', 'apk'].includes(process.env.EAS_BUILD_PROFILE || '') &&
    process.env.NODE_ENV !== 'production';
  validateAuthBuild(process.env, { development });
  return {
    ...config,
    android: { ...config.android, allowBackup: false },
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: development,
          NSAllowsLocalNetworking: development,
        },
      },
    },
    plugins: [
      ...(config.plugins || []).filter((plugin) => plugin !== 'expo-secure-store'),
      ['expo-secure-store', { configureAndroidBackup: true }],
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow DARKFANTASY to select photos and videos you choose to share.',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            usesCleartextTraffic: development,
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
          },
        },
      ],
    ],
  };
};
