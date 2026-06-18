"use server";

// Server actions de la feature Contacts (story 2.1).
//
// RÈGLE DURE : ces actions n'importent JAMAIS le schéma Drizzle ni drizzle-orm.
// Tout accès aux données passe par la porte `forUser(userId)` de `@/lib/db`
// (barrière ESLint n°1 / AR-2, AR-13) : `(await forUser(userId)).contacts.create()`…
//
// `userId` est résolu via `auth()` (server) DANS CHAQUE action : sans session, on
// rejette. La validation Zod est appliquée À LA FRONTIÈRE (entrée FormData) avant
// toute écriture. `revalidatePath('/reseau')` rafraîchit la liste après mutation.

import { revalidatePath } from "next/cache";

import { forUser, type BulkCreateItem } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isCanal } from "@/lib/domain/enums";

import { parseQuickAdd } from "./dedup";
import {
  contactInputSchema,
  isHandlesEmpty,
  quickAddEntrySchema,
} from "./validation";

const RESEAU_PATH = "/reseau";

/** État renvoyé par les actions de formulaire (pour `useActionState`). */
export type ContactFormState = {
  ok: boolean;
  /** Message d'erreur global, ton doux (bandeau inline, jamais rouge alarme). */
  error?: string;
  /** Erreurs par champ (clé = nom du champ), pour un retour ciblé. */
  fieldErrors?: Record<string, string>;
};

/** Résout l'id du tenant courant ; lève si pas de session (action POST directe incluse). */
async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    throw new Error("Session requise.");
  }
  return userId;
}

/**
 * Détecte une violation d'index UNIQUE (collision de `dedup_key` par tenant). libSQL
 * EMBALLE l'erreur SQLite (« Failed query: … ») et range le vrai motif « UNIQUE
 * constraint failed » dans la CHAÎNE de `cause` (ou un code `SQLITE_CONSTRAINT`). On
 * parcourt donc tout le chaînage `message`/`code`/`cause` pour la reconnaître, et la
 * traduire en message doux (jamais un 500 brut) côté formulaire.
 */
function isUniqueViolation(e: unknown): boolean {
  const needle = /UNIQUE constraint failed|SQLITE_CONSTRAINT/i;
  let cur: unknown = e;
  for (let depth = 0; cur != null && depth < 8; depth += 1) {
    if (cur instanceof Error) {
      if (needle.test(cur.message)) return true;
      const code = (cur as { code?: unknown }).code;
      if (typeof code === "string" && needle.test(code)) return true;
      cur = cur.cause;
    } else {
      return needle.test(String(cur));
    }
  }
  return false;
}

/** Construit l'objet `handles` à partir des champs plats du formulaire. */
function readHandles(formData: FormData) {
  return {
    linkedin: (formData.get("handle_linkedin") as string) ?? undefined,
    email: (formData.get("handle_email") as string) ?? undefined,
    phone: (formData.get("handle_phone") as string) ?? undefined,
    whatsapp: (formData.get("handle_whatsapp") as string) ?? undefined,
  };
}

/** Valide le FormData via Zod ; renvoie soit les données, soit l'état d'erreur. */
function parse(formData: FormData):
  | { ok: true; data: import("./validation").ContactInput }
  | { ok: false; state: ContactFormState } {
  const canalRaw = formData.get("canalPrefere");
  const parsed = contactInputSchema.safeParse({
    nom: formData.get("nom") ?? "",
    entreprise: formData.get("entreprise") ?? undefined,
    canalPrefere: isCanal(canalRaw) ? canalRaw : "",
    handles: readHandles(formData),
    notes: formData.get("notes") ?? undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      // On garde le 1er message par champ (le plus pertinent).
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      ok: false,
      state: {
        ok: false,
        error: "Quelques détails à revoir avant d'enregistrer.",
        fieldErrors,
      },
    };
  }
  return { ok: true, data: parsed.data };
}

/**
 * Crée un Contact (état d'amorçage ou ajout normal). Signature `useActionState` :
 * `(prevState, formData) => Promise<ContactFormState>`.
 */
