import asyncio

from fastapi import FastAPI, BackgroundTasks, Request, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
import os, sys, logging, glob, uuid, time, threading, tempfile, subprocess, shutil
from dotenv import load_dotenv

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import jwt
import cloudinary
import cloudinary.uploader

try:
    import sentry_sdk
except Exception:
    sentry_sdk = None

BASE_DIR = Path(__file__).resolve().parent
FILES_DIR = BASE_DIR / "files"
ENV_PATH = BASE_DIR / ".env"
FOOTAGE_TMP_DIR = Path(tempfile.gettempdir()) / "footage"

ALLOWED_FOOTAGE_TYPES = {
    "video/mp4", "video/quicktime", "video/avi",
    "video/webm", "video/mov", "video/x-msvideo",
}
MAX_FOOTAGE_SIZE = 100 * 1024 * 1024  # 100 MB

if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

load_dotenv(dotenv_path=ENV_PATH)

sentry_dsn = os.getenv("SENTRY_DSN")
if sentry_dsn and sentry_sdk is not None:
    sentry_sdk.init(dsn=sentry_dsn, traces_sample_rate=0.1)

from services.ai_service import generate_script, generate_content_ideas, enhance_prompt
from evals.evaluator import ReelEvaluator
from evals.eval_store import eval_store
from services.video_service import (
    create_video,
    download_all_scenes,
    prepare_user_footage,
)
from services.audio_service import (
    generate_scene_voices,
    merge_voices,
    get_music,
    get_sfx,
    get_audio_duration_seconds,
)
from middleware.auth import get_current_user
from database.db import init_db, close_db
from database.crud import (
    create_generation,
    decrement_credits,
    get_brand_kit,
    get_or_create_user,
    get_user_credits,
    get_user_generations,
    save_brand_kit,
    update_generation,
)
from database.job_store import (
    cleanup_expired_jobs,
    close_job_store,
    get_job,
    init_job_store,
    set_job,
    update_job as persist_job_updates,
    using_memory_fallback,
)
from routers.billing import router as billing_router
from utils.file_utils import download_file

# Create files directory if it doesn't exist
FILES_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)

