# Phase 1: mobile login and security

Only the Expo app was edited. Backend, desktop frontend, database, runtime scripts and their configuration were read only. Chat and image sharing remain mock services.

## Reference contract and comparison

Canonical sources are the `darkfantasy-runtime/backend` and `frontend` junctions, identified by the runtime README. Backend base URL is `http://localhost:9000/api` for local development.

`POST /auth/login` accepts JSON `{ username, password }`; `username` is an email. Desktop also sends `role: null` from its form; the backend DTO does not consume it. Successful response: `{ data: { user, accessToken }, statusCode: 201, message, error: false }`. `GET /auth/me` accepts `Authorization: Bearer <accessToken>` and returns the user in `data`. The backend can encode 400/401 errors inside an HTTP 200/201 response, so the client checks both HTTP and envelope status.

| Control       | Existing web app                                                   | Mobile implementation                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token storage | JWT and user JSON in localStorage                                  | Only JWT persisted, through SecureStore; user held in memory. iOS WHEN_UNLOCKED_THIS_DEVICE_ONLY. Android backup disabled and SecureStore backup exclusions enabled.                                                  |
| Transport     | JSON login; Bearer header; current local runtime uses HTTP         | Same contract; API origin restriction, 15-second timeout, release HTTPS check, Android cleartext policy and iOS ATS. Optional public-key pinning.                                                                     |
| Expiry        | JWT exp check and expiry timer; auth guard calls /auth/me          | /auth/me on startup/resume; early logout 30 seconds before exp; malformed/expired tokens rejected locally. Decoding never grants access.                                                                              |
| Logout        | Clears browser user/token and Axios header; no backend logout      | Clears SecureStore/current and legacy keys, token, user, queries, outbox, toast, protected navigation history; aborts API requests and invokes registered socket/resource teardown. No server revocation exists.      |
| Errors        | Backend account-existence/verification/blocking messages displayed | Generic credential errors across nonexistent/wrong/unverified/blocked accounts; separate network/session errors. Wrong-password server bug prevents reliably distinguishing credential failures from server failures. |
| Logging       | No central redaction layer found in inspected auth code            | Fixed allowlisted debug event names only; release logging disabled; no auth request/response/error objects logged, no clipboard monitoring or crash SDK.                                                              |

Backend user `_id` is the app's `id`; `username` maps to email, `displayname` to name (first/last name fallback), `avatar` to avatarUri, and backend spelling `intrests` to interests. Optional absent display fields use empty values (age defaults to 0). The app never creates an account locally. JWT `sub`, login user `_id`, and /auth/me `_id` must agree; the profile response establishes identity. Backend lookup is case sensitive, so email is trimmed but not lowercased; password is unchanged.

## Implemented flow and controls

1. Native password entry is uncontrolled; a transient ref is cleared on submit, background and unmount. No password is put in React/Zustand state or persistent storage. Temporary request references are released; JS strings cannot be securely zeroed and the OS/password manager controls its own memory.
2. A synchronous module-level submission lock prevents duplicate requests. After three failures, cooldown grows from 5 seconds to 300 seconds; a 429 produces a 60-second delay. This is UX protection, not server rate limiting.
3. Login does not attach any old token and is never automatically retried. Only GETs retry once after 400 ms for network/502/503/504 errors. Cancellation and 401/403 do not retry.
4. Login fetches /auth/me using the newly issued header token before committing the session. SecureStore contains only the token; runtime auth has no persistence middleware. Startup and resume are the only reads of stored credentials.
5. Startup/resume hides protected navigation until /auth/me succeeds. Validation network failures fail closed and clear the local session; offline authenticated mode is not enabled. HTTP or envelope 401/403 clears the session. Background expiry is checked again on resume.
6. Logout clears runtime data first, aborts requests, resets navigation and queues secure deletion after any pending write. Generation guards prevent a pending login/old validation from restoring a logged-out account. Keychain deletion failures propagate to the caller; device verification must include storage failure handling.
7. Password-manager props, secure text entry, disabled autocorrect/capitalization and no demo credentials. Signup/invite/password-reset routes return to login because those flows are outside Phase 1; the login screen directs users to the desktop website. Existing unused scaffold screens remain in source.
8. Native app-switcher privacy on iOS; Android FLAG_SECURE via Expo screen capture protection (also blocks screenshots throughout the app); login capture prevention plus an opaque JS background overlay. Platform behavior requires native device verification.
9. Deep links allow only a short list of internal routes, strip all query/fragment parameters, and reject external URLs, malformed/control-character paths and unrecognized destinations. No arbitrary returnTo is honored.
10. `getSocketHandshakeAuth()` supplies `{ token }` for Phase 2 handshake auth; sockets must register their disconnect handler with `registerSessionTeardown`. No socket has been added in Phase 1.

## Release configuration and optional features

