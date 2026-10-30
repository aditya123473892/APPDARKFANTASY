# Current feature audit — 30 October 2026

## Assessment

The app has substantial automated coverage, but it is not ready for an unrestricted production launch. The highest remaining priorities are event authorization, truthful email verification, session revocation, dependency remediation, and account-deletion coverage. This report distinguishes observed code defects from deployment prerequisites and product limitations.

Reviewed the mobile app and canonical `dfbackend/` repository, including current uncommitted authentication, development launcher, proxy and AI-client changes. Starting branches were `test26102025`; the delivery branch is `2026-10-30` in both repositories. The backend is a Git submodule, not source embedded in the mobile repository.

## Findings and improvements

| ID | Priority | Area | What can break | Recommended change | Status |
| --- | --- | --- | --- | --- | --- |
| F01 | High | Password login | Real database password lookup omits `isEmailVerified`, so the newly added password-login endpoint treated valid verified accounts as unverified. The mock returned more fields than the real query. | Read the account after password validation and test using the same projection as production. | Fixed in this branch; 32 OTP/auth regression tests pass with the corrected mock. |
| F02 | High | Signup/email | With SES configured, signup tells the user to verify email, but the email is an admin-review notification with no verification link or code. Self-service signup can leave users unable to log in. | Decide explicitly between admin approval and ownership verification. For ownership, issue an expiring single-use token, deliver a working link/code, provide resend, and test the complete flow. | Open. |
| F03 | High | Signup configuration | Missing SES settings mark email as verified; this fallback is not restricted to development. A partially configured production backend can claim ownership it has not verified. | Restrict mocks to explicit development/test mode, fail production startup for missing required delivery settings, and keep admin approval separate from email ownership. | Open. |
| F04 | High | Events | Join accepts caller-supplied `user` and `requestStatus`. A signed-in client can request membership for another user or supply an accepted state. The approval path's owner check does not protect join. | Derive the member from the authenticated actor, force initial status to pending, and add HTTP tests that prove forged identity/status cannot create records. | Open; verified in the active registered controller and service. |
| F05 | High | Session security | Logout clears the device session but does not revoke its JWT. Password change/reset does not advance a token version or revoke existing tokens. A copied token can continue working until expiry. | Add server-side session records or a per-user token epoch; invalidate on reset/change and offer revoke-all-devices. Check it for REST and Socket.IO. | Open. |
| F06 | High | Account deletion | Account purge deletes many social/media collections but does not delete or anonymize `GodChatSessions`. Support conversations and summaries can remain after account removal. | Include AI/support sessions in a documented retention/preservation policy and test deletion and held-data behavior. | Open. |
| F07 | High, conditional | Database deployment | Mongoose uses `autoIndex: false`. Phone uniqueness and throttle TTL rely on an operator-run migration. Without the unique phone index, concurrent signup/link operations can assign one phone to multiple users despite preflight checks. | Version migrations, verify required indexes at startup/deploy, and refuse affected writes if the uniqueness invariant is absent. | Open deployment prerequisite; production index presence was not inspected. |
| F08 | High triage | Dependencies | Registry scan reports mobile: 4 high, 5 low; backend: 3 critical, 52 high, 15 moderate. Examples include Handlebars, proxy-addr, tar, Sharp and Zod dependency paths. | Triage reachable code paths, remove unused mail/template dependencies, update compatible patched packages, then plan framework upgrades with regression tests. Do not use `npm audit fix --force` blindly. | Open. Package-level details and advisory URLs are in the companion JSON report. |
| F09 | Medium | Password recovery | Reset DTO accepts any nonempty password rather than the signup policy. Tokens encode `email_expiry` and parsing splits on `_`, which breaks valid email addresses containing underscores. | Use structured signed/scoped claims or hashed random reset tokens and a shared password validator. Add underscore-email and weak-password tests. | Open. |
| F10 | Medium | People search | The mobile service escapes regex characters before sending a search string; the backend escapes again. Names containing punctuation such as `.` or `+` can fail to match. | Send plain text, escape only on the server, and update contract tests that currently expect client escaping. | Open. |
| F11 | Medium | AI support chat | Long sessions can trigger a summary request followed by an answer request. Each provider call may take 120 seconds, while mobile/proxy wait only 135 seconds. A valid long reply can time out, leaving the member unsure whether it was saved. | Use a background job/polling or streaming design, or a single overall deadline with smaller per-call budgets. Keep retry IDs stable and expose stored/pending/failed state. | Open; conditional on a slow provider and summary generation. |
| F12 | Medium | Chat/reconnect/scale | Reconnect serially replays known histories before marking chat ready. Many slow histories delay chat. Gateway presence and broadcast state are process-local; no shared adapter is configured in the reviewed gateway. | Load the visible conversation first, bound/deduplicate resync, measure reconnect latency, and add a shared Socket.IO adapter and distributed presence before multiple instances. | Open scaling risk. |
| F13 | Medium | Premium | Entitlement status returns `providerAvailable: false`; the verifier intentionally throws unavailable. Payment UI or premium expectations cannot be backed by verified purchase activation yet. | Keep purchase actions disabled until signed provider events, user/product binding, replay protection, restore and cancellation reconciliation exist. | Product limitation, not a claim of an exposed payment endpoint. |
| F14 | Medium | Phone/release runtime | LAN development depends on a changing Wi-Fi address and a live Metro/backend terminal. Release needs a reachable HTTPS API. Current release configuration exposes Android only; Expo Go success does not validate a native release or iOS build. | Use a stable hosted API, CI release-config validation, health checks, physical-device tests and an explicit supported-platform plan. Make the Windows launcher work with Ethernet and localized interface names as well as `Wi-Fi`. | Open operational improvement. |
| F15 | Medium | Session continuity | `refreshSession()` always throws expired. When the access token expires, the user must sign in again; long/background sessions cannot recover silently. | Add rotating refresh sessions with revocation, or explicitly design and communicate short-lived login sessions. Test expiry during uploads and chat sends. | Current limitation. |
| F16 | Medium | Vault/media | Local vault files are app-private but not encrypted with a separate vault content key by the current file access path. Cloud sync depends on S3, moderation, network availability, and foreground/unlocked lifecycle. Passing mocked tests does not prove recovery on real phones. | Define the device threat model, consider envelope encryption if required, and test low disk, interrupted video upload, background cancellation, restore and reinstall on native devices. | Hardening/verification gap; no claim that another ordinary app can read the sandbox. |

