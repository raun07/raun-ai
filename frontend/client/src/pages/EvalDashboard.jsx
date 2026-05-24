import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const card = {
  padding: "20px 24px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
};

function SummaryCard({ label, value, sub }) {
  return (
    <div style={{ ...card, flex: "1 1 160px", minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>{label}</p>
      <p style={{ margin: "6px 0 2px", fontSize: "28px", fontWeight: 700, color: "#fff" }}>
        {value}
      </p>
      {sub && <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{sub}</p>}
    </div>
  );
}

function ScoreBadge({ score }) {
  const pct = Math.round((score ?? 0) * 100);
  const color =
    pct >= 65 ? "#4ade80" : pct >= 50 ? "#facc15" : "#f87171";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "999px",
        background: `${color}22`,
        color,
        fontWeight: 700,
        fontSize: "13px",
      }}
    >
      {pct}%
    </span>
  );
}

function PassBadge({ passed }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: "999px",
        background: passed ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
        color: passed ? "#4ade80" : "#f87171",
        fontWeight: 700,
        fontSize: "12px",
      }}
    >
      {passed ? "PASS" : "FAIL"}
    </span>
  );
}

function rowBg(score) {
  const pct = (score ?? 0) * 100;
  if (pct >= 65) return "rgba(74,222,128,0.04)";
  if (pct >= 50) return "rgba(250,204,21,0.06)";
  return "rgba(248,113,113,0.06)";
}

