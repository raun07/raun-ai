import { useEffect, useRef, useState } from "react";

// ─── UNCHANGED CONSTANTS (left column uses these) ─────────────────

const STAGE_LABELS = {
  script:    { index: "01", label: "Writing script",        threshold: 12  },
  footage:   { index: "02", label: "Sourcing footage",      threshold: 32  },
  voiceover: { index: "03", label: "Generating voice-over", threshold: 62  },
  render:    { index: "04", label: "Rendering reel",        threshold: 88  },
};

const TAG_COLORS = {
  '[Director]':     '#FF2D78',
  '[ScriptAgent]':  '#00D4FF',
  '[CriticAgent]':  '#FFD23F',
  '[VisualAgent]':  '#a8ff3e',
  '[AudioService]': '#FF2D78',
  '[VideoService]': '#7B2FBE',
  '[Pipeline]':     '#FFFFFF',
  '[Eval]':         '#00D4FF',
};

function colorizeLog(text) {
  const tagMatch = text.match(/^(\[[^\]]+\])/);
  if (tagMatch) {
    const tag = tagMatch[1];
    const color = TAG_COLORS[tag];
    if (color) {
      return (
        <>
          <span style={{ color }}>{tag}</span>
          <span style={{ color: 'rgba(240,240,248,0.7)' }}>{text.slice(tag.length)}</span>
        </>
      );
    }
  }
  return <span style={{ color: 'rgba(240,240,248,0.7)' }}>{text}</span>;
}

function getCurrentStage(progress) {
  if (progress < 12) return "script";
  if (progress < 32) return "footage";
  if (progress < 62) return "voiceover";
  return "render";
}

function getStageState(stageId, progress) {
  const t = STAGE_LABELS[stageId].threshold;
  if (progress >= t) return "done";
  if (getCurrentStage(progress) === stageId) return "active";
  return "pending";
}

// ─── FOLDER PANEL CONSTANTS ───────────────────────────────────────

const STAGE_ORDER = ['script', 'footage', 'voiceover', 'render', 'upload'];

const STEPS = [
  { key: 'script',    label: 'Script'  },
  { key: 'footage',   label: 'Footage' },
  { key: 'voiceover', label: 'Voice'   },
  { key: 'render',    label: 'Render'  },
  { key: 'upload',    label: 'Upload'  },
];

// Actual hex values — CSS variables don't work inside SVG attributes
const STEP_COLORS = ['#FF2D78', '#00D4FF', '#FFD23F', '#7B2FBE', '#FF2D78'];

function getRightStage(progress) {
  if (progress < 12) return 'script';
  if (progress < 32) return 'footage';
  if (progress < 62) return 'voiceover';
  if (progress < 88) return 'render';
  return 'upload';
}

// ─── FOLDER ICON SVG ──────────────────────────────────────────────

