import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['admin', 'manager', 'driver']);

export const locationTypeEnum = pgEnum('location_type', ['warehouse', 'truck']);

export const movementTypeEnum = pgEnum('movement_type', [
  'consumption', // saída por consumo na operação (instalação/manutenção)
  'restock', // entrada nova (compra do fornecedor)
  'transfer_out', // saída por transferência
  'transfer_in', // entrada por transferência
  'adjustment', // ajuste manual após contagem
  'initial', // saldo inicial
  'return', // devolução (cliente devolveu peça/sobra de obra)
]);

export const transferStatusEnum = pgEnum('transfer_status', [
  'pending',
  'in_transit',
  'received',
  'cancelled',
]);

// Unidades padronizadas — crítico para refrigeração
export const unitEnum = pgEnum('unit', [
  'un', // unidade (peças, conectores, válvulas)
  'pc', // peça
  'cx', // caixa
  'kg', // quilograma (gás refrigerante)
  'g', // grama (componentes pequenos por massa)
  'l', // litro (óleo lubrificante)
  'ml', // mililitro
  'm', // metro (tubo, cabo, isolamento)
  'cm', // centímetro
  'rl', // rolo
  'par', // par (luvas, conectores casados)
]);

export const jobStatusEnum = pgEnum('job_status', ['open', 'in_progress', 'closed', 'cancelled']);

export const stockCountStatusEnum = pgEnum('stock_count_status', [
  'draft',
  'finalized',
  'cancelled',
]);

// ============================================================
// USERS
// ============================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // email opcional — drivers podem entrar só com PIN. Unique parcial (Postgres trata NULLs como distintos por padrão).
    email: text('email').unique(),
    emailVerified: timestamp('email_verified', { withTimezone: true }),
    image: text('image'),
    phone: text('phone'),
    name: text('name').notNull(),
    role: userRoleEnum('role').notNull().default('driver'),
    pinHash: text('pin_hash'), // PIN para driver
    totpSecret: text('totp_secret'), // 2FA para admin/manager
    // FK declarada fora do pgTable porque há ciclo com locations
    defaultLocationId: uuid('default_location_id'),
    active: boolean('active').notNull().default(true),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    roleActiveIdx: index('users_role_active_idx').on(t.role, t.active),
  }),
);

// ============================================================
// LOCATIONS (1 depósito + 6 caminhões)
// ============================================================

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // 'WH-01', 'TRUCK-01'
    name: text('name').notNull(), // 'Depósito Central', 'Caminhão João'
    type: locationTypeEnum('type').notNull(),
    assignedUserId: uuid('assigned_user_id').references(() => users.id),
    plate: text('plate'), // placa do caminhão
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeActiveIdx: index('locations_type_active_idx').on(t.type, t.active),
    assignedUserIdx: index('locations_assigned_user_idx').on(t.assignedUserId),
  }),
);

// Resolve a referência circular users.defaultLocationId -> locations.id
// (a FK efetiva é criada via migration manual com DEFERRABLE INITIALLY DEFERRED;
//  ver instruções no rodapé deste arquivo).

// ============================================================
// CATEGORIES & SUPPLIERS
// ============================================================

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contact: text('contact'),
  phone: text('phone'),
  email: text('email'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================
// ARTICLES
// ============================================================

export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: text('sku').notNull().unique(),
    barcode: text('barcode').unique(),
    name: text('name').notNull(),
    description: text('description'),
    unit: unitEnum('unit').notNull().default('un'),
    categoryId: uuid('category_id').references(() => categories.id),
    supplierId: uuid('supplier_id').references(() => suppliers.id),
    photoUrl: text('photo_url'),

    // Custos em centavos (inteiro evita float). Bigint não é necessário aqui — integer cobre até R$ 21M por item.
    costPriceCents: integer('cost_price_cents'),
    salePriceCents: integer('sale_price_cents'),

    // Limites — numeric para artigos fracionários (kg, m, l)
    minStock: numeric('min_stock', { precision: 14, scale: 3 }).notNull().default('0'),
    reorderPoint: numeric('reorder_point', { precision: 14, scale: 3 }).notNull().default('0'),

    // Refrigerante específico: tipo de gás (R-410A, R-32, R-22), opcional mas útil para relatórios
    refrigerantType: text('refrigerant_type'),

    active: boolean('active').notNull().default(true),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    barcodeIdx: index('articles_barcode_idx').on(t.barcode),
    activeNameIdx: index('articles_active_name_idx').on(t.active, t.name),
    categoryIdx: index('articles_category_idx').on(t.categoryId),
    supplierIdx: index('articles_supplier_idx').on(t.supplierId),
    // NOTA: trigram (pg_trgm) em name deve ser criado via SQL raw na migration:
    //   CREATE EXTENSION IF NOT EXISTS pg_trgm;
    //   CREATE INDEX articles_name_trgm_idx ON articles USING gin (name gin_trgm_ops);
  }),
);

