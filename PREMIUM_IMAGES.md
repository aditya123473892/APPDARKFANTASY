# Premium images: implementation and rollout

Active backend: `backenddf/df-backend-pm-be`. Mobile: repository root. The nested
`darkfantasy-share/` duplicate is not part of this change.

Existing work was snapshotted on `snapshot/pre-premium-20261020` at `27e9471`.
Feature branch: `feature/premium-images`. Compare against that snapshot to review
only this feature. Do not deploy any real `.env` file from a workstation.

## File manifest

In this manifest, `B/` means `backenddf/df-backend-pm-be/`.

Created:

- `PREMIUM_IMAGES.md`
- `app/(app)/subscribe.tsx`
- `scripts/test-premium.cjs`
- `src/components/ui/PostImage.tsx`
- `src/features/subscriptions/entitlements.ts`
- `B/scripts/backfill-premium.ts`
- `B/scripts/set-test-premium.ts`
- `B/src/common/validation.ts`
- `B/src/entitlements/dev-entitlement.ts`
- `B/src/entitlements/entitlements.module.ts`
- `B/src/entitlements/entitlements.spec.ts`
- `B/src/photos/media.service.ts`
- `B/src/photos/media.service.spec.ts`
- `B/src/photos/premium-backfill.ts`
- `B/src/photos/premium-backfill.spec.ts`
- `B/src/photos/premium-upload.spec.ts`
- `B/src/posts/post.mapper.ts`
- `B/src/posts/post.mapper.spec.ts`
- `B/src/posts/premium-model.spec.ts`
- `B/src/posts/premium-response.e2e.spec.ts`
- `B/src/posts/premium-edit.spec.ts`

Modified:

- `app/(app)/_layout.tsx`
- `package.json`
- `src/components/ui/PostCard.tsx`
- `src/features/create-post/screens/CreatePostScreen.tsx`
- `src/features/feed/types.ts`
- `src/features/feed/services/feedService.real.ts`
- `src/features/feed/services/feedService.mock.ts`
- `B/.env.example`
- `B/package.json`
- `B/src/app.module.ts`
- `B/src/main.ts`
- `B/src/common/enums/posts.enum.ts`
- `B/src/common/schemas/media.schema.ts`
- `B/src/common/schemas/posts.schema.ts`
- `B/src/common/schemas/users.schema.ts`
- `B/src/photos/photos.service.ts`
- `B/src/photos/photos.integration.spec.ts`
- `B/src/photos/response.interceptor.ts`
- `B/src/photos/storage-checkpoint.spec.ts`
- `B/src/photos/storage-indexes.ts`
- `B/src/posts/posts.controller.ts`
- `B/src/posts/admin-posts/admin-posts.controller.ts`
- `B/src/posts/dto/photo-post.dto.ts`
- `B/src/s3-bucket/s3-bucket.service.ts`
- `B/src/s3-bucket/storage-layout.ts`
- `B/src/users/users.service.ts`

## Behavior and response contract

`visibility` remains audience privacy (`public`, `private`, `friends`, `custom`).
`contentVisibility` is independently `normal` (default) or `premium`. Audience,
blocks, account availability and moderation are checked before premium access.
Inaccessible posts are omitted, including in nested arrays. Authors see their
own images. The existing guarded `AdminPostsController` gets full image access;
admin roles on ordinary social routes do not bypass premium locking.

All post responses use `PostMapper.toResponse` through the global photo response
interceptor. Post media is now `images: [{ id, url, blurhash, width, height, aspectRatio }]`
and `locked: boolean`, for every viewer. `width`/`height` are the stored pixel size after
EXIF orientation; `aspectRatio` is `width / height` (4 decimals) or `null` for legacy rows
until `npm run premium:backfill -- --apply` fills their size. A post holds up to 10 photos. Internal keys/filenames never appear in these
images. The mobile adapter reads this contract and retains normal-only fallback
support for old API media. Update other consumers of the old `media` field before
deploying the backend. Captions remain visible to the audience; optional caption
truncation has not been enabled.

