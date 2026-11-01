# Social reliability implementation and verification

Latest follow-up: [error handling, loading, database consistency and synchronization](RELIABILITY_STATE_SYNC_FOLLOWUP.md), including atomic relationship/notification writes and 250 passing targeted/regression tests.

Work performed against the active Expo app at the repository root and the independent NestJS repository in `dfbackend/`. Existing uncommitted work was preserved. The database is MongoDB/Mongoose, not PostgreSQL. Installed mobile versions are Expo SDK 58 and React Native 0.88. No replacement ORM or authentication system was introduced.

| Issue | Confirmed root cause | Main files changed | Implementation | Verification |
|---|---|---|---|---|
| Follow cancellation | Buttons used mutation history as relationship state, disabled Requested, and had no cancellation UI. Existing edges caused errors; rejected rows prevented new requests. | `dfbackend/src/users/users.service.ts`, `users.controller.ts`, `common/schemas/follow.schema.ts`; `src/features/requests/relationship.ts`, `hooks/useRequests.ts`, `components/FollowButton.tsx`, `services/requestsService.real.ts` | Canonical `none/requested/following` state; cancel/unfollow actions; conditional acceptance/rejection; retry-safe writes; unique ordered pair; optimistic updates, rollback, duplicate-tap reservations and session-generation guards. | Real Mongo concurrent creation/acceptance, cancellation, rejection, unfollow, authorization and retry tests; frontend optimistic/rollback/account-switch tests. |
| Feed ordering | Feed applied one chronological offset sort without grouping followed authors. | `dfbackend/src/posts/posts.service.ts`, `posts.controller.ts`, `dto/filter-post.dto.ts`, `common/schemas/posts.schema.ts`; `src/features/feed/hooks/useFeed.ts`, `services/feedService.real.ts`, `types.ts` | Two bounded database group queries, followed authors first, descending date/ID ties, snapshot cursor, membership fingerprint, blocked/private/moderated author exclusion. Legacy offsets remain supported. Missing-date imported posts remain visible. | Multi-page ordering, equal-time ties, refresh snapshots, membership changes, duplicate prevention, private/blocked visibility and imported-post pagination tests. |
| App Lock | Only the vault had authentication; there was no application-wide independent PIN lock. | `src/features/app-lock/*`, `src/providers/AppProviders.tsx`, `app/(app)/settings/app-lock.tsx`, `app/_layout.tsx`, `app.config.js`, settings screen | Custom 6–12 digit PIN; random salt, PBKDF2-SHA256 with 600,000 iterations; SecureStore; serialized verification and persisted throttling; separate optional biometric setting; enrollment-sensitive secure credential; immediate/30s/1m/5m background timeout; navigation hydration gate; account-password verification for reset. | PIN create/verify/change, wrong PIN, retry lockout, biometric enable/disable/unavailability/enrollment changes, timeout boundaries, account isolation and protected-content hydration tests. Native hardware behavior remains unverified. |
| Notifications | Notification types/events existed for events and moderation only. No follow/message creation, push registration or push delivery path existed. | `dfbackend/src/notification/*`, `common/schemas/notification.schema.ts`, notification enum, users/chat modules/services/gateway; `src/features/activity/useNotificationLifecycle.ts`, `notificationTarget.ts`, `pushRegistration.ts`, notification mapping; chat socket and auth logout | Persistent deduplicated follow/message notices; authenticated device registration/removal; leased Mongo push outbox; bounded requests, backoff, receipt polling and invalid-device removal; generic push text; collapse IDs; unread updates; safe navigation including cold starts; relationship events and foreground reconciliation. | Actual Mongo persistence/deduplication/unread tests; mocked push transport failure, success, receipts and invalid-token tests; navigation allowlist tests. No real FCM/APNs delivery was attempted. |
| Follow counts | Stored counters were not maintained; frontend list keys were omitted from mutation invalidation; other profiles did not show counts. | Users service/controller; `src/features/profile/components/ProfileHeader.tsx`, `screens/MyProfileScreen.tsx`, `screens/UserProfileScreen.tsx`, `screens/ConnectionsScreen.tsx`; follow hooks and socket | API counts derive from accepted edges rather than imported counters, avoiding increment races. Shared invalidation updates lists, profiles, feed and private profile posts. Followers/Following lists use the same follow button. | Counts after every mutation, duplicate/concurrent actions, real relationship lists and blocking regressions. |
| Photo backup | Persistent photos were ordinary JPEGs; local save, upload success and verified encrypted backup were not distinguished. | `src/features/vault/photoEncryption.ts`, `files.ts`, `repository.ts`, `types.ts`, `sync.ts`, `backupStatus.ts`, `conflicts.ts`, viewer and import service; `dfbackend/src/vault/vault.service.ts`, S3 service | Native AES-256-GCM local photo envelopes with account/photo authenticated data and SecureStore keys; verified atomic writes; lazy upgrade of existing JPEGs; temporary viewing copies; upload checksum checks; S3 size/encryption acknowledgment; truthful three-state messages; local-copy safety rechecked after failures. Existing queue IDs/backoff/tombstones remain. | Real AES-GCM through a Node crypto adapter, tampering/wrong-resource rejection, encrypted disk persistence and cleanup, S3 acknowledgment checks, local/cloud status mapping, offline patch/delete/retry and original auth/vault regressions. Native crypto round-trip and actual AWS backup remain device/deployment checks. |
| View-once messages | The existing backend already enforced atomic recipient consumption. Sender presentation was a generic photo card. | `src/features/chat/components/ViewOnceAttachment.tsx`, `MessageBubble.tsx` | View Once photo indicator with sending/sent/unconfirmed/opened/expired status. No persistent sender thumbnail or new protected-media URL is created. | Existing 20 focused backend cases plus database one-opening/expiration and frontend viewer/cache/background regressions. The existing upload/open contract supports photos only; view-once video was not added. |
| Message popup | Native alert dismissal was platform-dependent and repeated long presses could open multiple alerts. | `src/features/chat/screens/ChatRoomScreen.tsx`, `components/MessageActionPopup.tsx`, `src/components/ui/BottomSheet.tsx` | One controlled popup; synchronous duplicate-open guard; keyboard dismissal; separate backdrop; native back close; downward handle swipe; visible Cancel; close before executing actions. | Popup action ordering, backdrop, hardware-back and swipe handler tests; existing edit/delete/keyboard regressions. Touch behavior on actual Android/iOS devices remains unverified. |
| Discover follow state | `mapProfile` initialized every relationship to none; server search omitted caller state, and public serialization stripped the new relationship field. Search text was escaped twice. | Users service/public-profile allowlist/profile privacy test; `src/features/profile/services/profileService.real.ts`, hooks; Discover profile row; shared follow hooks | Batched caller-relative relationships in directory/profile responses; preserved serialized state; shared query cache; mutation-aware ingestion; literal search escaped once by the backend. | Persisted pending/following Discover cases, frontend cache rollback, account switch, literal search and public serialization tests. |
| Performance/loading | Discover loaded posts per user; API interceptor overwrote screen cancellation; feed hydrated every comment/like; repeated authors were resolved repeatedly during response presentation. | Users summary query; feed summary query; `dfbackend/src/photos/photos.service.ts`; API client/backend/requestSignal; profile/feed query services/hooks; root hydration guard | Discover summaries use five database operations; full legacy user response remains available. Feed bounds comment previews, batches visible counts and hydrates viewer likes only. Response context memo is scoped to one response. Caller and session abort signals are composed and released. Unlock does not rehydrate an established auth session. | Measured Discover fixture below; repeated-author lookup test; bounded feed preview/count tests including blocked users; cancellation, timeout/retry/error recovery and existing list/chat regressions. No phone or production latency/memory claim is made. |

