# Android Photo Vault

Android only. Requires an Expo development build; Expo Go cannot load the native crypto modules.

## Dependencies and build

Pinned native crypto: `react-native-quick-crypto@1.1.8`, `react-native-nitro-modules@0.37.1`, `react-native-quick-base64@3.0.1`. Quick Crypto resolves `@craftzdog/react-native-buffer@6.1.2`.

Added Expo modules: SQLite 57.0.4, Local Authentication 57.0.3, Network 57.0.2, Media Library 57.0.5, Sharing 57.0.22, Dev Client 57.0.19. Backend: Zod 4.1.12.

The installed app uses Expo 57.0.27 / React Native 0.86.3 / New Architecture. Upstream dependency requirements accept this stack; the Android cloud build verifies compilation. Native runtime checks require an Android device.

`npm run build:android:dev` runs EAS development build with the existing emulator API URL (`http://10.0.2.2:9000/api`). Start Metro using `npm start` for device development and configure the public API address in `.env.mobile` for a physical phone. The launcher disables server `.env` loading. `.easignore` excludes server projects, environment files, signing files, and logs from the mobile archive.

EAS project: `136eb041-ed2c-4aef-9120-b8f0f344c0d3`, account `aditya-61818`. No AWS credentials are added to the app. No IAM/bucket changes are required: existing private `temp/*` and `users/*` permissions and server-side encryption cover vault objects.

