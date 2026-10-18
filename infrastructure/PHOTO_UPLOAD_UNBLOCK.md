# Current AWS upload blocker

## Temporary local override

Local upload testing now also uses `PHOTO_MODERATION_MODE=development-bypass`
with `NODE_ENV=development`. This skips Rekognition while retaining real-image
validation, sanitization and the usual photo/post flow. The backend refuses
this moderation mode outside development/test. Use `rekognition` and the IAM
permissions below for deployment. Test images have not passed content moderation.

At the user's request, the active backend `.env` now sets
`PHOTO_VERIFY_BUCKET_SETTINGS=false`. This skips automatic bucket-setting
verification for upload forms and signed GETs. Other upload validation,
authentication, quotas, moderation and object permissions still apply.
Set this variable to `true` (or remove it) and restart the backend to restore
verification after IAM and bucket settings have been configured.

The diagnosis below describes the AWS permission problem that remains pending;
the temporary override does not grant S3 or Rekognition permissions.

Follow-up live checks on 2026-10-18 using the backend's actual presigned POST
policy successfully uploaded a small generated JPEG (HTTP 204). HEAD and
diagnostic-object deletion also succeeded. An earlier probe used an incorrect
test policy condition and its 403 result was not an upload-permission failure.
A separate Rekognition image-bytes call returns
`AccessDeniedException`, explicitly because `DFDrive` has no identity policy
allowing `rekognition:DetectModerationLabels`. Moderation therefore remains
blocked even with bucket-setting verification disabled. The `.env` flag was
also found set back to `true`; it was restored to the requested temporary
`false` setting. The backend was restarted after a MongoDB timeout, with the
project's Node 18 runtime; MongoDB connectivity and HTTP health were verified.

Verified on 2026-10-18: the backend credentials authenticate as IAM user
`DFDrive` in account `870460053928`. S3 bucket `darkfantasymedia` is in
`ap-south-1`. All five bucket-configuration reads used by the upload service
return `AccessDenied` because no identity policy allows the operations.
The backend therefore refuses to issue an upload form before any image is sent.
Both local photo endpoints exist and correctly reject unauthenticated requests.

## Administrator action

In AWS account **870460053928**, open **IAM > Users > DFDrive > Add permissions >
Create inline policy > JSON**. Paste `dfdrive-photo-policy.json` and save it as
`DarkFantasyPrivatePhotos`. This is an IAM identity policy, not an S3 bucket
policy. It grants no IAM administration or bucket-setting write access.

Alternatively, from this repository root using a separately authenticated AWS
administrator profile (replace `YOUR_ADMIN_PROFILE`):

```powershell
aws iam put-user-policy --user-name DFDrive --policy-name DarkFantasyPrivatePhotos --policy-document file://infrastructure/dfdrive-photo-policy.json --profile YOUR_ADMIN_PROFILE
```

The policy includes the backend's object, cleanup and moderation operations to
avoid merely moving the failure to confirmation or deletion. Rekognition's
image-byte moderation action uses `Resource: "*"` because it has no per-image
resource ARN; it is restricted to one action and `ap-south-1`. All S3 permissions
are restricted to this bucket and object operations to `temp/*` and `users/*`.
Existing policies are not removed; review them separately for broader grants.

## Verify settings before retrying

An administrator must also verify the actual bucket configuration. Granting
read access does not change an unsafe or missing setting:

- Block Public Access: all four options enabled.
- Object Ownership: `BucketOwnerEnforced` (ACLs disabled).
- Default encryption: SSE-S3 or KMS. KMS also needs appropriate key permissions.
- Lifecycle: enabled `temp/` expiration after one day; a bucket-wide enabled
  rule aborting incomplete multipart uploads after one day. Merge these into
  existing rules rather than replacing other lifecycle settings.
- CORS: absent for native Expo, or exact browser origins also listed in backend
  `PHOTO_WEB_ORIGINS`; never `*`. A browser upload needs its exact origin allowed.

Use `verify-photo-storage.ps1` with administrator credentials for the additional
audit checks. Its policy/versioning/ACL reads are deliberately not granted to
the application's user, since the runtime does not require those operations.

After IAM propagation, retry a photo from the Expo app. The privacy check cache
clears on failure, so changing IAM alone does not require a backend restart.
Any `.env` change does require restarting the backend. A successful flow is:
upload-url 2xx, S3 POST 204, confirm 2xx, then post creation 2xx. A real S3/device
upload remains unverified until these AWS permissions and settings are fixed.

References:
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-policy-actions.html
- https://docs.aws.amazon.com/rekognition/latest/dg/security_iam_id-based-policy-examples.html
