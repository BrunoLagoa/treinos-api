# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (`engine-strict=true`, Node 24 required).

```bash
pnpm dev                 # tsx --watch src/index.ts
pnpm lint                # eslint .
pnpm lint:fix
pnpm format              # prettier --write .
pnpm format:check
npx tsc --noEmit         # typecheck (no build script exists despite outDir: ./dist)
```

Database:

```bash
docker compose up -d                  # Postgres 16 on :5432 (db "treinos-api", postgres/password)
pnpm exec prisma generate             # regenerate client into src/generated/prisma
pnpm exec prisma db push              # apply schema (no migrations/ dir exists yet)
pnpm exec prisma studio
```

There is **no test framework configured** — no test runner, no test files, no `test` script. Do not invent test commands; if tests are needed, ask which runner to add first.

## Setup gotchas

- `src/generated/prisma` is **gitignored**. After a fresh clone or any `schema.prisma` change, `prisma generate` must run or nothing typechecks.
- Copy `.env.example` to `.env`. `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` are all required at runtime.
- Port precedence is inconsistent: `.env.example` suggests `PORT=3000`, but `src/index.ts` falls back to **8081**. Meanwhile CORS origin (`src/index.ts`) and better-auth `trustedOrigins` (`src/lib/auth.ts`) are hardcoded to `http://localhost:3000` — that value is the *frontend* origin, not this API's port.

## Architecture

Fastify 5 + Prisma 7 + better-auth, ESM-only, layered as `routes → usecases → prisma`.

**Request flow** (`src/routes/workout-plan.ts` is the reference implementation):
1. Route declares Zod schemas via `app.withTypeProvider<ZodTypeProvider>().route({...})` — this is what makes `request.body` typed and what feeds the OpenAPI doc.
2. Handler resolves the session with `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })` and 401s if absent. **Auth is per-route, not a global hook** — every new protected route must repeat this check.
3. Handler instantiates the use case and passes `session.user.id` as `userId`. The client never supplies `userId`; the request body schema is `WorkoutPlanSchema.omit({ id: true })`.
4. `try/catch` maps domain errors to HTTP: `NotFoundError` → 404, anything else → 500 with `{ error, code }`.

**Use cases** (`src/usecases/`) are classes with a single `execute()`. Their `Input*`/`Output*` interfaces live in the same file as the use case — they are that use case's contract, not shared domain types. Extract to a shared module only when a second consumer appears.

**Auth** (`src/lib/auth.ts`) is better-auth with the Prisma adapter and email/password enabled. `src/index.ts` bridges it to Fastify manually: a catch-all `GET|POST /api/auth/*` route converts the Fastify request into a Fetch `Request`, calls `auth.handler(req)`, and copies the Fetch `Response` back onto the reply. The better-auth models (`user`, `session`, `account`, `verification`) are `@@map`ped to lowercase table names in `schema.prisma`; do not rename them.

**Prisma client** (`src/lib/db.ts`) is a singleton cached on `globalThis` outside production, to survive `tsx --watch` reloads. Prisma 7 **requires a driver adapter** — `PrismaPg` from `@prisma/adapter-pg` — and the generator is `prisma-client` (not the legacy `prisma-client-js`), which is why imports come from `src/generated/prisma/client.js` rather than `@prisma/client`.

**Docs** are served by Scalar at `/docs`, sourcing two specs: `/swagger.json` (this API, produced by `@fastify/swagger` + `jsonSchemaTransform`) and `/api/auth/open-api/generate-schema` (better-auth's `openAPI()` plugin).

## Conventions

- ESM with `moduleResolution: nodenext` — **relative imports must carry the `.js` extension**, including into generated Prisma code (`../generated/prisma/enums.js`).
- Prettier: double quotes, semicolons, trailing commas, 80 cols, 2-space indent. ESLint enforces `simple-import-sort` on both imports and exports — a wrong import order is a lint error, not a style nit.
- Zod import style is inconsistent across the codebase (`zod/v4` in `src/index.ts`, `zod` in `src/schemas/index.ts`). Zod 4 is installed; prefer plain `zod`.
- Domain errors go in `src/errors/index.ts` as `Error` subclasses that set `this.name`; routes discriminate with `instanceof`.
- Shared Zod schemas live in `src/schemas/index.ts` and are reused for both body validation and response serialization.
- Commit messages follow Conventional Commits (`feat:`, `chore:`) in English.

## Prisma skills

`.claude/skills/` symlinks the official Prisma skill set (`prisma-cli`, `prisma-client-api`, `prisma-upgrade-v7`, etc.) from `.agents/skills/`, pinned in `skills-lock.json`. Prefer these over recalled Prisma knowledge — this project is on Prisma 7, where driver adapters are mandatory and the generator output path changed.
