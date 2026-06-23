// Types de réhydratation du copilote (Phase 3, CAP-2/5).
//
// La RÉHYDRATATION AUTO au montage a été RETIRÉE (story 7-8, finding F14) : au refresh, le copilote
// démarre fermé/vide — on ne rouvre plus le dernier fil actif d'office (jugé intrusif au dogfood).
// Ces types restent partagés par le chemin de réouverture EXPLICITE d'un fil
// (`openConversationAction` → `mapTurns`). La persistance des fils, elle, est inchangée.

/**
 * Un tour réhydraté pour le popup : le rôle, le TEXTE final, et — pour un tour `assistant` ayant
 * écrit — son `turnId` (réhydrate l'affordance « annuler ce tour », CAP-5). Les chips tool-use ne
 * sont JAMAIS réhydratées (progression éphémère, Non-goal).
 */
export type BootstrapTurn = {
  role: "user" | "assistant";
  content: string;
  /** LIEN rewind (CAP-5) : présent seulement sur un tour `assistant` ayant écrit. */
  turnId?: string;
  /**
   * Id PERSISTÉ du tour (F6, story 7-9) : seul un message porteur de cet id est RÉÉDITABLE (la
   * réédition vise ce message en DB puis tronque le fil aval). Présent sur les tours réhydratés
   * depuis la DB (`openConversationAction`/`editMessageAction`) ; absent d'un tour streamé en direct
   * (pas encore relu) — son affordance d'édition n'apparaît donc qu'après réouverture/troncature.
   */
  messageId?: string;
};

/** Réponse d'une réouverture de fil : l'id du fil (ou `null`) + ses tours bornés au plus récent. */
export type BootstrapResult = {
  conversationId: string | null;
  turns: BootstrapTurn[];
};
