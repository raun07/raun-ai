import requests
import os
from pathlib import Path

FILES_DIR = Path(__file__).resolve().parent.parent / "files"


def safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        try:
            return float(str(value).strip())
        except Exception:
            return 0.0


def clean_json(raw):
    start = raw.find("{")
    end = raw.rfind("}") + 1
    return raw[start:end]


def download_file(url, filename):
    # If it's already a local file, copy it instead of downloading
    try:
        source = Path(url)
        if source.exists() and source.is_file():
            import shutil
            shutil.copy2(str(source), filename)
            return filename
    except (TypeError, ValueError, OSError):
        pass

    # Remote URL
    try:
        r = requests.get(url, timeout=30)
        if r.status_code != 200:
            return None
        with open(filename, "wb") as f:
            f.write(r.content)
        return filename
    except Exception:
        return None


def create_subtitles(scenes):
    srt = ""
    current_time = 0

    for i, scene in enumerate(scenes):
        duration = safe_float(scene.get("duration", 4))
        start = current_time
        end = current_time + duration

        srt += f"{i + 1}\n"
        srt += f"{format_time(start)} --> {format_time(end)}\n"
        srt += f"{scene['description'].upper()}\n\n"

        current_time = end

    subtitle_path = FILES_DIR / "subtitles.srt"

    with open(subtitle_path, "w", encoding="utf-8") as f:
        f.write(srt)

    return str(subtitle_path.resolve())


def format_time(seconds):
    try:
        seconds = float(seconds)
    except (TypeError, ValueError):
        seconds = 0.0

    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"
