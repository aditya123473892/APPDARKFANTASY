# Phase 1B — app user context and role access

Backend and desktop sources were inspected read-only. No API contracts, backend files, database roles, chat transports, or media transports were changed.

## Confirmed discovery

Paths below are relative to this repository. Backend prefix: `backenddf/df-backend-pm-be/src/`. Desktop prefix: `Df-Fortend-pm-fe/Df-Fortend-pm-fe/src/`.

| Field/rule                 | Meaning and source                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `roles: ERole[]`           | Array, lowercase `root`, `admin`, `user`, `manager`. Backend `common/enums/role.enum.ts`, `common/schemas/users.schema.ts`. No manager-specific route rules found.                                                                                                                                                                                                                    |
| Root override              | `common/guards/roles.guard.ts`: any required role may be satisfied by `root`; multiple required roles mean OR.                                                                                                                                                                                                                                                                        |
| Role authority mismatch    | HTTP `common/guards/jwt.strategy.ts` obtains roles from JWT claims; `/auth/me` reads the database. App authorization reads only `/auth/me`. Existing JWT privileges may remain stale after manual role changes. Re-login is required to obtain updated claims.                                                                                                                        |
| `isEmailVerified`          | Email verification boolean; login refuses false. `/auth/me` does not refuse false. `auth/auth.controller.ts` login, verify-email, getMe; `users/users.service.ts` findUnverifiedUsers.                                                                                                                                                                                                |
| `isBlocked`                | This account is blocked, **not** a list of blocked contacts. Login rejects it before password validation; `/auth/me` returns a 401 envelope without user data. `auth/auth.controller.ts`; `users/users.service.ts` blockUser.                                                                                                                                                         |
| `blockedBy`, `blockedTime` | Account block origin `open`, `admin`, `system`, and optional timestamp. `common/enums/utils.enum/index.ts`, `common/schemas/users.schema.ts`. No automatic unblock flow confirmed.                                                                                                                                                                                                    |
| `status`                   | Separate `open                                                                                                                                                                                                                                                                                                                                                                        | blocked`field. Do not infer`isBlocked`from it: blockUser toggles`isBlocked`, while blockUserBySystem writes status/origin/time without setting that boolean. |
| `canEditProfile` | Schema boolean defaulting to false. No service/controller usage was found, so its operational meaning and enforcement remain unconfirmed; no capability is inferred from it. Existing app profile edits still use fixtures; returned fixtures cannot replace `/auth/me`. |
| Verification               | `POST /auth/verify-email` accepts `{token}`. The misleading `POST /auth/send-verification-email` duplicates verification logic instead of resending. App directs users to the existing desktop email-link flow; no resend request or token is invented.                                                                                                                               |
| Other users                | `users/users.service.ts` getUserChatList selects `_id displayname avatar username`. Direct chat history uses sender/receiver IDs. `chats/chats.service.ts` getChatGroupHistory populates sender with `username displayname avatar firstName lastName` (plus `_id`). Group members also expose phoneNumber (`group-chat/group.service.ts`), deliberately omitted from the small cache. |
| Desktop gating             | `common/utils/login-redirect-url.ts`: first role admin/root → dashboard; otherwise feeds. `components/feeds/FeedCard.tsx` and fantasy users page show request controls only for `roles.includes('user')`. App uses the same request rule and unions capabilities for multi-role accounts.                                                                                             |

## Backend role-protected routes

All entries below require **admin OR root**. There are no active user-only, manager-only, or root-only route decorators. Each controller uses JWT plus RolesGuard (users inherits JWT at class level). Commented-out `@Roles` annotations are not enforcement.

