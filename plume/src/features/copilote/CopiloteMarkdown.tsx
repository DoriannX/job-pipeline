"use client";

// Rendu MARKDOWN des réponses du copilote (l'agent structure énormément ses réponses en
// markdown : titres, listes, gras, code). On le rend PLEINEMENT au design-system Plume —
// pas d'esthétique « markdown générique » : corps en Quicksand (`font-body`), titres en
// Fraunces (`font-display`), contours pleins + teintes douces, liens soulignés en menthe
// (le mauve reste réservé à l'action, jamais décoratif).
//
// CLIENT-SAFE : `react-markdown` rend côté navigateur ; `remark-gfm` ajoute tables, listes
// à cocher et liens auto. Aucun HTML brut n'est autorisé (react-markdown n'évalue pas le
// HTML par défaut) → pas d'injection via le texte du modèle.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// `react-markdown` passe un prop `node` (AST) à chaque composant : on le RETIRE avant de
// l'étaler sur un élément DOM (sinon React avertit « unknown prop `node` »).
const strip = <T extends { node?: unknown }>(props: T): Omit<T, "node"> => {
  const { node: _node, ...rest } = props;
  void _node;
  return rest;
};

// Mapping élément → classes Tailwind du design-system. `last:mb-0` évite la marge en trop
// au dernier bloc (la bulle gère son propre padding).
const COMPONENTS: Components = {
  p: (props) => <p className="mb-2 last:mb-0 leading-relaxed" {...strip(props)} />,
  h1: (props) => (
    <h3
      className="mb-1 mt-3 first:mt-0 font-display text-body font-semibold text-ink"
      {...strip(props)}
    />
  ),
  h2: (props) => (
    <h3
      className="mb-1 mt-3 first:mt-0 font-display text-body font-semibold text-ink"
      {...strip(props)}
    />
  ),
  h3: (props) => (
    <h4
      className="mb-1 mt-2 first:mt-0 font-display text-body font-semibold text-ink"
      {...strip(props)}
    />
  ),
  ul: (props) => (
    <ul className="mb-2 last:mb-0 list-disc space-y-1 pl-5 marker:text-mint-deep" {...strip(props)} />
  ),
  ol: (props) => (
    <ol className="mb-2 last:mb-0 list-decimal space-y-1 pl-5 marker:text-ink-soft" {...strip(props)} />
  ),
  li: (props) => <li className="leading-relaxed" {...strip(props)} />,
  strong: (props) => <strong className="font-bold text-ink" {...strip(props)} />,
  em: (props) => <em className="italic" {...strip(props)} />,
  // NB : le rendu des liens `a` est défini DANS le composant (il a besoin du router pour la
  // navigation SOFT des liens internes) — voir `CopiloteMarkdown` plus bas.
  // Code INLINE : pastille douce. Le code en BLOC hérite d'un fond transparent (le `pre`
  // porte déjà le sien) via le sélecteur sur le parent.
  code: (props) => (
    <code
      className="rounded-[6px] bg-surface-chip px-1.5 py-0.5 font-mono text-[0.85em] text-ink"
      {...strip(props)}
    />
  ),
  pre: (props) => (
    <pre
      className="mb-2 last:mb-0 overflow-x-auto rounded-button border-[length:--border-width-ink] border-line bg-surface-note p-3 font-mono text-[0.85em] text-ink [&>code]:bg-transparent [&>code]:p-0"
      {...strip(props)}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="mb-2 last:mb-0 border-l-[length:--border-width-ink] border-line pl-3 text-ink-soft"
      {...strip(props)}
    />
  ),
  hr: () => <hr className="my-3 border-0 border-t-[length:--border-width-ink] border-line" />,
  table: (props) => (
    <div className="mb-2 last:mb-0 overflow-x-auto">
      <table className="w-full border-collapse text-[0.9em]" {...strip(props)} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-[length:--border-width-ink] border-line px-2 py-1 text-left font-bold text-ink"
      {...strip(props)}
    />
  ),
  td: (props) => (
    <td className="border-[length:--border-width-ink] border-line px-2 py-1 text-ink" {...strip(props)} />
  ),
};

const LINK_CLASS =
  "font-semibold text-ink underline decoration-mint-deep decoration-2 underline-offset-2";

/** Rend un contenu markdown du copilote dans la voix visuelle de Plume. */
export function CopiloteMarkdown({ content }: { content: string }) {
  const router = useRouter();

  // Le rendu des liens dépend du router : un lien INTERNE (`/reseau/<id>`…) navigue en SOFT
  // (router.push) — pas de rechargement, donc le popup du copilote (monté dans le layout (app))
  // RESTE OUVERT et la conversation en-session n'est PAS perdue. Un lien EXTERNE garde
  // l'ouverture en nouvel onglet. On mémoïse pour ne pas recréer la table à chaque frappe.
  const components = useMemo<Components>(() => {
    return {
      ...COMPONENTS,
      a: ({ node, href, ...rest }) => {
        void node;
        const target = typeof href === "string" ? href : "";
        // Interne = chemin app (commence par "/" mais pas "//"). Tout le reste = externe.
        const isInternal = target.startsWith("/") && !target.startsWith("//");
        if (isInternal) {
          return (
            <a
              href={target}
              onClick={(e) => {
                // Clic gauche simple sans modificateur → navigation SOFT (popup préservé).
                // Ctrl/Cmd/clic milieu → on laisse le navigateur ouvrir un onglet.
                if (
                  e.defaultPrevented ||
                  e.button !== 0 ||
                  e.metaKey ||
                  e.ctrlKey ||
                  e.shiftKey ||
                  e.altKey
                ) {
                  return;
                }
                e.preventDefault();
                router.push(target);
              }}
              className={`${LINK_CLASS} cursor-pointer`}
              {...rest}
            />
          );
        }
        return (
          <a
            className={LINK_CLASS}
            href={target || undefined}
            target="_blank"
            rel="noreferrer noopener"
            {...rest}
          />
        );
      },
    };
  }, [router]);

  return (
    <div className="font-body text-body text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default CopiloteMarkdown;
