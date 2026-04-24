import { useRef, useState, useCallback, useEffect } from "react";


// ─── Speech helper ────────────────────────────────────────────────────────────
const COOLDOWN_MS = 4000;
const cooldowns = {};

function speak(text, force = false) {
  if (!text) return;
  const now = Date.now();
  if (!force && cooldowns[text] && now - cooldowns[text] < COOLDOWN_MS) return;
  cooldowns[text] = now;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.92;
  utt.pitch = 1.0;
  utt.volume = 1.0;
  window.speechSynthesis.speak(utt);
  return utt;
}

// ─── Parse Roboflow prediction data ──────────────────────────────────────────
function parsePredictions(data) {
  let best = null;
  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    const cls  = obj.class ?? obj.label ?? obj.class_name ?? obj.predicted_class ?? obj.top;
    const conf = obj.confidence ?? obj.score ?? obj.probability ?? obj.top_confidence;
    if (cls && conf != null) {
      const c = parseFloat(conf);
      if (!best || c > best.conf) best = { label: String(cls), conf: c };
    }
    Object.values(obj).forEach(walk);
  }
  walk(data);
  return best;
}

// ─── Format raw label into human-readable currency ───────────────────────────
function formatLabel(raw) {
  const s = String(raw).replace(/[_-]/g, " ").trim();
  const lower = s.toLowerCase();
  const map = {
    "2000": "2000 rupees", "500": "500 rupees", "200": "200 rupees",
    "100":  "100 rupees",  "50":  "50 rupees",  "20":  "20 rupees",
    "10":   "10 rupees",   "5":   "5 rupees",   "2":   "2 rupees",  "1": "1 rupee",
    "100 dollar": "100 dollars", "50 dollar": "50 dollars",
    "20 dollar":  "20 dollars",  "10 dollar": "10 dollars",
    "5 dollar":   "5 dollars",   "1 dollar":  "1 dollar",
  };
  for (const [k, v] of Object.entries(map)) {
    if (lower.includes(k)) return v;
  }
  return s;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  app: {
    minHeight: "100vh",
    background: "#0a0a0a",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    padding: "1.5rem 1rem 2rem",
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    gap: "1.25rem",
    color: "#f0ede8",
  },
  header: {
    textAlign: "center",
  },
  h1: {
    fontSize: "24px",
    fontWeight: "600",
    color: "#f0ede8",
    letterSpacing: "-0.02em",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#888",
    marginTop: "6px",
  },
  videoWrapper: {
    position: "relative",
    width: "100%",
    maxWidth: "480px",
    aspectRatio: "4/3",
    borderRadius: "16px",
    overflow: "hidden",
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  videoPlaceholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    color: "#555",
  },
  cameraIcon: {
    fontSize: "48px",
  },
  placeholderText: {
    fontSize: "14px",
  },
  liveBadge: {
    position: "absolute",
    top: "12px",
    left: "12px",
    background: "rgba(0,0,0,0.65)",
    color: "#fff",
    fontSize: "12px",
    padding: "4px 10px",
    borderRadius: "20px",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backdropFilter: "blur(4px)",
  },
  liveDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#22c55e",
  },
  detectionPanel: {
    width: "100%",
    maxWidth: "480px",
    background: "#141414",
    border: "1px solid #222",
    borderRadius: "16px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  detLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  detValue: {
    fontSize: "34px",
    fontWeight: "700",
    color: "#f0ede8",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "44px",
    lineHeight: 1.1,
  },
  speakingDot: (active) => ({
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "#22c55e",
    flexShrink: 0,
    opacity: active ? 1 : 0,
    transition: "opacity 0.2s",
  }),
  confRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#666",
  },
  confBg: {
    flex: 1,
    height: "3px",
    background: "#2a2a2a",
    borderRadius: "2px",
    overflow: "hidden",
  },
  confFill: (pct) => ({
    height: "100%",
    width: `${pct}%`,
    background: pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444",
    borderRadius: "2px",
    transition: "width 0.3s, background 0.3s",
  }),
  historyRow: {
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    minHeight: "28px",
  },
  pill: {
    fontSize: "12px",
    padding: "4px 12px",
    borderRadius: "20px",
    background: "#1e3a2a",
    color: "#4ade80",
    border: "1px solid #2d5c3f",
  },
  btnRow: {
    width: "100%",
    maxWidth: "480px",
    display: "flex",
    gap: "10px",
  },
  btnStart: {
    flex: 1,
    height: "56px",
    borderRadius: "14px",
    border: "none",
    background: "#22c55e",
    color: "#000",
    fontSize: "17px",
    fontWeight: "700",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "background 0.15s, transform 0.1s",
    letterSpacing: "-0.01em",
  },
  btnStop: {
    flex: 1,
    height: "56px",
    borderRadius: "14px",
    border: "none",
    background: "#ef4444",
    color: "#fff",
    fontSize: "17px",
    fontWeight: "700",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "background 0.15s, transform 0.1s",
    letterSpacing: "-0.01em",
  },
  btnRepeat: {
    width: "56px",
    height: "56px",
    borderRadius: "14px",
    border: "1px solid #2a2a2a",
    background: "#1a1a1a",
    color: "#f0ede8",
    fontSize: "22px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
    flexShrink: 0,
  },
  status: {
    fontSize: "13px",
    color: "#666",
    textAlign: "center",
    maxWidth: "480px",
    lineHeight: 1.5,
  },
  errorBox: {
    width: "100%",
    maxWidth: "480px",
    background: "#2a1010",
    border: "1px solid #5a1010",
    borderRadius: "12px",
    padding: "0.75rem 1rem",
    fontSize: "13px",
    color: "#f87171",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function CurrencyDetector() {
  const videoRef     = useRef(null);
  const connRef      = useRef(null);
  const uttRef       = useRef(null);
  const lastSpokenRef= useRef("");

  const [phase, setPhase]           = useState("idle"); // idle | connecting | streaming | stopped
  const [detected, setDetected]     = useState(null);   // { label, conf }
  const [speaking, setSpeaking]     = useState(false);
  const [history, setHistory]       = useState([]);
  const [error, setError]           = useState("");
  const [showRepeat, setShowRepeat] = useState(false);
  let lastLabel = null;
  let count = 0;
  // Announce on mount
 
useEffect(() => {
  if ("speechSynthesis" in window) {
    setTimeout(() => {
      speak("Welcome to Currency Detector. Press Start Camera to begin.", true);
    }, 500);
  }
}, []);
useEffect(() => {
  if (phase !== "streaming") return;

  const interval = setInterval(() => {
    captureAndDetect();
  }, 3000);

  return () => clearInterval(interval);
}, [phase]);

  const speakWithDot = useCallback((text, force = false) => {
    const utt = speak(text, force);
    if (!utt) return;
    setSpeaking(true);
    utt.onend = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    lastSpokenRef.current = text;
    setShowRepeat(true);
  }, []);

  const repeatLast = useCallback(() => {
    if (lastSpokenRef.current) speakWithDot(lastSpokenRef.current, true);
  }, [speakWithDot]);

  const handleData = useCallback((data) => {
    const best = parsePredictions(data);
    if (!best || best.conf < 0.35) return;
    const label = formatLabel(best.label);
    setDetected({ label, conf: best.conf });
    if (best.conf >= 0.55) {
      speakWithDot(label);
      setHistory(prev => {
        if (prev[0] === label) return prev;
        return [label, ...prev].slice(0, 5);
      });
    }
  }, [speakWithDot]);

  const handleDetection = (label) => {
  if (label === lastLabel) {
    count++;
  } else {
    lastLabel = label;
    count = 1;
  }

  if (count >= 3) {
    speak(label);
    count = 0;
  }
};

 const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    videoRef.current.srcObject = stream;

    setPhase("streaming"); // 🔥 THIS LINE IS CRITICAL

    speak("Camera started. Hold currency in front.");

  } catch (err) {
    speak("Camera error");
  }
};
const captureAndDetect = async () => {
    console.log("Running detection...");
    if (!videoRef.current || !videoRef.current.srcObject) return; 
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    const blob = await new Promise(resolve =>
        canvas.toBlob(resolve, "image/jpeg")
    );

    const formData = new FormData();
    formData.append("file", blob);

    try {
        const res = await fetch("http://localhost:5000/detect", {
        method: "POST",
        body: formData
        });

        const data = await res.json();
        console.log("API response:", data); // ✅ HERE
        // ❌ ignore empty
        if (!data.predictions || data.predictions.length === 0) return;

        // ✅ sort by confidence
        const sorted = data.predictions.sort(
        (a, b) => b.confidence - a.confidence
        );

        const best = sorted[0];

        // ❌ ignore weak predictions
        if (best.confidence < 0.6) return;

        // 👇 call stability handler instead of speaking directly
        handleDetection(best.class);

        if (data?.predictions?.length > 0) {
        const best = data.predictions[0];
        const label = formatLabel(best.class);

        setDetected({ label, conf: best.confidence });

        if (best.confidence > 0.6) {
            speakWithDot(label);
        }
        } else {
        speak("No currency detected");
        }

    } catch (err) {
        speak("Detection error");
    }
    
    };
  const stopCamera = useCallback(() => {
    connRef.current?.cleanup?.();
    connRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("stopped");
    setDetected(null);
    setSpeaking(false);
    speak("Camera stopped.", true);
  }, []);

  const confPct = detected ? Math.round(detected.conf * 100) : 0;

  return (
    <div style={styles.app} role="main">
      <h2 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        Currency detector for blind users — hold currency to camera to hear value
      </h2>

      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.h1}>Currency Detector</h1>
        <p style={styles.subtitle}>Hold a note or coin in front of the camera</p>
      </div>

      {/* Video */}
      <div style={styles.videoWrapper}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={styles.video}
          aria-label="Camera feed with live currency detection"
        />
        {phase !== "streaming" && (
          <div style={styles.videoPlaceholder}>
            <span style={styles.cameraIcon}>📷</span>
            <span style={styles.placeholderText}>
              {phase === "connecting" ? "Connecting…" : "Camera off"}
            </span>
          </div>
        )}
        {phase === "streaming" && (
          <div style={styles.liveBadge} aria-hidden="true">
            <div style={styles.liveDot} />
            Live
          </div>
        )}
      </div>

      {/* Detection panel */}
      <div style={styles.detectionPanel} aria-live="polite" aria-atomic="true">
        <span style={styles.detLabel}>Detected currency</span>
        <div style={styles.detValue}>
          <span style={styles.speakingDot(speaking)} aria-hidden="true" />
          {detected ? detected.label : "—"}
        </div>
        {detected && (
          <div style={styles.confRow}>
            <span>{confPct}% confidence</span>
            <div style={styles.confBg}>
              <div style={styles.confFill(confPct)} />
            </div>
          </div>
        )}
      </div>

      {/* History pills */}
      {history.length > 0 && (
        <div style={styles.historyRow} aria-label="Detection history">
          {history.map((h, i) => (
            <span key={i} style={styles.pill}>{h}</span>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <div style={styles.errorBox} role="alert">{error}</div>}

      {/* Buttons */}
      <div style={styles.btnRow}>
        {phase === "streaming" ? (
          <button
            style={styles.btnStop}
            onClick={stopCamera}
            aria-label="Stop camera and detection"
          >
            Stop Camera
          </button>
        ) : (
          <button
            style={styles.btnStart}
            onClick={startCamera}
            disabled={phase === "connecting"}
            aria-label="Start camera and currency detection"
          >
            {phase === "connecting" ? "Connecting…" : "Start Camera"}
          </button>
        )}
        {showRepeat && (
          <button
            style={styles.btnRepeat}
            onClick={repeatLast}
            aria-label="Repeat last spoken currency value"
            title="Repeat last announcement"
          >
            🔊
          </button>
        )}
      </div>

      <p style={styles.status}>
        {phase === "idle"       && "Press Start Camera to begin"}
        {phase === "connecting" && "Opening camera and connecting to detection server…"}
        {phase === "streaming"  && "Active — hold currency in front of the camera"}
        {phase === "stopped"    && "Camera stopped — press Start Camera to resume"}
      </p>
    </div>
  );
}

export default CurrencyDetector;