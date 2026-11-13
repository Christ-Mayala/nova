'use client';

import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { catalogueBlocs, iconeParTypeBloc, type EntreeCatalogueBloc } from '@/lib/icones';
import type { TypeBloc } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Aplatit le catalogue des blocs en une liste unique. */
const CATALOGUE_PLAT: EntreeCatalogueBloc[] = catalogueBlocs.flatMap((groupe) => groupe.blocs);

/** Filtre le catalogue selon la requête saisie après « / ». */
export function filtrerCatalogue(requete: string): EntreeCatalogueBloc[] {
  const terme = requete.trim().toLowerCase();
  if (!terme) return CATALOGUE_PLAT.slice(0, 12);
  return CATALOGUE_PLAT.filter(
    (bloc) =>
      bloc.libelle.toLowerCase().includes(terme) || bloc.motsCles.toLowerCase().includes(terme)
  ).slice(0, 20);
}

/**
 * Menu slash : insère n'importe quel type de bloc depuis l'éditeur.
 * La navigation clavier est pilotée par le bloc qui l'héberge.
 */
export function MenuSlash({
  liste,
  indexActif,
  onChoisir,
  onSurvol,
}: {
  liste: EntreeCatalogueBloc[];
  indexActif: number;
  onChoisir: (type: TypeBloc) => void;
  onSurvol: (index: number) => void;
}) {
  const refListe = useRef<HTMLDivElement>(null);

  // Garde l'élément actif visible lors de la navigation clavier.
  useEffect(() => {
    const conteneur = refListe.current;
    if (!conteneur) return;
    const actif = conteneur.querySelector<HTMLElement>('[data-actif="true"]');
    actif?.scrollIntoView({ block: 'nearest' });
  }, [indexActif]);

  if (liste.length === 0) {
    return (
      <div className="menu-flottant absolute left-0 top-full mt-1 w-72 p-3 text-sm texte-doux">
        Aucun bloc ne correspond. Essayez « image », « base » ou « titre ».
      </div>
    );
  }

  return (
    <div
      ref={refListe}
      className="menu-flottant absolute left-0 top-full z-40 mt-1 max-h-80 w-80 overflow-y-auto defilement-fin"
      role="listbox"
      aria-label="Insérer un bloc"
    >
      <p className="px-2 py-1 text-xs font-medium texte-faible">Insérer un bloc</p>
      {liste.map((bloc, index) => {
        const Icone = iconeParTypeBloc[bloc.type];
        const actif = index === indexActif;
        return (
          <button
            key={bloc.type}
            type="button"
            role="option"
            aria-selected={actif}
            data-actif={actif}
            onMouseEnter={() => onSurvol(index)}
            onMouseDown={(e) => {
              // Empêche la perte de focus du bloc avant l'insertion.
              e.preventDefault();
              onChoisir(bloc.type);
            }}
            className={cn('menu-item items-start', actif && 'font-medium')}
            style={actif ? { backgroundColor: 'var(--survol)' } : undefined}
          >
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border"
              style={{ borderColor: 'var(--bordure)' }}
            >
              <Icone className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate">{bloc.libelle}</span>
              <span className="block truncate text-xs texte-faible">{bloc.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Sélecteur « Transformer en » : liste complète des types de blocs, avec
 * recherche instantanée et regroupement par famille pour rester lisible.
 */
export function MenuTransformer({ onChoisir }: { onChoisir: (type: TypeBloc) => void }) {
  const [recherche, setRecherche] = useState('');

  const groupes = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return catalogueBlocs;
    return catalogueBlocs
      .map((groupe) => ({
        ...groupe,
        blocs: groupe.blocs.filter(
          (bloc) =>
            bloc.libelle.toLowerCase().includes(terme) ||
            bloc.motsCles.toLowerCase().includes(terme)
        ),
      }))
      .filter((groupe) => groupe.blocs.length > 0);
  }, [recherche]);

  const total = groupes.reduce((n, groupe) => n + groupe.blocs.length, 0);

  return (
    <div className="flex w-full flex-col">
      <div
        className="sticky top-0 z-10 -mx-1.5 flex items-center gap-2 border-b px-3.5 py-2"
        style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond)' }}
      >
        <Search className="h-3.5 w-3.5 shrink-0 texte-faible" />
        <input
          autoFocus
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder="Rechercher une transformation…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--texte-faible)]"
        />
      </div>
      <div className="py-1">
        {total === 0 ? (
          <p className="px-3 py-2 text-sm texte-faible">Aucun type ne correspond.</p>
        ) : (
          groupes.map((groupe) => (
            <div key={groupe.famille} className="mb-0.5">
              <p className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide texte-faible">
                {groupe.famille}
              </p>
              {groupe.blocs.map((bloc) => {
                const Icone = iconeParTypeBloc[bloc.type];
                return (
                  <button
                    key={bloc.type}
                    type="button"
                    className="menu-item items-start"
                    onClick={() => onChoisir(bloc.type)}
                  >
                    <Icone className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
                    <span className="min-w-0">
                      <span className="block">{bloc.libelle}</span>
                      <span className="block text-xs texte-faible">{bloc.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
