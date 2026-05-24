"""
Cinematic transition library for Prompt-to-Reel.
All transitions are implemented using FFmpeg filter_complex only — no external libraries.
"""

TRANSITIONS = {
    # ── GROUP 1: FADE ──────────────────────────────────────────────────────────
    "fade": {
        "name": "Cross Fade", "xfade_name": "fade", "custom": False,
        "duration": 0.5, "moods": ["calm", "emotional", "serene"],
    },
    "fadeblack": {
        "name": "Fade to Black", "xfade_name": "fadeblack", "custom": False,
        "duration": 0.6, "moods": ["dark", "mysterious", "tense"],
    },
    "fadewhite": {
        "name": "Fade to White", "xfade_name": "fadewhite", "custom": False,
        "duration": 0.5, "moods": ["calm", "happy", "uplifting"],
    },
    "fadegrays": {
        "name": "Fade to Gray", "xfade_name": "fadegrays", "custom": False,
        "duration": 0.5, "moods": ["emotional", "nostalgic"],
    },

    # ── GROUP 2: WIPE ──────────────────────────────────────────────────────────
    "wipeleft": {
        "name": "Wipe Left", "xfade_name": "wipeleft", "custom": False,
        "duration": 0.4, "moods": ["cinematic", "action", "epic"],
    },
    "wiperight": {
        "name": "Wipe Right", "xfade_name": "wiperight", "custom": False,
        "duration": 0.4, "moods": ["cinematic", "action", "epic"],
    },
    "wipeup": {
        "name": "Wipe Up", "xfade_name": "wipeup", "custom": False,
        "duration": 0.4, "moods": ["uplifting", "happy", "euphoric"],
    },
    "wipedown": {
        "name": "Wipe Down", "xfade_name": "wipedown", "custom": False,
        "duration": 0.4, "moods": ["dark", "tense", "mysterious"],
    },
    "wipetl": {
        "name": "Wipe Top-Left", "xfade_name": "wipetl", "custom": False,
        "duration": 0.45, "moods": ["cinematic", "epic"],
    },
    "wipetr": {
        "name": "Wipe Top-Right", "xfade_name": "wipetr", "custom": False,
        "duration": 0.45, "moods": ["cinematic", "epic"],
    },
    "wipebl": {
        "name": "Wipe Bottom-Left", "xfade_name": "wipebl", "custom": False,
        "duration": 0.45, "moods": ["action", "tense"],
    },
    "wipebr": {
        "name": "Wipe Bottom-Right", "xfade_name": "wipebr", "custom": False,
        "duration": 0.45, "moods": ["action", "tense"],
    },

    # ── GROUP 3: SLIDE ─────────────────────────────────────────────────────────
    "slideleft": {
        "name": "Slide Left", "xfade_name": "slideleft", "custom": False,
        "duration": 0.45, "moods": ["cinematic", "travel", "uplifting"],
    },
    "slideright": {
        "name": "Slide Right", "xfade_name": "slideright", "custom": False,
        "duration": 0.45, "moods": ["cinematic", "travel", "uplifting"],
    },
    "slideup": {
        "name": "Slide Up", "xfade_name": "slideup", "custom": False,
        "duration": 0.45, "moods": ["epic", "motivational", "action"],
    },
    "slidedown": {
        "name": "Slide Down", "xfade_name": "slidedown", "custom": False,
        "duration": 0.45, "moods": ["emotional", "calm", "serene"],
    },

    # ── GROUP 4: ZOOM ──────────────────────────────────────────────────────────
    "zoomin": {
        "name": "Zoom In", "xfade_name": "zoomin", "custom": False,
        "duration": 0.5, "moods": ["epic", "cinematic", "action"],
    },
    "smoothup": {
        "name": "Smooth Up", "xfade_name": "smoothup", "custom": False,
        "duration": 0.5, "moods": ["uplifting", "happy", "euphoric"],
    },
    "smoothleft": {
        "name": "Smooth Left", "xfade_name": "smoothleft", "custom": False,
        "duration": 0.5, "moods": ["cinematic", "travel"],
    },

    # ── GROUP 5: GLITCH / DISTORTION ──────────────────────────────────────────
    "pixelize": {
        "name": "Pixelize", "xfade_name": "pixelize", "custom": False,
        "duration": 0.4, "moods": ["dark", "mysterious", "tense", "action"],
    },
    "diagtl": {
        "name": "Diagonal TL", "xfade_name": "diagtl", "custom": False,
        "duration": 0.4, "moods": ["action", "epic", "cinematic"],
    },
    "diagtr": {
        "name": "Diagonal TR", "xfade_name": "diagtr", "custom": False,
        "duration": 0.4, "moods": ["action", "epic"],
    },
    "diagbl": {
        "name": "Diagonal BL", "xfade_name": "diagbl", "custom": False,
        "duration": 0.4, "moods": ["dark", "tense"],
    },
    "diagbr": {
        "name": "Diagonal BR", "xfade_name": "diagbr", "custom": False,
        "duration": 0.4, "moods": ["dark", "mysterious"],
    },

    # ── GROUP 6: CINEMATIC CUTS ────────────────────────────────────────────────
    "dissolve": {
        "name": "Dissolve", "xfade_name": "dissolve", "custom": False,
        "duration": 0.6, "moods": ["emotional", "nostalgic", "calm"],
    },
    "circleopen": {
        "name": "Circle Open", "xfade_name": "circleopen", "custom": False,
        "duration": 0.5, "moods": ["happy", "uplifting", "euphoric"],
    },
    "circleclose": {
        "name": "Circle Close", "xfade_name": "circleclose", "custom": False,
        "duration": 0.5, "moods": ["dark", "mysterious", "emotional"],
    },
    "radial": {
        "name": "Radial", "xfade_name": "radial", "custom": False,
        "duration": 0.5, "moods": ["epic", "cinematic", "action"],
    },
    "hblur": {
        "name": "Horizontal Blur", "xfade_name": "hblur", "custom": False,
        "duration": 0.5, "moods": ["dreamy", "calm", "emotional"],
    },
    "squeezeh": {
        "name": "Squeeze Horizontal", "xfade_name": "squeezeh", "custom": False,
        "duration": 0.4, "moods": ["action", "epic", "tense"],
    },
    "squeezev": {
        "name": "Squeeze Vertical", "xfade_name": "squeezev", "custom": False,
        "duration": 0.4, "moods": ["action", "cinematic"],
    },

    # ── GROUP 7: CUSTOM TRANSITIONS ────────────────────────────────────────────
    # Implemented as xfade variants in filter_complex for chained compatibility.
    "flash": {
        "name": "Camera Flash", "xfade_name": "fadewhite", "custom": True,
        "duration": 0.3, "moods": ["action", "epic", "tense"],
    },
    "glitch": {
        "name": "Digital Glitch", "xfade_name": "pixelize", "custom": True,
        "duration": 0.3, "moods": ["dark", "tense", "mysterious", "action"],
    },
    "zoom_punch": {
        "name": "Zoom Punch", "xfade_name": "zoomin", "custom": True,
        "duration": 0.4, "moods": ["action", "epic", "motivational"],
    },
    "film_burn": {
        "name": "Film Burn", "xfade_name": "fadewhite", "custom": True,
        "duration": 0.5, "moods": ["nostalgic", "emotional", "cinematic"],
    },

    # ── GROUP 8: ADVANCED FILTER TRANSITIONS ──────────────────────────────────
    "blur_dissolve": {
        "custom": True,
        "duration": 0.6,
        "moods": ["emotional", "dreamy", "calm", "nostalgic"],
        "description": "Gaussian blur dissolve — soft dreamlike cut",
    },
    "whip_pan": {
        "custom": True,
        "duration": 0.2,
        "moods": ["action", "epic", "tense", "hype"],
        "description": "Fast horizontal motion blur — like a whip pan cut",
    },
    "brightness_flash": {
        "custom": True,
        "duration": 0.25,
        "moods": ["peak", "epic", "action", "motivational"],
        "description": "Quick brightness flash — like a camera flash",
    },
    "cross_blur": {
        "custom": True,
        "duration": 0.5,
        "moods": ["cinematic", "emotional", "mysterious"],
        "description": "Both clips blur into each other",
    },
}

