import { relations } from 'drizzle-orm';
import {
  articles,
  categories,
  jobs,
  locations,
  sessions,
  stockCountItems,
  stockCounts,
  stockLevels,
  stockMovements,
  suppliers,
  transferItems,
  transfers,
  users,
} from './schema';

// ============================================================
// USERS
// ============================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  defaultLocation: one(locations, {
    fields: [users.defaultLocationId],
    references: [locations.id],
    relationName: 'userDefaultLocation',
  }),
  assignedLocation: one(locations, {
    fields: [users.id],
    references: [locations.assignedUserId],
    relationName: 'locationAssignedUser',
  }),
  sessions: many(sessions),
  movements: many(stockMovements, { relationName: 'movementCreatedBy' }),
}));

// ============================================================
// LOCATIONS
// ============================================================

export const locationsRelations = relations(locations, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [locations.assignedUserId],
    references: [users.id],
    relationName: 'locationAssignedUser',
  }),
  stockLevels: many(stockLevels),
  stockMovements: many(stockMovements),
  transfersFrom: many(transfers, { relationName: 'transferFrom' }),
  transfersTo: many(transfers, { relationName: 'transferTo' }),
  stockCounts: many(stockCounts),
}));

// ============================================================
// CATEGORIES & SUPPLIERS
// ============================================================

export const categoriesRelations = relations(categories, ({ many }) => ({
  articles: many(articles),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  articles: many(articles),
}));

// ============================================================
// ARTICLES
// ============================================================

export const articlesRelations = relations(articles, ({ one, many }) => ({
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [articles.supplierId],
    references: [suppliers.id],
  }),
  stockLevels: many(stockLevels),
  stockMovements: many(stockMovements),
  transferItems: many(transferItems),
}));

// ============================================================
// JOBS
// ============================================================

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [jobs.createdBy],
    references: [users.id],
  }),
  movements: many(stockMovements),
}));

// ============================================================
// STOCK MOVEMENTS
// ============================================================

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  article: one(articles, {
    fields: [stockMovements.articleId],
    references: [articles.id],
  }),
  location: one(locations, {
    fields: [stockMovements.locationId],
    references: [locations.id],
  }),
  transfer: one(transfers, {
    fields: [stockMovements.transferId],
    references: [transfers.id],
  }),
  job: one(jobs, {
    fields: [stockMovements.jobId],
    references: [jobs.id],
  }),
  createdBy: one(users, {
    fields: [stockMovements.createdBy],
    references: [users.id],
    relationName: 'movementCreatedBy',
  }),
  voidedBy: one(users, {
    fields: [stockMovements.voidedBy],
    references: [users.id],
    relationName: 'movementVoidedBy',
  }),
}));

// ============================================================
// STOCK LEVELS
// ============================================================

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  article: one(articles, {
    fields: [stockLevels.articleId],
    references: [articles.id],
  }),
  location: one(locations, {
    fields: [stockLevels.locationId],
    references: [locations.id],
  }),
}));

// ============================================================
// TRANSFERS
// ============================================================

export const transfersRelations = relations(transfers, ({ one, many }) => ({
  fromLocation: one(locations, {
    fields: [transfers.fromLocationId],
    references: [locations.id],
    relationName: 'transferFrom',
  }),
  toLocation: one(locations, {
    fields: [transfers.toLocationId],
    references: [locations.id],
    relationName: 'transferTo',
  }),
  createdBy: one(users, {
    fields: [transfers.createdBy],
    references: [users.id],
    relationName: 'transferCreatedBy',
  }),
  shippedBy: one(users, {
    fields: [transfers.shippedBy],
    references: [users.id],
    relationName: 'transferShippedBy',
  }),
  receivedBy: one(users, {
    fields: [transfers.receivedBy],
    references: [users.id],
    relationName: 'transferReceivedBy',
  }),
  cancelledBy: one(users, {
    fields: [transfers.cancelledBy],
    references: [users.id],
    relationName: 'transferCancelledBy',
  }),
  items: many(transferItems),
  movements: many(stockMovements),
}));

export const transferItemsRelations = relations(transferItems, ({ one }) => ({
  transfer: one(transfers, {
    fields: [transferItems.transferId],
    references: [transfers.id],
  }),
  article: one(articles, {
    fields: [transferItems.articleId],
    references: [articles.id],
  }),
}));

// ============================================================
// STOCK COUNTS
// ============================================================

export const stockCountsRelations = relations(stockCounts, ({ one, many }) => ({
  location: one(locations, {
    fields: [stockCounts.locationId],
    references: [locations.id],
  }),
  performedBy: one(users, {
    fields: [stockCounts.performedBy],
    references: [users.id],
  }),
  items: many(stockCountItems),
}));

export const stockCountItemsRelations = relations(stockCountItems, ({ one }) => ({
  count: one(stockCounts, {
    fields: [stockCountItems.countId],
    references: [stockCounts.id],
  }),
  article: one(articles, {
    fields: [stockCountItems.articleId],
    references: [articles.id],
  }),
  adjustmentMovement: one(stockMovements, {
    fields: [stockCountItems.adjustmentMovementId],
    references: [stockMovements.id],
  }),
}));

// ============================================================
// SESSIONS
// ============================================================

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
