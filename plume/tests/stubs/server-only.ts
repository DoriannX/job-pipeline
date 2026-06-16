// Stub de `server-only` pour vitest (env node). Ce paquet n'est résolu que par le
// bundler Next (condition React Server Components) ; en test, on l'alias vers ce
// module vide (cf. vitest.config.ts). Aucune frontière d'archi n'est levée pour
// autant : les barrières server/client restent gardées par ESLint.
export {};
