# SyncCalc

A mobile-first calculator with Google sign-in, calculation history, and a personal record book. Built with Expo / React Native, TypeScript, Firebase Authentication, and Cloud Firestore.

## Features
- Standard arithmetic calculator with brackets, percentages, powers, and safe expression parsing.
- Automatically saves each completed calculation.
- Calculation history; tap an entry to reuse its expression.
- Personal record book for amounts, titles, and notes.
- Local persistence with AsyncStorage; user-scoped cloud collections when signed in.
- Android and iOS support through Expo.

## Setup
1. Install Node.js LTS and run `npm install`.
2. Copy `.env.example` to `.env` and fill in Firebase and Google OAuth values.
3. In Firebase Console, create a project. Enable **Authentication → Google** and create a **Cloud Firestore** database.
4. Register Android package `com.hbabaldu.synccalc` and iOS bundle ID `com.hbabaldu.synccalc` in Firebase. Add SHA-1/SHA-256 fingerprints for Android builds.
5. Create Google OAuth client IDs in Google Cloud Console for Web, Android, and iOS. Put each ID in the matching environment variable.
6. Run `npx expo start`, then open the project in Expo Go or a development build.

## Firestore security rules
Publish rules that restrict each user to their own data:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Important
Firebase credentials are deliberately not included. Configure them in your local `.env` file and never commit secrets. Google sign-in requires valid OAuth client IDs and registered app identifiers. Local data remains available without signing in; cloud sync starts after Google sign-in.

## Run
```bash
npm install
npx expo start
npm run typecheck
```
