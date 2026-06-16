import { defineConfig } from "drizzle-kit";

// Dialect Turso/libSQL. ZÉRO secret au module-load : url de repli locale pour que
// `generate`/`check` tournent hors-ligne en CI (ces commandes ne se connectent pas).
export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
