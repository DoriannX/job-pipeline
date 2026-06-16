// ZONE NEUTRE (domain/) — parsing PUR d'un export CSV LinkedIn (story 2.5). Zéro
// infra, zéro env, zéro I/O. Importable des DEUX côtés (la porte de données pour le
// traitement de l'import, la feature pour la frontière) sans casser les barrières.
//
// Un export LinkedIn « Connections.csv » standard a un en-tête avec, typiquement :
//   First Name, Last Name, URL, Email Address, Company, Position, Connected On
// Parfois précédé de quelques lignes de préface (« Notes: … ») avant le vrai en-tête.
// On parse de façon TOLÉRANTE : on repère la ligne d'en-tête (celle qui contient
// « First Name »/« Last Name »), on mappe les colonnes par nom (insensible à la
// casse / aux espaces), et chaque ligne devient une `CsvContactRow` normalisée.
//
// Règle métier : nom = prénom + nom (FR-2) ; une ligne SANS nom exploitable est
// ignorée AVEC une raison (jamais bloquante, AC-4). La dédup (intra-fichier, vs-DB)
// et la détection des collisions ambiguës se font EN AVAL (couche données), pas ici.

/** Une ligne CSV LinkedIn normalisée, prête pour la dédup/insertion. */
export type CsvContactRow = {
  /** Nom complet (prénom + nom), trimé, jamais vide pour une ligne valide. */
  nom: string;
  /** Entreprise (colonne `Company`), optionnelle. */
  entreprise?: string;
  /** E-mail (colonne `Email Address`), optionnel — souvent vide chez LinkedIn. */
  email?: string;
  /** URL de profil LinkedIn (colonne `URL`), optionnelle. */
  linkedin?: string;
};

/** Une ligne ignorée à l'import, avec sa raison (pour l'ImportReport). */
export type CsvSkippedRow = {
  /** Numéro de ligne dans le fichier (1-indexé, en-tête = ligne d'en-tête exclue). */
  ligne: number;
  /** Raison lisible (FR), ton neutre. */
  raison: string;
};

/** Résultat du parsing : lignes valides + lignes ignorées (avec raisons). */
export type CsvParseResult = {
  rows: CsvContactRow[];
  skipped: CsvSkippedRow[];
};

/**
 * Découpe une ligne CSV en champs, en respectant les guillemets RFC-4180 :
 *   - une virgule entre guillemets ne sépare PAS (« Acme, Inc. ») ;
 *   - un guillemet doublé `""` à l'intérieur d'un champ cité = un guillemet littéral ;
 *   - les `\r` de fin (CRLF) sont retirés en amont (cf. `splitLines`).
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Guillemet doublé => un guillemet littéral ; sinon fin de champ cité.
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Coupe le texte en lignes logiques. Gère les guillemets multi-lignes (un champ
 * cité peut contenir un saut de ligne), le BOM UTF-8 en tête, et CRLF/CR/LF.
 */
function splitLines(text: string): string[] {
  // Retire un BOM UTF-8 éventuel en tête de fichier.
  const clean = text.replace(/^﻿/, "");
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === '"') {
      // On suit l'état « entre guillemets » pour ne pas couper sur un \n cité.
      if (inQuotes && clean[i + 1] === '"') {
        current += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      // Fin de ligne logique. On absorbe le \n d'un \r\n.
      if (ch === "\r" && clean[i + 1] === "\n") i += 1;
      lines.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Normalise un nom d'en-tête pour le mapping : trim + lowercase + espaces compressés. */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Index des colonnes attendues, repéré par nom d'en-tête (tolérant). */
type ColumnIndex = {
  firstName: number;
  lastName: number;
  fullName: number;
  email: number;
  company: number;
  url: number;
};

/**
 * Repère la ligne d'en-tête (celle qui porte les noms de colonnes LinkedIn) et
 * construit l'index des colonnes. LinkedIn préfixe parfois l'export de quelques
 * lignes de notes : on saute donc jusqu'à trouver l'en-tête. Renvoie null si aucun
 * en-tête exploitable n'est trouvé (fichier non LinkedIn / vide).
 */
function locateHeader(
  lines: string[],
): { headerIndex: number; columns: ColumnIndex } | null {
  for (let i = 0; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]).map(normalizeHeader);
    const find = (...names: string[]) =>
      cells.findIndex((c) => names.includes(c));

    const firstName = find("first name");
    const lastName = find("last name");
    const fullName = find("name", "full name");

    // Un en-tête LinkedIn valide expose au moins un porteur de nom.
    if (firstName !== -1 || lastName !== -1 || fullName !== -1) {
      return {
        headerIndex: i,
        columns: {
          firstName,
          lastName,
          fullName,
          email: find("email address", "email", "e-mail address", "e-mail"),
          company: find("company", "organization", "current company"),
          url: find("url", "profile url", "linkedin url"),
        },
      };
    }
  }
  return null;
}

/** Lit une cellule par index (sécurisé), trimée ; "" si index absent/hors borne. */
function cell(fields: string[], index: number): string {
  if (index < 0 || index >= fields.length) return "";
  return (fields[index] ?? "").trim();
}

/**
 * Parse un export CSV LinkedIn en lignes normalisées + lignes ignorées (raisons).
 *
 * - tolérant : BOM, CRLF/CR/LF, préface avant l'en-tête, guillemets (virgules et
 *   sauts de ligne cités), guillemets doublés ;
 * - nom = `First Name` + `Last Name` (ou colonne `Name` à défaut), trimé ;
 * - une ligne entièrement vide est ignorée SILENCIEUSEMENT (pas un défaut) ;
 * - une ligne porteuse de données mais SANS nom exploitable est ignorée AVEC raison ;
 * - aucune exception : un fichier illisible renvoie `rows: []` + une raison globale.
 */
export function parseLinkedinCsv(text: string): CsvParseResult {
  const result: CsvParseResult = { rows: [], skipped: [] };
  const lines = splitLines(text ?? "");
  if (lines.length === 0) {
    result.skipped.push({ ligne: 0, raison: "Fichier vide." });
    return result;
  }

  const header = locateHeader(lines);
  if (!header) {
    result.skipped.push({
      ligne: 0,
      raison: "En-tête LinkedIn introuvable (colonnes nom manquantes).",
    });
    return result;
  }

  const { headerIndex, columns } = header;

  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    // Ligne logiquement vide : on ignore sans la compter comme un défaut.
    if (raw.trim() === "") continue;

    const fields = splitCsvLine(raw);
    // Numéro affiché 1-indexé, relatif au début du fichier physique.
    const ligne = i + 1;

    const first = cell(fields, columns.firstName);
    const last = cell(fields, columns.lastName);
    const full = cell(fields, columns.fullName);
    const nom = (full || `${first} ${last}`).trim().replace(/\s+/g, " ");

    if (!nom) {
      result.skipped.push({ ligne, raison: "Ligne sans nom — ignorée." });
      continue;
    }

    const entreprise = cell(fields, columns.company) || undefined;
    const email = cell(fields, columns.email) || undefined;
    const linkedin = cell(fields, columns.url) || undefined;

    result.rows.push({ nom, entreprise, email, linkedin });
  }

  return result;
}
