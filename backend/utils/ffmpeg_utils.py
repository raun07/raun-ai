import os
import subprocess, logging, re


def _timestamp_to_seconds(parts):
    if not parts or len(parts) < 3:
        return 0.0

    try:
        hours = int(float(parts[0]))
    except (TypeError, ValueError, IndexError):
        hours = 0

    try:
        minutes = int(float(parts[1]))
    except (TypeError, ValueError, IndexError):
        minutes = 0

    try:
        seconds = float(parts[2])
    except (TypeError, ValueError, IndexError):
        seconds = 0.0

    return hours * 3600 + minutes * 60 + seconds


def run_ffmpeg(cmd, progress_callback=None, stage_name="FFmpeg", cwd=None):
    output_path = cmd[-1] if cmd else None

    if progress_callback is None:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)
        if result.returncode != 0:
            if (
                output_path
                and os.path.exists(output_path)
                and os.path.getsize(output_path) > 0
            ):
                logging.warning(
                    f"{stage_name} returned {result.returncode}, "
                    "but the output file exists; continuing"
                )
                return
            logging.error(f"FFmpeg command failed: {' '.join(cmd)}")
            logging.error(f"FFmpeg stderr: {result.stderr}")
            raise Exception(f"FFmpeg failed: {result.stderr}")
        return

    duration = None
    last_progress = 0
    stderr_lines = []
    duration_pattern = re.compile(r"Duration: (\d+):(\d+):(\d+\.\d+)")
    time_pattern = re.compile(r"time=(\d+):(\d+):(\d+\.\d+)")

    process = subprocess.Popen(
        cmd,
        stderr=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        text=True,
        bufsize=1,
        cwd=cwd,
    )

    assert process.stderr is not None
    for raw_line in process.stderr:
        line = raw_line.strip()
        if not line:
            continue

        logging.debug(line)
        stderr_lines.append(line)
        if len(stderr_lines) > 80:
            stderr_lines.pop(0)

        if duration is None:
            duration_match = duration_pattern.search(line)
            if duration_match:
                duration = _timestamp_to_seconds(duration_match.groups())

        time_match = time_pattern.search(line)
        if duration and time_match:
            current = _timestamp_to_seconds(time_match.groups())
            progress = int(min(99, (current / duration) * 100))
            if progress > last_progress and progress - last_progress >= 2:
                last_progress = progress
                progress_callback(progress, f"{stage_name} {progress}%")

    process.wait()
    if process.returncode != 0:
        stderr_tail = "\n".join(stderr_lines[-20:])
        if (
            output_path
            and os.path.exists(output_path)
            and os.path.getsize(output_path) > 0
        ):
            logging.warning(
                f"{stage_name} returned {process.returncode}, "
                "but the output file exists; continuing"
            )
            if progress_callback:
                progress_callback(100, f"{stage_name} complete")
            return
        logging.error(f"FFmpeg command failed: {' '.join(cmd)}")
        if stderr_tail:
            logging.error(f"FFmpeg stderr tail:\n{stderr_tail}")
        raise Exception(
            f"FFmpeg failed with return code {process.returncode}"
            + (f": {stderr_tail}" if stderr_tail else "")
        )
    if progress_callback:
        progress_callback(100, f"{stage_name} complete")
