# Known Failure Modes and Recovery Paths

## LLM Failures

### 1. JSON Parse Failure
- **Cause:** LLM returns markdown-wrapped JSON or plain text instead of raw JSON
- **Detection:** `json.JSONDecodeError` in `_call_llm()` (`backend/agents/base_agent.py`)
- **Recovery:** Retry with "You MUST respond ONLY with valid JSON" appended to the user message
- **Fallback:** Rule-based script generator in `generate_script_legacy()` (`backend/services/ai_service.py`)
- **Frequency:** ~8% of requests on llama-3.1-8b-instant

### 2. Hallucination / Refusal
- **Cause:** LLM refuses to generate content or hallucinates constraints ("as an AI…")
- **Detection:** Response contains phrases from `HALLUCINATION_INDICATORS` in `base_agent.py`; logged and flagged in `AgentResult.metadata`
- **Recovery:** Rephrase prompt, remove ambiguous terms, retry; flag stored in `metadata["hallucination_detected"]`
- **Fallback:** Use simpler scene descriptions from fallback script generator
- **Frequency:** ~2% of requests

### 3. Context Limit
- **Cause:** Long prompts + full schema exceed the model's context window
- **Detection:** HTTP 413 from Groq or truncated/empty JSON response
- **Recovery:** Reduce `scene_count`, summarize prompt before sending
- **Fallback:** Split into smaller scene batches; `generate_script_legacy()` generates only 3 scenes
- **Frequency:** Rare (<1%) — llama-3.1-8b-instant has an 8K context window

### 4. Script Quality Below Threshold
- **Cause:** `CriticAgent` scores coherence < 0.6 or marks `approved: false`
- **Detection:** `critic_result.output["approved"] == False` in `DirectorAgent.run()`
- **Recovery:** `DirectorAgent` triggers up to 2 rewrite cycles, appending `rewrite_instructions` to the prompt
- **Fallback:** Accept best available script after 2 cycles; outcome logged as `rewrite_cycles` in eval dashboard
- **Measured outcome:** Rewrite cycle count visible at `/evals/{job_id}` and eval dashboard

### 5. ScriptAgent Consistent Failures
- **Cause:** Groq quota exhausted, network issues, or prompt that consistently trips the model
- **Detection:** `_consecutive_failures >= 3` in `ScriptAgent` class variable (`backend/agents/script_agent.py`)
- **Recovery:** Warning logged: `[Agent:ScriptAgent] Failing consistently — check Groq quota or prompt length`
- **Fallback:** `DirectorAgent` falls back to `_fallback_script()` inline rule-based generator

---

## Infrastructure Failures

### 6. Pexels API Returns No Results
- **Cause:** Query too specific, API rate limit, or network timeout
- **Detection:** Empty `videos` list from Pexels search in `get_video()` (`backend/services/video_service.py`)
- **Recovery:** `VisualAgent` provides `fallback_query` (simpler terms); `get_video()` retries without orientation filter
- **Fallback:** `create_placeholder_video()` generates an FFmpeg black clip of correct duration
- **Frequency:** ~15% of individual scenes; tracked as `scenes_with_placeholder` in eval metrics

### 7. FFmpeg Codec Mismatch
- **Cause:** Input clips with varying codecs fail concat filter
- **Detection:** FFmpeg stderr contains codec error; `run_ffmpeg()` raises exception
- **Recovery:** All clips are re-encoded to h264/aac with explicit normalization before concat (`is_normalized_clip()` check)
- **Fallback:** Skip problematic clip; xfade concat skips to next adjacent clip
- **Fixed by:** Explicit normalization step before concat in `create_video()`

### 8. Edge TTS Timeout
- **Cause:** Microsoft TTS service latency spikes or network interruption
- **Detection:** Exception in `generate_scene_voices()` (`backend/services/audio_service.py`)
- **Recovery:** Each scene voice generated independently; one failure doesn't block others
- **Fallback:** `merge_voices()` skips missing files with a warning; if all voices fail, pipeline marks job failed

### 9. Cloudinary Upload Failure
- **Cause:** Network issue, file too large, or quota exceeded
- **Detection:** Exception in `upload_video_in_background()` (`backend/main.py`)
- **Recovery:** Catch block keeps the local file and updates job with `local_video_url`
- **Fallback:** Video served from local `/api/film/files/{job_id}/final_reel.mp4` endpoint
- **User impact:** Video still playable; cloud URL unavailable until manual re-upload

---

## Eval Patterns Observed

(Updated automatically by eval dashboard — see `/evals/patterns`)

Common patterns tracked:
- `Only N/M scenes have real footage` — Pexels queries too specific
- `Voice/video sync off by Xs` — narration length mismatch
- `Script coherence below threshold` — LLM struggled with prompt
- `FFmpeg render failed` — codec or permissions issue
- `Script required maximum rewrites` — LLM repeated failures on prompt
