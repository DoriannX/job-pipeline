// Repositories du TRANSCRIPT copilote (Phase 3) — `conversations` + `chat_messages`.
//
// On prouve les invariants du contrat (SPEC/data-model) :
//   - CAP-1 : rattachement au fil, ordre, isolement cross-tenant ;
//   - CAP-2 : reprise après « reload » (nouvelle instance de porte) — findLatestActive + tours ;
//   - CAP-3 (scoping) : findById d'un fil d'un autre tenant → null (no-op, jamais de fuite) ;
//   - CAP-5 : turnId réhydraté depuis chat_messages → rewind d'un tour rechargé annule ses mutations ;
//   - titre = troncature déterministe (aucun appel IA) ; contexte borné (MAX_CONTEXT_TURNS).
//
// Tout passe par la porte scopée `forUserDb` + les repositories (jamais Drizzle nu hors assertion).

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import {
  actionLogRepository,
  chatMessagesRepository,
  contactsRepository,
  conversationsRepository,
  deriveTitre,
  forUserDb,
  messagesRepository,
  TITRE_MAX_LENGTH,
  type JournalSink,
} from "@/lib/db";
import { createContact } from "@/lib/agent/tools.server";
import { replayRewind } from "@/features/copilote/rewind";
import type { Clock } from "@/lib/domain/time";

import {
  contacts,
  conversations,
  makeTestDb,
  seedUsers,
  type TestDb,
} from "./harness";
import { makeUser } from "../factories/user";

function monotonicClock(start = 1_700_000_000_000, step = 1000): Clock {
  let t = start;
  return () => (t += step);
}

describe("deriveTitre — troncature déterministe du 1er message (aucun appel IA)", () => {
  it("garde un message court tel quel (espaces normalisés)", () => {
    expect(deriveTitre("  Salut   le   copilote  ")).toBe("Salut le copilote");
  });

  it("tronque un message long à TITRE_MAX_LENGTH + ellipse", () => {
    const long = "a".repeat(TITRE_MAX_LENGTH + 20);
    const titre = deriveTitre(long);
    expect(titre.endsWith("…")).toBe(true);
    expect(titre.length).toBe(TITRE_MAX_LENGTH + 1); // N caractères + ellipse
  });

  it("est déterministe (même entrée → même titre)", () => {
    expect(deriveTitre("Montre mes contacts froids")).toBe(
      deriveTitre("Montre mes contacts froids"),
    );
  });
});

