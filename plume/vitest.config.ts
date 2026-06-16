import { defineConfig } from "vitest/config";

// Tests unitaires/intégration (placeholder en 1.1). Les setups lourds (fake-indexeddb,
// harness DB :memory:) arrivent avec les stories qui en ont besoin.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
