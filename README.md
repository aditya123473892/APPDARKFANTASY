# DARKFANTASY Mobile

An Expo Router mobile app connected to the Dark Fantasy backend. Active authentication, profiles, feeds, follow requests, direct chats, and groups use backend data only. See [REAL_DATA_INTEGRATION.md](REAL_DATA_INTEGRATION.md) for current endpoints, validation, and limitations. The older scaffold notes below describe unused fixture services and are superseded by that integration report.

## Stack

- Expo SDK 57 managed workflow, React Native 0.86, TypeScript strict mode
- Expo Router route groups, Reanimated, Gesture Handler, Expo Image
- Zustand for client/auth state and TanStack Query ready for future server state
- React Hook Form + Zod, SecureStore for session tokens
- ESLint flat config, Prettier, and `@/*` → `src/*` path aliases

## Setup

Requirements: Node.js 22.13 or newer, npm, and the current Expo Go app or an Android/iOS development build.

```bash
npm install
cp .env.mobile.example .env.mobile
npm run typecheck
npm run lint
npm start
```

Press `a` for Android, `i` for an iOS simulator on macOS, or scan the QR code in Expo Go. The Android emulator/device should use `10.0.2.2` instead of `localhost` when the real backend is eventually connected.

### Expo Go on a physical phone

Set `EXPO_PUBLIC_API_URL` in `.env.mobile` to `http://<PC-Wi-Fi-IP>:9000/api`.
`localhost` points to the phone itself; `10.0.2.2` is for the Android emulator only.
Keep the PC and phone on the same Wi-Fi, then restart Metro with
`npm start -- --clear --lan` after changing the environment file.
Check `http://<PC-Wi-Fi-IP>:9000/api` in the phone browser before trying login.
If it times out, check Windows Firewall for the exact Node executable running the
backend and check for guest-network isolation or a VPN. The portable Node runtime
and system Node executable require separate firewall allowances. Update the URL
if the PC's Wi-Fi address changes. Release builds still require HTTPS.

Mock login accepts the prefilled credentials. To test a generic auth failure, use `error@example.com` or password `wrongpass`. The mock invitation code is `NIGHT42`.

## Structure

```text
app/                         thin Expo Router route files and layouts
  (auth)/                    welcome, login, registration, reset, invite
  (app)/(tabs)/              home, discover, chats (Messages), activity (notifications + requests), profile
  (app)/create              post composer, presented as a modal from Home and Profile
  (app)/chat|profile|settings
src/
  features/                  feature-owned UI, hooks, schemas, stores, services
  components/ui|layout|feedback
  theme/                     all shared color, type, spacing, radius, shadow tokens
  services/api|storage       dormant Axios scaffold and SecureStore wrapper
  mocks/                     typed fixtures + db.ts, the in-memory mock backend behind every *.mock service
  config/                    typed env access and feature flags
  hooks/ utils/ types/
assets/                      placeholder artwork and future licensed fonts
```

## Auth architecture

Screens never depend on a concrete auth transport. `AuthService` defines the contract, `authService.mock.ts` supplies this build, and `features/auth/services/index.ts` is the single implementation swap point. Zustand owns only runtime auth state; the serialized session is written exclusively through the SecureStore wrapper. The root layout hydrates it before rendering protected navigation.

### Switch to invite-only

Set this public, non-secret value in `.env.mobile` and restart Expo with cache clearing:

```dotenv
EXPO_PUBLIC_AUTH_MODE=invite_only
```

```bash
npm start -- --clear
```

The Welcome screen automatically uses the enabled `invite_code` strategy and opens the already-built invite route/form. The email/password form, store, and service contract do not change. For a compile-time-only setup, change `AUTH_MODE` at the source in `src/config/featureFlags.ts`.

## Data, requests, and chat architecture

Every feature follows the auth pattern: a `Service` interface, a `*.mock.ts` implementation, and a single swap point in `services/index.ts` (`chat`, `requests`, `feed`, `activity`, `profile`). Screens only use TanStack Query hooks from each feature's `hooks/` folder. All mock services share `src/mocks/db.ts`, an in-memory backend that applies server-style rules: messages are scoped to their conversation, request state changes are validated, and sends are idempotent per `clientId`. Its state resets when the app reloads.

- **Requests** live in the Activity tab (Notifications | Requests). There is no separate match page. Accepting a request creates the conversation, and the confirmation toast links straight to it. Sending a request to someone who has already requested you connects you both immediately.
- **Chat**: `/chat/[id]` always loads by conversation ID. An unknown ID shows "Conversation not found" and never falls back to someone else's conversation. Unsent messages sit in a per-conversation outbox (`features/chat/store/outboxStore.ts`) as _sending_ or _failed_ until the server confirms them, so refetches never drop them. Failed messages can be retried or deleted. The mock confirms a send as **sent** only; _delivered_ and _read_ must come from the real backend.
- **Privacy** preferences (distance, active status, read receipts) are stored on the device. Active status and read receipts are reciprocal.
- Logging out clears the query cache and the outbox, so the next account starts clean.

Mock test hooks: in a dev build, **Settings → Developer → Simulate offline** makes every mock request fail with a network error. Sending the chat message `/fail` makes that one send fail, which shows the retry UI.

Backend work required for production chat: a realtime transport (WebSocket/SSE) for incoming messages and delivery/read receipts (the app polls the open conversation every 15 s as a fallback), push notifications, server-enforced privacy settings, and blocking/reporting endpoints.

## Connect the real backend later

1. Create `src/features/auth/services/authService.real.ts` implementing every `AuthService` method. Map backend errors into the existing `AuthErrorCode` union.
2. In `src/features/auth/services/index.ts`, replace `mockAuthService` with the real implementation. This is the only auth implementation swap.
3. Set `EXPO_PUBLIC_API_URL` locally. Never store secrets in an `EXPO_PUBLIC_*` variable.
4. Use `services/api/apiClient.ts` from feature service modules. Its request interceptor attaches the in-memory access token; its 401 handler performs one shared refresh and retries queued requests.
5. Replace fixtures feature by feature with TanStack Query hooks. Keep transport and response mapping in feature services, not screens.
6. Confirm the backend's token rotation, expiry, revoke/logout, rate limits, and generic auth error behavior. Keep tokens in SecureStore only.
7. Add contract tests, error monitoring with sensitive-field scrubbing, and dev/release build smoke tests before launch.

## Security notes and current limitations

- This is a UI scaffold, not a production authentication system. Mock tokens are intentionally fake and never leave the device.
- Not implemented (need backend work): social login, push notifications, image upload for posts and profile photos, blocking/reporting, location, realtime message delivery, and self-serve account deletion (the app opens a support email instead).
- SecureStore protects persisted session material, but the final backend must enforce authorization, expiry, rotation, revocation, and abuse controls.
- Profile artwork is original geometric placeholder SVG/data-URI content; replace it only with properly licensed assets.
- iOS requires macOS/Xcode for simulator or local native builds.