// ============================================================
// JOBS (obras / ordens de serviço)
// ============================================================

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // 'OS-2026-0001'
    clientName: text('client_name').notNull(),
    clientAddress: text('client_address'),
    clientPhone: text('client_phone'),
    description: text('description'),
    status: jobStatusEnum('status').notNull().default('open'),
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusCreatedAtIdx: index('jobs_status_created_at_idx').on(t.status, t.createdAt.desc()),
    clientNameIdx: index('jobs_client_name_idx').on(t.clientName),
    createdByIdx: index('jobs_created_by_idx').on(t.createdBy),
  }),
);

// ============================================================
// STOCK MOVEMENTS (append-only, sagrado)
// ============================================================

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id')
      .references(() => articles.id)
      .notNull(),
    locationId: uuid('location_id')
      .references(() => locations.id)
      .notNull(),

    // CRÍTICO: numeric com 3 casas — gás em kg, tubo em m, óleo em l
    quantityDelta: numeric('quantity_delta', { precision: 14, scale: 3 }).notNull(),

    movementType: movementTypeEnum('movement_type').notNull(),
    transferId: uuid('transfer_id').references(() => transfers.id),
    jobId: uuid('job_id').references(() => jobs.id),

    // Snapshot do custo NO MOMENTO do movimento — preço muda com o tempo, relatórios precisam do valor histórico
    unitCostCents: integer('unit_cost_cents'),

    reason: text('reason'),
    notes: text('notes'),
    photoUrl: text('photo_url'),

    // === Painel admin ===
    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deviceCreatedAt: timestamp('device_created_at', { withTimezone: true }),

    // === PWA offline tracking ===
    clientId: text('client_id'), // ID do device (IndexedDB)
    appVersion: text('app_version'),

    // === Soft-void (estorno sem apagar histórico) ===
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedBy: uuid('voided_by').references(() => users.id),
    voidReason: text('void_reason'),

    // Idempotência: escopada por usuário, não global
    idempotencyKey: text('idempotency_key').notNull(),
  },
  (t) => ({
    articleLocationIdx: index('movements_article_location_idx').on(t.articleId, t.locationId),
    createdAtIdx: index('movements_created_at_idx').on(t.createdAt.desc()),
    locationCreatedAtIdx: index('movements_location_created_at_idx').on(
      t.locationId,
      t.createdAt.desc(),
    ),
    createdByCreatedAtIdx: index('movements_created_by_created_at_idx').on(
      t.createdBy,
      t.createdAt.desc(),
    ),
    typeCreatedAtIdx: index('movements_type_created_at_idx').on(t.movementType, t.createdAt.desc()),
    transferIdx: index('movements_transfer_idx').on(t.transferId),
    jobIdx: index('movements_job_idx').on(t.jobId),
    // Idempotência por usuário
    idempotencyUniq: uniqueIndex('movements_idempotency_uniq').on(t.createdBy, t.idempotencyKey),
  }),
);

// ============================================================
// STOCK LEVELS (snapshot — atualizado por trigger SQL)
// ============================================================

export const stockLevels = pgTable(
  'stock_levels',
  {
    articleId: uuid('article_id')
      .references(() => articles.id)
      .notNull(),
    locationId: uuid('location_id')
      .references(() => locations.id)
      .notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull().default('0'),
    // Quantidade reservada (transferências pending, separações para obras) — não disponível para venda mas ainda existe
    reservedQuantity: numeric('reserved_quantity', { precision: 14, scale: 3 })
      .notNull()
      .default('0'),
    version: integer('version').notNull().default(0), // optimistic locking
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.articleId, t.locationId] }),
    // CRÍTICO: query "quanto tem o caminhão X" filtra por locationId — não usa a PK (que começa por articleId)
    locationIdx: index('stock_levels_location_idx').on(t.locationId),
  }),
);

// ============================================================
// TRANSFERS
// ============================================================

export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // 'TRF-2026-0001'
    fromLocationId: uuid('from_location_id')
      .references(() => locations.id)
      .notNull(),
    toLocationId: uuid('to_location_id')
      .references(() => locations.id)
      .notNull(),
    status: transferStatusEnum('status').notNull().default('pending'),

    createdBy: uuid('created_by')
      .references(() => users.id)
      .notNull(),
    shippedBy: uuid('shipped_by').references(() => users.id),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    receivedBy: uuid('received_by').references(() => users.id),
    receivedAt: timestamp('received_at', { withTimezone: true }),

    cancelledBy: uuid('cancelled_by').references(() => users.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),

    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusCreatedAtIdx: index('transfers_status_created_at_idx').on(t.status, t.createdAt.desc()),
    fromStatusIdx: index('transfers_from_status_idx').on(t.fromLocationId, t.status),
    toStatusIdx: index('transfers_to_status_idx').on(t.toLocationId, t.status),
  }),
);

