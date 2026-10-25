# Social UI refresh

Feed, profile, and create-post screens share post components, circular avatars, pink actions, and existing theme tokens. Feed and vertical post views use a windowed FlatList; at 60% visibility only one video mounts its player. Leaving the viewport, navigating away, backgrounding the app, or opening a post sheet unmounts the player through expo-video's managed lifecycle.

PostCard displays every media item in a horizontally paged carousel with a shared crop, page count, and pink dots. Single-item posts have no carousel controls. Profile grids show a stacked-photo badge for carousels and open the same vertical post view. The composer accepts up to five photos (the existing backend limit) or one video, validates videos at 60 seconds / 50 MB, generates a thumbnail, and provides two steps with a swipeable preview. Numbered selection thumbnails support removing and moving photos earlier before publishing. Photos upload in order, with progress aggregated across the whole post. Existing publishing, moderation, audience, premium access, optimistic likes, comments, reporting, blocking, profile editing, and following remain connected. Backend models are unchanged.

## Preview

In a development session, open **Settings → Social UI preview** (`/ui-preview`). It contains mixed image/video posts, stories, profile/saved grids, expandable captions, comment replies, likes, empty comments, an empty feed, and simulated upload progress. Mock post interactions do not publish data. The production feed continues to show backend results and genuine loading, error, and empty states.

## UI-only state

- Likes people, comment hearts, and nested reply examples use mock/local state because the current presentation models have no APIs for these interactions. Reply on a real comment prefills a mention and uses the existing comment API.
- Saved posts are held for the current signed-in session and cleared on session teardown. The Saved screen and profile tab share that state.
- Location and the chosen crop ratio are presentation metadata for this session; backend models and payloads are unchanged. Persisting these details across restarts requires a later API extension. Video thumbnails are cached when selected or when a video is first activated; a play placeholder is used until a thumbnail is available. Grids never mount video players.
- Unknown profile statistics display an em dash. Your own follower/following counts use the existing endpoints.
- Upload progress in the actual composer uses the existing real upload/moderation service via `uploadPostMedia`. `simulateMediaUpload` is an independent adapter used by the UI preview.

The optional recent-media gallery requests photo/video access only when **Show recent media** is tapped. Native permission configuration now includes those types and camera recording audio. Existing installed development builds need rebuilding to pick up permission changes and the new `expo-video-thumbnails` module. The system picker remains available if gallery access is declined. Web uses the system file chooser and a browser thumbnail adapter.

## Validation

`npm run typecheck`, `npm run lint`, `npm run test:premium`, and `node --test scripts/test-image-layout.cjs scripts/test-single-media.cjs`.

The existing build configuration requires `APP_VARIANT=development` for local cleartext development. `npm start` sets this through the project launcher. In PowerShell, direct Expo startup is:

```powershell
$env:APP_VARIANT = 'development'
npx expo start
```

Metro startup and an Android JavaScript bundle were verified. Native gestures, camera permissions, haptics, keyboard behavior, and playback require a device check; this session had no connected browser or emulator surface for visual verification.

## Likes, chat, and media fixes

Like mutations now return the authoritative liked state and count, including idempotent requests. The client also accepts the legacy response shape and cancels stale post reads before optimistic updates. Profile post responses include the current viewer's liked state.

Initial chat history can load through an authenticated HTTP endpoint using the existing conversation visibility rules. Local development uses this endpoint without waiting for the socket handshake. The local proxy connects over IPv4, and the backend development origin list includes Expo on port 8081. Realtime delivery continues to use the existing socket connection.

Chat has softer message bubbles, a rounded composer, compact attachment cards, clearer view-once states, and a simplified photo sharing sheet. **Settings > Social UI preview > Chat** provides a local demonstration without sending messages. View-once consumption, expiration, and media access checks remain in place.

Text-only posts no longer display an empty media panel. Failed media can refresh its signed URL. Read-only storage checks found four legacy post photos whose upload records and original objects are missing; those photos require reuploading. They are not replaced with mock photos.

Validation for these fixes: frontend typecheck and scoped ESLint; 84 authentication/chat/feed regression tests; 12 media/layout/premium/proxy tests; 24 backend controller/premium tests; and a successful backend build. Native interaction and visual checks still require a device.

The web bundle also builds after adding SQLite's WASM asset extension to Metro. Browser runtime behavior is unverified; SQLite on web additionally requires cross-origin isolation headers as described in the [Expo SQLite web setup](https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup).

Event list and detail screens share a cover component with a loading indicator, explicit missing/unavailable states, and a retry that refetches the event before reloading its image. Read-only checks found two events: one has no cover, and the other's legacy cover has neither an upload record nor an original object in storage. Restoring that cover requires uploading a replacement through Edit event.
