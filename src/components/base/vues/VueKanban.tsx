'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { ValeurPropriete, type ContexteVue } from '@/components/base/commun';
import { formaterValeur, optionsDe, proprieteGroupement, proprietesDeVue, valeurDe } from '@/components/base/filtrage';
import type { Element } from '@/lib/types';
import { cn, couleurEtiquette, couleurPriorite } from '@/lib/utils';

const CLE_SANS_VALEUR = '__sans_valeur__';

/** Vue Kanban : colonnes par valeur d'une propriété de type sélection/statut. */
export function VueKanban({ ctx }: { ctx: ContexteVue }) {
  const propriete = proprieteGroupement(ctx.base, ctx.vue);
  const [glisse, setGlisse] = useState<string | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);

  if (!propriete) {
    return (
      <p className="px-2 py-6 text-sm texte-faible">
        Ajoutez une propriété de type « Sélection » ou « Statut » pour utiliser la vue Kanban.
      </p>
    );
  }

  const options = optionsDe(propriete);
  const nomPropriete = propriete.nom;
  const estPriorite = nomPropriete.toLowerCase() === 'priorite';
  const autres = proprietesDeVue(ctx.base, ctx.vue).filter((p) => p.nom !== nomPropriete);

  const colonnes = options.map((option) => ({
    cle: option,
    libelle: option,
    elements: ctx.elements.filter((e) => formaterValeur(valeurDe(e, nomPropriete)) === option),
  }));
  const sansValeur = ctx.elements.filter((e) => {
    const valeur = formaterValeur(valeurDe(e, nomPropriete));
    return !valeur || !options.includes(valeur);
  });
  if (sansValeur.length > 0) {
    colonnes.push({ cle: CLE_SANS_VALEUR, libelle: 'Sans valeur', elements: sansValeur });
  }

  /** Dépose un élément dans une colonne : met à jour la propriété de regroupement. */
  function deposer(cle: string) {
    setSurvol(null);
    if (!ctx.peutEditer || !glisse) return;
    const element = ctx.elements.find((e) => e._id === glisse);
    setGlisse(null);
    if (!element) return;
    ctx.ecrireValeur(element, nomPropriete, cle === CLE_SANS_VALEUR ? null : cle);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {colonnes.map((colonne) => (
        <div
          key={colonne.cle}
          onDragOver={(e) => {
            e.preventDefault();
            setSurvol(colonne.cle);
          }}
          onDragLeave={() => setSurvol((c) => (c === colonne.cle ? null : c))}
          onDrop={() => deposer(colonne.cle)}
          className={cn(
            'flex w-72 shrink-0 flex-col rounded-lg p-2 transition-colors',
            survol === colonne.cle && 'ring-2 ring-sky-400/60'
          )}
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          {/* En-tête de colonne */}
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span
              className={cn(
                'etiquette',
                colonne.cle === CLE_SANS_VALEUR
                  ? 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                  : estPriorite
                    ? couleurPriorite(colonne.cle.toLowerCase())
                    : couleurEtiquette(colonne.cle)
              )}
            >
              {colonne.libelle}
            </span>
            <span className="text-xs texte-faible">{colonne.elements.length}</span>
            <button
              type="button"
              onClick={() => ctx.creerElement()}
              disabled={!ctx.peutEditer}
              className="ml-auto flex h-5 w-5 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Ajouter une carte"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Cartes */}
          <div className="flex flex-col gap-1.5">
            {colonne.elements.map((element) => (
              <CarteKanban
                key={element._id}
                ctx={ctx}
                element={element}
                autres={autres}
                enGlissement={glisse === element._id}
                onGlisser={() => setGlisse(element._id)}
                onFinGlisse={() => setGlisse(null)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Carte déplaçable d'une colonne Kanban. */
function CarteKanban({
  ctx,
  element,
  autres,
  enGlissement,
  onGlisser,
  onFinGlisse,
}: {
  ctx: ContexteVue;
  element: Element;
  autres: ReturnType<typeof proprietesDeVue>;
  enGlissement: boolean;
  onGlisser: () => void;
  onFinGlisse: () => void;
}) {
  return (
    <div
      draggable={ctx.peutEditer}
      onDragStart={onGlisser}
      onDragEnd={onFinGlisse}
      onClick={() => ctx.ouvrirElement(element)}
      className={cn(
        'carte cursor-pointer p-2.5 shadow-sm',
        enGlissement && 'opacity-50',
        ctx.peutEditer && 'active:cursor-grabbing'
      )}
    >
      <p className="text-sm font-medium">{element.titre}</p>
      {autres.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {autres.slice(0, 3).map((propriete) => (
            <span key={propriete.nom} className="inline-flex items-center gap-1 text-xs">
              <span className="texte-faible">{propriete.nom}</span>
              <ValeurPropriete propriete={propriete} valeur={valeurDe(element, propriete.nom)} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