**Android development build succeeded:** [EAS build 8a7c9893](https://expo.dev/accounts/aditya-61818/projects/darkfantasy/builds/8a7c9893-31df-4a98-b970-6af6d57b306e). [Download APK](https://expo.dev/artifacts/eas/5hlmGUJ_-5gv8isgHsDkGKd4vjguOCFT7iZI0TlTpWc.apk). This confirms the pinned crypto/peer stack compiles on SDK 57 / RN 0.86.3 / Android New Architecture; device runtime acceptance is still pending. Backend changes are source changes and have not been deployed to a production service.

A local APK copy is at `vault-build-preflight/photo-vault-android-development.apk` (307,724,032 bytes). SHA-256: `5e56440ab66578e56b87eed06ca8ba7fa9d2b42eb79ddc480dd00b65bbbb6804`. Inspection of the compiled APK confirmed `allowBackup=false`, both referenced backup XML files excluding `vault/` and SecureStore for cloud/device transfer, absence of broad media-read/GPS permissions, and packaged Quick Crypto/Nitro libraries for arm64-v8a, armeabi-v7a, x86 and x86_64.

## Storage and access

- Images: `documentDirectory/vault/{verifiedUserId}/{photoUUID}.vault`. SQLite DB/WAL live in the same directory.
- AES-256-GCM uses a random per-user 256-bit key, independent random 96-bit nonces, 128-bit authentication tags, and user/photo IDs as authenticated additional data. Versioned binary envelopes contain no key.
- The key exists persistently only in Android Keystore-backed SecureStore, using defaults without `requireAuthentication`. App access is separately gated by Local Authentication, including device credentials.
- Without a screen lock, the user must opt in to a 6–12 digit app passcode. Its verifier uses PBKDF2-HMAC-SHA256, 600,000 iterations and a random salt. Five failed app unlocks cause a one-minute lockout; counters and deadline persist in SQLite. Android also applies its own biometric lockout policy.
- Android `allowBackup=false` plus `fullBackupContent` and `dataExtractionRules` exclude the vault and SecureStore preferences from cloud backup and device transfer. No iOS native module or new iOS configuration was added.
- New items default to hidden. Hide/show changes metadata only. Hidden is an app display preference, not publication or a separate encryption policy.
- Vault uses React Native Image with short-lived local decrypted files, never expo-image or URL/disk caching. Files are deleted on view close, background, lock and logout. Startup removes orphaned vault, picker and manipulator cache files from fixed app-owned folders.
- Vault screens always request FLAG_SECURE, including development builds. The general screenshot testing override requires both `__DEV__` and `EXPO_PUBLIC_ALLOW_SCREENSHOTS_FOR_TESTING=true`. FLAG_SECURE obscures Android recent-app thumbnails.

## Sync and publication

The default is option (a): resized/re-encoded JPEG is encrypted locally, decrypted temporarily for HTTPS upload, sanitized and moderated on the server, and stored under S3 server-side encryption. This is **not end-to-end encryption**. The backend/AWS can process cloud photos. The per-user local key never goes to the backend.

SQLite stores persistent upload/patch/delete jobs. Local commits serialize per process; network requests never hold the local write mutex. UUIDs survive retries, and an in-flight response cannot overwrite a newer local edit or tombstone. Work runs on unlock, foreground, network return and a 15-second foreground scheduler. Backoff is exponential with jitter, bounded to about one hour. Background/logout cancels transfers; foreground retry reissues expired POST URLs. A successful upload downloads the server's canonical sanitized bytes before marking the local copy synced. Hash and size are verified before encrypting downloads.

`rejected` is terminal for moderation/safe-image rejection: upload jobs are removed and the local photo remains available for deletion. It is not automatically retried. Transient failures use `failed` with a generic user message.

`GET /vault/changes?since=cursor` uses an ordered, resumable metadata **sweep**, rather than timestamp deltas. Each page contains at most 100 live/tombstone records; the cursor is the last UUID. At the end, the stored cursor resets and the next sweep starts fresh. This replays unchanged metadata but avoids lost timestamp-boundary updates without requiring replica-set transactions. Files download only on request. A concurrent update behind the current cursor is picked up by the next sweep.

Metadata conflicts use client `updatedAt`, with server rejection of clocks more than five minutes ahead. Newer edits win; any tombstone wins over edits. Deleted UUIDs cannot be reused. Tombstones remain separate from live photo rows for offline clients.

Vault records are in `VaultPhotos` and `VaultTombstones`; profile uploads stay in `PhotoUploads`. Default vault quota is 50 (`VAULT_MAX_PHOTOS`, server cap 100; current UI cap 50), independent of profile quota. Vault keys cannot bind to profile/post/chat resources and are rejected by public media presentation/access helpers.

New authenticated endpoints under the existing API prefix:

- `POST /vault/upload-url`, `POST /vault/confirm`
- `GET /vault/changes`, `GET /vault/:id/download-url`
- `PATCH /vault/:id` (`hidden`, `order`, `updatedAt`), `DELETE /vault/:id`

Only verified-token ownership is used. Inputs reject unknown fields. POST lifetime is 300 seconds; GET lifetime is 120 seconds with `no-store`. Every endpoint checks active account/ownership and rate limits. The existing sanitizer, Rekognition policy and private bucket enforcement are reused.

Deletion creates a tombstone immediately and hides the item locally. A durable deleting row waits until outstanding POST URLs/processing leases expire, then the worker removes all object versions and the live DB row. Existing photo cleanup protects live vault references. Account purge removes vault objects and records too.

Existing Android `uploadPhoto()` callers now pass through vault preparation, retaining an encrypted hidden vault copy before publication. The existing `/photos` POST/confirm and `uploadId` DTOs remain intact. Publication uploads an **independent** profile/post/chat copy, never a vault key. Hiding/deleting the private vault copy does not retract an already published copy. Previously uploaded photos are not silently bulk-imported.

## Export, share and logout

Export requires an explicit confirmation for the selected photo(s). JPEG pixels are re-encoded without EXIF/GPS. On Android 11+ the Expo Media Library Asset API inserts app-owned media without broad read permission, including Android 13/14. Older Android requests write-only permission only at export. Permission denial keeps the vault unchanged. Share uses a temporary file through Expo Sharing. Both flows remove temporary files in `finally`; background cleanup also applies.

Voluntary logout blocks on unsynced/failed/rejected changes until the user syncs or explicitly chooses **Discard unsynced photos**. Confirmed logout removes local rows/files and the SecureStore key. Account deletion already has a destructive confirmation and also wipes locally. Session expiration/network validation failure locks and preserves the local encrypted vault, while server features still require a fresh authenticated session. The login/account-state screens provide local vault entry. Signing into a different account requires clearing the prior vault, with unsynced-discard confirmation where needed.

## Security limits

- Protects persisted image contents and normal app access on an uncompromised Android device; metadata is SQLite, not SQLCipher, and remains readable to someone who compromises the sandbox.
- Does not protect against root, instrumentation, a compromised OS/keyboard, external cameras, memory inspection while unlocked, or an authorized recipient retaining exported/shared/published copies.
- JS/native image memory and flash blocks cannot be guaranteed securely erased; deletion plus local key destruction provides cryptographic removal of encrypted copies, not certified physical media erasure.
- Picker/manipulator import/export operations necessarily create brief plaintext cache copies. A process kill can leave these until startup cleanup. No ordinary operation saves a new gallery item. An imported original already in the gallery remains there; original deletion is deferred.
- System camera apps receive a temporary app-cache output grant. OEM camera behavior and screenshot/recording protections must be verified on supported devices; the app does not ask the camera to save a gallery copy.
- Sharing backgrounds the app and triggers immediate temp cleanup. Some receiver apps may fail to read after that point; verify supported share targets. The receiving app may retain anything it successfully reads.
- There is no local key/passcode recovery. Synced photos can be downloaded and encrypted under a new key after a confirmed wipe and online login. Unsynced photos cannot be recovered after key destruction or uninstall.
- No sync while the app is killed/backgrounded/locked. Pending jobs resume after foreground unlock with a valid server session. Previously issued GET URLs can remain usable until their short expiry; already downloaded copies cannot be revoked.

## Checks and manual acceptance

Verified in this session: mobile typecheck, targeted ESLint, 11 vault tests, 59 auth tests (57 regression tests plus two new lifecycle/build-profile tests), one network-proxy test, backend build and 18 backend tests, backup/permission manifest introspection, and `git diff --check`. Seven existing live-infrastructure integration tests are skipped without their configured test environment. No Android device/emulator was attached.

The Windows-generated lockfile initially omitted two optional emnapi entries required by EAS npm 10; the repaired lockfile passed an isolated npm 10 clean-install dry run without changing other package versions. The existing splash plugin also referenced a missing drawable; the supplied transparent Android vector fixes that build prerequisite. EAS Doctor passes 20/21 checks and recommends patch updates for Expo, Constants, Dev Client, Linking, Router, Sharing and Splash Screen; the inspected SDK 57 versions were retained.

Security acceptance checklist:

- [x] Ciphertext-only persistent image writes, authenticated decryption and tampering tests.
- [x] SecureStore key defaults, persistent app-passcode lockout, logout-discard guard tests.
- [x] Backend vault isolation, ownership, cleanup protection and durable S3/DB deletion tests.
- [x] Export confirmation, Android 14 permission behavior and temporary-file cleanup tests.
- [x] Backup manifest attributes and blocked broad read/GPS permissions verified.
- [x] Successful Android EAS development APK; compiled manifest/backup XML and native library contents inspected.
- [ ] Real-device screenshot/recording/recent-app, biometric/PIN, gallery, share-target and backup-restore acceptance.
- [ ] Live Mongo/S3 integration and production deployment validation.

Not protected: root/OS compromise, memory inspection while unlocked, copies retained by recipients, and cloud plaintext processing under upload option (a). See the limits above.

Automated: `npm run typecheck`, `npm run test:auth`, `npm run test:network`, `npm run test:vault`, `npm run verify:vault-config`. Backend: `npm run build` and Jest vault/photo/storage/logger suites. Crypto unit tests use Node's vetted crypto provider to exercise the envelope; Android native execution remains a device check. Existing integration tests require configured Mongo/S3 and are skipped without that environment.

Run on the Android development build (also repeat capture tests on a release build):

1. Airplane mode: add camera/gallery photos, hide/show, reorder, delete. Restart while offline, open local vault from sign-in, unlock; confirm rows and pending jobs persist.
2. Reconnect and unlock: pending work syncs; lazy remote photos show placeholders until downloaded. Confirm profile/discovery/chat APIs never list vault records/keys.
3. Kill mid-upload and during confirmation; reopen and retry. Confirm one UUID/live record, no duplicate quota slot, and valid canonical encrypted bytes.
4. Trigger moderation rejection; verify `rejected`, no automatic retries, clear explanation, and working delete.
5. Try logout with pending work: Stay signed in must retain files/key; explicit discard must wipe SQLite/WAL/files/key. Repeat account deletion and account switching.
6. Background/close viewer and inspect `cacheDirectory/vault-temp`; it must be empty. Kill during import and verify fixed picker/manipulator caches clear on restart.
7. Attempt screenshots, recording and recent-app preview while viewing hidden/visible photos. Verify FLAG_SECURE on real supported Android versions.
8. Check the Photos gallery after camera import and gallery import: no new app-created gallery item. Explicit export creates exactly the selected item(s), strips EXIF/GPS, and leaves vault copies intact. Verify denied permission on older Android and no broad prompt on Android 13/14.
9. Share to supported targets; verify successful receive where supported and no temp file remains on return. Never request deletion of gallery originals.
10. Disable screen lock: opt-in passcode setup, wrong attempts, kill/restart during lockout; verify five attempts impose persistent lockout. Restore Android screen lock and verify device credential fallback.
11. Simulate low disk, corrupt encrypted bytes, and interrupted download. Saving must fail clearly; corrupt local copies should offer cloud download without rendering bytes.
12. Restore/transfer device backup: verify vault and SecureStore keys are excluded. Server deletion must remove all S3 versions and live DB row after outstanding upload leases expire; tombstone must still reach an offline second device.

## File map

New: `src/features/vault/` (crypto, files, SQLite repository, lock, sync, conflicts, import/publication service, export/logout, passcode prompt, grid/viewer), `app/vault/`, `src/features/auth/localVaultLifecycle.ts`, `plugins/withVaultBackup.cjs`, `scripts/test-vault.cjs`, `scripts/verify-vault-config.cjs`, `scripts/eas-vault.cjs`, `scripts/eas-build-status.cjs`, `.easignore`, this report; backend `src/vault/` module/controller/validation/service/security tests. `assets/android-splash.xml` supplies the previously missing splash drawable while preserving the plain splash background.

Modified: app/package/EAS project configuration and lockfiles; root navigation/providers; auth store/session lifecycle and sign-in/account-state entry; account/settings screens; screenshot hook; shared photo upload adapter and its tests; backend app module, photo cleanup/presentation/account purge, S3 signed-GET helper, and request-log redaction. No AWS infrastructure mutation.