CELERY_ENABLED = os.getenv("CELERY_ENABLED", "false").lower() == "true"
_pipeline_semaphore = asyncio.Semaphore(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    init_job_store()
    try:
        yield
    finally:
        await close_db()
        close_job_store()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://raun-ai.vercel.app",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(billing_router)

app.mount("/files", StaticFiles(directory=str(FILES_DIR)), name="files")


class PromptRequest(BaseModel):
    prompt: str
    orientation: str = "portrait"       # "portrait" (9:16) or "landscape" (16:9)
    footage_ids: list[str] = []         # optional user-uploaded clip asset IDs
    export_formats: list[str] = []      # empty = use orientation; populated = render each format
    apply_brand_kit: bool = True        # overlay logo + append outro from user's brand kit
    transition_style: str = "auto"      # "auto"|"subtle"|"dynamic"|"cinematic"|"hype"|<name>
    music_id: str = ""                  # asset ID of user-uploaded custom music track
    voice_id: str = ""                  # asset ID of user-uploaded/recorded voice
    scene_count: int = 3                # number of scenes to generate (3-8)
    include_narration: bool = True      # False = music-only, no AI voice
    logo_position: str = "top-right"   # 9-zone grid: top-left/center/right, center-*, bottom-*
    logo_size: str = "S"               # S=6% M=10% L=15% of video width
    logo_timing: str = "full"          # full | start-only | end-only
    logo_url: str = ""                  # pass Cloudinary URL directly to avoid background-thread DB issue
    outro_url: str = ""                 # pass Cloudinary outro URL directly
    music_seed: int = 0                 # 0 = mood-based pick; nonzero = seeded variety (used for "change music")


class PromptEnhanceRequest(BaseModel):
    prompt: str


class IdeasRequest(BaseModel):
    niche: str = "general"
    platform: str = "instagram"
    count: int = 5


def run_async_db_task(coro, operation_name, default=None):
    """
    Run async database helpers from sync request/pipeline code without
    letting DB failures break video generation.
    """
    import asyncio

    try:
        return asyncio.run(coro)
    except Exception as exc:
        logging.exception(f"[Database] {operation_name} failed: {exc}")
        return default


async def run_async_db_task_async(coro, operation_name, default=None):
    try:
        return await coro
    except Exception as exc:
        logging.exception(f"[Database] {operation_name} failed: {exc}")
        return default


def file_in_backend(name):
    return str(FILES_DIR / name)


def public_file_url(path):
    return f"/files/{Path(path).name}"


def absolute_video_url(request: Request, video_url: str):
    if not video_url:
        return video_url
    if video_url.startswith("http://") or video_url.startswith("https://"):
        return video_url
    return str(request.base_url).rstrip("/") + video_url


def update_job(job_id, progress=None, status=None, message=None):
    existing_job = get_job(job_id)
    if not existing_job:
        return
    updates = {}
    if progress is not None:
        updates["progress"] = max(0, min(100, int(progress)))
    if status is not None:
        updates["status"] = status
    if message is not None:
        updates["message"] = message
    if updates:
        persist_job_updates(job_id, updates)


def map_stage_progress(start_pct, end_pct, raw_pct):
    clamped_raw = max(0, min(100, int(raw_pct or 0)))
    span = end_pct - start_pct
    return start_pct + int((clamped_raw / 100) * span)


def cleanup_temporary_files(job_id):
    logging.info(f"[Main] Cleaning up temporary files for job {job_id}")
    files_to_delete = (
        glob.glob(str(FILES_DIR / "clip_*.mp4"))
        + glob.glob(str(FILES_DIR / "placeholder_*.mp4"))
        + [
            file_in_backend("concat_sources.txt"),
            file_in_backend("temp.mp4"),
            file_in_backend("audio.mp3"),
            file_in_backend("voice_full.mp3"),
        ]
        + glob.glob(str(FILES_DIR / "voice_*.mp3"))
    )

    for file_path in files_to_delete:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


def upload_video_in_background(job_id, final_path, script):
    try:
        logging.info(f"[{job_id}] Uploading to Cloudinary...")
        if not all(
            [
                os.getenv("CLOUDINARY_CLOUD_NAME"),
                os.getenv("CLOUDINARY_API_KEY"),
                os.getenv("CLOUDINARY_API_SECRET"),
            ]
        ):
            raise RuntimeError("Cloudinary credentials are not configured")

        upload_result = cloudinary.uploader.upload(final_path, resource_type="video")
        video_url = upload_result["secure_url"]
        current_job = get_job(job_id) or {}
        current_result = current_job.get("result", {})
        local_video_url = current_result.get(
            "local_video_url", public_file_url(final_path)
        )

        run_async_db_task(
            update_generation(
                job_id,
                video_url=video_url,
                status="completed",
                title=script.get("title"),
                mood=script.get("mood"),
                duration=script.get("duration"),
            ),
            f"update_generation({job_id})",
        )

        if current_job:
            persist_job_updates(
                job_id,
                {
                    "status": "completed",
                    "result": {
                        "video_url": video_url,
                        "local_video_url": local_video_url,
                        "local_file_path": current_result.get(
                            "local_file_path", final_path
                        ),
                        "credits": current_result.get("credits", {}),
                        "scenes": current_result.get("scenes", []),
                    },
                    "progress": 100,
                    "message": "Upload complete",
                },
            )

        cleanup_temporary_files(job_id)
        logging.info(f"[{job_id}] Upload complete")
    except Exception as upload_error:
        logging.warning(
            f"Job {job_id}: Cloudinary upload unavailable, keeping local file: {str(upload_error)}"
        )
        local_video_url = public_file_url(final_path)
        run_async_db_task(
            update_generation(
                job_id,
                video_url=local_video_url,
                status="completed",
                title=script.get("title"),
                mood=script.get("mood"),
                duration=script.get("duration"),
            ),
            f"update_generation({job_id})",
        )
        current_job = get_job(job_id) or {}
        current_result = current_job.get("result", {})
        if current_job:
            persist_job_updates(
                job_id,
                {
                    "status": "completed",
                    "result": {
                        "video_url": local_video_url,
                        "local_video_url": local_video_url,
                        "local_file_path": current_result.get(
                            "local_file_path", final_path
                        ),
                        "credits": current_result.get("credits", {}),
                        "scenes": current_result.get("scenes", []),
                    },
                    "progress": 100,
                    "message": "Completed with local file",
                },
            )


def cleanup_jobs(max_age_seconds=3600):
    """
    Remove jobs older than max_age_seconds to prevent memory leaks.
    """
    if using_memory_fallback():
        cleanup_expired_jobs()
        logging.info("[JobStore] Cleaned up expired in-memory jobs")


async def run_pipeline_directly(
    prompt, job_id, user_id, orientation, footage_ids, export_formats,
    apply_brand_kit, transition_style, music_id, voice_id,
    scene_count, include_narration, logo_position, logo_size, logo_timing,
    logo_url, outro_url, music_seed,
):
    persist_job_updates(job_id, {
        "status": "queued",
        "progress": 0,
        "message": "Waiting for previous job to finish...",
    })
    async with _pipeline_semaphore:
        persist_job_updates(job_id, {
            "status": "processing",
            "progress": 1,
            "message": "Starting pipeline...",
        })

        def run_sync():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return generate_video_pipeline(
                    prompt, job_id, user_id, orientation, footage_ids, export_formats,
                    apply_brand_kit, transition_style, music_id, voice_id,
                    scene_count, include_narration, logo_position, logo_size, logo_timing,
                    logo_url, outro_url, music_seed,
                )
            finally:
                loop.close()
                asyncio.set_event_loop(None)

        await asyncio.to_thread(run_sync)


def dispatch_generation_job(background_tasks, prompt, job_id, user_id, orientation="portrait", footage_ids=None, export_formats=None, apply_brand_kit=True, transition_style="auto", music_id="", voice_id="", scene_count=3, include_narration=True, logo_position="top-right", logo_size="S", logo_timing="full", logo_url="", outro_url="", music_seed=0):
    request_payload = {
        "prompt": prompt,
        "user_id": user_id,
        "orientation": orientation,
        "footage_ids": footage_ids or [],
        "export_formats": export_formats or [],
        "apply_brand_kit": apply_brand_kit,
        "transition_style": transition_style,
        "music_id": music_id or "",
        "voice_id": voice_id or "",
        "logo_position": logo_position,
        "logo_size": logo_size,
        "logo_timing": logo_timing,
        "scene_count": scene_count,
        "include_narration": include_narration,
        "music_seed": music_seed,
    }

    if CELERY_ENABLED:
        try:
            from worker import celery_app, process_film_job

            if celery_app is not None and (
                os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL")
            ):
                logging.info(f"[Worker] Dispatching job {job_id} to Celery")
                process_film_job.delay(job_id, request_payload)
                return "celery"
        except Exception as exc:
            logging.warning(
                f"[Worker] Celery dispatch unavailable for job {job_id}: {exc}. Falling back to BackgroundTasks."
            )

    logging.info(f"[Worker] Running job {job_id} with FastAPI BackgroundTasks")
    background_tasks.add_task(
        run_pipeline_directly,
        prompt, job_id, user_id, orientation,
        footage_ids or [], export_formats or [],
        apply_brand_kit, transition_style,
        music_id or "", voice_id or "",
        scene_count, include_narration,
        logo_position, logo_size, logo_timing,
        logo_url or "", outro_url or "", music_seed,
    )
    return "background"


def generate_video_pipeline(prompt, job_id, user_id, orientation="portrait", footage_ids=None, export_formats=None, apply_brand_kit=True, transition_style="auto", music_id="", voice_id="", scene_count=3, include_narration=True, logo_position="top-right", logo_size="S", logo_timing="full", logo_url="", outro_url="", music_seed=0):
    """
    Main video generation pipeline - runs in background.
    Updates the jobs dictionary with status and results.
    """
    import asyncio
    from observability.tracer import PipelineTrace

    trace = PipelineTrace(job_id=job_id, prompt=prompt)
    update_job(job_id, status="processing", progress=5, message="Starting generation")

    try:
        logging.info(f"[{job_id}] Generating script...")
        update_job(job_id, progress=5, message="Generating cinematic script")
        _t0 = __import__("time").time()
        script = generate_script(prompt, scene_count=scene_count, orientation=orientation, job_id=job_id)
        trace.add_span("script_generation", "success", int((__import__("time").time() - _t0) * 1000),
                       {"scene_count": len(script.get("scenes", []))})
        scenes = script.get("scenes", [])
        logging.info(
            f"[Director] Film: '{script.get('title', 'Untitled')}'"
            f" | Mood: {script.get('mood')}"
            f" | Arc: {script.get('emotional_arc', 'N/A')}"
            f" | Music: {script.get('music_style', 'N/A')}"
        )
        for i, s in enumerate(script.get("scenes", [])):
            logging.info(
                f"[Director] Scene {i+1}: "
                f"beat={s.get('beat_type','?')} "
                f"cam={s.get('camera','?')} "
                f"pace={s.get('pacing','?')} "
                f"t_out={s.get('transition_out','?')}"
            )
        update_job(job_id, progress=12, message="Script ready")
        persist_job_updates(job_id, {"script": script})

        logging.info(f"[{job_id}] Fetching videos...")
        update_job(job_id, progress=12, message="Downloading scene footage")
        download_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(download_loop)
        if footage_ids:
            update_job(job_id, progress=12, message="Using your uploaded footage")
            downloaded_videos = download_loop.run_until_complete(
                prepare_user_footage(footage_ids, scenes, orientation=orientation, timeout_seconds=20)
            )
        else:
            downloaded_videos = download_loop.run_until_complete(
                download_all_scenes(scenes, timeout_seconds=20, orientation=orientation)
            )
        download_loop.close()
        asyncio.set_event_loop(None)

        footage_count = sum(1 for v in downloaded_videos if str(v or "").startswith("http"))
        trace.add_span(
            "scene_download", "success", 0,
            {"total_scenes": len(downloaded_videos), "scenes_with_footage": footage_count},
        )
        for scene, video_source in zip(scenes, downloaded_videos):
            scene["video"] = video_source
        update_job(job_id, progress=32, message="Scene footage ready")

        voice_full = None
        voice_engine_label = "Edge TTS"

        if not include_narration:
            # Music-only mode: generate stereo silence so FFmpeg pipeline runs unchanged
            total_scene_duration = max(sum(float(s.get("duration", 5)) for s in scenes), 10.0)
            silence_path = file_in_backend(f"voice_silence_{job_id}.mp3")
            subprocess.run(
                [
                    "ffmpeg", "-y",
                    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                    "-t", str(total_scene_duration),
                    "-acodec", "libmp3lame", "-b:a", "192k",
                    silence_path,
                ],
                check=True,
                capture_output=True,
            )
            voice_full = silence_path
            voice_engine_label = "None (music only)"
            update_job(job_id, progress=50, message="Music-only mode")
        else:
            if voice_id:
                voice_rec_path = str(FILES_DIR / f"voice_rec_{voice_id}.mp3")
                if os.path.exists(voice_rec_path):
                    voice_full = voice_rec_path
                    voice_engine_label = "Your recording"
                    logging.info(f"[Pipeline] Using user voice recording: {voice_full}")
                    update_job(job_id, progress=50, message="Using your recording")
                else:
                    logging.warning(f"[Pipeline] voice_id={voice_id} not found, falling back to TTS")
                    voice_id = ""

            if not voice_full:
                logging.info(f"[{job_id}] Generating voice...")
                update_job(job_id, progress=32, message="Generating narration")
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                voice_files = loop.run_until_complete(
                    generate_scene_voices(
                        scenes,
                        progress_callback=lambda pct, msg=None: update_job(
                            job_id,
                            progress=map_stage_progress(32, 47, pct),
                            message=msg or "Generating narration",
                        ),
                    )
                )
                loop.close()
                asyncio.set_event_loop(None)

                voice_full = merge_voices(
                    voice_files,
                    progress_callback=lambda pct, msg=None: update_job(
                        job_id,
                        progress=map_stage_progress(47, 50, pct),
                        message=msg or "Merging narration",
                    ),
                )
                logging.info(f"[{job_id}] Voice merged...")
                update_job(job_id, progress=50, message="Narration ready")

            if not voice_full:
                run_async_db_task(
                    update_generation(job_id, status="failed"),
                    f"update_generation_failed({job_id})",
                )
                persist_job_updates(
                    job_id,
                    {"status": "failed", "error": "Voice generation failed", "progress": 0},
                )
                return

            # Measure actual voice duration and redistribute scene durations to match
            total_voice_duration = get_audio_duration_seconds(voice_full)
            logging.info(f"[Pipeline] Total voice duration: {total_voice_duration:.2f}s")

            scene_narrations = [s.get("narration", "") for s in scenes]
            total_words = sum(len(n.split()) for n in scene_narrations)
            if total_words > 0 and total_voice_duration > 0:
                for scene in scenes:
                    words = len(scene.get("narration", "").split())
                    scene["duration"] = round(
                        (words / total_words) * total_voice_duration + 0.3,
                        2,
                    )
                    logging.info(
                        f"[Pipeline] Scene {scene.get('id')}: "
                        f"{words} words → {scene['duration']:.2f}s duration"
                    )

        update_job(job_id, progress=50, message="Fetching music and sound design")
        if music_id:
            music_custom_path = str(FILES_DIR / f"music_{music_id}.mp3")
            music = music_custom_path if os.path.exists(music_custom_path) else get_music(script.get("mood", "cinematic"), job_id=job_id, music_seed=music_seed)
            music_track_label = Path(music).name if music else "custom"
        else:
            music = get_music(script.get("mood", "cinematic"), job_id=job_id, music_seed=music_seed)
            music_track_label = Path(music).name if music else "none"
        music_url = music  # kept for eval reporting below

        sfx = download_file(get_sfx(), file_in_backend("sfx.mp3"))
        if not sfx:
            sfx = download_file(
                "https://assets.mixkit.co/sfx/preview/mixkit-city-traffic-ambience-1247.mp3",
                file_in_backend("sfx.mp3"),
            )
        update_job(job_id, progress=62, message="Music and sound design ready")

        # Resolve brand kit assets
        # Prefer URLs passed directly in the request (avoids asyncpg loop-mismatch from background thread).
        # Fall back to DB lookup only when the request didn't include them.
        logo_local_path = None
        outro_local_path = None
        if apply_brand_kit:
            resolved_logo_url = logo_url or ""
            resolved_outro_url = outro_url or ""
            if not resolved_logo_url and user_id:
                brand_kit = run_async_db_task(
                    get_brand_kit(user_id),
                    f"get_brand_kit({user_id})",
                    default={},
                ) or {}
                resolved_logo_url = brand_kit.get("logo_url") or ""
                resolved_outro_url = resolved_outro_url or brand_kit.get("outro_clip_url") or ""
            if resolved_logo_url:
                logo_local_path = download_file(resolved_logo_url, file_in_backend("brand_logo.png"))
                logging.info(f"[{job_id}] Logo downloaded to {logo_local_path}")
            if resolved_outro_url:
                outro_local_path = download_file(resolved_outro_url, file_in_backend("brand_outro.mp4"))

        logging.info(f"[{job_id}] Rendering final video...")
        formats_to_render = export_formats if export_formats else [orientation]
        n_formats = len(formats_to_render)
        format_local_paths = {}
        per_span = (88 - 62) // n_formats

        for fmt_idx, fmt in enumerate(formats_to_render):
            pct_start = 62 + fmt_idx * per_span
            pct_end = 62 + (fmt_idx + 1) * per_span
            update_job(job_id, progress=pct_start, message=f"Rendering {fmt} format")
            logging.info(f"[{job_id}] Rendering {fmt} format...")
            script_mood = script.get("mood", "cinematic")
            fmt_path = create_video(
                scenes,
                voice_full,
                music,
                sfx,
                mood=script_mood,
                orientation=fmt,
                progress_callback=lambda pct, msg=None, *, _s=pct_start, _e=pct_end, _fmt=fmt: update_job(
                    job_id,
                    progress=map_stage_progress(_s, _e, pct),
                    message=msg or f"Rendering {_fmt} reel",
                ),
                transition_style=transition_style or "auto",
                logo_path=logo_local_path,
                outro_path=outro_local_path,
                logo_position=logo_position or "top-right",
                logo_size=logo_size or "S",
                logo_timing=logo_timing or "full",
            )
            if fmt_path:
                format_local_paths[fmt] = fmt_path

        final = format_local_paths.get(orientation) or next(iter(format_local_paths.values()), None)

        if not final:
            run_async_db_task(
                update_generation(job_id, status="failed"),
                f"update_generation_failed({job_id})",
            )
            persist_job_updates(
                job_id,
                {"status": "failed", "error": "Video generation failed", "progress": 0},
            )
            return

        format_urls = {
            fmt: f"/api/film/files/{job_id}/formats/{fmt}.mp4"
            for fmt in format_local_paths
        }

        # Build credits metadata for the ingredients box
        generation_credits = {
            "footage": [
                {
                    "scene": i + 1,
                    "source": "Pexels",
                    "keywords": scene.get("visual_keywords", []),
                }
                for i, scene in enumerate(scenes)
                if str(scene.get("video", "")).startswith("http")
            ],
            "music": {
                "track": music_track_label,
                "mood": script.get("mood", "cinematic"),
                "source": "Custom upload" if music_id else "Local library",
            },
            "voice": {
                "engine": voice_engine_label,
                "voice": "en-US-AriaNeural" if (include_narration and not voice_id) else ("User recording" if voice_id else "None"),
            },
            "tools": ["Groq LLaMA 3.1", "Pexels", "Edge TTS", "FFmpeg 8.1"],
        }

        # Expose the rendered reel immediately, then continue Cloudinary upload in the background.
        logging.info(f"[{job_id}] Preparing upload...")
        local_video_url = f"/api/film/files/{job_id}/final_reel.mp4"
        run_async_db_task(
            update_generation(
                job_id,
                video_url=local_video_url,
                status="uploading",
                title=script.get("title"),
                mood=script.get("mood"),
                duration=script.get("duration"),
            ),
            f"update_generation_uploading({job_id})",
        )
        persist_job_updates(
            job_id,
            {
                "status": "rendering_complete",
                "result": {
                    "video_url": local_video_url,
                    "local_video_url": local_video_url,
                    "local_file_path": final,
                    "format_local_paths": format_local_paths,
                    "format_urls": format_urls,
                    "credits": generation_credits,
                    "scenes": scenes,
                },
                "progress": 88,
                "message": "Render complete, uploading to Cloudinary",
            },
        )

        # Evaluate generation quality (non-blocking — never fails the job)
        try:
            scene_results = [
                {
                    "scene_id": i + 1,
                    "has_footage": str(v or "").startswith("http"),
                }
                for i, v in enumerate(downloaded_videos)
            ]
            video_duration_s = sum(float(s.get("duration", 4)) for s in scenes)
            voice_duration_s = video_duration_s
            try:
                from pydub import AudioSegment as _AS
                _va = _AS.from_file(voice_full)
                voice_duration_s = len(_va) / 1000.0
            except Exception:
                pass

            agent_trace = (get_job(job_id) or {}).get("agent_trace", {})

            _eval_loop = asyncio.new_event_loop()
            try:
                eval_result = _eval_loop.run_until_complete(
                    ReelEvaluator().evaluate(
                        job_id=job_id,
                        prompt=prompt,
                        script=script,
                        scene_results=scene_results,
                        voice_duration=voice_duration_s,
                        video_duration=video_duration_s,
                        voice_success=True,
                        music_success=music_url is not None,
                        ffmpeg_success=final is not None,
                        cloudinary_success=False,
                        subtitles_success=False,
                        agent_trace=agent_trace,
                    )
                )
                _eval_loop.run_until_complete(eval_store.save(eval_result))
            finally:
                _eval_loop.close()

            persist_job_updates(
                job_id,
                {
                    "eval_score": eval_result.overall_score,
                    "eval_passed": eval_result.passed,
                    "eval_failures": eval_result.failure_reasons,
                },
            )
        except Exception as _eval_exc:
            logging.warning(f"[Eval] Evaluation failed (non-blocking): {_eval_exc}")

        # Store completed trace in job store
        try:
            trace.add_span("pipeline_complete", "success", 0,
                           {"final_path": final})
            persist_job_updates(job_id, {"trace": trace.to_dict()})
        except Exception as _tr_exc:
            logging.warning(f"[Trace] Failed to store trace: {_tr_exc}")

        upload_thread = threading.Thread(
            target=upload_video_in_background,
            args=(job_id, final, script),
            daemon=True,
        )
        upload_thread.start()

    except Exception as e:
        logging.error(f"Job {job_id}: Video generation failed: {str(e)}")
        run_async_db_task(
            update_generation(job_id, status="failed"),
            f"update_generation_failed({job_id})",
        )
        persist_job_updates(
            job_id,
            {"status": "failed", "error": str(e), "progress": 0},
        )


# ============= API ROUTES =============

@app.post("/upload/footage")
async def upload_footage(
    files: list[UploadFile] = File(...),
    user_id: str = Depends(get_current_user),
):
    """Accept up to 10 video files and store them for use in the next generation."""
    FOOTAGE_TMP_DIR.mkdir(parents=True, exist_ok=True)
    user_dir = FOOTAGE_TMP_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    assets = []
    for file in files[:10]:
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_FOOTAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Unsupported format. Use MP4, MOV, AVI, or WebM.",
            )

        data = await file.read()
        if len(data) > MAX_FOOTAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"{file.filename} exceeds the 100 MB limit.",
            )

        asset_id = str(uuid.uuid4())
        safe_filename = f"{asset_id}_{file.filename}"
        dest = user_dir / safe_filename
        dest.write_bytes(data)

        size_mb = len(data) / (1024 * 1024)
        logging.info(f"[Upload] User {user_id} uploaded {file.filename} ({size_mb:.1f} MB)")

        assets.append({
            "asset_id": asset_id,
            "filename": file.filename,
            "size_bytes": len(data),
        })

    return {"assets": assets}