## Database and API rollout

Run the existing deployment migration before deploying the new backend:

```powershell
cd dfbackend
rtk proxy npm run build
rtk proxy npm run migrate:deploy
```

This command was tested through disposable databases; it was not run against the configured application database.

`src/users/social-indexes.ts` archives duplicate legacy follow documents in `FollowDuplicateArchive` inside a transaction, retaining accepted before pending before rejected edges, then creates the unique `(follower, following)` index. Repeating it is safe. It also backfills only missing/null post timestamps from ObjectId dates. Existing timestamps are preserved. Accepted relationship rows are the source of truth for counts; old denormalized user counters are not trusted.

Additional schema indexes cover incoming/outgoing accepted/pending edges, feed visibility/status/author/date/ID ordering, notification dedupe keys and queue scanning. Push token/delivery indexes are installed by the delivery service. SQLite adds `localEncrypted` and `remoteEncrypted` columns without replacing the existing vault database. Earlier encrypted-branch data remains in its original directory.

New endpoints:

- `GET /users/follow/relationship/:userId`
- `GET /users/follow/outgoing`
- `GET /users/follow/counts` (two indexed counts; My Profile no longer downloads both full relationship lists for its header)
- `DELETE /users/follow/cancel/:followId`
- `PUT /notifications/push-token`
- `DELETE /notifications/push-token`

Existing follow/unfollow/approval endpoints retain their wire shape but reconcile retries instead of rejecting an already-achieved state. `isPrivate: true` requires acceptance; explicitly public `false` follows immediately. Accounts without this field retain the previous request-approval behavior. A new public/private account settings feature was not introduced.

Directory/profile responses add caller-relative `relationship`. `GET /users?summary=true` omits embedded post payloads for mobile discovery. Existing full responses remain available. Feed accepts `cursor=start` and subsequent `nextCursor` values; legacy `skip/limit` callers remain supported. A cursor is rejected with a refresh instruction if followed membership changes. `summary=true` bounds feed previews while retaining visible counts. Notifications add safe navigation metadata. Vault responses add `remoteEncrypted`; missing/false verification never becomes an encrypted cloud success claim.

## Dependencies and native setup

