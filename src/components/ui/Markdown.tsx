'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * Rendu Markdown minimaliste, sans dépendance externe.
 *
 * Couvre le sous-ensemble produit par l'assistant IA : titres, listes,
 * citations, blocs de code, séparateurs, gras/italique/barré, code inline et
 * liens. Le contenu est rendu en nœuds React (pas de `dangerouslySetInnerHTML`),
 * donc tout HTML présent dans la réponse est affiché comme du texte.
 */

const INLINE =
  /(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]]+\]\([^)\s]+\))/g;

const LIEN_SUR = /^(https?:\/\/|mailto:|\/|#)/i;

function rendreLigne(texte: string, cle: string): ReactNode[] {
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
          className="text-sky-600 underline underline-offset-2 hover:no-underline dark:text-sky-400"
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
  const lignes = contenu.replace(/\r\n/g, '\n').split('\n');
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

    // Paragraphe (regroupe les lignes consécutives)
    const paragraphe: string[] = [];
    while (i < lignes.length && lignes[i].trim() && !ouvreBloc(lignes[i])) {
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
