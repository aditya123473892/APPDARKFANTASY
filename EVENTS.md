# Mobile events

The Events tab uses the configured backend directly. Members can search events, view details and accepted participants, and apply to join. Admin/root accounts can create, edit, and delete events. The event creator can approve or decline applications and remove participants.

Cover photos use the shared approved-photo upload flow (`coverUploadId`). No backend or environment settings were changed for this feature.

## API behavior

- Lists use `/events` with limit/skip pagination. Details use `/events/:id`.
- Applications use `/event-members/join`; accepted participants and pending requests use their separate endpoints.
- The list's `users` field includes all applicants, including declined applications. The app labels this as "Application on file" and only labels a user as a participant after checking the accepted participant endpoint. There is no endpoint for a member's exact application status; a declined applicant cannot reapply until their existing record is removed by the creator.
- The mobile UI closes applications after the registration deadline, at event end, for canceled/completed events, and when the accepted participant count reaches capacity. These checks are advisory: the backend does not enforce capacity/deadline atomically.
- The current create/update DTOs do not accept `status`. The app displays the stored status and offers no unsupported start/complete controls. Online event meeting details are displayed as supplied by the organizer; there is no built-in meeting engine.
- Dates are entered as `YYYY-MM-DD HH:mm` in device local time and sent as ISO timestamps. Invalid dates, reversed time ranges, invalid capacities, and deadlines after the start are rejected before submission.
- Existing optional capacity/deadline fields can be edited but cannot be cleared through this API. Existing cover photos are preserved unless replaced.

## Checks

Run `node --test scripts/test-events.cjs`, `npm run typecheck`, `npm run lint`, and `npm run test:auth`.

For device verification, sign in as a member and an admin on separate devices: create an event with a cover, apply as the member, approve as the creator, refresh the member's details, remove the participant, edit the event, and delete it. Check that an ordinary member cannot open `/events/new` or an event edit route. Verify empty/offline states and pull-to-refresh as well.
