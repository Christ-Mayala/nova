'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * Rendu Markdown minimaliste, sans dépendance externe.
 *
 * Couvre le sous-ensemble produit par l'assistant IA : titres, listes,
 * citations, blocs de code, séparateurs, tableaux (GFM), gras/italique/barré,
 * code inline et liens. Le contenu est rendu en nœuds React (pas de
 * `dangerouslySetInnerHTML`), donc tout HTML présent dans la réponse est
 * affiché comme du texte — à l'exception de `<br>`, converti en retour à la
 * ligne pour rester lisible dans les cellules de tableau.
 */

const INLINE =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\+\+[^+\n]+\+\+|==[^=\n]+==|\{[a-z-]+:[^}\n]+\}|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]]+\]\([^)\s]+\))/g;

/** Couleurs de texte disponibles via la syntaxe `{couleur:texte}`. */
const COULEURS_TEXTE: Record<string, string> = {
  rouge: '#e03e3e',
  orange: '#d9730d',
  jaune: '#dfab01',
  vert: '#0f7b6c',
  bleu: '#0b6e99',
  violet: '#6940a5',
  rose: '#ad1a72',
  gris: '#787774',
};

/** Couleurs de fond disponibles via la syntaxe `{fond-couleur:texte}`. */
const COULEURS_FOND: Record<string, string> = {
  rouge: 'rgba(224, 62, 62, 0.22)',
  orange: 'rgba(217, 115, 13, 0.22)',
  jaune: 'rgba(223, 171, 1, 0.25)',
  vert: 'rgba(15, 123, 108, 0.22)',
  bleu: 'rgba(11, 110, 153, 0.22)',
  violet: 'rgba(105, 64, 165, 0.22)',
  rose: 'rgba(173, 26, 114, 0.22)',
  gris: 'rgba(120, 119, 116, 0.22)',
};

const LIEN_SUR = /^(https?:\/\/|mailto:|\/|#)/i;

/** Marqueur interne remplaçant un `<br>` : rendu en vrai retour à la ligne. */
const TOKEN_BR = '\u0000';

/** Ligne susceptible d'appartenir à un tableau (contient un séparateur `|`). */
function estLigneTableau(ligne: string): boolean {
  return ligne.includes('|');
}

/** Ligne de séparation d'en-tête GFM : `| --- | :---: |`. */
function estSeparateurTableau(ligne: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(ligne);
}

/** Découpe une ligne de tableau en cellules (sans les `|` de bord). */
function decouperCellules(ligne: string): string[] {
  return ligne
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cellule) => cellule.trim());
}

