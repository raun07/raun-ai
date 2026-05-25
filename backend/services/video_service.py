import asyncio
import gc
import glob as _glob
import json
import random
import re
import requests
import os
import logging
import tempfile
import time
import subprocess
from pathlib import Path
from services.transitions import (
    TRANSITIONS,
    build_transition_filter,
    get_transitions_for_style,
)
from utils.ffmpeg_utils import run_ffmpeg

FILES_DIR = Path(__file__).resolve().parent.parent / "files"
LUTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "luts"
FOOTAGE_TMP_DIR = Path(tempfile.gettempdir()) / "footage"

PORTRAIT_W,  PORTRAIT_H  = 720,  1280   # 9:16 — Reels / Shorts / TikTok
LANDSCAPE_W, LANDSCAPE_H = 1280, 720    # 16:9 — YouTube / desktop


def _dims(orientation):
    o = str(orientation or "portrait").strip().lower()
    if o == "landscape":
        return LANDSCAPE_W, LANDSCAPE_H
    if o == "square":
        return 720, 720
    return PORTRAIT_W, PORTRAIT_H


_STOP_WORDS = {
    "a","an","the","and","or","but","in","on","at","to","for","of","with",
    "by","from","is","was","are","were","be","been","being","have","has",
    "had","do","does","did","will","would","could","should","may","might",
    "while","as","if","when","where","who","which","that","this","these",
    "those","there","their","its","his","her","our","your","my","we",
    "they","he","she","it","you","i","not","no","so","just","about",
    "amid","across","upon","within","into","through","over","under",
    "above","below","between","after","before","against","along","around",
    "then","now","here","also","very","even","still","than","too","only",
    "back","away","up","down","out","off","once","again","both","each",
}


def _extract_visual_keywords(text, max_words=4):
    cleaned = re.sub(r"[^\w\s]", " ", str(text or "").lower())
    words = [w for w in cleaned.split() if len(w) > 2 and w not in _STOP_WORDS]
    result = " ".join(words[:max_words])
    return result if result else "cinematic"


def get_video(query, orientation="portrait", visual_keywords=None, exclude_urls=None):
    url = "https://api.pexels.com/videos/search"
    headers = {"Authorization": os.getenv("PEXELS_API_KEY")}

    # Prefer AI-selected keywords over auto-extraction
    if visual_keywords and isinstance(visual_keywords, list):
        keywords = " ".join(
            str(k) for k in visual_keywords[:3]
        )
    else:
        keywords = _extract_visual_keywords(query)
    pexels_orientation = "landscape" if str(orientation or "portrait").strip().lower() == "landscape" else "portrait"
    params = {
        "query": keywords,
        "per_page": 10,
        "orientation": pexels_orientation,
    }

    try:
        res = requests.get(url, headers=headers, params=params, timeout=20)
        data = res.json()

        if not data.get("videos"):
            params.pop("orientation")
            res = requests.get(url, headers=headers, params=params, timeout=20)
            data = res.json()

        if not data.get("videos"):
            logging.warning(f"[VideoService] No videos for keywords: '{keywords}'")
            return None

        for vid in data["videos"]:
            # Filter to MP4 only
            mp4_files = [
                f for f in vid["video_files"]
                if f.get("file_type", "").startswith("video")
                or str(f.get("link", "")).endswith(".mp4")
            ]
            if not mp4_files:
                mp4_files = vid["video_files"]

            # For portrait: prefer vertical videos (height > width)
            # For landscape: prefer horizontal videos (width >= height)
            orientation_lower = str(orientation or "portrait").lower()
            if orientation_lower == "portrait":
                preferred = [
                    f for f in mp4_files
                    if f.get("height", 0) > f.get("width", 0)
                ]
            else:
                preferred = [
                    f for f in mp4_files
                    if f.get("width", 0) >= f.get("height", 0)
                ]

            pool = preferred if preferred else mp4_files

            def long_edge(f):
                return max(f.get("width", 0), f.get("height", 0))

            under_1080 = [f for f in pool if long_edge(f) <= 1920]
            # Rank best → worst so we try the highest quality first,
            # but skip any URL already assigned to another scene.
            candidates = sorted(
                under_1080 if under_1080 else pool,
                key=long_edge,
                reverse=True,
            )

            for best in candidates:
                link = best.get("link", "")
                if not link:
                    continue
                if exclude_urls and link in exclude_urls:
                    continue
                logging.info(
                    f"[VideoService] Pexels hit for '{keywords}': "
                    f"{best.get('width')}x{best.get('height')} — {link[:80]}"
                )
                return link

        return None
    except Exception as e:
        logging.error(f"[VideoService] Pexels fetch failed for '{query}': {e}")
        return None


