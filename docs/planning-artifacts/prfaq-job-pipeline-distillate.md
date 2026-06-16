---
title: "PRFAQ Distillate: job-pipeline (produit: Plume)"
type: llm-distillate
source: "prfaq-job-pipeline.md"
created: "2026-06-15"
purpose: "Token-efficient context for downstream PRD creation"
---

# Distillat PRFAQ — Plume (repo: job-pipeline)

## Identité produit
- **Nom produit : "Plume"** ("ta plume" = ta voix d'écriture). Repo technique = `job-pipeline` (≠ nom produit).
- One-liner : app qui aide les chercheurs d'emploi à décrocher un poste via leur réseau perso ; cœur = composeur qui écrit les messages dans LEUR voix, jamais comme une IA.
- concept_type : produit commercial. Roadmap phasée : (1) outil perso → (2) potes → (3) SaaS payant (cible : chercheurs d'emploi + freelances).
- Beachhead : profils tech/devs en recherche via réseau. Effet méta : un dev qui livre ce SaaS = portfolio qui sert sa propre recherche.

## Le moat (différenciateur central — non négociable)
- **Composeur "ta voix" = le SEUL vrai moat.** Few-shot/RAG sur les messages passés du user + liste noire explicite des tells d'IA (tirets cadratins, formules ampoulées, emoji clichés). PAS de fine-tuning (exemples injectés en contexte = instantané, quasi gratuit).
- Pipeline d'opportunités + relances zéro-fuite = table stakes commoditisées (Dex/Folk/Huntr les ont), pas le moat.
- Principe produit récurrent : tout doit sentir l'humain, jamais le dashboard auto. Revue humaine systématique avant chaque envoi. Mode sans-IA par contact (échanges 100% locaux, rien n'est envoyé à l'API).

## Cadrages / framings rejetés (et pourquoi)
- CP cadré "outil 100% perso" → rejeté : pas Working-Backwards-natif, pas de client externe, FAQ molles.
- CP cadré "chercheurs + freelances d'emblée" → rejeté : dilue le persona ; freelance = cible SaaS future, pas le persona du CP.
- Titre mené par "pipeline d'opportunités" → rejeté : mène avec la table stakes, pas l'arme. Corrigé → titre mené par le composeur "ta voix".
- Titre "double promesse" (pipeline + voix) → rejeté : un titre qui dit tout ne frappe rien.
- Noms rejetés : Filon (connotation opportuniste, contraire au positionnement humain), Accroche, Amorce, Trame, Cordée, Tisse/Reso/Lien.
- Stat "85% des jobs via réseau" → rejetée : provenance contestée/débunkée. Remplacée par chiffres défendables (ci-dessous).
- Citation client v1 trop vantarde → réécrite plus sèche/concrète.

## Signaux de requirements (captés en coaching)
- **Composeur :** champ unique = source de vérité (le texte EST le message) ; boutons Améliorer / Générer ; canal-aware (LinkedIn court / email structuré / WhatsApp ultra court) ; verrou read-only après "Envoyé" + bouton Modifier discret ; statut message (brouillon/envoyé/vu/répondu/ignoré) modifiable d'un tap.
- **Voix :** few-shot minimal DÈS LE MVP (cf. scope) ; seed optionnel (coller anciens messages) avec défaut neutre ; apprentissage au fil des envois (chaque message édité+envoyé = nouvel exemple).
- **Réseau :** import LinkedIn CSV officiel + scan Gmail (PAS de scraping). Tri/dédup/flag liens froids. Fiche contact = timeline complète (anti-doublon). Score froideur du lien.
- **File du jour :** écran par défaut, priorisé (nouveaux + relances dues), action-first.
- **Relances zéro-fuite :** next-action date auto ; notification push téléphone quand relance due.
- **Modèle data MVP :** `contacts`, `channels`, `messages` (date, canal, statut, texte figé), `next_actions`. Opportunités en v1.
- **Privacy = first-class :** données dans la base du user, zéro partage tiers, export/suppression à tout moment (formats ouverts), transparence sur ce qui part à l'API Claude.

## Contexte technique / contraintes / plateforme
- Stack : Next.js (PWA) + Turso (déjà en place) + auth + Tailwind + API Claude. Mobile-first.
- Archi SaaS-ready dès le départ (auth + données scopées par user) MAIS single-user pour l'instant.
- PWA installable (téléphone + PC), Web Push via service worker → couvre "notif sur mon tel" sans store. **iOS : Web Push nécessite "ajout écran d'accueil".**
- Mobile-first → Capacitor-ready (wrap natif plus tard sans réécrire).
- **Coût API (unit economics) :** ~<1ct (Haiku) à qq cts (Opus) / génération ; ~qq dizaines de cts à ~1-2€/mois par user actif (20-50 générations/sem). Reco : **Haiku par défaut, Opus en option premium**. Free tier SaaS DOIT être plafonné (quota de générations) sinon l'API mange la marge.
- LinkedIn : pas d'envoi auto (CGU/ban). Lancement = copier→coller→marquer envoyé. **Fast-follow : extension navigateur qui pré-remplit le champ LinkedIn** (semi-manuel, sans API, sans ban). Email/WhatsApp/SMS : envoi direct prévu.
- UX non négociable : 3 onglets max (Aujourd'hui · Réseau · Stats) + Réglages + Composeur en flow (s'ouvre depuis un contact, pas un menu). Onboarding 2 min. Vue "action du jour" par défaut.

## Intelligence concurrentielle (recherche 2026)
- 4 silos, aucun ne combine les 3 piliers :
  - **CRM perso** (Dex 12-20$/mo, Clay.earth free-20$, Folk 24-48$, Monica self-host, Covve ~10$) : relations + relances, PAS de modèle d'opportunité, IA = suggestions (Dex) ou ton sales (Folk), jamais "ta voix".
  - **Outreach froid** (Lemlist 63-87$/mo, Waalaxy 59-179$, Reply ~167$ TCO, LGM 60-120€) : séquençage, mais spammy, cher, RISQUE BAN LinkedIn. L'anti-pattern.
  - **Job trackers** (Huntr free-40$, Teal free-29$, Simplify free, Careerflow ~20$) : funnel candidatures, réseau secondaire, IA = CV/lettre (pas voix outreach).
  - **Humanizers IA** (Undetectable, Rephrasy…) : launderers stateless, optimisent pour tromper les DÉTECTEURS (pas sonner comme TOI), zéro CRM/pipeline/suivi.
- **Fast-follower n°1 = Folk** (a déjà pipeline + AI workflow assistant ; manque voice-mimicry + template job-search).
- **Chiffres marché défendables (à utiliser) :** 54% des US workers embauchés via une connexion (2025) ; cooptations = ~2% des candidatures mais ~11% des embauches (~10×) ; 34% des candidats recommandés embauchés vs 2-5% job boards ; time-to-hire 29j (référé) vs 55j (job board). **NE PAS utiliser "85%" ni "70% hidden job market".**

## Scope MVP / v1 / différé
- **MVP (la boucle qui marche) :** contacts (import CSV + manuel) → composeur (champ unique, Améliorer/Générer **+ few-shot voix minimal**, copier→envoyé, statut, verrou, liste noire des tells) → file du jour basique → relances zéro-fuite → coquille PWA mobile-first + auth + privacy de base.
- **DÉCISION ACTÉE :** le few-shot voix minimal est REMONTÉ du v1 au MVP (c'est le moat ; le MVP doit le porter J1 + permet de tester le risque n°1 tout de suite). Le composeur MVP n'est donc PAS un Améliorer/Générer générique.
- **v1 :** opportunités/pipeline (Contacts↔Opportunités↔Messages, stade + next action, opportunité-first), analytics funnel + recettes gagnantes (anti-vanity), gamification (streak/XP/achievements/heatmap/récap dimanche), style appris avancé (RAG complet), auto-statut email (Gmail), expansion réseau, signaux de timing #68 (remonté, coup de cœur), notif push.
- **v2 :** agent nocturne (file de brouillons), recherche web avant écriture, A/B test, saisie vocale, séquences de relance multi-étapes, campagnes multi-contacts.
- **v3 (SaaS) :** multi-user, social/squad d'accountability, billing, freelances comme cible.
- **Hors scope / rejeté :** scraping LinkedIn (ban) ; brouillon toujours pré-généré (gênant) ; prédiction de chances (spéculation) ; simuler la réponse (anti-overthinking).

## Pricing (NON RÉSOLU — à instruire)
- Hypothèse : freemium plafonné (X générations/mois gratuites) → premium ~9-15€/mois (générations illimitées + pipeline + analytics + signaux timing + push).
- Tension : job-seeker = segment transitoire/price-sensitive (CRM perso 10-20€, job trackers gratuits) → headroom mince. SaaS durable probablement via **freelance / entretien-réseau continu** (willingness to pay supérieure, usage récurrent).
- À valider EMPIRIQUEMENT : paywall sur 10-20 users après phase potes. Ne pas traiter comme acquis.

## Délai / ressources
- Solo, temps partiel. MVP (boucle core) = plusieurs semaines, PAS un week-end. Pas d'estimation ferme sans découpage.
- Pièges qui débordent : PWA/push (service worker, contrainte iOS) + import CSV/Gmail propre.
- Build order : 1) setup Next.js PWA + Turso + auth + Tailwind ; 2) modèle data ; 3) import CSV → contacts ; 4) onglet Réseau (liste + fiche) ; 5) **composeur EN PREMIER** (cœur de valeur, tester sur 5 vrais contacts) ; 6) file du jour ; 7) logique relance ; 8) PWA manifest + SW + Web Push.