describe("conversations / chat_messages — repositories scopés (Phase 3)", () => {
  let db: TestDb;
  const userA = makeUser({ name: "Alice" });
  const userB = makeUser({ name: "Bob" });
  const now = monotonicClock();

  const convoRepo = (userId: string) =>
    conversationsRepository(forUserDb(db, userId, now));
  const msgRepo = (userId: string) =>
    chatMessagesRepository(forUserDb(db, userId, now));

  beforeEach(async () => {
    db = await makeTestDb();
    await seedUsers(db, [userA, userB]);
  });

  it("CAP-1 : create pose un titre tronqué + append rattache les tours, ordonnés", async () => {
    const convo = await convoRepo(userA.id).create({
      firstUserMessage: "Montre-moi mes contacts froids",
    });
    expect(convo.titre).toBe("Montre-moi mes contacts froids");

    await msgRepo(userA.id).append({
      conversationId: convo.id,
      role: "user",
      content: "Montre-moi mes contacts froids",
    });
    await msgRepo(userA.id).append({
      conversationId: convo.id,
      role: "assistant",
      content: "Voici 3 contacts froids.",
    });

    const turns = await msgRepo(userA.id).listForConversation(convo.id);
    expect(turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(turns.every((t) => t.conversationId === convo.id)).toBe(true);
  });

  it("CAP-2 : reprise après « reload » — findLatestActive renvoie le dernier fil + ses tours", async () => {
    const first = await convoRepo(userA.id).create({ firstUserMessage: "fil 1" });
    await msgRepo(userA.id).append({
      conversationId: first.id,
      role: "user",
      content: "fil 1",
    });
    const second = await convoRepo(userA.id).create({ firstUserMessage: "fil 2" });
    await msgRepo(userA.id).append({
      conversationId: second.id,
      role: "user",
      content: "fil 2",
    });
    await convoRepo(userA.id).touch(second.id); // dernière activité = fil 2

    // « Reload » = NOUVELLE instance de porte (aucun état en mémoire conservé).
    const active = await convoRepo(userA.id).findLatestActive();
    expect(active?.id).toBe(second.id);
    const turns = await msgRepo(userA.id).listForConversation(active!.id);
    expect(turns).toHaveLength(1);
    expect(turns[0]!.content).toBe("fil 2");
  });

  it("CAP-1/3 : isolement cross-tenant — le fil de B est invisible pour A", async () => {
    const bConvo = await convoRepo(userB.id).create({ firstUserMessage: "secret B" });
    await msgRepo(userB.id).append({
      conversationId: bConvo.id,
      role: "user",
      content: "secret B",
    });

    // A ne reprend aucun fil (le sien n'existe pas) ; le fil de B lui est invisible.
    expect(await convoRepo(userA.id).findLatestActive()).toBeNull();
    // findById du fil de B depuis A → null (no-op, jamais de fuite) — garantie d'appartenance.
    expect(await convoRepo(userA.id).findById(bConvo.id)).toBeNull();
    // Les tours de B ne fuient pas via A (scopé user_id).
    expect(await msgRepo(userA.id).listForConversation(bConvo.id)).toHaveLength(0);
  });

  it("findById/findLatestActive ignorent les fils archivés (soft) — la porte filtre archived_at", async () => {
    const convo = await convoRepo(userA.id).create({ firstUserMessage: "à archiver" });
    // Archivage SOFT direct via la porte (la méthode dédiée arrive en 3-B) : pose `archived_at`,
    // jamais de DELETE. La porte exclut alors le fil de TOUTES les lectures.
    await forUserDb(db, userA.id, now).update(
      conversations,
      { archivedAt: now() },
      eq(conversations.id, convo.id),
    );
    expect(await convoRepo(userA.id).findById(convo.id)).toBeNull();
    expect(await convoRepo(userA.id).findLatestActive()).toBeNull();
    // Le fil existe TOUJOURS physiquement (soft-delete, jamais hard-delete).
    const physical = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, convo.id));
    expect(physical).toHaveLength(1);
  });

  it("listForConversation borne la lecture aux N tours les plus récents (contexte modèle)", async () => {
    const convo = await convoRepo(userA.id).create({ firstUserMessage: "long fil" });
    for (let i = 0; i < 10; i += 1) {
      await msgRepo(userA.id).append({
        conversationId: convo.id,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `tour ${String(i).padStart(2, "0")}`,
      });
    }
    const bounded = await msgRepo(userA.id).listForConversation(convo.id, {
      limit: 4,
    });
    expect(bounded).toHaveLength(4);
    // La fenêtre garde les 4 PLUS RÉCENTS, dans l'ordre croissant.
    expect(bounded.map((t) => t.content)).toEqual([
      "tour 06",
      "tour 07",
      "tour 08",
      "tour 09",
    ]);
    // La persistance, elle, garde TOUT le fil.
    const all = await msgRepo(userA.id).listForConversation(convo.id);
    expect(all).toHaveLength(10);
  });

  it("CAP-5 : turnId réhydraté depuis chat_messages → rewind d'un tour rechargé annule ses mutations", async () => {
    const turnId = "turn-reloaded-1";
    const scoped = forUserDb(db, userA.id, now);
    const journal: JournalSink = async (tx, record) => {
      await actionLogRepository(tx).record({
        turnId,
        toolName: "createContact",
        entityType: record.entityType,
        entityId: record.entityId,
        op: record.op,
        prevState: record.prevState,
      });
    };

    // Un tour qui ÉCRIT : crée un contact (journalisé sous `turnId`).
    const created = await createContact(
      contactsRepository(scoped),
      { nom: "Sophie Durand" },
      journal,
    );

    // On persiste le tour assistant AVEC son turnId (ce que fait runAgentChat pour un run écrivant).
    const convo = await convoRepo(userA.id).create({ firstUserMessage: "crée Sophie" });
    await msgRepo(userA.id).append({
      conversationId: convo.id,
      role: "assistant",
      content: "C'est fait : Sophie est créée.",
      turnId,
    });

    // « Reload » : on relit le fil ; la ligne assistant porte bien le turnId (réhydratation rewind).
    const turns = await msgRepo(userA.id).listForConversation(convo.id);
    const reloadedTurnId = turns.find((t) => t.role === "assistant")?.turnId;
    expect(reloadedTurnId).toBe(turnId);

    // Le rewind du tour RECHARGÉ annule ses mutations (le contact créé est ré-archivé, soft).
    const freshScoped = forUserDb(db, userA.id, now);
    const summary = await replayRewind(
      {
        actionLog: actionLogRepository(freshScoped),
        contacts: contactsRepository(freshScoped),
        messages: messagesRepository(freshScoped),
      },
      reloadedTurnId!,
    );
    expect(summary.reversed).toBeGreaterThan(0);
    // Le contact est sorti des lectures (soft-archivé), jamais hard-deleté.
    const stillActive = await contactsRepository(freshScoped).get(created.id);
    expect(stillActive).toBeUndefined();
    const archived = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, created.id));
    expect(archived).toHaveLength(1); // existe toujours physiquement (jamais de DELETE)
  });
});
