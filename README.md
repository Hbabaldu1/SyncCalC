# SyncCalc

SyncCalc is a mobile-first calculator and personal record book built with Expo, React Native, TypeScript, Firebase Authentication, and Cloud Firestore.

## Included
- Calculator for addition, subtraction, multiplication, division, percentages, brackets, and powers.
- Saves completed calculations to a local history.
- Personal record book with title, amount, and notes.
- Google sign-in through Firebase Authentication.
- Account-scoped local storage and user-scoped Firestore collections.
- Persistent Firebase login between app launches.
- Local-first saving with a durable per-account outbox: failed cloud writes remain queued and retry when connectivity returns or the app becomes active.
- Record editing and deletion, plus calculation-history deletion.
- Cloud snapshot reconciliation that preserves pending local writes and respects queued deletions.
- Firestore rules that restrict every account to its own documents.
- EAS Android APK and production Android App Bundle profiles.
- GitHub Actions validation and manually triggered APK build workflows.

## 1. Firebase setup
1. Open [Firebase Console](https://console.firebase.google.com/) and create a Firebase project.
2. Register a **Web app** in Project settings. Copy its Firebase config values.
3. In **Authentication → Sign-in method**, enable **Google**.
4. In **Firestore Database**, create a database.
5. From the repository root, install the Firebase CLI and deploy the included security rules:
   ```bash
   npm install
   npx firebase-tools login
   npx firebase-tools use YOUR_FIREBASE_PROJECT_ID
   npx firebase-tools deploy --only firestore:rules
   ```
   Or install the CLI globally with `npm install -g firebase-tools` and use `firebase` in place of `npx firebase-tools`.

## 2. Google OAuth setup
In [Google Cloud Console](https://console.cloud.google.com/), select the same Google Cloud project linked to Firebase and configure the OAuth consent screen.

Create OAuth 2.0 client IDs:
- **Web application:** use this for `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- **Android:** package name must be `com.hbabaldu.synccalc`; add the SHA-1 certificate fingerprint for the signing key used by the EAS build. Use this for `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`.
- **iOS:** bundle ID must be `com.hbabaldu.synccalc`. Use this for `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.

Add the Android SHA-1 fingerprint to the Android OAuth client after the EAS Android keystore has been created. Keep the OAuth clients in the same Google Cloud project as Firebase.

## 3. Environment configuration
Copy `.env.example` to `.env` and fill in:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

These Firebase and OAuth client identifiers are public application configuration, not server secrets. Do not put service-account private keys or other privileged credentials in the mobile app.

## 4. Build an Android APK
Google OAuth requires the app's custom URI scheme, so use a development/standalone build for sign-in testing rather than Expo Go.

1. Install dependencies: `npm install`.
2. Install EAS CLI: `npm install -g eas-cli`.
3. Sign in and link the app to your Expo account:
   ```bash
   eas login
   eas init
   ```
   Keep the generated `extra.eas.projectId` in `app.json` and commit that change.
4. Add the environment variables above to the **preview** environment in the Expo dashboard (or use EAS environment variables).
5. Build the installable APK:
   ```bash
   eas build --platform android --profile preview
   ```
6. Download the APK from the EAS build page and install it on an Android device.

For a Play Store release, use:
```bash
eas build --platform android --profile production
```
This creates an Android App Bundle (AAB), not an APK.

## 5. GitHub Actions build
The repository includes:
- `.github/workflows/ci.yml`: runs dependency compatibility and TypeScript checks on pushes and pull requests.
- `.github/workflows/android-apk.yml`: manually builds a preview APK.

To use the APK workflow:
1. Create an Expo access token in your Expo account.
2. In GitHub, open **Settings → Secrets and variables → Actions**.
3. Add a repository secret named `EXPO_TOKEN`.
4. Link the project with `eas init` and commit the `extra.eas.projectId` generated in `app.json`.
5. Add the Firebase and Google OAuth values to the Expo **preview** environment.
6. Open **Actions → Build Android APK → Run workflow**.

## 6. Firestore data security
The included `firestore.rules` allows users to read/write only under `users/{theirUid}`. It validates the fields and basic sizes for calculation and record documents. Deploy these rules before enabling cloud sync. Never use open rules such as `allow read, write: if true`.

## Development
```bash
npm install
npx expo start
npm run typecheck
``

Expo Go can be used to preview the basic calculator UI. Use an EAS development or preview build to test Google OAuth on a real device.

## Remaining account-owner setup
The application code, offline queue, Firestore security rules, and build workflows are in the repository. A few external resources must still be provisioned in accounts you own; this is an unavoidable trust boundary, not unfinished app code:
- Create the Firebase project, enable Google Authentication, create Firestore, and deploy `firestore.rules`.
- Create Google OAuth client IDs in the same Google Cloud project and register the Android signing certificate fingerprint generated by EAS.
- Link this Expo app with `eas init`, commit the generated `extra.eas.projectId`, and configure the public Firebase/OAuth values in the EAS `preview` and `production` environments.
- Add the Expo access token as the GitHub Actions secret `EXPO_TOKEN` before using the APK workflow.

The app retries queued cloud operations on network reconnection and when returning to the foreground. It does not run a background worker while the operating system has suspended or terminated the app; queued work resumes on the next active launch. If the same item is edited independently on multiple devices while offline, the latest successful Firestore write wins. A full collaborative conflict-resolution interface and background execution while the app is terminated are not provided by this mobile client.