## Evidence pointers

Paths below are relative to the mobile checkout; line numbers are at this audit's working tree.

- F01: `dfbackend/src/users/users.service.ts:339` (projected password query), `dfbackend/src/auth/otp/otp.service.ts:121` (corrected login), `dfbackend/src/auth/otp/otp.spec.ts:62` (projected mock).
- F02–F03: `dfbackend/src/auth/otp/otp.service.ts:103`, `dfbackend/src/mail/mail.service.ts:75`, `dfbackend/src/common/templates/verify-account.email.hbs:40`, `dfbackend/src/security-environment.ts:3`. Production validation checks secrets, not SES completeness.
- F04: `dfbackend/src/event-members/event-members.controller.ts:45`, `dfbackend/src/event-members/event-members.service.ts:22`, `dfbackend/src/event-members/dto/create-event-member.dto.ts:5`.
- F05/F15: `src/features/auth/services/authService.real.ts:82`, `dfbackend/src/users/users.service.ts:345`, `dfbackend/src/common/guards/jwt.strategy.ts:25`, `dfbackend/src/auth/auth.service.ts:38`.
- F06: `dfbackend/src/photos/photos.service.ts:890` through the end of account purge; `dfbackend/src/god-chat/god-chat-sessions.service.ts:90` owns the separate support-session collection.
- F07: `dfbackend/src/app.module.ts:49`, `dfbackend/src/auth/otp/otp-indexes.ts:25`.
- F08: [Sanitized registry scan](DEPENDENCY_AUDIT_2026-10-30.json). Counts are npm's affected-package counts, including transitive/meta findings, not distinct proven exploits. Some packages are tooling or install-time dependencies. npm's suggested Expo downgrade is not a compatibility recommendation.
- F09: `dfbackend/src/auth/dtos/reset-password.dto.ts:4`, `dfbackend/src/auth/auth.controller.ts:234` and `:275`.
- F10: `src/features/profile/services/profileService.real.ts:44`, `dfbackend/src/users/users.service.ts:52`.
- F11: `dfbackend/src/god-chat/god-chat.service.ts:225` and `:250`, `dfbackend/src/god-chat/llm.client.ts:37`, `src/features/god-chat/godChatService.ts:84`, `scripts/dev-api-proxy.cjs:27`.
- F12: `src/features/chat/services/socketSession.ts:180`, `dfbackend/src/chats/chats.gateway.ts:46`.
- F13: `dfbackend/src/entitlements/entitlements.module.ts:19` and `:34`.
- F14: `scripts/run-frontend.ps1:2`, `src/config/env.ts:10`, `app.config.js:13`, `eas.json`.
- F16: `src/features/vault/media.ts`, `src/features/vault/vaultService.ts`, `src/features/vault/sync.ts`.

## Verification performed

- Mobile TypeScript: passed.
- Mobile ESLint (`app src`): passed.
- Mobile auth/network/premium/feed-image/vault tests: **126 passed, 0 failed**.
- Backend Jest default suite: **42 suites passed, 6 skipped; 319 tests passed, 179 skipped**. The default suite does not run `test/integration` with its separate configuration.
- Corrected password projection regression: **32 auth tests passed** using the production-shaped mock. PowerShell's stderr redirection reported a nonzero shell status for the saved run because Jest emits progress/warnings on stderr; the Jest summary itself reports all tests passing.
- Backend TypeScript compilation checked separately from Jest, whose isolated transpilation does not enforce all type errors.
- `npm audit --omit=dev --json` for both lockfile trees; findings summarized above. No dependency upgrades were applied by this audit.
- Checked tracked filenames and high-confidence credential patterns before staging; environment secrets and runtime logs are excluded. This is not a full historical secret scan.

No production penetration test, native APK/iOS build, real phone interaction test, SMS delivery, SES delivery, payment, live AI call, cloud IAM test, or destructive account-deletion test was performed. No user content or production data was created to reproduce findings. Earlier local audit artifacts were used as leads; the findings above were checked against current source rather than assumed from their old status.

## Delivery and next steps

This branch includes the existing signup/password/OTP work, runtime/proxy improvements and AI transport changes, this audit, and the narrow F01 correction. It does **not** claim to fix the remaining findings. A `.gitmodules` entry was added for the already tracked backend gitlink so a fresh checkout can initialize it; runtime logs, PIDs and the obsolete local QR artifact are ignored.

Recommended order: fix F04 and F02–F03; implement F05 and F06; verify F07 and triage F08 before exposing production; then address recovery/search/AI timing and device-release coverage. Keep broad dependency and authorization changes in focused reviewed commits with regression tests.
