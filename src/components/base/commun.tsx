'use client';

import { Check, ChevronDown, Minus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { formaterValeur, optionsDe, valeurDe } from '@/components/base/filtrage';
import { Menu, MenuElement } from '@/components/ui/Menu';
import type { Base, Element, ProprieteBase, TypePropriete, VueBase as VueBaseDef } from '@/lib/types';
import { cn, couleurEtiquette, couleurPriorite, formaterDate, versDateInput } from '@/lib/utils';

/**
 * Contexte partagé par toutes les vues d'une base : données, vue active et
 * opérations d'écriture. Il évite de faire circuler une dizaine de props.
 */
export interface ContexteVue {
  base: Base;
  /** Éléments de la base, déjà filtrés et triés selon la vue active. */
  elements: Element[];
  /** Tous les éléments de la base (non filtrés), pour compter les groupes. */
  tousLesElements: Element[];
  vue: VueBaseDef;
  /** Droit d'écriture sur la base (tout membre connecté). */
  peutEditer: boolean;
  /** Crée un élément, éventuellement pré-rempli (ex. date d'un jour de calendrier). */
  creerElement: (initial?: Partial<Element>) => void;
  supprimerElement: (id: string) => void;
  ouvrirElement: (element: Element) => void;
  /** Écrit une valeur de propriété sur un élément (différé côté VueBase). */
  ecrireValeur: (element: Element, nom: string, valeur: unknown) => void;
  /** Ajoute une propriété à la base (tout membre connecté). */
  ajouterPropriete: (nom: string, type: TypePropriete) => void;
  /** Met à jour la vue active (filtres, tris, groupes, propriétés visibles). */
  majVue: (patch: Partial<VueBaseDef>) => void;
}

/** Types de propriétés calculées par le serveur (lecture seule). */
const TYPES_CALCULES: TypePropriete[] = [
  'formule',
  'rollup',
  'id_unique',
  'cree_le',
  'modifie_le',
  'cree_par',
  'modifie_par',
];

/** Vrai si la propriété est en lecture seule (calculée ou compte sans droit d'écriture). */
export function estLectureSeule(propriete: ProprieteBase, peutEditer: boolean): boolean {
  return !peutEditer || TYPES_CALCULES.includes(propriete.type);
}

/** Vrai si la propriété se comporte comme une liste d'options. */
export function estSelection(propriete: ProprieteBase): boolean {
  return (
    propriete.type === 'selection' ||
    propriete.type === 'selection_multiple' ||
    propriete.type === 'statut' ||
    propriete.type === 'case'
  );
}

/** Affiche une valeur de propriété sous forme de pastille/texte compact. */
export function ValeurPropriete({
  propriete,
  valeur,
  className,
}: {
  propriete: ProprieteBase;
  valeur: unknown;
  className?: string;
}) {
  if (propriete.type === 'case') {
    return valeur ? (
      <Check className={cn('h-3.5 w-3.5', className)} />
    ) : (
      <Minus className={cn('h-3.5 w-3.5 texte-faible', className)} />
    );
  }

  if (propriete.type === 'date' || propriete.type === 'cree_le' || propriete.type === 'modifie_le') {
    const texte = formaterDate(valeur ? String(valeur) : '');
    return <span className={className}>{texte || '—'}</span>;
  }

  if (propriete.type === 'personne' || propriete.type === 'cree_par' || propriete.type === 'modifie_par') {
    const texte = formaterValeur(valeur);
    if (!texte) return <span className={cn('texte-faible', className)}>—</span>;
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        <span
          className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {texte.slice(0, 2).toUpperCase()}
        </span>
        {texte}
      </span>
    );
  }

  if (estSelection(propriete)) {
    const texte = formaterValeur(valeur);
    if (!texte) return <span className={cn('texte-faible', className)}>—</span>;
    const estPriorite = propriete.nom.toLowerCase() === 'priorite';
    return (
      <span
        className={cn(
          'etiquette',
          estPriorite ? couleurPriorite(String(valeur).toLowerCase()) : couleurEtiquette(texte),
          className
        )}
      >
        {texte}
      </span>
    );
  }

  const texte = formaterValeur(valeur);
  if (!texte) return <span className={cn('texte-faible', className)}>—</span>;
  if (propriete.type === 'url') {
    return (
      <a
        href={texte}
        target="_blank"
        rel="noreferrer"
        className={cn('truncate text-sky-600 underline dark:text-sky-400', className)}
      >
        {texte}
      </a>
    );
  }
  return <span className={cn('truncate', className)}>{texte}</span>;
}

