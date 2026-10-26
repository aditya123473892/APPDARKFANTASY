# Mobile backend integration

The active mobile service exports use the real backend only. No mock database, fixture profiles, posts, conversations, notifications, matches, or simulated network switch are used by the app. Existing `*.mock.ts` files remain unused development references.

## Connected features

| Mobile feature          | Confirmed backend contract                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home feed               | `GET /posts/public/feeds`, paginated via limit/skip/count; only backend-approved public posts                                                                                                |
| My profile posts        | `GET /posts/private/me`, including backend moderation status and private posts                                                                                                               |
| Other profile posts     | `GET /users/:id`, `user.usersPost`; the server decides visibility for the authenticated caller (approved posts only for other viewers)                                                       |
| People and group picker | `GET /users` with server-side `displayname` search, 20 per page with load-more; real `_id`, displayname, avatar; current user and blocked accounts excluded from selection                |
| Profile update          | `PATCH /users/me` using only displayname, bio, intrests; refresh `/auth/me` after save                                                                                                       |
| Post create             | Multipart `POST /posts`: caption, visibility, media; image/video selection; no forced approval status                                                                                        |
| Post likes              | `POST /posts/:id/like`, `DELETE /posts/:id/unlike`; idempotent, returns `{ liked, likeCount }`. Requests run in tap order; the confirmed state is applied to every cached list               |
| Comments                | `GET /posts/:id/comments` (newest first, `limit`/`before`), `POST /posts/comment` with `clientId`, `DELETE /posts/:id/comment/:commentId` (comment or post author)                           |
| Direct conversations    | `GET /chats/conversations` (`kind: direct`); IDs are `user:<other-user-_id>` in the mobile navigation model                                                                                  |
| Group conversations     | `GET /chats/conversations` (`kind: group`) with last message and per-member unread count; IDs are `group:<group-_id>`                                                                        |
| History and realtime    | Authenticated Socket.IO auth.token; paged history (`limit` 50, `before`), receiveMessage, receiveGroupMessage, messageUpdated, messageDeleted, typing, groupUpdated, groupRemoved, groupRead |
| Text/media sends        | `POST /chats/messages` with receiver OR groupId, message, `clientId`, optional multipart media; sender is always chosen by the backend                                                       |
| Unread/read             | Direct: getUnreadCount/unreadMessageCount, markAsRead/messagesRead. Groups: `markGroupAsRead` moves a private per-member read cursor                                                         |
| Chat attachments        | On-demand `POST /chats/messages/:messageId/media/:mediaId/access-url`; no storage keys, disk image caching, or persisted signed URLs                                                         |
| Create group            | `POST /groups/create-group` with name, description, members, `clientId`; any member can create and becomes the owner. 400 carries per-field `errors`; 409 if a `clientId` is reused for a different group. Optional photo via `PUT /groups/:id/upload-icon` |
| Group members           | `GET /groups/:groupId/members`; the owner adds/removes members, edits details and deletes the group; members can leave (`POST /groups/:id/leave`)                                            |
| Activity                | Real pending follows from `/users/follow/follow-requests`; accept/reject through `/users/follow/approve-follow/:followId`                                                                    |
| Follow                  | `/users/follow/follow-request`; following does not fabricate a match or a chat relationship                                                                                                  |

## Behavioral details

- Author and sender identity is always a backend `_id`. Names, counters, dates, and media use response fields. Missing photos show initials; missing ages and distances are not fabricated.
- Socket history responses have no correlation ID. Requests are serialized so opening two chats cannot mix their histories. Responses are additionally filtered by the authenticated conversation identity.
- Logout/account change disconnects the socket, cancels queued/in-flight history requests, clears query data, outbox, and the memory user cache. Pending text send completions cannot repopulate another user's cache.
- Sends, comments and group creation carry a `clientId` idempotency key, so retries never create duplicates. Messages that fail for connection reasons are resent automatically when the chat reconnects; other failures offer Retry or Delete.
- Read is shown only from backend isRead/messagesRead. No delivered status is invented. Group read state is a private cursor used for unread counts; it is not shown to other members.
- Home does not insert pending/private posts after publishing. The composer reports submission for approval and My profile shows the actual status.
- Images use containment and bounded dimensions; video uses native controls. Missing/broken media has an explicit fallback. Display ratios are layout defaults, not invented backend image metadata.
- Metro excludes separate backend/desktop/runtime/duplicate project folders so their dependencies do not enter the mobile module graph.

## Confirmed backend limitations

- `notification.controller.ts` contains only commented imports and registers no routes. Activity shows follows; the notification service has no fixture fallback.
- Group previews and unread counts come from `GET /chats/conversations`; live messages update them between refreshes.
- Feed, own-profile and other-profile posts include like owners or `likedByMe`, so the like toggle works in all three views.
- Comment text is loaded on demand from the paginated comments endpoint when a post's comments are opened.
- `users.service.ts` approveUserEditRequest does set `canEditProfile`; this is additional confirmation correcting the earlier Phase 1B discovery. The separate `PATCH /users/me` route does not check that flag.
- Uploads and signed chat media URLs use `s3-bucket/s3-bucket.service.ts`. The local backend `.env` has no AWS_ACCESS_KEY, AWS_SECRET, or AWS_S3_REGION values. Upload and signing require valid credentials/region from that environment or the AWS credential provider chain. The app preserves drafts and reports server failure. No local storage fallback or backend changes were introduced.
- General post edit is still not exposed in the app. The backend update route now keeps existing media when no replacement is uploaded.

## Verification

- Live local admin login and read-only API smoke check: 19 users, 2 public approved posts, zero groups for that account. Users, public/private feeds, group list, chat list, follow requests, Socket.IO authentication, unread query and direct history all returned successfully.
- Automated tests cover real post/message field mapping, privacy-preserving cache projection, unknown like state, real-user-only selection, request serialization, teardown cancellation, and exact group/send DTOs without spoofed identity or invented fields, in addition to the auth regression suite.
- TypeScript and lint pass; all 16 auth/data regression tests pass. Android development bundle returns HTTP 200, includes the real feed/chat/group integrations and Wi-Fi API URL, and excludes the fixture database. Actual device gestures, real uploads, and live group creation/message sends are not claimed as tested; no content was seeded or created for verification.

Reload Expo Go after this update. If the PC's Wi-Fi IP changes, update `.env.mobile` and restart Metro. Native release builds must be rebuilt for the added Expo image picker/video modules; Expo Go includes these modules.

Implementation uses Expo's [image picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) and the [Socket.IO client API](https://socket.io/docs/v4/client-api/) alongside the repository's confirmed Nest controllers and services.
