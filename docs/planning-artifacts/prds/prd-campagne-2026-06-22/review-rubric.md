# PRD Quality Review — Campagne (Plume, Epic 8)

## Overall verdict

This is a strong, thesis-driven feature PRD: the "objectif = levier à triple emploi" (§1) is a genuine, earned insight that organizes scope, cost, and privacy into one decision, and the FRs trace cleanly to upstream decisions (D-codes) and downstream archi anchors (AR-codes). It holds up on strategic coherence, scope honesty, and shape fit for a single-founder dogfood capability spec. The one soft spot that downstream story creation will feel is Done-ness clarity: several FRs assert behaviour ("nourrit le scoring", "présentée conversationnellement", "détaille le signal") without a testable consequence, and the verifiable thresholds (N days, quota, dogfood volume) are all deferred to Open Questions — acceptable given medium/internal stakes, but the FRs themselves should carry more verifiable edges before stories are cut.

## Decision-readiness — strong

A decision-maker can act on this. Trade-offs are named with what was given up, not smoothed to neutral: §5 states the central tension outright ("Campagne introduit un appel tiers (PDL) dans un produit dont la doctrine est *zéro partage tiers*") and resolves it in six concrete moves rather than hand-waving. Deferred decisions are explicit and reasoned — multi-campagnes "différé (D15) : une active à la fois, simplicité dogfood", écran app dédié "différé v2 (P5)". The `[à confirmer — P11]` on FR-51 revocation marks a real open tension at the right spot. Open Questions (§10) are genuinely open (N=7/14, PDL cost model, SaaS trigger), not rhetorical.

### Findings
- **low** SaaS-opening decision split across D7, §5.6, §9, NFR-8 ("reportée") (§ multiple) — the deferral is honest but restated in four places; a reader has to assemble the full condition. *Fix:* none required at this stakes; if touched, consolidate the SaaS gate into one cross-referenced statement.

## Substance over theater — strong

Content is earned. No persona theater: §2 carries the founder inline ("Persona porté inline ; pas de section persona séparée") and the SaaS persona is correctly quarantined in the addendum as an untested hypothesis ("Garder large est assumé"). The "Ce qui le rend différent" section (§1) is not template furniture — each claim does work: the moat is named as integration not data ("Le moat n'est pas la donnée [...] mais l'intégration"), and the privacy posture is backed by a concrete market fact (Proxycurl death, D6) rather than a slogan. NFRs (§4) avoid boilerplate: NFR-9 ("une régression de signal ne doit jamais être masquée par la couche conversationnelle") is product-specific and falsifiable in spirit.

## Strategic coherence — strong

