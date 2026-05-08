# 🎉 Birthday Party Playlist

A collaborative playlist app for the party. Guests sign in with Google, search Spotify, add songs, and upvote/downvote each other's picks. Each person can add up to **5 songs**. Live updates across all devices.

## Stack

- **Frontend**: Vite + React + TypeScript, deployed to Firebase Hosting
- **Backend**: Firebase Cloud Functions (Spotify proxy + transactional `addSong`)
- **DB**: Firestore (`songs`, `users`, `userVotes`)
- **Auth**: Firebase Auth — Google sign-in
- **Stats**: Recharts (genre piechart, BPM histogram, top contributors, totals)
- BPM lookups via [GetSongBPM](https://getsongbpm.com) (free, attribution shown in footer)
- **CI/CD**: GitHub Actions auto-deploys on push to `main`

## One-time setup

The Firebase project (`musiq-d6dd3`) and Spotify app are already wired into the code. You still need to do a few things by hand.

### 1. Set Cloud Functions secrets (only your laptop sees these)

```bash
npm install -g firebase-tools
firebase login
firebase use musiq-d6dd3

firebase functions:secrets:set SPOTIFY_CLIENT_ID
# paste: 67dba1fb82c845f39bfaeb92f6b4f802

firebase functions:secrets:set SPOTIFY_CLIENT_SECRET
# paste: <your secret — see the chat where you pasted it>

firebase functions:secrets:set GETSONGBPM_API_KEY
# paste: <key from https://getsongbpm.com/api>
```

> ⚠️ The Spotify client secret should never be committed. Rotate it after the party.

### 2. Enable Firebase services (one-time, in console)

In https://console.firebase.google.com/project/musiq-d6dd3 — confirm:
- **Blaze plan** is active (required for Cloud Functions; free tier covers party traffic)
- **Authentication → Google** sign-in is enabled
- **Firestore** is created (production mode)
- **Hosting** is initialized

### 3. Set up GitHub Actions auto-deploy

a. Generate a Firebase service-account JSON:

```bash
# In the GCP console for the same project:
#   IAM & Admin → Service Accounts → Create
#   Roles: Firebase Admin SDK Administrator Service Agent,
#          Cloud Functions Admin, Firebase Hosting Admin,
#          Cloud Datastore User, Service Account User
# Then create a JSON key and download it.
```

A faster shortcut is using the existing default service account (`firebase-adminsdk-...@musiq-d6dd3.iam.gserviceaccount.com`) and generating a new key for it.

b. In GitHub → repo Settings → Secrets and variables → Actions → New repository secret:

- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: paste the **entire JSON** of the service-account key

c. Push to `main` — `.github/workflows/deploy.yml` builds and deploys hosting + functions + firestore rules automatically.

### 4. First-time manual deploy (recommended)

The CI run will work, but doing one local deploy first lets you verify everything before tomorrow:

```bash
cd web && npm install && npm run build && cd ..
cd functions && npm install && npm run build && cd ..
firebase deploy
```

Then share the Hosting URL (https://musiq-d6dd3.web.app) with your guests.

## Local dev

```bash
cd web && npm install && npm run dev
```

The dev server uses your live Cloud Functions and Firestore — no emulator needed.

## Data model

```
songs/{spotifyTrackId}
  trackId, name, artists[], artistNames, album, coverUrl, previewUrl,
  durationMs, explicit, genres[], bpm, addedBy{uid,name,photoURL},
  addedAt, score

users/{uid}
  songCount, displayName, photoURL

userVotes/{uid}
  votes: { [trackId]: 1 | -1 }
```

- Doc ID = Spotify track ID → **duplicate detection is automatic**.
- 5-song cap enforced inside the `addSong` Cloud Function (transactional).
- Vote + score updates happen in a single client transaction against Firestore.

## What's NOT included (and why)

- **Real-time playback control** — guests are seeding the playlist ahead of time. On party night, log into Spotify on your speaker and queue the top-voted songs.
- **Song removal** — keep it social. If something must go, delete it from the Firebase console.
