const { validateAuthBuild } = require('./scripts/auth-build-config.cjs');
module.exports = ({ config }) => {
  // Only an explicit dev profile opts into cleartext. Every other config fails closed.
  const development =
    process.env.APP_VARIANT === 'development' &&
    !['production', 'preview', 'apk'].includes(process.env.EAS_BUILD_PROFILE || '') &&
    (process.env.NODE_ENV !== 'production' || process.env.EAS_BUILD_PROFILE === 'development');
  validateAuthBuild(process.env, { development });
  return {
    ...config,
    platforms: ['android'],
    android: {
      ...config.android,
      allowBackup: false,
      blockedPermissions: [
        ...(config.android?.blockedPermissions || []),
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.ACCESS_MEDIA_LOCATION',
      ],
    },
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
      './plugins/withVaultBackup.cjs',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow DARKFANTASY to select photos and videos you choose to share.',
          cameraPermission: 'Allow DARKFANTASY to take a photo for your private vault.',
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
