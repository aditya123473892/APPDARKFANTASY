# Phase 2 checkpoint — Stage A

Date: 2026-10-14 (Asia/Calcutta).

Stage A code is implemented. Physical-device verification is pending, so Stage A is not signed off and Stages B–D have not started. The user's stage gate requires passing verification before continuing. Android SDK inventory succeeded, but `adb devices -l` returned no attached devices. No iOS device session is available. No backend or desktop files were changed.

## Changed files in this checkpoint

- `src/features/auth/sessionRuntime.ts`: monotonically increasing session generation and current-session assertions.
- `src/services/api/apiClient.ts`: generation guards before HTTP dispatch, after pinning, and before response/error handling, including retries.
- `src/features/chat/services/chatPayload.ts`: runtime validation and allowlisted projections of message, media and user identity payloads. URLs, object keys, unknown fields and private profile fields are discarded.
- `src/features/chat/services/chatState.ts`: server-ID merging, unread arrays, preview updates, internal race journal and read preservation; memory-only state clears on teardown.
- `src/features/chat/services/socketSession.ts`: guarded socket handlers, serialized requests, group acknowledgments, reconnect barrier and full-history/unread resync. Timed-out uncorrelated requests discard the connection before another response can be consumed.
- `src/features/chat/services/chatService.real.ts`: guarded REST completion, common socket/REST merge, unread refresh after REST sends, guarded room joins and read marking.
- `src/features/chat/services/chatService.ts`: optional live visibility predicate for read commands.
- `src/features/chat/types.ts`: correct description of local correlation IDs; revocation timestamp metadata.
- `src/features/chat/hooks/useChat.ts`: generation-guarded sends and focus/foreground/resync gating for read marking.
- `src/features/chat/screens/ChatRoomScreen.tsx`: guarded media selection/upload and independent capability inputs.
- `src/features/chat/components/ChatInput.tsx`: separate text and attachment capability checks, defaulting to disabled.
- `src/features/chat/components/ChatAttachment.tsx`: mounted/request/session guards, URL validation and release on session teardown.
- `scripts/test-auth.cjs`: transport/state/HTTP races, unread arrays, read visibility and independent capability regression tests; TSX-aware harness.
- `PHASE_2.md`: this stage record, support matrix and pending manual checks.

The checkout already contained uncommitted Phase 1/1B and integration work before this task. A scoped checkpoint commit includes the prior contents of files touched by Stage A. Other existing edits remain in the working tree; this checkpoint relies on those existing prerequisites and is not represented as a standalone clean-checkout release.

## Verification

Final automated verification passed: 23/23 tests, `tsc --noEmit`, scoped ESLint (zero errors/warnings), and `git diff --check`. These results include the final token-rotation and unread-replay refinements.

The tests exercise actual app services through a mocked HTTP adapter and Socket.IO transport. They do not prove native device behavior or a deployed backend's wire behavior.

- Message/socket payload rejection and private-field stripping.
- REST/socket duplicates collapse to one server ID; read status and local correlation survive subsequent events.
- An edit or deletion received during a history reload wins over the earlier history snapshot.
- `unreadData` and `unreadMessageCount` arrays drive badges; duplicate IDs count once and `{count}` is rejected.
- REST sending refreshes unread without changing the supported upload DTO.
- Reconnect joins registered groups, reloads requested histories, then resyncs unread before allowing read marking.
- A queued read command rechecks current focus/foreground/read preference/session at emission.
- Old socket callbacks and HTTP/media responses cannot update a subsequent login to the same account.
- Composer text and attachment capabilities are independent.
- Existing auth, cancellation, capability, logout and security regressions continue to run.

Physical/device results: **not run; no devices attached**. App–desktop interoperability: **not signed off**.

## Actual feature support matrix

Backend ratings describe the requested feature's complete semantics. Purely local presentation is identified explicitly. No new backend routes, socket events or wire fields were introduced.

