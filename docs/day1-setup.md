Visão geral do Dia 1
1. Pré-requisitos (ferramentas locais)
2. Cursor: conta + settings + modelo
3. Criar projeto Next.js 15 + TS strict
4. Configurar Biome + scripts
5. Estrutura de pastas
6. Docker Compose com Postgres
7. Instalar e configurar Drizzle
8. Schema inicial (com o que o admin precisa ver)
9. Migrations + seed
10. AGENTS.md
11. .cursor/rules/ (6 arquivos)
12. .cursorignore + .gitignore + .env.example
13. docs/spec.md mínimo
14. README.md
15. Git init + GitHub
16. Sanity check final

Passo 1 — Pré-requisitos (instalar local)
Instale nessa ordem. Se já tem algum, confirme a versão mínima.
1.1 Node.js (LTS mais recente)

Baixe de https://nodejs.org/ (versão LTS, não Current).
Verifica: node -v → deve mostrar v22.x ou superior.

1.2 pnpm
bashnpm install -g pnpm
pnpm -v   # confirma instalação
1.3 Docker Desktop

Baixe de https://www.docker.com/products/docker-desktop/
Abre o Docker Desktop e deixa rodando em background.
Verifica: docker --version e docker compose version.

1.4 Git

Mac: xcode-select --install ou via Homebrew.
Windows: https://git-scm.com/download/win
Linux: já vem.
Configure:

bashgit config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
git config --global init.defaultBranch main
1.5 Cursor IDE

Baixe de https://cursor.com/
Instale.

1.6 Cliente Postgres (opcional, mas recomendado)

TablePlus (Mac/Win, free tier) ou DBeaver (free, multiplataforma).
Usa para inspecionar o banco visualmente.


Passo 2 — Cursor: conta, plano, settings
2.1 Login

Abre o Cursor → Sign in.
Plano Pro vale a pena pelo acesso a modelos melhores e mais requests. Free serve para testar.

2.2 Modelo padrão

Settings (Cmd/Ctrl + ,) → Models.
Habilita: Claude Sonnet 4.6 (ou versão mais recente) como padrão para Chat e Composer.
Para tarefas pesadas de arquitetura, alterna para Claude Opus ou modelo de raciocínio disponível.

2.3 Privacy mode

Settings → General → Privacy Mode: ON. Garante que seu código não é usado para treino.

2.4 Extensões essenciais (instale no Cursor)
No painel lateral de Extensions, instala:

Biome (oficial)
Tailwind CSS IntelliSense
Prisma (não vamos usar Prisma, mas o syntax highlight ajuda em arquivos .sql às vezes — opcional)
Docker
GitLens
Error Lens
EditorConfig

2.5 Settings.json do Cursor
Abre Command Palette (Cmd/Ctrl + Shift + P) → "Preferences: Open User Settings (JSON)" e adiciona:
json{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit",
    "quickfix.biome": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true,
    "**/.turbo": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.next": true,
    "**/dist": true,
    "**/pnpm-lock.yaml": true
  }
}

Passo 3 — Criar o projeto
Abra o terminal numa pasta onde queira o projeto.
bashpnpm create next-app@latest stockbridge
Responda assim:

TypeScript? Yes
ESLint? No (vamos usar Biome)
Tailwind CSS? Yes
src/ directory? No (deixa flat, mais simples para IA)
App Router? Yes
Turbopack? Yes
Customize import alias? No (padrão @/* está bom)

Entra na pasta:
bashcd stockbridge
pnpm dev   # testa que sobe na :3000
Confirma que abre, depois Ctrl+C para parar.

Passo 4 — TypeScript strict + Biome
4.1 tsconfig.json — modo paranoid
Substitui o tsconfig.json por:
json{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
noUncheckedIndexedAccess: true é o que separa código profissional de amador. Vai te forçar a tratar undefined em todo acesso de array/objeto.
4.2 Instalar Biome
bashpnpm add -D @biomejs/biome
pnpm biome init
Substitui o biome.json gerado por:
json{
  "$schema": "https://biomejs.dev/schemas/2.0.0/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignoreUnknown": true,
    "ignore": [".next", "node_modules", "dist", "*.lock", "drizzle/**/*.sql"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "error" },
      "style": { "useImportType": "error", "useExportType": "error" },
      "correctness": { "noUnusedImports": "error", "noUnusedVariables": "error" }
    }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always", "trailingCommas": "all" }
  }
}
4.3 Scripts no package.json
Edita o package.json para ter esses scripts:
json{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check --write .",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx db/seed.ts"
  }
}
Rode pnpm typecheck — deve passar limpo.

