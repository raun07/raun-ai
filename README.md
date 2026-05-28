# raun.ai — Turn a thought into a cinematic reel

<div align="center">

![Live](https://img.shields.io/badge/Live-raun--ai.vercel.app-C94030?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_LLaMA-F55036?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

</div>

> **raun.ai** is a production-grade AI Video Generation SaaS
> that converts text prompts into cinematic MP4 reels using
> a custom multi-agent LLM pipeline.
>
> Live: https://raun-ai.vercel.app

---

## What it does

Type any prompt and raun.ai handles the rest — from script to final rendered video:

- Type any prompt ("a boxer training alone at midnight")
- AI Director agent breaks it into a cinematic script
- ScriptAgent writes scene-by-scene narration
- CriticAgent reviews and rewrites until approved
- VisualAgent maps scenes to stock footage queries
- Pipeline fetches clips, generates AI voice, mixes music
- FFmpeg renders final MP4 with LUT color grading
- Video uploaded to Cloudinary, user gets download link

---

## Architecture

Multi-agent pipeline:

```
User Prompt
│
▼
┌─────────────┐
│   Director  │ ← orchestrates everything
└──────┬──────┘
       │
┌──────▼───────┐     ┌─────────────┐
│    Script    │────▶│   Critic    │
│    Agent     │◀────│   Agent     │
└──────┬───────┘     └─────────────┘
       │ approved
┌──────▼───────┐
│    Visual    │ ← maps scenes to footage queries
│    Agent     │
└──────┬───────┘
       │
┌──────▼──────────────────────────────┐
│             Pipeline                │
│  Pexels → Voice → Music →          │
│  FFmpeg → LUT → Cloudinary         │
└─────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Clerk Auth |
| Backend | FastAPI, Python 3.12, asyncio |
| AI | Groq LLaMA 3, edge-tts |
| Database | PostgreSQL (Supabase) |
| Queue | Redis (Upstash) + asyncio.Semaphore |
| Video | FFmpeg, Pexels API, LUT color grading |
| Storage | Cloudinary |
| Deploy | Render (backend) + Vercel (frontend) |

---

## Features

- Multi-agent pipeline: Director → Script → Critic → Visual
- AI voiceover with edge-tts
- Mood-based music selection (cinematic, epic, dark, calm)
- LUT color grading per mood
- 9:16 Portrait + 16:9 Landscape export
- Brand kit watermarking
- Automated eval scoring (visual + audio + script)
- Clerk authentication + credit system
- Cloudinary video hosting + delivery

---

## Local Development

### Prerequisites

- Python 3.12
- Node.js 18+
- FFmpeg installed
- PostgreSQL database (Supabase)
- Redis (Upstash)

### Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # fill in your keys
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend/client
npm install
cp .env.example .env.local  # set VITE_API_URL
npm run dev
```

### Environment Variables

**Backend**
```
DATABASE_URL=
REDIS_URL=
GROQ_API_KEY=
PEXELS_API_KEY=
CLOUDINARY_URL=
CLERK_SECRET_KEY=
```

**Frontend**
```
VITE_API_URL=
VITE_CLERK_PUBLISHABLE_KEY=
```

---

## Project Structure

```
raun-ai/
├── backend/
│   ├── main.py              # FastAPI app + pipeline orchestration
│   ├── agents/              # Director, Script, Critic, Visual agents
│   ├── services/            # VideoService, AudioService
│   ├── database/            # Models, CRUD, migrations
│   └── requirements.txt
├── frontend/
│   └── client/
│       ├── src/
│       │   ├── AuthApp.jsx  # Studio UI
│       │   ├── pages/       # LandingPage, Pricing, Evals
│       │   └── components/
│       └── package.json
```

---

## Deployment

| Service | Purpose | Tier |
|---------|---------|------|
| Render | Backend (FastAPI) | Free (512MB RAM) |
| Vercel | Frontend (React) | Free |
| Supabase | PostgreSQL | Free |
| Upstash | Redis | Free |
| Cloudinary | Video storage | Free |
| Clerk | Auth | Free |

> Free tier note: Generation takes 8-10 min due to shared CPU.
> Upgrading Render to $7/month reduces this to ~4-5 min.

---

## Roadmap

- [ ] AI-generated footage (Runway ML / Google Veo)
- [ ] Hook / Body / CTA segment editing
- [ ] Upload own clips
- [ ] RAG-based brand voice
- [ ] Custom domain + Google OAuth

---

## Built by

**Raun** — Final Year CSE @ Sir MVIT, Bengaluru  
[raun-ai.vercel.app](https://raun-ai.vercel.app) · [LinkedIn](https://linkedin.com/in/raun)

---

*Built with Claude Code + a lot of production debugging*