function FolderIcon({ state, color = '#FF2D78', size = 44 }) {
  const isActive  = state === 'active';
  const isDone    = state === 'complete';
  const isPending = state === 'pending';

  const bodyColor    = isPending ? '#2a2540' : isDone ? color + '30' : color + '20';
  const strokeColor  = isPending ? '#3d3560' : color;
  const strokeOpacity = isPending ? 0.4 : 1;

  return (
    <svg
      width={size}
      height={size * 0.82}
      viewBox="0 0 56 46"
      fill="none"
      style={{
        filter: isActive
          ? `drop-shadow(0 0 8px ${color}60)`
          : isDone
            ? `drop-shadow(0 0 4px ${color}40)`
            : 'none',
        transition: 'filter 0.4s ease',
      }}
    >
      {/* Folder back */}
      <rect x="2" y="10" width="52" height="34" rx="4"
        fill={bodyColor} stroke={strokeColor} strokeWidth="2" opacity={strokeOpacity} />

      {/* Folder tab */}
      <path d="M2,10 L2,6 Q2,4 4,4 L20,4 Q22,4 24,6 L26,10 Z"
        fill={bodyColor} stroke={strokeColor} strokeWidth="2"
        strokeLinejoin="round" opacity={strokeOpacity} />

      {/* Lid — animates open when active */}
      <rect x="2" y="10" width="52" height="10" rx="2"
        fill={bodyColor} stroke={strokeColor} strokeWidth="2" opacity={strokeOpacity}
        style={{
          transformOrigin: '28px 10px',
          transformBox: 'fill-box',
          animation: isActive ? 'folder-open 0.4s ease forwards' : 'none',
        }}
      />

      {/* Papers peeking out when active */}
      {isActive && (
        <>
          <rect x="12" y="6" width="14" height="16" rx="2"
            fill="#faf6ee" stroke={color} strokeWidth="1.5" opacity="0.9"
            style={{ animation: 'paper-peek 0.5s ease 0.2s forwards', transformOrigin: '19px 22px' }}
          />
          <rect x="18" y="5" width="14" height="16" rx="2"
            fill="#faf6ee" stroke={color} strokeWidth="1.5" opacity="0.75"
            style={{ animation: 'paper-rustle 2s ease-in-out 0.4s infinite', transformOrigin: '25px 22px' }}
          />
          <line x1="14" y1="10" x2="24" y2="10" stroke={color} strokeWidth="1" opacity="0.3" />
          <line x1="14" y1="13" x2="24" y2="13" stroke={color} strokeWidth="1" opacity="0.25" />
          <line x1="14" y1="16" x2="20" y2="16" stroke={color} strokeWidth="1" opacity="0.2" />
        </>
      )}

      {/* Checkmark when done */}
      {isDone && (
        <g transform="translate(30, 18)">
          <circle cx="8" cy="8" r="8" fill={color + '25'} stroke={color} strokeWidth="1.5" />
          <path d="M4,8 L7,11 L12,5" stroke={color} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </g>
      )}

      {/* Active pulse dot */}
      {isActive && (
        <circle cx="48" cy="12" r="3" fill={color}
          style={{ animation: 'glow-pulse 1s ease-in-out infinite' }} />
      )}
    </svg>
  );
}

// ─── PAPER PLANE SVG ──────────────────────────────────────────────

function PaperPlane({ color = '#FF2D78' }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M2,16 L30,4 L22,28 L14,20 Z"
        fill={color + '25'} stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <line x1="14" y1="20" x2="30" y2="4"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14,20 L10,26 L16,22"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ─── FLYING PLANE OVERLAY ─────────────────────────────────────────
// Uses position:fixed so it escapes all overflow:hidden parents

function FlyingPlane({ color, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 950);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '38vh',
      left: '62vw',
      pointerEvents: 'none',
      zIndex: 9999,
      animation: 'plane-launch 0.85s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
    }}>
      <PaperPlane color={color} />
      <div style={{
        position: 'absolute',
        top: '50%',
        right: '100%',
        width: '60px',
        height: '2px',
        background: `repeating-linear-gradient(90deg, ${color} 0px, ${color} 4px, transparent 4px, transparent 8px)`,
        opacity: 0.5,
        transform: 'translateY(-50%)',
        animation: 'trail-fade 0.85s forwards',
      }} />
    </div>
  );
}

// ─── STAGE FOLDER CARD ────────────────────────────────────────────

