import { useState } from "react";

export default function CreditsBox({ credits }) {
  const [open, setOpen] = useState(false);

  if (!credits || (!credits.footage?.length && !credits.music && !credits.voice)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-medium uppercase tracking-widest">Credits &amp; Ingredients</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border pt-3">
          {credits.footage?.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Footage
              </p>
              <div className="flex flex-col gap-1">
                {credits.footage.map((f) => (
                  <div key={f.scene} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 font-medium text-foreground/70">
                      Scene {f.scene}
                    </span>
                    <span>
                      {f.source}
                      {f.keywords?.length > 0 && (
                        <> &mdash; {f.keywords.join(", ")}</>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {credits.music && (
            <section className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Music
              </p>
              <p className="text-xs text-muted-foreground">
                {credits.music.track}
                {credits.music.mood && (
                  <> &mdash; mood: {credits.music.mood}</>
                )}
                {credits.music.source && (
                  <> ({credits.music.source})</>
                )}
              </p>
            </section>
          )}

          {credits.voice && (
            <section className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Voice
              </p>
              <p className="text-xs text-muted-foreground">
                {credits.voice.engine}
                {credits.voice.voice && credits.voice.voice !== credits.voice.engine && (
                  <> &mdash; {credits.voice.voice}</>
                )}
              </p>
            </section>
          )}

          {credits.tools?.length > 0 && (
            <section className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Generation stack
              </p>
              <p className="text-xs text-muted-foreground">
                {credits.tools.join(" · ")}
              </p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
