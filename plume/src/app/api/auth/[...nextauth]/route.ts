// Route Handler Auth.js v5 — expose les endpoints OAuth (Google) sous /api/auth/*.
// Les handlers GET/POST viennent de la config NextAuth (lib/auth.ts).

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
