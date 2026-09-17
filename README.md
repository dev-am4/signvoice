# SignVoice

Real-time camera prototype for a Sign → Text → Voice accessibility workflow.

## V1 features

- Live camera via `getUserMedia`
- On-device hand landmark + gesture recognition with MediaPipe Tasks Vision
- Two-hand landmark overlay
- Thai text mapping for prototype gestures
- Thai browser Text-to-Speech
- Confidence indicator
- Demo-word mode for UI/voice testing before a Thai Sign Language model is connected
- Responsive dark accessibility-first UI
- SVG favicon + web manifest

## Important

V1 uses MediaPipe's standard gesture recognizer to validate the product pipeline. It is **not yet a full Thai Sign Language translator**. A production Thai Sign Language system should use a dedicated temporal/sequence model trained and evaluated with Thai Sign Language data.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and allow camera access. Production camera access should use HTTPS.

## Build

```bash
npm run build
```