The mapper reads the persisted post and current DB entitlement. It never uses a
client subscription flag or a JWT entitlement claim. Mapped images carry an
in-process Symbol, so the recursive interceptor never re-signs their preview URLs.
The original signing path separately rejects premium access without entitlement.
HTTP responses handled by the photo interceptor carry `Cache-Control: private,
no-store` in one place. Dedicated moderation evidence transport retains its own
guard and serializer; it is not a social post response.

## Deployment order

1. Back up MongoDB. Review the snapshot-to-feature diff and run checks below.
2. Apply the S3, OAC and IAM configuration below. Keep all originals private.
3. Configure the new environment variables. Keep `PHOTO_VERIFY_BUCKET_SETTINGS=true`
   and `PHOTO_MODERATION_MODE=rekognition` on deployed servers.
4. Deploy the backend schema/media/mapper code. MongoDB has additive optional
   fields; existing missing tiers behave as normal immediately. `autoIndex:false`
   stays in place; no schema synchronization or new indexes are required.
5. From the active backend directory, run the dry-run, inspect counts, then apply:

   ```powershell
   npm run premium:backfill -- --batch-size 50
   npm run premium:backfill -- --apply --batch-size 50
   ```

   To resume strictly after a completed post, append `--after <lastPostId>`. To
   retry failures, run again WITHOUT `--after`, or resume before the first failed
   post. Output contains only counts and a post ID, never storage keys. The script
   defaults missing/null tiers to normal and generates missing previews for every
   bound post image, so any can subsequently become premium. It reuses reserved
   UUID keys on retry and completed metadata on repeat runs. It never moves,
   rewrites, copies, renames or deletes original objects. Concurrent image edits
   are protected by comparing the exact embedded media element before writing.
   Investigate nonzero `skipped` (unbound/foreign/unsupported legacy media) and
   `failed` counts before enabling premium for those posts. Unbound legacy objects
   are deliberately not imported by this script. Such premium images fail closed
   with an empty URL until repaired; no original is substituted.
6. Verify previews and security checks below, then ship the Expo app. Do not
   enable paid purchases: the provider verifier is intentionally disabled.
7. Rollback, if needed: keep the mapper/security backend deployed and revert the
   premium UI or set affected posts back to normal through authorized edits.
   Do not roll back to a backend that ignores premium restrictions while premium
   posts exist. Additive fields/previews need not be removed.

## Environment variables

Both are documented in `backenddf/df-backend-pm-be/.env.example`:

| Variable | Setting |
| --- | --- |
| `PHOTO_PREVIEW_BASE_URL` | Required HTTPS CloudFront origin, e.g. `https://YOUR-DISTRIBUTION.cloudfront.net`; no path/query/credentials |
| `POST_IMAGE_URL_SECONDS` | Default `900`; integer `300..3600` for authorized post originals |

Existing `PHOTO_MEDIA_BUCKET` (fallback `AWS_DEFAULT_S3_BUCKET`) stores previews
and existing canonical `posts/` originals. Existing `PHOTO_PRIVATE_BUCKET` stores
upload staging and other private resource types. The existing storage layout is
retained for NEW and OLD originals in this phase. Preview keys alone use
`previews/{ownerId}/{serverUUID}.jpg`. No bucket/domain/key is hardcoded in code.
No public subscription-enablement flag or webhook secret is added.

## S3 settings (manual)

Apply to every configured photo bucket:

- Block Public Access: `BlockPublicAcls=true`, `IgnorePublicAcls=true`,
  `BlockPublicPolicy=true`, `RestrictPublicBuckets=true`; also keep account-level
  public access blocks on.
- Object Ownership: `BucketOwnerEnforced` (ACLs disabled). No `public-read` ACLs.
- Default encryption: SSE-S3 `AES256` (matches the uploader). If your existing
  deployment uses SSE-KMS, additionally grant the relevant KMS permissions to
  the API role and CloudFront distribution, scoped to its ARN.
- No website hosting origin. Remove any anonymous read grants or broad original
  read grants from old bucket/access-point policies.
- Retain the existing lifecycle requirements: staging `temp/` objects expire
  after 1 day; abort incomplete multipart uploads after 1 day across the bucket.
  Do not add an expiry lifecycle rule for live originals or live previews.
