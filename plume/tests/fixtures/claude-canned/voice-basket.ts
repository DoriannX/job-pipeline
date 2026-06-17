// PANIER D'ÉVALS FIGÉ — réponses Claude GELÉES (story 3.9, anti-régression de la Voix).
//
// Ce fichier EST la baseline anti-régression. Chaque cas capture une réponse Claude
// « telle que le modèle l'aurait renvoyée » (`rawClaude`, AVEC des Tells réalistes),
// et la sortie ATTENDUE après `sanitize()` (`expectedSanitized`, le golden « bon ton »
// veté humainement à la création). Les evals (tests/evals/voice-evals.test.ts) rejouent
// ce panier à CHAQUE `pnpm test` (donc en CI), SANS aucun appel réseau réel.
//
// ─────────────────────────────────────────────────────────────────────────────
// N FIGÉ AU 1ER RUN : N = 3 idées-test PAR CANAL → 12 cas (linkedin/email/whatsapp/sms).
// Ce N est figé ; on ne le réduit pas. On peut l'augmenter (plus de couverture) sans
// re-geler les cas existants, jamais le diminuer en silence.
// ─────────────────────────────────────────────────────────────────────────────
//
// COMMENT RE-GELER LE PANIER (changement VOLONTAIRE du prompt few-shot ou du modèle
// Haiku↔Opus) :
//   1. Re-capturer `rawClaude` en rejouant les `idea`/`canal` ci-dessous contre le
//      nouveau prompt/modèle (hors-ligne, manuellement — le harnais NE fait pas
//      d'appel réseau) ;
//   2. Recalculer `expectedSanitized = sanitize(rawClaude)` et le RE-VÉRIFIER À L'ŒIL
//      (« bon ton », longueur dans la cible canal, zéro Tell) — c'est l'étape humaine
//      qui fait du golden une vraie baseline de qualité, pas un simple miroir ;
//   3. Bumper `PROMPT_VERSION` (prompt.server.ts) et/ou `SANITIZE_VERSION` (copy.ts)
//      selon ce qui a changé de façon OBSERVABLE.
// Tant qu'on n'a pas re-gelé volontairement, toute dérive de `sanitize()` ou du prompt
// fait ÉCHOUER les evals — c'est exactement le but.
//
// Les Tells injectés dans `rawClaude` (tiret cadratin U+2014, emoji, NBSP U+00A0,
// espace fine insécable U+202F, zero-width…) PROUVENT le couplage : si `sanitize()`
// régresse, `expectedSanitized` n'est plus atteint et l'eval casse.

import type { Canal } from "@/lib/domain/enums";

/** Critères BINAIRES attendus pour un cas (documentent l'intention, vérifiés par le runner). */
export interface VoiceCaseCriteria {
  /** La sortie sanitizée doit tenir dans la cible de longueur du canal (FR-9). */
  withinCanalTarget: true;
  /** La sortie sanitizée ne doit contenir AUCUN Tell d'IA (cadratin, emoji, invisible). */
  zeroTells: true;
  /** Le ton « bon » est conservé : égalité au golden `expectedSanitized`. */
  toneKept: true;
}

/** Un cas d'éval figé : seed + réponse gelée + golden + critères. */
export interface VoiceCase {
  /** Identifiant stable et lisible (canal + index). */
  id: string;
  /** Canal ciblé — pilote la cible de longueur et la contrainte prompt attendue. */
  canal: Canal;
  /** Idée brute (seed) passée au prompt — sert aussi au test de couplage prompt. */
  idea: string;
  /**
   * Réponse BRUTE « telle que le modèle l'aurait renvoyée », AVEC des Tells réalistes.
   * GELÉE : ne pas éditer sans re-geler le panier (voir l'en-tête).
   */
  rawClaude: string;
  /**
   * Golden : sortie ATTENDUE après `sanitize(rawClaude)`. Vetée humainement (« bon ton »).
   * GELÉE : si `sanitize()` change de comportement, l'eval (a) casse ici.
   */
  expectedSanitized: string;
  /** Critères binaires attendus (tous `true` pour un cas sain). */
  criteria: VoiceCaseCriteria;
}

// Critères : tous nos cas du panier sont des goldens « sains » → les 3 critères passent.
const SAIN: VoiceCaseCriteria = {
  withinCanalTarget: true,
  zeroTells: true,
  toneKept: true,
};

