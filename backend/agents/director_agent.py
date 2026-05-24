import logging
from agents.script_agent import ScriptAgent
from agents.critic_agent import CriticAgent
from agents.visual_agent import VisualAgent


def _fallback_script(prompt: str, scene_count: int) -> dict:
    beats = ["quiet", "build", "resolve"]
    cameras = ["wide shot", "tracking shot", "close-up"]
    pacing = ["slow", "medium", "slow"]
    transitions = ["dissolve", "flash", "fade"]

    return {
        "title": "Midnight Fighter" if "fighter" in prompt.lower() else "Untitled",
        "mood": "cinematic",
        "emotional_arc": "A solitary struggle rises from doubt into quiet resolve.",
        "music_style": "slow cinematic piano with restrained percussion",
        "estimated_duration": scene_count * 4,
        "scenes": [
            {
                "id": i + 1,
                "beat_type": beats[min(i, len(beats) - 1)],
                "camera": cameras[min(i, len(cameras) - 1)],
                "description": f"{prompt} scene {i + 1}",
                "narration": f"{prompt}",
                "duration": 4,
                "pacing": pacing[min(i, len(pacing) - 1)],
                "transition_out": transitions[min(i, len(transitions) - 1)],
                "visual_keywords": [prompt[:30], "cinematic", "dramatic"],
            }
            for i in range(scene_count)
        ],
    }


class DirectorAgent:
    """Orchestrates all agents. Does not make LLM calls itself."""

    async def run(self, prompt: str, scene_count: int, orientation: str, trace=None) -> dict:
        # Step 1: Script generation
        script_result = await ScriptAgent().run(
            {"prompt": prompt, "scene_count": scene_count, "orientation": orientation},
            trace=trace,
        )

        if not script_result.success:
            logging.warning(
                f"[Director] ScriptAgent failed ({script_result.error}), using rule-based fallback"
            )
            script = _fallback_script(prompt, scene_count)
        else:
            script = script_result.output

        critic_result = None

        # Step 2: Critic review (max 2 cycles)
        for attempt in range(2):
            critic_result = await CriticAgent().run(
                {"script": script, "original_prompt": prompt},
                trace=trace,
            )

            if not critic_result.success:
                logging.warning(
                    f"[Director] CriticAgent failed on cycle {attempt + 1}, accepting current script"
                )
                break

            if critic_result.output.get("approved"):
                logging.info(f"[Director] Script approved on critic cycle {attempt + 1}")
                break

            if attempt < 1:
                instructions = critic_result.output.get("rewrite_instructions", "")
                revised_prompt = prompt + "\n\nRevision needed: " + instructions
                logging.info(
                    f"[Director] Script not approved, rewriting. Instructions: {instructions[:100]}"
                )
                new_script_result = await ScriptAgent().run(
                    {
                        "prompt": revised_prompt,
                        "scene_count": scene_count,
                        "orientation": orientation,
                    },
                    trace=trace,
                )
                if new_script_result.success:
                    script = new_script_result.output
                    script_result = new_script_result

        rewrite_cycles = 0 if (critic_result and critic_result.output.get("approved")) else 1

        # Step 3: Visual query optimization
        visual_result = await VisualAgent().run(
            {"scenes": script.get("scenes", []), "orientation": orientation, "prompt": prompt},
            trace=trace,
        )

        if visual_result.success:
            query_map = {
                s["scene_id"]: s for s in visual_result.output.get("scenes", [])
            }
            for scene in script.get("scenes", []):
                scene_id = scene.get("id")
                if scene_id in query_map:
                    scene["pexels_query"] = query_map[scene_id]["primary_query"]
                    scene["pexels_fallback"] = query_map[scene_id]["fallback_query"]

        return {
            "script": script,
            "agent_trace": {
                "script_agent": script_result.__dict__,
                "critic_agent": critic_result.__dict__ if critic_result else {},
                "visual_agent": visual_result.__dict__,
                "rewrite_cycles": rewrite_cycles,
            },
        }
