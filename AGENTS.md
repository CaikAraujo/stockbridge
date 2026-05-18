# StockBridge — Guia para IA

## O que é
Sistema single-tenant de gestão de estoque com 1 depósito central + 6 caminhões.
Painel admin desktop-only. PWA offline-first para motoristas.

## Stack
- Next.js 15 App Router + TypeScript strict (`noUncheckedIndexedAccess: true`)
- Drizzle ORM + PostgreSQL 16
- tRPC (typesafe end-to-end)
- Zod (validação compartilhada)
- Auth.js v5 (magic link + TOTP)
- Tailwind v4 + shadcn/ui
- Dexie.js + Workbox (PWA offline)
- Biome (lint + format)
- pnpm (gerenciador)

## Princípios não negociáveis
1. **stock_movements é append-only**. Nunca UPDATE, nunca DELETE. Saldo = SUM(quantityDelta).
2. **Toda mutation tem idempotencyKey**. Sem exceção.
3. **Toda procedure tRPC declara role mínima** via middleware (`adminProcedure`, `managerProcedure`, `driverProcedure`).
4. **Toda entrada é validada com Zod**. Schemas em `lib/schemas/`.
5. **Audit log automático** em toda mutation via middleware.
6. **Transferências são duplo-lançamento**: `transfer_out` na origem + `transfer_in` no destino, ligados por `transferId`.
7. **Nunca log de**: senha, token, pin, secret, apiKey, totpSecret.
8. **Painel admin é desktop-only** (min-width: 1024px). PWA é mobile-only.

## Estrutura
- `app/(admin)/` — painel desktop
- `app/(driver)/` — PWA mobile
- `server/routers/` — 1 router tRPC por entidade
- `server/services/` — lógica de negócio pura, testável
- `server/middleware/` — rbac, audit, idempotency
- `db/schema.ts` — fonte da verdade do schema
- `lib/schemas/` — Zod schemas compartilhados
- `docs/adr/` — Architecture Decision Records

## Convenções
- Arquivos no máximo 300 linhas. Maior que isso, refatore.
- Componentes React em PascalCase, hooks em camelCase com prefixo `use`.
- Server actions com sufixo `Action`. Procedures tRPC com verbo (`create`, `list`, `getById`).
- Datas sempre `timestamp with time zone`.
- IDs sempre UUID v4.

## Nunca
- Use `any`. Use `unknown` e refine com Zod.
- Concatene SQL. Use Drizzle queries.
- Confie em validação client-side. Valide no servidor sempre.
- Edite migration já aplicada. Crie nova.
- Use `dangerouslySetInnerHTML` sem `DOMPurify`.
- Faça commit com `.env`.

## Painel admin precisa mostrar
- Saída de estoque (o que, quem, quando, de onde)
- Saldo por caminhão (e por motorista atribuído)
- Histórico de movimentações filtrável
- Transferências pendentes e em trânsito
- Alertas de estoque baixo
- Audit log
