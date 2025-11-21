# Chartsmith

Build better Helm charts with an AI-assisted workflow that spans a Next.js front end, a Go worker, and a Helm-first deployment toolchain.

## Overview

This repository is a monorepo that contains every component required to run Chartsmith end to end:
- `chartsmith-app/` – the Next.js 16 front end, powered by the Vercel AI SDK for conversational UX.
- `pkg/`, `cmd/`, `main.go` – the Go worker that orchestrates planning, conversion, rendering, and publishing pipelines.
- `chart/` and `kustomize/` – production deployment artifacts (Helm chart + Kustomize overlays).
- `chartsmith-extension/` – the VS Code companion extension.
- `db/`, `design/`, `bootstrap/`, `testdata/` – database schema, design notes, default workspaces, and fixtures.

All project planning notes live in `PROJECT_STATUS.md`; this README distills that document plus the current branch/commit state.

## Branch and History Snapshot

- Active branch: `main`
- Remote tracking: `origin/main`
- Latest commit: `d9ff1ff` (`Initial commit`, Fri Nov 21 13:10:04 2025 -0600)
- History: the repository was intentionally squashed to a single commit after completing the Vercel AI SDK migration, so new contributors can reason from a clean slate.

## Planning Status (from `PROJECT_STATUS.md`)

| Requirement | Status | Notes |
| --- | --- | --- |
| Replace custom chat UX with Vercel AI SDK | ✅ | `/chartsmith-app/app/api/chat/route.ts` + `components/ChatContainer.tsx` stream via `streamText` and `useChat`. |
| Support Anthropic and OpenRouter providers | ✅ | `chartsmith-app/lib/llm/models*.ts` and Go `pkg/llm` detect model IDs and select the right SDK or REST flow. |
| Maintain chat history and prompts | ✅ | Workspace chat history is sourced from Postgres via `listMessagesForWorkspace`; prompts mirror the Go worker. |
| Keep Go worker flows intact while adding provider switching | ✅ | `pkg/llm/*` introduces OpenRouter-aware helpers without regressing Anthropic behavior. |
| Document the migration and its impact | ✅ | This README ties together the updated architecture, status, and dev workflow. |

Remaining work is tracked in `PROJECT_STATUS.md` (tests, demo artifacts, and optional cleanup), but the frontend and backend migrations requested in the plan are complete.

## Frontend Highlights

- **Chat API route** – `/chartsmith-app/app/api/chat/route.ts` validates sessions, loads workspace history, selects the correct provider (`createAnthropic` or `createOpenRouter`), and streams responses with `streamText`, persisting completions back into `workspace_chat`.
- **Chat container overhaul** – `chartsmith-app/components/ChatContainer.tsx` wraps the UI in `useChat`, manages provider + model selection, coordinates persistence via `createChatMessageAction`, cancellation via `cancelMessageAction`, and refreshes messages after streaming completes.
- **Provider abstraction** – `chartsmith-app/lib/llm/models.ts`, `models-openrouter.ts`, and `models-unified.ts` expose shared enums, defaults, and a `getModelProvider` helper so UI components, API routes, and server actions agree on model IDs.
- **Prompt + LLM utilities** – `chartsmith-app/lib/llm/prompt-type.ts` uses `generateText` from the AI SDK, keeping prompt rendering consistent with the worker.
- **Authentication guardrails** – API routes call `validateSession`, and UI components rely on `AuthContext` to ensure protected resources remain gated.

## Backend Highlights

- **Unified LLM client** – `pkg/llm/client.go` and `pkg/llm/openrouter.go` abstract Anthropic and OpenRouter usage. `isOpenRouterModel` lets every workflow decide whether to call Anthropic via the official SDK or OpenRouter via REST + tool-calling support.
- **Provider-aware workflows** – Conversational chat (`pkg/llm/conversational.go`), planning (`pkg/llm/plan.go`, `initial-plan.go`), execution (`pkg/llm/execute-plan.go`, `execute-action.go`), and conversion helpers (`conversion-normalize-values.go`, `new-conversion-file.go`) fall back to OpenRouter when the selected model indicates a provider prefix.
- **Worker orchestration** – `cmd/*.go`, `pkg/listener/*`, and `pkg/workspace/*` keep the single-worker design outlined in `ARCHITECTURE.md`, using PostgreSQL + pgvector for persistence and Centrifugo for realtime updates.
- **Environment-driven config** – `pkg/param/param.go` centralizes access to `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, database URIs, Centrifugo secrets, Google OAuth keys, and Slack tokens; the worker refuses to start without the required values.

## Local Development Workflow

1. **Install prerequisites** – Go ≥ 1.22, Node.js ≥ 20 (Next.js 16), npm or pnpm, Docker (for Postgres + Centrifugo via `hack/chartsmith-dev`).
2. **Start infrastructure** – `cd hack/chartsmith-dev && docker compose up -d` to spin up Postgres, Centrifugo, and supporting services. Run `make schema` to sync database tables and enable pgvector.
3. **Configure environment** – Copy `env.development.example` to `.env` at the repo root and set at least: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `VOYAGE_API_KEY`, `CHARTSMITH_PG_URI`, `CHARTSMITH_CENTRIFUGO_ADDRESS`, `CHARTSMITH_CENTRIFUGO_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CHARTSMITH_TOKEN_ENCRYPTION`, plus Slack tokens if notifications are needed. _Note: your `OPENROUTER_API_KEY` must have access to the `/api/v1/chat/completions` endpoint (model completions); keys that only work for `/models` will fail with `401 User not found`.*
4. **Run the worker** – `make run-worker` builds `bin/chartsmith-worker` and executes it with your exported environment.
5. **Run the web app** – `cd chartsmith-app && npm install && npm run dev` (use `npm run dev:clean` to regenerate `.next` and cache directories).
6. **Optional: VS Code extension** – `cd chartsmith-extension && npm install && npm run watch` to build the sidecar extension during development.

## Testing and Quality

- Frontend unit + integration tests: `cd chartsmith-app && npm run test` (Jest + Playwright).
- Backend integration tests: `make integration-test` (regenerates schema fixtures via SchemaHero, then runs worker integration suites).
- Debug console: `make run-debug-console` starts the Go REPL-like console for manual workspace operations.

## Deployment Artifacts

- **Helm chart** – `chart/chartsmith` packages the app, worker, Centrifugo, and Postgres dependencies for Kubernetes clusters.
- **Kustomize overlays** – `kustomize/` provides per-environment manifests (staging, production, worker-only, migrations, artifacthub cache).
- **Replicated / Dagger workflows** – `replicated/` + `dagger/` automate releases to vendor environments or Replicated.

## Reference Documents

- `PROJECT_STATUS.md` – project goals, success criteria, and remaining backlog items.
- `ARCHITECTURE.md` and `chartsmith-app/ARCHITECTURE.md` – system-wide and frontend-specific design guardrails.
- `CLAUDE.md` – LLM prompting guidelines.
- `design/*` – focused notes on Helm conversion and post-plan rendering.
- `CONTRIBUTING.md` – contribution workflow, coding standards, and environment setup tips.

If you are interested in contributing or being a maintainer on this project, please [open an issue](https://github.com/replicatedhq/chartsmith/issues/new). The combination of this README and the linked docs should give you everything you need to understand what changed in the latest iteration and how to extend it safely.