// ─── LinkedIn (court, 2-4 phrases) ───────────────────────────────────────────
// rawClaude porte des Tells ; expectedSanitized = ce que sanitize() doit produire.
const LINKEDIN: VoiceCase[] = [
  {
    id: "linkedin-1",
    canal: "linkedin",
    idea: "On s'est croisés au meetup React, j'aimerais échanger sur ton poste de lead front.",
    // Tells : cadratin U+2014, emoji 👍, NBSP U+00A0.
    rawClaude:
      "Salut Camille, content de t'avoir croisée au meetup React. \u{1F44D} Ton retour sur le passage à React 19 m'a marqué\u{2014}j'aimerais creuser. Tu aurais 20\u{00A0}minutes cette semaine pour en discuter ?",
    expectedSanitized:
      "Salut Camille, content de t'avoir croisée au meetup React. Ton retour sur le passage à React 19 m'a marqué - j'aimerais creuser. Tu aurais 20 minutes cette semaine pour en discuter ?",
    criteria: SAIN,
  },
  {
    id: "linkedin-2",
    canal: "linkedin",
    idea: "Je suis tombé sur ton article sur l'observabilité, je bosse sur le même sujet et j'aimerais te poser deux questions.",
    // Tells : emoji 🙌, espace fine insécable U+202F, zero-width U+200B.
    rawClaude:
      "Bonjour Sami, ton article sur l'observabilité tombe pile sur ce que je creuse en ce moment. \u{1F64C} J'ai deux questions concrètes sur ta stack de traces\u{202F}: dix minutes te conviendraient\u{200B} ?",
    expectedSanitized:
      "Bonjour Sami, ton article sur l'observabilité tombe pile sur ce que je creuse en ce moment. J'ai deux questions concrètes sur ta stack de traces : dix minutes te conviendraient ?",
    criteria: SAIN,
  },
  {
    id: "linkedin-3",
    canal: "linkedin",
    idea: "Recommandé par Inès, je veux comprendre comment vous recrutez vos data engineers.",
    // Tells : demi-cadratin U+2013, emoji ✨.
    rawClaude:
      "Bonjour Léa, Inès m'a parlé de votre équipe data avec beaucoup d'enthousiasme. \u{2728} Je prépare un changement de poste et votre façon de recruter les data engineers m'intrigue \u{2013} auriez-vous un créneau pour en parler ?",
    expectedSanitized:
      "Bonjour Léa, Inès m'a parlé de votre équipe data avec beaucoup d'enthousiasme. Je prépare un changement de poste et votre façon de recruter les data engineers m'intrigue - auriez-vous un créneau pour en parler ?",
    criteria: SAIN,
  },
];

// ─── Email (structuré : ouverture + corps + clôture, ≥ 2 blocs séparés par \n\n) ──
const EMAIL: VoiceCase[] = [
  {
    id: "email-1",
    canal: "email",
    idea: "Faire suite à notre échange au salon, proposer un point de 30 min sur le partenariat.",
    // Tells : cadratin U+2014, emoji 🙂, NBSP. Structure multi-paragraphes PRÉSERVÉE.
    rawClaude:
      "Bonjour Marc,\n\nMerci pour notre échange au salon, j'ai trouvé votre approche du partenariat très concrète\u{2014}et alignée avec ce qu'on construit.\u{1F642}\n\nJe vous propose un point de 30\u{00A0}minutes la semaine prochaine pour cadrer les prochaines étapes.\n\nÀ très vite,\nThéo",
    expectedSanitized:
      "Bonjour Marc,\n\nMerci pour notre échange au salon, j'ai trouvé votre approche du partenariat très concrète - et alignée avec ce qu'on construit.\n\nJe vous propose un point de 30 minutes la semaine prochaine pour cadrer les prochaines étapes.\n\nÀ très vite,\nThéo",
    criteria: SAIN,
  },
  {
    id: "email-2",
    canal: "email",
    idea: "Candidature spontanée au poste de PM, j'ai été recommandé par Julie de l'équipe produit.",
    // Tells : emoji ✨, espace fine insécable, zero-width.
    rawClaude:
      "Bonjour Madame Renaud,\n\nJulie de votre équipe produit m'a encouragé à vous écrire. \u{2728} Votre feuille de route sur l'onboarding correspond exactement au travail qui me passionne\u{200B}.\n\nJe serais ravi d'échanger 30\u{202F}minutes pour vous présenter mon parcours de PM et comprendre vos enjeux actuels.\n\nBien à vous,\nThéo",
    expectedSanitized:
      "Bonjour Madame Renaud,\n\nJulie de votre équipe produit m'a encouragé à vous écrire. Votre feuille de route sur l'onboarding correspond exactement au travail qui me passionne.\n\nJe serais ravi d'échanger 30 minutes pour vous présenter mon parcours de PM et comprendre vos enjeux actuels.\n\nBien à vous,\nThéo",
    criteria: SAIN,
  },
  {
    id: "email-3",
    canal: "email",
    idea: "Relancer un prospect rencontré il y a un mois, rappeler la valeur, proposer une démo.",
    // Tells : barre horizontale U+2015, emoji 👋, lignes blanches multiples à borner.
    rawClaude:
      "Bonjour Nadia,\n\nOn s'est rencontrés il y a un mois sur le sujet de la facturation automatisée.\u{1F44B}\n\n\n\nDepuis, on a livré l'export comptable\u{2015}c'est précisément ce qui vous bloquait. Je peux vous montrer le résultat en quinze minutes.\n\nDites-moi ce qui vous arrange,\nThéo",
    expectedSanitized:
      "Bonjour Nadia,\n\nOn s'est rencontrés il y a un mois sur le sujet de la facturation automatisée.\n\nDepuis, on a livré l'export comptable - c'est précisément ce qui vous bloquait. Je peux vous montrer le résultat en quinze minutes.\n\nDites-moi ce qui vous arrange,\nThéo",
    criteria: SAIN,
  },
];