export const transferItems = pgTable(
  'transfer_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transferId: uuid('transfer_id')
      .references(() => transfers.id)
      .notNull(),
    articleId: uuid('article_id')
      .references(() => articles.id)
      .notNull(),
    quantityShipped: numeric('quantity_shipped', { precision: 14, scale: 3 }).notNull(),
    quantityReceived: numeric('quantity_received', { precision: 14, scale: 3 }),
    discrepancyReason: text('discrepancy_reason'), // 'broken', 'missing', 'extra', 'leak' (gás)
  },
  (t) => ({
    transferIdx: index('transfer_items_transfer_idx').on(t.transferId),
    articleIdx: index('transfer_items_article_idx').on(t.articleId),
  }),
);

// ============================================================
// STOCK COUNTS (contagem física / inventário)
// ============================================================

export const stockCounts = pgTable(
  'stock_counts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // 'INV-2026-001'
    locationId: uuid('location_id')
      .references(() => locations.id)
      .notNull(),
    performedBy: uuid('performed_by')
      .references(() => users.id)
      .notNull(),
    status: stockCountStatusEnum('status').notNull().default('draft'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    notes: text('notes'),
  },
  (t) => ({
    locationStatusIdx: index('stock_counts_location_status_idx').on(t.locationId, t.status),
    performedByIdx: index('stock_counts_performed_by_idx').on(t.performedBy),
  }),
);

export const stockCountItems = pgTable(
  'stock_count_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    countId: uuid('count_id')
      .references(() => stockCounts.id)
      .notNull(),
    articleId: uuid('article_id')
      .references(() => articles.id)
      .notNull(),
    expectedQty: numeric('expected_qty', { precision: 14, scale: 3 }).notNull(),
    countedQty: numeric('counted_qty', { precision: 14, scale: 3 }).notNull(),
    adjustmentMovementId: uuid('adjustment_movement_id').references(() => stockMovements.id),
    notes: text('notes'),
  },
  (t) => ({
    countIdx: index('stock_count_items_count_idx').on(t.countId),
    articleIdx: index('stock_count_items_article_idx').on(t.articleId),
  }),
);

// ============================================================
// AUDIT LOG
// ============================================================

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(), // 'movement.create', 'article.update'
    entityType: text('entity_type').notNull(),
    entityUuid: uuid('entity_uuid'), // tipado quando aplicável
    entityKey: text('entity_key'), // fallback para chaves não-uuid (ex: sessions.id)
    payload: jsonb('payload'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    entityIdx: index('audit_entity_idx').on(t.entityType, t.entityUuid),
    userCreatedAtIdx: index('audit_user_created_at_idx').on(t.userId, t.createdAt.desc()),
    createdAtIdx: index('audit_created_at_idx').on(t.createdAt.desc()),
  }),
);

// ============================================================
// SESSIONS (Auth.js)
// ============================================================

export const sessions = pgTable(
  'sessions',
  {
    sessionToken: text('session_token').primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
    totpVerified: boolean('totp_verified').notNull().default(false),
    ip: text('ip'),
    userAgent: text('user_agent'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expires),
  }),
);

// ============================================================
// IDEMPOTENCY STORE (cache de resposta de endpoints genéricos)
// Movements têm sua própria idempotência inline; esta tabela é para outras rotas.
// ============================================================

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    endpoint: text('endpoint').notNull(),
    response: jsonb('response'),
    statusCode: integer('status_code'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.endpoint, t.key] }),
    expiresIdx: index('idempotency_expires_idx').on(t.expiresAt),
  }),
);

// ============================================================
// AUTH.JS REQUIRED TABLES
// ============================================================

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
    userIdx: index('accounts_user_idx').on(t.userId),
  }),
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
    expiresIdx: index('verification_tokens_expires_idx').on(t.expires),
  }),
);

// ============================================================
// RAPPORT IMPORTS (integração InterFast)
// ============================================================

export const rapportImports = pgTable(
  'rapport_imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    interfastInterventionId: text('interfast_intervention_id').notNull().unique(),
    interfastReference: text('interfast_reference'),
    technicienName: text('technicien_name'),
    clientName: text('client_name'),
    locationId: uuid('location_id').references(() => locations.id),
    interventionDate: date('intervention_date'),
    status: text('status').notNull().default('pending'),
    rawArticles: jsonb('raw_articles').notNull().default([]),
    confirmedBy: uuid('confirmed_by').references(() => users.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('rapport_imports_status_idx').on(t.status),
  }),
);

