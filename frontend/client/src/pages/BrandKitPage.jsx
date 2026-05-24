import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import Navbar from "../components/Navbar";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export default function BrandKitPage() {
  const { getToken } = useAuth();
  const [kit, setKit] = useState({ logo_url: null, outro_clip_url: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const logoInputRef = useRef(null);
  const outroInputRef = useRef(null);

  const getAuthHeaders = useCallback(async () => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const fetchKit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/brand-kit`, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) setKit(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => { fetchKit(); }, [fetchKit]);

  const uploadAsset = async (endpoint, file) => {
    setSaving(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setKit((prev) => ({ ...prev, ...data.brand_kit }));
      setMessage("Saved!");
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const card = {
    padding: "24px",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: "20px",
    textAlign: "left",
  };

  const fileBtn = {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "10px",
    border: "1px dashed rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.72)",
    cursor: "pointer",
    fontSize: "14px",
  };

  return (
    <div
      style={{
        padding: "20px",
        background: "radial-gradient(circle at top, rgba(255,124,92,0.16), transparent 28%), #0a0a0a",
        minHeight: "100vh",
        color: "white",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Navbar userProfile={null} />

      <div style={card}>
        <h1 style={{ marginTop: 0, marginBottom: "6px", fontSize: "32px" }}>Brand Kit</h1>
        <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "24px" }}>
          Your logo and outro are automatically applied to every reel you generate.
        </p>

        {loading ? (
          <p style={{ color: "rgba(255,255,255,0.5)" }}>Loading…</p>
        ) : (
          <>
            {/* Logo */}
            <div style={{ marginBottom: "28px" }}>
              <h3 style={{ marginBottom: "10px" }}>Logo Watermark</h3>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px", marginBottom: "12px" }}>
                PNG or WebP with transparency. Appears top-right at 8% video width.
              </p>
              {kit.logo_url && (
                <img
                  src={kit.logo_url}
                  alt="Logo"
                  style={{ maxHeight: "60px", marginBottom: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.1)", padding: "6px" }}
                />
              )}
              <label style={fileBtn}>
                {saving ? "Uploading…" : kit.logo_url ? "Replace logo" : "Upload logo"}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && uploadAsset("/upload/logo", e.target.files[0])}
                />
              </label>
            </div>

            {/* Outro */}
            <div>
              <h3 style={{ marginBottom: "10px" }}>Outro Clip</h3>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "14px", marginBottom: "12px" }}>
                Short MP4 appended to the end of every reel (3–10 seconds recommended).
              </p>
              {kit.outro_clip_url && (
                <video
                  src={kit.outro_clip_url}
                  controls
                  style={{ maxWidth: "320px", borderRadius: "10px", marginBottom: "12px", display: "block" }}
                />
              )}
              <label style={fileBtn}>
                {saving ? "Uploading…" : kit.outro_clip_url ? "Replace outro" : "Upload outro"}
                <input
                  ref={outroInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && uploadAsset("/upload/outro", e.target.files[0])}
                />
              </label>
            </div>

            {message && (
              <p style={{ marginTop: "16px", color: message.startsWith("Error") ? "#ff6b6b" : "#00c853", fontWeight: 600 }}>
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
