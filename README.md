# SoundWave

A music streaming web app built with React, TypeScript, Vite, Firebase, and the SoundWave music API.

## Firebase setup

The app reads Firebase Web SDK configuration from Vite environment variables so each deployment or fork can use its own Firebase project.

1. Create a Firebase project and register a Web app.
2. Enable the sign-in providers used by the app in **Authentication**.
3. Create or select the Firestore database you want the app to use.
4. Copy `.env.example` to `.env.local` and fill in the values from your Firebase Web app and Firestore database.

For local development on Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Then install dependencies and start the development server using the package manager you use for the project. To check the production bundle, run:

```sh
bun run build
bun run lint
```

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | Yes | Firebase Web app API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Yes | Firebase Web app ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | No | Google Analytics measurement ID, if enabled |
| `VITE_FIRESTORE_DATABASE_ID` | Yes | Exact Firestore database ID, including `(default)` if that is the database being used |

## Deploying to Vercel

1. Import this repository into Vercel.
2. Add all required Firebase environment variables under **Project Settings → Environment Variables** for each environment you use (Production, Preview, and Development as needed).
3. Redeploy after changing environment variables.
4. In Firebase Authentication settings, add the deployed Vercel hostname to **Authorized domains**. Configure any Google OAuth consent and provider settings required by the selected sign-in methods.

The `VITE_*` variables are compiled into the browser bundle. Firebase Web configuration is public client configuration, **not a place for private keys**. Never put a Firebase Admin service-account key, private key, or other server secret in a `VITE_*` variable. Protect user data with correct Firestore Security Rules and configure App Check where appropriate.

## Music API

SoundWave uses the music API at `https://music-api.amanenime.my.id` for music search and playback. The API's availability and browser playback/CORS behavior are external dependencies.
