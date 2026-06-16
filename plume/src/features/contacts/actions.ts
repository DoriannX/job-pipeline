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

import { forUser } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isCanal } from "@/lib/domain/enums";

import { contactInputSchema, isHandlesEmpty } from "./validation";

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
  const { nom, canalPrefere, handles, notes } = result.data;

  const db = await forUser(userId);
  await db.contacts.create({
    nom,
    canalPrefere: canalPrefere ?? null,
    handles: isHandlesEmpty(handles) ? null : handles,
    notes: notes ?? null,
  });

  revalidatePath(RESEAU_PATH);
  return { ok: true };
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
  const { nom, canalPrefere, handles, notes } = result.data;

  const db = await forUser(userId);
  const updated = await db.contacts.update(id, {
    nom,
    canalPrefere: canalPrefere ?? null,
    handles: isHandlesEmpty(handles) ? null : handles,
    notes: notes ?? null,
  });

  if (!updated) {
    // Borné au tenant : un id d'autrui (ou inexistant) ne renvoie rien.
    return { ok: false, error: "Ce contact n'a pas pu être mis à jour." };
  }

  revalidatePath(RESEAU_PATH);
  return { ok: true };
}

/**
 * Supprime un Contact (irréversible). Action de formulaire simple (bouton de
 * confirmation) : pas d'état de retour, on rafraîchit la liste.
 */
export async function deleteContactAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const db = await forUser(userId);
  await db.contacts.remove(id);

  revalidatePath(RESEAU_PATH);
}
