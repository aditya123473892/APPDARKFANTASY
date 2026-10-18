# Photo Vault — simpler Android version

The original encrypted implementation is preserved on remote branch [`encrypt`](https://github.com/aditya123473892/APPDARKFANTASY/tree/encrypt), commit `f8a3ba6`.
The working `claude` branch uses the simpler vault requested afterwards.

## Running

Run `npm start` and scan with an **SDK 57 compatible Expo Go** on the same Wi-Fi.
The launcher explicitly selects `--go`. Quick Crypto, Quick Base64, Nitro and expo-dev-client have been removed.
`@noble/hashes@1.8.0` provides JavaScript-only SHA-256 checksums; UUIDs use the existing Expo core runtime. `expo-crypto` is not required. This also avoids the `Cannot find native module 'ExpoCrypto'` startup crash when using an older installed development APK. No custom native crypto is imported.
Expo Go is a shared development host; app configuration, Android backup exclusions and package-specific permissions apply only to a standalone/development APK built from this project, not to Expo Go itself.

## What the simpler vault does

- Stores resized JPEGs in private app documents at `vault/{userId}/simple/{photoId}.jpg`; SQLite DB/WAL live in the same directory.
- Uses ordinary JPEGs with **no additional image encryption at rest**. Android sandbox/device security protects normal access; a compromised device or extracted files can expose images. Hidden is only an in-app display preference.
- Requires Android device authentication (biometric/device credential fallback), relocks on background and retains persistent failed-attempt lockout. There is no separate app passcode or per-user image encryption key.
- Keeps encrypted-build files/DB outside the `simple/` directory untouched during normal use. Sync old pending images with the encrypted build before switching. Cloud copies download normally into the simpler vault. Logout warns about unsynced changes from either DB before an explicit wipe removes both versions for that account.
- Keeps offline additions, persistent SQLite upload/edit/delete jobs, retry/backoff, tombstones, moderation rejection, hide/show/order, separate 50-photo vault limit, lazy downloads and SHA-256 checks.
- Never writes to the gallery except after explicit export confirmation. Camera/gallery originals in the gallery are not removed. Picker/manipulator temporary copies are cleaned up.
- Uses React Native Image with app-cache viewing copies; deletes those copies on close/background/logout. No expo-image URL/disk cache is used for vault photos.
- Uses expo-screen-capture on vault screens; production always requests blocking. Screenshots are allowed by default in development, including Expo Go. Set `EXPO_PUBLIC_ALLOW_SCREENSHOTS_FOR_TESTING=false` to test blocking during development.
- Retains explicit export/share, metadata removal, logout/discard guard, private backend endpoints, independent public publication copies and cleanup protections.

Existing Android `uploadPhoto()` callers still prepare a hidden vault copy and publish a separate approved copy through the original `/photos/upload-url` → S3 POST → `/photos/confirm` protocol. A vault key is never attached to public profile/chat/post/discovery resources. Deleting a private vault copy does not retract an already published photo.

## S3 paths and compression

S3 uses object-key prefixes (shown as folders here):

```text
temp/{userId}/{uploadId}.jpg                  profile/post/chat staging
temp/{userId}/{uploadId}.webp                 WebP staging when accepted
temp/{userId}/{photoId}.jpg                   vault staging
users/{userId}/photos/{processingUUID}.jpg    approved profile/post/chat copy
users/{userId}/vault/{photoId}/{attemptUUID}.jpg  approved private vault copy
temp/diagnostics/{testId}.jpg                 standalone diagnostic images only
```

Public and vault uploads share the backend `sanitizeAndModerate()` pipeline: validate real image type/size, apply orientation, fit inside **1080 × 1920** without enlarging, re-encode **JPEG quality 80**, drop EXIF/GPS, moderate and save approved bytes with `ServerSideEncryption: AES256` and `ContentType: image/jpeg`. Client vault import also fits to 1080 × 1920 and uses JPEG quality 0.8. Quality is an encoder setting; the file-size reduction varies by source.
Temporary objects are staged until confirmation and eventual cleanup; they are not approved media. Per-attempt final UUIDs protect concurrent processing and retries. Ownership comes from verified auth. Download URLs expire in 120 seconds; POST URLs in at most 300 seconds. Vault collection/quota are separate from profile uploads.

## Read-only live audit (18 October 2026)

`node scripts/audit-photo-storage.cjs` reads object metadata/sample bytes and DB state without uploading, modifying or deleting anything. It prints no object keys, credentials or presigned URLs.

- Found **2 approved profile/public photo objects** (140,168 bytes total), **2 temporary upload objects** (168,238 bytes total), and **3 diagnostic objects** (215,586 bytes total).
- The latest approved photo was an actual **1080 × 1080 JPEG**, **65,386 bytes**, with **no EXIF**, `image/jpeg` content type and **AES256 server-side encryption**. This verifies an existing saved object; an original-size baseline was unavailable, so its compression percentage is unknown.
- MongoDB had **2 attached photo-upload records**, 11 deleting records, and **no vault photo/tombstone records**. Vault S3 saving has automated coverage but has not yet been confirmed with a real phone upload. `/api/vault/changes` is registered on the local backend and rejects unauthenticated requests with HTTP 401.
- The current AWS identity received **AccessDenied** for bucket public-access-block, bucket-encryption configuration and lifecycle reads. Object encryption was verified, but bucket-wide privacy/lifecycle settings could not be independently confirmed. No IAM or bucket changes were made.
- The local backend is configured with `NODE_ENV=development`, `PHOTO_MODERATION_MODE=development-bypass` and `PHOTO_VERIFY_BUCKET_SETTINGS=false`. It still compresses/strips metadata, but deliberately skips moderation and bucket-setting verification. Production must use Rekognition and enable bucket verification with the required read permissions; this audit did not change your environment settings.

## Verification and manual acceptance

Automated checks: mobile typecheck; auth/network/vault suites; standalone Android manifest configuration check; backend build and photo/vault/storage/logger tests. Compression coverage generates a large metadata-bearing JPEG and verifies reduced dimensions/size, JPEG output and metadata removal. Storage tests cover private-path reads, temporary-copy cleanup and logout wipe; backend tests cover excluding live vault images from unused-photo cleanup and deleting S3 objects plus live DB rows.

Result: typecheck and targeted lint passed; **72 client tests** (59 auth, 12 vault, 1 network) and **19 backend tests** passed. Backend build and manifest verification passed.

Manual phone checks remain:

1. Open in SDK 57 Expo Go; authenticate, add from camera/gallery, view, hide/show, multi-select/delete and export/share.
2. Airplane mode add/delete/hide, restart the app, reconnect, unlock and sync; kill mid-upload and verify idempotent retry.
3. Confirm a vault upload appears only at the private vault prefix and in VaultPhotos, and never in discovery/profile/chat/public responses.
4. Confirm no imported vault copy appears in Photos until explicit export. Deny export permission where Android requests it; verify local copy survives.
5. Test logout with unsynced changes: cancel preserves everything; explicit discard wipes rows/files/cache. Check account switching and expired login preserve locked offline access.
6. Test device auth cancellation/failure/lockout across restarts, picker return, foreground/background and no-screen-lock rejection.
7. Test screenshot/recording and recent-app privacy on a standalone Android APK. Expo Go cannot validate this app's manifest/backup configuration.
8. Test low disk, damaged/missing local files, cloud re-download and offline placeholders.

No custom crypto, key-recovery claim or end-to-end encryption is provided by the simpler version. S3 encryption protects cloud storage at rest, while the backend/AWS can process cloud photos. Rooted devices, external exports, app memory and physical secure erasure are outside this vault's protection.