@app.get("/brand-kit")
async def get_brand_kit_endpoint(user_id: str = Depends(get_current_user)):
    kit = await run_async_db_task_async(
        get_brand_kit(user_id), f"get_brand_kit({user_id})", default={}
    )
    return kit or {"user_id": user_id, "logo_url": None, "outro_clip_url": None}


class BrandKitUpdate(BaseModel):
    logo_url: str | None = None
    outro_clip_url: str | None = None


@app.put("/brand-kit")
async def update_brand_kit(data: BrandKitUpdate, user_id: str = Depends(get_current_user)):
    kit = await run_async_db_task_async(
        save_brand_kit(user_id, logo_url=data.logo_url, outro_clip_url=data.outro_clip_url),
        f"save_brand_kit({user_id})",
        default={},
    )
    return kit or {}


def _upload_brand_asset(file_data: bytes, filename: str, resource_type: str = "image") -> str:
    if all([os.getenv("CLOUDINARY_CLOUD_NAME"), os.getenv("CLOUDINARY_API_KEY"), os.getenv("CLOUDINARY_API_SECRET")]):
        result = cloudinary.uploader.upload(file_data, resource_type=resource_type, folder="brand_kit")
        return result["secure_url"]
    local_path = FILES_DIR / filename
    local_path.write_bytes(file_data)
    return f"/files/{filename}"


