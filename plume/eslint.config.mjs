import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Les 3 barrières d'architecture (AR-2, AR-13, frontière serveur/client).
// Matérialisées en règles `no-restricted-imports` sur la zone client (app/features/
// components/design). La zone serveur `src/lib/**` reste libre d'importer le SDK
// Claude, Drizzle et les modules `.server`. Durci au fil des stories (1.3).
const barrieresArchi = {
  // Barrière 1 — Porte de données unique : aucune query Drizzle nue hors src/lib/db.
  // Barrière 2 — Clé Claude derrière le mur serveur : @anthropic-ai/sdk hors zone client.
  // Barrière 3 — Frontière serveur/client : server-only / *.server jamais côté client.
  files: [
    "src/app/**/*.{ts,tsx}",
    "src/features/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}",
    "src/design/**/*.{ts,tsx}",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "drizzle-orm",
            message:
              "Aucune query Drizzle nue : passe par la porte src/lib/db (db.forUser).",
          },
          {
            name: "@anthropic-ai/sdk",
            message:
              "Le SDK Claude est server-only : encapsule-le derrière un module .server.ts dans src/lib/**.",
          },
          {
            name: "server-only",
            message:
              "`server-only` n'a de sens que dans un module serveur (.server.ts / src/lib/**).",
          },
        ],
        patterns: [
          {
            group: [
              "@/lib/db/client",
              "@/lib/db/schema",
              "@/lib/db/env",
              "**/db/client",
              "**/db/schema",
              "**/db/env",
            ],
            message:
              "Accès interne au dossier db/ interdit hors src/lib/db : utilise db.forUser.",
          },
          {
            group: ["**/*.server"],
            message:
              "Un module serveur (*.server) n'est pas importable côté client.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  barrieresArchi,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Migrations Drizzle générées (SQL committé, non lint-able).
    "drizzle/**",
  ]),
]);

export default eslintConfig;
