# Réconciliation PRFAQ -> PRD + Addendum (Plume)

*Tâche : détecter ce que le PRD final + addendum a SILENCIEUSEMENT PERDU ou DÉFORMÉ par rapport à la source PRFAQ. Cible prioritaire : idées qualitatives (ton, voix, feel, intention émotionnelle, formulations à préserver) que la structure FR a tendance à écraser.*

- **Input source :** `docs/planning-artifacts/prfaq-job-pipeline.md`
- **PRD :** `docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/prd.md`
- **Addendum :** `docs/planning-artifacts/prds/prd-job-pipeline-2026-06-15/addendum.md`
- **Date :** 2026-06-15

Légende gravité : **CRITIQUE** (perte d'une idée porteuse de l'âme/intention du produit) · **MAJEUR** (déformation ou omission sensible) · **MINEUR** (nuance perdue, récupérable).

---

## GAP 1 — La voix de la promesse client ("genre de cliente Camille") est aplatie en récit fonctionnel

**Gravité : CRITIQUE**

**Source dit :** le PRFAQ contient deux citations qui PORTENT l'intention émotionnelle du produit, écrites avec un grain délibéré :
- Camille (cliente) : *"Avant, je passais une demi-heure sur chaque message, ou je copiais-collais et personne ne répondait. Là je note deux mots, ça sort dans mon ton, je relis, j'envoie. J'ai recontacté des gens que j'avais laissés filer depuis des mois. Deux cafés et un entretien en deux semaines."* Les coaching-notes signalent explicitement que cette citation a été réécrite "plus sèche/concrète" après auto-challenge (v1 jugée "trop vantarde"). C'est un choix de ton défendu.
- Doriann (fondateur) : *"On répète à tout le monde d'activer son réseau, sans jamais donner l'outil pour le faire bien. [...] Plume part de votre voix : il apprend votre façon d'écrire et vous la rend, plus vite. La technologie disparaît, il ne reste que vous."*

**PRD dit / omet :** le PRD transforme Camille en "protagoniste" de user journeys (UJ-1..3) rédigés à la 3e personne, neutres et procéduraux ("Elle prend la première carte, tape... touche Générer..."). La citation cliente brute, son registre ("Deux cafés et un entretien en deux semaines"), et surtout son émotion (le soulagement, la reconquête de liens "laissés filer depuis des mois") disparaissent. La citation fondateur n'est conservée QUE pour sa dernière phrase, recyclée en §9 "Ancrage de marque". Le reste du manifeste de Doriann ("on répète à tout le monde d'activer son réseau sans donner l'outil... les solutions automatisent et ça se voit... fait gagner du temps en sacrifiant ce qui compte") est perdu.

**Suggestion :** préserver les deux citations verbatim dans le PRD (encadré "Voix produit / Intention" en §1 ou §9), avec une note explicite : *citation Camille volontairement sèche et concrète (anti-vantardise), à ne pas réécrire en marketing lisse*. C'est précisément le genre de formulation que les coaching-notes ont protégé et que la structure FR écrase.

---

## GAP 2 — "La technologie disparaît, il ne reste que vous" : le tutoiement intime devient slogan désincarné

**Gravité : MAJEUR**

**Source dit :** tout le PRFAQ s'adresse au lecteur au **"vous"** (registre de confiance, presque main tendue) : *"Vous tapez une idée brute... elle ressort dans votre voix... La technologie disparaît, il ne reste que vous."* L'intention émotionnelle clé est l'effacement de l'outil au profit de la personne — un sentiment de respect, pas de performance.

