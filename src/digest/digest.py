"""Génération du digest quotidien des nouvelles offres (Markdown + CSV).

Le digest liste les offres détectées pour la première fois à une date donnée
(par défaut : aujourd'hui), dans deux formats : un Markdown lisible et un CSV
exploitable (tableur).
"""
import csv
import logging
from datetime import date
from pathlib import Path

import config
from src.storage import db

logger = logging.getLogger(__name__)

# Colonnes exportées dans le CSV.
_CSV_FIELDS = [
    "categorie",
    "pays",
    "intitule",
    "entreprise",
    "lieu",
    "code_postal",
    "type_contrat",
    "nature_contrat",
    "date_creation",
    "source",
    "url",
    "id",
]


def generate_digest(conn, day: str | None = None, output_dir: Path | None = None):
    """Écrit le digest Markdown + CSV des nouveautés de `day`.

    Renvoie un tuple (chemin_md, chemin_csv, nombre_offres).
    """
    day = day or date.today().isoformat()
    output_dir = output_dir or config.OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    rows = db.get_offres_since(conn, day)
    md_path = output_dir / f"digest-{day}.md"
    csv_path = output_dir / f"digest-{day}.csv"

    _write_markdown(md_path, rows, day)
    _write_csv(csv_path, rows)

    logger.info("Digest généré : %d offres → %s | %s", len(rows), md_path, csv_path)
    return md_path, csv_path, len(rows)


def _categorie_label(valeur) -> str:
    """Libellé de section lisible pour une catégorie (None → 'Autres')."""
    return (valeur or "autre").capitalize()


def _write_markdown(path: Path, rows, day: str) -> None:
    """Écrit un digest Markdown lisible, regroupé par catégorie."""
    lines = [f"# Digest emploi — {day}", ""]
    if not rows:
        lines.append("_Aucune nouvelle offre aujourd'hui._")
        path.write_text("\n".join(lines), encoding="utf-8")
        return

    lines.append(f"**{len(rows)} nouvelle(s) offre(s).**")
    lines.append("")

    # Regroupe par catégorie (alternance, cdi, autre…), ordre alphabétique stable.
    par_categorie: dict[str, list] = {}
    for row in rows:
        par_categorie.setdefault(row["categorie"] or "autre", []).append(row)

    for categorie in sorted(par_categorie):
        offres = par_categorie[categorie]
        lines.append(f"## {_categorie_label(categorie)} ({len(offres)})")
        lines.append("")
        for row in offres:
            titre = row["intitule"] or "(sans intitulé)"
            entreprise = row["entreprise"] or "Entreprise non précisée"
            lieu = row["lieu"] or "Lieu non précisé"
            contrat = row["type_contrat"] or row["nature_contrat"] or "?"
            lines.append(f"### {titre}")
            lines.append(f"- **Entreprise** : {entreprise}")
            lines.append(f"- **Lieu** : {lieu}")
            if row["pays"]:
                lines.append(f"- **Pays** : {row['pays']}")
            lines.append(f"- **Contrat** : {contrat}")
            if row["source"]:
                lines.append(f"- **Source** : {row['source']}")
            if row["date_creation"]:
                lines.append(f"- **Publiée le** : {row['date_creation']}")
            if row["url"]:
                lines.append(f"- **Lien** : {row['url']}")
            lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


def _write_csv(path: Path, rows) -> None:
    """Écrit un digest CSV (UTF-8, séparateur virgule)."""
    with path.open("w", newline="", encoding="utf-8") as fichier:
        writer = csv.DictWriter(fichier, fieldnames=_CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({champ: row[champ] for champ in _CSV_FIELDS})
