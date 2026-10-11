import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./schema/*",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
