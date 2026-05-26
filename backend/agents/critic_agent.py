import json
from agents.base_agent import BaseAgent

CRITIC_SYSTEM_PROMPT = """CRITICAL: Reject any script where the scenes drift away from the user's original prompt. The script MUST stay true to what the user asked for. If the script invents new elements not in the prompt, mark it as NOT APPROVED and instruct the ScriptAgent to strictly follow the user's prompt.

You are a quality reviewer for AI-generated video scripts.
Evaluate the script and return a JSON score report. You MUST respond with valid JSON only.
Schema:
{
  "coherence_score": <float 0-1, does the script tell a clear story?>,
  "cinematic_score": <float 0-1, are descriptions visual and specific?>,
  "narration_quality": <float 0-1, is narration natural and engaging?>,
  "issues": ["<specific problem found>"],
  "approved": <boolean, true if all scores >= 0.6>,
  "rewrite_instructions": "<what to fix, empty string if approved>"
}
Do not include any text outside the JSON object."""


class CriticAgent(BaseAgent):
    name = "CriticAgent"

    def __init__(self):
        super().__init__(name="CriticAgent", model="llama-3.1-8b-instant")

    def _build_prompts(self, input_data: dict):
        script = input_data.get("script", {})
        original_prompt = input_data.get("original_prompt", "")

        user_message = (
            f"Original prompt: {original_prompt}\n\n"
            f"Script to evaluate:\n{json.dumps(script, indent=2)}"
        )
        return CRITIC_SYSTEM_PROMPT, user_message

    def _validate(self, output: dict, input_data: dict):
        required = ["coherence_score", "cinematic_score", "narration_quality", "approved"]
        missing = [k for k in required if k not in output]
        if missing:
            return False, f"Missing fields: {missing}"
        for field in ["coherence_score", "cinematic_score", "narration_quality"]:
            val = output.get(field)
            try:
                f = float(val)
                if not (0.0 <= f <= 1.0):
                    return False, f"{field} out of range: {f}"
            except (TypeError, ValueError):
                return False, f"{field} is not a float: {val}"
        return True, None
