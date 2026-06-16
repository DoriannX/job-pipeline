# Addendum — PRD Plume (job-pipeline)

*Profondeur technique et décisionnelle sortie du PRD pour le garder lisible. Destiné à l'architecture, au solution design et à l'UX. Non normatif au sens FR ; le PRD reste la source de vérité produit.*

## A. Modèle de données (implicite, à formaliser en architecture)

**Entités MVP**
- `users` — identité Google OAuth ; toutes les entités sont scopées par `user_id` (SaaS-ready).
- `contacts` — identité, source d'import (csv/manuel), Score de froideur (dérivé), Canal de prédilection. `user_id`.
- `channels` — énumération : LinkedIn, Email, WhatsApp, SMS. Conditionne le comportement canal-aware du Composeur. Au MVP, tous en copier-vers-Envoyé.
- `messages` — `date`, `channel`, `status` (brouillon/envoyé/vu/répondu/ignoré), `texte` figé après Envoyé. Rattaché à un `contact`.
- `next_actions` (Relances) — date d'échéance auto, déclenche le push, alimente la File du jour. Rattaché à un `contact`.
- `voice_samples` (corpus de Voix) — **entité à modéliser explicitement** : seed optionnel + messages édités/envoyés versés au fil de l'eau. Alimente le Few-shot voix (FR-10, FR-17). Sélection MVP : N messages récents/édités (paramètre à fixer).

**Entités v1 (différées)**
- `opportunities` — poste @ entreprise, stade + next-action ; modèle opportunité-first. Relation centrale v1 : Contacts <-> Opportunités <-> Messages.

**Relations**
- user 1—N {contacts, messages, next_actions, voice_samples}
- contact 1—N messages ; contact 1—N next_actions
- message N—1 channel
- (v1) opportunity N—N contacts ; opportunity 1—N messages

## B. Stack et mécanismes

- **Front / app** : Next.js (PWA installable), Tailwind, mobile-first, Capacitor-ready (wrap natif ultérieur sans réécriture).
- **Données** : Turso (déjà en place).
- **Auth** : Google OAuth (cohérent avec futur scan Gmail v1).
- **IA** : API Claude (Anthropic). Haiku par défaut, Opus en option. Few-shot/RAG en contexte, **pas de fine-tuning** (instantané, quasi gratuit). Pas d'entraînement sur les données utilisateur, rétention limitée.
- **Notifications** : Web Push via service worker. Contrainte iOS : ajout à l'écran d'accueil requis.
- **Envoi** : MVP = copier vers presse-papier + marquage Envoyé (tous canaux). v1 = envoi direct (email API, WhatsApp API, SMS Twilio). LinkedIn reste manuel à toutes phases (pas d'API, ban) ; fast-follow = extension navigateur qui pré-remplit le champ LinkedIn (semi-manuel, sans API).

## C. Unit economics (sizing)

- 1 génération ≈ quelques milliers de tokens : < 1 centime (Haiku), quelques centimes (Opus).
- Utilisateur actif ≈ 20-50 générations / semaine.
- Coût par utilisateur actif ≈ quelques dizaines de centimes à 1-2 EUR / mois.
- Implication SaaS : free tier **doit** être plafonné (quota de générations) sinon l'API mange la marge. Quota non chiffré (à définir au SaaS).
- Hypothèse pricing (non actée) : freemium plafonné -> premium ~9-15 EUR/mois (générations illimitées + pipeline + analytics + signaux timing + push).

## D. Options considérées (matrices de décision)

| Décision | Option retenue | Alternatives écartées | Rationale |
|---|---|---|---|
| Import MVP | CSV LinkedIn + manuel | Scan Gmail au MVP ; scraping LinkedIn | MVP plus léger ; moins de surface OAuth/privacy/base légale tiers ; scraping = ban CGU |
| Cold-start | Manuel-first + ajout rapide multiple ; CSV en backfill async | CSV comme porte d'entrée ; remonter Gmail au MVP | Export LinkedIn jusqu'à 24h → casse l'onboarding <2 min ; manuel/rapide = instantané ; renforce "outreach ciblé, pas CRM de masse" ; Gmail = trop lourd pour le MVP |
| Envoi MVP | Copier -> Envoyé (tous canaux) | Envoi direct email au MVP ; envoi direct multi-canal | MVP = boucle pure, zéro intégration sortante ; envoi direct = v1 |
| Auth | Google OAuth | Magic link ; email+mot de passe | Cohérent Turso + futur Gmail ; friction minimale ; pas de surface reset/hashing |
| Apprentissage Voix | Few-shot / RAG en contexte | Fine-tuning | Instantané, quasi gratuit, pas de pipeline d'entraînement |
| Composeur défaut | Champ vide (Générer/Améliorer à la demande) | Brouillon toujours pré-généré | Pré-génération jugée gênante (idée #61 rejetée au brainstorming) |
| Modèle IA | Haiku défaut, Opus option | Opus par défaut | Coût ; qualité Haiku pour la Voix à valider (R1) |

## E. Nom produit

- **Retenu : "Plume"** (la plume d'écriture ; touche directe sur le héros "ta voix"). Repo technique = `job-pipeline`.
- Écartés : Accroche, Amorce, Trame, Cordée, Filon.

## F. Paysage concurrentiel (synthèse)

Trois familles largement disjointes ; aucune ne combine les trois briques de Plume.

| Acteur | Famille | Manque vs Plume |
|---|---|---|
| Huntr, Teal, Simplify | Tracker de candidatures (orienté offres) | Pas d'outreach réseau ; pas de voix ; logique cold apply |
| Clay, Folk | Personal CRM générique (Folk a déjà un pipeline) | Pas orienté job ; pas de composeur voix few-shot. Folk = fast-follower n°1, il ne lui manque que la voix (cf. R6) |
| Careerflow | Career copilot (le plus proche) | Networking = module secondaire ; IA par templates, pas few-shot "ta voix" |
| LinkedIn natif | Réseau + AI assistant | IA seulement 1er message ; aucune relance/reminder ; pas de pipeline |
| Spark, HyperWrite, Junia | Voice-clone d'écriture | Pas de contacts/opportunités/relances (couche rédaction seule) |

Trous de marché : pipeline orienté-personnes pour le job search ; voix few-shot dans le contexte relationnel ; couche relances+notifs sur le réseau ; PWA mobile-first ; positionnement anti-robot/authenticité comme valeur n°1.

Pricing observé dans l'espace : freemium + abo ~10-40 USD/mois ; paywall récurrent = l'IA.

## G. Statistiques marché (gouvernance)

- **Autorisées** : 54% des embauches via une connexion (2025) ; cooptation ~2% des candidatures / ~11% des embauches (~10x) ; 34% des référés embauchés vs 2-5% via job boards ; time-to-hire 29j vs 55j.
- **Interdites (débunkées)** : "85% via le réseau" ; "70% hidden job market". Ne pas réintroduire.

## H. Tensions non résolues (pour arbitrage aval)

- **File infinie (#54) vs Planif à rebours (#63)** : "proposer des gens tant qu'il y en a" vs "planning rétro-daté depuis une deadline". À réconcilier en v1.
- **Signaux de timing (#68)** : remonté en v1 (coup de cœur), mais la source des signaux publics (changement de poste, levée) n'est pas tranchée (LinkedIn login-walled). Faisabilité à instruire.
- **Tension de fond** : automatiser au maximum (agent nocturne, "l'app choisit qui", générer de 0) tout en garantissant que rien ne sente l'automatisation. Pari central du produit.
