import { useEffect, useRef, useState } from "react";

const FORMAT_LABELS = { portrait: "9:16", landscape: "16:9", square: "1:1" };

function makeDownloadFilename(prompt, fmt) {
  const base =
    (prompt || "reel")
      .split(/\s+/)
      .slice(0, 4)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") || "reel";
  return fmt ? `${base}-${fmt}.mp4` : `${base}.mp4`;
}

export default function VideoPlayer({ videoUrl, prompt, formatUrls = {} }) {
  const fmtKeys = Object.keys(formatUrls);
  const hasFormats = fmtKeys.length > 1;
  const [activeFmt, setActiveFmt] = useState(fmtKeys[0] || null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef(null);

  // activeUrl must be derived before the effect that depends on it
  const activeUrl =
    hasFormats && activeFmt && formatUrls[activeFmt]
      ? formatUrls[activeFmt]
      : videoUrl;

  // React silently ignores the `muted` prop on <video> (React bug #6544).
  // Set it imperatively via the DOM element every time the src changes.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    const sync = () => setIsMuted(el.muted);
    el.addEventListener("volumechange", sync);
    return () => el.removeEventListener("volumechange", sync);
  }, [activeUrl]);

  if (!videoUrl) return null;

  const handleShareX = () => {
    const preview = (prompt || "").slice(0, 80);
    const text = `I made this with AI in 30 seconds 🎬\n\n"${preview}"\n\n${activeUrl}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(activeUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(activeUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = makeDownloadFilename(prompt, activeFmt);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(activeUrl, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(false);
    }
  };

  const btnBase = {
    padding: "10px 18px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.14)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    color: "#fff",
  };

  return (
    <div style={{ textAlign: "left" }}>
      {hasFormats && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {fmtKeys.map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setActiveFmt(fmt)}
              style={{
                ...btnBase,
                padding: "6px 14px",
                fontSize: "13px",
                background: activeFmt === fmt ? "#6c47ff" : "#1f2937",
                border:
                  activeFmt === fmt
                    ? "1px solid #6c47ff"
                    : "1px solid rgba(255,255,255,0.14)",
              }}
            >
              {FORMAT_LABELS[fmt] || fmt}
            </button>
          ))}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <video
          ref={videoRef}
          key={activeUrl}
          src={activeUrl}
          controls
          playsInline
          style={{ width: "100%", borderRadius: "14px", marginBottom: "14px", display: "block" }}
        />
        {isMuted && (
          <button
            type="button"
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = false;
                videoRef.current.volume = 1;
              }
            }}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "rgba(0,0,0,0.7)",
              border: "none",
              borderRadius: "8px",
              color: "#fff",
              padding: "6px 12px",
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            🔇 Tap to unmute
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleShareX}
          style={{ ...btnBase, background: "#0f1419" }}
        >
          Share on X
        </button>

        <button
          type="button"
          onClick={handleCopy}
          style={{ ...btnBase, background: copied ? "#166534" : "#1f2937" }}
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          style={{
            ...btnBase,
            background: downloading ? "#555" : "#00c853",
            cursor: downloading ? "not-allowed" : "pointer",
          }}
        >
          {downloading ? "Downloading…" : "Download"}
        </button>
      </div>
    </div>
  );
}
