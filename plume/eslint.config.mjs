import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Les 3 barrières d'architecture (AR-2, AR-13, frontière serveur/client).
// Matérialisées en règles `no-restricted-imports`. Stratégie : on RESTREINT par
// défaut, puis on lève la contrainte uniquement dans la zone autorisée via un
// override `files` ciblé (les overrides plus spécifiques l'emportent).

// --- Barrière 1 — Porte de données unique -----------------------------------
// `drizzle-orm` et les modules internes db/{client,schema,env} sont interdits
// PARTOUT : seule la porte src/lib/db/** y a droit (override plus bas).
const importsPorteData = [
  {
    name: "drizzle-orm",
    message:
      "Aucune query Drizzle nue : passe par la porte src/lib/db (db.forUser).",
  },
];
const patternsPorteData = [
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
];

// --- Barrière 2 — Clés LLM server-only ---------------------------------------
// Tout SDK qui porte une clé API LLM est interdit hors src/lib/** (override plus
// bas pour la zone lib). Couvre le SDK Claude direct (composer) ET le Vercel AI
// SDK du copilote (`ai` + providers) : la clé ne doit jamais atteindre le client.
const importsSdkLlm = [
  {
    name: "@anthropic-ai/sdk",
    message:
      "Le SDK Claude est server-only : encapsule-le derrière un module .server.ts dans src/lib/**.",
  },
  {
    name: "ai",
    message:
      "Le Vercel AI SDK est server-only (clé API) : passe par un module .server.ts dans src/lib/agent/**.",
  },
  {
    name: "@ai-sdk/anthropic",
    message:
      "Provider LLM server-only (clé API) : passe par un module .server.ts dans src/lib/agent/**.",
  },
  {
    name: "@ai-sdk/google",
    message:
      "Provider LLM server-only (clé API) : passe par un module .server.ts dans src/lib/agent/**.",
  },
];

// --- Barrière 3 — Frontière serveur/client -----------------------------------
// `server-only` et les modules `*.server` jamais importables côté client.
const importServerOnly = {
  name: "server-only",
  message:
    "`server-only` n'a de sens que dans un module serveur (.server.ts / src/lib/**).",
};
const patternServerModule = {
  group: ["**/*.server"],
  message: "Un module serveur (*.server) n'est pas importable côté client.",
};

// (A) Zone CLIENT (app/features/components/design) : les 3 barrières, au max.
const barriereZoneClient = {
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
        paths: [...importsPorteData, ...importsSdkLlm, importServerOnly],
        patterns: [...patternsPorteData, patternServerModule],
      },
    ],
  },
};

// (B) Barrière 1 GLOBALE (toute la base, src + tests) : Drizzle nu et accès
// interne db/ interdits hors src/lib/db. Les zones lib/ et lib/db/ relèvent
// cette contrainte via leurs overrides ci-dessous.
const barrierePorteDataGlobale = {
  files: ["**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      { paths: importsPorteData, patterns: patternsPorteData },
    ],
  },
};

// (C) Override src/lib/** : la zone serveur peut importer le SDK Claude et les
// modules server-only ; elle reste soumise à la porte data SAUF src/lib/db/**.
const overrideZoneLib = {
  files: ["src/lib/**/*.{ts,tsx}"],
  ignores: ["src/lib/db/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      { paths: importsPorteData, patterns: patternsPorteData },
    ],
  },
};

// (D) Override src/lib/db/** : la porte de données — accès LIBRE à Drizzle et aux
// modules internes db/ (c'est l'unique endroit autorisé).
const overridePorteData = {
  files: ["src/lib/db/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": "off",
  },
};

// (D bis) Override src/lib/auth.ts : RACINE de composition Auth.js. Elle câble
// l'adaptateur Drizzle au client serveur (getServerDb) et aux tables du schéma —
// wiring sanctionné par l'architecture. Accès interne db/ autorisé ICI seulement
// (jamais drizzle-orm nu : la porte reste la règle pour les requêtes).
const overrideAuthRoot = {
  files: ["src/lib/auth.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        // On garde l'interdiction de Drizzle nu ; on lève l'accès aux modules db/.
        paths: importsPorteData,
      },
    ],
  },
};

// (E) Override tests/db/** : le HARNAIS de test construit une db en mémoire et
// applique les migrations — il a légitimement besoin de Drizzle et du schéma de
// prod. Périmètre volontairement étroit (le reste des tests passe par la porte).
const overrideHarnaisTest = {
  files: ["tests/db/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": "off",
  },
};

// (F) Override src/app/api/**/route.ts : les ROUTE HANDLERS sont des endpoints
// SERVEUR (jamais expédiés au client) — contrairement au reste de src/app/** qui
// peut être du Client Component. Ils ont donc le droit d'importer les wrappers
// serveur encapsulant le SDK Claude (`@/lib/*.server`) et `server-only` — c'est
// précisément la couture voulue par l'archi (la route passe par le wrapper, jamais
// par le SDK nu). On GARDE l'interdiction du SDK Claude nu et de Drizzle nu : la
// route doit rester derrière les façades (`@/lib/claude.server`, `db.forUser`).
const overrideRouteHandlers = {
  files: ["src/app/api/**/route.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        // On conserve la porte data + l'interdiction des SDK LLM nus ;
        // on lève uniquement la barrière server/client (modules *.server / server-only),
        // car un route handler EST du code serveur.
        paths: [...importsPorteData, ...importsSdkLlm],
        patterns: patternsPorteData,
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  barrierePorteDataGlobale,
  barriereZoneClient,
  overrideZoneLib,
  overridePorteData,
  overrideAuthRoot,
  overrideHarnaisTest,
  overrideRouteHandlers,
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