# ── Mood → transition priority list ───────────────────────────────────────────

MOOD_PRIMARY_TRANSITIONS = {
    "cinematic":    ["slideleft", "dissolve", "cross_blur", "wipeleft", "radial", "smoothleft"],
    "dark":         ["fadeblack", "diagtl", "cross_blur", "pixelize", "glitch", "circleclose"],
    "emotional":    ["dissolve", "fadegrays", "blur_dissolve", "hblur", "cross_blur", "film_burn", "fade"],
    "calm":         ["fade", "dissolve", "hblur", "slidedown", "fadewhite"],
    "happy":        ["fadewhite", "circleopen", "wipeup", "smoothup", "slideleft"],
    "epic":         ["zoomin", "radial", "zoom_punch", "brightness_flash", "whip_pan", "wipeleft", "squeezeh"],
    "action":       ["wipeleft", "flash", "whip_pan", "brightness_flash", "zoom_punch", "squeezeh", "diagtl"],
    "tense":        ["pixelize", "glitch", "fadeblack", "wipedown", "squeezev"],
    "nostalgic":    ["film_burn", "fadegrays", "dissolve", "fade", "fadewhite"],
    "mysterious":   ["circleclose", "fadeblack", "pixelize", "diagbr", "glitch"],
    "uplifting":    ["wipeup", "smoothup", "circleopen", "fadewhite", "slideup"],
    "serene":       ["fade", "hblur", "dissolve", "slidedown", "fadegrays"],
    "motivational": ["zoom_punch", "flash", "slideup", "wipeup", "zoomin"],
    "euphoric":     ["circleopen", "smoothup", "wipeup", "fadewhite", "radial"],
    "travel":       ["slideleft", "slideright", "smoothleft", "wipeleft", "dissolve"],
}

