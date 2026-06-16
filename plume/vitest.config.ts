import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires/intégration. Les setups lourds (fake-indexeddb, harness DB :memory:)
// arrivent avec les stories qui en ont besoin.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
