// Parsing PUR d'un export CSV LinkedIn (story 2.5) — `parseLinkedinCsv`.
//
// On prouve la tolérance attendue d'un vrai export :
//   - colonnes standard mappées par nom (First/Last Name, Email Address, Company, URL) ;
//   - nom = prénom + nom ; entreprise/email/URL optionnels ;
//   - ligne malformée (sans nom) IGNORÉE avec une raison (jamais bloquante) ;
//   - BOM UTF-8, CRLF, guillemets (virgules ET sauts de ligne cités), guillemets doublés ;
//   - préface LinkedIn (« Notes: … ») avant l'en-tête, sautée proprement.

import { describe, expect, it } from "vitest";

import { parseLinkedinCsv } from "@/lib/domain/csv";

const HEADER = "First Name,Last Name,URL,Email Address,Company,Position";

describe("parseLinkedinCsv — colonnes standard", () => {
  it("mappe les colonnes et compose le nom prénom + nom", () => {
    const csv = [
      HEADER,
      "Léa,Martin,https://linkedin.com/in/lea,lea@acme.fr,Acme,CTO",
      "Hervé,Dupont,https://linkedin.com/in/herve,,Studio Bleu,Designer",
    ].join("\n");

    const { rows, skipped } = parseLinkedinCsv(csv);
    expect(skipped).toEqual([]);
    expect(rows).toEqual([
      {
        nom: "Léa Martin",
        entreprise: "Acme",
        email: "lea@acme.fr",
        linkedin: "https://linkedin.com/in/lea",
      },
      {
        nom: "Hervé Dupont",
        entreprise: "Studio Bleu",
        email: undefined,
        linkedin: "https://linkedin.com/in/herve",
      },
    ]);
  });

  it("tolère un export sans colonne email (cas LinkedIn fréquent)", () => {
    const csv = [
      "First Name,Last Name,Company,Position",
      "Nour,Benali,Studio Bleu,PM",
    ].join("\n");

    const { rows } = parseLinkedinCsv(csv);
    expect(rows).toEqual([
      {
        nom: "Nour Benali",
        entreprise: "Studio Bleu",
        email: undefined,
        linkedin: undefined,
      },
    ]);
  });
});

describe("parseLinkedinCsv — lignes malformées", () => {
  it("ignore une ligne SANS nom avec une raison, sans bloquer le reste", () => {
    const csv = [
      HEADER,
      ",,,,Acme,", // ni prénom ni nom => ignorée
      "Léa,Martin,,lea@acme.fr,Acme,CTO",
    ].join("\n");

    const { rows, skipped } = parseLinkedinCsv(csv);
    expect(rows.map((r) => r.nom)).toEqual(["Léa Martin"]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].raison).toMatch(/sans nom/i);
    // Numéro de ligne 1-indexé : en-tête = ligne 1, la malformée = ligne 2.
    expect(skipped[0].ligne).toBe(2);
  });

  it("ignore SILENCIEUSEMENT les lignes vides (pas un défaut)", () => {
    const csv = [HEADER, "", "Léa,Martin,,,Acme,", "   "].join("\n");
    const { rows, skipped } = parseLinkedinCsv(csv);
    expect(rows).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("renvoie une raison globale si l'en-tête LinkedIn est introuvable", () => {
    const { rows, skipped } = parseLinkedinCsv("foo,bar\n1,2");
    expect(rows).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].raison).toMatch(/en-tête/i);
  });

  it("fichier vide => raison « Fichier vide »", () => {
    const { rows, skipped } = parseLinkedinCsv("");
    expect(rows).toEqual([]);
    expect(skipped[0].raison).toMatch(/vide/i);
  });
});

describe("parseLinkedinCsv — robustesse encodage / guillemets", () => {
  it("retire le BOM UTF-8 en tête de fichier", () => {
    const csv = "﻿" + HEADER + "\nLéa,Martin,,lea@acme.fr,Acme,CTO";
    const { rows } = parseLinkedinCsv(csv);
    expect(rows[0].nom).toBe("Léa Martin");
    expect(rows[0].email).toBe("lea@acme.fr");
  });

  it("gère le CRLF (\\r\\n) sans \\r résiduel dans les valeurs", () => {
    const csv = [HEADER, "Léa,Martin,,lea@acme.fr,Acme,CTO"].join("\r\n");
    const { rows } = parseLinkedinCsv(csv);
    expect(rows[0].nom).toBe("Léa Martin");
    expect(rows[0].entreprise).toBe("Acme");
  });

  it("ne coupe PAS sur une virgule entre guillemets (entreprise « Acme, Inc. »)", () => {
    const csv = [HEADER, 'Léa,Martin,,lea@acme.fr,"Acme, Inc.",CTO'].join("\n");
    const { rows } = parseLinkedinCsv(csv);
    expect(rows[0].entreprise).toBe("Acme, Inc.");
  });

  it("interprète un guillemet doublé comme guillemet littéral", () => {
    const csv = [HEADER, 'Léa,Martin,,lea@acme.fr,"Acme ""Pro""",CTO'].join(
      "\n",
    );
    const { rows } = parseLinkedinCsv(csv);
    expect(rows[0].entreprise).toBe('Acme "Pro"');
  });

  it("gère un saut de ligne À L'INTÉRIEUR d'un champ cité (multi-lignes)", () => {
    const csv = [HEADER, 'Léa,Martin,,lea@acme.fr,"Acme\nGroupe",CTO'].join(
      "\n",
    );
    const { rows } = parseLinkedinCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].entreprise).toBe("Acme\nGroupe");
  });

  it("saute une préface (notes LinkedIn) avant le vrai en-tête", () => {
    const csv = [
      "Notes:",
      'When exporting your connection data, you may notice...',
      "",
      HEADER,
      "Léa,Martin,,lea@acme.fr,Acme,CTO",
    ].join("\n");
    const { rows } = parseLinkedinCsv(csv);
    expect(rows.map((r) => r.nom)).toEqual(["Léa Martin"]);
  });
});