export const rapportImportItems = pgTable(
  'rapport_import_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rapportId: uuid('rapport_id')
      .notNull()
      .references(() => rapportImports.id, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    interfastArticleId: text('interfast_article_id'),
    supplierCode: text('supplier_code'),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
    unit: text('unit').notNull(),
    priceCents: integer('price_cents'),
    articleId: uuid('article_id').references(() => articles.id),
    movementId: uuid('movement_id').references(() => stockMovements.id),
    status: text('status').notNull().default('unmatched'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    rapportIdx: index('rapport_import_items_rapport_idx').on(t.rapportId),
  }),
);

// ============================================================
// GAS BOTTLES
// ============================================================

export const gasBottles = pgTable(
  'gas_bottles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    reference: text('reference').notNull().unique(),
    gasTypeCode: text('gas_type_code').notNull(),
    initialWeightKg: numeric('initial_weight_kg', { precision: 8, scale: 3 }).notNull(),
    currentWeightKg: numeric('current_weight_kg', { precision: 8, scale: 3 }).notNull(),
    status: text('status').notNull().default('available'),
    locationId: uuid('location_id').references(() => locations.id),
    articleId: uuid('article_id').references(() => articles.id),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('gas_bottles_status_idx').on(t.status),
    locationIdx: index('gas_bottles_location_idx').on(t.locationId),
  }),
);

// ============================================================
// NOTIFICATIONS
// ============================================================

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    data: jsonb('data').notNull().default({}),
    status: text('status').notNull().default('unread'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id),
  },
  (t) => ({
    statusIdx: index('notifications_status_idx').on(t.status),
  }),
);

// ============================================================
// NOTAS PARA A MIGRATION (executar via SQL raw após `pnpm db:generate`)
// ============================================================
//
// 1) FK circular users.default_location_id -> locations.id:
//    ALTER TABLE users
//      ADD CONSTRAINT users_default_location_fk
//      FOREIGN KEY (default_location_id) REFERENCES locations(id)
//      DEFERRABLE INITIALLY DEFERRED;
//
// 2) Trigram em articles.name (busca rápida no painel admin):
//    CREATE EXTENSION IF NOT EXISTS pg_trgm;
//    CREATE INDEX articles_name_trgm_idx ON articles USING gin (name gin_trgm_ops);
//
// 3) Trigger que sincroniza stock_movements -> stock_levels na mesma transação,
//    ignorando movimentos com voided_at preenchido:
//
//    CREATE OR REPLACE FUNCTION apply_stock_movement() RETURNS trigger AS $$
//    BEGIN
//      IF NEW.voided_at IS NOT NULL THEN RETURN NEW; END IF;
//      INSERT INTO stock_levels (article_id, location_id, quantity, updated_at, version)
//      VALUES (NEW.article_id, NEW.location_id, NEW.quantity_delta, NOW(), 1)
//      ON CONFLICT (article_id, location_id)
//      DO UPDATE SET
//        quantity = stock_levels.quantity + NEW.quantity_delta,
//        updated_at = NOW(),
//        version = stock_levels.version + 1;
//      RETURN NEW;
//    END $$ LANGUAGE plpgsql;
//
//    CREATE TRIGGER trg_apply_stock_movement
//      AFTER INSERT ON stock_movements
//      FOR EACH ROW EXECUTE FUNCTION apply_stock_movement();
//
// 4) Quando voided_at é preenchido, reverter o impacto:
//
//    CREATE OR REPLACE FUNCTION revert_voided_movement() RETURNS trigger AS $$
//    BEGIN
//      IF OLD.voided_at IS NULL AND NEW.voided_at IS NOT NULL THEN
//        UPDATE stock_levels
//          SET quantity = quantity - NEW.quantity_delta,
//              updated_at = NOW(),
//              version = version + 1
//        WHERE article_id = NEW.article_id AND location_id = NEW.location_id;
//      END IF;
//      RETURN NEW;
//    END $$ LANGUAGE plpgsql;
//
//    CREATE TRIGGER trg_revert_voided_movement
//      AFTER UPDATE OF voided_at ON stock_movements
//      FOR EACH ROW EXECUTE FUNCTION revert_voided_movement();
//
// 5) Índice parcial para alerta de reposição (queries do dashboard):
//    CREATE INDEX stock_levels_low_idx
//      ON stock_levels (location_id, article_id)
//      WHERE quantity <= 5;
//
// 6) Constraint para impedir from = to em transfers:
//    ALTER TABLE transfers
//      ADD CONSTRAINT transfers_diff_locations
//      CHECK (from_location_id <> to_location_id);
