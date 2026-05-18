# StockBridge

Sistema de gestão de estoque single-tenant — 1 depósito + 6 caminhões.

## Stack
Next.js 15 · TypeScript · Drizzle · PostgreSQL · tRPC · Zod · Auth.js v5 · Tailwind v4 · shadcn/ui · Dexie · Biome

## Pré-requisitos
- Node 22+
- pnpm 9+
- Docker Desktop

## Setup
```bash
pnpm install
cp .env.example .env  # edite com seus valores
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abre http://localhost:3000

## Scripts
- `pnpm dev` — desenvolvimento
- `pnpm build` — build prod
- `pnpm check` — lint + format
- `pnpm typecheck` — tsc
- `pnpm db:studio` — Drizzle Studio
- `pnpm db:generate` — nova migration
- `pnpm db:migrate` — aplica migrations
- `pnpm db:seed` — popula dev data

## Estrutura
Veja `AGENTS.md` para detalhes da arquitetura.

## Docs
- `docs/spec.md` — spec funcional
- `docs/adr/` — decisões arquiteturais
- `AGENTS.md` — guia para IA + convenções
