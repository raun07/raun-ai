import { useEffect, useRef, useState } from "react";

const API_BASE_URL = "http://127.0.0.1:8000";

function normalizeVideoUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [finalUrl, setFinalUrl] = useState(null);
  const [localFinalUrl, setLocalFinalUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const fetchStatus = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/status/${id}`);
      const data = await res.json();

      setStatus(data.status);
      setProgress(data.progress ?? 0);
      setMessage(data.message ?? "");

      if (data.status === "completed") {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (data.video_url || data.local_video_url) {
          setFinalUrl(normalizeVideoUrl(data.video_url));
          setLocalFinalUrl(normalizeVideoUrl(data.local_video_url));
          setMessage("Video ready!");
          setLoading(false);
        } else {
          fetchResult(id);
        }
      }

      if (data.status === "failed") {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setError(data.error || data.message || "Video generation failed.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to fetch job status.");
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setLoading(false);
    }
  };

  const fetchResult = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/result/${id}`);
      const data = await res.json();
      if (data.status === "completed") {
        setFinalUrl(normalizeVideoUrl(data.video_url));
        setLocalFinalUrl(normalizeVideoUrl(data.local_video_url));
        setMessage("Video ready!");
      } else if (data.status === "failed") {
        setError(data.error || "Generation failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to fetch video result.");
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (id) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    fetchStatus(id);
    intervalRef.current = setInterval(() => {
      fetchStatus(id);
    }, 2000);
  };

  const generateReel = async () => {
    setError(null);
    setFinalUrl(null);
    setLocalFinalUrl(null);
    setJobId(null);
    setStatus(null);
    setProgress(0);
    setMessage("");

    if (!prompt.trim()) {
      setError("Please enter a prompt first.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (data.job_id) {
        setJobId(data.job_id);
        setStatus(data.status || "queued");
        setProgress(data.progress ?? 0);
        setMessage(data.message ?? "Queued");
        startPolling(data.job_id);
      } else {
        setError("Failed to start generation.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Unable to start generation.");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "#0a0a0a",
        minHeight: "100vh",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <h1>🎬 Prompt to Reel</h1>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter cinematic prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{
            padding: "10px",
            width: "300px",
            borderRadius: "8px",
            border: "none",
            outline: "none",
          }}
        />

        <button
          onClick={generateReel}
          disabled={loading}
          style={{
            marginLeft: "10px",
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: loading ? "#777" : "#ff4d4d",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "#330000",
            border: "1px solid #ff4d4d",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "20px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {jobId && (
        <div
          style={{
            marginBottom: "20px",
            padding: "20px",
            background: "#111",
            borderRadius: "12px",
          }}
        >
          <h2>Job status</h2>
          <p>
            <strong>ID:</strong> {jobId}
          </p>
          <p>
            <strong>Status:</strong> {status}
          </p>
          <p>
            <strong>Message:</strong> {message}
          </p>
          <div
            style={{
              height: "16px",
              width: "100%",
              background: "#222",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress}%`,
                background: "#00c853",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <p style={{ marginTop: "8px" }}>{progress}%</p>
        </div>
      )}

      {finalUrl && (
        <div style={{ marginTop: "20px" }}>
          <h2>🎉 Final Reel Ready</h2>
          <video controls style={{ width: "100%", marginBottom: "12px" }}>
            <source src={finalUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <p>
            <strong>Cloud URL:</strong>{" "}
            <a href={finalUrl} target="_blank" rel="noreferrer">
              {finalUrl}
            </a>
          </p>
          {localFinalUrl && (
            <p>
              <strong>Local URL:</strong>{" "}
              <a href={localFinalUrl} target="_blank" rel="noreferrer">
                {localFinalUrl}
              </a>
            </p>
          )}
          <a
            href={finalUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              background: "#00c853",
              color: "white",
              borderRadius: "8px",
              textDecoration: "none",
            }}
          >
            View / Download Video
          </a>
          {localFinalUrl && (
            <a
              href={localFinalUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                marginLeft: "10px",
                padding: "10px 20px",
                background: "#1565c0",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
              }}
            >
              Open Local Copy
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
