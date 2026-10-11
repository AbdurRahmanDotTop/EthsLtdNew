import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const bank_accounts = sqliteTable("bank_accounts", {
    id: text("id").primaryKey(),
    environment: text("environment", { enum: ["REAL"] }).default("REAL").notNull(),
    bank_name: text("bank_name").notNull(),
    account_holder: text("account_holder").notNull(),
    account_number: text("account_number").notNull(), // encrypted in production
    ifsc: text("ifsc"),
    swift: text("swift"),
    branch: text("branch"),
    currency: text("currency").notNull(),
    country: text("country"),
    instructions: text("instructions"),
    active: integer("active", { mode: "boolean" }).default(true).notNull(),
    default_account: integer("default_account", { mode: "boolean" }).default(false).notNull(),
    created_at: integer("created_at", { mode: "timestamp" }).notNull(),
    updated_at: integer("updated_at", { mode: "timestamp" }).notNull(),
});