def get_video_unique(query, orientation="portrait", visual_keywords=None, used_video_ids=None):
    """Like get_video but skips already-used Pexels video IDs."""
    used_video_ids = used_video_ids or set()
    url = "https://api.pexels.com/videos/search"
    headers = {"Authorization": os.getenv("PEXELS_API_KEY")}

    if visual_keywords and isinstance(visual_keywords, list):
        keywords = " ".join(str(k) for k in visual_keywords[:3])
    else:
        keywords = _extract_visual_keywords(query)

    pexels_orientation = (
        "landscape"
        if str(orientation or "portrait").lower() == "landscape"
        else "portrait"
    )
    params = {
        "query": keywords,
        "per_page": 15,
        "orientation": pexels_orientation,
    }

    try:
        res = requests.get(url, headers=headers, params=params, timeout=20)
        data = res.json()

        if not data.get("videos"):
            params.pop("orientation", None)
            res = requests.get(url, headers=headers, params=params, timeout=20)
            data = res.json()

        if not data.get("videos"):
            return None

        for vid in data["videos"]:
            vid_id = str(vid.get("id", ""))

            if vid_id in used_video_ids:
                logging.info(
                    f"[VideoService] Skipping duplicate video ID {vid_id}"
                )
                continue

            mp4_files = [
                f for f in vid["video_files"]
                if f.get("file_type", "").startswith("video")
                or str(f.get("link", "")).endswith(".mp4")
            ]
            if not mp4_files:
                mp4_files = vid["video_files"]

            if orientation.lower() == "portrait":
                preferred = [
                    f for f in mp4_files
                    if f.get("height", 0) > f.get("width", 0)
                ]
            else:
                preferred = [
                    f for f in mp4_files
                    if f.get("width", 0) >= f.get("height", 0)
                ]

            pool = preferred if preferred else mp4_files

            def long_edge(f):
                return max(f.get("width", 0), f.get("height", 0))

            hd_pool = [f for f in pool if long_edge(f) >= 1080]
            under_4k = [f for f in (hd_pool or pool) if long_edge(f) <= 1920]

            if under_4k:
                best = max(under_4k, key=lambda f: long_edge(f))
            elif hd_pool:
                best = min(hd_pool, key=lambda f: long_edge(f))
            else:
                best = max(pool, key=lambda f: long_edge(f))

            logging.info(
                f"[VideoService] Selected {best.get('width')}x"
                f"{best.get('height')} clip for '{keywords}'"
            )

            link = best.get("link", "")
            if not link:
                continue

            return link

        logging.warning(
            f"[VideoService] No unique video for '{keywords}' "
            f"(all {len(data.get('videos', []))} results already used)"
        )
        return None

    except Exception as e:
        logging.error(
            f"[VideoService] Pexels fetch failed for '{query}': {e}"
        )
        return None


async def download_scene_video_unique(
    scene,
    index,
    used_video_ids=None,
    timeout_seconds=20,
    orientation="portrait",
):
    used_video_ids = used_video_ids or set()
    description = scene.get("pexels_query") or scene.get("description", "")
    duration = scene.get("duration", 4)

    keywords = scene.get("visual_keywords") or []
    queries_to_try = [
        description,
        scene.get("description", description),
        keywords[0] if keywords else description,
    ]

    for attempt, query in enumerate(queries_to_try):
        try:
            video_url = await asyncio.wait_for(
                asyncio.to_thread(
                    get_video_unique,
                    query,
                    orientation,
                    scene.get("visual_keywords"),
                    used_video_ids,
                ),
                timeout=timeout_seconds,
            )
            if video_url:
                logging.info(
                    f"[VideoService] Scene {index + 1} unique clip found "
                    f"(attempt {attempt + 1}): {query}"
                )
                return video_url
        except Exception as exc:
            logging.warning(
                f"[VideoService] Scene {index + 1} attempt {attempt + 1} failed: {exc}"
            )

    return await asyncio.to_thread(create_placeholder_video, index, duration, orientation)


def create_placeholder_video(index, duration=4, orientation="portrait"):
    out_w, out_h = _dims(orientation)
    placeholder_path = str(FILES_DIR / f"placeholder_{index}.mp4")
    safe_duration = max(1.0, float(duration or 4))

    run_ffmpeg(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c=black:s={out_w}x{out_h}:r=24",
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-t", str(safe_duration),
            "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
            "-pix_fmt", "yuv420p", "-shortest",
            placeholder_path,
        ],
        stage_name=f"Placeholder {index + 1}",
    )
    return placeholder_path


