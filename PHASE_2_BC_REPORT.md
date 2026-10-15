# Phase 2 — Stages B and C

Date: 2026-10-15 (Asia/Calcutta). Implementation and automated gates complete. Two-device manual verification remains pending. The user's Stage A verification authorized continuing despite the older pending-gate wording in PHASE_2.md. That file remains the historical Stage A record.

## Commits

| Stage | Commit |
| --- | --- |
| Starting checkout | `bebaac6` — working tree was clean; no pre-existing changes needed checkpoint commits |
| B | `9ae2a76` — `feat(app): Stage B inbox histories, previews and local search` |
| C | Commit containing this report, HEAD at delivery — `feat(app): Stage C conversation actions, drafts and safe send states` |

Each stage is independently committed. Backend and desktop files were not modified. App–desktop interoperability remains **not signed off**. Stage D and Phase 3 were not started.

## Feature matrix

| Feature | Status | Details |
| --- | --- | --- |
| Inbox data and ordering | Built | Confirmed `/users/chatlist` and `/groups/my-groups`; lazily fetched full histories supply last activity. Stable ID tie-break for equal activity. |
| Previews | Built | Skeleton while pending, retry text on failure, text/Photo/Video by MIME, group sender prefix, own direct sent/read ticks. |
| Unread badges and total | Built for direct chats | Unique message IDs from unread arrays and validated live direct messages. Count-shaped payloads are rejected. |
| Group unread badges | Skipped, fail closed | No confirmed per-member unread/read cursor in this brief. No fabricated group counts or group receipt commands. |
| Local search | Built | Visibly labeled “Local search”; searches loaded participant names and loaded message text only. |
| Participants | Built | Uses the `_id` user cache; no per-message profile requests. Unknown sender uses a neutral label. |
| Refresh and live updates | Built | Pull to refresh, empty/error states, validated realtime inserts, edits and deletions. Polling and further prefetch dispatch pause off-focus/in background. An already-dispatched request may finish. |
| Conversation window | Built | Latest 50 messages initially; increments of 50 from the fetched array. No pagination fields or extra older-history requests. Inverted list retains visible content position. |
| Supported actions | Built | Long press: Copy when text exists; own confirmed text-only messages also Edit; own confirmed messages also Delete for everyone. Edit/delete require confirmation. No tombstone or edit badge. |
| Drafts | Built | Per-chat memory only; clear on send and session teardown. Session guards protect stale callbacks. |
| First unread | Built, direct only | Captured from successful history before read emission; explicit jump expands the local window as needed. Capture resets on entering the chat. |
| New incoming count | Built | Bottom button counts incoming messages arriving while scrolled away. Returning to bottom clears count. |
| Typing | Built, direct only | At most one pulse per 3 seconds; local receive timeout 6 seconds. Clear/send emits no stop event. |
| Send outcomes | Built | Sending, sent, direct read, failed-definitive, uncertain; resync/manual resend flow below. |
| Teardown | Built | Logout, expiry and account switch clear drafts, windows, first-unread state, typing, outbox, chat caches and socket state. Late results are generation-guarded. |
| Native interaction/layout and two-device backend behavior | Unverified | Automated harness does not validate physical scrolling, clipboard permissions, keyboard behavior or deployed wire behavior. |
| Desktop interop | Unverified | Not signed off; no desktop adaptations. |
| All explicitly prohibited features | Skipped | No timed/view-once UI, chat timers, self-destruct text, voice, pin/mute/archive, swipe/delete-for-me, reply/forward/reactions, edited/deleted labels, delivered ticks, group receipts/typing, presence/last seen, contact blocking, backend search or server pagination. |

The previous app paths for summary inboxes, history limits/cursors, group read events and server-echoed message idempotency were replaced or removed from the B/C chat flow. These changes follow the supplied contract; backend code remained read-only.

## Message state machine

