'use client';

import { Trash2 } from 'lucide-react';

import { CellulePropriete, type ContexteVue } from '@/components/base/commun';
import { proprietesDisponibles } from '@/components/base/filtrage';
import { Modale } from '@/components/ui/Modale';
import { useConfirmation } from '@/components/ui/Confirmation';
import type { Element } from '@/lib/types';

/**
 * Fiche d'un élément de base (équivalent de la page d'un élément NOVA) :
 * titre et propriétés éditables, pour les vues qui n'éditent pas en ligne.
 */
export function ElementDetail({
  ctx,
  element,
  onFermer,
}: {
  ctx: ContexteVue;
  element: Element;
  onFermer: () => void;
}) {
  const confirmer = useConfirmation();
  const proprietes = proprietesDisponibles(ctx.base);

  async function supprimer() {
    const ok = await confirmer({
      titre: `Supprimer « ${element.titre} » ?`,
      message: 'Cet élément sera déplacé vers la corbeille.',
      libelleConfirmer: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    ctx.supprimerElement(element._id);
    onFermer();
  }

  return (
    <Modale
      ouvert
      onFermer={onFermer}
      largeur="max-w-2xl"
      titre={
        <input
          value={element.titre}
          onChange={(e) => ctx.ecrireValeur(element, 'titre', e.target.value)}
          readOnly={!ctx.peutEditer}
          placeholder="Sans titre"
          className="w-full bg-transparent text-lg font-semibold outline-none placeholder:texte-faible"
        />
      }
      pied={
        ctx.peutEditer ? (
          <button
            type="button"
            onClick={supprimer}
            className="bouton text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        ) : null
      }
    >
      <div className="flex flex-col gap-1">
        {proprietes
          .filter((p) => p.type !== 'titre')
          .map((propriete) => (
            <div key={propriete.nom} className="flex items-center gap-3 border-b py-1.5" style={{ borderColor: 'var(--bordure)' }}>
              <span className="w-40 shrink-0 truncate text-sm texte-doux">{propriete.nom}</span>
              <div className="min-w-0 flex-1">
                <CellulePropriete ctx={ctx} element={element} propriete={propriete} />
              </div>
            </div>
          ))}
      </div>
    </Modale>
  );
}