- Web uploads: S3 CORS `AllowedOrigins` must be the exact HTTPS origins also listed
  in `PHOTO_WEB_ORIGINS` (no wildcard origins). `AllowedMethods`: `POST`, `GET`,
  `HEAD`; `AllowedHeaders`: `*`; `ExposeHeaders`: `ETag`; `MaxAgeSeconds`: `300`.
  A native-only deployment can leave `PHOTO_WEB_ORIGINS` empty and have no CORS
  rule. Presigned POST keeps its exact key/type and 1..5MB content-length policy.

Merge these statements into the MEDIA bucket policy, replacing `MEDIA_BUCKET`,
`ACCOUNT_ID` and `DISTRIBUTION_ID`. Preserve unrelated required private policies.
The OAC grant must be `previews/*`, NEVER `*`, `posts/*`, `originals/*`, `temp/*`,
`vault/*`, `chat/*` or `reports/*`. The explicit deny protects against accidentally
broad CloudFront permissions for this distribution.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPreviewOACOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::MEDIA_BUCKET/previews/*",
      "Condition": { "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID" } }
    },
    {
      "Sid": "DenyThisDistributionOriginalRead",
      "Effect": "Deny",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "NotResource": "arn:aws:s3:::MEDIA_BUCKET/previews/*",
      "Condition": { "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID" } }
    },
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::MEDIA_BUCKET", "arn:aws:s3:::MEDIA_BUCKET/*"],
      "Condition": { "Bool": { "aws:SecureTransport": "false" } }
    }
  ]
}
```

## CloudFront OAC settings (manual)

Use a dedicated preview distribution or an origin whose bucket policy is scoped
as above. S3 origin: the media bucket's regional REST endpoint; origin path empty.
OAC: origin type `s3`, `SigningBehavior=always`, `SigningProtocol=sigv4`. Attach it
to the origin. Do not use S3 website endpoints or an unrestricted OAI grant.

Preview behavior `previews/*`: viewer protocol `redirect-to-https`; allowed and
cached methods `GET`, `HEAD`; restrict viewer access (signed URLs/cookies) `No`;
no cookies or query strings forwarded. Cache policy TTL minimum `0`, default
`86400`, maximum `86400`; the server emits `public, max-age=86400, immutable` on
immutable preview objects. Leave the default behavior at `GET/HEAD` with OAC;
non-preview paths are denied by the bucket policy. No original-serving behavior
is enabled. If an API is behind another CloudFront distribution, disable caching
for `/api/*` and forward its authorization header; never cache viewer-specific
post responses. For web, optionally attach a response headers policy allowing
the exact app HTTPS origins and methods `GET/HEAD`; no credentials.

Never log full signed original request URIs. Review storage/access log destinations
for original-serving buckets: full request URIs must not persist signed query
parameters. Retain security audit events that omit these secrets. The application
logger emits only API method/path/status/duration. Do not enable
Axios/SDK debug logging or capture API response bodies in monitoring. CloudFront
preview logs contain no signed original requests because it cannot serve them.

OAC reference: [AWS: restrict access to an S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## API IAM role (manual)

Use the existing backend IAM role; never ship credentials in Expo. Keep its current
private prefixes and Rekognition grants. ADD the following policy for previews,
replacing `MEDIA_BUCKET`. No CloudFront signing key is needed; originals use
presigned S3 GET URLs. Preview access does not grant write access to CloudFront.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ManageGeneratedPreviews",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::MEDIA_BUCKET/previews/*"
    },
    {
      "Sid": "ListGeneratedPreviewsForAccountCleanup",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::MEDIA_BUCKET",
      "Condition": { "StringLike": { "s3:prefix": ["previews/*"] } }
    },
    {
      "Sid": "VerifyMediaBucketSecurity",
      "Effect": "Allow",
      "Action": ["s3:GetBucketPublicAccessBlock", "s3:GetBucketOwnershipControls", "s3:GetEncryptionConfiguration", "s3:GetLifecycleConfiguration", "s3:GetBucketCORS"],
      "Resource": "arn:aws:s3:::MEDIA_BUCKET"
    }
  ]
}
```

Retain API-only `s3:GetObject` for existing `posts/*` and supported legacy original
prefixes, `s3:PutObject` for staging/sanitized originals, and existing delete/list
grants for cleanup. Backfill uses that role's GetObject on existing originals and
PutObject on previews. Mobile obtains only temporary POST form credentials;
it has no IAM identity and no general GetObject permission.

## Endpoints routed through the mapper

All below have global prefix `/api`; routing occurs centrally even for posts
nested inside profiles, bookmarks and mutation results.

| Method | Path | Post surface |
| --- | --- | --- |
| GET | `/posts/public/feeds` | feed |
| GET | `/posts/private/me` | own profile posts |
| GET | `/posts/:id` | single post |
| GET | `/posts/book-mark` | bookmarked `postId` objects |
| POST | `/posts` | create and idempotent-retry result |
| PUT | `/posts/:id` | edited post, including tier changes |
| POST | `/posts/:postId/like` | returned nested post |
| DELETE | `/posts/:postId/unlike` | returned nested post |
| GET | `/users/me` | nested `usersPost` |
| GET | `/auth/me` | session profile's nested `usersPost` |
| GET | `/users/:id` | public/authorized profile posts |
| GET | `/users` | discovery/search nested posts |
| GET | `/admin/posts` | admin full images, existing guards |
| POST | `/admin/posts` | admin create, existing guards |
| PUT | `/admin/posts/:id` | admin edit, existing guards |

`GET /notifications` exposes sender avatars and event IDs, no post image or key.
There is no dedicated post-search, share-link or post-image notification endpoint.
Mobile sharing previously sent caption text only; locked posts now disable it.
`GET /entitlements/me` returns the current user's server entitlement/expiry and
`providerAvailable:false`. There is no public entitlement write endpoint.
`/photos/upload-url` and `/photos/confirm` retain the existing upload-ID contract.

## Verification

Backend, from `backenddf/df-backend-pm-be`:

```powershell
npx tsc --noEmit --incremental false
npx eslint "{src,apps,libs,test}/**/*.ts" --no-fix --no-error-on-unmatched-pattern
npx jest premium-model post.mapper premium-response premium-upload media.service premium-backfill entitlements photos.security storage-checkpoint --runInBand
```

Mobile, from repository root:

```powershell
npm run typecheck
npm run lint
npm run test:premium
```

The component tests use the existing Node test runner and React DOM server renderer
with native primitives mocked; no test library is added. HTTP tests exercise the
real mapper, photo service/interceptor and existing admin role guard with a fake DB
and storage, so they require neither AWS credentials nor an application database.
Existing real-Mongo suites are conditional on `TEST_MONGO_URI`; use an isolated
disposable replica set, NEVER the application's production database.

Validation results from this implementation:

- Backend and mobile TypeScript checks passed; scoped non-mutating lint passed
  with existing backend style warnings. Repository-wide lint still has the
  unrelated baseline failures listed below.
- Full backend run: 34 suites / 182 tests passed; 6 Mongo-dependent suites /
  174 tests skipped. Final focused run: 42 tests passed, covering tier-only edits,
  malformed preview references, safe logging and original delivery fallback.
- Mobile premium component/cache tests: 3 passed. The legacy media mapping
  regression was caught and fixed; its targeted rerun passed.
- Broader mobile auth/network/premium run: 79 tests passed, but the auth file
  failed on a late async error from the untouched chat reconnect test
  (`Group membership required`). That chat test passed when rerun alone; this
  remains an intermittent suite limitation, not a clean full-suite result.
- No production MongoDB migration/backfill, S3 write, CloudFront change, real
  payment or device purchase flow was executed. The manual checklist still
  requires the deployment's AWS resources and test accounts.

For local end-to-end entitlement testing only, configure `NODE_ENV=development`,
`DATABASE_URL=mongodb://127.0.0.1:27017?directConnection=true`, and
`DATABASE_NAME=darkfantasy_dev` (or another `*_dev`/`*_test` name). Then:

