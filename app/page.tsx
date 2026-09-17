"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilesetResolver, GestureRecognizer, type GestureRecognizerResult } from "@mediapipe/tasks-vision";

type Detection = {
  raw: string;
  thai: string;
  confidence: number;
};

const GESTURE_MAP: Record<string, string> = {
  Open_Palm: "สวัสดี",
  Closed_Fist: "หยุด",
  Thumb_Up: "ตกลง",
  Thumb_Down: "ไม่ตกลง",
  Victory: "ขอบคุณ",
  Pointing_Up: "ขอความช่วยเหลือ",
  ILoveYou: "ฉันรักคุณ"
};

const DEMO_WORDS = [
  "สวัสดี",
  "ขอบคุณ",
  "ช่วยด้วย",
  "ห้องน้ำ",
  "โรงพยาบาล",
  "หิว",
  "เจ็บ",
  "ใช่",
  "ไม่ใช่",
  "กลับบ้าน"
];

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]
];

function speaker(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "th-TH";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastAcceptedRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const [cameraOn, setCameraOn] = useState(false);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState("");
  const [detection, setDetection] = useState<Detection | null>(null);
  const [sentence, setSentence] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [demoMode, setDemoMode] = useState(false);

  const drawHands = useCallback((result: GestureRecognizerResult) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = Math.max(2, width / 500);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(85, 244, 206, 0.82)";
    ctx.fillStyle = "rgba(152, 255, 229, 0.96)";

    for (const landmarks of result.landmarks ?? []) {
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (!pa || !pb) continue;
        ctx.beginPath();
        ctx.moveTo(pa.x * width, pa.y * height);
        ctx.lineTo(pb.x * width, pb.y * height);
        ctx.stroke();
      }
      for (const p of landmarks) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, Math.max(3.2, width / 260), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);

  const acceptGesture = useCallback((result: GestureRecognizerResult) => {
    const category = result.gestures?.[0]?.[0];
    if (!category || category.categoryName === "None") {
      setDetection(null);
      return;
    }

    const confidence = category.score ?? 0;
    const thai = GESTURE_MAP[category.categoryName];
    if (!thai || confidence < 0.65) {
      setDetection({ raw: category.categoryName, thai: "กำลังวิเคราะห์...", confidence });
      return;
    }

    setDetection({ raw: category.categoryName, thai, confidence });
    const now = Date.now();
    const recent = lastAcceptedRef.current;
    if (recent.text === thai && now - recent.at < 1600) return;

    lastAcceptedRef.current = { text: thai, at: now };
    setSentence((current) => current ? `${current} ${thai}` : thai);
    if (autoSpeak) speaker(thai);
  }, [autoSpeak]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const recognizer = recognizerRef.current;
    if (!video || !recognizer || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      const result = recognizer.recognizeForVideo(video, performance.now());
      drawHands(result);
      acceptGesture(result);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [acceptGesture, drawHands]);

  const loadRecognizer = useCallback(async () => {
    if (recognizerRef.current) return recognizerRef.current;
    setLoadingModel(true);
    setError("");
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm"
      );
      const recognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55
      });
      recognizerRef.current = recognizer;
      setModelReady(true);
      return recognizer;
    } catch (e) {
      console.error(e);
      setError("โหลดโมเดลตรวจจับมือไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่");
      throw e;
    } finally {
      setLoadingModel(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError("");
    try {
      await loadRecognizer();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: false
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCameraOn(true);
      lastVideoTimeRef.current = -1;
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
      setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาต Camera permission และเปิดเว็บผ่าน HTTPS");
    }
  }, [loadRecognizer, loop]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setCameraOn(false);
    setDetection(null);
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recognizerRef.current?.close();
  }, []);

  const addDemoWord = (word: string) => {
    setDetection({ raw: "Demo", thai: word, confidence: 0.98 });
    setSentence((current) => current ? `${current} ${word}` : word);
    if (autoSpeak) speaker(word);
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandmark" aria-hidden="true">SV</div>
          <div>
            <strong>SignVoice</strong>
            <span>Sign → Text → Voice</span>
          </div>
        </div>
        <div className="statusPill">
          <span className={`dot ${modelReady ? "ready" : ""}`} />
          {modelReady ? "AI พร้อมทำงาน" : loadingModel ? "กำลังโหลด AI" : "AI ยังไม่เริ่ม"}
        </div>
      </header>

      <section className="heroCopy">
        <p className="eyebrow">REAL-TIME ACCESSIBILITY</p>
        <h1>ให้มือของคุณ<br /><span>กลายเป็นเสียง</span></h1>
        <p className="lead">ต้นแบบเว็บสำหรับตรวจจับท่าทางมือผ่านกล้อง แสดงเป็นข้อความ และอ่านออกเสียงภาษาไทยแบบเรียลไทม์</p>
      </section>

      <section className="workspace">
        <div className="cameraCard">
          <div className="cameraHeader">
            <div>
              <span className={`liveDot ${cameraOn ? "on" : ""}`} />
              {cameraOn ? "LIVE CAMERA" : "CAMERA OFF"}
            </div>
            <button className="ghostButton" onClick={() => setDemoMode((v) => !v)}>
              {demoMode ? "ซ่อนโหมดทดสอบ" : "โหมดทดสอบคำ"}
            </button>
          </div>

          <div className="cameraStage">
            <video ref={videoRef} playsInline muted className={cameraOn ? "visible" : ""} />
            <canvas ref={canvasRef} />
            {!cameraOn && (
              <div className="cameraEmpty">
                <div className="handGlyph">✋</div>
                <h2>พร้อมเริ่มแปลท่าทาง</h2>
                <p>วางมือและช่วงลำตัวให้อยู่ในกรอบกล้อง</p>
                <button className="primaryButton" onClick={startCamera} disabled={loadingModel}>
                  {loadingModel ? "กำลังเตรียม AI..." : "เปิดกล้อง"}
                </button>
              </div>
            )}
            {cameraOn && (
              <button className="stopButton" onClick={stopCamera}>ปิดกล้อง</button>
            )}
            <div className="scanFrame" aria-hidden="true"><i /><i /><i /><i /></div>
          </div>

          {error && <div className="errorBox">{error}</div>}

          {demoMode && (
            <div className="demoPanel">
              <p>กดคำเพื่อทดสอบ UI + เสียง ก่อนเชื่อมโมเดลภาษามือไทยจริง</p>
              <div className="demoWords">
                {DEMO_WORDS.map((word) => <button key={word} onClick={() => addDemoWord(word)}>{word}</button>)}
              </div>
            </div>
          )}
        </div>

        <aside className="resultPanel">
          <div className="resultTop">
            <span>คำที่ตรวจพบ</span>
            <div className="confidence">
              {detection ? `${Math.round(detection.confidence * 100)}%` : "—"}
            </div>
          </div>

          <div className="currentWord">
            <small>{detection?.raw ?? "WAITING"}</small>
            <strong>{detection?.thai ?? "รอภาษามือ..."}</strong>
            <div className="confidenceBar"><span style={{ width: detection ? `${Math.round(detection.confidence * 100)}%` : "0%" }} /></div>
          </div>

          <div className="sentenceBox">
            <div className="sentenceLabel">ข้อความ</div>
            <p>{sentence || "ข้อความที่แปลได้จะแสดงตรงนี้"}</p>
          </div>

          <div className="actions">
            <button className="speakButton" onClick={() => sentence && speaker(sentence)} disabled={!sentence}>🔊 พูดข้อความ</button>
            <button className="clearButton" onClick={() => setSentence("")} disabled={!sentence}>ล้าง</button>
          </div>

          <label className="switchRow">
            <span>
              <strong>พูดอัตโนมัติ</strong>
              <small>อ่านคำเมื่อระบบตรวจพบ</small>
            </span>
            <input type="checkbox" checked={autoSpeak} onChange={(e) => setAutoSpeak(e.target.checked)} />
            <i />
          </label>

          <div className="privacyNote">
            <span>●</span>
            <div><strong>ประมวลผลบนอุปกรณ์</strong><br />วิดีโอกล้องใช้สำหรับการตรวจจับในเบราว์เซอร์ ไม่ถูกบันทึกโดยเว็บนี้</div>
          </div>
        </aside>
      </section>

      <section className="notice">
        <strong>สถานะ V1</strong>
        <p>ตอนนี้ระบบใช้โมเดล Gesture Recognition มาตรฐานเพื่อทดสอบ pipeline กล้อง → AI → ข้อความ → เสียง ยังไม่ควรถือว่าเป็นตัวแปลภาษามือไทยเต็มรูปแบบ ขั้นถัดไปคือฝึก/เชื่อมโมเดล Thai Sign Language แบบ sequence</p>
      </section>

      <footer>SignVoice V1 · Built for real-time accessible communication</footer>
    </main>
  );
}