| Feature | Backend support | Actual app status |
| --- | --- | --- |
| Direct/group text and media transport | Full | Existing transport retained; Stage A merges guarded REST/socket messages by server ID |
| Validated realtime insert/edit/delete merge | Full | Built in A; updates memory/query state directly |
| Direct unread arrays and total badge | Full | Built in A; server arrays plus unique-ID projection; refreshed after REST sends |
| Reconnect authentication, group joins, history/unread resync | Full | Built in A; read barrier remains closed until resync succeeds |
| Focused and foreground-only read marking | Full | Built in A; predicate also rechecked when queued command emits |
| Session teardown and generation isolation | Full | Built in A for HTTP, socket, chat services, picker/upload and media access |
| Separate send/media capabilities | Full (app policy) | Built in A |
| Complete inbox ordering/previews | Partial: no summary endpoint | Stage B pending; full-history fetching not implemented |
| MIME/timed previews, group sender prefix and direct ticks | Full using message data | Stage B pending; existing generic preview retained |
| Loaded-name/message local search | None server-side; local-only possible | Stage B pending; existing name filter retained |
| Skeleton previews and concurrency-limited memory cache | Local presentation | Stage B pending |
| Local history windowing and load older | None server pagination; local-only possible | Stage C pending; existing full list retained |
| Edit own text, delete own message for everyone | Full | A receives changes; Stage C action menu/mutations pending |
| Copy menu | Local presentation | Stage C pending; selectable text already existed |
| Memory-only per-chat drafts | None server-side; local-only possible | Stage C pending |
| First-unread jump | Partial: direct data only | Stage C pending |
| Bottom button/new incoming count | Local presentation | Existing bottom button retained; Stage C count pending |
| Direct typing | Partial: pulse only, no stop event | Stage C pending; no group typing |
| Definitive versus uncertain send failure | Partial: no idempotency contract | Stage C pending; current failure UI retained; no automatic resend introduced |
| Absolute media expiry and deadline countdown | Partial: only fresh access issuance is checked | Stage D pending; no timer selector/fullscreen countdown built |
| Sender media revocation | Partial: existing URLs remain valid | Stage D pending |
| Terminal access refusal UI, natural expiry resync | Partial | Stage D pending |
| Native capture/app-switcher protection and cache audit | Platform/client-dependent | Stage D pending; existing auth privacy behavior retained |
| Single-use media, recipient consumption/open state, first-access timers | None | Not approved; not built |
| Pin/mute/archive/chat removal, delete for me | None | Not approved; not built |
| Reply/forward/reactions/edit labels/deletion tombstones | None | Not approved; not built |
| Delivered state and group receipts | None in active chat service | Not approved; no server state synthesized |
| General presence/contact blocking | None applicable contract | Not approved; not built |
| Expiring text/chat timers/voice | None | Not approved; not built |
| Backend search/server pagination | None | Not approved; no route or cursor invented |

## Current message state machine

Stage C is pending. The current text outbox remains:

```text
local sending --successful REST response--> server sent --direct receipt--> read
              --request failure-----------> failed (send outcome may be unknown)
```

The temporary ID is app-only and is attached to the REST response locally. Cache reconciliation uses the server `_id`; socket copies never establish idempotency. No automatic resend is introduced. The existing UI presents a send-status warning; the approved definitive/uncertain states and resync/manual resend flow have not yet been built. Editing/deletion incoming events update/remove records, without any new badge or visible tombstone.

## Timed media: confirmed server behavior

Stage D is pending; the following is discovery, not newly implemented or device-tested behavior:

- `expiresAt` is an absolute media deadline. Omitting it applies the backend's configured default expiry.
- A fresh access-URL request requires message participation/current group membership and active, unexpired media.
- Expiry or revocation returns 404 for new access-URL requests. The app must also treat 403 as terminal unavailability.
- An already-issued URL remains an S3 signed link until its own TTL. Its TTL is not capped to the remaining media lifetime. Revocation does not delete the object or invalidate that link.
- Access issuance is audited; it does not consume a view or record successful viewing.
- Revoke/expiration modifications broadcast `messageUpdated`. Natural expiry does not have a scheduled socket event.
- Deadline auto-close, releasing viewer resources and capture/app-switcher protection are client responsibilities. Device disk/gallery and capture behavior have not been verified.
- Another camera cannot be prevented from photographing the screen.

## Performance cost

Stage A reconnect makes approximately G + H + 1 serialized socket requests: G registered group joins, H previously requested histories, and one unread request. Histories contain every message because the backend has no cursor/limit. Time and transfer cost therefore grow with the total history of loaded chats. Periodic history/inbox polling remains from the existing implementation (15/30 seconds). Each REST send triggers an additional unread request.

