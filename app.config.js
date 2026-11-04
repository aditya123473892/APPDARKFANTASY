const { validateAuthBuild } = require('./scripts/auth-build-config.cjs');
module.exports = ({ config }) => {
  // Only an explicit dev profile opts into cleartext. Every other config fails closed.
  const development =
    process.env.APP_VARIANT === 'development' &&
    !['production', 'preview', 'apk'].includes(process.env.EAS_BUILD_PROFILE || '') &&
    (process.env.NODE_ENV !== 'production' || process.env.EAS_BUILD_PROFILE === 'development');
  // Android Studio/direct Gradle do not load EAS profile variables. With no explicit
  // profile or endpoint, use the checked-in internal release defaults for both the
  // native manifest and Metro. Explicit URLs still go through strict validation.
  if (!development && !process.env.EAS_BUILD_PROFILE && !process.env.EXPO_PUBLIC_API_URL) {
    const defaults = require('./eas.json').build.apk.env;
    for (const [key, value] of Object.entries(defaults))
      if (process.env[key] === undefined || key === 'EXPO_PUBLIC_API_URL') process.env[key] = value;
  }
  const authBuild = validateAuthBuild(process.env, { development });
  const encryption = process.env.IOS_USES_NON_EXEMPT_ENCRYPTION;
  if (encryption !== undefined && !['true', 'false'].includes(encryption))
    throw new Error('IOS_USES_NON_EXEMPT_ENCRYPTION must be true or false when provided');
  return {
    ...config,
    platforms: development ? ['android', 'ios', 'web'] : ['android', 'ios'],
    extra: {
      ...config.extra,
      apiUrl: authBuild.url,
      publicPages: {
        privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
        terms: process.env.EXPO_PUBLIC_TERMS_URL,
        support: process.env.EXPO_PUBLIC_SUPPORT_URL,
        deletion: process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
      },
    },
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
      allowBackup: false,
      blockedPermissions: [
        ...(config.android?.blockedPermissions || []),
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.ACCESS_MEDIA_LOCATION',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_EXTERNAL_STORAGE',
        ...(!development
          ? [
              'android.permission.SYSTEM_ALERT_WINDOW',
              'android.permission.REQUEST_INSTALL_PACKAGES',
            ]
          : []),
      ],
    },
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        ...(encryption === undefined ? {} : { usesNonExemptEncryption: encryption === 'true' }),
      },
      infoPlist: {
        ...config.ios?.infoPlist,
        NSFaceIDUsageDescription:
          'Use Face ID to unlock DARKFANTASY when you enable biometric App Lock.',
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: development,
          NSAllowsLocalNetworking: development,
        },
      },
    },
    plugins: [
      ...(config.plugins || []).filter((plugin) => plugin !== 'expo-secure-store'),
      ...(process.env.EXPO_PUBLIC_SENTRY_DSN
        ? [
            [
              '@sentry/react-native/expo',
              {
                organization: process.env.SENTRY_ORG,
                project: process.env.SENTRY_PROJECT,
              },
            ],
          ]
        : []),
      [
        'expo-secure-store',
        { configureAndroidBackup: false, faceIDPermission: 'Use Face ID to unlock DARKFANTASY.' },
      ],
      ['expo-local-authentication', { faceIDPermission: 'Use Face ID to unlock DARKFANTASY.' }],
      [
        'expo-notifications',
        {
          icon: './assets/branding/notification.png',
          color: '#F36F9B',
          defaultChannel: 'social',
          mode: development ? 'development' : 'production',
        },
      ],
      './plugins/withVaultBackup.cjs',
      [
        'expo-image-picker',
        {
          photosPermission: 'Allow DARKFANTASY to select photos and videos you choose to share.',
          cameraPermission: 'Allow DARKFANTASY to capture a photo or video you choose to share.',
          microphonePermission: 'Allow DARKFANTASY to record audio when you capture a video.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission:
            'Allow DARKFANTASY to show recent photos and videos when creating a post.',
          savePhotosPermission:
            'Allow DARKFANTASY to save the photos and videos you choose to your library.',
          granularPermissions: ['photo', 'video'],
          isAccessMediaLocationEnabled: false,
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
