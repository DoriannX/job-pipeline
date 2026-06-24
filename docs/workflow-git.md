# Workflow Git & segmentation prod / dev

Modèle de branches du repo `DoriannX/job-pipeline` et découpage prod / dev sur
chaque plateforme (GitHub, Vercel, Turso).

## Modèle de branches

```
feature/*  ──PR──▶  dev  ──PR (release)──▶  main
 claude/*           (défaut, intégration)    (releases only)
 fix/*
```

- **`dev`** — branche par défaut. Toute l'intégration se fait ici. Reçoit les MAJ
  en continu via PR depuis les branches `feature/*`, `fix/*`, `claude/*`.
- **`main`** — **releases uniquement**. Part de `dev`, mise à jour beaucoup moins
  souvent, exclusivement via une PR de release `dev → main`.
- **Aucune branche ne part de `main`.** On branche toujours depuis `dev`.

### Règles (protection de branche active)

| | `dev` | `main` |
|---|---|---|
| Push direct | ❌ PR obligatoire | ❌ PR obligatoire |
| Status checks requis | `build` + `python-tests` | `build` + `python-tests` |
| Branche à jour avant merge (strict) | ✅ | ✅ |
| Historique linéaire | non | ✅ (squash / rebase) |
| Bypass admin | ✅ autorisé (vélocité solo) | ❌ interdit |
| Force-push / suppression | ❌ | ❌ |

> ⚠️ GitHub ne peut pas restreindre la **branche source** d'une PR. La règle
> « `main` ne reçoit que depuis `dev` » est une convention : crée toujours la PR
> de release avec `dev` comme base source.

### Faire une release (`dev → main`)

```bash
gh pr create --base main --head dev --title "release: vX.Y.Z" --fill
# CI verte -> merge
gh pr merge --merge   # ou --squash selon la convention
git tag vX.Y.Z && git push origin vX.Y.Z   # optionnel
```

## CI (status checks requis)

- **`ci.yml`** → job `build` : lint + typecheck + test + migrations + build du
  webapp `plume/` (Next.js). Filtré aux chemins `plume/**` sur *push*, mais
  **sans filtre sur les PR** pour qu'il tourne sur chaque PR (un check requis
  filtré qui ne tourne jamais bloque la PR à jamais).
- **`ci-python.yml`** → job `python-tests` : pytest du pipeline e-mail (racine).

## Segmentation prod / dev par plateforme

Convention transverse : **`main` = production**, **`dev` = preview/staging**.

### GitHub — Environments (déjà créés)

| Environment | Branche autorisée | Usage |
|---|---|---|
| `production` | `main` | secrets de prod |
| `development` | `dev` | secrets de dev |

Mettre les secrets **par environment** (Settings → Environments → secrets), pas
en secrets repo globaux. Un workflow choisit son env via `environment: production`.

### Vercel (à faire dans le dashboard — webapp `plume/`)

1. **Settings → General → Root Directory** = `plume`.
2. **Settings → Git → Production Branch** = `main`.
   → push sur `main` = déploiement **Production** ; `dev` et branches = **Preview**.
3. **Settings → Environment Variables**, scoper chaque variable :
   - **Production** (= `main`) : URL/token Turso **prod**, clés API prod.
   - **Preview** (= `dev` + branches) : URL/token Turso **dev**, clés API dev.
   - **Development** (= `vercel dev` local) : valeurs locales.

### Turso (à faire en CLI — deux bases séparées)

```bash
turso db create plume-prod
turso db create plume-dev

# Prod -> Vercel (scope Production) + GitHub env `production`
turso db show plume-prod --url
turso db tokens create plume-prod

# Dev -> Vercel (scope Preview) + GitHub env `development`
turso db show plume-dev --url
turso db tokens create plume-dev
```

Reporter `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` dans le bon scope Vercel et le
bon environment GitHub. Ne jamais pointer la base prod depuis une preview.

### Pipeline Python (`daily.yml`)

Les `schedule` ne tournent que sur la branche par défaut (`dev`). À revoir lors de
la mise en place du cron de prod (env `production` + DB Turso prod).
