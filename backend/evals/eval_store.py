import json
import logging
from dataclasses import asdict
from evals.metrics import ReelEvalResult


class EvalStore:

    def __init__(self):
        self._results: list = []

    async def save(self, result: ReelEvalResult):
        self._results.append(asdict(result))

    async def get_recent(self, limit: int = 50) -> list:
        return self._results[-limit:]

    async def get_by_job_id(self, job_id: str) -> dict | None:
        for r in reversed(self._results):
            if r.get("job_id") == job_id:
                return r
        return None

    async def get_failure_patterns(self) -> dict:
        all_failures = []
        for r in self._results:
            all_failures.extend(r.get("failure_reasons", []))

        pattern_counts: dict = {}
        for f in all_failures:
            key = f[:40]
            pattern_counts[key] = pattern_counts.get(key, 0) + 1

        total = len(self._results)
        passed = sum(1 for r in self._results if r.get("passed"))
        avg_score = (
            sum(r.get("overall_score", 0.0) for r in self._results) / total
            if total
            else 0.0
        )
        avg_tokens = (
            sum(
                (r.get("pipeline_metrics") or {}).get("llm_total_tokens", 0)
                for r in self._results
            )
            / total
            if total
            else 0.0
        )

        return {
            "total_evals": total,
            "pass_rate": round(passed / max(total, 1), 3),
            "common_failures": sorted(
                pattern_counts.items(), key=lambda x: -x[1]
            )[:10],
            "avg_score": round(avg_score, 3),
            "avg_tokens_per_job": round(avg_tokens, 1),
        }


eval_store = EvalStore()