STYLE_PRESETS = {
    "subtle":    ["fade", "dissolve", "fadegrays", "hblur", "fadeblack"],
    "dynamic":   ["wipeleft", "slideleft", "slideup", "smoothleft", "zoomin"],
    "cinematic": ["film_burn", "dissolve", "radial", "blur_dissolve", "cross_blur", "circleopen", "smoothleft"],
    "hype":      ["flash", "zoom_punch", "whip_pan", "brightness_flash", "squeezeh", "wipeleft", "diagtl"],
}


def get_transitions_for_mood(mood: str, scene_count: int) -> list:
    """Returns scene_count-1 transition names varied across the mood's preferred list."""
    pool = MOOD_PRIMARY_TRANSITIONS.get(
        str(mood or "").lower(),
        ["fade", "dissolve", "slideleft", "wipeleft", "fadeblack"],
    )
    return [pool[i % len(pool)] for i in range(max(0, scene_count - 1))]


def get_transitions_for_style(style: str, mood: str, scene_count: int) -> list:
    """
    Returns scene_count-1 transition names.
    style="auto" → mood-based selection
    style=<preset> → cycles through the preset pool
    style=<transition_name> → uses that single transition for all scene boundaries
    """
    n = max(0, scene_count - 1)
    if style == "auto":
        return get_transitions_for_mood(mood, scene_count)
    if style in STYLE_PRESETS:
        pool = STYLE_PRESETS[style]
        return [pool[i % len(pool)] for i in range(n)]
    if style in TRANSITIONS:
        return [style] * n
    # Unknown style → fall back to mood-based
    return get_transitions_for_mood(mood, scene_count)


def build_transition_filter(
    clip_paths: list,
    clip_durations: list,
    transitions: list,
    width: int,
    height: int,
    fps: int = 24,
) -> tuple:
    """
    Build FFmpeg arguments for chaining N clips with N-1 transitions.

    Returns:
        input_args  – list of ["-i", path] entries
        filter_parts – list of filter_complex segments (join with ";")
        output_label – final stream label e.g. "[v0001]"

    The caller is responsible for adding a final format/tpad step if needed.
    Custom transitions (flash, glitch, zoom_punch, film_burn) use their
    xfade_name equivalents because zoompan applied to an accumulated chain
    would affect all previously composed frames, not just the transition window.
    """
    input_args = []
    for path in clip_paths:
        input_args.extend(["-i", path])

    filter_parts = []
    current_label = "[0:v]"
    acc_duration = float(clip_durations[0]) if clip_durations else 4.0

    for i, transition_name in enumerate(transitions):
        td = TRANSITIONS.get(transition_name, TRANSITIONS["fade"])
        trans_dur = td["duration"]

        next_label = f"[{i + 1}:v]"
        out_label = f"[v{i:02d}{i + 1:02d}]"
        offset = max(0.1, acc_duration - trans_dur)

        if transition_name == "blur_dissolve":
            filter_parts.append(
                f"{current_label}"
                f"gblur=sigma=20,fade=t=out:st={offset:.3f}:d={trans_dur:.3f}"
                f"[blur_{i}]"
            )
            filter_parts.append(
                f"[blur_{i}]{next_label}"
                f"xfade=transition=dissolve:"
                f"duration={trans_dur:.3f}:offset={offset:.3f}"
                f"{out_label}"
            )

        elif transition_name == "whip_pan":
            filter_parts.append(
                f"{current_label}"
                f"tmix=frames=3:weights='0.2 0.3 0.5'"
                f"[whip_{i}]"
            )
            filter_parts.append(
                f"[whip_{i}]{next_label}"
                f"xfade=transition=slideleft:"
                f"duration=0.15:offset={offset:.3f}"
                f"{out_label}"
            )

        elif transition_name == "brightness_flash":
            filter_parts.append(
                f"{current_label}{next_label}"
                f"xfade=transition=fadewhite:"
                f"duration=0.25:offset={offset:.3f}"
                f"{out_label}"
            )

        elif transition_name == "cross_blur":
            filter_parts.append(
                f"{current_label}"
                f"gblur=sigma=15,fade=t=out:st={offset:.3f}:d=0.3"
                f"[cba_{i}]"
            )
            filter_parts.append(
                f"{next_label}"
                f"gblur=sigma=15,fade=t=in:st=0:d=0.3"
                f"[cbb_{i}]"
            )
            filter_parts.append(
                f"[cba_{i}][cbb_{i}]"
                f"xfade=transition=dissolve:"
                f"duration=0.5:offset={offset:.3f}"
                f"{out_label}"
            )

        else:
            xfade_name = td.get("xfade_name", "fade")
            filter_parts.append(
                f"{current_label}{next_label}"
                f"xfade=transition={xfade_name}:"
                f"duration={trans_dur:.3f}:"
                f"offset={offset:.3f}"
                f"{out_label}"
            )

        current_label = out_label
        acc_duration += float(clip_durations[i + 1]) - trans_dur

    return input_args, filter_parts, current_label
