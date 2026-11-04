# Mobile release operations

For current icons, Android/iOS store build profiles, the release preflight and
remaining owner configuration, see [store/README.md](store/README.md).

## Local Android release APK

From the repository root on Windows, run:

```powershell
rtk npm run android:apk
# Verify only the Expo config and release JavaScript bundle:
rtk npm run android:apk -- --verify
```

The launcher supplies the existing EAS `apk` profile environment to Gradle,
including the HTTPS API URL, and disables development dotenv loading. Direct
`gradlew assembleRelease` does not load `eas.json` or `.env.mobile`; without an
explicit release environment, Expo config fails with
`EXPO_PUBLIC_API_URL must be configured`.

Use an installed Android SDK and a supported JDK through `ANDROID_HOME` and
`JAVA_HOME` (or Android Studio's SDK/Gradle configuration). The launcher also
detects the default Windows SDK at `%LOCALAPPDATA%/Android/Sdk`. If `android/` has not
been generated, set the release environment before running Expo prebuild:

```powershell
$env:APP_VARIANT = 'production'
$env:EXPO_PUBLIC_API_URL = 'https://dfbackend.onrender.com/api'
$env:NODE_ENV = 'production'
$env:EXPO_NO_DOTENV = '1'
rtk proxy node node_modules/expo/bin/cli prebuild --platform android
rtk npm run android:apk
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.
The generated project currently signs release builds with its debug key; use
the EAS `production` profile and store signing configuration for distribution.

## Crash reports

The Expo app uses the SDK-compatible Sentry React Native package, its Expo config
plugin and Metro source-map support. Reporting is disabled in development and
when `EXPO_PUBLIC_SENTRY_DSN` is empty. No reporting account has been provisioned.

In EAS/CI configure:

- `EXPO_PUBLIC_SENTRY_DSN`: the public client ingestion DSN.
- `SENTRY_ORG` and `SENTRY_PROJECT`: the destination slugs.
- `SENTRY_AUTH_TOKEN`: a build-only source-map/release-upload secret. Never expose
  this through `EXPO_PUBLIC_*` or Expo `extra`.

Rebuild the native app after installing the SDK. Give each store build a unique
Android `versionCode`. The SDK uses app version/build information for release
attribution. Build/upload failures must fail CI rather than be ignored.
Verify a controlled crash in a staging build, symbolication, release attribution,
and the resulting payload before enabling the DSN for production.

The JS event sanitizer removes request bodies, headers, URLs, user identity,
breadcrumbs, free-form messages, source context, variables and arbitrary extra
data. Replay, screenshots, view hierarchies, logs and performance tracing are off.
Native crash events are also collected by the native SDK and require Sentry's
server-side data-scrubbing rules: verify those separately; the JS `beforeSend`
callback is not a guarantee for events sent directly by native code.

Sentry reports runtime failures and release health. It cannot report an app that
never installed or a CI build that failed before launching: monitor EAS/CI build
status separately. No production crash was deliberately triggered by this change.

## Notification indexes

The API disables automatic MongoDB index creation. Before deploying the new
notifications API, run the following from the backend against the intended DB:

```powershell
npx ts-node scripts/notification-indexes.ts
```

This creates receiver/page and receiver/read-state indexes only. It does not
delete records or backfill them; old notifications without `isRead` count as unread.

## Password recovery

Mobile sends reset requests to `/auth/forgot-password`. The email opens the
existing website reset page; it does not place reset credentials in mobile deep
links. Configure a reachable `PUBLIC_SITE_DOMAIN` and working SES delivery.
Missing/blocked accounts return the same acceptance response. Development mail
mocks do not deliver email, so verify actual delivery in staging.
Production requires `AWS_SES_REGION` and `AWS_MAIL_FROM`; reset delivery supports
IAM roles or paired static credentials and fails rather than mocking a send.

## Upload feedback

Native post/chat uploads show transferred-byte percentages, automatic retry
attempts and separate preparation/confirmation states. Web transfer has stage
feedback without a fabricated byte percentage. Retries remain bounded and
idempotent. Chat sends with an unknown completion status must be refreshed before
resending to avoid duplicates. Uploads do not resume across process death.