function rendreLigne(texte: string, cle: string): ReactNode[] {
  // Un `<br>` (ou son équivalent échappé) devient un vrai saut de ligne : c'est
  // indispensable dans les cellules de tableau, où un retour à la ligne brut
  // découperait la ligne en deux.
  if (texte.includes(TOKEN_BR)) {
    return texte.split(TOKEN_BR).flatMap((partie, index) => [
      ...(index > 0 ? [<br key={`${cle}-br-${index}`} />] : []),
      ...rendreLigne(partie, `${cle}-${index}`),
    ]);
  }

  const morceaux = texte.split(INLINE).filter((morceau) => morceau !== '');

  return morceaux.map((morceau, index) => {
    const k = `${cle}-${index}`;

    if (morceau.length > 4 && morceau.startsWith('**') && morceau.endsWith('**')) {
      return (
        <strong key={k} className="font-semibold">
          {morceau.slice(2, -2)}
        </strong>
      );
    }
    if (morceau.length > 4 && morceau.startsWith('__') && morceau.endsWith('__')) {
      return (
        <strong key={k} className="font-semibold">
          {morceau.slice(2, -2)}
        </strong>
      );
    }
    if (morceau.length > 4 && morceau.startsWith('~~') && morceau.endsWith('~~')) {
      return (
        <del key={k} className="opacity-70">
          {morceau.slice(2, -2)}
        </del>
      );
    }
    if (morceau.length > 4 && morceau.startsWith('++') && morceau.endsWith('++')) {
      return (
        <u key={k} className="underline underline-offset-2">
          {rendreLigne(morceau.slice(2, -2), k)}
        </u>
      );
    }
    if (morceau.length > 4 && morceau.startsWith('==') && morceau.endsWith('==')) {
      return (
        <mark
          key={k}
          className="rounded px-0.5"
          style={{ backgroundColor: 'rgba(255, 212, 0, 0.35)', color: 'inherit' }}
        >
          {rendreLigne(morceau.slice(2, -2), k)}
        </mark>
      );
    }

    // Couleur de texte `{couleur:texte}` et de fond `{fond-couleur:texte}`.
    const couleur = /^\{([a-z-]+):([^}\n]+)\}$/.exec(morceau);
    if (couleur) {
      const [, cleCouleur, interieur] = couleur;
      const surFond = cleCouleur.startsWith('fond-');
      const nom = surFond ? cleCouleur.slice(5) : cleCouleur;
      const valeur = (surFond ? COULEURS_FOND : COULEURS_TEXTE)[nom];
      if (!valeur) return <Fragment key={k}>{rendreLigne(interieur, k)}</Fragment>;
      return (
        <span
          key={k}
          style={
            surFond
              ? { backgroundColor: valeur, borderRadius: '3px', padding: '0 2px' }
              : { color: valeur }
          }
        >
          {rendreLigne(interieur, k)}
        </span>
      );
    }
    if (morceau.length > 2 && morceau.startsWith('`') && morceau.endsWith('`')) {
      return (
        <code
          key={k}
          className="rounded px-1 py-0.5 text-[0.85em]"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          {morceau.slice(1, -1)}
        </code>
      );
    }
    if (morceau.length > 2 && morceau.startsWith('*') && morceau.endsWith('*')) {
      return <em key={k}>{morceau.slice(1, -1)}</em>;
    }
    if (morceau.length > 2 && morceau.startsWith('_') && morceau.endsWith('_')) {
      return <em key={k}>{morceau.slice(1, -1)}</em>;
    }

    const lien = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(morceau);
    if (lien) {
      const [, libelle, href] = lien;
      if (!LIEN_SUR.test(href)) return <Fragment key={k}>{libelle}</Fragment>;
      const externe = /^https?:\/\//i.test(href);
      return (
        <a
          key={k}
          href={href}
          className="cursor-pointer rounded-[3px] font-medium text-sky-700 underline decoration-sky-400/60 decoration-1 underline-offset-2 transition-colors hover:bg-sky-500/10 hover:decoration-sky-500 dark:text-sky-300"
          {...(externe ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {libelle}
        </a>
      );
    }

    return <Fragment key={k}>{morceau}</Fragment>;
  });
}

/** Vrai si la ligne ouvre un bloc Markdown (et non un paragraphe). */
function ouvreBloc(ligne: string): boolean {
  return (
    /^\s*```/.test(ligne) ||
    /^(#{1,6})\s+/.test(ligne) ||
    /^\s*([-*+])\s+/.test(ligne) ||
    /^\s*\d+[.)]\s+/.test(ligne) ||
    /^\s*>\s?/.test(ligne) ||
    /^\s*([-*_])\1{2,}\s*$/.test(ligne)
  );
}

function decouper(contenu: string): ReactNode[] {
  const lignes = contenu
    .replace(/\r\n/g, '\n')
    // L'assistant renvoie parfois des `<br>` (HTML) pour séparer deux points
    // d'un même paragraphe ou d'une même cellule. On les convertit en marqueur
    // avant de découper en lignes, pour ne pas casser une ligne de tableau.
    .replace(/<br\s*\/?>/gi, TOKEN_BR)
    .replace(/&lt;br\s*\/?&gt;/gi, TOKEN_BR)
    .split('\n');
  const sortie: ReactNode[] = [];
  let i = 0;
  let cle = 0;

  while (i < lignes.length) {
    const ligne = lignes[i];

    if (!ligne.trim()) {
      i += 1;
      continue;
    }

    // Bloc de code délimité par ```
    if (/^\s*```/.test(ligne)) {
      const code: string[] = [];
      i += 1;
      while (i < lignes.length && !/^\s*```/.test(lignes[i])) {
        code.push(lignes[i]);
        i += 1;
      }
      i += 1;
      sortie.push(
        <pre
          key={cle++}
          className="overflow-x-auto rounded-md p-3 text-xs leading-relaxed"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <code>{code.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Titres
    const titre = /^(#{1,6})\s+(.*)$/.exec(ligne);
    if (titre) {
      const niveau = titre[1].length;
      const contenuTitre = rendreLigne(titre[2], `titre-${cle}`);
      if (niveau === 1) {
        sortie.push(
          <h1 key={cle++} className="text-lg font-bold">
            {contenuTitre}
          </h1>
        );
      } else if (niveau === 2) {
        sortie.push(
          <h2 key={cle++} className="text-base font-semibold">
            {contenuTitre}
          </h2>
        );
      } else {
        sortie.push(
          <h3 key={cle++} className="text-sm font-semibold">
            {contenuTitre}
          </h3>
        );
      }
      i += 1;
      continue;
    }

    // Listes à puces
    if (/^\s*([-*+])\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*([-*+])\s+/.test(lignes[i])) {
        items.push(lignes[i].replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      sortie.push(
        <ul key={cle++} className="ml-5 list-disc space-y-1">
          {items.map((item, index) => (
            <li key={index}>{rendreLigne(item, `ul-${cle}-${index}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Listes numérotées
    if (/^\s*\d+[.)]\s+/.test(ligne)) {
      const items: string[] = [];
      while (i < lignes.length && /^\s*\d+[.)]\s+/.test(lignes[i])) {
        items.push(lignes[i].replace(/^\s*\d+[.)]\s+/, ''));
        i += 1;
      }
      sortie.push(
        <ol key={cle++} className="ml-5 list-decimal space-y-1">
          {items.map((item, index) => (
            <li key={index}>{rendreLigne(item, `ol-${cle}-${index}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Citations
    if (/^\s*>\s?/.test(ligne)) {
      const lignesCitation: string[] = [];
      while (i < lignes.length && /^\s*>\s?/.test(lignes[i])) {
        lignesCitation.push(lignes[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      sortie.push(
        <blockquote
          key={cle++}
          className="border-l-2 pl-3 italic"
          style={{ borderColor: 'var(--bordure-forte)' }}
        >
          {lignesCitation.map((ligneCitation, index) => (
            <p key={index}>{rendreLigne(ligneCitation, `citation-${cle}-${index}`)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Séparateur horizontal
    if (/^\s*([-*_])\1{2,}\s*$/.test(ligne)) {
      sortie.push(
        <hr key={cle++} className="my-1" style={{ borderColor: 'var(--bordure)' }} />
      );
      i += 1;
      continue;
    }

    // Tableaux (GFM) : en-tête, ligne de séparation, puis lignes de données.
    if (estLigneTableau(ligne) && estSeparateurTableau(lignes[i + 1] ?? '')) {
      const entetes = decouperCellules(ligne);
      const alignements = decouperCellules(lignes[i + 1]).map((cellule) =>
        cellule.startsWith(':') && cellule.endsWith(':')
          ? 'center'
          : cellule.endsWith(':')
            ? 'right'
            : cellule.startsWith(':')
              ? 'left'
              : undefined
      );
      i += 2;
      const corps: string[][] = [];
      while (
        i < lignes.length &&
        lignes[i].trim() &&
        estLigneTableau(lignes[i]) &&
        !estSeparateurTableau(lignes[i])
      ) {
        corps.push(decouperCellules(lignes[i]));
        i += 1;
      }
      const identifiant = cle++;
      sortie.push(
        <div
          key={identifiant}
          className="overflow-x-auto rounded-md border"
          style={{ borderColor: 'var(--bordure)' }}
        >
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr>
                {entetes.map((entete, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="px-2.5 py-1.5 align-top font-semibold"
                    style={{
                      backgroundColor: 'var(--fond-secondaire)',
                      textAlign: alignements[index],
                      borderBottom: '1px solid var(--bordure)',
                    }}
                  >
                    {rendreLigne(entete, `th-${identifiant}-${index}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corps.map((rangee, ligneIndex) => (
                <tr key={ligneIndex}>
                  {entetes.map((entete, colonneIndex) => (
                    <td
                      key={`${entete}-${colonneIndex}`}
                      className="px-2.5 py-1.5 align-top"
                      style={{
                        textAlign: alignements[colonneIndex],
                        borderBottom:
                          ligneIndex < corps.length - 1 ? '1px solid var(--bordure)' : undefined,
                      }}
                    >
                      {rendreLigne(
                        rangee[colonneIndex] ?? '',
                        `td-${identifiant}-${ligneIndex}-${colonneIndex}`
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Paragraphe (regroupe les lignes consécutives)
    const paragraphe: string[] = [];
    while (
      i < lignes.length &&
      lignes[i].trim() &&
      !ouvreBloc(lignes[i]) &&
      // Une ligne amorçant un tableau ne doit pas être absorbée par le texte.
      !(estLigneTableau(lignes[i]) && estSeparateurTableau(lignes[i + 1] ?? ''))
    ) {
      paragraphe.push(lignes[i].trim());
      i += 1;
    }
    sortie.push(
      <p key={cle++} className="leading-relaxed">
        {paragraphe.map((ligneParagraphe, index) => (
          <Fragment key={index}>
            {index > 0 && <br />}
            {rendreLigne(ligneParagraphe, `p-${cle}-${index}`)}
          </Fragment>
        ))}
      </p>
    );
  }

  return sortie;
}

/** Affiche un texte Markdown sous forme de blocs React stylés. */
export function Markdown({ contenu, className }: { contenu: string; className?: string }) {
  return <div className={className}>{decouper(contenu)}</div>;
}

/**
 * Affiche un extrait Markdown « en ligne » (gras, italique, barré, code
 * inline et liens) sans bloc englobant. Utilisé pour le rendu des blocs de
 * l'éditeur lorsque ceux-ci ne sont pas en cours d'édition.
 */
export function MarkdownInline({ contenu }: { contenu: string }) {
  return <>{rendreLigne(contenu, 'inline')}</>;
}
