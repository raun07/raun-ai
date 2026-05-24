# Prompt-to-Reel

AI video generation system. FastAPI backend + React/Vite frontend with Clerk auth.

## Architecture

Multi-agent pipeline powered by Groq LLMs:

- **ScriptAgent** — generates structured scene scripts from user prompts
- **CriticAgent** — scores script quality and triggers rewrites if below threshold
- **VisualAgent** — optimizes Pexels search queries per scene
- **DirectorAgent** — orchestrates the full agent pipeline with fallback handling

Evaluation framework scores every generation on script quality, visual relevance, and audio sync. Results are visible at `/evals`.

## Known Failure Modes

See [FAILURES.md](FAILURES.md) for documented failure modes, detection methods, and recovery paths implemented in this system.
