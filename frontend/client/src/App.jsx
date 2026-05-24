import { useEffect, useRef, useState } from "react";
import Hero from "./components/Hero.jsx";
import PromptBox from "./components/PromptBox.jsx";
import ProgressBar from "./components/ProgressBar.jsx";
import VideoPlayer from "./components/VideoPlayer.jsx";
import "./App.css";

const API = "http://127.0.0.1:8000";

function normalizeVideoUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API}${url}`;
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("Ready to generate your first reel.");
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const clearPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const fetchStatus = async (id) => {
    try {
      const res = await fetch(`${API}/status/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Unable to fetch status.");
      }

      setStatus(data.status || "processing");
      setProgress(data.progress ?? 0);
      setMessage(data.message || "Checking progress...");

      if (data.status === "completed" || data.status === "rendering_complete") {
        clearPolling();
        fetchResult(id);
      }

      if (data.status === "failed") {
        clearPolling();
        setIsLoading(false);
        setError(data.error || data.message || "Video generation failed.");
      }
    } catch (err) {
      clearPolling();
      setIsLoading(false);
      setError(err.message || "Unable to fetch job status.");
    }
  };

  const fetchResult = async (id) => {
    try {
      const res = await fetch(`${API}/result/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || "Unable to fetch result.");
      }

      if (data.status === "completed" || data.status === "rendering_complete") {
        setVideoUrl(normalizeVideoUrl(data.video_url));
        setMessage("Your reel is ready.");
      } else {
        throw new Error(data.error || data.message || "Video result is not ready.");
      }
    } catch (err) {
      setError(err.message || "Unable to fetch video result.");
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = (id) => {
    clearPolling();
    fetchStatus(id);
    intervalRef.current = setInterval(() => fetchStatus(id), 2000);
  };

  const resetState = () => {
    clearPolling();
    setPrompt("");
    setJobId("");
    setStatus("idle");
    setProgress(0);
    setMessage("Ready to generate your first reel.");
    setVideoUrl("");
    setError("");
    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please describe your reel to continue.");
      return;
    }

    setError("");
    setIsLoading(true);
    setMessage("Starting your cinematic reel...");

    try {
      const res = await fetch(`${API}/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok || !data.job_id) {
        throw new Error(data.detail || data.error || data.message || "Failed to start generation.");
      }

      setJobId(data.job_id);
      setStatus(data.status || "queued");
      setProgress(data.progress ?? 0);
      setMessage(data.message || "Queued for generation.");
      startPolling(data.job_id);
    } catch (err) {
      setError(err.message || "Unable to start generation.");
      setIsLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="page-shell">
        <Hero />

        <div className="content-grid">
          <PromptBox
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            disabled={isLoading}
            isLoading={isLoading}
          />

          {error && (
            <div className="notification error">
              <p>{error}</p>
              <div className="video-actions">
                <button
                  className="secondary-button"
                  onClick={() => {
                    setError("");
                    if (jobId) {
                      startPolling(jobId);
                      setIsLoading(true);
                    } else {
                      handleGenerate();
                    }
                  }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {(isLoading || status !== "idle") && !videoUrl && (
            <ProgressBar progress={progress} statusMessage={message} status={status} />
          )}

          {videoUrl && (
            <VideoPlayer videoUrl={videoUrl} onReset={resetState} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
