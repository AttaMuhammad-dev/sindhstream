# GestEra

GestEra is a touchless study workspace built around an AI whiteboard, webcam hand tracking, configurable gesture controls, classroom tools, and an AI tutor. This project is based on the supplied `sindhstreamproject` archive and keeps its whiteboard, classroom, authentication, Firebase, and Gemini features.

## Run the demo

Use Node.js 20.19 or newer, or Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

Open the local address printed in the terminal (the server defaults to `http://localhost:3000`). Camera access works on `localhost` or HTTPS. Allow the browser camera prompt and keep the hand visible in a well-lit area.

`npm install` copies the pinned MediaPipe WASM runtime into `public/mediapipe/wasm`. The hand landmark task file is loaded from Google Cloud Storage on the first camera start, so live tracking needs an internet connection unless you provide a local compatible model file.

To use a local model, place a compatible `hand_landmarker.task` file in `public` and add this to `.env`:

```dotenv
VITE_HAND_MODEL_URL=/hand_landmarker.task
```

Gemini features use the server-side `GEMINI_API_KEY` in `.env`. Firebase authentication and cloud sync require the project's Firebase configuration; the app still supports local project storage without signing in.

## Gestures and controls

Open **Settings → Customizable Gesture Controls** to bind each detected gesture to an available GestEra action. You can set the writing trigger to thumb/index pinch, thumb/middle pinch, or hold-index. Settings include hand-recognition confidence, pinch distance, smoothing, swipe threshold, action cooldown, and two-hand zoom sensitivity. **Live Gesture Tester** shows current recognition and pinch distance.

The canvas supports drawing, pointer movement, erasing, page navigation, undo/redo, clear confirmation, AI solver, presentation laser, and zoom. Gesture-triggered actions are held once per gesture and honor the configured cooldown; drawing, pause, laser, and two-hand zoom remain continuous while their gesture is active.

Hand inference runs in a Web Worker at a paced 24 FPS, with camera frames reduced to 640 pixels wide before processing. That keeps vision work off the UI thread while retaining normalized coordinates for the board. The runtime and WASM files are local to the app; only the model file is remote by default.

## Project commands

```bash
npm run dev       # Start GestEra with the Express/Vite development server
npm run build     # Type-check and create the production build
npm run preview   # Preview the built client
npm start         # Run the server in production mode
```

## Main areas

- `src/core/gestureEngine.ts` — gesture classification, pinch hysteresis, filtering, and action mapping.
- `src/services/handTrackingService.ts` — camera lifecycle, worker coordination, frame pacing, and state updates.
- `src/services/handTracking.worker.ts` — local MediaPipe runtime and background hand inference.
- `src/components/settings/SettingsView.tsx` — gesture bindings and accuracy controls.
- `src/components/whiteboard/WhiteboardWorkspace.tsx` — board tools and gesture action dispatch.
- `server.ts` and `server/geminiEducation.ts` — AI service endpoints.
