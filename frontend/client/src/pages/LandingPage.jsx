import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { EXAMPLE_REELS } from "../config/examples";

const SESSION_ID = Math.random().toString(36).slice(2, 10).toUpperCase();

const PLACEHOLDERS = [
  "A lone astronaut walks on Mars at golden hour...",
  "Street food chef in Tokyo flips a perfect omelette at 3am...",
  "Time-lapse of a thunderstorm rolling over the Grand Canyon...",
  "Surfer rides a 30-foot wave at Pipeline, slow-motion...",
  "Ballet dancer rehearses alone on an empty stage...",
  "Formula 1 car launches off the grid at night in Singapore...",
];

const FEATURES = [
  { cap: "CAP_01", title: "Multi-agent pipeline",  desc: "Script, footage search, narration, and editing run as parallel agents." },
  { cap: "CAP_02", title: "Cinematic transitions",  desc: "35 handcrafted FFmpeg transitions matched to your mood automatically." },
  { cap: "CAP_03", title: "Brand kit support",      desc: "Upload your logo, colors, and font once. Every reel stays on-brand." },
  { cap: "CAP_04", title: "Eval framework",         desc: "Each reel is scored on coherence, pacing, and visual quality." },
  { cap: "CAP_05", title: "Instant voice-over",     desc: "Natural-sounding narration generated from your script in seconds." },
  { cap: "CAP_06", title: "Export anywhere",        desc: "Download MP4, share a link, or push directly to social platforms." },
];

/* ─── Doodle SVG Library ───────────────────────────────────── */

