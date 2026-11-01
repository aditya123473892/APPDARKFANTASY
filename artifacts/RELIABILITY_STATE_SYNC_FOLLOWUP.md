# Error handling, loading, database consistency and synchronization follow-up

Implemented against the existing Expo/TanStack Query frontend and NestJS/Mongoose backend. The database is MongoDB; the existing replica-set transaction infrastructure is reused. No application data was migrated or deleted.

| Confirmed cause | Implementation | Main files |
|---|---|---|
| A follow or acceptance could commit before its notification failed, returning an error after a partial write. | Commit relationship and persisted notification in one transaction. Retry duplicate-key races in a fresh transaction and publish relationship events after commit. Accepted edges remain the count source of truth. | `dfbackend/src/users/users.service.ts`, `dfbackend/src/notification/notification.service.ts` |
| Follow endpoints converted infrastructure errors into validation responses and included raw error text. | Preserve known HTTP exceptions; report unexpected failures with a sanitized, retryable 503 for create, accept/reject, unfollow and cancel. | `dfbackend/src/users/users.controller.ts` |
| Rolling back a failed request replaced the entire old list, potentially resurrecting another completed request. Repeated actions and late account callbacks were insufficiently guarded. | Restore only the failed row, reserve actions across hook instances and verify session generation before writes, callbacks, toasts and navigation. | `src/features/requests/requestCache.ts`, `src/features/requests/hooks/useRequests.ts` |
| Activity used a separate follow-request query and mutation path that refreshed only its own list. | Use the shared request query and actions. Invalidate counts, relationship state, lists, profiles, feed, conversations and notifications after mutations. Avoid an unrelated authentication refresh after follow failures. | `src/features/activity/screens/ActivityScreen.tsx`, `src/features/requests/hooks/useRequests.ts` |
| Missing profile data could leave a spinner, and failed count refreshes had no explicit retry state. | Show a recoverable profile error, explicit count loading/error states, stale-count messaging and count-aware pull-to-refresh. | `src/features/profile/screens/MyProfileScreen.tsx` |
| Cancelled requests were classified as network errors; request-list reads ignored query cancellation. Repeated full collection pages could loop indefinitely. | Preserve cancellation and suppress retries for it; propagate query signals to both request endpoints; reject malformed counts and repeated pages into an error state. | `src/services/api/backend.ts`, `src/services/queryClient.ts`, `src/features/requests/services/requestsService.real.ts`, `src/features/requests/services/requestsService.ts` |

## Verification

- Mobile reliability suite: **16 passed**. Covers concurrent optimistic rollback, duplicate action prevention, logout isolation, cancellation, pagination failure recovery, Activity shared actions, profile retries, App Lock, popup dismissal and encryption status/security.
- Mobile authentication and messaging regression suite: **89 passed**.
- Backend source regression selection: **132 passed in 5 suites**, with a disposable Mongo replica set. Includes follow endpoint errors, notification privacy, block authorization/surfaces and moderation. Machine-readable result: [reliability-followup-backend.json](reliability-followup-backend.json).
- Social integration suite: **13 passed, 1 intentionally excluded performance benchmark**. Exercises actual transaction rollback on notification-write failure, idempotent retry, concurrent acceptance/cancellation, counts, Discover, feed pagination, message notifications, push failure recovery and indexes. The previous performance artifact was preserved.
- Mobile TypeScript, mobile ESLint and backend build passed. Both repository whitespace checks passed.
- Initial checks caught an updated cancellation signature at the old Activity query call, its avatar field mismatch, and a cross-VM array assertion in the test harness. Those were corrected and the affected checks rerun successfully.

These are **250 passing tests** across the four runs above. No native Android/iOS interaction, real push delivery or production performance measurement was performed during this follow-up. No new dependencies or database migrations were added. Successful API payloads are unchanged; unexpected follow write failures now use HTTP 503 instead of a misleading validation response. Existing clients must run against the configured replica-set deployment, as already required by the application's transactional storage flows.

The broader implementation, native/deployment checks and earlier measured performance remain documented in [SOCIAL_RELIABILITY_REPORT.md](SOCIAL_RELIABILITY_REPORT.md). This follow-up makes no additional speed or production-readiness claims.
