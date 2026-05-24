import { useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function SatisfactionDialog({ onLove, onNeedsWork, prompt, videoUrl }) {
  const [picked, setPicked] = useState(null);
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const handleLove = async () => {
    setPicked("love");
    onLove();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/enhance-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.suggestions)) {
        setVariations(data.suggestions);
      }
    } catch {
      /* variations stay empty */
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleShare = () => {
    const shareUrl = videoUrl || window.location.href;
    const text = `Check out this AI reel I made! 🎬\n\n"${(prompt || "").slice(0, 80)}"\n\n${shareUrl}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div style={{ animation: "ptr-fade-up 0.25s ease both" }}>
      <style>{`
        @keyframes ptr-fade-up {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-col gap-3">
        {picked === null ? (
          <>
            <p className="text-sm font-semibold text-foreground">How did it turn out?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleLove}
                className="flex-1 py-2.5 rounded-lg border border-border bg-background/60 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                👍 Love it
              </button>
              <button
                type="button"
                onClick={onNeedsWork}
                className="flex-1 py-2.5 rounded-lg border border-border bg-background/60 text-sm font-medium text-foreground hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
              >
                🔧 Needs work
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">Similar ideas to try:</p>

            {loading && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Generating variations...
              </p>
            )}

            {variations.length > 0 && (
              <div className="flex flex-col gap-2">
                {variations.map((v, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-background/60 p-2.5 flex flex-col gap-1.5"
                  >
                    <p className="text-xs text-foreground leading-relaxed">{v}</p>
                    <button
                      type="button"
                      onClick={() => handleCopy(v, i)}
                      className="self-end text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      {copiedIdx === i ? "Copied!" : "Copy"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleShare}
              className="w-full py-2 rounded-lg border border-border bg-background/60 text-sm font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              🔗 Share this reel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