| Controller source                             | Routes                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth/auth.controller.ts`                     | `GET /auth/loginCheck`                                                                                                                                                         |
| `users/users.controller.ts`                   | `GET /users/history`, `GET /users/unverified`, `POST /users`, `PATCH /users/update/:id`, `PUT /users/approve-request/:userId`, `PUT /users/verify/:id`, `PUT /users/block/:id` |
| `posts/admin-posts/admin-posts.controller.ts` | `GET /admin/posts`, `PUT /admin/posts/:id`                                                                                                                                     |
| `contact/contact.controller.ts`               | `GET /contact`                                                                                                                                                                 |
| `coupon/coupon.controller.ts`                 | `POST /coupons`                                                                                                                                                                |
| `events/events.controller.ts`                 | `POST /events`, `PUT /events/:id`, `DELETE /events/:id`                                                                                                                        |
| `subscription/subscription.controller.ts`     | `POST /subscriptions`, `PUT /subscriptions/:id`, `DELETE /subscriptions/:id`                                                                                                   |
| `group-chat/group.controller.ts`              | `POST /groups/create-group`, `POST /groups/add-members`, `POST /groups/remove-members`, `PUT /groups/:groupId`, `PUT /groups/:groupId/upload-icon`                             |

Other routes have no explicit role requirement. This does **not** imply that every resource or operation is authorized: chat groups enforce membership and group administration also checks owner identity. Chat media modification checks sender ownership. `canModerate` denotes eligibility for the admin post/user/group management routes; it does not grant editing/deleting other people's chat messages.

`chats/chats.controller.ts` protects all routes with JWT, without RolesGuard: `POST /chats/messages`, `POST /chats/messages/:messageId/media/:mediaId/access-url`, `PATCH /chats/messages/:messageId/media/:mediaId/revoke`, `PATCH /chats/messages/:messageId/media/:mediaId/expiration`, `GET /chats/media`. Services enforce direct receiver existence, group membership, ownership, expiration and upload constraints. No per-contact blocking rule is present. The app additionally denies all capabilities for blocked, unverified, unknown-role, or unavailable-profile states.

## App capability table

Capabilities apply only to authenticated, verified, nonblocked accounts with recognized nonempty roles.

| Role    | App/feed | Send chat | Share media | Moderate / admin screens | Connection requests | Backend alignment / mismatch                                                                                  |
| ------- | -------- | --------- | ----------- | ------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| user    | Yes      | Yes       | Yes         | No                       | Yes                 | JWT chat/media; requests match desktop user gating                                                            |
| manager | Yes      | Yes       | Yes         | No                       | No                  | No special backend manager permission                                                                         |
| admin   | Yes      | Yes       | Yes         | Yes                      | No                  | Matches admin route requirement; app has no admin dashboard yet                                               |
| root    | Yes      | Yes       | Yes         | Yes                      | No                  | Matches guard override; online-admin gateway tracking checks admin explicitly and excludes root-only accounts |

For multiple roles, capabilities are ORed. Unknown or missing roles deny every capability, including an array containing both a recognized and unknown value. Desktop redirects using only roles[0]; the app avoids that ordering dependency. Desktop administrative layout itself has incomplete role gating; the app's guards fail closed.

## Files and extension points

- `src/features/auth/userModel.ts`: canonical backend `User`, public `UserSummary`, response validation, separate display helpers and legacy presentation adapter. `types.ts` exports canonical types and names the fixture/presentation shape `UserView`.
- `store/authStore.ts`: one authoritative Zustand store with currentUser, roles, status, tokenPresent, login/logout/refreshProfile; user is a synchronized derived presentation projection for existing screens. Profile edits trigger refresh rather than trusting mock updates.
- `permissions.ts`: single role→capability map; add a backend-confirmed role to ROLES and User roles, then explicitly define its capability row. Add a capability to the shared defaults and override confirmed roles; use `useCan` / `Can`, never inline role comparisons.
- `hooks/useCurrentUser.ts`: current user/id, roles, role/capability and account flag selectors. `hooks/useSession.ts` uses stable individual selectors.
- `userCache.ts`: allowlisted memory-only summaries keyed by `_id`, capped at 200; no credentials or full profiles cached. Cleared on teardown. `isUserBlocked(id)` returns **undefined (unsupported)**, not false: backend has no per-user block relation.
- `sessionRuntime.ts`, `hooks/useSocketSession.ts`: stable identity with userId, token getter, teardown subscription. Token changes never determine roles. Logout/account switch clears identity and notifies resource subscribers.
- `components/Access.tsx`, `app/account-state.tsx`, `app/not-allowed.tsx`: reusable ProtectedRoute, RequireRole, Can (hide or disable), blocked/unverified/expired/profile-error states.
- Root/app/tab layouts and index: account guards, capability-filtered tabs, denied-action banner, navigation reset on logout/account switch/role change. Existing social/profile/discover/activity screens hide user-only controls.
- Auth transport/API/lifecycle/profile hooks: canonical `/auth/me`, resume refresh, profile edit refresh, 401 expiry, 403 feedback plus one profile refresh without replay, forbidden GET retries disabled at query layer.
- `scripts/test-auth.cjs`: regression and Phase 1B behavior tests. Mock auth and fixture type imports adapted for the canonical model; real auth remains selected.

## Verification and remaining manual checks

Checks passed: `npm run typecheck`, `npm run lint` (zero warnings), and `npm run test:auth` (12 tests).

Automated tests cover four role capability rows, unknown/missing roles, canonical `_id`, role refresh and navigation revision, profile failure/recovery, memory cap/allowlist, sender identity mapping, blocked/unverified states, logout identity/cache/subscriber cleanup, and HTTP/envelope 403 with one profile fetch and no action retry. Existing secure-session tests remain included.

Live per-role login/navigation, desktop `_id` comparison, blocked/unverified test accounts, device rendering, and a role change made manually by the owner are **not yet verified**. No database was seeded or changed. Use existing accounts on a running backend; for each role check login → feed, tab/deep-link access, request controls and forced 403 feedback. Verify `_id` against desktop, change roles manually, call refreshProfile (or resume), and verify UI/navigation update. Test logout then another account to confirm no previous account summaries remain.

## Phase 2 readiness

- [x] Current identity is `/auth/me` `_id`; compare `senderId(message.sender)` with `useCurrentUserId()`.
- [x] Socket stub exposes userId/token getter/subscription, with no socket implementation.
- [x] Use canSendMessages, canShareMedia, canModerate; still handle server membership/ownership denials.
- [x] Populate memory summaries from confirmed public response fields; teardown clears cache.
- [x] 403 and role changes have centralized behavior; no denied action replay.
- [ ] Per-contact blocking needs a backend contract before conversation hiding/send blocking can be implemented.
- [ ] Complete live account/device checks above before claiming end-to-end parity.
- [ ] Phase 2 requires owner approval; no chat or media transport added in this phase.