## Questions ouvertes / inconnues (flaggées en FAQ interne)
- **Faisabilité voix (RISQUE N°1) :** combien d'exemples pour une voix convaincante ? Qualité Haiku suffisante ? → tester sur 20-30 vrais messages du user dès le MVP (généré vs édité).
- **Willingness to pay :** réelle ? → paywall test 10-20 users.
- **Conversion organique :** taux inconnu (acquisition build-in-public non chiffrée).
- **RGPD :** base légale pour données de tiers importées (intérêt légitime ?), à cadrer avant SaaS.

## Verdict — items actionnables
- **À remettre au feu :** (1) modèle économique + segment freelance à penser sérieusement ; (2) faisabilité voix à mesurer dès MVP ; (3) plan d'acquisition concret (2-3 canaux + boucle feedback).
- **Fissures à traiter délibérément :** (1) thèse SaaS = poser des jalons de vérité explicites (un inconnu l'utilise sans toi ; quelqu'un paie) avant d'investir comme un SaaS — ne pas confondre outil perso/portfolio (garanti) et SaaS (pari) ; (2) moat = fenêtre pas forteresse → vitesse + focus + données de voix accumulées (Folk = fast-follower) ; (3) RGPD avant ouverture à d'autres ; (4) solo = point unique de défaillance → time-box, livrer la boucle core avant d'élargir, ne pas sur-construire.
- **Forgé (à conserver intact) :** héros = composeur "ta voix" ; positionnement anti-spam/no-automation ; honnêteté (pas de stats inventées, jeunesse assumée) ; paradoxe d'authenticité désamorcé (fond du user + revue humaine + mode sans-IA).