async def download_scene_video(scene, index, timeout_seconds=20, orientation="portrait", used_urls=None):
    description = (
        scene.get("pexels_query")
        or scene.get("description", "")
    )
    duration = scene.get("duration", 4)

    try:
        video_url = await asyncio.wait_for(
            asyncio.to_thread(
                get_video,
                description,
                orientation,
                scene.get("visual_keywords"),
                used_urls,
            ),
            timeout=timeout_seconds,
        )
        if video_url:
            return video_url
        logging.warning(
            f"[VideoService] No remote video for scene {index + 1}; using placeholder"
        )
    except asyncio.TimeoutError:
        logging.warning(
            f"[VideoService] Timeout fetching scene {index + 1} after {timeout_seconds}s"
        )
    except Exception as exc:
        logging.error(f"[VideoService] Scene {index + 1} fetch failed: {exc}")

    return await asyncio.to_thread(create_placeholder_video, index, duration, orientation)


async def download_all_scenes(scenes, timeout_seconds=20, orientation="portrait"):
    started_at = time.perf_counter()
    results = []
    used_video_ids: set = set()

    for idx, scene in enumerate(scenes):
        result = await download_scene_video_unique(
            scene, idx,
            used_video_ids=used_video_ids,
            timeout_seconds=timeout_seconds,
            orientation=orientation,
        )
        # Extract Pexels video ID from URL to block all resolutions of same clip
        url = result if isinstance(result, str) else ""
        if url and "pexels.com" in url:
            parts = url.split("/")
            vid_id = next((p for p in parts if p.isdigit()), None)
            if vid_id:
                used_video_ids.add(vid_id)
        results.append(result)

    elapsed = time.perf_counter() - started_at
    logging.info(
        f"[VideoService] Downloaded {len(results)} sources in {elapsed:.1f}s"
    )
    return results


async def prepare_user_footage(asset_ids, scenes, orientation="portrait", timeout_seconds=20):
    """
    Build the per-scene video list using user-uploaded clips where available,
    falling back to Pexels for scenes that have no corresponding user clip.
    Returns the same shape as download_all_scenes: one source per scene.
    """
    started_at = time.perf_counter()

    # Resolve each asset_id → absolute local file path
    user_clips = []
    for asset_id in (asset_ids or []):
        pattern = str(FOOTAGE_TMP_DIR / "**" / f"{asset_id}_*")
        matches = _glob.glob(pattern, recursive=True)
        if matches:
            user_clips.append(matches[0])
            logging.info(f"[Upload] Resolved asset {asset_id} → {matches[0]}")
        else:
            logging.warning(f"[Upload] Asset {asset_id} not found on disk; skipping")

    # Assign clips to scenes; fall back to Pexels for scenes without a user clip
    sources = [None] * len(scenes)
    pexels_indices = []

    for i in range(len(scenes)):
        if i < len(user_clips):
            sources[i] = user_clips[i]
        else:
            pexels_indices.append(i)

    if pexels_indices:
        pexels_tasks = [
            download_scene_video(scenes[i], i, timeout_seconds=timeout_seconds, orientation=orientation)
            for i in pexels_indices
        ]
        pexels_results = await asyncio.gather(*pexels_tasks)
        for idx, result in zip(pexels_indices, pexels_results):
            sources[idx] = result

    elapsed = time.perf_counter() - started_at
    logging.info(
        f"[Upload] Prepared {len(user_clips)} user clip(s) + {len(pexels_indices)} Pexels clip(s) in {elapsed:.1f}s"
    )
    return sources


def probe_streams(path):
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_streams", "-of", "json", path],
            capture_output=True, text=True, check=True,
        )
        return json.loads(result.stdout).get("streams", [])
    except Exception as exc:
        logging.warning(f"[VideoService] probe failed for {path}: {exc}")
        return []


def _frame_rate_value(rate):
    if not rate or rate == "0/0":
        return 0.0
    if "/" in rate:
        num, den = rate.split("/", 1)
        try:
            return float(num) / float(den)
        except (TypeError, ValueError, ZeroDivisionError):
            return 0.0
    try:
        return float(rate)
    except (TypeError, ValueError):
        return 0.0


