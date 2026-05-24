import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const POLL_INTERVAL_MS = 3000;

const FIX_BUTTONS = [
  { id: "regenerate",   icon: "🔄", label: "Regenerate",      desc: "Full re-render, same prompt" },
  { id: "extend",       icon: "⏱️", label: "Extend duration", desc: "More time per scene" },
  { id: "change_scene", icon: "🎬", label: "Change a scene",  desc: "Swap a Pexels clip" },
  { id: "new_music",    icon: "🎵", label: "New music",       desc: "Re-pick background track" },
  { id: "new_script",   icon: "📝", label: "New script",      desc: "Rewrite narration & structure" },
  { id: "ai_fix",       icon: "🤖", label: "Ask AI to fix",   desc: "Describe what's wrong" },
];

const SIMPLE_DESCRIPTIONS = {
  regenerate: "This will re-run the full pipeline with the same prompt and settings.",
  extend:     "The reel will be re-generated with longer durations per scene.",
  new_music:  "The pipeline will pick a different background music track.",
  new_script: "A fresh script will be written for the same theme and mood.",
};

export default function QuickFixPanel({ jobId, scenes, prompt, mood, orientation = "portrait", onFixApplied, getToken }) {
  const [activePanel, setActivePanel] = useState(null);
  const [aiFixText, setAiFixText] = useState("");
  const [aiFixLoading, setAiFixLoading] = useState(false);
  const [aiFixResult, setAiFixResult] = useState(null);
  const [replacingScene, setReplacingScene] = useState(null);
  const [replacedScenes, setReplacedScenes] = useState({});   // sceneIndex → { status, newJobId }
  const pollTimers = useRef({});

  const authHeaders = async () => {
    const token = getToken ? await getToken() : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const stopPoll = (sceneIndex) => {
    clearInterval(pollTimers.current[sceneIndex]);
    delete pollTimers.current[sceneIndex];
  };

  const handleReplaceClip = async (sceneIndex) => {
    setReplacingScene(sceneIndex);
    try {
      const res = await fetch(`${API_BASE_URL}/replace-scene-clip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ job_id: jobId, scene_index: sceneIndex, orientation }),
      });
      const data = await res.json();
      if (!res.ok) return;

      const newJobId = data.new_job_id;
      setReplacedScenes((prev) => ({ ...prev, [sceneIndex]: { status: "rendering", newJobId } }));
      setReplacingScene(null);

      pollTimers.current[sceneIndex] = setInterval(async () => {
        try {
          const sr = await fetch(`${API_BASE_URL}/status/${newJobId}`);
          const sd = await sr.json();
          if (sd.status === "rendering_complete" || sd.status === "completed") {
            stopPoll(sceneIndex);
            setReplacedScenes((prev) => ({ ...prev, [sceneIndex]: { status: "done", newJobId } }));
            onFixApplied?.({ action: "scene_replaced", new_job_id: newJobId, scene_index: sceneIndex, ...sd });
          } else if (sd.status === "failed") {
            stopPoll(sceneIndex);
            setReplacedScenes((prev) => ({ ...prev, [sceneIndex]: { status: "failed", newJobId } }));
          }
        } catch {
          /* ignore transient poll errors */
        }
      }, POLL_INTERVAL_MS);
    } catch {
      setReplacingScene(null);
    }
  };

  const handleAiFix = async () => {
    if (!aiFixText.trim() || aiFixLoading) return;
    setAiFixLoading(true);
    setAiFixResult(null);

    try {
      const token = getToken ? await getToken() : null;
      const res = await fetch(`${API_BASE_URL}/ai-fix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ job_id: jobId, fix_request: aiFixText, prompt, mood }),
      });
      const data = await res.json();

      setAiFixResult({ ...data, executing: true });

      switch (data.action) {
        case "toggle_narration_off":
          onFixApplied?.({ action: "toggle_narration", include_narration: false, rerender_only: true });
          break;

        case "toggle_narration_on":
          onFixApplied?.({ action: "toggle_narration", include_narration: true, rerender_only: true });
          break;

        case "change_music":
          onFixApplied?.({ action: "change_music", mood: data.params?.mood || mood, rerender_only: true });
          break;

        case "replace_clip": {
          const sceneIdx = data.params?.scene_index ?? 0;
          await handleReplaceClip(sceneIdx);
          break;
        }

        case "change_mood":
          onFixApplied?.({ action: "change_mood", mood: data.params?.mood || mood, rerender_only: true });
          break;

        case "new_script":
          onFixApplied?.({ action: "new_script", guidance: data.params?.guidance || aiFixText, rerender_only: true });
          break;

        case "regenerate":
        default:
          onFixApplied?.({ action: "regenerate", prompt: data.modified_prompt || prompt, rerender_only: false });
          break;
      }
    } catch {
      setAiFixResult({ action: "error", message: "Request failed — please try again.", executing: false });
    } finally {
      setAiFixLoading(false);
      setAiFixResult((prev) => (prev ? { ...prev, executing: false } : null));
    }
  };

  const togglePanel = (id) => setActivePanel((prev) => (prev === id ? null : id));

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 flex flex-col gap-4">
      <p className="text-sm font-semibold text-foreground">What would you like to fix?</p>

      <div className="grid grid-cols-2 gap-2">
        {FIX_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            type="button"
            onClick={() => togglePanel(btn.id)}
            className={cn(
              "rounded-lg border p-3 text-left flex flex-col gap-0.5 transition-colors",
              activePanel === btn.id
                ? "border-primary/50 bg-primary/5"
                : "border-border bg-background/60 hover:border-primary/30 hover:bg-background/80"
            )}
          >
            <span className="text-base leading-none">{btn.icon}</span>
            <span className="text-xs font-semibold text-foreground mt-1">{btn.label}</span>
            <span className="text-[11px] text-muted-foreground leading-tight">{btn.desc}</span>
          </button>
        ))}
      </div>

      {/* Simple action panels */}
      {activePanel && SIMPLE_DESCRIPTIONS[activePanel] && (
        <div className="rounded-lg border border-border bg-background/60 p-3 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{SIMPLE_DESCRIPTIONS[activePanel]}</p>
          <button
            type="button"
            onClick={() => onFixApplied?.({ action: activePanel })}
            className="self-start text-xs text-primary hover:underline font-medium"
          >
            Apply →
          </button>
        </div>
      )}

      {/* Change a scene */}
      {activePanel === "change_scene" && (
        <div className="flex flex-col gap-2">
          {(!scenes || scenes.length === 0) ? (
            <p className="text-xs text-muted-foreground rounded-lg border border-border bg-background/60 p-3">
              Scene data unavailable. Re-generate the reel to enable per-scene clip replacement.
            </p>
          ) : (
            scenes.map((scene, i) => {
              const sceneState = replacedScenes[i];
              return (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-background/60 p-3 flex items-start justify-between gap-3"
                >
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Scene {i + 1}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">
                      {scene.description || scene.narration || "No description"}
                    </p>
                    {sceneState?.status === "rendering" && (
                      <p className="text-[11px] text-primary mt-0.5 animate-pulse">Re-rendering…</p>
                    )}
                    {sceneState?.status === "done" && (
                      <p className="text-[11px] text-primary mt-0.5">Clip replaced ✓</p>
                    )}
                    {sceneState?.status === "failed" && (
                      <p className="text-[11px] text-destructive mt-0.5">Replace failed — try again</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={replacingScene === i || sceneState?.status === "rendering"}
                    onClick={() => handleReplaceClip(i)}
                    className="shrink-0 text-xs px-2.5 py-1.5 rounded-md border border-border bg-background hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {replacingScene === i || sceneState?.status === "rendering" ? "Finding…" : "Replace clip"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Ask AI to fix */}
      {activePanel === "ai_fix" && (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[80px]"
            placeholder="e.g. The music is too loud, or Scene 2 clip doesn't match the mood"
            value={aiFixText}
            onChange={(e) => setAiFixText(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAiFix}
            disabled={aiFixLoading || !aiFixText.trim()}
            className="self-start text-xs text-primary hover:underline font-medium disabled:opacity-40"
          >
            {aiFixLoading ? "Analyzing…" : "Apply AI fix →"}
          </button>

          {aiFixResult && (
            <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">
                {aiFixResult.executing ? "Applying: " : "Applied: "}
              </span>
              {aiFixResult.action === "error"
                ? aiFixResult.message
                : aiFixResult.message || aiFixResult.action}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
