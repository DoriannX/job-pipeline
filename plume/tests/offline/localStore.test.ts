// `fake-indexeddb/auto` installe un IndexedDB en mémoire sur le global AVANT que Dexie
// ne soit touché : la façade `localStore` (lazy) ouvre alors sa base sans navigateur réel.
// Doit rester en TÊTE du fichier (l'import a un effet de bord global).
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteDraft,
  getDraft,
  saveDraft,
  type Draft,
} from "@/lib/offline/localStore";

// Contrat de la façade `localStore` (AR-12) : CRUD STRICT par clé = id du Contact.
// On ne teste QUE get/save/delete (aucune notion de synchro/outbox n'existe ici).
//
// La façade Dexie est un singleton de module (instance créée à la 1re op) qui persiste
// sur tout le fichier. On remet donc à zéro les clés connues AVANT chaque test (via la
// façade elle-même) pour qu'aucun cas n'hérite de l'état d'un autre.
const KNOWN_KEYS = ["contact-A", "contact-B", "jamais-ecrit"];

describe("localStore — façade CRUD des brouillons (AR-12)", () => {
  beforeEach(async () => {
    for (const k of KNOWN_KEYS) await deleteDraft(k);
  });

  const draftA: Draft = {
    key: "contact-A",
    text: "Salut, on se recroise quand ?",
    canal: "linkedin",
    tone: "rapide",
    updatedAt: 1_700_000_000_000,
  };

  it("saveDraft puis getDraft restaure TOUS les champs à l'identique", async () => {
    await saveDraft(draftA);
    const lu = await getDraft("contact-A");
    expect(lu).toEqual(draftA);
  });

  it("re-saveDraft sur la même clé ÉCRASE (un brouillon par contact)", async () => {
    await saveDraft(draftA);
    const maj: Draft = {
      ...draftA,
      text: "Version retravaillée, plus soignée.",
      canal: "email",
      tone: "soigne",
      updatedAt: 1_700_000_100_000,
    };
    await saveDraft(maj);

    const lu = await getDraft("contact-A");
    expect(lu).toEqual(maj);
    // Pas de doublon : la lecture par clé renvoie bien la dernière version.
    expect(lu?.text).toBe("Version retravaillée, plus soignée.");
  });

  it("deleteDraft efface le brouillon (getDraft ⇒ undefined ensuite)", async () => {
    await saveDraft(draftA);
    expect(await getDraft("contact-A")).toBeDefined();

    await deleteDraft("contact-A");
    expect(await getDraft("contact-A")).toBeUndefined();
  });

  it("deux contacts = deux brouillons ISOLÉS (clés indépendantes)", async () => {
    const draftB: Draft = {
      key: "contact-B",
      text: "Bonjour, auriez-vous un moment ?",
      canal: "email",
      tone: "soigne",
      updatedAt: 1_700_000_050_000,
    };
    await saveDraft(draftA);
    await saveDraft(draftB);

    expect(await getDraft("contact-A")).toEqual(draftA);
    expect(await getDraft("contact-B")).toEqual(draftB);

    // Supprimer l'un ne touche pas l'autre.
    await deleteDraft("contact-A");
    expect(await getDraft("contact-A")).toBeUndefined();
    expect(await getDraft("contact-B")).toEqual(draftB);
  });

  it("getDraft d'une clé inexistante ⇒ undefined", async () => {
    expect(await getDraft("jamais-ecrit")).toBeUndefined();
  });
});