Passo 5 — Estrutura de pastas
Cria toda a estrutura agora, mesmo vazia:
bashmkdir -p app/\(admin\) app/\(driver\) app/api/auth app/api/trpc
mkdir -p server/routers server/services server/middleware
mkdir -p db/migrations
mkdir -p lib/schemas lib/offline lib/utils lib/auth
mkdir -p components/ui components/admin components/driver
mkdir -p docs/adr
mkdir -p tests/unit tests/integration tests/e2e
mkdir -p scripts
mkdir -p .cursor/rules
mkdir -p public/icons
No Windows PowerShell, mesma coisa sem os escapes:
powershellmkdir app\(admin), app\(driver), app\api\auth, app\api\trpc
mkdir server\routers, server\services, server\middleware
mkdir db\migrations, lib\schemas, lib\offline, lib\utils, lib\auth
mkdir components\ui, components\admin, components\driver
mkdir docs\adr, tests\unit, tests\integration, tests\e2e
mkdir scripts, .cursor\rules, public\icons

Passo 6 — Docker Compose com Postgres
Cria docker-compose.yml na raiz:
yamlservices:
  postgres:
    image: postgres:16-alpine
    container_name: stockbridge-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: stockbridge
      POSTGRES_PASSWORD: dev_password_change_in_prod
      POSTGRES_DB: stockbridge
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U stockbridge']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
Sobe:
bashdocker compose up -d
docker compose ps   # confirma "healthy"

Passo 7 — Instalar Drizzle ORM
bashpnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg tsx dotenv
Cria drizzle.config.ts na raiz:
typescriptimport 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
Cria db/client.ts:
typescriptimport { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
export type DB = typeof db;

Passo 8 — Schema inicial (já pensando no painel admin)
Este é o coração do projeto. Estou pensando nas suas necessidades específicas: admin vê quem pegou o quê, quando, e quanto cada caminhão tem.
Cria db/schema.ts:
typescriptimport { sql } from 'drizzle-orm';
import {
  pgTable, uuid, text, integer, timestamp, boolean,
  jsonb, pgEnum, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';

// === Enums ===
export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'driver']);
export const locationTypeEnum = pgEnum('location_type', ['warehouse', 'truck']);
export const movementTypeEnum = pgEnum('movement_type', [
  'consumption',     // saída por consumo na operação
  'restock',         // entrada nova
  'transfer_out',    // saída por transferência
  'transfer_in',     // entrada por transferência
  'adjustment',      // ajuste manual
  'initial',         // saldo inicial
]);
export const transferStatusEnum = pgEnum('transfer_status', [
  'pending', 'in_transit', 'received', 'cancelled',
]);

// === Users ===
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: userRoleEnum('role').notNull().default('driver'),
  pinHash: text('pin_hash'),               // PIN soft para drivers
  totpSecret: text('totp_secret'),         // 2FA para admin/manager
  defaultLocationId: uuid('default_location_id'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// === Locations (1 warehouse + 6 trucks) ===
export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),       // 'WH-01', 'TRUCK-01'
  name: text('name').notNull(),                // 'Depósito Central', 'Caminhão João'
  type: locationTypeEnum('type').notNull(),
  assignedUserId: uuid('assigned_user_id').references(() => users.id),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// === Categories & Suppliers ===
export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
});

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contact: text('contact'),
});

// === Articles ===
export const articles = pgTable('articles', {
  id: uuid('id').primaryKey().defaultRandom(),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode').unique(),
  name: text('name').notNull(),
  unit: text('unit').notNull().default('un'),  // 'un', 'm', 'kg'
  categoryId: uuid('category_id').references(() => categories.id),
  supplierId: uuid('supplier_id').references(() => suppliers.id),
  photoUrl: text('photo_url'),
  minStock: integer('min_stock').default(0).notNull(),
  reorderPoint: integer('reorder_point').default(0).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  barcodeIdx: index('articles_barcode_idx').on(t.barcode),
}));

// === Stock Movements (append-only, sagrado) ===
export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  articleId: uuid('article_id').references(() => articles.id).notNull(),
  locationId: uuid('location_id').references(() => locations.id).notNull(),
  quantityDelta: integer('quantity_delta').notNull(),  // negativo = saída
  movementType: movementTypeEnum('movement_type').notNull(),
  transferId: uuid('transfer_id'),
  reason: text('reason'),
  notes: text('notes'),
  photoUrl: text('photo_url'),
  // === Campos críticos para o painel admin ===
  createdBy: uuid('created_by').references(() => users.id).notNull(),  // QUEM pegou
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(), // QUANDO
  deviceCreatedAt: timestamp('device_created_at', { withTimezone: true }),  // quando aconteceu fisicamente (offline)
  idempotencyKey: text('idempotency_key').notNull().unique(),
}, (t) => ({
  articleLocationIdx: index('movements_article_location_idx').on(t.articleId, t.locationId),
  createdAtIdx: index('movements_created_at_idx').on(t.createdAt),
  createdByIdx: index('movements_created_by_idx').on(t.createdBy),
  locationCreatedAtIdx: index('movements_location_created_at_idx').on(t.locationId, t.createdAt),
}));