**PRD dit / omet :** le PRD bascule au **"tu"** (vision §1 : "plus tu veux bien faire... il ne reste que toi"). Le glissement vous->tu n'est pas neutre : le PRFAQ "vous" est le registre client/marketing (distance respectueuse) ; le PRD "tu" est le registre interne builder. Ce n'est pas un défaut en soi (PRD = doc interne), MAIS l'ancrage de marque §9 cite la phrase en "ta voix... il ne reste que toi", figeant le tutoiement comme s'il était la formulation canonique de marque. Or la formulation de marque source est au "vous". Risque : le copywriting produit hérite du "tu" interne au lieu du "vous" travaillé du PRFAQ.

**Suggestion :** marquer explicitement dans §9 que la formulation client/marque officielle est au **"vous"** ("Plume part de votre voix... il ne reste que vous"), le "tu" du PRD étant un registre de travail interne. Éviter que le tutoiement contamine la voix de marque destinée à l'utilisateur final.

---

## GAP 3 — Le paradoxe d'authenticité : le PRD garde les mécanismes, perd l'argument moral

**Gravité : MAJEUR**

**Source dit :** la question la plus dure du PRFAQ (Q2 client, désignée par les coaching-notes comme "le pivot de crédibilité de tout le produit") est traitée avec un argumentaire moral nuancé : *"Plume n'invente pas le fond : vous donnez le qui, le point commun, l'intention. Il met en forme dans votre style... Ce n'est pas un robot qui se fait passer pour vous : c'est vous, plus vite, sans les tics qui font justement 'IA'."* L'enjeu est l'**honnêteté** ("C'est honnête ?"), pas seulement une feature.

**PRD dit / omet :** le PRD encode les mitigations sous forme de FRs (FR-12 revue humaine, FR-15 mode sans-IA, FR-11 liste noire) et de garde-fous §7.1. C'est correct fonctionnellement. Mais l'**argument** — pourquoi ce n'est pas malhonnête, la distinction "tu donnes le fond, il met en forme" — n'apparaît nulle part. Le PRD dit "la revue humaine est obligatoire" mais ne dit jamais *pourquoi c'est ce qui rend Plume honnête plutôt qu'un imposteur*. La frontière conceptuelle "Plume n'invente pas le fond, il met en forme" (le cœur de la défense morale) n'est pas posée comme principe produit.

**Suggestion :** ajouter dans §7.1 (ou §1) un principe nommé, type *"Principe d'honnêteté : l'utilisateur fournit le fond (qui, point commun, intention), Plume met en forme dans sa voix. Plume n'invente pas le fond. C'est ce qui distingue 'toi, plus vite' d'un robot qui se fait passer pour toi."* C'est load-bearing : c'est l'objection qui peut tuer le concept.

---

## GAP 4 — Le feel "zéro décision, zéro fil perdu" et l'angoisse qu'il soulage sont réduits à de la mécanique de file

**Gravité : MAJEUR**

**Source dit :** le PRFAQ décrit l'expérience émotionnelle de la file du jour : *"Chaque matin, une file vous dit exactement qui contacter et qui relancer : zéro décision, zéro fil perdu."* et *"une notification sur votre téléphone vous prévient avant qu'une piste ne refroidisse."* L'intention est le **soulagement de la charge mentale** : ne plus avoir à décider, ne plus avoir peur d'oublier. Le problème source est cadré émotionnellement : *"Plus vous voulez bien faire, plus c'est lent. Plus vous allez vite, plus ça sonne faux."* — une **démoralisation**.

**PRD dit / omet :** le PRD garde la phrase-douleur (bien, §1 et §12) mais la File du jour devient FR-22..24 + glossaire : "file priorisée", "action à la fois", "swipe". Le ressenti "zéro décision" survit littéralement dans UJ-1 ("zéro décision, zéro page blanche") — bon point — mais l'intention "soulager l'angoisse d'oublier / la charge mentale de décider qui contacter" n'est jamais nommée comme une intention produit. Le JTBD émotionnel "garder le moral pendant une recherche longue" (§2.1) est présent mais déconnecté de la file : le PRD ne relie pas explicitement "la file existe pour enlever la charge mentale et soutenir le moral", il la présente comme un outil de productivité.

