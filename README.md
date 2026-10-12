# DARKFANTASY Mobile

A production-oriented Expo Router UI scaffold for a dating-style mobile app. It is frontend-only: all profiles, matches, conversations, and authentication responses are typed local fixtures. There are no live API calls or third-party runtime services.

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

Mock login accepts the prefilled credentials. To test a generic auth failure, use `error@example.com` or password `wrongpass`. The mock invitation code is `NIGHT42`.

## Structure

```text
app/                         thin Expo Router route files and layouts
  (auth)/                    welcome, login, registration, reset, invite
  (app)/(tabs)/              home, discover, create, activity, profile, chats
  (app)/chat|profile|settings
src/
  features/                  feature-owned UI, hooks, schemas, stores, services
  components/ui|layout|feedback
  theme/                     all shared color, type, spacing, radius, shadow tokens
  services/api|storage       dormant Axios scaffold and SecureStore wrapper
  mocks/                     typed local fixtures and bundled data-URI artwork
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
- Social login, push notifications, image uploads, moderation/reporting, location, realtime messaging, and account deletion are visual placeholders.
- SecureStore protects persisted session material, but the final backend must enforce authorization, expiry, rotation, revocation, and abuse controls.
- Profile artwork is original geometric placeholder SVG/data-URI content; replace it only with properly licensed assets.
- iOS requires macOS/Xcode for simulator or local native builds.
