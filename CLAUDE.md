# CLAUDE.md

Este arquivo orienta o Claude Code (claude.ai/code) ao trabalhar com o código deste repositório.

## Regras do projeto

As regras abaixo são obrigatórias e complementam este arquivo. Em caso de conflito, **as regras têm precedência sobre o CLAUDE.md**.

@.claude/rules/general.md
@.claude/rules/architecture.md
@.claude/rules/typescript.md

- `general.md` — idioma, ambiente (pnpm/Node 24), fluxo do Prisma 7 e uso obrigatório do Context7.
- `architecture.md` — Git (Conventional Commits, nunca commitar sem permissão), rotas Fastify e use cases, com exemplos completos de referência.
- `typescript.md` — princípios de TypeScript, funções, nomenclatura, datas e Zod. Aplica-se a `**/*.ts` (via frontmatter `paths`).

## Visão geral

API de treinos em Fastify 5 + TypeScript + Prisma 7 + better-auth, ESM-only. Node 24 e pnpm são obrigatórios (`engine-strict=true` no `.npmrc`).

## Comandos

```bash
pnpm dev                 # tsx --watch src/index.ts
pnpm lint                # eslint .
pnpm lint:fix
pnpm format              # prettier --write .
pnpm format:check
npx tsc --noEmit         # typecheck (não existe script de build, apesar do outDir: ./dist)
```

Banco de dados:

```bash
docker compose up -d                  # Postgres 16 na :5432 (db "treinos-api", postgres/password)
pnpm exec prisma generate             # regenera o client em src/generated/prisma
pnpm exec prisma db push              # aplica o schema (ainda não existe diretório migrations/)
pnpm exec prisma studio
```

**Não há framework de testes configurado** — sem test runner, sem arquivos de teste, sem script `test`. Não invente comandos de teste; se testes forem necessários, pergunte antes qual runner adicionar.

## Setup — pontos de atenção

- `src/generated/prisma` está **gitignored**. Depois de um clone novo ou de qualquer mudança no `schema.prisma`, é preciso rodar `prisma generate` ou nada typecheca.
- Copie `.env.example` para `.env`. `DATABASE_URL`, `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL` são obrigatórios em runtime.
- A precedência de porta é inconsistente: `.env.example` sugere `PORT=3000`, mas `src/index.ts` usa fallback **8081**. Já o origin do CORS (`src/index.ts`) e o `trustedOrigins` do better-auth (`src/lib/auth.ts`) estão fixos em `http://localhost:3000` — esse valor é a origem do _frontend_, não a porta desta API.

## Arquitetura

Camadas: `routes → usecases → prisma`.

**Fluxo de request** (`src/routes/workout-plan.ts` é a implementação de referência):

1. A rota declara schemas Zod via `app.withTypeProvider<ZodTypeProvider>().route({...})` — é isso que tipa `request.body` e alimenta o doc OpenAPI.
2. O handler resolve a sessão com `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })` e responde 401 se não houver. **A autenticação é por rota, não um hook global** — toda rota protegida nova precisa repetir essa checagem.
3. O handler instancia o use case e passa `session.user.id` como `userId`. O cliente nunca envia `userId`; o schema do body é `WorkoutPlanSchema.omit({ id: true })`.
4. `try/catch` mapeia erros de domínio para HTTP: `NotFoundError` → 404, qualquer outro → 500 com `{ error, code }`.

**Use cases** (`src/usecases/`) são classes com um único `execute()`. As interfaces `InputDto`/`OutputDto` ficam no mesmo arquivo do use case — são o contrato daquele use case, não tipos de domínio compartilhados. Nunca retorne o model do Prisma direto; mapeie para o `OutputDto`.

**Auth** (`src/lib/auth.ts`) é better-auth com adaptador Prisma e email/senha habilitado. O `src/index.ts` faz a ponte com o Fastify manualmente: uma rota catch-all `GET|POST /api/auth/*` converte o request Fastify em um `Request` da Fetch API, chama `auth.handler(req)` e copia a `Response` de volta para o reply. Os models do better-auth (`user`, `session`, `account`, `verification`) são `@@map`eados para tabelas em minúsculo no `schema.prisma`; não renomeie.

**Prisma client** (`src/lib/db.ts`) é um singleton cacheado em `globalThis` fora de produção, para sobreviver aos reloads do `tsx --watch`. O Prisma 7 **exige driver adapter** — `PrismaPg` de `@prisma/adapter-pg` — e o generator é `prisma-client` (não o legado `prisma-client-js`), por isso os imports vêm de `src/generated/prisma/client.js` e não de `@prisma/client`.

**Docs** são servidas pelo Scalar em `/docs`, com dois specs: `/swagger.json` (esta API, via `@fastify/swagger` + `jsonSchemaTransform`) e `/api/auth/open-api/generate-schema` (plugin `openAPI()` do better-auth).

## Convenções

- ESM com `moduleResolution: nodenext` — **imports relativos precisam da extensão `.js`**, inclusive para o código gerado do Prisma (`../generated/prisma/enums.js`).
- Prettier: aspas duplas, ponto e vírgula, trailing commas, 80 colunas, indentação de 2 espaços. O ESLint aplica `simple-import-sort` em imports e exports — ordem errada é erro de lint, não detalhe de estilo.
- Zod 4: **SEMPRE** importe de `zod`, nunca de `zod/v4` nem de `zod/v3`.
- Erros de domínio ficam em `src/errors/index.ts` como subclasses de `Error` que setam `this.name`; as rotas discriminam com `instanceof`.
- Schemas Zod compartilhados ficam em `src/schemas/index.ts` e são reusados tanto na validação do body quanto na serialização da resposta (inclusive `ErrorSchema` para as respostas de erro).
- Mensagens de commit seguem Conventional Commits (`feat:`, `chore:`) em inglês.

## Skills do Prisma

`.claude/skills/` linka o conjunto oficial de skills do Prisma (`prisma-cli`, `prisma-client-api`, `prisma-upgrade-v7` etc.) a partir de `.agents/skills/`, pinado em `skills-lock.json`. Prefira essas skills à memória sobre Prisma — este projeto está no Prisma 7, onde driver adapters são obrigatórios e o caminho de output do generator mudou.
