# DARKFANTASY store release preparation

The app identifiers are unchanged: `com.aditya123473892.darkfantasy` on Android
and iOS. EAS project ownership and remote signing credentials are preserved.

## What is implemented

- A vector DF mark and checked-in launcher, Android adaptive/themed, notification,
  light/dark splash and favicon PNGs. The 1024px store icon is opaque and square;
  the operating system supplies its final mask. See `assets/branding/`.
- Android AAB store builds and iOS device store builds. EAS remotely increments
  build numbers; `apk` remains available for internal Android testing.
- HTTPS-only release networking, disabled Android backup with the existing vault
  and SecureStore exclusions, and Android system photo selection without broad
  photo/video read permissions. iOS retains permission-controlled recent media.
- An About screen available before login and through Settings, with privacy,
  terms, support and account-deletion links. Existing in-app account deletion,
  reporting and blocking are retained.
- Subscriber-only photo previews in feed/carousels and profile/saved grids.
  Originals remain authorized by the server. No-CDN deployments can use private
  expiring URLs for already-blurred preview objects.

## Owner configuration required

**Google Play:** follow [PLAY_STORE.md](PLAY_STORE.md) for the one-time setup, the build
command and copy-ready Play Console answers.

The Privacy Policy, Terms of Use, Contact support and Account deletion pages are bundled in
the app. The backend serves the same text publicly at `/api/legal/<page>` for the store
listings; `npm run legal:sync` regenerates it from the app.

The EAS post-install hook automatically runs the strict gate for the `production`
profile. Internal APKs run the code/asset checks without requiring push setup, so local and
internal testing can continue before submission setup is done.

For Android push, configure `GOOGLE_SERVICES_JSON` as an EAS **file** environment
variable for this exact Android package, then configure the matching FCM v1
credentials through EAS. Keep service-account keys in EAS/your credentials store,
not the app repository. iOS push needs the owner's Apple/APNs credentials. A
notification icon and channel are configured, but that is not proof of delivery.

Set the build-only `IOS_USES_NON_EXEMPT_ENCRYPTION=true` or `false` only after
the owner has classified the app's encryption for Apple. The vault uses AES-GCM;
this project does not assume that HTTPS is its only encryption or invent an
exemption declaration.

Complete the store console's App Privacy/Data Safety, age/content rating,
moderation contact information, screenshots, review notes and test-account access
using the actual deployed service. The app handles profiles/contact details,
posts/photos/videos, messages, push tokens, account recovery and optional crash
reports. The God chat feature discloses AI/staff access in the UI. Verify the
deployed providers, retention and deletion behavior before making declarations.
These notes are an implementation inventory, not a completed privacy declaration.

Subscription checkout remains disabled. Enabling paid digital content requires
verified store billing/entitlements; no external payment workaround was added.

## Checks and builds

```powershell
rtk npm run typecheck
rtk npm run lint
rtk npm run test:release
rtk npm run test:premium
rtk npm run test:feed-ui
rtk npm run test:auth
rtk npm run release:check
# Strict submission gate: fails until owner configuration is supplied.
rtk npm run release:check -- --store

# After local/device checks and owner configuration:
eas build --platform android --profile production
eas build --platform ios --profile production
# Internal Android APK:
eas build --platform android --profile apk
```

EAS `production` submission targets Google's **internal** track. Initial Play
Console setup and an App Store Connect app record/signing configuration are owner
steps. No store upload or submission is performed by the local checks. Review
remote build versions against any existing store release before first upload.

`scripts/check-native-release.cjs <prebuild-directory>` checks generated Android
permissions, icon linkage, HTTPS and vault backup rules. Do native generation in
an isolated directory when checking it, so the managed project's source is kept
intact. iOS native compilation/signing requires an appropriate macOS/Xcode host.

Expo Go can show the in-app branding and exercise supported flows; it cannot
validate the installed launcher icon, native splash, Face ID, native encryption
or production push. Verify those on device builds. Do not use Expo Go as evidence
of a completed native store release.

## Local preview in this workspace

The frontend runs at `http://localhost:8081` and Expo Go connects to the PC's
current Wi-Fi address on port 8081. The development API proxy forwards to the
latest backend on port 9000, as requested for the current local run.
The backend uses the separate persistent `darkfantasy_3112026` database on the
local replica set at `127.0.0.1:27018`. Atlas was unreachable; no Atlas users or
posts are copied into this initially empty database. Saved `.env` files remain
unchanged. The local launcher and diagnostic logs are under ignored `.expo/`.

## References checked for this preparation

- [Expo app icons and splash screens](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)
- [Expo app version management](https://docs.expo.dev/build-reference/app-versions/)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple account deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Apple encryption export documentation](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)
- [Google Play restricted permissions and system pickers](https://support.google.com/googleplay/android-developer/answer/16935362)