const Doodles = {
  Camera: ({ size = 60, color = '#c94030' }) => (
    <svg width={size} height={size * 0.75} viewBox="0 0 80 60" fill="none" style={{ transform: 'rotate(-8deg)' }}>
      <rect x="8" y="16" width="50" height="34" rx="5" stroke={color} strokeWidth="2.5" />
      <circle cx="33" cy="33" r="12" stroke={color} strokeWidth="2.5" />
      <circle cx="33" cy="33" r="7" stroke={color} strokeWidth="2" />
      <circle cx="33" cy="33" r="3" stroke={color} strokeWidth="1.5" />
      <rect x="22" y="10" width="14" height="8" rx="2" stroke={color} strokeWidth="2" />
      <rect x="52" y="24" width="14" height="10" rx="3" stroke={color} strokeWidth="2" />
      <circle cx="58" cy="24" r="3" fill={color} />
      <circle cx="41" cy="22" r="2" stroke={color} strokeWidth="1.5" />
    </svg>
  ),
  Pencil: ({ size = 60, color = '#c94030' }) => (
    <svg width={size * 0.4} height={size} viewBox="0 0 24 60" fill="none" style={{ transform: 'rotate(15deg)' }}>
      <rect x="5" y="4" width="14" height="44" rx="2" stroke={color} strokeWidth="2" />
      <polygon points="5,48 19,48 12,58" stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <line x1="5" y1="10" x2="19" y2="10" stroke={color} strokeWidth="1.5" />
      <circle cx="12" cy="56" r="1.5" fill={color} />
    </svg>
  ),
  FilmReel: ({ size = 60, color = '#c94030' }) => (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" style={{ transform: 'rotate(12deg)' }}>
      <circle cx="30" cy="30" r="26" stroke={color} strokeWidth="2.5" />
      <circle cx="30" cy="30" r="8" stroke={color} strokeWidth="2.5" />
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 30 + 17 * Math.cos(rad);
        const cy = 30 + 17 * Math.sin(rad);
        return <circle key={i} cx={cx} cy={cy} r="5" stroke={color} strokeWidth="1.5" />;
      })}
      <circle cx="30" cy="30" r="3" fill={color} />
    </svg>
  ),
  Clapperboard: ({ size = 60, color = '#c94030' }) => (
    <svg width={size} height={size * 0.85} viewBox="0 0 60 50" fill="none" style={{ transform: 'rotate(-5deg)' }}>
      <rect x="5" y="14" width="50" height="32" rx="3" stroke={color} strokeWidth="2.5" />
      <rect x="5" y="5" width="50" height="12" rx="2" stroke={color} strokeWidth="2.5" />
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={10 + i * 10} y1="5" x2={6 + i * 10} y2="17" stroke={color} strokeWidth="2" />
      ))}
      <text x="30" y="36" textAnchor="middle" fontSize="10" fill={color} fontFamily="monospace">TAKE 1</text>
    </svg>
  ),
  Scenery: ({ size = 60, color = '#c94030' }) => (
    <svg width={size * 1.3} height={size * 0.7} viewBox="0 0 80 44" fill="none" style={{ transform: 'rotate(-3deg)' }}>
      <rect x="2" y="2" width="76" height="40" rx="4" stroke={color} strokeWidth="2" />
      <path d="M2,32 L18,16 L34,28 L48,18 L78,36" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="62" cy="14" r="7" stroke={color} strokeWidth="2" />
    </svg>
  ),
  StarBurst: ({ size = 48, color = '#c94030' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {[0, 30, 60, 90, 120, 150].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <g key={i}>
            <line x1={24 + 6 * Math.cos(rad)} y1={24 + 6 * Math.sin(rad)} x2={24 + 20 * Math.cos(rad)} y2={24 + 20 * Math.sin(rad)} stroke={color} strokeWidth="2" strokeLinecap="round" />
            <line x1={24 - 6 * Math.cos(rad)} y1={24 - 6 * Math.sin(rad)} x2={24 - 20 * Math.cos(rad)} y2={24 - 20 * Math.sin(rad)} stroke={color} strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      })}
      <circle cx="24" cy="24" r="5" stroke={color} strokeWidth="2" />
    </svg>
  ),
  WavyLine: ({ width = 200, color = '#c94030' }) => {
    const segments = Math.floor(width / 20);
    const d = `M0,6 ${Array.from({ length: segments }, (_, i) =>
      `Q${i * 20 + 10},${i % 2 === 0 ? 1 : 11} ${(i + 1) * 20},6`
    ).join(' ')}`;
    return (
      <svg width={width} height="12" viewBox={`0 0 ${width} 12`} fill="none">
        <path d={d} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  },
  Arrow: ({ size = 40, color = '#c94030' }) => (
    <svg width={size} height={size * 0.6} viewBox="0 0 40 24" fill="none" style={{ transform: 'rotate(-10deg)' }}>
      <path d="M2,12 Q20,4 34,12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M28,6 L36,12 L28,18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Play: ({ size = 48, color = '#c94030' }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" stroke={color} strokeWidth="2.5" />
      <path d="M20,16 L34,24 L20,32 Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  RetroTV: ({ size = 60, color = '#c94030' }) => (
    <svg width={size} height={size * 0.85} viewBox="0 0 60 50" fill="none" style={{ transform: 'rotate(5deg)' }}>
      <rect x="5" y="10" width="50" height="34" rx="6" stroke={color} strokeWidth="2.5" />
      <rect x="10" y="15" width="32" height="22" rx="3" stroke={color} strokeWidth="2" />
      <circle cx="50" cy="20" r="3" stroke={color} strokeWidth="1.5" />
      <circle cx="50" cy="30" r="3" stroke={color} strokeWidth="1.5" />
      <line x1="22" y1="5" x2="16" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="38" y1="5" x2="44" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="44" x2="15" y2="50" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="42" y1="44" x2="45" y2="50" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  MagicWand: ({ size = 60, color = '#c94030' }) => (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none"
         style={{ transform: 'rotate(-20deg)' }}>
      <line x1="12" y1="48" x2="44" y2="16"
            stroke={color} strokeWidth="3" strokeLinecap="round"/>
      <polygon points="44,8 46,14 52,14 47,18 49,24 44,20 39,24 41,18 36,14 42,14"
               stroke={color} strokeWidth="1.5"
               fill="rgba(201,64,48,0.15)"/>
      <line x1="50" y1="32" x2="54" y2="32"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="52" y1="30" x2="52" y2="34"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="20" x2="23" y2="20"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="21.5" y1="18.5" x2="21.5" y2="21.5"
            stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="16" cy="38" r="2"
              stroke={color} strokeWidth="1.5"/>
    </svg>
  ),
  FilmStrip: ({ size = 90, color = '#c94030' }) => (
    <svg width={size} height={size * 0.45}
         viewBox="0 0 90 40" fill="none"
         style={{ transform: 'rotate(-5deg)' }}>
      <rect x="2" y="8" width="86" height="24" rx="3"
            stroke={color} strokeWidth="2"
            fill="rgba(201,64,48,0.06)"/>
      {[8,20,32,44,56,68,80].map((x, i) => (
        <rect key={`t${i}`} x={x} y="3" width="6" height="6" rx="1"
              stroke={color} strokeWidth="1.5"/>
      ))}
      {[8,20,32,44,56,68,80].map((x, i) => (
        <rect key={`b${i}`} x={x} y="31" width="6" height="6" rx="1"
              stroke={color} strokeWidth="1.5"/>
      ))}
      {[26,50,74].map((x, i) => (
        <line key={`d${i}`} x1={x} y1="8" x2={x} y2="32"
              stroke={color} strokeWidth="1.5" opacity="0.4"/>
      ))}
    </svg>
  ),
  Lightbulb: ({ size = 55, color = '#c94030' }) => (
    <svg width={size} height={size}
         viewBox="0 0 55 55" fill="none">
      <path d="M27,8 C18,8 11,15 11,24 C11,30 14,35 19,38 L19,44 L36,44 L36,38 C41,35 44,30 44,24 C44,15 37,8 27,8 Z"
            stroke={color} strokeWidth="2.5"
            strokeLinejoin="round"
            fill="rgba(201,64,48,0.08)"/>
      <line x1="20" y1="44" x2="34" y2="44"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="21" y1="48" x2="33" y2="48"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="23" y1="52" x2="31" y2="52"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <path d="M22,34 L22,28 Q27,22 32,28 L32,34"
            stroke={color} strokeWidth="1.5"
            strokeLinecap="round" fill="none"/>
      <line x1="27" y1="2" x2="27" y2="6"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="12" x2="11" y2="15"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="46" y1="12" x2="43" y2="15"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="2" y1="24" x2="6" y2="24"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="48" y1="24" x2="52" y2="24"
            stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
};

/* ─── HeroInput ───────────────────────────────────────────── */

function HeroInput() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuth();
  const [value, setValue] = useState("");
  const [ph, setPh] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPh((i) => (i + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(id);
  }, []);

  const go = () => {
    if (!value.trim()) return;
    const dest = `/studio?prompt=${encodeURIComponent(value.trim())}`;
    navigate(isSignedIn ? dest : `/signup?redirect_url=${encodeURIComponent(dest)}`);
  };

  return (
    <div style={{
      background: '#fdf9f2',
      border: '3px solid #1a1008',
      borderRadius: 8,
      padding: '16px 20px',
      boxShadow: '5px 5px 0 #c94030',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && go()}
        placeholder={PLACEHOLDERS[ph]}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: '#1a1008',
          fontSize: 15,
          outline: 'none',
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      />
      <button
        onClick={go}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #1a1008'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0 #1a1008'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '3px 3px 0 #1a1008'; }}
        style={{
          background: '#c94030',
          color: '#fff',
          border: '2px solid #1a1008',
          borderRadius: 6,
          padding: '10px 22px',
          fontFamily: 'Caveat, cursive',
          fontSize: 20,
          cursor: 'pointer',
          boxShadow: '3px 3px 0 #1a1008',
          transition: 'transform 0.1s, box-shadow 0.1s',
          whiteSpace: 'nowrap',
        }}
      >Generate →</button>
    </div>
  );
}

/* ─── ExampleReelCard ─────────────────────────────────────── */

function ExampleReelCard({ example, onTry }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
        borderColor: hovered ? 'rgba(201,64,48,0.4)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div style={{
        aspectRatio: '16/9',
        background: 'rgba(255,255,255,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{ fontSize: 32 }}>🎬</span>
        <div style={{
          position: 'absolute',
          top: 10, left: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: '#c94030',
          letterSpacing: '0.1em',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#c94030', animation: 'blink 1.4s step-end infinite' }} />
          REC
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          letterSpacing: '0.1em',
          color: '#d4840a',
          textTransform: 'uppercase',
          display: 'block',
          marginBottom: 8,
        }}>{example.mood}</span>
        <p style={{
          fontSize: 12,
          color: 'rgba(240,235,224,0.6)',
          lineHeight: 1.6,
          margin: '0 0 12px',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{example.prompt}</p>
        <button
          onClick={() => onTry(example.prompt)}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: hovered ? '#d4840a' : 'rgba(240,235,224,0.35)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            transition: 'color 0.15s',
            padding: 0,
          }}
        >TRY THIS →</button>
      </div>
    </div>
  );
}

/* ─── FeatureCard ─────────────────────────────────────────── */

function FeatureCard({ cap, title, desc }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#f0ebe0',
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, rgba(140,105,70,0.13) 23px, rgba(140,105,70,0.13) 24px)',
        border: '1px solid rgba(26,16,8,0.1)',
        borderTop: hovered ? '2px solid #c94030' : '2px solid transparent',
        borderRadius: 8,
        padding: '20px 20px 22px',
        transition: 'transform 0.15s, box-shadow 0.15s, border-top 0.1s',
        transform: hovered ? 'translate(-2px,-2px)' : 'none',
        boxShadow: hovered ? '3px 3px 0 rgba(201,64,48,0.2)' : 'none',
        cursor: 'default',
      }}
    >
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        color: '#c94030',
        display: 'block',
        marginBottom: 10,
        letterSpacing: '0.12em',
      }}>{cap}</span>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1a1008', margin: '0 0 6px' }}>{title}</h3>
      <p style={{ fontSize: 12, color: '#8a7060', lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

/* ─── FeedbackSection ─────────────────────────────────────── */

function FeedbackSection() {
  const [feedbackType, setFeedbackType] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleFeedbackSubmit = async () => {
    if (!feedbackNote.trim()) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: feedbackName || 'Anonymous',
          email: feedbackEmail || 'none',
          feedback_type: feedbackType || 'General',
          note: feedbackNote,
        }),
      });
      setFeedbackSent(true);
      setFeedbackNote('');
      setFeedbackName('');
      setFeedbackEmail('');
      setFeedbackType('');
    } catch (e) {
      console.error('Feedback failed', e);
    }
  };

  return (
    <section style={{ background: '#ede7d8', padding: '80px 24px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
      <NotebookBg lineOpacity={0.14} hatchOpacity={0.08} />

      {/* RunawayDoodles — feedback section */}
      <RunawayDoodle top="8%" left="3%" animationName="float3d-2" duration="7.5s" delay="0s" zIndex={0}>
        <div style={{ opacity: 0.6 }}><Doodles.FilmReel size={56} /></div>
      </RunawayDoodle>
      <RunawayDoodle top="6%" right="4%" animationName="float3d-5" duration="8s" delay="1s" zIndex={0}>
        <div style={{ opacity: 0.6 }}><Doodles.RetroTV size={60} /></div>
      </RunawayDoodle>
      <RunawayDoodle bottom="10%" left="2.5%" animationName="spin3d-slow" duration="16s" delay="0.5s" zIndex={0}>
        <div style={{ opacity: 0.55 }}><Doodles.StarBurst size={34} /></div>
      </RunawayDoodle>
      <RunawayDoodle bottom="8%" right="3%" animationName="float3d-4" duration="7s" delay="2s" zIndex={0}>
        <div style={{ opacity: 0.6 }}><Doodles.Lightbulb size={50} /></div>
      </RunawayDoodle>

      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: 52, fontWeight: 700, color: '#c94030', margin: '0 0 4px', lineHeight: 1 }}>
            drop a note ✍️
          </h2>
          <p style={{ fontFamily: 'Caveat, cursive', fontStyle: 'italic', fontSize: 22, color: '#5a4030', margin: 0 }}>
            your feedback shapes raun.ai
          </p>
        </div>

        <div style={{
          background: '#f0ebe0',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(140,105,70,0.15) 27px, rgba(140,105,70,0.15) 28px)',
          border: '2px solid #c94030',
          borderRadius: 12,
          padding: '40px 36px 32px',
          boxShadow: '5px 5px 0 #c94030',
          position: 'relative',
        }}>
          {/* Spiral holes */}
          <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 20 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: '#ede7d8', border: '2px solid #c94030' }} />
            ))}
          </div>

          {/* Camera doodle — top right corner */}
          <div style={{ position: 'absolute', top: 16, right: 16, opacity: 0.18, pointerEvents: 'none' }}>
            <Doodles.Camera size={52} color="#c94030" />
          </div>

          {/* Pencil doodle — bottom left corner */}
          <div style={{ position: 'absolute', bottom: 16, left: 12, opacity: 0.14, pointerEvents: 'none' }}>
            <Doodles.Pencil size={44} color="#c94030" />
          </div>

          <p style={{ fontFamily: 'Caveat, cursive', fontSize: 18, color: '#8a7060', fontStyle: 'italic', marginBottom: 24, marginTop: 8 }}>
            Your feedback shapes raun.ai. Every note counts.
          </p>

          {/* Name + email */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'NAME', type: 'text', placeholder: 'Your name', value: feedbackName, onChange: (e) => setFeedbackName(e.target.value) },
              { label: 'EMAIL', type: 'email', placeholder: 'Your email', value: feedbackEmail, onChange: (e) => setFeedbackEmail(e.target.value) },
            ].map(({ label, type, placeholder, value, onChange }) => (
              <div key={label} style={{ flex: 1 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#8a7060', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                <input
                  type={type}
                  placeholder={placeholder}
                  value={value}
                  onChange={onChange}
                  style={{
                    width: '100%', background: 'transparent', border: 'none',
                    borderBottom: '1.5px solid rgba(26,16,8,0.2)',
                    padding: '8px 0', fontSize: 15, color: '#1a1008',
                    outline: 'none', fontFamily: "'Space Grotesk', sans-serif",
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.target.style.borderBottomColor = '#c94030'; }}
                  onBlur={(e) => { e.target.style.borderBottomColor = 'rgba(26,16,8,0.2)'; }}
                />
              </div>
            ))}
          </div>

          {/* Feedback type pills */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#8a7060', letterSpacing: '0.1em', marginBottom: 8 }}>FEEDBACK TYPE</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Bug report', 'Feature request', 'General', 'Love it ❤️'].map((t) => (
                <button
                  key={t}
                  onClick={() => setFeedbackType(t)}
                  style={{
                    border: feedbackType === t ? '1.5px solid var(--pink)' : '1px solid rgba(201,64,48,0.3)',
                    background: feedbackType === t ? 'rgba(255,45,120,0.08)' : 'transparent',
                    color: feedbackType === t ? 'var(--pink)' : '#3d2b1a',
                    borderRadius: '20px',
                    padding: '6px 16px',
                    cursor: 'pointer',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    transition: 'all 0.15s',
                  }}
                >{t}</button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#8a7060', letterSpacing: '0.1em', marginBottom: 6 }}>YOUR NOTE</div>
            <div style={{ position: 'relative' }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 28 + i * 28, height: 1, background: 'rgba(201,64,48,0.1)' }} />
              ))}
              <textarea
                placeholder="What's on your mind? Any bugs, ideas, or just vibes..."
                rows={5}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  borderBottom: '1.5px solid rgba(26,16,8,0.15)',
                  padding: '8px 0', fontSize: 15, color: '#1a1008',
                  outline: 'none', fontFamily: "'Space Grotesk', sans-serif",
                  lineHeight: '28px', resize: 'none', position: 'relative', zIndex: 1,
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderBottomColor = '#c94030'; }}
                onBlur={(e) => { e.target.style.borderBottomColor = 'rgba(26,16,8,0.15)'; }}
              />
            </div>
          </div>

          {feedbackSent ? (
            <div style={{ textAlign: 'center', fontFamily: 'Caveat, cursive', fontSize: 28, color: '#c94030', padding: '14px 0' }}>
              Thanks! 🎉
            </div>
          ) : (
            <button
              style={{
                width: '100%', padding: '14px', background: '#c94030', color: '#fff',
                border: '2px solid #1a1008', borderRadius: 6,
                fontFamily: 'Caveat, cursive', fontSize: 22, letterSpacing: '0.04em',
                cursor: 'pointer', boxShadow: '4px 4px 0 #1a1008', transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-2px,-2px)'; e.currentTarget.style.boxShadow = '6px 6px 0 #1a1008'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '4px 4px 0 #1a1008'; }}
              onClick={handleFeedbackSubmit}
            >Submit Note →</button>
          )}
        </div>
      </div>
    </section>
  );
}

