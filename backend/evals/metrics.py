from dataclasses import dataclass, field


@dataclass
class ScriptQualityMetrics:
    coherence_score: float
    scene_count_valid: bool
    duration_valid: bool
    mood_valid: bool
    narration_present: bool
    score: float


@dataclass
class VisualRelevanceMetrics:
    scenes_with_footage: int
    scenes_with_placeholder: int
    footage_rate: float
    score: float


@dataclass
class AudioSyncMetrics:
    voice_generated: bool
    music_selected: bool
    voice_duration_s: float
    video_duration_s: float
    sync_delta_s: float
    sync_acceptable: bool
    score: float


@dataclass
class PipelineHealthMetrics:
    ffmpeg_success: bool
    cloudinary_uploaded: bool
    subtitles_generated: bool
    total_duration_s: float
    agent_rewrite_cycles: int
    llm_total_tokens: int
    llm_total_latency_ms: int


@dataclass
class ReelEvalResult:
    job_id: str
    prompt: str
    script_metrics: ScriptQualityMetrics
    visual_metrics: VisualRelevanceMetrics
    audio_metrics: AudioSyncMetrics
    pipeline_metrics: PipelineHealthMetrics
    overall_score: float
    passed: bool
    failure_reasons: list
    timestamp: str
