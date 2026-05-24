import logging
from datetime import datetime
from evals.metrics import (
    AudioSyncMetrics,
    PipelineHealthMetrics,
    ReelEvalResult,
    ScriptQualityMetrics,
    VisualRelevanceMetrics,
)

VALID_MOODS = {
    "calm", "cinematic", "dark", "emotional", "happy",
    "epic", "tense", "mysterious", "uplifting", "nostalgic",
    "serene", "dramatic", "thriller", "romantic", "hopeful",
    "melancholic", "suspenseful", "euphoric", "intense",
}


class ReelEvaluator:

    async def evaluate(
        self,
        job_id: str,
        prompt: str,
        script: dict,
        scene_results: list,
        voice_duration: float,
        video_duration: float,
        voice_success: bool,
        music_success: bool,
        ffmpeg_success: bool,
        cloudinary_success: bool,
        subtitles_success: bool,
        agent_trace: dict,
    ) -> ReelEvalResult:

        # 1. Script quality
        scenes = script.get("scenes", [])
        critic_output = agent_trace.get("critic_agent", {}).get("output", {})
        if isinstance(critic_output, dict) and critic_output.get("error"):
            critic_output = {}

        duration_valid = all(
            2 <= int(s.get("duration", 0) or 0) <= 8 for s in scenes
        ) if scenes else False

        narration_present = all(
            bool(s.get("narration", "").strip()) for s in scenes
        ) if scenes else False

        script_metrics = ScriptQualityMetrics(
            coherence_score=float(critic_output.get("coherence_score", 0.5)),
            scene_count_valid=len(scenes) > 0,
            duration_valid=duration_valid,
            mood_valid=script.get("mood") in VALID_MOODS,
            narration_present=narration_present,
            score=0.0,
        )
        script_metrics.score = round(
            script_metrics.coherence_score * 0.4
            + float(script_metrics.scene_count_valid) * 0.2
            + float(script_metrics.duration_valid) * 0.2
            + float(script_metrics.narration_present) * 0.2,
            3,
        )

        # 2. Visual relevance
        with_footage = sum(1 for s in scene_results if s.get("has_footage"))
        total = max(len(scene_results), 1)
        visual_metrics = VisualRelevanceMetrics(
            scenes_with_footage=with_footage,
            scenes_with_placeholder=total - with_footage,
            footage_rate=round(with_footage / total, 3),
            score=round(with_footage / total, 3),
        )

        # 3. Audio sync
        sync_delta = abs(voice_duration - video_duration)
        audio_score = max(0.0, 1.0 - sync_delta / 10.0) if voice_success else 0.0
        audio_metrics = AudioSyncMetrics(
            voice_generated=voice_success,
            music_selected=music_success,
            voice_duration_s=round(voice_duration, 2),
            video_duration_s=round(video_duration, 2),
            sync_delta_s=round(sync_delta, 2),
            sync_acceptable=sync_delta < 2.0,
            score=round(audio_score, 3),
        )

        # 4. Pipeline health
        trace_script = agent_trace.get("script_agent", {})
        trace_critic = agent_trace.get("critic_agent", {})
        trace_visual = agent_trace.get("visual_agent", {})

        total_tokens = (
            (trace_script.get("tokens_used") or 0)
            + (trace_critic.get("tokens_used") or 0)
            + (trace_visual.get("tokens_used") or 0)
        )
        total_latency = (
            (trace_script.get("latency_ms") or 0)
            + (trace_critic.get("latency_ms") or 0)
            + (trace_visual.get("latency_ms") or 0)
        )
        pipeline_metrics = PipelineHealthMetrics(
            ffmpeg_success=ffmpeg_success,
            cloudinary_uploaded=cloudinary_success,
            subtitles_generated=subtitles_success,
            total_duration_s=round(video_duration, 2),
            agent_rewrite_cycles=agent_trace.get("rewrite_cycles", 0),
            llm_total_tokens=total_tokens,
            llm_total_latency_ms=total_latency,
        )

        # 5. Overall score
        overall = round(
            script_metrics.score * 0.3
            + visual_metrics.score * 0.4
            + audio_metrics.score * 0.3,
            3,
        )

        # 6. Failure reasons
        failures = []
        if visual_metrics.footage_rate < 0.5:
            failures.append(
                f"Only {with_footage}/{total} scenes have real footage — Pexels queries may be too specific"
            )
        if not audio_metrics.sync_acceptable:
            failures.append(
                f"Voice/video sync off by {sync_delta:.1f}s — narration length mismatch"
            )
        if script_metrics.coherence_score < 0.6:
            failures.append(
                "Script coherence below threshold — consider more specific prompt"
            )
        if not ffmpeg_success:
            failures.append("FFmpeg render failed — check codec and file permissions")
        if pipeline_metrics.agent_rewrite_cycles >= 2:
            failures.append(
                "Script required maximum rewrites — LLM struggled with this prompt"
            )

        result = ReelEvalResult(
            job_id=job_id,
            prompt=prompt,
            script_metrics=script_metrics,
            visual_metrics=visual_metrics,
            audio_metrics=audio_metrics,
            pipeline_metrics=pipeline_metrics,
            overall_score=overall,
            passed=overall >= 0.65,
            failure_reasons=failures,
            timestamp=datetime.utcnow().isoformat(),
        )

        status = "PASSED" if result.passed else "FAILED"
        logging.info(
            f"[Eval] Job {job_id} {status} — score: {overall:.2f} | "
            f"visual: {visual_metrics.score:.2f} | "
            f"audio: {audio_metrics.score:.2f} | "
            f"script: {script_metrics.score:.2f}"
        )
        for f in failures:
            logging.info(f"[Eval] Failure: {f}")

        return result