```text
new text -> local sending
  valid REST response + server _id -> sent
    direct messagesRead/history isRead -> read
  explicit supported 4xx rejection -> failed-definitive
  timeout/no response/server failure/malformed response -> uncertain
  socket disconnect while pending -> uncertain

failed-definitive -> explicit confirmed Send again -> sending
uncertain -> explicit Resync history (never sends)
  resync failed -> uncertain; Send again hidden
  matching new own text exists -> uncertain; Send again hidden
  matching text absent -> uncertain; Send again offered with duplicate-risk note
    explicit confirmation -> resync again immediately
      still absent -> sending
      present or resync fails -> uncertain; no send
```

There is no automatic outbox resend, including reconnect. Cancel closes the options dialog without removing the uncertain item. There is no dismiss/discard action for it. A pending REST operation can still complete successfully after a socket disconnect and resolve the item to sent. Late completions after teardown are ignored.

`clientId` is app-only REST-response correlation. It is not sent on the wire and is not accepted from socket/history payloads. Without server correlation, content cannot prove send identity. Resync conservatively looks for an own message with matching text and an ID absent from the pre-send history snapshot. A possible match stays uncertain; the app does not assert that it is the same send. If absent, a late original can still create a duplicate after manual resend.

## Automated gates

| Gate | Stage B | Stage C |
| --- | --- | --- |
| TypeScript `tsc --noEmit` | Pass | Pass |
| ESLint `app src` | Pass, zero errors/warnings | Pass, zero errors/warnings |
| Full app suite: `node --test scripts/test-auth.cjs scripts/test-dev-api-proxy.cjs` | 35/35 pass | 43/43 pass |
| `git diff --check` | Pass | Pass |

B covers activity ordering, MIME previews, loaded-message search and its label, concurrency, cancellation between prefetch requests, visibility polling and unread-array deduplication. C adds real-service mutation/event tests, action allowlists, local windows, draft teardown, capture-before-read, typing throttle/timeout, send transitions, reconnect never resending, resync eligibility and menu visibility. HTTP adapter tests distinguish server rejection, HTTP/envelope 500, and timeout without retrying POSTs. Existing auth, session, security, media capability, socket-race and network-proxy regressions also run.

These are mocked HTTP and Socket.IO results, not a deployed-backend or native-device sign-off. Historical tests asserting pagination, invented group cursors and echoed message idempotency were replaced with contract-correct assertions.

