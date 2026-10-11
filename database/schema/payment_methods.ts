import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const payment_methods = sqliteTable("payment_methods", {
    id: text("id").primaryKey(),
    environment: text("environment", { enum: ["REAL"] }).default("REAL").notNull(),
    method: text("method", { enum: ["AUTO", "MANUAL", "BANK_TRANSFER"] }).notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
    maintenance_mode: integer("maintenance_mode", { mode: "boolean" }).default(false).notNull(),
    display_order: integer("display_order").notNull(),
    min_amount: real("min_amount").notNull(),
    max_amount: real("max_amount"),
    fee_type: text("fee_type", { enum: ["PERCENTAGE", "FIXED", "PERCENTAGE_AND_FIXED", "ZERO"] }).default("ZERO").notNull(),
    fee_value: real("fee_value").default(0).notNull(),
    supported_assets: text("supported_assets", { mode: "json" }).$type<string[]>(),
    supported_networks: text("supported_networks", { mode: "json" }).$type<string[]>(),
    instructions: text("instructions"),
    created_at: integer("created_at", { mode: "timestamp" }).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
    updated_by: text("updated_by"),
});
