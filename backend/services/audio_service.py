import os
import logging
import edge_tts
from pydub import AudioSegment
from pathlib import Path

FILES_DIR = Path(__file__).resolve().parent.parent / "files"
MUSIC_DIR = Path(__file__).resolve().parent.parent / "music"

# Map every mood the script generator can produce to a local track
MOOD_TO_TRACK = {
    # warm / positive
    "happy":        "happy.mp3",
    "uplifting":    "happy.mp3",
    "euphoric":     "happy.mp3",
    "hopeful":      "happy.mp3",
    "warm":         "happy.mp3",
    # emotional / inspiring
    "emotional":    "emotional.mp3",
    "inspiring":    "emotional.mp3",
    "motivational": "emotional.mp3",
    "romantic":     "emotional.mp3",
    "nostalgic":    "emotional.mp3",
    "melancholic":  "emotional.mp3",
    # calm / serene
    "calm":         "calm.mp3",
    "serene":       "calm.mp3",
    "peaceful":     "calm.mp3",
    "soft":         "calm.mp3",
    "dreamy":       "calm.mp3",
    # dark / tense
    "dark":         "dark.mp3",
    "tense":        "dark.mp3",
    "mysterious":   "dark.mp3",
    "suspenseful":  "dark.mp3",
    "thriller":     "dark.mp3",
    "dramatic":     "dark.mp3",
    "horror":       "dark.mp3",
    "intense":      "dark.mp3",
    # epic / cinematic
    "cinematic":    "cinematic.mp3",
    "epic":         "cinematic.mp3",
    "documentary":  "cinematic.mp3",
    "neutral":      "cinematic.mp3",
}


MOOD_ALTERNATES = {
    "cinematic": ["cinematic.mp3", "emotional.mp3"],
    "epic":      ["cinematic.mp3", "dark.mp3"],
    "dramatic":  ["dark.mp3", "emotional.mp3"],
    "nostalgic": ["emotional.mp3", "calm.mp3"],
    "inspiring": ["emotional.mp3", "cinematic.mp3"],
}


def get_music(mood, job_id=None, music_seed=0):
    """Return path to mood-matched music track.

    When music_seed is nonzero (e.g. user requested a music change), pick from
    the full track library using the seed so the result is always different from
    the default mood pick.  seed=0 keeps the original mood-based behaviour.
    """
    normalized = str(mood or "cinematic").strip().lower()
    available = sorted(MUSIC_DIR.glob("*.mp3"))

    if music_seed and available:
        # Prefer a track that is NOT the primary mood track so it sounds different.
        primary = MOOD_TO_TRACK.get(normalized, "cinematic.mp3")
        alternate_pool = [t for t in available if t.name != primary]
        pool = alternate_pool if alternate_pool else available
        idx = int(music_seed) % len(pool)
        chosen = pool[idx]
        logging.info(f"[AudioService] Music (seeded change, seed={music_seed}): {chosen.name}")
        return str(chosen)

    track_name = MOOD_TO_TRACK.get(normalized, "cinematic.mp3")

    if job_id and normalized in MOOD_ALTERNATES:
        alternates = MOOD_ALTERNATES[normalized]
        idx = ord(str(job_id)[-1]) % len(alternates)
        track_name = alternates[idx]

    track_path = MUSIC_DIR / track_name
    if track_path.exists():
        logging.info(f"[AudioService] Music: {track_name} (mood='{mood}')")
        return str(track_path)

    if available:
        if job_id:
            idx = ord(str(job_id)[-1]) % len(available)
            fallback = available[idx]
        else:
            fallback = available[0]
        logging.warning(
            f"[AudioService] Track '{track_name}' missing, using: {fallback.name}"
        )
        return str(fallback)

    logging.error("[AudioService] No local music tracks found")
    return None


def get_sfx():
    """SFX is optional — return None so the mixer silently skips it."""
    return None


def pace_narration_text(text):
    normalized_text = str(text or "").strip()
    if not normalized_text:
        return normalized_text
    return normalized_text.replace(". ", ". ... ")


async def generate_scene_voices(scenes, progress_callback=None):
    voice_files = []
    total = len(scenes) or 1

    for i, scene in enumerate(scenes):
        filename = str(FILES_DIR / f"voice_{i}.mp3")
        narration_text = pace_narration_text(
            scene.get("narration") or scene.get("description", "")
        )

        communicate = edge_tts.Communicate(
            narration_text, voice="en-US-AriaNeural", rate="-10%"
        )
        await communicate.save(filename)
        voice_files.append(filename)

        if progress_callback:
            progress_callback(
                35 + int(((i + 1) / total) * 10),
                f"Generating voice {i + 1}/{total}",
            )

    return voice_files


def merge_voices(voice_files, progress_callback=None):
    logging.info(f"Voice files: {voice_files}")

    sanitized = []
    for vf in voice_files or []:
        if not vf:
            continue
        if not os.path.exists(vf):
            logging.warning(f"[AudioService] Missing voice file: {vf}")
            continue
        sanitized.append(vf)

    if not sanitized:
        raise Exception("No voice files generated")

    if progress_callback:
        progress_callback(50, "Merging voice clips")

    merged = AudioSegment.empty()
    for idx, vf in enumerate(sanitized, start=1):
        logging.info(f"[AudioService] Appending voice {idx}/{len(sanitized)}: {vf}")
        merged += AudioSegment.from_file(vf)

    output_path = str(FILES_DIR / "voice_full.mp3")
    merged.export(output_path, format="mp3")

    if progress_callback:
        progress_callback(55, "Voice merge complete")

    return output_path


def get_audio_duration_seconds(audio_file_path: str) -> float:
    """Returns actual MP3 duration in seconds using pydub."""
    try:
        audio = AudioSegment.from_file(str(audio_file_path))
        return len(audio) / 1000.0
    except Exception as e:
        logging.warning(
            f"[AudioService] Cannot read duration "
            f"of {audio_file_path}: {e}"
        )
        return 0.0