```powershell
npm run premium:test-user -- USER_OBJECT_ID 15
npm run premium:test-user -- USER_OBJECT_ID 0
```

The first grants 15 minutes; the second clears it. The script refuses production,
staging, hosted/SRV/multiple hosts, credentials and replica-set discovery options.
It intentionally cannot grant entitlements in deployed/hosted environments.

Manual checklist:

- Create a public premium post as A. As non-subscriber B, inspect feed, single,
  profile/search, bookmarks and like/unlike responses. Every image has only the
  five allowlisted fields; JSON contains no original key/path, filename or signed
  original URL anywhere. The cache header is `private, no-store`.
- Open B's preview URL directly: it must already be heavily blurred, low resolution
  and without EXIF/GPS. Removing the UI overlay must reveal only the blurred file.
- Open an unsigned S3 URL for an actual existing `posts/.../original.jpg` (and
  `originals/...` if you have that prefix): expect 403. Request that original path
  through the preview CloudFront distribution: also expect 403.
- Grant local B a short test entitlement. Refresh: originals unlock. Clear or let
  the entitlement expire: the next API response is locked, and the app clears
  cached post lists/refetches on expiry or entitlement polling/app resume.
- A always gets own full premium images, without a subscription. A guarded admin
  route gets full images; an admin using an ordinary social route still locks.
