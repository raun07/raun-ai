import { useState } from "react";

const STEPS = [
  {
    title: "Write your prompt",
    body: "Describe your scene in detail — include mood, setting, action, and emotion. The more specific, the better the reel.",
    icon: "✍️",
  },
  {
    title: "Enhance with AI",
    body: "Hit the ✨ Enhance button to get 3 cinematic rewrites of your rough idea. Pick the one that excites you.",
    icon: "✨",
  },
  {
    title: "Customize your reel",
    body: "Choose 9:16 or 16:9 format, pick a mood, select a transition style, and optionally apply your Brand Kit.",
    icon: "🎬",
  },
  {
    title: "Add your own media",
    body: "Upload your own footage clips, a custom music track, or even record your own voice narration.",
    icon: "🎙️",
  },
  {
    title: "Generate",
    body: "Hit Generate and watch the full AI pipeline — script, footage, voice, music, and render — complete in under 60 seconds.",
    icon: "🚀",
  },
];

export default function OnboardingTour({ onComplete }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    localStorage.setItem("ptr_tour_completed", "true");
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card p-6 flex flex-col gap-5 shadow-2xl">
        <button
          type="button"
          onClick={finish}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
          aria-label="Skip tour"
        >
          ✕
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-5xl">{current.icon}</span>
          <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? "bg-primary" : "bg-border"
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={isLast ? finish : () => setStep((s) => s + 1)}
            className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isLast ? "Let's go" : "Next"}
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground/60">
          Step {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}