Set `EXPO_PUBLIC_API_URL` to the real **HTTPS** API base, including `/api`, in the EAS build environment. No production host was supplied, so release config deliberately fails with the current local HTTP URL. Use the mobile launcher (`npm start`) for local development; `.env.mobile` defaults to `http://localhost:9000/api`. Android emulator uses `http://10.0.2.2:9000/api`; a physical device needs the computer's reachable LAN address. Do not expose backend secrets through any EXPO_PUBLIC variable.

Only an explicit development config permits cleartext; EAS apk/preview/production and NODE_ENV=production enforce HTTPS. Android release R8 minification/resource shrinking is enabled by expo-build-properties; Expo release exports minify JS. Obfuscation cannot protect embedded secrets; none were added. Rebuild native binaries after installing these dependencies or changing native settings. Pinning does not work in Expo Go; it fails closed if explicitly enabled in a release without its native module.

Optional controls:

- Background idle timeout: implemented, off by default. Set `EXPO_PUBLIC_AUTH_BACKGROUND_TIMEOUT_MINUTES` to a positive number to force full login after that long in background.
- Certificate pinning: implemented but disabled (`EXPO_PUBLIC_SSL_PINNING_ENABLED=false`) because no production hostname/pins were provided. Set true and supply `EXPO_PUBLIC_SSL_PINS` as comma-separated base64 SHA-256 SPKI hashes. Build checks require two distinct valid hashes. Initialize before any API request; scope to the exact API hostname; never enable for dev. Rotate by shipping old/current plus new/backup hashes first, wait for app adoption, rotate the server certificate/key, then remove the retired hash in a later release. Do not use an expiration that silently disables enforcement. Emergency disable requires a new trusted build/update with the flag false. Test old/new/wrong-pin behavior on both platforms before rollout.
- Biometrics: skipped; optional and no user enrollment/fallback UX was requested. Password login remains the fallback. Adding this later requires native availability/enrollment checks and local gating before SecureStore reads, while retaining /auth/me validation.
- Root/jailbreak warning: skipped; optional, with no requested warning UX. No hard blocking was added.

Dependencies added:

| Package                                           | Purpose                                                  |
| ------------------------------------------------- | -------------------------------------------------------- |
| expo-screen-capture (~57.0.0; resolved 57.0.4)    | Login capture blocking and native app-switcher privacy   |
| expo-build-properties (~57.0.0; resolved 57.0.22) | Native transport policy and Android release minification |
| jwt-decode (^4.0.0)                               | Decode exp/sub only, not verify or authorize JWTs        |
| react-native-ssl-public-key-pinning (^1.2.6)      | Optional native SPKI pinning using OkHttp/TrustKit       |

Existing expo-secure-store and Axios were reused. No networking/storage replacement or backend dependency was added. Dependency install reported 29 audit findings (11 moderate/18 high) across the app dependency tree; no automatic breaking upgrades were applied.

