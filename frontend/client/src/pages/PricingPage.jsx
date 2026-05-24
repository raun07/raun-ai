import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Link } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function PricingPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const response = await fetch(`${API_BASE_URL}/billing/create-checkout`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || data.message || "Unable to start checkout.");
        setLoading(false);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError("Stripe checkout URL was not returned.");
    } catch (checkoutError) {
      console.error(checkoutError);
      setError("Unable to start checkout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px 20px",
        background:
          "radial-gradient(circle at top, rgba(255,148,91,0.18), transparent 28%), #09090b",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <Link to="/studio" style={{ color: "#ff9d7a", textDecoration: "none" }}>
            ← Back to Studio
          </Link>
          <h1 style={{ marginBottom: "12px", fontSize: "48px" }}>Simple pricing for reel creation</h1>
          <p style={{ color: "rgba(255,255,255,0.7)", maxWidth: "720px" }}>
            Start free, then top up when you are ready to make more. No subscription lock-in.
          </p>
        </div>

        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(130, 24, 24, 0.35)",
              border: "1px solid rgba(255, 110, 110, 0.6)",
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}
        >
          {/* FREE */}
          <div
            style={{
              padding: "28px",
              borderRadius: "24px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <p style={{ marginBottom: "10px", color: "#ffd9c7", fontWeight: 700, letterSpacing: "0.08em", fontSize: "12px" }}>FREE</p>
            <h2 style={{ marginTop: 0, marginBottom: "4px", fontSize: "42px", lineHeight: 1 }}>$0</h2>
            <p style={{ marginTop: 0, marginBottom: "12px", color: "rgba(255,255,255,0.45)", fontSize: "13px" }}>/month</p>
            <p style={{ marginBottom: "20px", color: "rgba(255,255,255,0.65)", fontSize: "14px", lineHeight: 1.6 }}>
              Start creating immediately — no card needed.
            </p>
            <ul style={{ margin: "0 0 24px", paddingLeft: "18px", color: "rgba(255,255,255,0.7)", lineHeight: 2, fontSize: "14px" }}>
              <li>30 reels free</li>
              <li>720p export</li>
              <li>All moods and transitions</li>
            </ul>
            <Link
              to="/studio"
              style={{
                marginTop: "auto",
                display: "block",
                textAlign: "center",
                padding: "13px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.7)",
                textDecoration: "none",
                fontSize: "15px",
                fontWeight: 600,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(255,157,122,0.5)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >
              Go to Studio
            </Link>
          </div>

          {/* CREATOR */}
          <div
            style={{
              padding: "28px",
              borderRadius: "24px",
              background: "linear-gradient(160deg, rgba(255,113,67,0.22), rgba(255,255,255,0.05))",
              border: "1px solid rgba(255,157,122,0.45)",
              boxShadow: "0 20px 45px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <p style={{ marginBottom: "10px", color: "#fff0cc", fontWeight: 700, letterSpacing: "0.08em", fontSize: "12px" }}>CREATOR</p>
            <h2 style={{ marginTop: 0, marginBottom: "4px", fontSize: "42px", lineHeight: 1 }}>$29</h2>
            <p style={{ marginTop: 0, marginBottom: "12px", color: "rgba(255,255,255,0.45)", fontSize: "13px" }}>/month</p>
            <p style={{ marginBottom: "20px", color: "rgba(255,255,255,0.78)", fontSize: "14px", lineHeight: 1.6 }}>
              Unlimited reels and every premium feature — no caps, no surprises.
            </p>
            <ul style={{ margin: "0 0 24px", paddingLeft: "18px", color: "rgba(255,255,255,0.85)", lineHeight: 2, fontSize: "14px" }}>
              <li>Unlimited reels</li>
              <li>1080p export</li>
              <li>All moods and transitions</li>
              <li>Brand Kit (logo + outro)</li>
              <li>Eval framework</li>
            </ul>
            <button
              onClick={startCheckout}
              disabled={loading}
              style={{
                marginTop: "auto",
                width: "100%",
                padding: "14px 18px",
                borderRadius: "14px",
                border: "none",
                background: loading ? "#7a7a7a" : "#ff6b35",
                color: "#fff",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "15px",
                fontWeight: 700,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {loading ? "Redirecting..." : "Start with Creator →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PricingPage;
