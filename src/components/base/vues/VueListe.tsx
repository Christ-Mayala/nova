'use client';

import { FileText, Plus } from 'lucide-react';

import { proprietesDeVue, valeurDe } from '@/components/base/filtrage';
import { ValeurPropriete, type ContexteVue } from '@/components/base/commun';
import { cn } from '@/lib/utils';

/** Vue en liste : lignes compactes, propriétés affichées en pastilles. */
export function VueListe({ ctx }: { ctx: ContexteVue }) {
  const proprietes = proprietesDeVue(ctx.base, ctx.vue);

  return (
    <div className="flex flex-col">
      {ctx.elements.length === 0 && (
        <p className="px-2 py-6 text-sm texte-faible">Aucun élément dans cette vue.</p>
      )}

      {ctx.elements.map((element) => (
        <button
          key={element._id}
          type="button"
          onClick={() => ctx.ouvrirElement(element)}
          className="flex items-center gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 texte-faible" />
          <span className="min-w-0 flex-1 truncate">{element.titre}</span>
          <span className="flex shrink-0 items-center gap-2">
            {proprietes.map((propriete) => (
              <ValeurPropriete
                key={propriete.nom}
                propriete={propriete}
                valeur={valeurDe(element, propriete.nom)}
                className="text-xs"
              />
            ))}
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => ctx.creerElement()}
        disabled={!ctx.peutEditer}
        className={cn(
          'mt-1 flex items-center gap-2 rounded px-2 py-2 text-left text-sm texte-faible',
          ctx.peutEditer && 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        )}
      >
        <Plus className="h-4 w-4" />
        Nouveau
      </button>
    </div>
  );
}
