import asyncio
import json
import logging
import os
import re
from groq import Groq
from utils.file_utils import clean_json


def _extract_scene_descriptions(prompt):
    if not prompt:
        return []

    raw_phrases = re.split(r"[.?!;]+\s*", prompt.strip())
    phrases = [phrase.strip() for phrase in raw_phrases if phrase.strip()]

    if len(phrases) >= 3:
        return phrases[:3]

    if len(phrases) == 2:
        return [phrases[0], phrases[1], phrases[1]]

    if len(phrases) == 1:
        words = prompt.split()
        if len(words) > 8:
            return [" ".join(words[:8]), " ".join(words[8:16]), prompt]
        return [prompt, prompt + " emotional scene", prompt + " wide shot"]

    return [prompt, prompt + " emotional scene", prompt + " wide shot"]


def get_client():
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return None
    return Groq(api_key=api_key)


def generate_script_legacy(prompt):
    """Original single-call Groq script generation. Kept as fallback."""
    client = get_client()

    if client is None:
        logging.warning(
            "GROQ_API_KEY is not configured, using fallback script generation"
        )
        return {
            "mood": "cinematic",
            "scenes": [
                {"id": 1, "description": prompt, "narration": prompt, "duration": 4},
                {"id": 2, "description": prompt + " emotional scene", "narration": prompt, "duration": 4},
                {"id": 3, "description": prompt + " wide shot", "narration": prompt, "duration": 4},
            ],
        }

    system_prompt = """
Return ONLY JSON.

{
  "mood": "cinematic",
  "scenes": [
    {
      "id": 1,
      "description": "visual scene description",
      "narration": "what the voice should say",
      "duration": 4
    }
  ]
}

Generate 3 scenes with VISUAL descriptions.
"""

    try:
        ai = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        )
        raw = ai.choices[0].message.content
    except Exception as exc:
        logging.error(f"Groq script generation failed, using fallback: {exc}")
        raw = ""

    try:
        parsed = json.loads(clean_json(raw))
    except Exception:
        parsed = {}

    if "scenes" not in parsed:
        parsed = {
            "mood": "cinematic",
            "scenes": [
                {"id": i + 1, "description": desc, "narration": desc, "duration": 4}
                for i, desc in enumerate(_extract_scene_descriptions(prompt))
            ],
        }

    return parsed


def generate_script(prompt, scene_count=3, orientation="portrait", job_id=None):
    """
    Multi-agent script generation via DirectorAgent.
    Falls back to generate_script_legacy() on any exception.
    """
    try:
        from agents.director_agent import DirectorAgent
        from database.job_store import update_job

        result = asyncio.run(
            DirectorAgent().run(prompt, scene_count, orientation)
        )
        script = result["script"]
        agent_trace = result["agent_trace"]

        if job_id:
            try:
                update_job(job_id, {"agent_trace": agent_trace})
            except Exception as exc:
                logging.warning(f"[AI] Failed to store agent_trace for {job_id}: {exc}")

        return script

    except Exception as exc:
        logging.error(f"[AI] DirectorAgent failed, using legacy: {exc}")
        return generate_script_legacy(prompt)


def enhance_prompt(raw_prompt):
    """Return 3 cinematic rewrites of a user's rough prompt."""
    client = get_client()
    if client is None:
        return [
            raw_prompt,
            f"{raw_prompt} — at golden hour, slow tracking shot",
            f"{raw_prompt} — close-up, dramatic shadow, emotional arc",
        ]

    system = (
        "You are a world-class creative director. Transform the user's rough idea "
        "into 3 distinct cinematic video prompt variations.\n\n"
        "Each prompt must:\n"
        "- Be 1-2 sentences, vivid and specific\n"
        "- Evoke mood, camera movement, and emotion\n"
        "- Differ in style (e.g., intimate, epic, mysterious)\n"
        "- Feel ready to generate a stunning short film\n\n"
        "Return ONLY a JSON array of exactly 3 strings. No markdown, no preamble.\n"
        'Example: ["A lone boxer...", "Through rain-soaked streets...", "In the blue hour..."]'
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": raw_prompt},
            ],
            temperature=0.9,
        )
        text = response.choices[0].message.content

        if not text or not text.strip():
            logging.warning("[PromptEnhancer] Empty response from Groq")
            return []

        text = text.strip()
        if "```" in text:
            for part in text.split("```"):
                cleaned = part.strip()
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:].strip()
                if cleaned.startswith("[") or cleaned.startswith("{"):
                    text = cleaned
                    break

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as e:
            logging.error(
                f"[PromptEnhancer] JSON parse failed: {e}\n"
                f"Raw response: {text[:200]}"
            )
            return []

        if isinstance(parsed, list) and len(parsed) >= 3:
            return [str(s).strip() for s in parsed[:3]]
        return []

    except Exception as exc:
        logging.error(f"[PromptEnhancer] Groq call failed: {exc}")
        return []


def generate_content_ideas(niche, platform="instagram", count=5):
    client = get_client()
    if client is None:
        logging.warning("GROQ_API_KEY is not configured, using fallback content ideas")
        fallback_templates = [
            f"A cinematic {niche} transformation story for {platform}.",
            f"A quick motivational hook for {niche} creators on {platform}.",
            f"A dark, powerful behind-the-scenes {niche} clip with voiceover.",
            f"A before-and-after {niche} sequence set to dramatic music.",
            f"A motivational {niche} routine breakdown with strong pacing.",
        ]
        return [fallback_templates[i % len(fallback_templates)] for i in range(count)]

    system_prompt = f"""
Generate exactly {count} short, specific, and actionable video reel ideas for a {niche} creator targeting {platform}.
Each idea should be a single line.
Return only one idea per line, with no numbering and no bullets.
"""

    try:
        ai = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": system_prompt},
            ],
        )
        raw = ai.choices[0].message.content
    except Exception as exc:
        logging.error(f"Groq content idea generation failed, using fallback: {exc}")
        raw = ""

    if not raw:
        return [
            f"A cinematic {niche} reel idea for {platform}.",
            f"A motivational {niche} clip focused on progress, not perfection.",
            f"A dark, high-contrast {niche} story with a powerful finish.",
        ][:count]

    ideas = [line.strip() for line in raw.splitlines() if line.strip()]
    if not ideas:
        ideas = [
            f"A cinematic {niche} reel idea for {platform}.",
            f"A motivational {niche} clip focused on progress, not perfection.",
            f"A dark, high-contrast {niche} story with a powerful finish.",
        ]

    return ideas[:count]
