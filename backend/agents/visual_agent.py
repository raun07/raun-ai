import json
from agents.base_agent import BaseAgent

VISUAL_SYSTEM_PROMPT = """You are a video editor selecting stock footage for each scene.
Given a user prompt and scene descriptions, generate Pexels search queries that precisely match the subject, gender, and setting.

CRITICAL RULES — follow exactly:
- If the user prompt mentions a man / male / boy / husband / father / him: use "man" or "male" in every query.
- If the user prompt mentions a woman / female / girl / wife / mother / her: use "woman" or "female" in every query.
- Always include the specific subject type (boxer, dancer, runner, chef, etc.) in the query.
- Include the dominant mood or setting (dark gym, night city, sunrise, etc.).
- Keep queries 2-4 words. Be concrete — avoid vague words like "person" or "individual".
- fallback_query must be shorter and simpler than primary_query but still match the subject.

Return JSON only. Do not include any text outside the JSON object.
Schema:
{
  "scenes": [
    {
      "scene_id": <integer>,
      "primary_query": "<2-4 word query matching subject gender, type, and setting>",
      "fallback_query": "<shorter backup query, still subject-specific>",
      "visual_style": "<lighting/mood hint for quality filter>"
    }
  ]
}"""


class VisualAgent(BaseAgent):
    name = "VisualAgent"

    def __init__(self):
        super().__init__(name="VisualAgent", model="llama-3.1-8b-instant")

    def _build_prompts(self, input_data: dict):
        scenes = input_data.get("scenes", [])
        orientation = input_data.get("orientation", "portrait")

        scenes_text = json.dumps(
            [
                {
                    "id": s.get("id", i + 1),
                    "description": s.get("description", ""),
                    "visual_keywords": s.get("visual_keywords", []),
                }
                for i, s in enumerate(scenes)
            ],
            indent=2,
        )

        original_prompt = input_data.get("prompt", "")
        user_message = (
            f"User prompt: {original_prompt}\n\n"
            f"Orientation: {orientation}\n\n"
            f"Scenes to find footage for:\n{scenes_text}"
        )
        return VISUAL_SYSTEM_PROMPT, user_message

    def _validate(self, output: dict, input_data: dict):
        scenes = output.get("scenes", [])
        if not scenes:
            return False, "scenes list is empty"
        for s in scenes:
            if not s.get("primary_query"):
                return False, f"scene {s.get('scene_id')} missing primary_query"
            if not s.get("fallback_query"):
                return False, f"scene {s.get('scene_id')} missing fallback_query"
        return True, None