// ─── WhatsApp (très court, 1-2 phrases) ──────────────────────────────────────
const WHATSAPP: VoiceCase[] = [
  {
    id: "whatsapp-1",
    canal: "whatsapp",
    idea: "Demander à un ancien collègue s'il connaît quelqu'un qui recrute en data.",
    // Tells : emoji 🙏, cadratin.
    rawClaude:
      "Hello Yanis \u{1F64F} tu connaîtrais quelqu'un qui recrute en data en ce moment\u{2014}je relance mes recherches ?",
    expectedSanitized:
      "Hello Yanis tu connaîtrais quelqu'un qui recrute en data en ce moment - je relance mes recherches ?",
    criteria: SAIN,
  },
  {
    id: "whatsapp-2",
    canal: "whatsapp",
    idea: "Confirmer un café avec un contact rencontré la semaine dernière.",
    // Tells : emoji ☕, NBSP.
    rawClaude:
      "Salut Inès \u{2615} on tient toujours pour le café jeudi 11\u{00A0}h près de la gare ?",
    expectedSanitized:
      "Salut Inès on tient toujours pour le café jeudi 11 h près de la gare ?",
    criteria: SAIN,
  },
  {
    id: "whatsapp-3",
    canal: "whatsapp",
    idea: "Remercier quelqu'un pour une mise en relation et dire que le call s'est bien passé.",
    // Tells : emoji 🎉, zero-width, espace fine insécable.
    rawClaude:
      "Merci\u{200B} encore pour la mise en relation \u{1F389} le call avec Léa s'est super bien passé\u{202F}!",
    expectedSanitized:
      "Merci encore pour la mise en relation le call avec Léa s'est super bien passé !",
    criteria: SAIN,
  },
];

// ─── SMS (très court, 1-2 phrases) ───────────────────────────────────────────
const SMS: VoiceCase[] = [
  {
    id: "sms-1",
    canal: "sms",
    idea: "Prévenir un contact que je serai en retard de dix minutes au rendez-vous.",
    // Tells : emoji 🙏, cadratin.
    rawClaude:
      "Bonjour Marc, petit contretemps\u{2014}j'aurai dix minutes de retard, désolé.\u{1F64F}",
    expectedSanitized:
      "Bonjour Marc, petit contretemps - j'aurai dix minutes de retard, désolé.",
    criteria: SAIN,
  },
  {
    id: "sms-2",
    canal: "sms",
    idea: "Demander à un recruteur le créneau de l'entretien de demain.",
    // Tells : emoji 👍, NBSP.
    rawClaude:
      "Bonjour, pouvez-vous me confirmer l'heure de l'entretien de demain ? \u{1F44D} Merci, je bloque mon agenda à 14\u{00A0}h.",
    expectedSanitized:
      "Bonjour, pouvez-vous me confirmer l'heure de l'entretien de demain ? Merci, je bloque mon agenda à 14 h.",
    criteria: SAIN,
  },
  {
    id: "sms-3",
    canal: "sms",
    idea: "Relancer doucement un contact qui n'a pas répondu à mon mail de la semaine dernière.",
    // Tells : demi-cadratin, emoji 🙂, zero-width.
    rawClaude:
      "Bonjour Sophie, je me permets un petit rappel\u{2013}je vous ai écrit la semaine dernière. \u{1F642} Toujours partante pour un échange\u{200B} ?",
    expectedSanitized:
      "Bonjour Sophie, je me permets un petit rappel - je vous ai écrit la semaine dernière. Toujours partante pour un échange ?",
    criteria: SAIN,
  },
];

/**
 * LE PANIER : 12 cas = 3 par canal (N = 3, figé au 1er run). Source de vérité de
 * l'anti-régression. Importé tel quel par le runner d'evals.
 */
export const VOICE_BASKET: readonly VoiceCase[] = [
  ...LINKEDIN,
  ...EMAIL,
  ...WHATSAPP,
  ...SMS,
];

/** N figé : nombre d'idées-test PAR CANAL dans le panier. */
export const CASES_PER_CANAL = 3;
