import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests unitaires/intégration. Les setups lourds (fake-indexeddb, harness DB :memory:)
// arrivent avec les stories qui en ont besoin.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` est fourni par le bundler Next (condition RSC), pas par Node :
      // en vitest (env node) on le neutralise vers un module vide, comme recommandé
      // pour tester du code serveur hors du bundler. Cela ne lève AUCUNE barrière
      // d'archi : les frontières server/client sont gardées par ESLint, pas par ce stub.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
