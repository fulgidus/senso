# S.E.N.S.O.

**Sistema Educativo per Numeri, Spese e Obiettivi**

AI-powered financial education platform. Voice-first, document-aware, modular.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | FastAPI + Pydantic v2 |
| Database | PostgreSQL (SQLAlchemy ORM) |
| Storage | MinIO (S3-compatible) |
| LLM | Multi-provider (Gemini, OpenAI, OpenRouter) |
| Voice | ElevenLabs TTS + Web Speech API STT |
| Infra | Docker Compose |

## Quick Start

```bash
cp .env.example .env   # fill in API keys
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Development

```bash
# Backend tests
docker compose run --rm api uv run pytest

# Frontend type check
docker compose run --rm frontend pnpm tsc --noEmit

# Frontend build
docker compose run --rm frontend pnpm build
```

## Architecture

See `CONVENTIONS.md` for coding standards and patterns.