// === Stock Levels (snapshot, atualizado por trigger ou aplicação) ===
export const stockLevels = pgTable('stock_levels', {
  articleId: uuid('article_id').references(() => articles.id).notNull(),
  locationId: uuid('location_id').references(() => locations.id).notNull(),
  quantity: integer('quantity').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.articleId, t.locationId] }),
}));

// === Transfers ===
export const transfers = pgTable('transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromLocationId: uuid('from_location_id').references(() => locations.id).notNull(),
  toLocationId: uuid('to_location_id').references(() => locations.id).notNull(),
  status: transferStatusEnum('status').notNull().default('pending'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  receivedBy: uuid('received_by').references(() => users.id),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const transferItems = pgTable('transfer_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  transferId: uuid('transfer_id').references(() => transfers.id).notNull(),
  articleId: uuid('article_id').references(() => articles.id).notNull(),
  quantityShipped: integer('quantity_shipped').notNull(),
  quantityReceived: integer('quantity_received'),
});

// === Audit Log ===
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),          // 'movement.create', 'article.update'
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payload: jsonb('payload'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  entityIdx: index('audit_entity_idx').on(t.entityType, t.entityId),
  userIdx: index('audit_user_idx').on(t.userId, t.createdAt),
}));

// === Sessions (Auth.js) ===
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// === Idempotency Store ===
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  userId: uuid('user_id').references(() => users.id),
  response: jsonb('response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
Como o painel admin vai responder o que você descreveu:
Pergunta do adminQuery (conceitual)O que saiu do estoque hoje?stockMovements WHERE movementType='consumption' AND createdAt::date = todayQuem pegou o quê?JOIN movements → users (via createdBy) → articlesQuando pegou?movements.createdAt (servidor) ou deviceCreatedAt (físico real)Quanto cada caminhão tem?stockLevels JOIN locations WHERE type='truck', agrupado por locationQuanto o caminhão do João tem?stockLevels JOIN locations ON assignedUserId = joão.id

Passo 9 — Variáveis de ambiente
Cria .env (NÃO COMMITAR):
envDATABASE_URL=postgres://stockbridge:dev_password_change_in_prod@localhost:5432/stockbridge
AUTH_SECRET=run-pnpm-dlx-auth-secret-to-generate
RESEND_API_KEY=re_placeholder_for_now
APP_URL=http://localhost:3000
NODE_ENV=development
Cria .env.example (commita esse):
envDATABASE_URL=postgres://user:pass@localhost:5432/dbname
AUTH_SECRET=
RESEND_API_KEY=
APP_URL=http://localhost:3000
NODE_ENV=development

Passo 10 — Gera primeira migration
bashpnpm db:generate
pnpm db:migrate
Verifica no TablePlus/DBeaver conectando em localhost:5432, user stockbridge, senha do .env. Deve ver todas as tabelas.

Passo 11 — Seed de desenvolvimento
Cria db/seed.ts:
typescriptimport 'dotenv/config';
import { db } from './client';
import { users, locations, articles, stockLevels } from './schema';

async function seed() {
  console.log('🌱 Seeding...');

  // Admin
  const [admin] = await db.insert(users).values({
    email: 'admin@stockbridge.local',
    name: 'Admin',
    role: 'admin',
  }).returning();

  // Depósito central
  const [warehouse] = await db.insert(locations).values({
    code: 'WH-01',
    name: 'Depósito Central',
    type: 'warehouse',
  }).returning();

  // 6 motoristas + 6 caminhões
  const driverNames = ['João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Lucia'];
  for (let i = 0; i < 6; i++) {
    const [driver] = await db.insert(users).values({
      email: `driver${i + 1}@stockbridge.local`,
      name: driverNames[i]!,
      role: 'driver',
    }).returning();

    await db.insert(locations).values({
      code: `TRUCK-${String(i + 1).padStart(2, '0')}`,
      name: `Caminhão ${driverNames[i]}`,
      type: 'truck',
      assignedUserId: driver!.id,
    });
  }

  console.log('✅ Seed done.');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
Roda:
bashpnpm db:seed

Passo 12 — AGENTS.md (o arquivo mais importante)
Cria AGENTS.md na raiz. Cursor lê isso automaticamente.
markdown# StockBridge — Guia para IA

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

Passo 13 — .cursor/rules/ (6 arquivos)
Esses arquivos disciplinam a IA. Use formato MDC.
13.1 .cursor/rules/project.mdc (sempre ativo)
markdown---
description: Convenções globais do projeto
alwaysApply: true
---
- Stack: Next.js 15 App Router, TS strict, Drizzle, tRPC, Zod, Tailwind v4, shadcn/ui, Auth.js v5
- pnpm é o gerenciador. Nunca sugira npm ou yarn.
- Arquivos ≤ 300 linhas. Se passar, refatore.
- Sem `any`. Use `unknown` + Zod.
- Datas: `timestamp with time zone`. IDs: UUID v4.
- Imports: type imports sempre com `import type`.
- Commits seguem Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`).
13.2 .cursor/rules/schema.mdc
markdown---
description: Regras para schema, migrations, Zod
globs: db/**/*.ts, lib/schemas/**/*.ts
---
- Source of truth do schema: `db/schema.ts`. Tudo deriva dele.
- Toda mudança gera migration nova via `pnpm db:generate`. Nunca edite migration aplicada.
- Todo Zod schema vive em `lib/schemas/`. Reutilizável client + server.
- Use `createInsertSchema` e `createSelectSchema` do `drizzle-zod` quando aplicável.
- Naming: tabelas plural snake_case no SQL, camelCase no TS. Drizzle cuida.
- Soft delete via campo `active: boolean` quando aplicável. Hard delete só em audit_log e idempotencyKeys com job de limpeza.
13.3 .cursor/rules/backend.mdc
markdown---
description: tRPC routers, services, middleware
globs: server/**/*.ts, app/api/**/*.ts
---
- Toda procedure declara role: `adminProcedure`, `managerProcedure`, `driverProcedure`, `publicProcedure`.
- `publicProcedure` proibido para mutations.
- Input sempre `.input(zodSchema)`. Sem exceção.
- Mutations sempre aceitam `idempotencyKey: z.string().uuid()`. Middleware verifica antes de executar.
- Errors com `TRPCError` tipado: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`.
- Business logic em `services/`, não em routers. Routers só orquestram.
- Toda mutation registra audit log via middleware.
- `stock_movements` é append-only. Nunca UPDATE/DELETE.
- Transferência gera 2 movements com mesmo `transferId`.
13.4 .cursor/rules/admin.mdc
markdown---
description: Painel admin — desktop only
globs: app/(admin)/**/*.tsx, components/admin/**/*.tsx
---
- Layout desktop-only. Use `min-w-[1024px]` no root. Mostre aviso amigável em telas menores.
- Use shadcn/ui Data Tables para listagens com filtro, sort, pagination, export CSV.
- Filtros padrão: data range, location, user, article, movement type.
- Toda tabela de movimentações mostra colunas: data/hora, tipo, artigo, quantidade, location, usuário (createdBy), motivo.
- Saldo por caminhão: card por location tipo 'truck' com motorista atribuído e total de SKUs/unidades.
- Forms usam React Hook Form + Zod resolver com schemas de `lib/schemas/`.
- Charts: Recharts. Sem libs pesadas.
- Atalhos de teclado: `/` para focar busca, `n` para nova entrada, `Esc` para fechar modal.
13.5 .cursor/rules/driver.mdc
markdown---
description: PWA do motorista — mobile only, offline-first
globs: app/(driver)/**/*.tsx, lib/offline/**/*.ts, components/driver/**/*.tsx
---
- Layout mobile-only. Viewport máx 640px.
- Toda ação otimista: UI atualiza imediatamente, sync em background.
- Toda mutation gera `idempotencyKey` local (UUID v4) antes de tocar IndexedDB.
- Fila offline em Dexie tabela `pending_mutations`.
- Indicador de status online/offline + contador de fila sempre visível no header.
- Botões grandes (mínimo 48px de altura), targets tocáveis. Sem hover-only.
- Scanner de barcode em rota dedicada com câmera fullscreen.
- Auth via magic link. PIN soft de 4 dígitos para confirmar ações sensíveis.
13.6 .cursor/rules/security.mdc (sempre ativo)
markdown---
description: Segurança não-negociável
alwaysApply: true
---
- Nunca commite arquivos `.env*` exceto `.env.example`.
- Nunca logue: password, token, pin, secret, apiKey, totpSecret, idempotencyKey de outro user.
- Toda input do usuário passa por Zod antes de tocar DB.
- Drizzle queries só. Nunca raw SQL com interpolação de string.
- Cookies: httpOnly + sameSite='lax' + secure em produção.
- Headers obrigatórios em produção: HSTS, CSP, X-Content-Type-Options, Referrer-Policy.
- Rate limit em toda procedure pública e em login.
- 2FA (TOTP) obrigatório para admin e manager.
- Senhas/PINs com argon2id. Nunca bcrypt para novos hashes.
- Sessões em DB (não JWT puro). Rotação em mudança de role.
- Toda mutation registra audit_log: userId, action, entityType, entityId, ip, userAgent.

Passo 14 — .cursorignore
Cria .cursorignore na raiz:
node_modules
.next
dist
build
coverage
.turbo
*.log
pnpm-lock.yaml
.env
.env.local
.env.production
db/migrations/*.sql
public/icons
.vercel

Passo 15 — .gitignore
Substitui o .gitignore por:
# deps
node_modules
.pnpm-store

# build
.next
dist
build
out

# env
.env
.env.local
.env*.local
!.env.example

# logs
*.log
npm-debug.log*
pnpm-debug.log*

# editor
.vscode
.idea
.cursor/cache

# os
.DS_Store
Thumbs.db

# test
coverage
.nyc_output
playwright-report
test-results

# misc
.turbo
.vercel
*.tsbuildinfo
next-env.d.ts

Passo 16 — docs/spec.md mínimo
Cria docs/spec.md:
markdown# StockBridge — Spec v0.1

## Resumo
Sistema single-tenant de gestão de estoque para operação de campo. 1 depósito central + 6 caminhões. Painel admin desktop para o gestor, PWA offline-first para motoristas.

## Atores
- **Admin**: configura artigos, locations, usuários. Vê tudo. Aprova ajustes.
- **Manager**: opera o depósito. Recebe entradas, despacha transferências.
- **Driver**: opera o caminhão. Consome itens em campo, recebe transferências, faz inventário.

## Casos de uso principais
1. Admin cadastra artigo (SKU, barcode, foto, ponto de reposição).
2. Manager registra entrada nova no depósito.
3. Manager cria transferência depósito → caminhão.
4. Driver recebe transferência no caminhão.
5. Driver consome item em campo (scan barcode, confirma quantidade).
6. Driver ajusta inventário com motivo + foto quando físico diverge.
7. Admin visualiza dashboard com saídas do dia, saldo por caminhão, alertas.
8. Admin filtra movimentações por data, location, user, artigo.
9. Admin exporta relatório CSV.

## Painel admin — telas mínimas v1
- Dashboard (saídas hoje, alertas, saldo resumido por location)
- Movimentações (tabela filtrável + export)
- Artigos (CRUD + import CSV)
- Locations (lista das 7, edição de atribuição)
- Caminhões (card por caminhão com motorista, saldo total, top 10 SKUs)
- Transferências (criar, acompanhar, conferir)
- Usuários (CRUD, atribuição de truck)
- Audit log (auditoria de tudo)

## PWA driver — telas mínimas v1
- Home (location atual, resumo)
- Scan & saída (consumption)
- Receber transferência
- Ajuste com foto
- Inventário cíclico
- Histórico do dia

Passo 17 — README.md
Substitui o README.md:
markdown# StockBridge

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

Passo 18 — Primeira ADR
Cria docs/adr/0001-stack.md:
markdown# ADR 0001: Stack TypeScript full-stack

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

Passo 19 — Git init + GitHub
bashgit init
git add .
git commit -m "chore: bootstrap project (Day 1 setup)"
Cria repo no GitHub (privado), depois:
bashgit remote add origin git@github.com:seu-user/stockbridge.git
git branch -M main
git push -u origin main

Passo 20 — Sanity check final do Dia 1
Marca cada item:

 pnpm dev sobe sem erros em http://localhost:3000
 pnpm typecheck passa limpo
 pnpm check passa limpo
 docker compose ps mostra stockbridge-postgres como healthy
 Drizzle Studio (pnpm db:studio) abre e mostra todas as tabelas
 Seed criou admin + 6 drivers + 1 warehouse + 6 trucks
 Cursor mostra AGENTS.md sendo lido (testa: abre chat e pergunta "qual o stack do projeto?" — deve responder corretamente)
 .env NÃO está no GitHub (git ls-files | grep -i env só deve mostrar .env.example)
 Repo no GitHub privado, push funcionou
 Você consegue explicar em 1 frase o que está em cada pasta

Se algum desses falha, não passa para o Dia 2. Resolve antes.