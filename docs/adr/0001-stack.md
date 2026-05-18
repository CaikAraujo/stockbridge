# ADR 0001: Stack TypeScript full-stack

**Data:** 2026-05-18
**Status:** Aceito

## Contexto
Construção com auxílio de IA (Cursor). Solo dev. Single-tenant. Mobile + web.

## Decisão
TypeScript full-stack com Next.js 15, Drizzle, tRPC, Zod, shadcn/ui.

## Consequências
+ Uma linguagem em todo o projeto
+ Tipos compartilhados client/server
+ Ecossistema com mais código de treino para IA
+ Cursor otimizado para TS
− Lock-in moderado no ecossistema React/Next

## Alternativas consideradas
- Python/FastAPI + React separado (rejeitado: troca de contexto pesa em dev assistido por IA)
- Odoo Community (rejeitado pelo dono do projeto que quer custom)
