# CyberSec Ops v2

A fuller prototype for the terminal-based red-vs-blue incident response RPG.

## What's new

- Actual Socket.IO multiplayer room state
- Server-authoritative hidden intel and phase resolution
- Per-player login and room join flow
- Character builder with class/role-specific skills and stat points
- Skill modifiers affect roll outcomes
- Cross-team modifiers: successful blue hardening actions increase red exploit difficulty; successful red reconnaissance/exploitation raises future blue detection/containment pressure
- Terminal input with command history and tab completion
- LLM narration hooks for blue incident reports and red encrypted chat

## Structure

- `frontend/` React + Vite client
- `server/` Express + Socket.IO server
- `shared/` scenario and rules helpers

## Run locally

### 1) Server

```bash
cd server
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

The client defaults to `http://localhost:3001` for API/socket access.

## Environment

Server supports optional live narration using OpenAI:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4
PORT=3001
```

If no API key is present, the server falls back to deterministic local narration.

## Core commands in-game

- `help`
- `status`
- `intel`
- `roles`
- `skills`
- `submit <command>`
- `history`
- `autocomplete <prefix>`

## Notes

- Team-specific intel is filtered on the server before being emitted.
- Rooms are server-only state. The client only receives the subset it is allowed to see.
- Narration is requested after a phase resolves.


## Git-ready packaging

This archive is structured as a repository root so you can unzip it and push it directly to GitHub, Bitbucket, or GitLab.

### Included repo helpers

- `.gitignore` for Node/Vite projects
- `.editorconfig` for consistent formatting
- `.env.example` for local setup
- root `package.json` with npm workspace scripts

### Quick start from repo root

```bash
npm run install:all
npm run dev:server
npm run dev:frontend
```

### Environment variables

Copy `.env.example` values into your local environment before enabling live narration.