References: [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/), [Expo screen capture](https://docs.expo.dev/versions/latest/sdk/screen-capture/), [Expo build properties](https://docs.expo.dev/versions/latest/sdk/build-properties/), [pinning library](https://github.com/frw/react-native-ssl-public-key-pinning).

## Backend-only gaps (no changes made)

| Gap                                         | Suggested backend work                                                                                                                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Password change does not revoke signed JWTs | Check a per-user session/token version or password-changed timestamp on authenticated requests; bump it on password change/reset.                                                                                                                              |
| No logout/logout-all revocation             | Add server session tracking/revocation and explicit logout endpoints. Local logout cannot revoke copied JWTs.                                                                                                                                                  |
| No refresh tokens                           | Add short-lived access tokens and securely stored, revocable refresh sessions if seamless renewal is required. Mobile currently requires re-login.                                                                                                             |
| No token rotation                           | Rotate refresh tokens on use with reuse detection and session invalidation; define an exact client contract first.                                                                                                                                             |
| Rate limiting/lockout is incomplete         | Enforce account/IP/device limits server-side. Current failed-attempt branch is unreachable because validateUser throws; its null-user branch also dereferences user. Fix independently in backend.                                                             |
| Wrong password is a 500                     | Return a consistent authentication status and generic message for all credential failures, preferably 401. Frontend cannot safely distinguish the current 500 from a real outage.                                                                              |
| User enumeration                            | Unify nonexistent, unverified, blocked and wrong-password responses and timing server-side. Mobile hides the details but cannot protect direct API callers.                                                                                                    |
| Account status enforcement                  | /auth/me checks isBlocked; JWT guard only checks signature/expiry and does not look up current user status. Enforce account eligibility/revocation consistently in guards.                                                                                     |
| HTTPS deployment                            | Current backend runtime is HTTP. Provide a trusted HTTPS endpoint/reverse proxy before releasing; mobile cannot provision backend TLS under the read-only rule.                                                                                                |
| Sensitive backend logs/fields               | Token creation logs the backend user object; /auth/me/login may return password-reset/verification fields. Remove sensitive logs and whitelist returned user fields server-side. Mobile maps only required display fields and does not persist full responses. |

## Verification

Automated: `npm run test:auth` exercises real app service/store/interceptors with in-memory SecureStore and a mocked HTTP adapter (no native device or live backend). Checks exact request body/password preservation, /auth/me identity, Keychain accessibility option, token-only secure writes, restart hydration, full logout/callback cleanup, late-login suppression, synchronous duplicate guard, HTTP and envelope 401/403, expired token, third-party URL rejection, one GET retry/no login retry, generic credential errors and sanitized links. The release configuration test confirms HTTP/missing URL rejection, HTTPS acceptance, cleartext policy, backup/minification settings and pin validation. No auth output was logged in those tests. Source review found no AsyncStorage/localStorage/sessionStorage use in active mobile auth, and no credential/response logging.

Verification results: all 8 automated auth tests passed, TypeScript passed, ESLint passed, and `git diff --check` passed. Expo's resolved release configuration confirms Android backup and cleartext are disabled, iOS arbitrary loads/local networking are disabled, and Android minification/resource shrinking are enabled. `localhost:9000/api` was unavailable during this session; no real desktop account login or live desktop ID comparison was possible. I did not start or change the backend. Native Keychain/Keystore, ATS/Android packet behavior, redirects, pinning, autofill and screenshot enforcement are not verified by the JS harness.

Manual checklist before release:

- Start the existing runtime yourself; configure the correct reachable dev API URL, then sign in with an existing desktop account. Compare mobile `user.id` with desktop `_id` without logging JWTs.
- Cold restart and background/resume: observe /auth/me, matching user ID and refreshed profile. Change the backend profile and confirm mobile fetches it.
- Logout: use Back/deep links/restart; confirm no old profile, toast, outbox, query data or token remains. Inspect the native secure store only with appropriate test tooling. Test secure-deletion failure recovery on a test device.
- Wrong/nonexistent/unverified/blocked accounts: confirm the same generic login text and growing cooldown; distinguish offline behavior. Double tap and keyboard submit must send one login POST.
- Expiry: use an already expired issued test JWT or a short-lived test session supplied externally; confirm early sign-out and no automatic login replay. Do not change backend config as part of this app task.
- Inspect sanitized test-device logs, crash tooling and app storage: no password/JWT/header/full responses; no token in preferences or ordinary files. Avoid recording sensitive network traffic.
- Build a native release with an HTTPS URL; inspect generated Android manifest and iOS ATS and test an HTTP request is blocked. Also test cross-origin HTTP redirects do not forward Authorization on each supported native platform; the JS origin guard covers initial requests, while native redirect handling requires device verification.
- Verify login screenshot blocking, switcher privacy, Face ID not requested, password-manager autofill, optional idle timeout, and old/new/incorrect certificate pins on physical Android/iOS. Do not claim Expo Go results prove release behavior.
- Check minified release artifacts and resolve dependency audit findings according to project policy before distribution.

## Files and later phases

Changed: `.env.mobile` (ignored local dev URL), `.env.mobile.example`, `.gitignore`, `eas.json` (pre-existing untracked file extended), `package.json`, `package-lock.json`, `scripts/expo.mjs`, `app/_layout.tsx`, `app/(auth)/register.tsx`, `forgot-password.tsx`, `invite-code.tsx`, `src/config/env.ts`, `src/components/ui/PasswordInput.tsx`, `src/features/auth/components/LoginForm.tsx`, `hooks/useLogin.ts`, `schemas/authSchemas.ts`, `screens/LoginScreen.tsx`, `services/index.ts`, `store/authStore.ts`, `types.ts`, `src/services/api/apiClient.ts`, `src/services/storage/secureStorage.ts`, `src/utils/logger.ts`.

Created: `app.config.js`, `app/+native-intent.tsx`, `scripts/auth-build-config.cjs`, `scripts/test-auth.cjs`, `src/features/auth/session.ts`, `sessionRuntime.ts`, `hooks/useSessionLifecycle.ts`, `services/authService.real.ts`, `src/services/api/pinning.ts`, this report. Existing `assets/images/demo/` changes were left untouched.

Phase 2 proposal: inspect exact Socket.IO handshake/authorization and event payloads for setUserRoom, sendMessage, getChatHistory, markAsRead, typing and group events; replace only the relevant mock services, use backend user/conversation IDs, register disconnect on logout and test desktop/mobile delivery and permission isolation. Do not assume auth field names beyond the existing gateway contract.

Phase 3 proposal: adapt to existing POST /chats/messages multipart `media` uploads and existing access-url/revoke/expiration endpoints; inspect upload DTOs, attachment limits and storage responses first; request short-lived media URLs only for authorized messages, then test expiry/revocation and cross-device visibility. Neither phase is implemented.