**Suggestion :** dans la description §4.5, ajouter une ligne d'intention émotionnelle : *"La file existe pour supprimer la charge mentale (qui contacter ? ai-je oublié quelqu'un ?) et soutenir le moral sur une recherche longue — pas seulement pour aller vite."* Relier explicitement à JTBD émotionnel §2.1.

---

## GAP 5 — L'honnêteté brute sur "est-ce un vrai business" : le PRD garde le constat, perd le ton de lucidité assumée

**Gravité : MAJEUR**

**Source dit :** le PRFAQ a une voix d'**auto-honnêteté sans complaisance** qui est une signature du document. Exemples de formulations à préserver :
- *"La question qu'on évite — est-ce un vrai business, ou un excellent outil perso + projet portfolio déguisé en SaaS ?"*
- *"Le vrai danger serait de se raconter qu'on build un SaaS alors qu'on build pour soi."*
- *"fenêtre, pas une forteresse"* (formulation récurrente, marquante).
- *"Côté Plume, rien de chiffré pour l'instant : c'est neuf, et on ne va pas inventer des stats."*
- Verdict : *"solide là où ça compte, lucide là où c'est fragile."*

**PRD dit / omet :** le PRD conserve le **contenu** (R1-R6 §12, questions ouvertes §16, "fenêtre pas forteresse" survit en §13 et R6) mais évacue le **ton**. "Le vrai danger serait de se raconter qu'on build un SaaS alors qu'on build pour soi" devient SM-2..SM-5 (jalons de vérité neutres). La phrase "on ne va pas inventer des stats" devient une gouvernance de stats §G addendum (factuelle, sans la voix). La tension est correctement tracée mais le **mordant lucide** — qui est une qualité du document et un garde-fou cognitif pour le fondateur — disparaît. C'est une perte de "feel" : le PRFAQ se parle franchement ; le PRD se parle en specs.

**Suggestion :** acceptable qu'un PRD soit plus sec, mais préserver au moins une ou deux formulations-signature en §1 ou §12 comme garde-fou de posture : ex. citer verbatim *"Le vrai danger serait de se raconter qu'on build un SaaS alors qu'on build pour soi"* en exergue de la section Risques. Sinon le fondateur perd le rappel qui l'empêche de se mentir.

---

## GAP 6 — "Tu es le premier cas de test" : l'intention dogfooding incarnée devient une métrique

**Gravité : MINEUR**

**Source dit :** le PRFAQ adresse directement le fondateur avec une intention quasi personnelle : *"Tu es le premier cas de test."* et *"un développeur qui s'en sert pour sa propre recherche"*, *"deux cafés et un entretien en deux semaines"*. Le dogfooding n'est pas un process, c'est un engagement incarné.

**PRD dit / omet :** le PRD le rend en JTBD "Builder" (§2.1) et en SM-2 ("le fondateur utilise Plume chaque semaine... ne l'abandonne pas après un mois"). Correct, mais "tu es le premier cas de test" — la formulation qui dit *l'urgence et le risque assumé personnellement* — est lissée en métrique d'usage. La nuance "je teste le RISQUE N°1 sur MES vrais messages" (intention de validation personnelle, pas juste usage) est présente dans SM-1 mais détachée de la voix.

**Suggestion :** mineur. Optionnellement, dans la description de SM-1 ou §13, garder la phrase *"Le fondateur est le premier cas de test"* pour conserver l'engagement incarné plutôt que la formulation passive "le fondateur utilise".

---

## GAP 7 — "Plume supprime ce compromis" + "à l'échelle d'une vraie campagne" : la promesse de réconciliation perd son punch

**Gravité : MINEUR**

**Source dit :** le PRFAQ formule la valeur centrale comme la résolution d'un dilemme : *"Plume supprime ce compromis."* (phrase courte, frappée) et *"Vous gardez la qualité d'un mot écrit à la main, à l'échelle d'une vraie campagne."* L'intention : qualité artisanale + volume, sans choisir.