- A cannot attach B's confirmed photo ID. Wrong MIME, >5MB or mismatched magic
  bytes must be rejected at confirmation. No failed confirm becomes attachable.
- Change a post normal -> premium -> normal through an authorized edit. The next
  response changes lock state without rewriting image objects.
- Blocks, private audiences and moderation still hide posts even for subscribers.
  User/profile/admin update attempts containing `premiumUntil` must return 400.
- Locked image taps open the honest unavailable-subscriptions screen. No zoom,
  fullscreen, save or share action is offered for locked post images.

## Limitations and follow-ups

- No verified payment provider is integrated. Legacy client-created
  `UserSubscriptions` rows never grant premium. Implement authenticated store or
  provider verification, product/user binding, replay-safe webhook persistence,
  renewals/refunds/revocations and reconciliation before accepting money; invoke
  `refreshAfterSubscription()` after a verified purchase/restore callback.
- Original presigned URLs remain bearer capabilities until their configured expiry
  (normally 15 minutes), even if a subscription expires or a post changes tier.
  Every NEW request rechecks access, but previously delivered bytes/URLs cannot be
  revoked instantly. Strict instantaneous revocation needs an authorized streaming
  proxy or an edge authorization design with shorter revocation windows.
- Screenshots, screen recording and copies by authorized viewers cannot be fully
  prevented. This feature is access control, not DRM.
- Preview generation is synchronous at confirm with existing processing limits;
  move it to a durable worker when a queue is configured. The one-component
  BlurHash is an average-color placeholder; the actual JPEG is heavily blurred.
- Feed pagination remains existing limit/skip; no new cursor scheme is introduced.
  Per-post authorization/entitlement lookups add DB work; batch within one request
  later, without caching entitlement across requests.
- Public previews are cacheable for one day. For urgent takedowns, invalidate
  `/previews/<owner>/<uuid>.jpg` in CloudFront and delete the preview; original
  deletion/account purge is separate. No preview URL can recover original pixels.
- Native transfer already has progress/retry. Existing web multipart fetch reports
  transfer stages and retry attempts rather than byte-level progress.
- Store launch needs a policy review for the target storefronts and content. Digital
  subscriptions generally require the relevant store billing flow, subject to
  regional/program exceptions; no external checkout is introduced here. See
  [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) and
  [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738).
- Pre-existing lint failures are outside scope: mobile `src/features/safety/blockCache.ts`
  has two explicit-any errors; the inherited backend lint configuration does not
  resolve existing `src/...` aliases. Changed backend source can additionally be
  linted with `--rule 'import/no-unresolved: off'`; TypeScript checks those imports.
  Pre-existing Stripe initialization is commented out; the legacy subscription
  create route accepts client subscription records and is not an entitlement source.
