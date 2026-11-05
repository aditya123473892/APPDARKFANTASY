# Google Play release: DARKFANTASY

Everything the build needs is configured in this repository. Each release is one command:

```powershell
npm run release:android
```

This builds a signed Android App Bundle (`.aab`) on EAS with:

- package `com.aditya123473892.darkfantasy`, signed with the upload key EAS stores for this project;
- a `versionCode` that EAS increments automatically, so every upload is accepted;
- the production API `https://dfbackend.onrender.com/api` over HTTPS only;
- email and password sign-in (the same as the tested APK);
- in-app Privacy Policy, Terms of Use, Contact support, Account deletion and the 18+ age check.

Download the `.aab` from the EAS build page and upload it in Play Console. The build does not
upload itself.

Before each build, EAS runs `scripts/check-release.cjs`. It stops the build with a clear
`REQUIRED` message if anything below is missing.

---

## One-time setup (do once, before the first build)

### 1. Firebase, for push notifications (required)

Android delivers push notifications only through Firebase. Without this the production build is
stopped by the release check.

1. Go to <https://console.firebase.google.com>, create a project (for example "DARKFANTASY"),
   and add an **Android app** with package name `com.aditya123473892.darkfantasy`.
2. Download `google-services.json`. Do not commit it.
3. Upload it to EAS as a file variable in the **production** environment:

   ```powershell
   npx eas-cli login
   npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --value .\google-services.json --environment production --environment preview --visibility secret
   ```

4. In Firebase: **Project settings › Service accounts › Generate new private key**. This
   downloads a JSON key.
5. Give it to Expo so Expo can deliver notifications:

   ```powershell
   npx eas-cli credentials --platform android
   ```

   Choose the `production` profile, then **Google Service Account › Manage your Google Service
   Account Key for Push Notifications (FCM V1) › Upload a new service account key**.

### 2. Backend (Render)

Redeploy `dfbackend` from branch `3112026`, so the public legal pages, admin premium tools
and the daily AI limit are live. Check these environment values on Render:

| Variable | Value |
| --- | --- |
| `MOBILE_PHONE_AUTH_REQUIRED` | `false` (email and password sign-in) |
| `MOBILE_OTP_ONLY_ROUTES` | `off` (otherwise Photo Vault backup is refused) |
| `GOD_CHAT_FREE_DAILY_MESSAGES` | `10` |

Render's free plan sleeps when idle, and the first request can take about 40 seconds. Google's
reviewers may report the app as broken during that wait. Use a paid instance, or an uptime
monitor, before submitting for review.

### 3. Play Console app record

Create the app at <https://play.google.com/console>: **Create app** › name `DARKFANTASY`, App,
Free. Turn on **Play App Signing** (the default). Google requires the **first** `.aab` to be
uploaded by hand: **Testing › Internal testing › Create new release**.

---

## Play Console answers

### Store listing URLs

| Field | Value |
| --- | --- |
| Privacy policy | https://dfbackend.onrender.com/api/legal/privacy |
| Account deletion (Data safety) | https://dfbackend.onrender.com/api/legal/account-deletion |
| Terms (optional, description) | https://dfbackend.onrender.com/api/legal/terms |
| Support website | https://dfbackend.onrender.com/api/legal/support |
| Support email | support@darkfantasy.com |

The pages are generated from the in-app text. After changing
`src/features/legal/legalContent.ts`, run `npm run legal:sync` and redeploy the backend. The
release tests fail if the two differ.

### App content

- **Target audience:** 18 and over only. The app is not designed for children.
- **Ads:** No ads.
- **App access:** Restricted. Give reviewers a working email and password test account, and
  mention that the Photo Vault needs a PIN, which the reviewer sets on first use.
- **Content rating (IARC questionnaire):** choose the Social or Communication category.
  Answer **yes** to: users can interact and exchange messages; users can share photos and
  videos; the app shares user content. Answer honestly about sexual themes: the app discusses
  sex, fantasies and intimacy (non-graphic) and hosts user photos.
- **Government apps, financial features, health:** No.
- **News app:** No.

### Data safety

Data is **encrypted in transit**. Users **can request deletion** (in the app under
Settings › Account › Delete account, and through the URL above). Data is **not sold** and is
**not shared** with third parties: hosting, storage, email, SMS, push and AI providers process
it on our behalf, which Google does not count as sharing.

| Data type | Collected | Required? | Purposes |
| --- | --- | --- | --- |
| Name | Yes | Optional | App functionality, Account management |
| Email address | Yes | Required | Account management, App functionality |
| User IDs | Yes | Required | App functionality, Account management |
| Phone number | Yes | Optional | Account management, Fraud prevention and security |
| Other info (age, gender, bio, interests) | Yes | Optional | App functionality |
| Approximate location (city, state or country the user types) | Yes | Optional | App functionality |
| Photos | Yes | Optional | App functionality |
| Videos | Yes | Optional | App functionality |
| Other in-app messages (chats, Chat with God) | Yes | Optional | App functionality, Fraud prevention and security |
| Other user-generated content (posts, comments) | Yes | Optional | App functionality |
| App interactions (likes, follows, bookmarks) | Yes | Optional | App functionality |
| Device or other IDs (push token) | Yes | Optional | App functionality |
| Crash logs and diagnostics | Only if Sentry is enabled (`EXPO_PUBLIC_SENTRY_DSN`) | Optional | Analytics |

Declare **audio** under Videos: videos recorded in the app include sound.

### Permissions Play will show

`INTERNET`, `VIBRATE`, `USE_BIOMETRIC`/`USE_FINGERPRINT` (App Lock), `RECORD_AUDIO`
(sound for videos recorded in the app) and `READ_MEDIA_VISUAL_USER_SELECTED` (only photos
the user picks). The app does not request location, contacts, or broad photo and video access.

### Policy risk to review before submitting

Google Play's Inappropriate Content policy does not allow apps that contain or promote
sexual content. DARKFANTASY's Chat with God is limited to non-graphic conversation, and the
app has reporting, blocking and moderation, but reviewers judge the whole app, including user
photos and the store listing. Keep the listing, screenshots and premium previews non-explicit.