The PRD has a clear thesis and bets on it. The arc is unified: objectif → sourcing → message, stated in §1 and recurring as the structuring logic of every feature group (§3.1–3.5). Prioritisation follows the thesis, not ease — the north star (§7) measures "réponse × timing", validating the *precision* thesis ("il agit mal, D9"), and explicitly retires the old SM-1 edit-distance metric as "caduque en conversationnel". Counter-metrics are named (§7: volume d'enrichment, sur-sollicitation) and secondary metrics are flagged as "support, jamais arbitre" — a strong tell against activity-metric drift. MVP scope kind is coherently problem-solving with matching scope logic.

## Done-ness clarity — thin

This is the weakest dimension and the one stories will lean on. Several FRs state behaviour without a testable consequence:

- **FR-42** "reçoit un score de pertinence relatif à l'objectif" — no statement of what the score ranges over, what a passing/failing score means, or how it's verified. Deterministic-vs-LLM boundary is in NFR-9/addendum but FR-42 itself has no acceptance edge.
- **FR-45** "présentée conversationnellement par le copilote" and **FR-47** "le copilote détaille le signal" — both rely on adjectival/behavioural description. "Détaille le signal" has no bound on what counts as detailed enough.
- **FR-48** "réinjecte un signal négatif au scoring futur" — testable consequence is implied (next list excludes / down-weights the écarté contact) but never stated as a verifiable outcome.
- The genuinely measurable conditions — N days for "bien timé" (FR-54), PDL quota (NFR-7), dogfood validation volume (§7) — are *all* deferred to Open Questions. That is defensible for a dogfood PRD, but it means FR-54's "bien timé" and NFR-7's "ne mange pas la marge" currently have no number an engineer can assert against.

FR-41 is the positive counter-example: explicit state machine (`active | en_pause | close`), explicit transition semantics ("Lancer une nouvelle campagne met l'actuelle en pause", "reprenable sans perte"), idempotency in NFR-10 — this is what every FR should look like.

### Findings
- **high** FRs assert behaviour without a testable consequence (§3, FR-42, FR-45, FR-47, FR-48) — phrases like "présentée conversationnellement", "détaille le signal", "nourrit le scoring" carry no verifiable condition. *Fix:* add one acceptance edge per FR, e.g. FR-48: "un contact écarté n'apparaît pas dans la liste du jour suivant pour la campagne active"; FR-47: "le pourquoi cite au moins le signal dominant (froideur / job-change / pertinence)".
- **medium** All quantitative thresholds deferred to Open Questions (FR-54, NFR-7, §7) — "bien timé (N jours)", "quota PDL", "20-30 messages" are placeholders. *Fix:* acceptable to defer N and volume, but pin a *provisional* quota and N (e.g. N=14, quota=100/mo = free tier) so stories have a concrete default to build and test against, marked `[ASSUMPTION]`.
- **low** §7 "bat nettement" is the GO condition for the whole epic but "nettement" is unquantified — no effect-size threshold. *Fix:* state a provisional bar (e.g. "≥1.5× baseline response rate") even if revised on first data.

## Scope honesty — strong

Omissions are explicit and load-bearing. §8.3 is a real Non-Goals section doing real work: net-new external sourcing (D13), LinkedIn scraping (D6), news-par-boîte → v2 (D14), full-network enrichment, multi-campaigns, dedicated app screen (P5), trained model (P6) — each with a decision code. The "écarter nourrit le scoring" mechanism is honestly bounded in FR-48 ("pas un modèle entraîné (mécanisme → addendum)") rather than over-promised. The hard frontier (FR-55, réseau-only) is stated as its own FR, not buried. Open-items density (7 Open Questions + scattered `[à confirmer]`) is appropriate for a medium-stakes dogfood PRD and would only be a blocker on a green-light-to-build chain-top.

### Findings
- **low** Inline assumptions not tagged/indexed — the PRD uses decision codes (D/P/AR) well but has no `[ASSUMPTION: …]` index; inferences like "esprit R1, 20-30 messages" and provisional values float without a roundtrip index. *Fix:* low priority given stakes; if formalised toward build, add an Assumptions Index.

## Downstream usability — adequate

This PRD feeds UX/architecture/stories, so traceability matters. It is mostly clean: FR IDs are contiguous (FR-40→55) and the gap from FR-39 is documented in the header ("Numérotation FR : démarre à FR-40"). §11 gives an explicit reuse/net-new archi rattachement (porte `db.forUser` AR-2, provenance AR-16, horloge AR-6, table `campagnes`) — architecture can source-extract directly. UJs each have the named protagonist (the founder) carrying context inline. The gap: **no Glossary**. Domain nouns that downstream will key on — "froideur" / "Score de froideur", "dormant", "bien timé", "campagne active", "signal", "liste du jour" — are defined in prose at first use but never centralised, and some drift (see Mechanical notes). For a chain-top-ish PRD feeding three workflows, a short glossary would de-risk extraction.

### Findings
- **medium** No Glossary for a PRD feeding UX + archi + stories (§ whole) — terms like "dormant", "bien timé", "campagne active", "signal de timing" are defined inline and reused across FRs/UJs/SMs without a single source of truth. *Fix:* add a short Glossary (6-8 terms) pinning each domain noun used across sections.
- **low** Cross-refs lean on prose mentions of upstream artifacts (Epic 2/4, FR-32, UX-DR21, AR-16) that resolve only if the reader has the other PRDs. *Fix:* fine for an internal chained PRD; ensure the referenced IDs exist where stories will look.

## Shape fit — strong

The shape matches the product. This is a single-operator (founder dogfood) internal-tool capability spec, and it is built as one: §3 is FR-led capability groups, the persona is inline not formalised, and SMs (§7) are partly operational (volume d'enrichment, adhésion) rather than purely user-facing — all correct for the shape. The three UJs (§2) are not overhead here despite the single operator: they earn their place by carrying the *conversational* interaction model (questions de cadrage, "pourquoi lui ?", consent juste-à-temps) that the FRs alone wouldn't make concrete — exactly the part of this product where flow matters. The PRD is neither over-formalised (no UJ-per-feature padding) nor under-formalised. No findings.

## Mechanical notes

- **Glossary drift:** "froideur" appears as bare "froideur" (FR-44, FR-45) and as "Score de froideur" (FR-44) — same concept, two forms. "bien timé" / "bien-timé" (§7 vs addendum sizing) inconsistent hyphenation. "campagne active" vs state value `active` — usually clear from context but a glossary would pin it.
- **ID continuity:** FR-40→55 contiguous and unique; NFR-7→10 contiguous; gap from FR-39 / NFR-6 documented in header. Decision codes D1→D16, P0→P11 referenced but not all reproduced in-PRD (live in brief/.decision-log) — fine if those files travel with the PRD.
- **Cross-refs:** AR-2, AR-3, AR-6, AR-8, AR-16, FR-32, FR-36→39, UX-DR21 referenced; none resolvable inside this document — they assume the reader has the app PRD and Epic 7. Acceptable for a chained internal PRD.
- **Assumptions Index:** absent. Inline inferences ("esprit R1, 20-30", provisional N) are not tagged `[ASSUMPTION]` nor indexed — no roundtrip to verify. Low impact at this stakes.
- **Required sections:** Context/problem, UJs, FRs, NFRs, Privacy, Cost, Success Metrics, Scope, Vision, Open Questions, archi coverage all present. Glossary is the one standard section missing.
