# GuardianCam

Two apps + one API:
- Backend (Node/Express) with Firebase Admin for auth/user data and push token storage
- Frontend-web (React) with LiveKit viewer/broadcaster and push test panel
- Frontend-mobile (React Native + LiveKit RN) with two tabs: Live Stream and Profile

## Quick Start

### 0) Requirements
- Node 18+
- Android Studio / Xcode if building mobile
- Firebase Admin service key (Backend/firebase-key.json) — keep out of git

### 1) Backend (port 5000)
```bash
cd Backend
npm install
npm run start   # or: npm run dev (nodemon)
```
Important envs (use env file or shell):
- LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
- JWT_SECRET

### 2) Web (port 3000)
```bash
cd Frontend-web
npm install
npm start
```
Routes: `/dashboard`, `/livekit/broadcast`, `/livekit/view-guest`.

### 3) Mobile
```bash
cd Frontend-mobile
npm install

# Build dev client once per platform
npm run android   # or: npm run ios

# Start bundler
npm start          # sets EXPO_PUBLIC_* to your LAN IP
# or for Android emulator specifically
npm run start:emu  # uses http://10.0.2.2 for backend/web
# iOS simulator
npm run start:ios-sim
```
Live tab uses the native LiveKit SDK and also shows an “Open LiveKit in Browser” button for troubleshooting.

## Push Notifications (Expo)
- Mobile obtains an Expo push token and saves it via `POST /api/push/token` (auth required)
- Web `PushTest` auto-fills the token with `GET /api/push/token` and can send via `POST /api/push/send`

## Backend API (selected)
- `GET /health`
- `GET /api/push/token` → { uid, lastExpoToken, tokens }
- `POST /api/push/token` → { ok: true }
- `GET /api/livekit/token?room=...&identity=...&role=viewer|broadcaster` → { token, url }

## Project Scripts (summary)
- Backend: `npm run start`, `npm run dev`
- Web: `npm start`
- Mobile: `npm start`, `npm run start:emu`, `npm run start:ios-sim`, `npm run android`, `npm run ios`

## Security & Git Hygiene
Secrets must not be committed. Repo `.gitignore` excludes:
- Backend/firebase-key.json
- Frontend-mobile/google-services.json and android/app/google-services.json
- iOS GoogleService-Info.plist, Android keystores

If secrets were pushed previously:
1) Remove from index and commit
```bash
git rm --cached Backend/firebase-key.json Frontend-mobile/google-services.json Frontend-mobile/android/app/google-services.json || true
git commit -m "Remove secrets from repo and enforce ignore"
```
2) Rotate keys in their consoles (Firebase/Google Cloud → create new, revoke old)
3) Optional history purge (destructive; push with --force):
```bash
npx git-filter-repo --path Backend/firebase-key.json --path Frontend-mobile/google-services.json --path Frontend-mobile/android/app/google-services.json --invert-paths
git push --force
```

## Troubleshooting
- Mobile “Network Error” on emulator with `npm start`: ensure backend is reachable on your LAN. Prefer `npm run start:emu` if unsure.
- LiveKit stuck “connecting”: make sure desktop broadcaster `/livekit/broadcast` is live and LiveKit envs are set on backend.

## License
MIT