function EvalModal({ eval: e, onClose }) {
  if (!e) return null;
  const sm = e.script_metrics || {};
  const vm = e.visual_metrics || {};
  const am = e.audio_metrics || {};
  const pm = e.pipeline_metrics || {};

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: "20px",
      }}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        style={{
          background: "#111", borderRadius: "20px",
          padding: "28px", maxWidth: "560px", width: "100%",
          border: "1px solid rgba(255,255,255,0.12)",
          maxHeight: "80vh", overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "18px" }}>Eval Detail</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "20px" }}
          >
            ×
          </button>
        </div>

        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginBottom: "4px" }}>
          Job: <code style={{ color: "#aaa" }}>{e.job_id}</code>
        </p>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginBottom: "16px" }}>
          Prompt: <em>"{e.prompt}"</em>
        </p>

        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <PassBadge passed={e.passed} />
          <ScoreBadge score={e.overall_score} />
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", alignSelf: "center" }}>
            {e.timestamp ? new Date(e.timestamp).toLocaleString() : ""}
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "16px" }}>
          <tbody>
            {[
              ["Script score", sm.score],
              ["↳ Coherence", sm.coherence_score],
              ["Visual score", vm.score],
              ["↳ Footage rate", vm.footage_rate],
              ["Audio score", am.score],
              ["↳ Sync delta", `${am.sync_delta_s ?? 0}s`],
            ].map(([label, val]) => (
              <tr key={label} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <td style={{ padding: "7px 0", color: "rgba(255,255,255,0.6)" }}>{label}</td>
                <td style={{ padding: "7px 0", textAlign: "right", color: "#fff", fontWeight: 600 }}>
                  {typeof val === "number" ? `${Math.round(val * 100)}%` : val}
                </td>
              </tr>
            ))}
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <td style={{ padding: "7px 0", color: "rgba(255,255,255,0.6)" }}>LLM tokens</td>
              <td style={{ padding: "7px 0", textAlign: "right", color: "#fff", fontWeight: 600 }}>
                {pm.llm_total_tokens ?? 0}
              </td>
            </tr>
            <tr>
              <td style={{ padding: "7px 0", color: "rgba(255,255,255,0.6)" }}>Rewrite cycles</td>
              <td style={{ padding: "7px 0", textAlign: "right", color: "#fff", fontWeight: 600 }}>
                {pm.agent_rewrite_cycles ?? 0}
              </td>
            </tr>
          </tbody>
        </table>

        {e.failure_reasons?.length > 0 && (
          <div>
            <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#f87171", fontSize: "13px" }}>
              Failure reasons
            </p>
            <ul style={{ margin: 0, paddingLeft: "18px" }}>
              {e.failure_reasons.map((f, i) => (
                <li key={i} style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", marginBottom: "4px" }}>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EvalDashboard() {
  const { getToken } = useAuth();
  const [patterns, setPatterns] = useState(null);
  const [recents, setRecents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const headers = await authHeaders();
        const [pRes, rRes] = await Promise.all([
          fetch(`${API_BASE_URL}/evals/patterns`, { headers }),
          fetch(`${API_BASE_URL}/evals/recent?limit=50`, { headers }),
        ]);
        if (!pRes.ok || !rRes.ok) throw new Error("API error");
        const [p, r] = await Promise.all([pRes.json(), rRes.json()]);
        setPatterns(p);
        setRecents(r.results || []);
      } catch (e) {
        setError("Failed to load eval data. Run a generation first.");
      } finally {
        setLoading(false);
      }
    })();
  }, [authHeaders]);

  const style = {
    padding: "20px",
    background: "radial-gradient(circle at top, rgba(255,124,92,0.1), transparent 28%), #0a0a0a",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "system-ui, sans-serif",
  };

  if (loading) {
    return (
      <div style={style}>
        <p style={{ color: "rgba(255,255,255,0.5)" }}>Loading eval data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style}>
        <p style={{ color: "#f87171" }}>{error}</p>
      </div>
    );
  }

  const passRatePct = patterns ? Math.round((patterns.pass_rate ?? 0) * 100) : 0;
  const avgScorePct = patterns ? Math.round((patterns.avg_score ?? 0) * 100) : 0;

  return (
    <div style={style}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: 700 }}>
          Generation Quality Dashboard
        </h1>
        <p style={{ marginTop: "6px", color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>
          Automated scoring across every reel generation
        </p>
      </div>

      {/* Row 1 — summary cards */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "24px", flexWrap: "wrap" }}>
        <SummaryCard
          label="Total Generations"
          value={patterns?.total_evals ?? 0}
        />
        <SummaryCard
          label="Pass Rate"
          value={`${passRatePct}%`}
          sub="score ≥ 65%"
        />
        <SummaryCard
          label="Avg Score"
          value={`${avgScorePct}%`}
        />
        <SummaryCard
          label="Avg Tokens / Job"
          value={Math.round(patterns?.avg_tokens_per_job ?? 0).toLocaleString()}
          sub="across all agents"
        />
      </div>

      {/* Row 2 — failure patterns */}
      <div style={{ ...card, marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 600 }}>
          Common Failure Patterns
        </h2>
        {!patterns?.common_failures?.length ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>
            No failures recorded yet.
          </p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: "18px" }}>
            {patterns.common_failures.map(([pattern, count], i) => {
              const rate = patterns.total_evals
                ? count / patterns.total_evals
                : 0;
              const highlight = rate > 0.3;
              return (
                <li
                  key={i}
                  style={{
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.75)",
                  }}
                >
                  <span style={{ flex: 1 }}>{pattern}…</span>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: highlight
                        ? "rgba(248,113,113,0.2)"
                        : "rgba(255,255,255,0.08)",
                      color: highlight ? "#f87171" : "rgba(255,255,255,0.6)",
                      fontSize: "12px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {count}× ({Math.round(rate * 100)}%)
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Row 3 — recent evals table */}
      <div style={card}>
        <h2 style={{ margin: "0 0 14px", fontSize: "16px", fontWeight: 600 }}>
          Recent Evaluations
        </h2>
        {!recents.length ? (
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>
            No evaluations yet. Generate a reel to see results here.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  {["Job ID", "Prompt", "Score", "Visual", "Audio", "Script", "Result"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 10px",
                        textAlign: "left",
                        color: "rgba(255,255,255,0.45)",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recents.slice().reverse().map((e) => (
                  <tr
                    key={e.job_id}
                    onClick={() => setSelected(e)}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: rowBg(e.overall_score),
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(ev) =>
                      (ev.currentTarget.style.background = "rgba(255,255,255,0.06)")
                    }
                    onMouseLeave={(ev) =>
                      (ev.currentTarget.style.background = rowBg(e.overall_score))
                    }
                  >
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>
                      {e.job_id?.slice(0, 8)}…
                    </td>
                    <td style={{ padding: "9px 10px", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.prompt}
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <ScoreBadge score={e.overall_score} />
                    </td>
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.7)" }}>
                      {Math.round((e.visual_metrics?.score ?? 0) * 100)}%
                    </td>
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.7)" }}>
                      {Math.round((e.audio_metrics?.score ?? 0) * 100)}%
                    </td>
                    <td style={{ padding: "9px 10px", color: "rgba(255,255,255,0.7)" }}>
                      {Math.round((e.script_metrics?.score ?? 0) * 100)}%
                    </td>
                    <td style={{ padding: "9px 10px" }}>
                      <PassBadge passed={e.passed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <EvalModal eval={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
