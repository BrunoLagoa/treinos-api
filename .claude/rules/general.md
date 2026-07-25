# Regras Gerais

## Comunicação

- **SEMPRE** responda em português (Brasil), com acentuação correta.
- Termos técnicos, nomes de arquivos, identificadores de código e mensagens de commit permanecem em inglês.

## Ambiente

- O package manager é o **pnpm** (`engine-strict=true`, Node 24). **NUNCA** use `npm install` ou `yarn`.
- **NUNCA** invente comandos de build ou teste. Este projeto não tem script de `build` nem framework de testes configurado — se testes forem necessários, pergunte antes qual runner adicionar.
- Para typecheck, use `npx tsc --noEmit`.

## Prisma

- Este projeto está no **Prisma 7**: driver adapter (`PrismaPg`) é obrigatório e o generator é `prisma-client`, com output em `src/generated/prisma` (gitignored).
- **SEMPRE** rode `pnpm exec prisma generate` após qualquer alteração em `prisma/schema.prisma`.
- Ainda **não existe** diretório `prisma/migrations/`. Use `pnpm exec prisma db push` para aplicar o schema.
- **SEMPRE** prefira as skills oficiais do Prisma em `.claude/skills/` (`prisma-cli`, `prisma-client-api`, `prisma-upgrade-v7` etc.) ao invés de conhecimento recuperado de memória.

## MCPs

- **SEMPRE** use o **Context7** para buscar documentação de bibliotecas, frameworks e CLIs (Fastify, Prisma, better-auth, Zod etc.), mesmo quando achar que já sabe a resposta.
