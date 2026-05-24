import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional

try:
    from groq import AsyncGroq
except ImportError:
    AsyncGroq = None

from utils.file_utils import clean_json

HALLUCINATION_INDICATORS = [
    "as an ai",
    "i cannot",
    "i don't have access",
    "my training data",
    "i'm not able to",
]


@dataclass
class AgentResult:
    agent_name: str
    success: bool
    output: dict
    confidence: float
    latency_ms: int
    tokens_used: int
    attempt_number: int
    error: Optional[str] = None
    metadata: dict = field(default_factory=dict)


class BaseAgent:
    def __init__(self, name: str, model: str = "llama-3.1-8b-instant"):
        self.name = name
        self.model = model

    async def run(self, input_data: dict, trace=None) -> AgentResult:
        start_time = time.time()
        last_result = None

        for attempt in range(1, 3):
            try:
                system_prompt, user_message = self._build_prompts(input_data)
                output, tokens, metadata = await self._call_llm(system_prompt, user_message)
                latency_ms = int((time.time() - start_time) * 1000)

                logging.info(
                    f"[Agent:{self.name}] attempt {attempt}, {latency_ms}ms, {tokens} tokens"
                )

                if output.get("error") == "json_parse_failed":
                    last_result = AgentResult(
                        agent_name=self.name,
                        success=False,
                        output=output,
                        confidence=0.0,
                        latency_ms=latency_ms,
                        tokens_used=tokens,
                        attempt_number=attempt,
                        error="json_parse_failed",
                        metadata=metadata,
                    )
                    if attempt < 2:
                        continue
                    break

                valid, error_msg = self._validate(output, input_data)

                if valid or attempt >= 2:
                    if trace:
                        trace.add_span(
                            name=self.name,
                            status="success" if valid else "failure",
                            duration_ms=latency_ms,
                            metadata={"tokens_used": tokens, "attempt": attempt},
                        )
                    last_result = AgentResult(
                        agent_name=self.name,
                        success=valid,
                        output=output,
                        confidence=0.8 if valid else 0.0,
                        latency_ms=latency_ms,
                        tokens_used=tokens,
                        attempt_number=attempt,
                        error=None if valid else error_msg,
                        metadata=metadata,
                    )
                    break

                logging.warning(
                    f"[Agent:{self.name}] attempt {attempt} validation failed: {error_msg}"
                )
                input_data = self._augment_for_retry(input_data, error_msg)
                last_result = AgentResult(
                    agent_name=self.name,
                    success=False,
                    output=output,
                    confidence=0.0,
                    latency_ms=latency_ms,
                    tokens_used=tokens,
                    attempt_number=attempt,
                    error=error_msg,
                    metadata=metadata,
                )

            except Exception as exc:
                latency_ms = int((time.time() - start_time) * 1000)
                logging.error(f"[Agent:{self.name}] attempt {attempt} exception: {exc}")
                last_result = AgentResult(
                    agent_name=self.name,
                    success=False,
                    output={},
                    confidence=0.0,
                    latency_ms=latency_ms,
                    tokens_used=0,
                    attempt_number=attempt,
                    error=str(exc),
                )
                if attempt >= 2:
                    break

        return last_result

    def _build_prompts(self, input_data: dict):
        raise NotImplementedError

    def _validate(self, output: dict, input_data: dict):
        return True, None

    def _augment_for_retry(self, input_data: dict, error_msg: str) -> dict:
        return input_data

    async def _call_llm(self, system_prompt: str, user_message: str) -> tuple:
        """Returns (output_dict, tokens_used, metadata_dict)."""
        if AsyncGroq is None:
            raise RuntimeError("groq package not available")

        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not configured")

        client = AsyncGroq(api_key=api_key)
        metadata = {}

        for json_attempt in range(2):
            msg = (
                user_message
                if json_attempt == 0
                else user_message + "\n\nYou MUST respond ONLY with valid JSON. No markdown, no explanation."
            )

            response = await client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": msg},
                ],
            )

            content = response.choices[0].message.content or ""
            tokens = getattr(response.usage, "total_tokens", 0) if response.usage else 0

            lower = content.lower()
            if any(ind in lower for ind in HALLUCINATION_INDICATORS):
                logging.warning(f"[Agent:{self.name}] Hallucination indicator detected")
                metadata["hallucination_detected"] = True

            if len(content) < 50:
                logging.warning(
                    f"[Agent:{self.name}] Suspiciously short response: {len(content)} chars"
                )
                metadata["short_response"] = True

            try:
                parsed = json.loads(clean_json(content))
                return parsed, tokens, metadata
            except Exception:
                if json_attempt == 0:
                    logging.warning(
                        f"[Agent:{self.name}] JSON parse failed on attempt 1, retrying"
                    )
                    continue
                logging.error(f"[Agent:{self.name}] JSON parse failed on attempt 2")
                return (
                    {"error": "json_parse_failed", "raw": content[:500]},
                    tokens,
                    metadata,
                )

        return {"error": "json_parse_failed"}, 0, metadata
