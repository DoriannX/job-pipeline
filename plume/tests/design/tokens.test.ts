import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colors, offsets } from "@/design/tokens";

// Garde-fous du design-system « foyer unique » (UX-DR1, UX-DR19) :
//  1. parité tokens.ts ↔ @theme (globals.css) — aucune couleur ne dérive en silence ;
//  2. RÈGLE DURE flou = 0 — tout box-shadow/offset a un rayon de flou nul.

const globalsCss = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").toLowerCase();

function collectHexes(value: unknown, acc: Set<string>): Set<string> {
  if (typeof value === "string") {
    for (const m of value.matchAll(/#[0-9a-fA-F]{6}/g)) acc.add(m[0].toLowerCase());
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectHexes(v, acc);
  }
  return acc;
}

describe("design tokens — foyer unique", () => {
  it("chaque hex de la palette tokens.ts est présent dans @theme (globals.css)", () => {
    const hexes = collectHexes(colors, new Set<string>());
    expect(hexes.size).toBeGreaterThan(10);
    const missing = [...hexes].filter((hex) => !globalsCss.includes(hex));
    expect(missing, `hexes absents de globals.css: ${missing.join(", ")}`).toEqual([]);
  });

  it("aucune couleur codée en dur hors du foyer (src hors design/ + globals.css)", () => {
    const offenders: string[] = [];
    const skip = new Set(["#ffffff", "#000000"]);
    for (const file of walk(join(process.cwd(), "src"))) {
      if (file.includes(`${join("src", "design")}`)) continue; // le foyer a le droit
      if (file.endsWith("globals.css")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/#[0-9a-fA-F]{6}/g)) {
        if (!skip.has(m[0].toLowerCase())) offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders, `couleurs hex hors tokens: ${offenders.join(" | ")}`).toEqual([]);
  });
});

describe("élévation — flou = 0 (règle dure)", () => {
  it("tout offset de tokens.ts a un rayon de flou nul (3e valeur = 0)", () => {
    for (const [name, shadow] of Object.entries(offsets)) {
      const blur = shadow.replace(/#[0-9a-fA-F]{6}/g, "").trim().split(/\s+/)[2];
      expect(blur, `offset ${name} doit avoir un flou nul`).toBe("0");
    }
  });

  it("toute custom property --shadow-* de globals.css a un flou nul", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const decls = [...css.matchAll(/--shadow-[a-z0-9-]+\s*:\s*([^;]+);/gi)];
    expect(decls.length).toBeGreaterThan(0);
    for (const [, value] of decls) {
      const blur = value.replace(/#[0-9a-fA-F]{3,8}/g, "").trim().split(/\s+/)[2];
      expect(blur, `--shadow doit avoir un flou nul: ${value.trim()}`).toBe("0");
    }
  });

  it("aucune déclaration box-shadow/boxShadow avec un flou non nul dans src/", () => {
    const violations: string[] = [];
    for (const file of walk(join(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      // Seulement les vraies déclarations `box-shadow:` / `boxShadow:` (pas les commentaires).
      for (const m of text.matchAll(/box-?shadow\s*:\s*["'`]?([^"'`;}\n]+)/gi)) {
        const decl = m[1].replace(/#[0-9a-fA-F]{3,8}/g, "").replace(/var\([^)]*\)/g, "");
        const parts = decl.trim().split(/\s+/).filter(Boolean);
        const blur = (parts[2] ?? "").replace(/[^0-9a-z%]/gi, "");
        if (parts.length >= 3 && !/^0(px)?$/.test(blur)) violations.push(`${file}: ${m[1].trim()}`);
      }
    }
    expect(violations, `box-shadow avec flou non nul: ${violations.join(" | ")}`).toEqual([]);
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}
