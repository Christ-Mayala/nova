'use client';

import { CalendarRange } from 'lucide-react';

import { type ContexteVue } from '@/components/base/commun';
import { proprietesPeriode, valeurDe } from '@/components/base/filtrage';
import type { Element } from '@/lib/types';
import { NOMS_MOIS, cn, couleurEtiquette } from '@/lib/utils';

const JOUR = 24 * 60 * 60 * 1000;

interface Periode {
  element: Element;
  debut: number;
  fin: number;
}

/** Vue chronologie (Gantt) : barres positionnées selon une période début → fin. */
export function VueChronologie({ ctx }: { ctx: ContexteVue }) {
  const { debut, fin } = proprietesPeriode(ctx.base, ctx.vue);

  if (!debut) {
    return (
      <p className="px-2 py-6 text-sm texte-faible">
        Ajoutez une propriété de type « Date » pour utiliser la vue Chronologie.
      </p>
    );
  }

  const periodes: Periode[] = [];
  const sansDate: Element[] = [];
  ctx.elements.forEach((element) => {
    const d = new Date(String(valeurDe(element, debut.nom) || '')).getTime();
    const f = new Date(String(valeurDe(element, fin?.nom || debut.nom) || '')).getTime();
    if (Number.isNaN(d)) {
      sansDate.push(element);
      return;
    }
    periodes.push({ element, debut: d, fin: Number.isNaN(f) ? d : Math.max(f, d) });
  });

  if (periodes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center texte-faible">
        <CalendarRange className="h-5 w-5" />
        <p className="text-sm">Aucun élément avec une date renseignée.</p>
      </div>
    );
  }

  const min = Math.min(...periodes.map((p) => p.debut));
  const max = Math.max(...periodes.map((p) => p.fin));

  // Axe calé sur des mois entiers : les étiquettes ne débordent plus à gauche
  // et les barres restent dans l'intervalle visible [0 %, 100 %].
  const premierJour = new Date(min);
  const dernierJour = new Date(max);
  const debutAxe = new Date(premierJour.getFullYear(), premierJour.getMonth(), 1).getTime();
  const finAxe = new Date(dernierJour.getFullYear(), dernierJour.getMonth() + 1, 0).getTime();
  const etendue = Math.max(finAxe - debutAxe, JOUR);
  const position = (valeur: number) => ((valeur - debutAxe) / etendue) * 100;

  const moisAffiches: Array<{ cle: string; libelle: string; gauche: number; largeur: number }> = [];
  let curseur = new Date(debutAxe);
  while (curseur.getTime() <= finAxe) {
    const suivant = new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1).getTime();
    const gauche = position(curseur.getTime());
    const droite = Math.min(position(suivant), 100);
    moisAffiches.push({
      cle: `${curseur.getFullYear()}-${curseur.getMonth()}`,
      libelle: `${NOMS_MOIS[curseur.getMonth()]} ${curseur.getFullYear()}`,
      gauche,
      largeur: Math.max(droite - gauche, 0),
    });
    curseur = new Date(suivant);
  }

  return (
    <div className="flex flex-col">
      {/* En-tête de l'axe temporel : une bande par mois, alignée avec les barres */}
      <div className="flex border-b text-xs texte-faible" style={{ borderColor: 'var(--bordure)' }}>
        <div className="w-56 shrink-0" />
        <div className="relative h-7 flex-1">
          {moisAffiches.map((mois, index) => (
            <div
              key={mois.cle}
              className={cn(
                'absolute top-0 flex h-7 items-center overflow-hidden border-l px-1.5',
                index === 0 && 'border-l-0'
              )}
              style={{ left: `${mois.gauche}%`, width: `${mois.largeur}%`, borderColor: 'var(--bordure)' }}
            >
              <span className="truncate capitalize">{mois.libelle}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        {periodes.map(({ element, debut: d, fin: f }) => (
          <div key={element._id} className="flex items-center border-b" style={{ borderColor: 'var(--bordure)' }}>
            <button
              type="button"
              onClick={() => ctx.ouvrirElement(element)}
              className="w-56 shrink-0 truncate px-2 py-2 text-left text-sm hover:text-sky-600"
            >
              {element.titre}
            </button>
            <div className="relative h-9 flex-1">
              {moisAffiches.map((mois) => (
                <span
                  key={mois.cle}
                  aria-hidden
                  className="pointer-events-none absolute top-0 h-full border-l"
                  style={{ left: `${mois.gauche}%`, borderColor: 'var(--bordure)' }}
                />
              ))}
              <div
                role="button"
                tabIndex={0}
                onClick={() => ctx.ouvrirElement(element)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') ctx.ouvrirElement(element);
                }}
                className={cn(
                  'absolute top-1.5 flex h-6 cursor-pointer items-center rounded px-2 text-[11px] font-medium',
                  couleurEtiquette(element.etiquette || element.titre)
                )}
                style={{
                  left: `${Math.min(position(d), 98)}%`,
                  width: `${Math.max(position(f) - position(d), 2)}%`,
                }}
                title={element.titre}
              >
                <span className="truncate">{element.etiquette || ''}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sansDate.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium texte-doux">Sans date ({sansDate.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {sansDate.map((element) => (
              <button
                key={element._id}
                type="button"
                onClick={() => ctx.ouvrirElement(element)}
                className="rounded px-2 py-1 text-xs hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                style={{ backgroundColor: 'var(--fond-secondaire)' }}
              >
                {element.titre}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
