import logging
from pathlib import Path

FILES_DIR = Path(__file__).resolve().parent.parent / "files"


def _safe_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        try:
            return float(str(value).strip())
        except Exception:
            return 0.0


def _format_ass_time(seconds):
    total_seconds = max(0.0, float(seconds or 0.0))
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    secs = total_seconds % 60
    return f"{hours:d}:{minutes:02d}:{secs:05.2f}"


def _escape_ass_text(text):
    normalized = str(text or "").replace("\r", " ").replace("\n", "\\N").strip()
    return normalized.replace("{", r"\{").replace("}", r"\}")


def wrap_subtitle_text(text: str, max_chars_per_line: int = 35) -> str:
    """
    Wraps subtitle text to max 2 lines of max_chars_per_line each.
    Splits at nearest word boundary before the character limit.
    Returns text with \\N as the line break (ASS format newline).
    Never returns more than 2 lines.
    """
    text = text.strip()

    if len(text) <= max_chars_per_line:
        return text

    split_at = text.rfind(" ", 0, max_chars_per_line)
    if split_at == -1:
        split_at = max_chars_per_line

    line1 = text[:split_at].strip()
    line2 = text[split_at:].strip()

    if len(line2) > max_chars_per_line:
        line2 = line2[: max_chars_per_line - 3].rsplit(" ", 1)[0] + "..."

    return f"{line1}\\N{line2}"


def create_ass_subtitles(
    scenes,
    output_name="subtitles.ass",
    orientation="portrait",
    voice_durations=None,
):
    subtitle_path = FILES_DIR / output_name

    is_landscape = str(orientation or "portrait").strip().lower() == "landscape"
    font_size = 16 if is_landscape else 18
    margin_v = 50 if is_landscape else 60

    style_line = (
        f"Style: Default,Arial,{font_size},"
        "&H00FFFFFF,&H000000FF,&H00000000,&H99000000,"
        f"-1,0,0,0,100,100,0,0,1,2,1,2,10,10,{margin_v},1"
    )

    current_time = 0.0
    dialogue_lines = []

    for i, scene in enumerate(scenes or []):
        # Get actual voice duration or fall back to scene duration
        if (voice_durations
                and i < len(voice_durations)
                and voice_durations[i] > 0.3):
            duration = float(voice_durations[i])
        else:
            duration = max(_safe_float(scene.get("duration", 4)), 0.5)

        raw_text = scene.get("narration") or scene.get("description", "")
        words = str(raw_text or "").strip().split()

        if not words:
            current_time += duration
            continue

        # Split narration into natural phrase chunks of 4-6 words
        # This matches natural speech rhythm at ~3 words/second
        WORDS_PER_CHUNK = 5
        chunks = []
        for j in range(0, len(words), WORDS_PER_CHUNK):
            chunk = " ".join(words[j:j + WORDS_PER_CHUNK])
            if chunk.strip():
                chunks.append(chunk)

        if not chunks:
            current_time += duration
            continue

        logging.info(
            f"[Subtitle] Scene {i+1}: {len(chunks)} chunks "
            f"over {duration:.2f}s — "
            f"{[len(c.split()) for c in chunks]} words each"
        )

        # Distribute time across chunks proportionally by word count.
        # Proportional share sums exactly to available_time — no clamp,
        # which would cause overflow and push later scenes out of sync.
        total_words = len(words)
        available_time = max(duration - 0.1, duration * 0.95)

        chunk_start = current_time
        for chunk in chunks:
            chunk_words = len(chunk.split())
            chunk_duration = (chunk_words / total_words) * available_time

            chunk_end = chunk_start + chunk_duration

            wrapped = wrap_subtitle_text(chunk, max_chars_per_line=35)
            escaped = _escape_ass_text(wrapped)

            if escaped:
                dialogue_lines.append(
                    f"Dialogue: 0,"
                    f"{_format_ass_time(chunk_start)},"
                    f"{_format_ass_time(chunk_end)},"
                    f"Default,,0,0,0,"
                    f"{{\\an2}}{escaped}"
                )

            chunk_start = chunk_end

        current_time += duration

    ass_content = "\n".join(
        [
            "[Script Info]",
            "Title: Prompt-to-Reel Subtitles",
            "ScriptType: v4.00+",
            "WrapStyle: 2",
            "ScaledBorderAndShadow: yes",
            "YCbCr Matrix: TV.709",
            "",
            "[V4+ Styles]",
            "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,"
            "OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,"
            "ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,"
            "Alignment,MarginL,MarginR,MarginV,Encoding",
            style_line,
            "",
            "[Events]",
            "Format: Layer,Start,End,Style,Name,"
            "MarginL,MarginR,MarginV,Effect,Text",
            *dialogue_lines,
            "",
        ]
    )

    subtitle_path.write_text(ass_content, encoding="utf-8")

    logging.info(
        f"[Subtitle] Written {subtitle_path.name} — "
        f"{subtitle_path.stat().st_size} bytes, "
        f"{len(dialogue_lines)} dialogue blocks"
    )

    return str(subtitle_path.resolve())