function StageFolderCard({ stage, stageState, logs, color, onComplete }) {
  const prevState = useRef(stageState);

  // Notify parent when a stage transitions active → complete
  useEffect(() => {
    if (prevState.current === 'active' && stageState === 'complete') {
      onComplete?.(color);
    }
    prevState.current = stageState;
  }, [stageState, color, onComplete]);

  const isActive  = stageState === 'active';
  const isDone    = stageState === 'complete';
  const isPending = stageState === 'pending';

  const visibleLogs = logs.slice(-2);

  return (
    <div style={{
      position: 'relative',
      background: isDone
        ? `${color}08`
        : isActive
          ? 'var(--bg-3)'
          : 'var(--bg-2)',
      border: `1.5px solid ${
        isDone
          ? color + '40'
          : isActive
            ? color + '60'
            : 'rgba(255,255,255,0.07)'
      }`,
      borderRadius: '10px',
      padding: '14px',
      transition: 'all 0.35s ease',
      animation: isActive
        ? 'folder-glow 2s ease-in-out infinite'
        : isDone
          ? 'folder-done 0.5s ease'
          : 'none',
    }}>

      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: isActive ? '10px' : '0',
      }}>
        {/* Folder icon — wiggles on activation */}
        <div style={{
          flexShrink: 0,
          animation: isActive ? 'folder-wiggle 0.6s ease 0.1s' : 'none',
        }}>
          <FolderIcon state={stageState} color={color} size={44} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: isPending
              ? 'rgba(255,255,255,0.15)'
              : isActive
                ? color
                : 'rgba(255,255,255,0.45)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            transition: 'color 0.3s',
          }}>{stage.label}</div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: 'rgba(255,255,255,0.2)',
            marginTop: '2px',
            letterSpacing: '0.05em',
          }}>
            {isDone && '✓ complete'}
            {isActive && (
              <span>
                processing
                <span style={{ animation: 'tw-blink 0.8s infinite', marginLeft: '1px' }}>▌</span>
              </span>
            )}
            {isPending && 'waiting...'}
          </div>
        </div>

        {(isActive || isDone) && (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
            color: color,
            background: color + '15',
            border: `1px solid ${color}30`,
            borderRadius: '4px',
            padding: '2px 7px',
            flexShrink: 0,
          }}>
            {logs.length} logs
          </div>
        )}
      </div>

      {/* Live log lines — last 2, only when active */}
      {isActive && visibleLogs.length > 0 && (
        <div style={{
          borderTop: `1px solid ${color}20`,
          paddingTop: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}>
          {visibleLogs.map((log, i) => (
            <div key={log.id || i} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: i === visibleLogs.length - 1
                ? 'rgba(255,255,255,0.55)'
                : 'rgba(255,255,255,0.2)',
              lineHeight: 1.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ color: color + '80', marginRight: '6px' }}>{log.ts}</span>
              {log.text.replace(/\[.*?\]\s*/g, '')}
            </div>
          ))}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: color }}>
            <span style={{ animation: 'tw-blink 0.8s infinite' }}>▌</span>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────