State is memory-only: loaded histories plus one latest race-journal entry per distinct realtime message during this session. No chat data or signed media URL is persisted by the Stage A changes. Stage B's lazy inbox prefetch/concurrency cap is not built yet and has no measured cost result.

## Desktop mismatches for a future task

Desktop was read only. Paths below are under `Df-Fortend-pm-fe/Df-Fortend-pm-fe/src/app/(protected-routes)/`.

| File and line | Mismatch |
| --- | --- |
| `(fantacy)/chats/[group]/[id]/websocketService.tsx:53`, `:63`, `:99` | Socket creation/connect functions provide query `userId`, not the backend-required handshake `auth.token` |
| Same service `:87`, `:115`; `(fantacy)/chats/[group]/[id]/page.tsx:159`, `:167`, `:172` | Desktop sends attachment arrays over socket; backend rejects nonempty socket media and requires multipart `POST /chats/messages` |
| `(fantacy)/chats/[group]/[id]/page.tsx:701`, `:732`; `admin/chats/[group]/[id]/page.tsx:632`, `:663` | Media renderers expect `media.url`, omitted by current sanitized responses; they do not obtain fresh authenticated access URLs |
| Shared service `:195`, `:215` | Emits/listens for `stopTyping`; no backend handler/event exists |
| Shared service `:242` | Emits `markMessageAsRead`; no backend handler exists |
| Shared service `:228`, `:229` | Types deletion payload as string; backend emits a record with `_id` and `messageId` |
| Shared service `:13`, `:40` | History types use `messageId`/`timestamp` instead of actual `_id`/`sentAt` |
| Shared service `:23`, `:185` | Unread callback type is `{count}`; backend sends an unread-message array |
| `(fantacy)/chats/[group]/[id]/page.tsx:527` | Online UI uses the selected object's truthiness rather than confirmed presence |
| `admin/chats/[group]/[id]/page.tsx:22`, `:164`, `:172` | Admin chat imports the same incompatible service and uses the same socket attachment flow |

App–desktop interoperability remains **not signed off**. Native app behavior follows the inspected backend contract; no desktop workaround was added.

## Suggested backend changes — not implemented

| Gap | Suggested change |
| --- | --- |
| Reliable retry | Sender-scoped persisted idempotency key echoed in responses/events |
| Inbox summaries/history paging/search | Authorized summaries, cursors and scoped search |
| Delivered/group receipts | Per-recipient delivery/read records and events |
| Strict media expiry/revocation | Authorized serving with revalidation; cap URL TTL to remaining lifetime |
| Single-use media and first-access timing | Atomic per-recipient consumption state, authorized delivery and state events |
| Reply/forward/reactions | Validated references, metadata and supported mutation events |
| Pin/mute/archive/delete-for-me | Per-user conversation/message preference records and routes |
| Edit/deletion labels | Explicit edit metadata and deletion records |
| Presence/typing completeness | Presence policy/events and supported group/stop-typing contract |
| Contact blocking | Relationship rules enforced consistently in send/history/media paths |
| Text/chat expiry timers | Explicit fields with server enforcement |
| Voice | Validated audio upload/playback support |

## Stage A manual gate

All items below remain pending; two Android app devices are sufficient for this stage's app-to-app checks. App–desktop remains a separate known limitation.

1. With two existing accounts, send and receive direct text and attachments. Ensure REST response/socket copies render once, and badges match server unread arrays.
2. View a direct chat and confirm read ticks. Navigate away or background it; new incoming messages must remain unread until the chat is focused and the app is active.
3. Repeat group receive after reconnect: existing joined rooms must receive messages without reopening the room.
4. Enter airplane mode, exchange messages on the second device, restore connectivity. History/unread must resync before any read command; no message may automatically resend.
5. Logout during history loading, sending and media access. Log in to the same and another account. No earlier callbacks, media or records may reappear.
6. Exercise capability-denied/403 states: text and attach must follow separate flags; no forbidden action retries.
7. Confirm sender-owned edits/deletes made by a compatible second client merge immediately, including while history is reloading.

Do not begin Stage B until this gate passes or the user explicitly changes the verification requirement. Stage D's disk/gallery/capture tests and Phase 3 remain pending and unauthorized to start now.