Copy uses `expo-clipboard` 57.0.2, following the [Expo Clipboard documentation](https://docs.expo.dev/versions/latest/sdk/clipboard/). Native development builds must include the new module; rebuild an existing custom development client before testing Copy.

## Prefetch measurements

`INBOX_PREFETCH_CONCURRENCY = 1` in `src/features/chat/services/inbox.ts`. History responses have no request IDs; serial requests prevent a reply being consumed by another chat's request. The transport also serializes event-response requests and discards a timed-out connection before reusing it. A shared prefetch queue caps overlapping focus/refresh runs. Periodic history refresh waits for the current batch to finish, avoiding starvation of later chats on slow connections.

One reproducible **synthetic cold inbox load** in the mocked HTTP/Socket.IO harness:

| Measurement | Result |
| --- | --- |
| Fixture | 40 direct chats + 10 groups, 100 messages per history; 5,000 messages total |
| HTTP requests | 2 lists |
| Socket requests | 62: 50 histories + 10 group joins + 2 unread requests (initial connection synchronization and list refresh) |
| Peak prefetch operations | 1 |
| UTF-8 list-envelope + history-response JSON | 1,039,219 bytes |
| Serialized socket request records (`name` + `payload`) | 4,353 bytes |

Byte counts exclude HTTP headers, authentication, join/unread responses, Socket.IO framing, compression and TLS. They are logical JSON payload measurements, not packet capture or production bandwidth. No tokens, signed URLs or message content are logged by the measurement. The test prints aggregate counts/bytes only.

Warm entry reuses loaded histories; explicit refresh and visible periodic refresh load full histories again. Metadata polling is 30 seconds, conversation polling 15 seconds; both stop when their screen is unfocused/backgrounded. Reconnect still rejoins registered groups and reloads known histories before unread resync/read readiness. Memory and transfer grow with total loaded history because the server offers no pagination. Session chat caches deliberately survive query garbage collection and are cleared on teardown.

## Two accounts / two devices — manual checklist

Use accounts A and B on separate devices, both running this app build. Follow this order:

1. **Login and send.** Log in independently; send direct text both ways. Confirm one server record after response, MIME previews, ordering, direct badges and total. Check “Local search” finds only loaded text/names. Open a history longer than 50 messages and load older while keeping the same visible message in place. Copy text and check its clipboard result.
2. **Read ticks.** With B's chat unfocused/backgrounded, A's last direct message stays sent. Focus B in foreground with read receipts enabled: A gets read ticks and B's badge clears. Repeat with receipts disabled and in a group: no group receipt ticks. With multiple unread messages, use the captured first-unread jump, then scroll away and verify the new incoming count/bottom button.
3. **Edit and delete.** Long-press A's text, confirm an edit and verify B updates without an Edited badge. Cancel once to verify no mutation. Confirm Delete for everyone; both records disappear without tombstones. B's messages offer Copy, with no edit/delete actions to A. Media messages offer no text edit. Type continuously: B's direct indicator should expire after activity stops; groups show none.
4. **Airplane-mode resync.** Interrupt a send and restore networking. Confirm no automatic resend. For an uncertain item, Resync history first. A possible match withholds Send again; absence enables it only with the duplicate-risk confirmation and another resync. Check a failed resync leaves resend hidden. Confirm unseen incoming messages appear once after recovery.
5. **Group receive after reconnect.** Load a group, disconnect/reconnect without reopening it, then send from the other account. Confirm rejoin and history/unread synchronization complete before read readiness; incoming group text appears once, with sender prefix and no typing/read receipt UI.
6. **Logout and account switch.** Leave drafts, an expanded window, typing and an uncertain send; start history/media requests, then log out. Log into the same account and a different account. Verify prior drafts/windows/typing/outbox/cache do not reappear, pending callbacks cannot restore them, and only the new account's socket receives messages. Repeat with token expiry.

## Known risks and first checks on failure

| Symptom/risk | Check first |
| --- | --- |
| Slow inbox, memory growth, reconnect backlog | Full-history sizes and number of known chats; serial request timeout; whether screen is actually focused/foregrounded. Local windowing reduces rendered rows, not network/storage cost. |
| Missing preview or failed list | Confirm the two REST envelopes and history sender/receiver/group IDs satisfy the allowlist. Use refresh; do not log raw responses, credentials or media links. |
| Group badge absent | Expected fail-closed behavior: this brief supplies no per-user group unread/read contract. |
| Uncertain item remains after a matching message appears | Expected conservative ambiguity without idempotency. Resync; do not blindly resend or infer identity from identical text. |
| Missing read tick / wrong first-unread jump | Confirm direct chat, successful full history, focus, active app state, read preference, current session and reconnect readiness. Then verify `messagesRead({userId})`. |
| Edit/delete does not settle | Check ownership/capability and `updateMessage` ack or matching `messageDeleted` record. Refresh before retrying after a timeout; no optimistic tombstones are synthesized. |
| Copy unavailable | Rebuild a custom native client with expo-clipboard; check OS/browser clipboard behavior. |
| Scroll jump or keyboard issue | Test actual device layout, mixed-height media, long histories and `maintainVisibleContentPosition`; automated harness cannot prove native scroll anchoring. |
| Group receive missing after reconnect | Check existing membership, join acknowledgment, socket auth token source and the readiness barrier. Desktop wire mismatches remain a separate issue. |
| Old account state visible | Check session teardown and generation guards first; capture only redacted event names and numeric counts. Stop manual testing if isolation fails. |

Stop point: Stage C. Stage D requires the user's approval.
