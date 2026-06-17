// Fiche Contact (story 2.4) — logique PURE de mise en forme des canaux + contrat
// d'ISOLATION sur lequel s'appuie la page (un id inexistant/d'autrui → `get` undefined,
// la page rend alors `notFound()`). Tout est testé sans React et sans horloge système.

import { beforeEach, describe, expect, it } from "vitest";

import { channelChips, timelineItems } from "@/features/contacts/contact-detail";
import { contactsRepository, forUserDb } from "@/lib/db";
import type { Clock } from "@/lib/domain/time";

import { makeTestDb, seedUsers, type TestDb } from "../db/harness";
import { makeUser } from "../factories/user";

describe("channelChips — mise en forme des canaux renseignés", () => {
  it("aucun handle ⇒ aucune puce", () => {
    expect(channelChips(null, null)).toEqual([]);
    expect(channelChips({}, "email")).toEqual([]);
  });

  it("ignore les coordonnées vides (pas de puce fantôme)", () => {
    const chips = channelChips(
      { email: "a@b.fr", linkedin: "", whatsapp: "   " },
      null,
    );
    expect(chips.map((c) => c.key)).toEqual(["email"]);
    expect(chips[0]?.value).toBe("a@b.fr");
  });

  it("ordre canonique quand aucun canal préféré (linkedin, email, phone, whatsapp)", () => {
    const chips = channelChips(
      {
        whatsapp: "06 00",
        email: "a@b.fr",
        phone: "06 11",
        linkedin: "in/abc",
      },
      null,
    );
    expect(chips.map((c) => c.key)).toEqual([
      "linkedin",
      "email",
      "phone",
      "whatsapp",
    ]);
    expect(chips.every((c) => c.preferred === false)).toBe(true);
  });

  it("remonte le canal PRÉFÉRÉ en tête et le marque preferred", () => {
    const chips = channelChips(
      { linkedin: "in/abc", email: "a@b.fr", whatsapp: "06 00" },
      "whatsapp",
    );
    expect(chips[0]?.key).toBe("whatsapp");
    expect(chips[0]?.preferred).toBe(true);
    // Les autres restent dans l'ordre canonique, non préférés.
    expect(chips.slice(1).map((c) => c.key)).toEqual(["linkedin", "email"]);
    expect(chips.slice(1).every((c) => c.preferred === false)).toBe(true);
  });

  it("canal préféré 'sms' pointe sur le handle téléphone", () => {
    const chips = channelChips({ phone: "06 12", email: "a@b.fr" }, "sms");
    expect(chips[0]?.key).toBe("phone");
    expect(chips[0]?.preferred).toBe(true);
    expect(chips[0]?.icon).toBe("sms");
    expect(chips[0]?.label).toBe("Téléphone");
  });

  it("canal préféré non renseigné ⇒ rien n'est mis en avant", () => {
    const chips = channelChips({ email: "a@b.fr" }, "linkedin");
    expect(chips.map((c) => c.key)).toEqual(["email"]);
    expect(chips[0]?.preferred).toBe(false);
  });

  it("trim la valeur affichée", () => {
    const chips = channelChips({ email: "  a@b.fr  " }, null);
    expect(chips[0]?.value).toBe("a@b.fr");
  });
});

describe("timelineItems — Messages de la timeline « Votre histoire » (story 3.6)", () => {
  it("conserve l'ordre d'entrée (récent → ancien fourni par le serveur)", () => {
    const items = timelineItems([
      { id: "m2", canal: "linkedin", statut: "envoye", texte: "récent", envoyeAt: 2, createdAt: 2 },
      { id: "m1", canal: "email", statut: "envoye", texte: "ancien", envoyeAt: 1, createdAt: 1 },
    ]);
    expect(items.map((i) => i.id)).toEqual(["m2", "m1"]);
  });

  it("marque accent + libellés FR (canal/statut) pour un envoyé", () => {
    const [item] = timelineItems([
      { id: "m1", canal: "whatsapp", statut: "envoye", texte: "Salut !", envoyeAt: 1700000000000, createdAt: 1699999999000 },
    ]);
    expect(item.accent).toBe(true);
    expect(item.canalLabel).toBe("WhatsApp");
    expect(item.canalIcon).toBe("whatsapp");
    expect(item.statutLabel).toBe("Envoyé");
    expect(item.texte).toBe("Salut !");
    // `at` privilégie envoye_at sur created_at.
    expect(item.at).toBe(1700000000000);
  });

  it("retombe sur created_at si envoye_at est null", () => {
    const [item] = timelineItems([
      { id: "m1", canal: "sms", statut: "brouillon", texte: "wip", envoyeAt: null, createdAt: 42 },
    ]);
    expect(item.at).toBe(42);
    // Un non-envoyé n'est PAS mis en avant.
    expect(item.accent).toBe(false);
    expect(item.statutLabel).toBe("Brouillon");
  });

  it("liste vide ⇒ aucun item", () => {
    expect(timelineItems([])).toEqual([]);
  });
});

// Contrat d'isolation : la page lit `forUser(userId).contacts.get(id)`. Un id INEXISTANT
// ou d'un AUTRE tenant renvoie `undefined` → la page rend `notFound()` (jamais de fuite,
// jamais de 500). On exerce ici cette source de vérité (le `get` scopé).
describe("contrat fiche — get scopé décide du notFound", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });
  const now: Clock = () => 1_700_000_000_000;
  const repoA = () => contactsRepository(forUserDb(db, userA.id, now));
  const repoB = () => contactsRepository(forUserDb(db, userB.id, now));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("id inexistant ⇒ undefined (la fiche rendra notFound)", async () => {
    expect(await repoA().get("inexistant")).toBeUndefined();
  });

  it("id d'un autre tenant ⇒ undefined (aucune fuite ; la fiche rendra notFound)", async () => {
    const aContact = await repoA().create({ nom: "Privé de A" });
    expect(await repoB().get(aContact.id)).toBeUndefined();
    // Le propriétaire, lui, lit bien sa fiche.
    expect(await repoA().get(aContact.id)).toMatchObject({ id: aContact.id });
  });
});
