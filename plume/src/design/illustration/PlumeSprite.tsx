// Sprite SVG canonique de l'illustration maison — monté UNE seule fois (layout).
// Les tracés sont l'asset de référence `public/plume-illustration-assets.svg`, repris
// VERBATIM (recolor-only, jamais redessinés — sinon perte du fait-main = look IA).
//
// Pourquoi un sprite same-document plutôt qu'un <use href="/fichier.svg#id"> externe :
// le blob se recolore via 3 tons (corps / ombre `-shade` / joues), pilotés par des
// variables CSS (--plume-cold…). Ces customs properties ne traversent PAS de façon
// fiable un <use> référençant un fichier externe (contexte de document séparé). Un
// sprite inline monté une fois résout la propagation et garde UN tracé partagé.
// `public/plume-illustration-assets.svg` reste l'artefact source de vérité (cf. AC 1.2).

export function PlumeSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        {/* plume-mascotte : corps menthe, trait encre, joue + étincelle mauve (déco
            mauve tolérée UNIQUEMENT sur l'illustration maison). */}
        <symbol id="plume-feather" viewBox="-30 -82 96 116">
          <g transform="rotate(-14)">
            <path
              d="M44 -76 C8 -64 -14 -24 -14 14 C16 4 36 12 54 -8 C45 -8 36 -5 27 -2 C44 -19 60 -40 63 -68 C57 -56 48 -47 39 -38 C51 -53 54 -64 44 -76 Z"
              fill="#7FBEAF"
              stroke="#2E3F3B"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path d="M38 -64 C24 -42 8 -12 -6 10" fill="none" stroke="#2E3F3B" strokeWidth="2.2" strokeLinecap="round" />
            <path
              d="M30 -50 l11 -7 M22 -36 l11 -7 M13 -22 l11 -7 M4 -8 l11 -7"
              fill="none"
              stroke="#4E8978"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <line x1="-14" y1="14" x2="-26" y2="30" stroke="#2E3F3B" strokeWidth="3" strokeLinecap="round" />
            <path d="M20 -52 q4 -5 8 0" fill="none" stroke="#2E3F3B" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M33 -56 q4 -5 8 0" fill="none" stroke="#2E3F3B" strokeWidth="2.4" strokeLinecap="round" />
            <ellipse cx="22" cy="-42" rx="4.5" ry="3" fill="#B391AC" opacity="0.7" />
            <path d="M26 -46 q5 5 10 0" fill="none" stroke="#2E3F3B" strokeWidth="2.4" strokeLinecap="round" />
          </g>
          <path
            d="M58 -70 l1.6 4.5 l4.5 1.6 l-4.5 1.6 l-1.6 4.5 l-1.6 -4.5 l-4.5 -1.6 z"
            fill="#B391AC"
          />
        </symbol>

        {/* avatar-blob : le fill du corps porte la froideur ; ombre interne = -shade ;
            joues = ton proche. Recoloré via variables CSS, jamais redessiné. */}
        <symbol id="plume-blob" viewBox="0 0 124 124">
          <path
            d="M62 10 C88 10 108 26 110 52 C112 78 96 104 66 110 C40 115 16 98 12 70 C8 44 24 18 50 12 C54 11 58 10 62 10 Z"
            fill="var(--plume-cold, #C9C2D6)"
            stroke="#2E3F3B"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M30 78 C26 64 30 50 42 44 C36 58 36 70 44 82 C40 84 34 83 30 78 Z"
            fill="var(--plume-cold-shade, #B3AAC6)"
          />
          <path
            d="M28 44 C36 24 60 18 80 28 C92 34 96 46 94 56 C88 44 78 38 66 40 C70 34 66 30 60 31 C56 38 48 40 42 38 C44 46 38 50 32 52 C30 49 28 47 28 44 Z"
            fill="#5A3D2A"
            stroke="#2E3F3B"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M44 66 q5 -6 10 0" fill="none" stroke="#2E3F3B" strokeWidth="3" strokeLinecap="round" />
          <path d="M70 66 q5 -6 10 0" fill="none" stroke="#2E3F3B" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="42" cy="80" rx="6" ry="4" fill="var(--plume-cheek, #A99FC0)" opacity="0.7" />
          <ellipse cx="84" cy="80" rx="6" ry="4" fill="var(--plume-cheek, #A99FC0)" opacity="0.7" />
          <path d="M54 84 q9 9 18 0" fill="none" stroke="#2E3F3B" strokeWidth="3" strokeLinecap="round" />
        </symbol>
      </defs>
    </svg>
  );
}

export default PlumeSprite;