export async function createContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const userId = await requireUserId();

  const result = parse(formData);
  if (!result.ok) return result.state;
  const { nom, entreprise, canalPrefere, handles, notes } = result.data;

  const db = await forUser(userId);
  await db.contacts.create({
    nom,
    entreprise: entreprise ?? null,
    canalPrefere: canalPrefere ?? null,
    handles: isHandlesEmpty(handles) ? null : handles,
    notes: notes ?? null,
  });

  revalidatePath(RESEAU_PATH);
  return { ok: true };
}

/** État renvoyé par l'ajout rapide multiple (pour `useActionState`). */
export type QuickAddState = {
  ok: boolean;
  /** Compte-rendu neutre : N créés / N fusionnés (présent uniquement si `ok`). */
  report?: { created: number; merged: number };
  /** Message d'erreur global, ton doux (jamais rouge alarme). */
  error?: string;
};

/**
 * Ajout rapide MULTIPLE (story 2.2, FR-34) : on colle N lignes, on en crée N
 * Contacts EN UNE action, dédupliqués contre l'existant (AR-9). Signature
 * `useActionState` : `(prevState, formData) => Promise<QuickAddState>`.
 *
 * Pipeline : auth() → parseQuickAdd → validation Zod par entrée (nom requis) →
 * `forUser(userId).contacts.bulkCreate(...)` (dédup DB par tenant) → compte-rendu neutre.
 */
export async function quickAddAction(
  _prev: QuickAddState,
  formData: FormData,
): Promise<QuickAddState> {
  const userId = await requireUserId();

  const raw = String(formData.get("rawText") ?? "");
  const entries = parseQuickAdd(raw);
  if (entries.length === 0) {
    return { ok: false, error: "Colle au moins une ligne pour ajouter." };
  }

  // Validation Zod à la frontière : on ne garde que les entrées au nom valide.
  const items: BulkCreateItem[] = [];
  for (const entry of entries) {
    const parsed = quickAddEntrySchema.safeParse(entry);
    if (parsed.success) {
      items.push({
        nom: parsed.data.nom,
        entreprise: parsed.data.entreprise ?? null,
      });
    }
  }
  if (items.length === 0) {
    return { ok: false, error: "Aucun nom valide à ajouter." };
  }

  const db = await forUser(userId);
  const report = await db.contacts.bulkCreate(items);

  revalidatePath(RESEAU_PATH);
  return { ok: true, report };
}

/**
 * Édite un Contact existant SANS casser l'historique : seuls les champs du
 * formulaire sont mis à jour (createdAt / dernierContactAt restent intacts).
 */
export async function updateContactAction(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const userId = await requireUserId();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { ok: false, error: "Contact introuvable." };
  }

  const result = parse(formData);
  if (!result.ok) return result.state;
  const { nom, entreprise, canalPrefere, handles, notes } = result.data;

  const db = await forUser(userId);
  let updated;
  try {
    updated = await db.contacts.update(id, {
      nom,
      entreprise: entreprise ?? null,
      canalPrefere: canalPrefere ?? null,
      handles: isHandlesEmpty(handles) ? null : handles,
      notes: notes ?? null,
    });
  } catch (e) {
    // Le nouveau nom+entreprise (ou email) recalcule la `dedup_key` ; s'il entre en
    // collision avec un AUTRE contact du tenant, l'index unique lève. On répond doux,
    // ciblé sur le champ entreprise (cause la plus probable), au lieu d'un 500.
    if (isUniqueViolation(e)) {
      return {
        ok: false,
        error: "Un autre contact porte déjà ce nom et cette entreprise.",
        fieldErrors: {
          entreprise: "Doublon possible avec un contact existant.",
        },
      };
    }
    throw e;
  }

  if (!updated) {
    // Borné au tenant : un id d'autrui (ou inexistant) ne renvoie rien.
    return { ok: false, error: "Ce contact n'a pas pu être mis à jour." };
  }

  revalidatePath(RESEAU_PATH);
  return { ok: true };
}

/**
 * ARCHIVE un Contact (soft-delete réversible : pose `archived_at`, conserve l'histoire).
 * Action de formulaire simple (bouton de confirmation) : pas d'état de retour, on
 * rafraîchit la liste. Re-créer un contact à la même clé le réactive (cf. `create`).
 */
export async function deleteContactAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const db = await forUser(userId);
  await db.contacts.remove(id);

  revalidatePath(RESEAU_PATH);
}
