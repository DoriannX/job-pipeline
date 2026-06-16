// Fiche Contact = timeline (story 2.4).
//
// Présentation PURE (rendable côté serveur) d'un Contact : identité (Fraunces),
// froideur (avatar-blob recoloré + ColdTag texte a11y), canaux renseignés, notes
// douces, et la COQUILLE de timeline narrative (« Votre histoire ») — JAMAIS une
// grille de données. Le bouton Écrire (ouverture du Composeur en flow, story 3.1) et
// l'édition/suppression sont délégués au wrapper client ContactDetailActions.
//
// Aucune couleur hex hors design/ : primitives + tokens uniquement. UI/commentaires FR.
// Pas d'accès DB ici : la fiche reçoit une vue plate DÉRIVÉE serveur (page.tsx).

import Link from "next/link";

import { ColdTag } from "@/components/ui/ColdTag";
import { Icon } from "@/design/icons";
import { Plume } from "@/design/illustration/Plume";

import { ContactDetailActions } from "./ContactDetailActions";
import { channelChips, type ContactDetailView } from "./contact-detail";

interface ContactDetailProps {
  contact: ContactDetailView;
}

export function ContactDetail({ contact }: ContactDetailProps) {
  const canaux = channelChips(contact.handles, contact.canalPrefere);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-margin-mobile py-8">
      {/* — Retour galerie — geste discret en encre douce (flèche maison + libellé). */}
      <Link
        href="/reseau"
        className="inline-flex w-fit items-center gap-2 rounded-button px-2 py-1 font-body text-body font-bold text-ink-soft outline-accent outline-offset-2 focus-visible:outline-2"
      >
        <Icon name="arrow-left" size={20} />
        Ton réseau
      </Link>

      {/* — En-tête identité : blob recoloré par froideur + nom (Fraunces) + entreprise + ColdTag. */}
      <header className="flex flex-col items-center gap-3 text-center">
        <Plume name="blob" tint={contact.coldness} size={120} />
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-display text-display-name font-semibold tracking-[-0.01em] text-ink">
            {contact.nom}
          </h1>
          {contact.entreprise ? (
            <p className="font-body text-body text-ink-soft">
              {contact.entreprise}
            </p>
          ) : null}
        </div>
        <ColdTag state={contact.coldness} />
      </header>

      {/* — Canaux renseignés — une puce par coordonnée (icône maison + valeur) ; le canal
          PRÉFÉRÉ est mis en avant (langage mauve). Aucune puce si rien n'est renseigné. */}
      {canaux.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
            Comment le joindre
          </h2>
          <ul className="flex flex-col gap-2">
            {canaux.map((canal) => (
              <li
                key={canal.key}
                className={`flex items-center gap-3 rounded-md border-[length:--border-width-ink] px-4 py-3 font-body text-body ${
                  canal.preferred
                    ? "border-accent bg-accent-tint text-accent-deep"
                    : "border-line bg-surface-card text-ink"
                }`}
              >
                <Icon name={canal.icon} size={20} />
                <span className="flex flex-col">
                  <span className="text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
                    {canal.label}
                    {canal.preferred ? " · préféré" : ""}
                  </span>
                  <span className="break-all">{canal.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* — Notes — encart doux, affiché seulement si présent. */}
      {contact.notes ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-body text-label font-bold uppercase tracking-[0.12em] text-ink-soft">
            Notes
          </h2>
          <p className="whitespace-pre-line rounded-md border-[length:--border-width-ink] border-line bg-surface-note px-4 py-3 font-body text-body text-ink">
            {contact.notes}
          </p>
        </section>
      ) : null}

      {/* — Édition + suppression (capacités 2.1, accessibles aussi ici) — wrapper client. */}
      <ContactDetailActions contact={contact} />

      {/* — TIMELINE narrative — COQUILLE prête, peuplée dès Epic 3. JAMAIS une grille/table :
          un titre Fraunces + un état vide serein. Pas d'UI morte (aucune colonne fantôme). */}
      <section className="flex flex-col gap-3 border-t-[length:--border-width-ink] border-line pt-6">
        <h2 className="font-display text-display-title font-semibold tracking-[-0.01em] text-ink">
          Votre histoire
        </h2>
        <div className="flex flex-col items-center gap-2 rounded-card border-[length:--border-width-ink] border-line bg-surface-note px-5 py-8 text-center">
          <Plume name="feather" size={72} />
          <p className="font-body text-body text-ink-soft">
            Le fil de vos échanges apparaîtra ici.
          </p>
        </div>
      </section>
    </div>
  );
}

export default ContactDetail;