/** Cellule éditable d'une propriété dans une vue en tableau/fiche. */
export function CellulePropriete({
  ctx,
  element,
  propriete,
}: {
  ctx: ContexteVue;
  element: Element;
  propriete: ProprieteBase;
}) {
  const [edition, setEdition] = useState(false);
  const valeur = valeurDe(element, propriete.nom);
  const lireSeul = estLectureSeule(propriete, ctx.peutEditer);

  if (lireSeul) {
    return (
      <span className="block min-w-0 truncate px-1.5 py-1">
        <ValeurPropriete propriete={propriete} valeur={valeur} />
      </span>
    );
  }

  if (propriete.type === 'case') {
    return (
      <input
        type="checkbox"
        checked={Boolean(valeur)}
        onChange={(e) => ctx.ecrireValeur(element, propriete.nom, e.target.checked)}
        className="h-3.5 w-3.5 rounded border-neutral-400 accent-sky-500"
        aria-label={propriete.nom}
      />
    );
  }

  if (estSelection(propriete)) {
    return <SelecteurOption ctx={ctx} element={element} propriete={propriete} valeur={valeur} />;
  }

  if (propriete.type === 'date') {
    return (
      <input
        type="date"
        value={versDateInput(valeur ? String(valeur) : '')}
        onChange={(e) => ctx.ecrireValeur(element, propriete.nom, e.target.value ? e.target.value : null)}
        className="w-full bg-transparent px-1.5 py-1 text-sm outline-none"
      />
    );
  }

  const type = propriete.type === 'nombre' ? 'number' : propriete.type === 'email' ? 'email' : 'text';

  if (edition) {
    return (
      <input
        autoFocus
        type={type}
        defaultValue={formaterValeur(valeur)}
        onBlur={(e) => {
          ctx.ecrireValeur(element, propriete.nom, propriete.type === 'nombre' ? Number(e.target.value) || 0 : e.target.value);
          setEdition(false);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEdition(false);
        }}
        className="champ px-1.5 py-0.5 text-sm"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEdition(true)}
      className="block w-full min-w-0 truncate rounded px-1.5 py-1 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
    >
      <ValeurPropriete propriete={propriete} valeur={valeur} />
    </button>
  );
}

/** Menu déroulant d'options pour les propriétés de type sélection/statut. */
function SelecteurOption({
  ctx,
  element,
  propriete,
  valeur,
}: {
  ctx: ContexteVue;
  element: Element;
  propriete: ProprieteBase;
  valeur: unknown;
}) {
  const options = optionsDe(propriete);
  const estPriorite = propriete.nom.toLowerCase() === 'priorite';
  const texte = formaterValeur(valeur);

  return (
    <Menu
      largeur="w-48"
      declencheur={
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          {texte ? (
            <span
              className={cn(
                'etiquette',
                estPriorite ? couleurPriorite(texte.toLowerCase()) : couleurEtiquette(texte)
              )}
            >
              {texte}
            </span>
          ) : (
            <span className="texte-faible">Vide</span>
          )}
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 texte-faible" />
        </button>
      }
    >
      {options.map((option) => (
        <MenuElement
          key={option}
          actif={option === texte}
          onClick={() => ctx.ecrireValeur(element, propriete.nom, option)}
        >
          <span
            className={cn(
              'etiquette',
              estPriorite ? couleurPriorite(option.toLowerCase()) : couleurEtiquette(option)
            )}
          >
            {option}
          </span>
        </MenuElement>
      ))}
      <MenuElement onClick={() => ctx.ecrireValeur(element, propriete.nom, null)}>
        <span className="flex items-center gap-2 texte-doux">
          <X className="h-3.5 w-3.5" />
          Vider
        </span>
      </MenuElement>
    </Menu>
  );
}
