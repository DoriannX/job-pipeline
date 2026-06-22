# Addendum — PRD Campagne

Profondeur contribuée hors-PRD : mécanismes (architecture/solution design), alternatives rejetées, persona SaaS, données de sizing. Le PRD reste capability-first ; ce qui suit est le *comment* et le *pourquoi-pas*.

## Mécanisme — enrichment People Data Labs (FR-43)

- **Fournisseur de départ = PDL** (D5) : palier gratuit 100 matchs/mois, ~$0,28/match au-delà, RGPD jugé défendable.
- **Appel serveur-only** : clé PDL en variable d'env serveur, jamais `NEXT_PUBLIC_*`, jamais d'appel browser→PDL (même doctrine que la clé Claude, project-context Légal/Privacy).
- **Match input** : à partir des handles contact (email normalisé, nom+entreprise) — pas de scraping, uniquement la donnée déjà dans Plume.
- **Sortie consommée = changement de poste** (job-change). Les autres champs PDL ne sont pas exploités au v1 (surface privacy minimale).
- **Borné par l'objectif (FR-52)** : le set enrichi = sous-ensemble des contacts scorés pertinents, pas tout le réseau.
- **Cadence** : batch 1x/jour + à la demande (FR-46) ; pas de polling temps réel (coût).

## Mécanisme — scoring de pertinence LLM (FR-42)

- **LLM via clé Claude** (serveur-only) : prompt = objectif cadré (FR-40) + attributs contact (rôle, entreprise, notes, historique). Sortie = score relatif + justification courte (matière au *pourquoi*).
- **Déterminisme du signal brut (NFR-9)** : froideur et job-change sont déterministes ; le score LLM est la part « jugement ». Le split hybride veut que la couche conversationnelle ne masque pas une régression de signal → tester les signaux bruts séparément du copilote.
- **Prompt caching** sur le préfixe stable (objectif) si le coût le justifie (cf. AR-7).

## Mécanisme — feedback négatif / apprentissage (FR-48, P6)

- **v1 = PAS un modèle entraîné.** Le rejet (« écarté ») devient un **exemple négatif borné par campagne** réinjecté dans le contexte de scoring LLM (« le founder a écarté X parce que … »).
- **Fait durable au niveau contact (P10)** : si le rejet exprime un fait stable (« a quitté la data »), il est stocké sur la fiche contact (donnée user-authored, pas PDL brut) et réutilisable par toute campagne.
- **Frontière** : le *scoring* reste borné campagne ; le *fait contact* persiste. Ne pas confondre les deux portées.
- Évolution possible (hors v1) : pondération apprise, vrai feedback loop — à rouvrir si le dogfood montre que l'exemple-en-contexte ne suffit pas.

## Mécanisme — état de campagne (FR-41, NFR-10, P9)

- Table `campagnes` pressentie : `id`, `user_id`, `objectif` (NL cadré), `cadrage` (réponses aux questions FR-40), `etat` (`active|en_pause|close`), `opt_in_enrichment` (bool + timestamp), `created_at`.
- **Unicité** : au plus une campagne `active` par user (contrainte/garde, idempotent — esprit AR-4).
- Bascule = `active → en_pause` de l'ancienne, nouvelle `active`. Reprise = `en_pause → active`. Apprentissage conservé (lié campagne pour le scoring, lié contact pour les faits).

## Alternatives rejetées (traçabilité)

- **Diff CSV manuel** pour le « bon moment » → rejeté (D5) : pas assez automatique vs enrichment auto.
- **Scraping LinkedIn** → banni (D6) : Proxycurl ($10M ARR) attaqué par LinkedIn (procès 2026-01-24), fermé (2026-07-04). Aligné project-context « pas de scraping ».
- **Liste froide brute** (tous les dormants) → rejeté (D11) : c'est déjà Epic 4 ; Campagne veut *pertinent maintenant*, pas *négligé*.
- **Multi-campagnes parallèles v1** → différé (D15) : une active à la fois, simplicité dogfood.
- **Écran app dédié pour la liste** → différé v2 (P5) : surface + sync d'état évitées, copilote suffit.
- **Temps réel / polling par signal** → rejeté (P8) : coût PDL, hors esprit v1.
- **Quota liste paramétrable** → rejeté v1 (P7) : 3-5 en dur, une décision de moins.

## Source externe différée — news par boîte (v2, D14)

2e source externe (API news + polling par entreprise) pour détecter levée/recrutement. Signal **plus faible** que le job-change individuel. Le founder l'avait coché en v1 puis corrigé → **defer v2** pour garder le MVP serré.

## RGPD — le tiers enrichi (art. 14), point dur

L'opt-in (FR-51) est le consentement du **founder** à utiliser PDL. Il ne couvre **pas** le **contact enrichi**, qui est une personne dont les données sont collectées **sans être recueillies auprès d'elle** → **RGPD art. 14** (obligation d'information de la personne concernée). Au MVP dogfood single-user : exposition minimale (réseau perso, un user, pas de diffusion), risque porté par le founder — mais l'obligation existe déjà. **Avant SaaS, requis :** mécanisme d'information du tiers (ex. mention au moment où il devient contactable, ou politique accessible), base légale documentée par contact (`legal_basis`, AR-16), DPA avec PDL. Ne pas vendre la « privacy » comme protégeant le tiers tant que ce mécanisme n'existe pas.

## Cache & quota enrichment (mécanisme borne coût)

- **Cache résultat PDL par contact** : un contact enrichi stocke son dernier résultat + timestamp ; le batch ne ré-interroge que si l'intervalle de re-check est dépassé (FR-43). Le job-change étant lent, intervalle dans l'esprit mensuel.
- **Quota dur par campagne** (NFR-7 garde-fou 3) : compteur d'appels PDL/campagne, refus au-delà du plafond (pas best-effort). C'est le **seul** garde-fou qui borne *numériquement*, car le set éligible dépend d'un score LLM non-déterministe.
- Conséquence : le coût pire-cas par campagne = `min(contacts éligibles non-cachés, quota dur)` × prix match, pas `réseau entier × jours`.

## Persona — horizon SaaS (D16, gardé large)

- **Primaire concret (dogfood)** : le founder, chercheur d'emploi via réseau perso. Définit le problème (rater le bon moment, partir au hasard).
- **Secondaire (non tranché)** : tout *networker actif* faisant de l'outreach relationnel vers un but — chercheur d'emploi, freelance en quête de clients, founder/sales solo en prospection early-stage.
- Le persona précis **n'est pas figé** : à trancher au moment où l'ouverture SaaS se confirme, pas avant. Garder large est assumé (le founder = cas réel, le reste = hypothèse à tester).

## Sizing & coût (matière Open Questions)

- PDL : 100 gratuits/mois, $0,28/match au-delà. Quota par campagne à fixer.
- Volume de validation dogfood : esprit R1 (20-30 messages) à dimensionner.
- N (fenêtre bien-timé) : candidats 7/14 jours, à caler sur 1er jeu de données.