def is_normalized_clip(path, orientation="portrait"):
    out_w, out_h = _dims(orientation)
    streams = probe_streams(path)
    v = next((s for s in streams if s.get("codec_type") == "video"), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if not v or not a:
        return False
    video_ok = (
        v.get("codec_name") == "h264"
        and int(v.get("width") or 0) == out_w
        and int(v.get("height") or 0) == out_h
        and abs(_frame_rate_value(v.get("r_frame_rate")) - 24.0) < 0.1
    )
    audio_ok = (
        a.get("codec_name") == "aac"
        and int(a.get("sample_rate") or 0) == 44100
        and int(a.get("channels") or 0) == 2
    )
    return video_ok and audio_ok


def build_ken_burns_filter(duration, orientation="portrait", intensity="normal"):
    out_w, out_h = _dims(orientation)
    safe_duration = max(1.0, float(duration or 4))
    total_frames = max(24, int(round(safe_duration * 24)))
    sz = f"{out_w}x{out_h}"

    # Speed and max zoom vary by emotional intensity
    cfg = {
        "subtle": ("0.0004", "1.15"),
        "normal": ("0.0008", "1.30"),
        "strong": ("0.0015", "1.50"),
    }.get(intensity, ("0.0008", "1.30"))
    speed, max_zoom = cfg

    variants = [
        f"zoompan=z='min(zoom+{speed},{max_zoom})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={sz}:fps=24",
        f"zoompan=z='if(lte(zoom,1.0),{max_zoom},max(1.001,zoom-{speed}))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={total_frames}:s={sz}:fps=24",
        f"zoompan=z='1.12':x='iw-iw/zoom':y='ih/2-(ih/zoom/2)':d={total_frames}:s={sz}:fps=24",
        f"zoompan=z='1.12':x='0':y='ih/2-(ih/zoom/2)':d={total_frames}:s={sz}:fps=24",
    ]
    return random.choice(variants)


def get_lut_name_for_mood(mood):
    normalized = str(mood or "").strip().lower()
    warm = {"warm", "euphoric", "nostalgic", "romantic", "hopeful", "uplifting", "happy"}
    cold = {"cold", "tense", "mysterious", "dark", "suspenseful", "thriller"}
    if normalized in warm:
        return "cinematic_warm.cube"
    if normalized in cold:
        return "cinematic_cold.cube"
    return "cinematic_neutral.cube"


def escape_ffmpeg_filter_path(path):
    return Path(path).resolve().as_posix().replace(":", r"\:").replace("'", r"\'")


def get_video_duration(clip_path: str) -> float:
    """Return actual clip duration via ffprobe; falls back to 4.0 on error."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", clip_path],
            capture_output=True, text=True, timeout=10,
        )
        data = json.loads(result.stdout)
        return float(data["format"]["duration"])
    except Exception:
        return 4.0


def build_scene_filter(scene, out_w, out_h):
    beat_type = scene.get("beat_type", "build")

    base = (
        f"scale={out_w}:{out_h}:"
        f"force_original_aspect_ratio=increase,"
        f"crop={out_w}:{out_h},"
        f"setsar=1,"
        f"fps=24"
    )

    beat_color = {
        "quiet":   "eq=brightness=-0.05:contrast=1.1:saturation=0.85:gamma=1.0",
        "build":   "eq=brightness=0:contrast=1.2:saturation=0.95:gamma=0.95",
        "peak":    "eq=brightness=0.02:contrast=1.35:saturation=1.1:gamma=0.9",
        "resolve": "eq=brightness=-0.03:contrast=1.05:saturation=0.8:gamma=1.05",
    }
    color = beat_color.get(str(beat_type or "build").lower(), beat_color["build"])

    vignette = ""
    if beat_type in ("quiet", "resolve"):
        vignette = ",vignette=angle=PI/6:mode=forward"

    sharpen = ""
    if beat_type == "peak":
        sharpen = ",unsharp=lx=3:ly=3:la=0.5"

    return f"{base},{color}{vignette}{sharpen}"


def create_video(scenes, voice, music, sfx, mood=None, orientation="portrait", progress_callback=None, logo_path=None, outro_path=None, transition_style="auto", logo_position="top-right", logo_size="S", logo_timing="full"):
    logging.info(
        f"[Director] Mood='{mood}' | "
        f"LUT={get_lut_name_for_mood(mood)} | "
        f"Style='{transition_style}'"
    )
    out_w, out_h = _dims(orientation)

    def update_progress(pct, message=None):
        if progress_callback:
            progress_callback(pct, message)

    def stage_progress(base, span, pct, message=None):
        mapped = base + int((max(0, min(100, int(pct))) / 100) * span)
        update_progress(mapped, message)

    def parse_duration(value):
        try:
            return float(value)
        except (TypeError, ValueError):
            try:
                return float(str(value).strip())
            except Exception:
                return 0.0

    video_files = []
    total_clips = len(scenes) or 1

    for i, scene in enumerate(scenes):
        video_url = scene.get("video")
        if not video_url:
            continue

        filename = str(FILES_DIR / f"clip_{i}.mp4")
        duration = parse_duration(scene.get("duration", 4))

        # Download remote URLs to a local raw file first
        # FFmpeg processes local files much more reliably
        if str(video_url).startswith("http"):
            raw_path = str(FILES_DIR / f"raw_{i}.mp4")
            try:
                logging.info(
                    f"[VideoService] Downloading clip {i+1} to disk..."
                )
                r = requests.get(
                    video_url,
                    stream=True,
                    timeout=30,
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                r.raise_for_status()
                with open(raw_path, "wb") as fout:
                    for chunk in r.iter_content(chunk_size=1024*1024):
                        fout.write(chunk)
                logging.info(
                    f"[VideoService] Clip {i+1} downloaded: "
                    f"{os.path.getsize(raw_path)//1024}KB"
                )
                input_source = raw_path
            except Exception as dl_err:
                logging.warning(
                    f"[VideoService] Download failed for clip {i+1}: "
                    f"{dl_err} — using URL directly"
                )
                input_source = video_url
        else:
            # Already a local path (user footage)
            input_source = video_url

        vf = build_scene_filter(scene, out_w, out_h)

        try:
            run_ffmpeg(
                [
                    "ffmpeg", "-y",
                    "-i", input_source,
                    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                    "-t", str(duration),
                    "-vf", vf,
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                    "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k",
                    "-avoid_negative_ts", "make_zero",
                    "-pix_fmt", "yuv420p",
                    "-shortest",
                    filename,
                ],
                progress_callback=lambda pct, _msg=None: stage_progress(
                    60, 10, pct, f"Preparing clip {i + 1}/{total_clips}"
                ),
                stage_name=f"Clip {i + 1}/{total_clips}",
            )
        except Exception:
            if os.path.exists(filename) and os.path.getsize(filename) > 0:
                logging.warning(
                    f"[VideoService] FFmpeg returned non-zero for clip {i + 1}, "
                    "but the clip file exists; continuing"
                )
            else:
                raise

        # Clean up raw download after clip is processed
        if str(video_url).startswith("http"):
            try:
                os.remove(raw_path)
            except Exception:
                pass

        video_files.append(filename)
        update_progress(
            30 + int(((i + 1) / total_clips) * 20),
            f"Prepared clip {i + 1}/{total_clips}",
        )

    gc.collect()
    logging.info("[VideoService] GC collect after clip processing")

    if not video_files:
        return None

    temp_path = str(FILES_DIR / "temp.mp4")
    concat_list_path = str(FILES_DIR / "concat_sources.txt")
    all_normalized = all(is_normalized_clip(p, orientation) for p in video_files)

    if len(video_files) == 1 and all_normalized:
        with open(concat_list_path, "w", encoding="utf-8") as f:
            for p in video_files:
                escaped = Path(p).resolve().as_posix().replace("'", "'\\''")
                f.write(f"file '{escaped}'\n")

        run_ffmpeg(
            [
                "ffmpeg", "-y",
                "-f", "concat", "-safe", "0", "-i", concat_list_path,
                "-c", "copy", temp_path,
            ],
            progress_callback=lambda pct, _msg=None: stage_progress(
                50, 15, pct, "Concatenating clips"
            ),
            stage_name="Video concat",
        )

    elif len(video_files) >= 2:
        clip_durations = [get_video_duration(p) for p in video_files]
        # Build transition list from scene data where available
        style_transitions = get_transitions_for_style(
            transition_style or "auto",
            mood or "cinematic",
            len(video_files),
        )
        transitions = []
        for idx, scene in enumerate(scenes[:-1]):
            t_out = scene.get("transition_out", "")
            if t_out and t_out in TRANSITIONS:
                transitions.append(t_out)
                logging.info(
                    f"[Director] Scene {idx+1} "
                    f"transition_out='{t_out}' (from script)"
                )
            else:
                transitions.append(
                    style_transitions[idx]
                    if idx < len(style_transitions)
                    else "fade"
                )

        transitions = transitions[:len(video_files) - 1]
        logging.info(f"[Director] Final transitions: {transitions}")
        logging.info(
            f"[Transitions] mood='{mood}' style='{transition_style}' → {transitions}"
        )

        inputs, filter_parts, out_label = build_transition_filter(
            clip_paths=video_files,
            clip_durations=clip_durations,
            transitions=transitions,
            width=out_w,
            height=out_h,
        )

        # Convert pixel format — no tpad so the last clip plays to its natural end
        filter_parts.append(f"{out_label}format=yuv420p[v]")
        logging.info("[VideoService] Removed tpad — last clip will play to natural end")

        run_ffmpeg(
            [
                "ffmpeg", "-y",
                *inputs,
                "-filter_complex", ";".join(filter_parts),
                "-map", "[v]",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-pix_fmt", "yuv420p",
                temp_path,
            ],
            progress_callback=lambda pct, _msg=None: stage_progress(
                50, 15, pct, "Applying scene transitions"
            ),
            stage_name="Video transitions",
        )

    else:
        inputs = []
        fc = ""
        for idx, p in enumerate(video_files):
            inputs += ["-i", p]
            fc += f"[{idx}:v]scale={out_w}:{out_h},setsar=1[v{idx}];"
        fc += "".join(f"[v{idx}]" for idx in range(len(video_files)))
        fc += f"concat=n={len(video_files)}:v=1:a=0[v]"

        run_ffmpeg(
            [
                "ffmpeg", "-y",
                *inputs,
                "-filter_complex", fc,
                "-map", "[v]",
                temp_path,
            ],
            progress_callback=lambda pct, _msg=None: stage_progress(
                50, 15, pct, "Concatenating clips"
            ),
            stage_name="Video concat",
        )

    logging.info(f"[VideoService] temp.mp4 created at {temp_path}")
    if not os.path.exists(temp_path):
        raise Exception("temp.mp4 was not created")

    # Delete per-scene clip files now that they're assembled into temp.mp4
    for clip_f in video_files:
        try:
            if os.path.exists(clip_f):
                os.remove(clip_f)
        except Exception:
            pass
    gc.collect()
    logging.info("[VideoService] Cleaned up per-scene clip files")

    update_progress(65, "Clips assembled")

    # Use actual rendered duration so audio is cut precisely to video length
    actual_video_duration = get_video_duration(temp_path)
    logging.info(
        f"[AudioService] Actual video duration: {actual_video_duration:.2f}s"
    )

    # Ensure the video is long enough to cover the full narration + a 1.5s peaceful tail.
    # Transitions shorten the assembled video (clips overlap), so the video can end
    # mid-sentence when narration is dense. We freeze the last frame for however many
    # seconds are needed so the voice always finishes before the picture cuts out.
    NARRATION_TAIL = 1.5
    if voice and os.path.exists(str(voice)):
        voice_duration = get_video_duration(str(voice))
        target_duration = voice_duration + NARRATION_TAIL
        if target_duration > actual_video_duration + 0.05:
            pad_secs = target_duration - actual_video_duration
            extended_temp = str(FILES_DIR / "temp_extended.mp4")
            logging.info(
                f"[VideoService] Video ({actual_video_duration:.2f}s) shorter than "
                f"narration+tail ({target_duration:.2f}s); extending last frame by {pad_secs:.2f}s"
            )
            try:
                run_ffmpeg(
                    [
                        "ffmpeg", "-y",
                        "-i", temp_path,
                        "-vf", f"tpad=stop_mode=clone:stop_duration={pad_secs:.3f}",
                        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                        "-pix_fmt", "yuv420p",
                        extended_temp,
                    ],
                    stage_name="Extend video for narration",
                )
                if os.path.exists(extended_temp) and os.path.getsize(extended_temp) > 0:
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass
                    temp_path = extended_temp
                    actual_video_duration = get_video_duration(temp_path)
                    logging.info(
                        f"[VideoService] Extended to {actual_video_duration:.2f}s — "
                        "narration will be fully audible"
                    )
                else:
                    logging.warning("[VideoService] tpad extension failed; using original temp.mp4")
            except Exception as ext_err:
                logging.error(f"[VideoService] Video extension failed: {ext_err}; using original duration")

    if not music:
        fallback_dir = Path(__file__).resolve().parent.parent / "music"
        fallback_tracks = sorted(fallback_dir.glob("*.mp3"))
        if fallback_tracks:
            music = str(fallback_tracks[0])

    # Mood-matched music volume levels
    MOOD_MUSIC_VOL = {
        "dark": 0.30, "tense": 0.28, "mysterious": 0.28,
        "epic": 0.35, "cinematic": 0.30, "emotional": 0.20,
        "calm": 0.22, "serene": 0.20, "happy": 0.30,
        "uplifting": 0.32, "thriller": 0.28,
        "intense": 0.32, "dramatic": 0.28,
    }
    music_vol = MOOD_MUSIC_VOL.get(
        str(mood or "cinematic").lower(), 0.25
    )
    fade_out_start = max(actual_video_duration - 3, 1)

    # Random start offset so same track sounds different each time
    music_start = random.uniform(5, 20)

    audio_inputs = [
        "-ss", str(music_start),
        "-i", music,
        "-i", voice,
    ]

    # Music: volume + fade in over 2s + fade out last 3s
    music_filter = (
        f"[0:a]"
        f"volume={music_vol},"
        f"afade=t=in:st=0:d=2,"
        f"afade=t=out:st={fade_out_start:.2f}:d=3"
        f"[music_raw]"
    )
    # Voice: split — one copy for sidechain, one for mix
    # No apad needed — scene durations are set to match voice length
    voice_filter = "[1:a]volume=1.0,asplit=2[voice_raw][voice_mix]"
    # Sidechain compress: music ducks when voice is present
    duck_filter = (
        "[music_raw][voice_raw]"
        "sidechaincompress="
        "threshold=0.02:"
        "ratio=4:"
        "attack=200:"
        "release=1000:"
        "level_sc=0.8"
        "[music_ducked]"
    )

    filter_parts = [music_filter, voice_filter, duck_filter]
    mix_inputs = "[voice_mix][music_ducked]"
    num_inputs = 2

    if sfx:
        audio_inputs += ["-i", sfx]
        filter_parts.append("[2:a]volume=0.12[s]")
        mix_inputs += "[s]"
        num_inputs = 3

    filter_complex = (
        ";".join(filter_parts)
        + f";{mix_inputs}amix=inputs={num_inputs}:"
          f"duration=longest:normalize=0[a]"
    )

    update_progress(66, "Mixing audio")

    run_ffmpeg(
        [
            "ffmpeg", "-y",
            "-stream_loop", "-1",
            *audio_inputs,
            "-filter_complex", filter_complex,
            "-map", "[a]",
            "-t", str(actual_video_duration),
            str(FILES_DIR / "audio.mp3"),
        ],
        progress_callback=lambda pct, _msg=None: stage_progress(
            66, 14, pct, "Mixing audio"
        ),
        stage_name="Audio mix",
    )
    gc.collect()
    logging.info("[VideoService] GC collect after audio mix")

    output = str((FILES_DIR / f"final_{int(time.time())}.mp4").resolve())
    audio_path = str(FILES_DIR / "audio.mp3")

    selected_lut = LUTS_DIR / get_lut_name_for_mood(mood)
    video_filters = []
    if selected_lut.exists() and selected_lut.stat().st_size > 1000:
        escaped_lut = escape_ffmpeg_filter_path(str(selected_lut))
        video_filters.append(f"lut3d='{escaped_lut}'")
        logging.info(f"[VideoService] Applying LUT: {selected_lut.name}")
    elif selected_lut.exists():
        logging.warning(
            f"[VideoService] LUT file too small "
            f"({selected_lut.stat().st_size}b) — skipping color grade"
        )

    GRAIN_MOODS = {
        "dark", "tense", "mysterious", "thriller",
        "dramatic", "suspenseful",
    }
    mood_lower = str(mood or "").lower()
    if mood_lower in GRAIN_MOODS:
        video_filters.append(
            "geq=lum='lum(X,Y)+8*random(1)'"
            ":cb='cb(X,Y)'"
            ":cr='cr(X,Y)'"
        )
        logging.info(f"[VideoService] Film grain applied for mood '{mood}'")

    update_progress(80, "Rendering final video")

    final_cmd = ["ffmpeg", "-y", "-threads", "1", "-i", temp_path, "-i", audio_path]
    if video_filters:
        final_cmd += ["-vf", ",".join(video_filters)]
    final_cmd += [
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
        "-profile:v", "high", "-level", "4.1",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
        output,
    ]

    run_ffmpeg(
        final_cmd,
        progress_callback=lambda pct, _msg=None: stage_progress(
            80, 12, pct, "Rendering final video"
        ),
        stage_name="Final render",
    )
    gc.collect()
    logging.info("[VideoService] GC collect after final render")

    # Logo watermark overlay
    if logo_path and os.path.exists(logo_path):
        update_progress(92, "Applying brand watermark")
        branded = str((FILES_DIR / f"branded_{int(time.time())}.mp4").resolve())

        # Scale logo to % of video width (not % of its own width)
        size_ratio = {'S': 0.06, 'M': 0.10, 'L': 0.15}.get(logo_size or 'S', 0.06)
        logo_w = int(out_w * size_ratio)
        if logo_w % 2 != 0:
            logo_w += 1

        # x, y overlay position expressions
        pos_map = {
            'top-left':      ('20',         '20'),
            'top-center':    ('(W-w)/2',    '20'),
            'top-right':     ('W-w-20',     '20'),
            'center-left':   ('20',         '(H-h)/2'),
            'center':        ('(W-w)/2',    '(H-h)/2'),
            'center-right':  ('W-w-20',     '(H-h)/2'),
            'bottom-left':   ('20',         'H-h-20'),
            'bottom-center': ('(W-w)/2',    'H-h-20'),
            'bottom-right':  ('W-w-20',     'H-h-20'),
        }
        px, py = pos_map.get(logo_position or 'top-right', ('W-w-20', '20'))

        vid_dur = get_video_duration(output)
        timing = logo_timing or 'full'

        # Keep the filter intentionally simple — fancy fade chains break silently
        # on many FFmpeg builds; plain scale+overlay is universally reliable.
        if timing == 'end-only':
            logo_start = max(0.0, vid_dur - 4.5)
            logo_w_big = int(out_w * 0.20)
            if logo_w_big % 2 != 0:
                logo_w_big += 1
            filter_str = (
                f"[1:v]scale={logo_w_big}:-1[logo_e];"
                f"[0:v][logo_e]overlay=(W-w)/2:(H-h)/2:"
                f"enable='gte(t,{logo_start:.2f})':format=auto[v]"
            )
        elif timing == 'start-only':
            show_until = min(vid_dur, 4.0)
            filter_str = (
                f"[1:v]scale={logo_w}:-1[logo_s];"
                f"[0:v][logo_s]overlay={px}:{py}:"
                f"enable='between(t,0,{show_until:.2f})':format=auto[v]"
            )
        else:  # 'full'
            filter_str = (
                f"[1:v]scale={logo_w}:-1[logo_f];"
                f"[0:v][logo_f]overlay={px}:{py}:format=auto[v]"
            )

        try:
            run_ffmpeg(
                [
                    "ffmpeg", "-y",
                    "-i", output,
                    "-i", logo_path,
                    "-filter_complex", filter_str,
                    "-map", "[v]", "-map", "0:a:0",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "26",
                    "-c:a", "copy",
                    "-movflags", "+faststart",
                    branded,
                ],
                progress_callback=None,
                stage_name="Logo overlay",
            )
        except Exception as logo_exc:
            logging.error(f"[Logo] Overlay failed ({logo_exc}); returning unbranded video")

        if os.path.exists(branded) and os.path.getsize(branded) > 0:
            try:
                os.remove(output)
            except Exception:
                pass
            output = branded
            logging.info("[Logo] Branded video applied successfully")
        else:
            logging.warning("[Logo] Branded file not created; using unbranded video")

    # Outro concat
    if outro_path and os.path.exists(outro_path):
        update_progress(95, "Appending outro")
        outro_scaled = str((FILES_DIR / f"outro_scaled_{int(time.time())}.mp4").resolve())
        run_ffmpeg(
            [
                "ffmpeg", "-y",
                "-i", outro_path,
                "-vf", f"scale={out_w}:{out_h}:force_original_aspect_ratio=increase,crop={out_w}:{out_h},setsar=1",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-c:a", "aac", "-ar", "44100", "-ac", "2",
                outro_scaled,
            ],
            progress_callback=None,
            stage_name="Scale outro",
        )
        if os.path.exists(outro_scaled):
            concat_output = str((FILES_DIR / f"final_with_outro_{int(time.time())}.mp4").resolve())
            outro_concat_txt = str(FILES_DIR / "outro_concat.txt")
            with open(outro_concat_txt, "w", encoding="utf-8") as f:
                for p in [output, outro_scaled]:
                    escaped = Path(p).resolve().as_posix().replace("'", "'\\''")
                    f.write(f"file '{escaped}'\n")
            run_ffmpeg(
                [
                    "ffmpeg", "-y",
                    "-f", "concat", "-safe", "0", "-i", outro_concat_txt,
                    "-c", "copy",
                    concat_output,
                ],
                progress_callback=None,
                stage_name="Outro concat",
            )
            if os.path.exists(concat_output):
                try:
                    os.remove(output)
                    os.remove(outro_scaled)
                except Exception:
                    pass
                output = concat_output

    update_progress(100, "Final video ready")
    return output
