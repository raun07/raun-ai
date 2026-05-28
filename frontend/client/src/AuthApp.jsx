import { useCallback, useEffect, useRef, useState } from "react";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  useAuth,
} from "@clerk/clerk-react";
import { Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import Navbar from "./components/Navbar";
import OnboardingTour from "./components/OnboardingTour";
import GeneratingScreen from "./components/GeneratingScreen";
import QuickFixPanel from "./components/QuickFixPanel";
import BrandKitPage from "./pages/BrandKitPage";
import EvalDashboard from "./pages/EvalDashboard";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import PricingPage from "./pages/PricingPage";
import SignupPage from "./pages/SignupPage";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function normalizeVideoUrl(url) {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE_URL}${url}`;
}

function ProtectedRoute({ children }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/studio" />
      </SignedOut>
    </>
  );
}

const MOODS = [
  { value: "cinematic", label: "Cinematic" },
  { value: "epic", label: "Epic" },
  { value: "emotional", label: "Emotional" },
  { value: "dark", label: "Dark" },
  { value: "uplifting", label: "Uplifting" },
  { value: "dramatic", label: "Dramatic" },
];

const EXAMPLE_PROMPTS = [
  { label: "Midnight Boxer", text: "A boxer trains alone at midnight, shadowboxing under a single flickering bulb in an empty warehouse." },
  { label: "Mars Explorer", text: "An astronaut steps onto the Martian surface for the first time, red dust rising with each slow step." },
  { label: "Tokyo Nights", text: "Neon-soaked Tokyo streets at 3 AM — a street musician plays to no one, rain pattering on the asphalt." },
  { label: "Chef's Table", text: "A world-renowned chef plates a dish in complete silence, every movement deliberate, every detail obsessive." },
  { label: "Morning Grind", text: "Before the city wakes, a runner pushes through dark empty streets, breath visible in the cold air." },
  { label: "Ocean Soul", text: "A free-diver descends into the deep ocean alone, sunlight fading, silence swallowing everything." },
];


function StudioPage() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userProfile, setUserProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState("cinematic");
  const [orientation, setOrientation] = useState("portrait");
  const [transitionStyle, setTransitionStyle] = useState("auto");
  const [footageFiles, setFootageFiles] = useState([]);
  const [footageUploading, setFootageUploading] = useState(false);
  const [footageAssetIds, setFootageAssetIds] = useState([]);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [finalUrl, setFinalUrl] = useState(null);
  const [localFinalUrl, setLocalFinalUrl] = useState(null);
  const [cloudVideoUrl, setCloudVideoUrl] = useState(null);
  const [exportFormats, setExportFormats] = useState([]);
  const [formatUrls, setFormatUrls] = useState({});
  const [applyBrandKit, setApplyBrandKit] = useState(true);
  const [brandKit, setBrandKit] = useState(null);
  const [logoPosition, setLogoPosition] = useState('top-right');
  const [logoSize, setLogoSize] = useState('S');
  const [logoTiming, setLogoTiming] = useState('full');
  const [script, setScript] = useState(null);
  const [evalBreakdown, setEvalBreakdown] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [enhancing, setEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [examplesOpen, setExamplesOpen] = useState(false);
  const [musicMode, setMusicMode] = useState("ai");
  const [customMusicId, setCustomMusicId] = useState("");
  const [customMusicName, setCustomMusicName] = useState("");
  const [voiceMode, setVoiceMode] = useState("ai");
  const [customVoiceId, setCustomVoiceId] = useState("");
  const [customVoiceName, setCustomVoiceName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const [userClips, setUserClips] = useState([]);
  const [clipError, setClipError] = useState('');
  const [reelCredits, setReelCredits] = useState(null);
  const [satisfaction, setSatisfaction] = useState(null);
  const [resultScenes, setResultScenes] = useState([]);
  const [aiNarration, setAiNarration] = useState(true);
  const [sceneCount, setSceneCount] = useState(3);
  const [durationPreset, setDurationPreset] = useState("medium");
  const [lastJobId, setLastJobId] = useState(null);
  const [generatingScript, setGeneratingScript] = useState(null);
  const [showTour, setShowTour] = useState(
    () => !localStorage.getItem("ptr_tour_completed")
  );
  const [loading, setLoading] = useState(false);
  const [generatingComplete, setGeneratingComplete] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadTitle, setDownloadTitle] = useState('');
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const getAuthHeaders = useCallback(async () => {
    const token = await getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const fetchUserProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/me`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setUserProfile(null);
        return;
      }
      setUserProfile(data);
    } catch (err) {
      console.error(err);
      setUserProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchBrandKit = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/brand-kit`, {
        headers: await getAuthHeaders(),
      });
      if (res.ok) setBrandKit(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [getAuthHeaders]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/user/generations`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setHistoryError(data.detail || data.message || "Unable to load reel history.");
        setHistory([]);
        return;
      }
      const items = (data.items || []).map((item) => ({
        ...item,
        video_url: normalizeVideoUrl(item.video_url),
      }));
      setHistory(items);
      if (!selectedHistoryItem && items.length > 0) {
        setSelectedHistoryItem(items[0]);
      }
    } catch (err) {
      console.error(err);
      setHistoryError("Unable to load reel history.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [getAuthHeaders, selectedHistoryItem]);

  useEffect(() => {
    fetchUserProfile();
    fetchHistory();
    fetchBrandKit();
  }, [fetchUserProfile, fetchHistory, fetchBrandKit]);

  useEffect(() => {
    const prefilledPrompt = searchParams.get("prompt");
    if (prefilledPrompt) {
      setPrompt(prefilledPrompt);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchResult = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/result/${id}`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      if (data.status === "completed" || data.status === "rendering_complete") {
        const normalizedPrimaryUrl = normalizeVideoUrl(data.video_url);
        const normalizedLocalUrl = normalizeVideoUrl(data.local_video_url);
        setFinalUrl(
          data.status === "rendering_complete"
            ? normalizedLocalUrl || normalizedPrimaryUrl
            : normalizedPrimaryUrl,
        );
        setLocalFinalUrl(normalizedLocalUrl);
        setCloudVideoUrl(data.status === "completed" ? normalizedPrimaryUrl : null);
        setFormatUrls(
          Object.fromEntries(
            Object.entries(data.format_urls || {}).map(([k, v]) => [k, normalizeVideoUrl(v)])
          )
        );
        if (data.credits) setReelCredits(data.credits);
        if (data.scenes?.length) setResultScenes(data.scenes);
        setMessage(
          data.status === "rendering_complete"
            ? "Render complete. Uploading to Cloudinary..."
            : "Video ready!",
        );
        fetchHistory();
        fetchUserProfile();
        if (data.status === "completed") setLoading(false);
      } else if (data.status === "failed") {
        setError(data.error || "Generation failed.");
      }
    } catch (err) {
      console.error(err);
      setError("Unable to fetch video result.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/status/${id}`, {
        headers: await getAuthHeaders(),
      });
      const data = await res.json();
      setStatus(data.status);
      setProgress(data.progress ?? 0);
      setMessage(data.message ?? "");
      if (data.script) setGeneratingScript(data.script);
      if (data.status === "rendering_complete") {
        const normalizedLocalUrl = normalizeVideoUrl(data.local_video_url || data.video_url);
        setFinalUrl(normalizedLocalUrl);
        setLocalFinalUrl(normalizedLocalUrl);
        setCloudVideoUrl(null);
        setFormatUrls(
          Object.fromEntries(
            Object.entries(data.format_urls || {}).map(([k, v]) => [k, normalizeVideoUrl(v)])
          )
        );
        if (data.credits) setReelCredits(data.credits);
        if (data.scenes?.length) setResultScenes(data.scenes);
        setMessage("Film complete!");
        setProgress(100);
        setLastJobId(id);
        // Keep GeneratingScreen alive briefly so completion planes can fire
        setGeneratingComplete(true);
        setTimeout(() => {
          setLoading(false);
          setGeneratingComplete(false);
        }, 1800);
      }
      if (data.status === "completed") {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (data.video_url || data.local_video_url) {
          setFinalUrl(normalizeVideoUrl(data.video_url));
          setLocalFinalUrl(normalizeVideoUrl(data.local_video_url));
          setCloudVideoUrl(normalizeVideoUrl(data.video_url));
          setFormatUrls(
            Object.fromEntries(
              Object.entries(data.format_urls || {}).map(([k, v]) => [k, normalizeVideoUrl(v)])
            )
          );
          if (data.credits) setReelCredits(data.credits);
          if (data.scenes?.length) setResultScenes(data.scenes);
          setMessage("Video ready!");
          setLastJobId(id);
          setLoading(false);
          fetchHistory();
          fetchUserProfile();
        } else {
          fetchResult(id);
        }
      }
      if (data.status === "failed") {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setError(data.error || data.message || "Video generation failed.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to fetch job status.");
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      setLoading(false);
    }
  };

  const startPolling = (id) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    fetchStatus(id);
    intervalRef.current = setInterval(() => fetchStatus(id), 2000);
  };

  const generateReel = async (opts = {}) => {
    const effectivePrompt = (opts instanceof Event ? null : opts?.promptOverride) || prompt;
    setError(null);
    setFinalUrl(null);
    setLocalFinalUrl(null);
    setCloudVideoUrl(null);
    setFormatUrls({});
    setReelCredits(null);
    setSatisfaction(null);
    setResultScenes([]);
    setJobId(null);
    setStatus(null);
    setProgress(0);
    setMessage("");
    setGeneratingComplete(false);
    if (!effectivePrompt.trim()) {
      setError("Please enter a prompt first.");
      return;
    }
    setGeneratedPrompt(effectivePrompt.trim());
    setLoading(true);

    let resolvedAssetIds = footageAssetIds;
    if (footageFiles.length > 0 && footageAssetIds.length === 0) {
      setFootageUploading(true);
      try {
        const form = new FormData();
        footageFiles.forEach((f) => form.append("files", f));
        const uploadRes = await fetch(`${API_BASE_URL}/upload/footage`, {
          method: "POST",
          headers: await getAuthHeaders(),
          body: form,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setError(uploadData.detail || "Footage upload failed.");
          setLoading(false);
          setFootageUploading(false);
          return;
        }
        resolvedAssetIds = (uploadData.assets || []).map((a) => a.asset_id);
        setFootageAssetIds(resolvedAssetIds);
      } catch (err) {
        setError("Unable to upload footage files.");
        setLoading(false);
        setFootageUploading(false);
        return;
      } finally {
        setFootageUploading(false);
      }
    }

    try {
      let res;
      if (userClips.length > 0) {
        const form = new FormData();
        form.append("prompt", effectivePrompt);
        form.append("orientation", orientation);
        form.append("scene_count", String(sceneCount));
        form.append("include_narration", String(aiNarration));
        form.append("transition_style", transitionStyle);
        form.append("apply_brand_kit", String(applyBrandKit));
        form.append("music_id", musicMode === "upload" ? customMusicId : "");
        form.append("voice_id", voiceMode !== "ai" ? customVoiceId : "");
        form.append("logo_position", logoPosition);
        form.append("logo_size", logoSize);
        form.append("logo_timing", logoTiming);
        form.append("logo_url", applyBrandKit && brandKit?.logo_url ? brandKit.logo_url : "");
        form.append("outro_url", applyBrandKit && brandKit?.outro_clip_url ? brandKit.outro_clip_url : "");
        userClips.forEach((clip) => form.append("clips", clip));
        res = await fetch(`${API_BASE_URL}/generate-with-clips`, {
          method: "POST",
          headers: await getAuthHeaders(),
          body: form,
        });
      } else {
        res = await fetch(`${API_BASE_URL}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify({
            prompt: effectivePrompt,
            orientation,
            footage_ids: resolvedAssetIds,
            export_formats: exportFormats,
            apply_brand_kit: applyBrandKit,
            transition_style: transitionStyle,
            music_id: musicMode === "upload" ? customMusicId : "",
            voice_id: voiceMode !== "ai" ? customVoiceId : "",
            scene_count: sceneCount,
            include_narration: aiNarration,
            logo_position: logoPosition,
            logo_size: logoSize,
            logo_timing: logoTiming,
            logo_url: applyBrandKit && brandKit?.logo_url ? brandKit.logo_url : "",
            outro_url: applyBrandKit && brandKit?.outro_clip_url ? brandKit.outro_clip_url : "",
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "credits_exhausted") {
          setUserProfile((current) =>
            current ? { ...current, credits: 0, tier: current.tier || "free" } : current,
          );
        }
        setError(data.detail || data.message || "Failed to start generation.");
        setLoading(false);
        return;
      }
      if (data.job_id) {
        setJobId(data.job_id);
        setStatus(data.status || "queued");
        setProgress(data.progress ?? 0);
        setMessage(data.message ?? "Queued");
        startPolling(data.job_id);
      } else {
        setError("Failed to start generation.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Unable to start generation.");
      setLoading(false);
    }
  };

  const handleDurationPreset = (preset) => {
    setDurationPreset(preset);
    if (preset === "short") setSceneCount(3);
    else if (preset === "medium") setSceneCount(5);
    else if (preset === "long") setSceneCount(7);
  };

  const rerenderCurrentVideo = async (overrides = {}) => {
    if (!lastJobId) return;
    setLoading(true);
    setProgress(0);
    setMessage("Applying changes...");
    setSatisfaction(null);
    try {
      const res = await fetch(`${API_BASE_URL}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          prompt: generatedPrompt || prompt,
          orientation,
          scene_count: sceneCount,
          mood: overrides.mood || mood,
          transition_style: transitionStyle,
          include_narration: overrides.include_narration ?? aiNarration,
          apply_brand_kit: applyBrandKit,
          logo_url: applyBrandKit && brandKit?.logo_url ? brandKit.logo_url : "",
          logo_position: logoPosition,
          logo_size: logoSize,
          logo_timing: logoTiming,
          outro_url: applyBrandKit && brandKit?.outro_clip_url ? brandKit.outro_clip_url : "",
          music_seed: overrides.music_seed || 0,
        }),
      });
      const data = await res.json();
      if (data.job_id) {
        setJobId(data.job_id);
        startPolling(data.job_id);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error("Rerender failed:", e);
      setLoading(false);
    }
  };

  const handleFixApplied = async (fix) => {
    // Surgical re-renders — same clips, different settings
    if (fix.rerender_only) {
      if (fix.action === "toggle_narration") {
        setAiNarration(fix.include_narration);
        await rerenderCurrentVideo({ include_narration: fix.include_narration });
        return;
      }
      if (fix.action === "change_music") {
        setMood(fix.mood || mood);
        await rerenderCurrentVideo({ mood: fix.mood || mood, music_seed: Date.now() });
        return;
      }
      if (fix.action === "change_mood") {
        setMood(fix.mood);
        await rerenderCurrentVideo({ mood: fix.mood });
        return;
      }
      if (fix.action === "new_script") {
        const guidedPrompt = `${prompt} — ${fix.guidance || "rewrite the narration"}`;
        generateReel({ promptOverride: guidedPrompt });
        return;
      }
    }

    // Simple "New music" button — rerender with a fresh music seed, no full pipeline restart
    if (fix.action === "new_music") {
      await rerenderCurrentVideo({ music_seed: Date.now() });
      return;
    }

    // Clip was replaced — QuickFixPanel already polled; extract URL from payload
    if (fix.action === "scene_replaced") {
      const newUrl = normalizeVideoUrl(fix.local_video_url || fix.video_url);
      if (newUrl) {
        setFinalUrl(newUrl);
        setLocalFinalUrl(newUrl);
        if (fix.new_job_id) { setJobId(fix.new_job_id); setLastJobId(fix.new_job_id); }
      }
      if (fix.scenes?.length) setResultScenes(fix.scenes);
      return;
    }

    // Full regeneration
    if (fix.action === "regenerate") {
      if (fix.prompt) setPrompt(fix.prompt);
      generateReel({ promptOverride: fix.prompt });
      return;
    }

    // Legacy actions from simple panel buttons
    generateReel();
  };

  const handleReset = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setFinalUrl(null);
    setLocalFinalUrl(null);
    setCloudVideoUrl(null);
    setFormatUrls({});
    setReelCredits(null);
    setSatisfaction(null);
    setResultScenes([]);
    setJobId(null);
    setStatus(null);
    setProgress(0);
    setMessage("");
    setError(null);
    setGeneratedPrompt("");
    setGeneratingScript(null);
    setLoading(false);
  };

  const handleCancel = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setLoading(false);
    setStatus("cancelled");
    setMessage("Generation cancelled.");
  };

  const enhancePrompt = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    setSuggestions([]);
    try {
      const res = await fetch(`${API_BASE_URL}/enhance-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error("enhance-prompt failed:", err);
    } finally {
      setEnhancing(false);
    }
  };

  const handleMusicUpload = async (file) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE_URL}/upload/music`, {
        method: "POST",
        headers: await getAuthHeaders(),
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setCustomMusicId(data.music_id);
        setCustomMusicName(file.name);
      }
    } catch (err) {
      console.error("Music upload failed:", err);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const mr = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setVoicePreviewUrl(url);
        const form = new FormData();
        const ext = mimeType.includes("webm") ? ".webm" : ".ogg";
        form.append("file", blob, `recording${ext}`);
        try {
          const res = await fetch(`${API_BASE_URL}/upload/voice-recording`, {
            method: "POST",
            headers: await getAuthHeaders(),
            body: form,
          });
          const data = await res.json();
          if (res.ok) {
            setCustomVoiceId(data.voice_id);
            setCustomVoiceName("Your recording");
          }
        } catch (err) {
          console.error("Voice upload failed:", err);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    clearInterval(recordingTimerRef.current);
    setRecording(false);
  };

  const handleRemix = (mod) => {
    setPrompt(mod);
    handleReset();
  };

  const loadHistoryItem = (item) => {
    setSelectedHistoryItem(item);
  };

  const removeFootage = (index) => {
    setFootageFiles((prev) => prev.filter((_, i) => i !== index));
    setFootageAssetIds([]);
  };

  const handleFootageUpload = (files) => {
    setFootageFiles(Array.from(files));
    setFootageAssetIds([]);
  };

  const isOutOfCredits =
    !profileLoading &&
    userProfile?.tier !== "pro" &&
    Number(userProfile?.credits ?? 0) === 0;
  const isGenerating = loading && !!jobId;
  const isDone = !!finalUrl;
  const credits =
    userProfile?.tier === "pro" ? null : userProfile?.credits ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      <Navbar userProfile={userProfile} />

      <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR ── */}
        <aside style={{
          width: '300px',
          flexShrink: 0,
          background: 'var(--bg-void)',
          borderRight: '1px solid rgba(26,16,8,0.10)',
          height: 'calc(100vh - 56px)',
          overflowY: 'auto',
          padding: '20px',
          boxSizing: 'border-box',
        }}>

          {/* BRIEF */}
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px' }}>Brief</div>
          <textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setSuggestions([]); }}
            placeholder="Describe the scene, mood, action..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#ffffff',
              border: '1.5px solid rgba(26,16,8,0.10)',
              borderRadius: '8px',
              color: 'var(--ink)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              padding: '12px',
              minHeight: '110px',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(201,64,48,0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(201,64,48,0.08)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(26,16,8,0.10)'; e.target.style.boxShadow = 'none'; }}
          />

          {/* ENHANCE PROMPT */}
          <button
            type="button"
            onClick={enhancePrompt}
            disabled={enhancing || !prompt.trim()}
            style={{
              width: '100%', marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid rgba(26,16,8,0.10)',
              background: 'transparent',
              color: enhancing ? 'var(--ink-muted)' : 'var(--ink-2)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              fontWeight: 500,
              cursor: enhancing || !prompt.trim() ? 'not-allowed' : 'pointer',
              opacity: !prompt.trim() ? 0.4 : 1,
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => { if (prompt.trim() && !enhancing) { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; e.currentTarget.style.color = 'var(--red)'; }}}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.10)'; e.currentTarget.style.color = enhancing ? 'var(--ink-muted)' : 'var(--ink-2)'; }}
          >
            <span style={{ fontSize: '14px' }}>✦</span>
            {enhancing ? 'Enhancing...' : 'Enhance prompt'}
          </button>

          {/* SUGGESTIONS */}
          {suggestions.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setPrompt(s); setSuggestions([]); }}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(26,16,8,0.10)',
                    background: '#ffffff',
                    color: 'var(--ink-2)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '11px',
                    lineHeight: 1.5,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.10)'; }}
                >{s}</button>
              ))}
            </div>
          )}

          {/* MOOD */}
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px', marginTop: '20px' }}>Mood</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {MOODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(m.value)}
                style={{
                  borderRadius: '8px',
                  border: mood === m.value ? '1.5px solid var(--border-pink)' : '1.5px solid rgba(26,16,8,0.10)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '7px 10px',
                  color: mood === m.value ? 'var(--red)' : 'var(--ink-2)',
                  background: mood === m.value ? 'var(--red-muted)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >{m.label}</button>
            ))}
          </div>

          {/* FORMAT */}
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px', marginTop: '20px' }}>Format</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[['portrait', '9:16 Portrait'], ['landscape', '16:9 Landscape']].map(([opt, label]) => (
              <button
                key={opt}
                type="button"
                onClick={() => setOrientation(opt)}
                style={{
                  flex: 1,
                  borderRadius: '8px',
                  border: orientation === opt ? '1.5px solid var(--red)' : '1.5px solid rgba(26,16,8,0.10)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '7px 10px',
                  color: orientation === opt ? '#fff' : 'var(--ink-2)',
                  background: orientation === opt ? 'var(--red)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>

          {/* SCENES */}
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px', marginTop: '20px' }}>Scenes</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[3, 4, 5, 6, 7, 8].map((n) => {
              const locked = n !== 3;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={locked ? undefined : () => setSceneCount(n)}
                  title={locked ? 'Unlock with Pro' : undefined}
                  style={{
                    flex: 1,
                    borderRadius: '8px',
                    border: !locked && sceneCount === n ? '1.5px solid var(--red)' : '1px solid rgba(26,16,8,0.10)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    fontWeight: 500,
                    padding: '7px 4px',
                    color: !locked && sceneCount === n ? '#fff' : 'var(--ink-faint)',
                    background: !locked && sceneCount === n ? 'var(--red)' : 'transparent',
                    cursor: locked ? 'not-allowed' : 'pointer',
                    opacity: locked ? 0.3 : 1,
                    transition: 'all 0.15s',
                  }}
                >{locked ? '🔒' : n}</button>
              );
            })}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-faint)', marginTop: '6px', letterSpacing: '0.05em' }}>
            3 scenes recommended for free tier
          </div>

          {/* TRANSITIONS */}
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px', marginTop: '20px' }}>Transitions</div>
          <select
            value={transitionStyle}
            onChange={(e) => setTransitionStyle(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#ffffff',
              border: '1.5px solid rgba(26,16,8,0.10)',
              borderRadius: '8px',
              color: 'var(--ink)',
              padding: '10px 12px',
              fontSize: '14px',
              outline: 'none',
            }}
          >
            <option value="auto">Auto (matches mood)</option>
            <option value="subtle">Subtle &amp; Smooth</option>
            <option value="dynamic">Dynamic &amp; Bold</option>
            <option value="cinematic">Cinematic Film</option>
            <option value="hype">Hype &amp; Fast</option>
          </select>

          {/* NARRATION TOGGLE */}
          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)' }}>Narration</div>
            <button
              type="button"
              onClick={() => setAiNarration((v) => !v)}
              style={{
                width: '40px', height: '22px',
                borderRadius: '11px',
                border: 'none',
                background: aiNarration ? 'var(--red)' : 'rgba(26,16,8,0.10)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute',
                top: '3px',
                left: aiNarration ? '21px' : '3px',
                width: '16px', height: '16px',
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>
          <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-faint)' }}>
            {aiNarration ? 'AI voice-over enabled' : 'Music only — no narration'}
          </div>

          {/* VOICE */}
          {aiNarration && (
            <>
              <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginTop: '20px', marginBottom: '8px' }}>Voice</div>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                {[['ai', 'AI Voice'], ['upload', 'Upload'], ['record', 'Record']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setVoiceMode(val)}
                    style={{
                      flex: 1,
                      borderRadius: '8px',
                      border: voiceMode === val ? '1.5px solid var(--red)' : '1.5px solid rgba(26,16,8,0.10)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '11px',
                      fontWeight: 500,
                      padding: '6px 4px',
                      color: voiceMode === val ? '#fff' : 'var(--ink-2)',
                      background: voiceMode === val ? 'var(--red)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >{label}</button>
                ))}
              </div>

              {voiceMode === 'upload' && (
                <div>
                  <label style={{
                    display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1.5px dashed rgba(26,16,8,0.10)',
                    color: customVoiceName ? 'var(--ink)' : 'var(--ink-muted)',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '12px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.10)'; }}
                  >
                    {customVoiceName || '↑ Upload MP3 / WAV'}
                    <input
                      type="file"
                      accept=".mp3,.wav,.m4a,.webm,.ogg"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const form = new FormData();
                        form.append('file', file);
                        try {
                          const res = await fetch(`${API_BASE_URL}/upload/voice-recording`, {
                            method: 'POST',
                            headers: await getAuthHeaders(),
                            body: form,
                          });
                          const data = await res.json();
                          if (res.ok) { setCustomVoiceId(data.voice_id); setCustomVoiceName(file.name); }
                        } catch (err) { console.error('Voice upload failed:', err); }
                      }}
                    />
                  </label>
                  {customVoiceName && (
                    <button
                      type="button"
                      onClick={() => { setCustomVoiceId(''); setCustomVoiceName(''); }}
                      style={{ marginTop: '4px', background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: '11px', cursor: 'pointer' }}
                    >✕ Remove</button>
                  )}
                </div>
              )}

              {voiceMode === 'record' && (
                <div>
                  {voicePreviewUrl && !recording && (
                    <audio controls src={voicePreviewUrl} style={{ width: '100%', height: '32px', marginBottom: '6px' }} />
                  )}
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${recording ? 'rgba(201,64,48,0.40)' : 'rgba(26,16,8,0.10)'}`,
                      background: recording ? 'var(--red-muted)' : 'transparent',
                      color: recording ? 'var(--red)' : 'var(--ink-2)',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {recording ? (
                      <>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)', animation: 'blink 1s step-end infinite', flexShrink: 0 }} />
                        Stop · {recordingTime}s
                      </>
                    ) : (
                      <>{customVoiceName ? '⟳ Re-record' : '⏺ Start recording'}</>
                    )}
                  </button>
                  {customVoiceName && !recording && (
                    <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-muted)' }}>✓ Recording ready</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* CLIPS */}
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginTop: '20px', marginBottom: '8px' }}>Clips</div>
          <label
            style={{
              display: 'block', width: '100%', boxSizing: 'border-box',
              padding: '14px 12px',
              borderRadius: '8px',
              border: '1.5px dashed rgba(26,16,8,0.10)',
              color: 'var(--ink-muted)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              cursor: 'pointer',
              textAlign: 'center',
              lineHeight: 1.5,
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.10)'; }}
          >
            <div>📁 Upload clips (optional)</div>
            <div style={{ fontSize: '11px', marginTop: '2px', color: 'var(--ink-faint)' }}>Drop .mp4 files here or click to browse</div>
            <input
              type="file"
              accept="video/mp4,video/mov,video/quicktime"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length + userClips.length > 3) {
                  setClipError('Max 3 clips allowed.');
                  return;
                }
                setClipError('');
                setUserClips((prev) => [...prev, ...files].slice(0, 3));
                e.target.value = '';
              }}
            />
          </label>
          {clipError && (
            <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--red)' }}>{clipError}</div>
          )}
          {userClips.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {userClips.map((clip, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 8px', borderRadius: '6px', background: '#ffffff', border: '1px solid rgba(26,16,8,0.10)' }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '190px' }}>{clip.name}</span>
                  <button
                    type="button"
                    onClick={() => { setUserClips((prev) => prev.filter((_, j) => j !== i)); setClipError(''); }}
                    style={{ background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: '12px', cursor: 'pointer', flexShrink: 0, paddingLeft: '6px' }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-faint)' }}>
            {userClips.length > 0 ? `${userClips.length}/3 clip${userClips.length !== 1 ? 's' : ''} — cycles across scenes` : 'Using AI stock footage if empty'}
          </div>

          {/* MUSIC */}
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginTop: '20px', marginBottom: '8px' }}>Music</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {[['ai', 'AI Pick'], ['upload', 'Upload']].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setMusicMode(val)}
                style={{
                  flex: 1,
                  borderRadius: '8px',
                  border: musicMode === val ? '1.5px solid var(--red)' : '1.5px solid rgba(26,16,8,0.10)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '7px 10px',
                  color: musicMode === val ? '#fff' : 'var(--ink-2)',
                  background: musicMode === val ? 'var(--red)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >{label}</button>
            ))}
          </div>
          {musicMode === 'upload' && (
            <div>
              <label style={{
                display: 'block', width: '100%', boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1.5px dashed rgba(26,16,8,0.10)',
                color: customMusicName ? 'var(--ink)' : 'var(--ink-muted)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '12px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'border-color 0.15s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.10)'; }}
              >
                {customMusicName || '↑ Upload MP3 / WAV'}
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.aac"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMusicUpload(f); }}
                />
              </label>
              {customMusicName && (
                <button
                  type="button"
                  onClick={() => { setCustomMusicId(''); setCustomMusicName(''); }}
                  style={{ marginTop: '4px', background: 'none', border: 'none', color: 'var(--ink-muted)', fontSize: '11px', cursor: 'pointer' }}
                >✕ Remove</button>
              )}
            </div>
          )}

          {/* BRAND KIT */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px', marginBottom: '8px' }}>
            <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)' }}>Brand Kit</div>
            <a href="/brand-kit" style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--red)', letterSpacing: '0.08em' }}>Edit →</a>
          </div>

          {brandKit?.logo_url ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#ffffff', borderRadius: '8px', border: '1px solid rgba(26,16,8,0.10)', marginBottom: '8px' }}>
              <img
                src={brandKit.logo_url}
                alt="Logo"
                style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', color: 'var(--ink)' }}>Logo ready</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-muted)', marginTop: '1px' }}>watermarks your reels</div>
              </div>
              <button
                type="button"
                onClick={() => setApplyBrandKit(v => !v)}
                aria-label="Toggle brand kit"
                style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: applyBrandKit ? 'var(--red)' : 'rgba(26,16,8,0.10)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <span style={{ position: 'absolute', top: '2px', left: applyBrandKit ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
          ) : (
            <a href="/brand-kit" style={{ display: 'block', padding: '8px 10px', textAlign: 'center', borderRadius: '8px', border: '1.5px dashed rgba(26,16,8,0.10)', color: 'var(--ink-muted)', fontFamily: 'Inter, sans-serif', fontSize: '11px', marginBottom: '8px', textDecoration: 'none', transition: 'border-color 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; e.currentTarget.style.color = 'var(--red)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.10)'; e.currentTarget.style.color = 'var(--ink-muted)'; }}
            >+ Upload logo</a>
          )}

          {/* Logo placement controls — only shown when brand kit is active */}
          {applyBrandKit && brandKit?.logo_url && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '10px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid rgba(26,16,8,0.10)' }}>

              {/* Position grid */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--ink-faint)', letterSpacing: '0.12em', marginBottom: '5px' }}>POSITION</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px' }}>
                  {[
                    ['top-left', '↖'], ['top-center', '↑'], ['top-right', '↗'],
                    ['center-left', '←'], ['center', '·'], ['center-right', '→'],
                    ['bottom-left', '↙'], ['bottom-center', '↓'], ['bottom-right', '↘'],
                  ].map(([val, arrow]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLogoPosition(val)}
                      style={{
                        height: '24px',
                        borderRadius: '5px',
                        border: logoPosition === val ? '1.5px solid var(--red)' : '1px solid rgba(26,16,8,0.10)',
                        background: logoPosition === val ? 'var(--red-muted)' : 'transparent',
                        color: logoPosition === val ? 'var(--red)' : 'var(--ink-muted)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >{arrow}</button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--ink-faint)', letterSpacing: '0.12em', marginBottom: '5px' }}>SIZE</div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[['S', 'Small'], ['M', 'Medium'], ['L', 'Large']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLogoSize(val)}
                      style={{
                        flex: 1, padding: '4px',
                        borderRadius: '5px',
                        border: logoSize === val ? '1.5px solid var(--red)' : '1px solid rgba(26,16,8,0.10)',
                        background: logoSize === val ? 'var(--red-muted)' : 'transparent',
                        color: logoSize === val ? 'var(--red)' : 'var(--ink-muted)',
                        fontFamily: 'Inter, sans-serif', fontSize: '11px', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.12s',
                        title: label,
                      }}
                    >{val}</button>
                  ))}
                </div>
              </div>

              {/* Timing */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--ink-faint)', letterSpacing: '0.12em', marginBottom: '5px' }}>TIMING</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {[
                    ['full',       'Full video',  'fade in · always on · fade out'],
                    ['start-only', 'Start only',  'appears first 4s then fades'],
                    ['end-only',   'End card',    'video fades · logo centered'],
                  ].map(([val, label, hint]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setLogoTiming(val)}
                      style={{
                        padding: '5px 8px', textAlign: 'left',
                        borderRadius: '5px',
                        border: logoTiming === val ? '1.5px solid var(--red)' : '1px solid rgba(26,16,8,0.10)',
                        background: logoTiming === val ? 'var(--red-muted)' : 'transparent',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: logoTiming === val ? 'var(--red)' : 'var(--ink-2)', fontFamily: 'Inter, sans-serif' }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--ink-faint)', marginTop: '1px' }}>{hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Credits / out-of-credits notice */}
          {isOutOfCredits && (
            <div style={{ marginTop: '16px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-pink)', background: 'var(--red-muted)', fontSize: '12px', color: 'var(--ink-2)' }}>
              No credits remaining.{' '}
              <a href="/pricing" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Upgrade →</a>
            </div>
          )}
          {credits !== null && !isOutOfCredits && (
            <div style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-muted)' }}>
              {credits} / 30 remaining
            </div>
          )}

          {/* GENERATE */}
          <button
            type="button"
            onClick={generateReel}
            disabled={loading || isOutOfCredits}
            style={{
              width: '100%',
              height: '48px',
              marginTop: '20px',
              background: 'var(--red)',
              border: 'none',
              borderRadius: '10px',
              fontFamily: 'Caveat, cursive',
              fontSize: '22px',
              color: '#fff',
              cursor: loading || isOutOfCredits ? 'not-allowed' : 'pointer',
              boxShadow: loading || isOutOfCredits ? 'none' : '0 0 20px rgba(201,64,48,0.35), 0 0 40px rgba(201,64,48,0.15)',
              animation: loading || isOutOfCredits ? 'none' : 'glow-pulse 3s ease-in-out infinite',
              opacity: loading || isOutOfCredits ? 0.35 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'generating...' : 'generate film →'}
          </button>

          {/* System status */}
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-muted)' }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block', flexShrink: 0,
              background: loading ? 'var(--red)' : '#22dd88',
              animation: loading ? 'blink 1s step-end infinite' : 'none',
            }} />
            {loading ? 'PROCESSING...' : 'READY'}
          </div>

          {error && (
            <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-pink)', background: 'var(--red-muted)', fontSize: '12px', color: 'var(--red)' }}>
              {error}
            </div>
          )}
        </aside>

        {/* ── CENTER PANEL ── */}
        <main style={{
          flex: 1,
          background: 'var(--bg-base)',
          height: 'calc(100vh - 56px)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>

          {/* STATE 1 — Empty viewfinder */}
          {!isGenerating && !isDone && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '280px', height: '400px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '20px', height: '20px', borderTop: '2px solid rgba(201,64,48,0.2)', borderLeft: '2px solid rgba(201,64,48,0.2)' }} />
                <div style={{ position: 'absolute', top: 0, right: 0, width: '20px', height: '20px', borderTop: '2px solid rgba(201,64,48,0.2)', borderRight: '2px solid rgba(201,64,48,0.2)' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '20px', height: '20px', borderBottom: '2px solid rgba(201,64,48,0.2)', borderLeft: '2px solid rgba(201,64,48,0.2)' }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderBottom: '2px solid rgba(201,64,48,0.2)', borderRight: '2px solid rgba(201,64,48,0.2)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ink-muted)', letterSpacing: '0.1em' }}>// AWAITING BRIEF</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink-faint)' }}>Enter a prompt and hit generate</div>
                  <span style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', animation: 'blink 1s step-end infinite' }}>▌</span>
                </div>
              </div>
            </div>
          )}

          {/* STATE 2 — Generating */}
          {isGenerating && (
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
              <GeneratingScreen
                progress={progress}
                message={message}
                jobId={jobId}
                scenes={generatingScript?.scenes ?? null}
                onCancel={handleCancel}
                isComplete={generatingComplete}
              />
            </div>
          )}

          {/* STATE 3 — Complete */}
          {isDone && (
            <div style={{ overflowY: 'auto', height: '100%', width: '100%' }}>
              <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px' }}>

                {/* Metadata row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    OUTPUT // {orientation.toUpperCase()}
                  </span>
                  {evalBreakdown && (
                    <span style={{ background: 'rgba(168,255,62,0.1)', border: '1px solid rgba(168,255,62,0.3)', color: '#a8ff3e', fontFamily: 'var(--font-mono)', fontSize: '10px', borderRadius: '4px', padding: '3px 8px' }}>
                      EVAL {(Object.values(evalBreakdown).reduce((a, b) => a + b, 0) / Object.values(evalBreakdown).length / 10).toFixed(2)} ✓
                    </span>
                  )}
                </div>

                {/* Video */}
                <video
                  controls
                  src={finalUrl}
                  style={{
                    width: '100%',
                    maxHeight: '420px',
                    objectFit: 'contain',
                    background: '#000',
                    borderRadius: '12px',
                    border: '1px solid rgba(26,16,8,0.18)',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                    display: 'block',
                  }}
                />

                {/* Download dialog */}
                {showDownloadDialog && (
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setShowDownloadDialog(false); }}
                  >
                    <div style={{ background: 'var(--bg-void)', border: '1px solid rgba(26,16,8,0.18)', borderRadius: '16px', padding: '28px', width: '340px', maxWidth: '90vw', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--ink-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '18px' }}>Save Reel</div>

                      {/* Title */}
                      <label style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: '12px', color: 'var(--ink-2)', marginBottom: '6px' }}>Video title</label>
                      <input
                        type="text"
                        value={downloadTitle}
                        onChange={(e) => setDownloadTitle(e.target.value)}
                        placeholder="my-reel"
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid rgba(26,16,8,0.10)', background: '#ffffff', color: 'var(--ink)', fontFamily: 'Inter, sans-serif', fontSize: '13px', outline: 'none', marginBottom: '16px' }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--red)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.10)'; }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      />

                      {/* Choose location button (File System Access API) */}
                      {typeof window !== 'undefined' && 'showSaveFilePicker' in window && (
                        <button
                          type="button"
                          onClick={async () => {
                            const filename = (downloadTitle.trim() || 'reel') + '.mp4';
                            try {
                              const fileHandle = await window.showSaveFilePicker({
                                suggestedName: filename,
                                types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
                              });
                              const writable = await fileHandle.createWritable();
                              const res = await fetch(finalUrl);
                              const buf = await res.arrayBuffer();
                              await writable.write(buf);
                              await writable.close();
                              setShowDownloadDialog(false);
                            } catch (err) {
                              if (err.name !== 'AbortError') console.error(err);
                            }
                          }}
                          style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1.5px solid var(--border-pink)', background: 'var(--red-muted)', color: 'var(--red)', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(201,64,48,0.18)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--red-muted)'; }}
                        >↓ Choose location &amp; save</button>
                      )}

                      {/* Default download */}
                      <a
                        href={finalUrl}
                        download={(downloadTitle.trim() || 'reel') + '.mp4'}
                        onClick={() => setShowDownloadDialog(false)}
                        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '10px', border: '1.5px solid rgba(26,16,8,0.18)', background: '#ffffff', color: 'var(--ink)', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, textAlign: 'center', textDecoration: 'none', marginBottom: '8px', transition: 'border-color 0.15s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.18)'; }}
                      >↓ Download to default folder</a>

                      <button
                        type="button"
                        onClick={() => setShowDownloadDialog(false)}
                        style={{ width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'var(--ink-muted)', fontFamily: 'Inter, sans-serif', fontSize: '12px', cursor: 'pointer' }}
                      >Cancel</button>
                    </div>
                  </div>
                )}

                {/* Action row */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDownloadTitle(generatingScript?.title || '');
                      setShowDownloadDialog(true);
                    }}
                    style={{ flex: 1, textAlign: 'center', padding: '10px', borderRadius: '8px', background: '#ffffff', border: '1.5px solid rgba(26,16,8,0.18)', color: 'var(--ink)', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; e.currentTarget.style.color = 'var(--red)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.18)'; e.currentTarget.style.color = 'var(--ink)'; }}
                  >↓ Download</button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(finalUrl)}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#ffffff', border: '1.5px solid rgba(26,16,8,0.18)', color: 'var(--ink)', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; e.currentTarget.style.color = 'var(--red)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.18)'; e.currentTarget.style.color = 'var(--ink)'; }}
                  >↗ Share</button>
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', background: '#ffffff', border: '1.5px solid rgba(26,16,8,0.18)', color: 'var(--ink)', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; e.currentTarget.style.color = 'var(--red)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(26,16,8,0.18)'; e.currentTarget.style.color = 'var(--ink)'; }}
                  >⟳ Remix</button>
                </div>

                {/* Satisfaction card */}
                <div style={{ background: 'var(--bg-void)', border: '1px solid rgba(26,16,8,0.10)', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: '14px' }}>
                    How did it turn out?
                  </div>

                  {!satisfaction && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setSatisfaction('love')}
                        style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(168,255,62,0.1)', border: '1.5px solid rgba(168,255,62,0.3)', color: '#a8ff3e', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
                      >👍 Love it</button>
                      <button
                        type="button"
                        onClick={() => setSatisfaction('fix')}
                        style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(201,64,48,0.08)', border: '1.5px solid rgba(201,64,48,0.25)', color: 'var(--red)', fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
                      >🔧 Needs work</button>
                    </div>
                  )}

                  {satisfaction === 'love' && (
                    <div>
                      <p style={{ fontSize: '13px', color: 'var(--ink-2)', margin: '0 0 12px' }}>Try a variation:</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {['longer version', 'night time', 'slow-motion'].map((variant, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleRemix(`${generatedPrompt} — ${variant}`)}
                            style={{ padding: '6px 14px', borderRadius: '6px', background: 'var(--red-muted)', border: '1.5px solid var(--border-pink)', color: 'var(--red)', fontFamily: 'Inter, sans-serif', fontSize: '12px', cursor: 'pointer' }}
                          >{variant}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {satisfaction === 'fix' && (
                    <QuickFixPanel
                      jobId={jobId}
                      scenes={resultScenes}
                      prompt={generatedPrompt}
                      mood={mood}
                      orientation={orientation}
                      getToken={getToken}
                      onFixApplied={handleFixApplied}
                    />
                  )}
                </div>

                {/* Cloud/local copy links */}
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px' }}>
                  {cloudVideoUrl && <a href={cloudVideoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--red)' }}>Cloud copy</a>}
                  {localFinalUrl && <a href={localFinalUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--ink-muted)' }}>Local copy</a>}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── RIGHT PANEL ── */}
        <aside style={{
          width: '280px',
          flexShrink: 0,
          background: 'var(--bg-void)',
          borderLeft: '1px solid rgba(26,16,8,0.10)',
          height: 'calc(100vh - 56px)',
          overflowY: 'auto',
          padding: '16px',
          boxSizing: 'border-box',
        }}>
          <div style={{ fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600, color: 'var(--red)', marginBottom: '12px' }}>
            Recent Reels
          </div>

          {historyLoading && <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>Loading...</div>}
          {historyError && <div style={{ fontSize: '12px', color: 'var(--red)' }}>{historyError}</div>}
          {!historyLoading && history.length === 0 && !historyError && (
            <div style={{ fontSize: '12px', color: 'var(--ink-muted)' }}>No reels yet.</div>
          )}

          {history.map((item) => {
            const isCloudinary = item.video_url && item.video_url.includes('res.cloudinary.com');
            const thumbnail = isCloudinary
              ? item.video_url.replace('/upload/', '/upload/so_0,w_300/').replace('.mp4', '.jpg')
              : null;
            const score = item.eval_score ?? null;
            const scoreDot = score != null
              ? (score >= 0.85 ? '#22dd88' : score >= 0.70 ? '#f0b429' : 'var(--red)')
              : null;

            return (
              <div
                key={item.job_id}
                onClick={() => loadHistoryItem(item)}
                style={{
                  border: selectedHistoryItem?.job_id === item.job_id ? '1px solid var(--border-pink)' : '1px solid rgba(26,16,8,0.10)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: '10px',
                  background: '#ffffff',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,64,48,0.40)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = selectedHistoryItem?.job_id === item.job_id ? 'rgba(201,64,48,0.40)' : 'rgba(26,16,8,0.10)'; }}
              >
                {item.video_url && (
                  <video
                    src={item.video_url}
                    muted
                    preload="none"
                    controls
                    {...(thumbnail ? { poster: thumbnail } : {})}
                    style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', display: 'block' }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--ink-2)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '5px' }}>
                    {(item.prompt || 'Untitled').slice(0, 60)}{(item.prompt?.length ?? 0) > 60 ? '...' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--ink-muted)' }}>
                    {score != null && (
                      <>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: scoreDot, flexShrink: 0 }} />
                        <span>{score.toFixed(2)}</span>
                        <span style={{ color: 'var(--ink-faint)' }}>·</span>
                      </>
                    )}
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </aside>
      </div>

      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <StudioPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pricing"
          element={
            <ProtectedRoute>
              <PricingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/brand-kit"
          element={
            <ProtectedRoute>
              <BrandKitPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/evals"
          element={
            <ProtectedRoute>
              <EvalDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/login/*" element={<LoginPage />} />
        <Route path="/signup/*" element={<SignupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return <AnimatedRoutes />;
}

export default App;