- Added `expo-crypto ~58.0.7`: native authenticated AES-GCM, avoiding custom cipher implementations.
- Added `expo-notifications ~58.1.6`: permission/channel registration, device tokens, foreground notifications and cold-start responses.
- Reused existing SecureStore, LocalAuthentication, Noble hashes, Zustand, TanStack Query, Expo FileSystem/SQLite, Socket.IO, Mongoose and Nest scheduling.

Rebuild older development APKs after adding native modules. Push requires an EAS project ID and configured FCM/APNs credentials; Expo Go is not a push-delivery verification target. Face ID/authenticated SecureStore require appropriate native configuration. The existing app config targets Android releases; enabling an iOS distribution target and building it on an appropriate host remain deployment work. Face ID descriptions and plugins were configured, but no iOS native build was produced.

References used for compatibility and delivery behavior: [Expo crypto](https://docs.expo.dev/versions/latest/sdk/crypto/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/), [Expo push delivery](https://docs.expo.dev/push-notifications/sending-notifications/). Push receipts establish handoff to the platform service, not proof that a phone displayed a notification. Notification IDs/collapse IDs reduce duplicate displays; transport is not an exactly-once guarantee.

## Verification results

- Final backend source run: **538 passed, 51 suites, zero failures**, including all optional database suites. See [`backend-tests-final.json`](backend-tests-final.json). Earlier runs exposed stale test providers and local Mongo monitor/hook timeouts; fixture corrections and fresh isolated reruns were completed before this fully passing run.
- Dedicated backend integration suite: **60 passed, 7 suites**.
- Mobile suites: **169 passed** in the combined run, plus the subsequently added follow optimistic/concurrency/account-switch case passed. The 11-case reliability suite and final focused gate/cache reruns passed. Vault was rerun after final checksum changes: **25 passed**.
- Mobile TypeScript and ESLint passed.
- Backend Nest build passed.
- Android JavaScript export passed: `artifacts/reliability-android/`. This is a bundle check, not an installed native application test. Metro reported an existing Expo Router package-export fallback warning.
- Actual Android/iOS touch interactions, biometric hardware/enrollment, app-switcher content hiding, native AES persistence after process death and actual push delivery were not verified. The installed Android SDK's `adb devices -l` returned no connected devices; no iOS native build host was used.
- AWS operations were mocked in the automated suites; no real media or push message was sent. No production database was modified.

`dfbackend/scripts/test-all.cjs` starts a disposable Mongo replica set and enables previously optional `TEST_MONGO_URI` suites. `npm run test:integration` retains the existing integration harness. `npm run test:reliability` runs the new mobile behavior/security tests.

## Measured performance

The final fixture run used 20 users, 60 posts and 10 warmed samples per implementation on a local MongoMemoryReplSet. The before path reproduces the original directory query shape; the after path calls the implemented summary service. It excludes HTTP, image signing, device rendering and production network latency. See [`social-performance.json`](social-performance.json).

| Discover service read | Before | After |
|---|---:|---:|
| Mean duration | 98.07 ms | 21.01 ms |
| Database operations/read | 22 | 5 |
| Serialized fixture payload | 38,571 bytes | 11,371 bytes |

Wall times varied with host load; query and payload reductions were consistent. One response containing 20 repeated author objects resolves that identity once; a separate response resolves it again, preserving request isolation. Feed summary tests verify ten comments remain counted while at most three are hydrated.

App startup, phone feed load, phone Discover/Profile/chat opening, message delivery latency, authenticated production HTTP endpoint latency, production query durations, device memory and render counts were **not measured**. The Android export time is not an app startup measurement. These require instrumented development/release devices and a representative deployment; no results are invented for them.

## Remaining limits and release checks

1. Apply the migration to the intended deployment database, deploy backend and mobile together, and rebuild native clients.
2. Configure/test actual push credentials and permissions, foreground/background/terminated taps and invalid-token recovery on devices. Multi-process Socket.IO deployment still needs its existing deployment transport/adapter plan; foreground reconciliation provides a fallback for missed cross-process events.
3. Verify PIN-only unlock, biometric toggling/enrollment changes, auto-lock timing, recovery, screenshot/app-switcher behavior and temporary plaintext cleanup on Android and iOS hardware.
4. View-once video remains unsupported. Sender identification uses a non-sensitive photo indicator/status, preserving the existing single-opening privacy contract.
5. Vault photo encryption is local AES-GCM plus verified S3 encryption at rest. It is not end-to-end encryption; the server still moderates/re-encodes cloud photos. SQLite metadata and existing local videos are not claimed to be encrypted. Legacy JPEGs upgrade on access; an inaccessible legacy copy is not labeled encrypted.
6. Installed dependency audit output reported 31 findings (1 low, 26 moderate, 4 high). No broad dependency upgrades or force fixes were applied; a dependency-specific release audit remains necessary.

The implementation has automated coverage for the changed contracts. These remaining native/deployment checks prevent a claim of fully verified production readiness.