**PRD dit / omet :** le PRD garde la tension ("plus tu veux bien faire, plus c'est lent..." §1) mais la résolution est diluée en "Plume part de ta voix, apprend ta façon d'écrire, et te la rend plus vite." La formule "la qualité d'un mot écrit à la main à l'échelle d'une vraie campagne" — l'image qui rend la promesse tangible — n'apparaît pas. "Plume supprime ce compromis" comme énoncé net non plus.

**Suggestion :** mineur. Réintroduire dans §1 l'image "qualité d'un mot écrit à la main à l'échelle d'une campagne" comme formulation de la proposition de valeur ; elle est plus concrète que "te la rend plus vite".

---

## GAP 8 — "Filon (connotation opportuniste)" : le rationale de rejet du nom est perdu

**Gravité : MINEUR**

**Source dit :** coaching-notes Stage 2 : noms écartés avec une raison qualitative explicite pour l'un d'eux — *"Filon (connotation opportuniste)"*. C'est un jugement de ton/feel (le nom devait éviter de sonner opportuniste/intéressé, cohérent avec le JTBD social "sans paraître intéressé").

**PRD/Addendum dit / omet :** l'addendum §E liste les noms écartés ("Accroche, Amorce, Trame, Cordée, Filon") mais SANS le rationale "connotation opportuniste". La raison du rejet — qui dit quelque chose sur l'identité voulue du produit (humble, pas opportuniste) — est perdue.

**Suggestion :** mineur. Ajouter en §E la note "Filon écarté pour connotation opportuniste", cohérent avec le garde-fou anti-robot et le JTBD "ne pas paraître intéressé".

---

## GAP 9 — Mode sans-IA : la formulation "garde les échanges sensibles 100% chez vous" perd sa dimension confiance

**Gravité : MINEUR**

**Source dit :** PRFAQ Q5 (privacy) : *"le mode sans-IA par contact garde les échanges sensibles 100% chez vous."* + *"On vous montre exactement ce qui part."* L'intention est la **réassurance** (contrôle, intimité préservée), formulée chaleureusement.

**PRD dit / omet :** le PRD a FR-15 (mode sans-IA, "aucun appel API") et FR-32 (transparence API, "une mention claire indique..."). Fonctionnellement complet. Mais le registre de **confiance/réassurance** ("100% chez vous", "on vous montre exactement ce qui part") devient une consequence testable neutre. La transparence est traitée comme conformité, pas comme un geste de respect envers l'utilisateur.

**Suggestion :** mineur. En §7.2 ou §9, conserver l'intention : la transparence et le mode sans-IA sont un *geste de confiance* ("on vous montre exactement ce qui part", "100% chez vous"), pas une case de conformité.

---

## Synthèse

Le PRD est **fonctionnellement fidèle** (toutes les décisions, FRs, risques, scope sont tracés ; rien de factuel perdu) et son addendum couvre bien la profondeur technique. Ce qu'il perd est presque exclusivement **qualitatif** : les deux citations porteuses d'émotion (Camille, Doriann), l'argument moral du paradoxe d'authenticité (pas juste ses mécanismes), le ton d'auto-honnêteté sans complaisance, le registre "vous" de la marque, et plusieurs formulations-signature frappées ("Plume supprime ce compromis", "la qualité d'un mot écrit à la main à l'échelle d'une vraie campagne", "on ne va pas inventer des stats", "le vrai danger serait de se raconter qu'on build un SaaS"). La structure FR/glossaire a fait exactement ce qu'on craignait : elle a conservé le *quoi* et évaporé le *feel*.

**Priorité de correction :** GAP 1 (citations) et GAP 3 (argument moral d'honnêteté) sont les plus coûteux, car ils touchent le pivot de crédibilité et l'âme du produit.
