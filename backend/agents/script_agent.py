import logging
from agents.base_agent import BaseAgent, AgentResult

VALID_MOODS = {
    "calm", "cinematic", "dark", "emotional", "happy",
    "epic", "tense", "mysterious", "uplifting", "nostalgic",
    "serene", "dramatic", "thriller", "romantic", "hopeful",
    "melancholic", "suspenseful", "euphoric", "intense",
}

_consecutive_failures = 0


class ScriptAgent(BaseAgent):
    name = "ScriptAgent"

    def __init__(self):
        super().__init__(name="ScriptAgent", model="llama-3.1-8b-instant")

    def _build_prompts(self, input_data: dict):
        prompt = input_data.get("prompt", "")
        scene_count = input_data.get("scene_count", 3)
        orientation = input_data.get("orientation", "portrait")

        system_prompt = f"""CRITICAL RULES — NEVER VIOLATE:
1. You MUST strictly follow the user's prompt.
   Every scene must directly reflect what the user described.
   Do NOT invent new characters, settings, or storylines
   that were not mentioned in the prompt.

2. If the user describes a specific character
   (e.g. "Indian man in his 20s", "boxer", "astronaut"),
   that character MUST appear in every scene.

3. If the user describes a specific setting
   (e.g. "jungle", "boxing gym", "Mars"),
   ALL scenes must be set there.

4. If the user describes a specific action or event
   (e.g. "chase", "training", "falling"),
   the script must build around that action.

5. Do NOT replace the user's idea with a generic
   cinematic story. The user's prompt IS the story.

6. Narration must describe what is visually happening
   in the scene, directly tied to the user's prompt.

---

You are a world-class film director and
cinematographer. You think in emotions, not just descriptions.

When given a creative brief, create a CINEMATIC FILM SCRIPT
with a proper emotional arc. Every scene must earn its place.

DIRECTOR RULES:
1. Three-act structure for every film:
   Scene 1: ESTABLISH - wide, slow, set the world
   Scene 2-N-1: BUILD - tension rises, shots get closer
   Final scene: RESOLVE - memorable final image

2. Camera tells the story:
   wide shot = loneliness, scale, establishing world
   medium shot = character, connection
   close-up = raw emotion, intensity, detail
   low angle = power, dominance
   high angle = vulnerability, isolation
   tracking shot = following action, momentum

3. Beat types control energy:
   quiet = calm moment, breathe, softer music needed
   build = tension rising, pace increases
   peak = emotional or action climax, loudest moment
   resolve = wind down, reflective, music fades

4. Narration rules — CRITICAL:
   Every narration MUST be 15-25 words. No exceptions.
   Complete thought. Emotional and poetic.
   Scene 1: establish tone and world.
   Scene 2-N: build emotional intensity.
   Final scene: most powerful line of the film.
   BAD: "A boxer trains." (too short — will be rejected)
   GOOD: "Every night he came back to this place, because
          losing here hurt less than losing out there."

   CRITICAL NARRATION RULE:
   Each narration MUST be 20-30 words minimum.
   The total voice narration across all scenes should
   cover the FULL duration of the video.
   For a 5-scene video: each scene needs ~20-25 words
   to fill 5-6 seconds of narration per scene.
   SHORT NARRATIONS WILL BE REJECTED.

5. Visual keywords must find REAL stock footage:
   BAD:  "intense emotional moment of despair"
   GOOD: "man running rain street night"
   BAD:  "beautiful nature scene"
   GOOD: "waterfall jungle green mist"

You MUST respond with valid JSON only.
No markdown. No preamble. No explanation.
Use exactly one mood value. Never combine moods with slashes, pipes,
commas, or multiple words.

REQUIRED SCHEMA:
{{
  "title": "evocative 2-4 word film title",
  "mood": "dark|emotional|cinematic|epic|calm|happy|tense|mysterious|uplifting|nostalgic|serene|dramatic",
  "emotional_arc": "one sentence describing the story arc",
  "music_style": "specific music description e.g. slow dark piano",
  "scenes": [
    {{
      "id": 1,
      "beat_type": "quiet|build|peak|resolve",
      "camera": "wide shot|medium shot|close-up|low angle|high angle|tracking shot",
      "description": "visual description for Pexels stock search",
      "visual_keywords": ["2-4 specific searchable single words"],
      "narration": "REQUIRED: Write exactly 20-30 words of poetic voice-over narration for this scene. This is spoken aloud. Must be a complete emotional thought. Example of correct length: 'In the silence between stars, he understood that some discoveries change not just history — but the very soul of the man who makes them.' Never write fewer than 20 words.",
      "duration": "<integer MUST be between 4 and 6 seconds. Never less than 4. Never more than 6. Default to 5 if unsure.>",
      "pacing": "slow|medium|fast",
      "transition_out": "fade|flash|dissolve|wipeleft|zoom_punch|film_burn"
    }}
  ]
}}

Generate exactly {scene_count} scenes.
Orientation: {orientation}.
Make every frame intentional. No filler. No generic content."""

        return system_prompt, prompt

    def _validate(self, output: dict, input_data: dict):
        global _consecutive_failures

        errors = []
        mood = str(output.get("mood", "") or "").strip().lower()
        if mood not in VALID_MOODS:
            for part in mood.replace("/", "|").replace(",", "|").split("|"):
                candidate = part.strip()
                if candidate in VALID_MOODS:
                    output["mood"] = candidate
                    mood = candidate
                    break

        scenes = output.get("scenes", [])

        if not scenes:
            errors.append("scenes list is empty")

        for i, scene in enumerate(scenes):
            if not scene.get("description"):
                errors.append(f"scene {i+1} missing description")
            if not scene.get("narration"):
                errors.append(f"scene {i+1} missing narration")
            duration = scene.get("duration", 0)
            try:
                d = int(duration)
            except (TypeError, ValueError):
                d = 0
            if not (2 <= d <= 8):
                scene["duration"] = max(2, min(8, d))
                logging.warning(
                    f"[ScriptAgent] Scene {i+1} duration {d} "
                    f"clamped to {scene['duration']}"
                )

        for i, scene in enumerate(scenes):
            narration = scene.get("narration", "")
            word_count = len(str(narration).split())
            if word_count < 15:
                errors.append(
                    f"scene {i+1} narration too short "
                    f"({word_count} words, minimum 15)"
                )

        requested = input_data.get("scene_count", 3)
        if len(scenes) != requested:
            errors.append(
                f"expected {requested} scenes, got {len(scenes)}"
            )

        if mood not in VALID_MOODS:
            errors.append(f"mood '{mood}' not in valid set {VALID_MOODS}")

        if errors:
            _consecutive_failures += 1
            if _consecutive_failures >= 3:
                logging.warning(
                    "[Agent:ScriptAgent] Failing consistently — check Groq quota or prompt length"
                )
            return False, "; ".join(errors)

        _consecutive_failures = 0
        return True, None

    def _augment_for_retry(self, input_data: dict, error_msg: str) -> dict:
        augmented = dict(input_data)
        augmented["prompt"] = (
            input_data.get("prompt", "")
            + f"\n\nRevision required. Fix these issues: {error_msg}"
        )
        return augmented