@app.post("/upload/logo")
async def upload_logo(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    allowed = {"image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"}
    if (file.content_type or "").lower() not in allowed:
        raise HTTPException(status_code=400, detail="Logo must be PNG, JPEG, GIF, WebP, or SVG.")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo must be under 5 MB.")
    logo_url = _upload_brand_asset(data, f"logo_{user_id}.png", resource_type="image")
    kit = await run_async_db_task_async(
        save_brand_kit(user_id, logo_url=logo_url),
        f"save_brand_kit_logo({user_id})",
        default={},
    )
    return {"logo_url": logo_url, "brand_kit": kit}


@app.post("/upload/outro")
async def upload_outro(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    if (file.content_type or "").lower() not in ALLOWED_FOOTAGE_TYPES:
        raise HTTPException(status_code=400, detail="Outro must be a video file (MP4, MOV, AVI, WebM).")
    data = await file.read()
    if len(data) > MAX_FOOTAGE_SIZE:
        raise HTTPException(status_code=400, detail="Outro must be under 100 MB.")
    outro_url = _upload_brand_asset(data, f"outro_{user_id}.mp4", resource_type="video")
    kit = await run_async_db_task_async(
        save_brand_kit(user_id, outro_clip_url=outro_url),
        f"save_brand_kit_outro({user_id})",
        default={},
    )
    return {"outro_clip_url": outro_url, "brand_kit": kit}


@app.post("/enhance-prompt")
async def enhance_prompt_endpoint(data: PromptEnhanceRequest):
    if not data.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required.")
    suggestions = enhance_prompt(data.prompt)
    return {"suggestions": suggestions}


@app.post("/upload/music")
async def upload_music(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    allowed = {"audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/m4a", "audio/mp4", "audio/aac"}
    content_type = (file.content_type or "").lower()
    if content_type not in allowed and not file.filename.lower().endswith((".mp3", ".wav", ".m4a", ".aac")):
        raise HTTPException(status_code=400, detail="Music must be MP3, WAV, M4A, or AAC.")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Music file must be under 50 MB.")
    music_id = str(uuid.uuid4())
    dest = FILES_DIR / f"music_{music_id}.mp3"
    dest.write_bytes(data)
    logging.info(f"[Upload] User {user_id} uploaded music: {file.filename} → {dest.name}")
    return {"music_id": music_id, "filename": file.filename}


@app.post("/upload/voice-recording")
async def upload_voice_recording(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    allowed_ext = (".mp3", ".wav", ".m4a", ".webm", ".ogg")
    fname = (file.filename or "recording").lower()
    if not any(fname.endswith(ext) for ext in allowed_ext):
        raise HTTPException(status_code=400, detail="Voice must be MP3, WAV, M4A, WebM, or OGG.")
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Voice file must be under 20 MB.")
    voice_id = str(uuid.uuid4())
    ext = next((e for e in allowed_ext if fname.endswith(e)), ".mp3")
    dest = FILES_DIR / f"voice_rec_{voice_id}{ext}"
    dest.write_bytes(data)
    # Store with canonical .mp3 name so pipeline can find it regardless of ext
    canonical = FILES_DIR / f"voice_rec_{voice_id}.mp3"
    if ext != ".mp3":
        dest.rename(canonical)
    logging.info(f"[Upload] User {user_id} uploaded voice: {file.filename} → voice_rec_{voice_id}.mp3")
    return {"voice_id": voice_id, "filename": file.filename}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/")
def home():
    return {"message": "AI Film Engine Running"}


@app.post("/generate")
async def generate(
    data: PromptRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user),
):
    """
    Start video generation in background.
    Returns job_id immediately without blocking.
    """
    # Clean up old jobs
    cleanup_jobs()

    user_record = await run_async_db_task_async(
        get_or_create_user(user_id, None),
        f"get_or_create_user({user_id})",
        default={"id": user_id, "tier": "free", "credits": 30},
    )
    user_tier = (user_record or {}).get("tier", "free")

    if user_tier != "pro":
        credits = await run_async_db_task_async(
            get_user_credits(user_id),
            f"get_user_credits({user_id})",
            default=(user_record or {}).get("credits", 30),
        )
        if int(credits or 0) == 0:
            logging.info(f"[Main] User {user_id} has exhausted free credits")
            return JSONResponse(
                status_code=402,
                content={
                    "error": "credits_exhausted",
                    "message": "You've used all your free reels. Upgrade to Pro for unlimited.",
                    "upgrade_url": "/pricing",
                },
            )

        remaining_credits = await run_async_db_task_async(
            decrement_credits(user_id),
            f"decrement_credits({user_id})",
            default=max(int(credits or 1) - 1, 0),
        )
        logging.info(
            f"[Main] User {user_id} is on free tier. Remaining credits after this request: {remaining_credits}"
        )
    else:
        logging.info(
            f"[Main] User {user_id} is on pro tier. Skipping credit enforcement."
        )

    job_id = str(uuid.uuid4())
    logging.info(
        f"[Main] Created job {job_id} for user {user_id} and prompt: {data.prompt}"
    )

    await run_async_db_task_async(
        create_generation(user_id, job_id, data.prompt),
        f"create_generation({job_id})",
    )

    # Initialize job with queued state
    set_job(
        job_id,
        {
            "status": "queued",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "progress": 0,
            "message": "Queued",
            "user_id": user_id,
        },
    )

    # Change: prefer Celery worker dispatch when available, but keep the
    # existing BackgroundTasks path as a local-dev fallback so generation never breaks.
    dispatch_generation_job(background_tasks, data.prompt, job_id, user_id, data.orientation, data.footage_ids, data.export_formats, data.apply_brand_kit, data.transition_style, data.music_id, data.voice_id, data.scene_count, data.include_narration, data.logo_position, data.logo_size, data.logo_timing, data.logo_url, data.outro_url, data.music_seed)

    return {
        "job_id": job_id,
        "user_id": user_id,
        "status": "queued",
        "message": "Video generation queued. Check status with /status/{job_id}",
    }


@app.post("/test-generate")
async def test_generate(
    data: PromptRequest,
    background_tasks: BackgroundTasks,
):
    """
    Test endpoint for video generation without authentication.
    """
    # Clean up old jobs
    cleanup_jobs()

    # Use a test user ID
    user_id = "test_user"

    job_id = str(uuid.uuid4())
    logging.info(f"[Test] Created job {job_id} for test user and prompt: {data.prompt}")

    # Initialize job with queued state
    set_job(
        job_id,
        {
            "status": "queued",
            "result": None,
            "error": None,
            "created_at": time.time(),
            "progress": 0,
            "message": "Queued",
            "user_id": user_id,
        },
    )

    # Dispatch the job
    dispatch_generation_job(background_tasks, data.prompt, job_id, user_id, data.orientation, data.footage_ids, data.export_formats, transition_style=data.transition_style)

    return {
        "job_id": job_id,
        "user_id": user_id,
        "status": "queued",
        "message": "Video generation queued. Check status with /status/{job_id}",
    }


@app.post("/ideas")
async def get_content_ideas(
    data: IdeasRequest,
    user_id: str = Depends(get_current_user),
):
    """
    Generate content ideas for a creator's niche.
    """
    count = max(1, min(data.count, 20))
    ideas = generate_content_ideas(data.niche, data.platform, count)

    return {"ideas": ideas[:count]}


@app.post("/voice/token")
async def get_livekit_token(user_id: str = Depends(get_current_user)):
    """
    Generate a LiveKit room token for FRIDAY session access.
    """
    room_name = f"friday-{user_id}"
    livekit_url = os.getenv("LIVEKIT_URL")
    livekit_api_key = os.getenv("LIVEKIT_API_KEY")
    livekit_api_secret = os.getenv("LIVEKIT_API_SECRET")

    if not all([livekit_url, livekit_api_key, livekit_api_secret]):
        raise HTTPException(
            status_code=503,
            detail="LiveKit configuration is missing.",
        )

    now = int(time.time())
    payload = {
        "jti": uuid.uuid4().hex,
        "iss": livekit_api_key,
        "sub": user_id,
        "nbf": now,
        "exp": now + 3600,
        "identity": user_id,
        "name": "Creator",
        "grants": {
            "video": {
                "roomJoin": True,
                "room": room_name,
            }
        },
    }

    token = jwt.encode(payload, livekit_api_secret, algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")

    return {
        "token": token,
        "room": room_name,
        "livekit_url": livekit_url,
    }


@app.get("/status/{job_id}")
def get_status(job_id: str):
    """
    Get the status of a video generation job.
    """
    job = get_job(job_id)
    if not job:
        return {"status": "error", "message": "Job not found"}
    response = {
        "job_id": job_id,
        "status": job["status"],
        "progress": job.get("progress", 0),
        "message": job.get("message", ""),
        "created_at": job["created_at"],
        "error": job.get("error"),
    }

    if job["status"] in {"completed", "rendering_complete"} and job.get("result"):
        result = job["result"]
        response["video_url"] = result.get("video_url")
        response["local_video_url"] = result.get("local_video_url")
        response["format_urls"] = result.get("format_urls", {})
        response["credits"] = result.get("credits", {})
        response["scenes"] = result.get("scenes", [])

    if job.get("script"):
        response["script"] = job["script"]
    if job.get("eval_score") is not None:
        response["eval_score"] = job["eval_score"]

    return response


@app.get("/result/{job_id}")
def get_result(job_id: str, request: Request):
    """
    Get the result of a completed job.
    """
    job = get_job(job_id)
    if not job:
        return {"status": "error", "message": "Job not found"}

    if job["status"] in {"completed", "rendering_complete"}:
        result = job["result"]
        return {
            "status": job["status"],
            "video_url": absolute_video_url(request, result["video_url"]),
            "local_video_url": absolute_video_url(request, result.get("local_video_url")),
            "format_urls": {
                fmt: absolute_video_url(request, url)
                for fmt, url in result.get("format_urls", {}).items()
            },
            "credits": result.get("credits", {}),
            "scenes": result.get("scenes", []),
        }
    elif job["status"] == "failed":
        return {
            "status": "failed",
            "error": job["error"],
        }
    else:
        return {
            "status": job["status"],
            "message": "Video is still being generated",
        }


@app.get("/user/generations")
async def user_generations(request: Request, user_id: str = Depends(get_current_user)):
    generations = (
        await run_async_db_task_async(
            get_user_generations(user_id, limit=20),
            f"get_user_generations({user_id})",
            default=[],
        )
        or []
    )

    items = []
    for generation in generations:
        video_url = generation.get("video_url")
        items.append(
            {
                "job_id": generation.get("job_id"),
                "prompt": generation.get("prompt"),
                "video_url": absolute_video_url(request, video_url)
                if video_url
                else None,
                "created_at": generation.get("created_at"),
                "status": generation.get("status"),
                "title": generation.get("title"),
                "mood": generation.get("mood"),
                "duration": generation.get("duration"),
            }
        )

    return {"items": items}


@app.get("/user/me")
async def user_me(user_id: str = Depends(get_current_user)):
    user_record = await run_async_db_task_async(
        get_or_create_user(user_id, None),
        f"get_or_create_user({user_id})",
        default={"id": user_id, "email": None, "tier": "free", "credits": 30},
    )
    return {
        "id": (user_record or {}).get("id", user_id),
        "email": (user_record or {}).get("email"),
        "tier": (user_record or {}).get("tier", "free"),
        "credits": (user_record or {}).get("credits", 30),
    }


@app.get("/api/film/files/{job_id}/final_reel.mp4")
def get_rendering_complete_file(job_id: str):
    job = get_job(job_id)
    if not job or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job not found")

    local_file_path = job["result"].get("local_file_path")
    if not local_file_path or not os.path.exists(local_file_path):
        raise HTTPException(status_code=404, detail="Rendered file not available")

    return FileResponse(
        local_file_path, media_type="video/mp4", filename=Path(local_file_path).name
    )


@app.get("/api/film/files/{job_id}/formats/{fmt}.mp4")
def get_format_reel_file(job_id: str, fmt: str):
    job = get_job(job_id)
    if not job or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job not found")

    format_local_paths = job["result"].get("format_local_paths", {})
    local_path = format_local_paths.get(fmt)
    if not local_path or not os.path.exists(local_path):
        raise HTTPException(status_code=404, detail=f"{fmt} format not available")

    return FileResponse(local_path, media_type="video/mp4", filename=f"reel_{fmt}.mp4")


# ============= QUICK-FIX ENDPOINTS =============

class ReplaceSceneRequest(BaseModel):
    job_id: str
    scene_index: int
    orientation: str = "portrait"


class AIFixRequest(BaseModel):
    job_id: str
    fix_request: str
    prompt: str
    mood: str = "cinematic"


@app.post("/replace-scene-clip")
async def replace_scene_clip(
    data: ReplaceSceneRequest,
    user_id: str = Depends(get_current_user),
):
    job = get_job(data.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = job.get("result", {})
    scenes = result.get("scenes", [])
    if not scenes or not (0 <= data.scene_index < len(scenes)):
        raise HTTPException(status_code=400, detail="Invalid scene index or no scene data")

    from services.video_service import get_video_unique

    # Exclude only the current clip so the replacement pool is as wide as possible
    scene = scenes[data.scene_index]
    current_url = str(scene.get("video", ""))
    used_video_ids: set = set()
    if "pexels.com" in current_url:
        parts = current_url.split("/")
        vid_id = next((p for p in parts if p.isdigit()), None)
        if vid_id:
            used_video_ids.add(vid_id)

    new_clip = await asyncio.to_thread(
        get_video_unique,
        scene.get("description", ""),
        data.orientation,
        scene.get("visual_keywords", []),
        used_video_ids,
    )
    if not new_clip:
        raise HTTPException(status_code=503, detail="Could not find a replacement clip")

    new_scenes = [s.copy() for s in scenes]
    new_scenes[data.scene_index] = {**scene, "video": new_clip}

    new_job_id = str(uuid.uuid4())
    set_job(new_job_id, {
        "status": "queued",
        "result": None,
        "error": None,
        "created_at": time.time(),
        "progress": 0,
        "message": "Queued for re-render",
        "user_id": user_id,
    })

    orientation = data.orientation
    mood = result.get("credits", {}).get("music", {}).get("mood", "cinematic")

    def rerender():
        import asyncio as _asyncio
        _loop = _asyncio.new_event_loop()
        _asyncio.set_event_loop(_loop)
        try:
            persist_job_updates(new_job_id, {"status": "processing", "progress": 10, "message": "Generating narration"})

            voice_files = _loop.run_until_complete(generate_scene_voices(new_scenes))
            voice_full = merge_voices(voice_files)
            if not voice_full:
                raise RuntimeError("Voice generation failed")

            total_voice_duration = get_audio_duration_seconds(voice_full)
            scene_narrations = [s.get("narration", "") for s in new_scenes]
            total_words = sum(len(n.split()) for n in scene_narrations)
            if total_words > 0 and total_voice_duration > 0:
                for s in new_scenes:
                    words = len(s.get("narration", "").split())
                    s["duration"] = round((words / total_words) * total_voice_duration + 0.3, 2)

            persist_job_updates(new_job_id, {"progress": 40, "message": "Fetching music"})
            music = get_music(mood, job_id=new_job_id)
            sfx_url = get_sfx()
            sfx = download_file(sfx_url, file_in_backend("sfx.mp3")) if sfx_url else None

            persist_job_updates(new_job_id, {"progress": 55, "message": "Rendering video"})
            fmt_path = create_video(
                new_scenes, voice_full, music, sfx,
                mood=mood, orientation=orientation,
            )
            if not fmt_path:
                raise RuntimeError("Video render failed")

            local_video_url = f"/api/film/files/{new_job_id}/final_reel.mp4"
            persist_job_updates(new_job_id, {
                "status": "rendering_complete",
                "result": {
                    "video_url": local_video_url,
                    "local_video_url": local_video_url,
                    "local_file_path": fmt_path,
                    "scenes": new_scenes,
                    "credits": result.get("credits", {}),
                },
                "progress": 100,
                "message": "Clip replacement complete",
            })
        except Exception as exc:
            logging.error(f"[ReplaceClip] Re-render failed for {new_job_id}: {exc}")
            persist_job_updates(new_job_id, {"status": "failed", "error": str(exc), "progress": 0})
        finally:
            _loop.close()
            _asyncio.set_event_loop(None)

    threading.Thread(target=rerender, daemon=True).start()

    return {
        "new_job_id": new_job_id,
        "scene_index": data.scene_index,
        "message": "Re-render started",
    }


@app.post("/ai-fix")
async def ai_fix_endpoint(
    data: AIFixRequest,
    user_id: str = Depends(get_current_user),
):
    from services.ai_service import get_client
    import json as _json

    client = get_client()
    if client is None:
        return {"action": "regenerate", "params": {}, "message": "AI unavailable"}

    system = """You are a video editing assistant.
A user has generated a video and wants to change ONE thing.
Interpret their request and return the most surgical action.

Return ONLY valid JSON — no markdown, no explanation:
{"action": "one of the actions below", "params": {}, "message": "human readable confirmation"}

AVAILABLE ACTIONS — pick the most surgical one:

"toggle_narration_off"
  Use when: user wants to remove/mute/disable voice/narration
  params: {}
  Example requests: "remove voiceover", "no narration", "mute the voice", "just music no talking"

"toggle_narration_on"
  Use when: user wants to add narration back
  params: {}
  Example requests: "add voice back", "include narration"

"change_music"
  Use when: user wants different background music
  params: { "mood": "dark|calm|epic|emotional|happy" }
  Example requests: "different music", "make music darker", "change the song", "more upbeat music"

"replace_clip"
  Use when: user wants to change ONE specific scene's footage
  params: { "scene_index": 0 }
  Example requests: "change scene 2", "replace the second clip", "scene 3 doesn't match", "first clip looks wrong"

"change_mood"
  Use when: user wants overall mood/tone changed
  params: { "mood": "dark|cinematic|epic|emotional|calm" }
  Example requests: "make it darker", "more emotional", "feels too happy", "needs to be more intense"

"new_script"
  Use when: user wants narration text rewritten
  params: { "guidance": "brief instruction" }
  Example requests: "rewrite the narration", "different words", "narration doesn't match", "make script more poetic"

"regenerate"
  Use ONLY when user wants completely new clips AND script.
  This is the nuclear option — use sparingly.
  Example requests: "start over", "completely different", "nothing works, redo everything"

Pick the MOST SURGICAL action. If user says "remove voice" that is toggle_narration_off, NOT regenerate.
If user says "change scene 2" that is replace_clip, NOT regenerate.
Only use regenerate if the user explicitly asks to start over."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": (
                        f"Video prompt: {data.prompt}\n"
                        f"Mood: {data.mood}\n"
                        f"Fix request: {data.fix_request}"
                    ),
                },
            ],
        )
        text = response.choices[0].message.content.strip()
        if "```" in text:
            for part in text.split("```"):
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                if part.startswith("{"):
                    text = part
                    break
        return _json.loads(text)
    except Exception as exc:
        logging.error(f"[AIFix] Failed: {exc}")
        return {"action": "regenerate", "params": {}, "message": "Could not interpret fix request"}


# ============= TRANSITIONS ENDPOINT =============

@app.get("/transitions")
async def list_transitions():
    from services.transitions import TRANSITIONS, MOOD_PRIMARY_TRANSITIONS
    by_mood = {mood: list(names) for mood, names in MOOD_PRIMARY_TRANSITIONS.items()}
    all_transitions = [
        {
            "name": key,
            "display_name": td["name"],
            "duration": td["duration"],
            "moods": td["moods"],
            "custom": td["custom"],
        }
        for key, td in TRANSITIONS.items()
    ]
    return {
        "total": len(TRANSITIONS),
        "by_mood": by_mood,
        "all_transitions": all_transitions,
    }


# ============= EVAL ENDPOINTS =============

@app.get("/evals/recent")
async def get_recent_evals(limit: int = 20, user_id: str = Depends(get_current_user)):
    results = await eval_store.get_recent(limit=limit)
    return {"results": results, "count": len(results)}


@app.get("/evals/patterns")
async def get_eval_patterns(user_id: str = Depends(get_current_user)):
    return await eval_store.get_failure_patterns()


@app.get("/evals/{job_id}")
async def get_eval_by_job(job_id: str, user_id: str = Depends(get_current_user)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await eval_store.get_by_job_id(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Eval result not found for this job")
    return result


@app.get("/trace/{job_id}")
async def get_trace(job_id: str, user_id: str = Depends(get_current_user)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    trace = job.get("trace")
    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found for this job")
    return trace