export default function GeneratingScreen({
  progress = 0,
  message = "",
  jobId = "",
  scenes = null,
  onCancel,
  isComplete = false,
}) {
  const [logsByStage, setLogsByStage] = useState({
    script: [], footage: [], voiceover: [], render: [], upload: [],
  });
  const [activePlane, setActivePlane] = useState(null);
  const prevMessageRef = useRef("");

  // Route each incoming message to the currently active stage bucket
  useEffect(() => {
    if (message && message !== prevMessageRef.current) {
      prevMessageRef.current = message;
      const ts = new Date().toLocaleTimeString("en-US", {
        hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      const stage = getRightStage(progress);
      setLogsByStage(prev => ({
        ...prev,
        [stage]: [...(prev[stage] || []).slice(-8), { id: Date.now(), ts, text: message }],
      }));
    }
  }, [message, progress]);

  const currentStage   = getRightStage(progress);
  const completedCount = STAGE_ORDER.filter((_, idx) =>
    idx < STAGE_ORDER.indexOf(currentStage)
  ).length;

  return (
    <div style={{
      height: '100%',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-1)',
      overflow: 'hidden',
    }}>

      {/* ── TOP BAR ── (unchanged) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,45,120,0.15)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--pink)', display: 'inline-block',
            animation: 'blink 1s step-end infinite', flexShrink: 0,
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--pink)', letterSpacing: '0.1em' }}>GENERATING</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)' }}>{jobId.slice(0, 8)}</span>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-3)'; }}
          >cancel</button>
        )}
      </div>

      {/* ── RETRO OS TITLE BAR ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        background: 'linear-gradient(90deg, #FF2D78, #7B2FBE)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em',
        }}>
          <span>📂</span>
          <span>raun.ai — generating your film</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
          job_{jobId?.slice(0, 8)}
        </div>
      </div>

      {/* ── SPLIT BODY — retro window border ── */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        margin: '0 12px 12px',
        border: '1px solid var(--border-2)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>

        {/* ── LEFT COLUMN — pipeline stages + scenes (unchanged) ── */}
        <div style={{
          width: '220px', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          padding: '16px',
          borderRight: '1px solid var(--border-1)',
          overflowY: 'auto',
        }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>Pipeline</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {Object.entries(STAGE_LABELS).map(([id, { index, label }]) => {
              const state = getStageState(id, progress);
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    width: '20px', height: '20px',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    border: state === 'active'
                      ? '1.5px solid var(--pink)'
                      : state === 'done'
                        ? '1.5px solid rgba(168,255,62,0.4)'
                        : '1.5px solid var(--border-1)',
                    boxShadow: state === 'active' ? '0 0 6px rgba(255,45,120,0.5)' : 'none',
                    color: state === 'active' ? 'var(--pink)' : state === 'done' ? '#a8ff3e' : 'var(--text-4)',
                    animation: state === 'active' ? 'blink 1.4s step-end infinite' : 'none',
                  }}>
                    {state === 'done' ? '✓' : index}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    color: state === 'done' ? 'var(--text-3)' : state === 'active' ? 'var(--text-1)' : 'var(--text-4)',
                    fontWeight: state === 'active' ? 500 : 400,
                    textDecoration: state === 'done' ? 'line-through' : 'none',
                    transition: 'color 0.2s',
                  }}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 'auto' }}>
            <div style={{ height: '3px', background: 'var(--border-1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--pink) 0%, var(--cyan) 100%)',
                boxShadow: '0 0 8px rgba(255,45,120,0.8)',
                borderRadius: '2px',
                transition: 'width 0.5s ease-out',
              }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)' }}>{progress}%</span>
          </div>

          {/* Scene cards */}
          {scenes && scenes.length > 0 && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Scenes</p>
              {scenes.map((scene, i) => (
                <div key={i} className="drip" style={{ borderRadius: '6px', border: '1px solid var(--border-1)', background: 'var(--bg-2)', padding: '8px' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--pink)', marginBottom: '3px' }}>Scene {i + 1}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-3)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {scene.description || scene.narration || '—'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN — Interactive Folder Terminal ── */}
        <div style={{
          flex: 1,
          background: 'var(--bg-0)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>

          {/* Terminal header — macOS dots */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-1)',
            flexShrink: 0,
            background: 'var(--bg-1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '5px' }}>
                {['#ff5f57', '#febc2e', '#28c840'].map((c, i) => (
                  <div key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, opacity: 0.8 }} />
                ))}
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-3)', letterSpacing: '0.08em', marginLeft: '4px' }}>
                raun.ai / pipeline
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--pink)', letterSpacing: '0.15em' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--pink)', display: 'inline-block', animation: 'glow-pulse 1.2s ease-in-out infinite' }} />
              LIVE
            </div>
          </div>

          {/* Folder cards */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            overscrollBehavior: 'contain',
          }}>

            {/* Section label */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--text-4)',
              letterSpacing: '0.15em',
              marginBottom: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>PIPELINE_FOLDERS</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-1)' }} />
              <span>{completedCount}/{STEPS.length}</span>
            </div>

            {/* One folder card per stage */}
            {STEPS.map((step, i) => {
              const stageLogs = logsByStage[step.key] || [];
              const stageIdx  = STAGE_ORDER.indexOf(step.key);
              const currentIdx = STAGE_ORDER.indexOf(currentStage);

              const stageState = isComplete
                ? 'complete'
                : stageIdx < currentIdx  ? 'complete'
                : stageIdx === currentIdx ? 'active'
                :                          'pending';

              return (
                <StageFolderCard
                  key={step.key}
                  stage={step}
                  stageState={stageState}
                  logs={stageLogs}
                  color={STEP_COLORS[i]}
                  onComplete={(color) => setActivePlane({ color, id: Date.now() })}
                />
              );
            })}

            {/* Retro notepad footer */}
            <div style={{
              marginTop: '4px',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-1)',
              borderRadius: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              color: 'var(--text-4)',
              letterSpacing: '0.08em',
              lineHeight: 1.8,
            }}>
              <div style={{ color: 'var(--text-3)', marginBottom: '4px' }}>📋 Untitled — raun.ai</div>
              <div>✦ Each folder = one pipeline stage</div>
              <div>✦ Paper plane = task complete</div>
              <div>✦ {completedCount} of {STEPS.length} stages done</div>
            </div>
          </div>

          {/* Paper plane burst — rendered fixed so it escapes overflow clipping */}
          {activePlane && (
            <FlyingPlane
              key={activePlane.id}
              color={activePlane.color}
              onDone={() => setActivePlane(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