/* ─── RunawayDoodle ───────────────────────────────────────── */

function RunawayDoodle({
  children,
  top, left, right, bottom,
  animationName = 'float3d-1',
  duration = '6s',
  delay = '0s',
  zIndex = 1,
  fleeRadius = 115,
  fleeStrength = 85,
}) {
  const outerRef = useRef(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const returnTimer = useRef(null);

  useEffect(() => {
    const onMove = (e) => {
      if (!outerRef.current) return;
      const rect = outerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < fleeRadius) {
        clearTimeout(returnTimer.current);
        const factor = (1 - dist / fleeRadius) * fleeStrength;
        setOffset({ x: -(dx / dist) * factor, y: -(dy / dist) * factor });
      } else {
        clearTimeout(returnTimer.current);
        returnTimer.current = setTimeout(() => setOffset({ x: 0, y: 0 }), 160);
      }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => { window.removeEventListener('mousemove', onMove); clearTimeout(returnTimer.current); };
  }, [fleeRadius, fleeStrength]);

  const fleeing = offset.x !== 0 || offset.y !== 0;

  return (
    <div ref={outerRef} style={{ position: 'absolute', top, left, right, bottom, zIndex }}>
      <div style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: fleeing
          ? 'transform 0.1s ease-out'
          : 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: 'transform',
      }}>
        <div style={{
          animation: `${animationName} ${duration} ease-in-out ${delay} infinite`,
          transformStyle: 'preserve-3d',
          cursor: 'default',
          userSelect: 'none',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── NotebookBg ─────────────────────────────────────────────
   Drop inside any position:relative+overflow:hidden section to
   get the notebook-paper look: ruled lines, red left margin,
   and pencil-hatched corners. Pure CSS — zero SVG IDs.
──────────────────────────────────────────────────────────────── */
function NotebookBg({ lineOpacity = 0.16, hatchOpacity = 0.09 }) {
  const hatch = (at, op = hatchOpacity) => ({
    position: 'absolute',
    backgroundImage: `repeating-linear-gradient(42deg, transparent, transparent 7px, rgba(74,53,32,${op}) 7px, rgba(74,53,32,${op}) 8px)`,
    maskImage: `radial-gradient(ellipse 120% 120% at ${at}, black 5%, transparent 62%)`,
    WebkitMaskImage: `radial-gradient(ellipse 120% 120% at ${at}, black 5%, transparent 62%)`,
    pointerEvents: 'none',
    zIndex: 0,
  });
  return (
    <>
      {/* Ruled horizontal lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: `repeating-linear-gradient(transparent, transparent 27px, rgba(140,105,70,${lineOpacity}) 27px, rgba(140,105,70,${lineOpacity}) 28px)`,
      }} />
      {/* Red left margin */}
      <div style={{
        position: 'absolute', left: 64, top: 0, bottom: 0,
        width: 1.5, background: 'rgba(201,64,48,0.28)', pointerEvents: 'none', zIndex: 0,
      }} />
      {/* Pencil hatching — top-left corner */}
      <div style={{ ...hatch('0% 0%'),    top: 0,    left:  0, width: 240, height: 210 }} />
      {/* Pencil hatching — bottom-right corner */}
      <div style={{ ...hatch('100% 100%'), bottom: 0, right: 0, width: 240, height: 210 }} />
      {/* Pencil hatching — top-right corner, lighter */}
      <div style={{ ...hatch('100% 0%', hatchOpacity * 0.75), top: 0, right: 0, width: 180, height: 160 }} />
    </>
  );
}

/* ─── LandingPage ─────────────────────────────────────────── */

function LandingPage() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  const handleTryPrompt = (prompt) => {
    const dest = `/studio?prompt=${encodeURIComponent(prompt)}`;
    navigate(isSignedIn ? dest : `/signup?redirect_url=${encodeURIComponent(dest)}`);
  };

  const HOW_IT_WORKS = [
    { icon: <Doodles.Pencil size={48} color="#c94030" />, title: "Write your prompt", desc: "Describe the scene, mood, and action in plain English.", label: "STEP_01" },
    { icon: <Doodles.Clapperboard size={48} color="#c94030" />, title: "AI writes the script", desc: "Claude breaks your prompt into cinematic scenes with narration.", label: "STEP_02" },
    { icon: <Doodles.FilmReel size={48} color="#c94030" />, title: "Footage is sourced", desc: "Relevant stock clips are fetched and matched to each scene.", label: "STEP_03" },
    { icon: <Doodles.Camera size={48} color="#c94030" />, title: "Reel is rendered", desc: "FFmpeg assembles everything with transitions, music, and captions.", label: "STEP_04" },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#ede7d8' }}>

      {/* ── 1. HERO ── */}
      <section style={{
        minHeight: '100vh',
        background: '#ede7d8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <NotebookBg lineOpacity={0.13} hatchOpacity={0.07} />

        {/* Camera — top left — slow float */}
        <RunawayDoodle top="80px" left="60px" animationName="float3d-1" duration="7s" delay="0s">
          <Doodles.Camera size={72} />
        </RunawayDoodle>

        {/* Pencil — top right — different axis */}
        <RunawayDoodle top="110px" right="80px" animationName="float3d-2" duration="8s" delay="1.2s">
          <Doodles.Pencil size={95} />
        </RunawayDoodle>

        {/* Film reel — left middle */}
        <RunawayDoodle top="42%" left="38px" animationName="float3d-3" duration="6.5s" delay="0.5s">
          <Doodles.FilmReel size={68} />
        </RunawayDoodle>

        {/* Scenery — bottom left */}
        <RunawayDoodle bottom="90px" left="45px" animationName="float3d-4" duration="9s" delay="2s">
          <Doodles.Scenery size={105} />
        </RunawayDoodle>

        {/* Clapperboard — bottom right */}
        <RunawayDoodle bottom="110px" right="55px" animationName="float3d-5" duration="7.5s" delay="0.8s">
          <Doodles.Clapperboard size={78} />
        </RunawayDoodle>

        {/* Retro TV — top right area */}
        <RunawayDoodle top="55px" right="200px" animationName="float3d-6" duration="8.5s" delay="1.8s">
          <Doodles.RetroTV size={68} />
        </RunawayDoodle>

        {/* Star burst left — spinning */}
        <RunawayDoodle top="220px" left="185px" animationName="spin3d-slow" duration="12s" delay="0s">
          <Doodles.StarBurst size={38} />
        </RunawayDoodle>

        {/* Star burst right */}
        <RunawayDoodle bottom="220px" right="185px" animationName="spin3d-slow" duration="15s" delay="3s">
          <Doodles.StarBurst size={30} />
        </RunawayDoodle>

        {/* Play button — right middle */}
        <RunawayDoodle top="38%" right="48px" animationName="float3d-7" duration="6s" delay="2.5s">
          <Doodles.Play size={52} />
        </RunawayDoodle>

        {/* Arrow — left of input area */}
        <RunawayDoodle top="57%" left="12%" animationName="float3d-8" duration="5.5s" delay="1s">
          <Doodles.Arrow size={58} />
        </RunawayDoodle>

        {/* Handwritten notes — static */}
        <span style={{
          position: 'absolute', top: '168px', left: '148px',
          fontFamily: 'Caveat, cursive', fontSize: '15px',
          color: 'rgba(201,64,48,0.55)',
          transform: 'rotate(-8deg)',
          pointerEvents: 'none',
        }}>✦ action!</span>

        <span style={{
          position: 'absolute', bottom: '168px', right: '155px',
          fontFamily: 'Caveat, cursive', fontSize: '13px',
          color: 'rgba(201,64,48,0.45)',
          transform: 'rotate(5deg)',
          pointerEvents: 'none',
        }}>scene 1 ↓</span>

        <span style={{
          position: 'absolute', top: '290px', right: '115px',
          fontFamily: 'Caveat, cursive', fontSize: '12px',
          color: 'rgba(201,64,48,0.4)',
          transform: 'rotate(-4deg)',
          pointerEvents: 'none',
        }}>in 60s!</span>

        <span style={{
          position: 'absolute', bottom: '280px', left: '130px',
          fontFamily: 'Caveat, cursive', fontSize: '12px',
          color: 'rgba(201,64,48,0.35)',
          transform: 'rotate(6deg)',
          pointerEvents: 'none',
        }}>lights, camera...</span>

        {/* Magic wand — upper center-left */}
        <RunawayDoodle top="15%" left="22%" animationName="float3d-2" duration="7s" delay="3s">
          <Doodles.MagicWand size={55} />
        </RunawayDoodle>

        {/* Film strip — lower center area */}
        <RunawayDoodle bottom="15%" left="30%" animationName="float3d-8" duration="9s" delay="1.5s">
          <Doodles.FilmStrip size={85} />
        </RunawayDoodle>

        {/* Lightbulb — upper right area */}
        <RunawayDoodle top="25%" right="18%" animationName="float3d-4" duration="8s" delay="0.3s">
          <Doodles.Lightbulb size={52} />
        </RunawayDoodle>

        {/* Main content */}
        <div style={{ maxWidth: 720, width: '100%', textAlign: 'center', zIndex: 2, position: 'relative' }}>
          {/* Badge pill */}
          <div style={{
            display: 'inline-block',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '11px',
            color: '#c94030',
            border: '1px solid rgba(201,64,48,0.4)',
            borderRadius: '20px',
            padding: '4px 14px',
            background: 'rgba(201,64,48,0.06)',
            letterSpacing: '0.1em',
            marginBottom: '20px',
          }}>✦ AI Filmmaker — v2.0</div>

          <h1 style={{
            fontFamily: 'Caveat, cursive',
            fontWeight: 700,
            fontSize: 'clamp(72px,14vw,140px)',
            color: '#1a1008',
            margin: '0 0 8px',
            lineHeight: 1,
          }}>
            <span style={{ color: '#c94030', transform: 'rotate(-2deg)', display: 'inline-block' }}>raun</span>
            <span style={{ fontSize: '0.6em' }}>.ai</span>
          </h1>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <Doodles.WavyLine width={280} color="#c94030" />
          </div>

          <p style={{
            fontFamily: 'Caveat, cursive',
            fontStyle: 'italic',
            fontSize: 'clamp(20px,3vw,28px)',
            color: '#3d2b1a',
            margin: '0 0 36px',
          }}>
            turn a thought into a <span style={{ color: '#c94030' }}>cinematic reel</span>
          </p>

          <HeroInput />

          <div style={{ marginBottom: 28 }}>
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: '#8a7060',
              letterSpacing: '0.12em',
              margin: '0 0 4px',
            }}>FREE · NO CARD REQUIRED · 30 REELS TO START</p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-4)', marginTop: '4px', letterSpacing: '0.05em' }}>
              each reel takes ~8–10 min on free tier
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(18px, 3vw, 28px)', color: 'var(--pink)', fontFamily: 'Caveat, cursive', fontWeight: 700, lineHeight: 1 }}>8–10 min</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8a7060', letterSpacing: '0.08em', marginTop: 4 }}>to generate</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: 34, fontWeight: 700, color: '#c94030', lineHeight: 1 }}>∞</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8a7060', letterSpacing: '0.08em', marginTop: 4 }}>creativity</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 1b. QUOTE SECTION — Last page of a rough book ── */}
      <section style={{ background: '#ede7d8', padding: '72px 24px', display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1, overflow: 'hidden' }}>

        <NotebookBg />

        {/* Pencil doodle — small star (top right area) */}
        <svg style={{ position: 'absolute', top: 28, right: 96, opacity: 0.13, pointerEvents: 'none' }} width="44" height="44" viewBox="0 0 44 44">
          <path d="M22,3 L25,17 L40,17 L28,26 L33,40 L22,31 L11,40 L16,26 L4,17 L19,17 Z" stroke="#4a3520" strokeWidth="1.3" fill="none" strokeLinejoin="round" />
        </svg>

        {/* Pencil doodle — wavy scribble (bottom left) */}
        <svg style={{ position: 'absolute', bottom: 32, left: 110, opacity: 0.10, pointerEvents: 'none' }} width="70" height="24" viewBox="0 0 70 24">
          <path d="M2,12 Q12,3 22,12 Q32,21 42,12 Q52,3 62,12 Q66,15 68,12" stroke="#4a3520" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>

        {/* Pencil doodle — small arrow (bottom right area) */}
        <svg style={{ position: 'absolute', bottom: 44, right: 130, opacity: 0.10, pointerEvents: 'none', transform: 'rotate(12deg)' }} width="52" height="28" viewBox="0 0 52 28">
          <path d="M4,14 L40,14 M29,4 L43,14 L29,24" stroke="#4a3520" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Pencil doodle — tiny circles top left area */}
        <svg style={{ position: 'absolute', top: 44, left: 130, opacity: 0.09, pointerEvents: 'none' }} width="34" height="34" viewBox="0 0 34 34">
          <circle cx="17" cy="17" r="12" stroke="#4a3520" strokeWidth="1.2" fill="none" />
          <circle cx="17" cy="17" r="6" stroke="#4a3520" strokeWidth="0.8" fill="none" />
        </svg>

        {/* RunawayDoodles — quote section */}
        <RunawayDoodle top="10%" left="3%" animationName="float3d-3" duration="7s" delay="0.5s" zIndex={0}>
          <div style={{ opacity: 0.62 }}><Doodles.MagicWand size={50} /></div>
        </RunawayDoodle>
        <RunawayDoodle bottom="8%" right="4%" animationName="float3d-5" duration="8s" delay="1.2s" zIndex={0}>
          <div style={{ opacity: 0.62 }}><Doodles.FilmStrip size={76} /></div>
        </RunawayDoodle>
        <RunawayDoodle top="18%" right="5%" animationName="float3d-2" duration="6.5s" delay="2s" zIndex={0}>
          <div style={{ opacity: 0.58 }}><Doodles.Play size={44} /></div>
        </RunawayDoodle>
        <RunawayDoodle bottom="16%" left="5%" animationName="float3d-7" duration="9s" delay="0.8s" zIndex={0}>
          <div style={{ opacity: 0.58 }}><Doodles.Lightbulb size={46} /></div>
        </RunawayDoodle>

        {/* Sticky note — tagline card */}
        <div style={{
          position: 'relative',
          display: 'inline-block',
          maxWidth: '580px',
          width: '100%',
          textAlign: 'center',
          zIndex: 1,
          background: '#fef08a',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(180,152,30,0.18) 27px, rgba(180,152,30,0.18) 28px)',
          padding: '52px 52px 44px',
          transform: 'rotate(-1.8deg)',
          boxShadow: '1px 2px 0 rgba(0,0,0,0.05), 4px 8px 24px rgba(0,0,0,0.16), 0 0 0 1px rgba(180,150,20,0.12)',
        }}>

          {/* Tape strip */}
          <div style={{
            position: 'absolute',
            top: -13, left: '50%',
            transform: 'translateX(-50%) rotate(1deg)',
            width: 74, height: 26,
            background: 'rgba(255,248,160,0.68)',
            border: '1px solid rgba(200,168,30,0.25)',
            borderRadius: 2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }} />

          {/* Opening quote mark */}
          <span style={{
            fontFamily: 'Caveat, cursive', fontSize: '100px',
            color: 'rgba(201,64,48,0.12)', lineHeight: 0,
            position: 'absolute', top: '10px', left: '10px',
            userSelect: 'none', pointerEvents: 'none',
          }}>"</span>

          {/* Quote text */}
          <div style={{ fontFamily: 'Caveat, cursive', fontWeight: 700, lineHeight: 1.15, position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 'clamp(22px, 3.5vw, 32px)', color: '#5a4030', fontStyle: 'italic', letterSpacing: '0.5px', marginBottom: '4px' }}>
              Creative Ideas Begin on
            </div>
            <div style={{ fontSize: 'clamp(34px, 6vw, 68px)', color: '#c94030', fontStyle: 'italic', letterSpacing: '-1px', lineHeight: 1.0, position: 'relative', display: 'inline-block' }}>
              the Last Page&nbsp;<span style={{ fontSize: '0.52em', verticalAlign: 'middle', fontStyle: 'normal', opacity: 0.85 }}>:)</span>
              <svg style={{ position: 'absolute', bottom: '-6px', left: 0, width: '100%', height: '10px', overflow: 'visible' }} viewBox="0 0 300 10" preserveAspectRatio="none" fill="none">
                <path d="M2,7 Q40,2 80,6 Q120,10 160,5 Q200,1 240,6 Q270,9 298,5" stroke="#c94030" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
                <path d="M5,9 Q60,5 120,8 Q180,11 240,7 Q270,5 296,8" stroke="#c94030" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
              </svg>
            </div>
          </div>

          {/* Closing quote mark */}
          <span style={{
            fontFamily: 'Caveat, cursive', fontSize: '100px',
            color: 'rgba(201,64,48,0.10)', lineHeight: 0,
            position: 'absolute', bottom: '2px', right: '12px',
            userSelect: 'none', pointerEvents: 'none',
          }}>"</span>

          {/* Pencil-textured attribution */}
          <div style={{ marginTop: '28px', textAlign: 'right', lineHeight: 0 }}>
            <svg width="160" height="38" viewBox="0 0 160 38" style={{ display: 'inline-block', overflow: 'visible' }}>
              <defs>
                <filter id="pencil-raun" x="-4%" y="-25%" width="115%" height="170%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="4" stitchTiles="stitch" result="noise"/>
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="warped"/>
                  <feGaussianBlur in="warped" stdDeviation="0.38" result="soft"/>
                  <feComposite in="soft" in2="SourceGraphic" operator="over"/>
                </filter>
              </defs>
              <text
                x="155" y="28"
                textAnchor="end"
                fontFamily="Caveat, cursive"
                fontSize="26"
                fontWeight="600"
                fill="rgba(56,40,22,0.68)"
                filter="url(#pencil-raun)"
                letterSpacing="1.5"
              >— raun</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ── 2. MARQUEE TICKER ── */}
      <div style={{ background: '#c94030', borderTop: '2px solid #1a1008', borderBottom: '2px solid #1a1008', overflow: 'hidden', padding: '12px 0' }}>
        <div style={{ display: 'inline-block', animation: 'marquee 22s linear infinite', whiteSpace: 'nowrap' }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ fontFamily: 'Caveat, cursive', fontSize: 22, color: '#faf6ee', margin: '0 32px' }}>
              🎬 WRITE YOUR PROMPT &nbsp;✦&nbsp; AI WRITES YOUR FILM &nbsp;✦&nbsp; 60 SECONDS TO REEL &nbsp;✦&nbsp; raun.ai DOES THE REST &nbsp;&nbsp;&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ── 3. HOW IT WORKS (dark) ── */}
      <section style={{ background: '#1a1008', padding: '80px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#c94030' }} />
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ marginBottom: 48, textAlign: 'center' }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#d4840a', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>02 / PROCESS</span>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: 'clamp(36px,6vw,56px)', fontWeight: 700, color: '#f0ebe0', margin: 0 }}>from brief to film</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} style={{
                background: '#f0ebe0',
                backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, rgba(140,105,70,0.14) 23px, rgba(140,105,70,0.14) 24px)',
                border: '2px solid rgba(201,64,48,0.25)',
                borderRadius: 10,
                padding: '28px 22px',
                position: 'relative',
                boxShadow: '4px 4px 0 rgba(201,64,48,0.35)',
              }}>
                <span style={{ position: 'absolute', top: 12, right: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#c94030', letterSpacing: '0.1em' }}>{step.label}</span>
                <div style={{ marginBottom: 14 }}>{step.icon}</div>
                <div style={{ fontFamily: 'Caveat, cursive', fontSize: 22, fontWeight: 700, color: '#1a1008', marginBottom: 6 }}>{step.title}</div>
                <div style={{ fontSize: 13, color: '#5a4030', lineHeight: 1.5 }}>{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. FEATURES (light) ── */}
      <section style={{ background: '#ede7d8', padding: '80px 24px', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        <NotebookBg lineOpacity={0.14} hatchOpacity={0.08} />

        {/* RunawayDoodles — features section */}
        <RunawayDoodle top="6%" left="2%" animationName="spin3d-slow" duration="14s" delay="0s" zIndex={0}>
          <div style={{ opacity: 0.58 }}><Doodles.StarBurst size={36} /></div>
        </RunawayDoodle>
        <RunawayDoodle top="7%" right="2.5%" animationName="float3d-1" duration="7s" delay="1s" zIndex={0}>
          <div style={{ opacity: 0.62 }}><Doodles.Camera size={62} /></div>
        </RunawayDoodle>
        <RunawayDoodle bottom="7%" left="2.5%" animationName="float3d-6" duration="9s" delay="0.5s" zIndex={0}>
          <div style={{ opacity: 0.62 }}><Doodles.FilmReel size={58} /></div>
        </RunawayDoodle>
        <RunawayDoodle bottom="8%" right="2%" animationName="float3d-8" duration="6.5s" delay="2s" zIndex={0}>
          <div style={{ opacity: 0.6 }}><Doodles.Clapperboard size={64} /></div>
        </RunawayDoodle>
        <RunawayDoodle top="44%" left="1%" animationName="float3d-3" duration="7.5s" delay="1.5s" zIndex={0}>
          <div style={{ opacity: 0.52 }}><Doodles.Arrow size={52} /></div>
        </RunawayDoodle>

        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 40 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8a7060', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>03 / CAPABILITIES</span>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: 'clamp(30px,5vw,48px)', fontWeight: 700, color: '#1a1008', margin: '0 0 8px' }}>everything you need</h2>
            <p style={{ color: '#8a7060', fontSize: 14, margin: 0 }}>A complete production pipeline, not just a generator.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
            {FEATURES.map((f) => (
              <FeatureCard key={f.cap} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. EXAMPLE REELS (dark) ── */}
      {EXAMPLE_REELS.length > 0 && (
        <section style={{ background: '#1a1008', padding: '80px 24px', position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#c94030' }} />
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 40 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#d4840a', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>04 / ARCHIVE</span>
              <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: 'clamp(30px,5vw,48px)', fontWeight: 700, color: '#f0ebe0', margin: '0 0 8px' }}>see what you can make</h2>
              <p style={{ color: 'rgba(240,235,224,0.4)', fontSize: 14, margin: 0 }}>— each from a single sentence</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
              {EXAMPLE_REELS.map((ex) => (
                <ExampleReelCard key={ex.id} example={ex} onTry={handleTryPrompt} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 6. PRICING (dark) ── */}
      <section style={{ background: '#231508', padding: '80px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ marginBottom: 40 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#d4840a', letterSpacing: '0.12em', display: 'block', marginBottom: 8 }}>05 / PRICING</span>
            <h2 style={{ fontFamily: 'Caveat, cursive', fontSize: 'clamp(30px,5vw,48px)', fontWeight: 700, color: '#f0ebe0', margin: '0 0 8px' }}>simple pricing</h2>
            <p style={{ color: 'rgba(240,235,224,0.4)', fontSize: 14, margin: 0 }}>Start free. Upgrade when you need more.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>

            {/* Free */}
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              position: 'relative',
              boxShadow: '4px 4px 0 #c94030',
            }}>
              <span style={{
                position: 'absolute', top: 16, right: 16,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: '#c94030', border: '1px solid rgba(201,64,48,0.4)',
                padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em',
                transform: 'rotate(6deg)', background: 'rgba(201,64,48,0.08)',
              }}>UNCLASSIFIED</span>
              <div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(240,235,224,0.4)', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>FREE</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{ fontFamily: 'Caveat, cursive', fontSize: 48, fontWeight: 700, color: '#f0ebe0', lineHeight: 1 }}>$0</span>
                  <span style={{ color: 'rgba(240,235,224,0.4)', marginBottom: 4, fontSize: 13 }}>/month</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['30 reels free', '720p export', 'All moods and transitions'].map((item) => (
                  <li key={item} style={{ fontSize: 13, color: 'rgba(240,235,224,0.55)' }}>✓ &nbsp;{item}</li>
                ))}
                {['Brand Kit', 'Evals'].map((item) => (
                  <li key={item} style={{ fontSize: 13, color: 'rgba(240,235,224,0.2)', textDecoration: 'line-through' }}>{item}</li>
                ))}
              </ul>
              <Link
                to="/signup"
                style={{
                  marginTop: 'auto', display: 'block', textAlign: 'center',
                  padding: '11px 0', borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(240,235,224,0.7)',
                  fontFamily: 'Caveat, cursive', fontSize: 20,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.5)'; e.currentTarget.style.color = '#f0ebe0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(240,235,224,0.7)'; }}
              >Get Started Free</Link>
            </div>

            {/* Creator */}
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(201,64,48,0.3)',
              borderRadius: 10,
              padding: '32px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              position: 'relative',
              boxShadow: '4px 4px 0 rgba(212,132,10,0.5)',
            }}>
              <span style={{
                position: 'absolute', top: 16, right: 16,
                fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                color: '#d4840a', border: '1px solid rgba(212,132,10,0.4)',
                padding: '3px 8px', borderRadius: 3, letterSpacing: '0.1em',
                transform: 'rotate(6deg)', background: 'rgba(212,132,10,0.08)',
              }}>AUTHORIZED</span>
              <div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#d4840a', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>CREATOR</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{ fontFamily: 'Caveat, cursive', fontSize: 48, fontWeight: 700, color: '#f0ebe0', lineHeight: 1 }}>$29</span>
                  <span style={{ color: 'rgba(240,235,224,0.4)', marginBottom: 4, fontSize: 13 }}>/month</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['Unlimited reels', '1080p export', 'All moods and transitions', 'Brand Kit', 'Eval framework'].map((item) => (
                  <li key={item} style={{ fontSize: 13, color: 'rgba(240,235,224,0.65)' }}>✓ &nbsp;{item}</li>
                ))}
              </ul>
              <Link
                to="/signup"
                style={{
                  marginTop: 'auto', display: 'block', textAlign: 'center',
                  padding: '11px 0', borderRadius: 6,
                  background: '#c94030', color: '#fff',
                  fontFamily: 'Caveat, cursive', fontSize: 20,
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >Start with Creator</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FEEDBACK ── */}
      <FeedbackSection />

      {/* ── 8. FOOTER ── */}
      <footer style={{ background: '#1a1008', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28, opacity: 0.22 }}>
            <Doodles.WavyLine width={300} color="#f0ebe0" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ opacity: 0.38 }}><Doodles.FilmReel size={28} color="#f0ebe0" /></div>
              <span style={{ fontFamily: 'Caveat, cursive', fontSize: 28, fontWeight: 700 }}>
                <span style={{ color: '#c94030' }}>raun</span><span style={{ color: '#f0ebe0' }}>.ai</span>
              </span>
              <div style={{ opacity: 0.38 }}><Doodles.Camera size={28} color="#f0ebe0" /></div>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[['Pricing', '/pricing'], ['Studio', '/studio'], ['Sign in', '/login']].map(([label, to]) => (
                <Link
                  key={to}
                  to={to}
                  style={{ fontFamily: 'Caveat, cursive', fontSize: 18, color: 'rgba(240,235,224,0.4)', transition: 'color 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f0ebe0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(240,235,224,0.4)'; }}
                >{label}</Link>
              ))}
            </div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(240,235,224,0.2)' }}>
              © 2025 raun.ai · SESSION/{SESSION_ID}
            </span>
          </div>
          <p style={{ fontFamily: 'Caveat, cursive', fontStyle: 'italic', fontSize: 20, color: 'rgba(240,235,224,0.2)', textAlign: 'center', margin: 0 }}>
            "Creative Ideas Begin on the Last Page :)" — raun
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
