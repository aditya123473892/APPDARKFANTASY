# Dark UI pass

The existing Expo Router folders, shared theme, service layer, and authentication gates are retained.

## Navigation

- Exactly four bottom tabs, ordered Home, Events, Chat with God, Messages.
- A 64dp bar plus the system bottom inset, consistent 24dp outline icons, 12dp labels, and an unread badge on Messages only.
- Profile, Discover, and Activity moved from the tab group into the authenticated stack. Their public URLs remain the same.
- Home has a notification bell and profile avatar. Profile groups Edit profile, Photos, and Settings, followed by More: Matches, Likes, Saved, Notifications, Privacy, Discover, Activity, Help, and Share profile.
- Notifications, Photos, Likes, Help, Matches, and Saved have stack destinations and safe back navigation.
- Settings is also a directory for every secondary area: Profile, Edit profile, Photos, Subscriptions, Discover, Matches, Likes, Saved, Notifications, Activity/follow requests, Chat with God, Help, post/message/group/event creation, reports, blocked users, Photo Vault, vault settings, account, phone, and privacy. Staff and creation entries retain their existing permission checks. Item-specific details remain reachable from their lists.

## Shared design system

- Spacing follows 4/8/12/16/24/32/48, with 16dp screen gutters and semantic control, header, touch-target, and tab-bar dimensions.
- Shared radii, Inter titles/headings, 16dp body copy, 12dp captions, and existing semantic pink/dark colors.
- Screen supplies safe areas, background, tablet width limits, scrolling, and keyboard avoidance. Tab lists use the measured bar height for bottom content padding.
- Header defaults to left alignment and a shared 64dp minimum height, with action and custom-content slots.
- Buttons use 48–52dp minimum heights and 16dp corners; inputs/search use consistent control sizing and 12dp corners. Minimum heights let controls grow with text scaling.
- ListRow supports neutral outline icons and chevrons; settings groups use quieter neutral icon backgrounds.
- Shared Pressable supplies opacity feedback and minimum 44dp touch targets. Existing animated buttons retain scale feedback.
- Existing loaders, skeletons, errors, and empty states remain shared; empty-state decoration is neutral.
- Numeric spacing, radius, and font styles throughout existing feature screens/components were migrated to tokens. Functional limits and service values were not converted.

## Screens

| Area | UI changes |
| --- | --- |
| Home | One header, one composer, a single feed, more composer spacing, notification/profile shortcuts, bottom clearance; discovery strip removed from the feed. |
| Events | All / Today / This Week chips; simpler cover/title/date/location cards; full, natural-aspect covers, including editor/detail; existing details/application flow behind View & RSVP. Week filtering uses the device's local Monday–Sunday calendar week. |
| Chat with God | Shared screen/header, left/right bubbles, neutral assistant surface, minimal pinned composer, keyboard avoidance, measured list padding. |
| Messages | One search field, 56dp avatars, one-line message previews, timestamps, unread dots, shared header, and measured bottom padding. |
| Conversation | Shared header/screen, profile/group identity, options menu for details/blocking, common input spacing and touch feedback. |
| My profile | Left-aligned identity and bio, 96dp avatar, grouped navigation, separate Photos destination, retained posts/photo tabs and edit modal. |
| Other profiles | Left-aligned identity; reporting/blocking tucked into options; existing follow/message actions retained. |
| Photo composer/profile photos | Reusable PhotoSlot/PhotoGrid: two rows of three equal-width slots, 8dp gaps, 16dp corners, Main badge, accessible remove controls where removal already exists. Filled photos use their original proportions with no cropping or side fill; empty slots retain a 3:4 placeholder. Video preview remains separate. |
| Authentication/onboarding | Shared typography, controls, spacing, and touch feedback. Welcome uses a scrollable safe-area screen with 16dp gutters. |
| Settings/privacy/account/phone | Inherit shared screen/header/control changes; quieter grouped rows. |
| Groups, reports, staff moderation/media, vault | Inherit shared layout, type, spacing, touch feedback, and/or existing shared headers; tokenized remaining local presentation styles. |

## Behavior intentionally preserved

- Welcome, login, registration, invite code, phone setup/OTP, password recovery, account-state and access-denied screens: same validation, permissions, sessions, and destinations.
- Feed, discovery, profiles, activity and notifications: same fetching, pagination, follows, likes, posts, reads, and edits.
- Events list/detail/editor: same authorization, create/edit/delete and application/approval rules. RSVP still opens details; it does not bypass application requirements.
- Messages, direct/group rooms, group creation/details, and God chat: same services, sending, drafts, polling, unread counts, attachments, disappearing/view-once behavior, retries, and availability checks.
- Post creation: same audience/premium settings, approval requirements, picker, cleanup, uploads, and five-photo-or-one-video limit. The sixth photo slot is intentionally inactive for this existing limit. Photos retain their full composition; upload files are unchanged.
- Profile editing still replaces the avatar; no gallery persistence or delete endpoint was added. Read-only photo grids do not offer unsupported upload/removal actions.
- Settings, privacy, account/phone changes, reports, blocked users, moderation/admin, subscriptions, vault library/viewer/settings: same business/security behavior.
- Likes reuses existing incoming follow-request review. The app has no existing Matches collection or Saved implementation; those destinations are informational states. Help links to existing app guidance, privacy, and reports. No fabricated collections or new backend were added.
- Pre-existing uncommitted chat, upload, picker, vault, and script work was preserved.

## Validation

The image-layout follow-up replaces the original fixed image-ratio treatment: post albums size each page independently, and the viewport follows the current photo. Very tall/wide photos are no longer clamped. Decoded dimensions repair missing or incorrect metadata. Shared FitImage uses one image with no blurred duplicate; photo previews, discovery, event covers, admin review, and vault thumbnails follow their natural proportions. Avatars keep their intentional circular shape, and full-screen viewers continue fitting photos inside the screen. Private-media cache policies and premium access controls are retained.

- TypeScript (`npx tsc --noEmit`) and strict ESLint (`npx eslint app src --max-warnings 0`).
- Android Metro bundle compiled successfully from the real Expo Router entry.
- 105 existing auth, premium-media, and vault regression tests pass. Test harnesses now recognize the shared Pressable primitive and theme import.
- Metro startup verified using the project's existing mobile launcher: `npm start -- --offline --port 8092`.
- Plain `npx expo start` requires the project's mobile API/development environment first; without it, the existing build configuration rejects the missing `EXPO_PUBLIC_API_URL`. The launcher loads `.env.mobile` and selects the development variant; no auth/build validation was weakened.
- Pixel 6 emulator cold-booted and opened the project, but its installed Expo Go reports that the project requires a newer Expo Go version. App rendering and keyboard tests at 360dp and larger widths remain unverified. No SDK/dependency changes were made to work around that environment mismatch; bundle compilation does not establish device rendering correctness.
