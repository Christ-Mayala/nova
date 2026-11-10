'use client';

import { FileText, Plus } from 'lucide-react';

import { ValeurPropriete, type ContexteVue } from '@/components/base/commun';
import { formaterValeur, proprietesDeVue, valeurDe } from '@/components/base/filtrage';
import type { Element } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Teinte déterministe (0-360) dérivée d'une chaîne, pour les couvertures. */
function teinteDe(source: string): number {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) % 360;
  return hash;
}

/** Vue en galerie : cartes avec couverture et propriétés visibles. */
export function VueGalerie({ ctx }: { ctx: ContexteVue }) {
  const proprietes = proprietesDeVue(ctx.base, ctx.vue);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {ctx.elements.map((element) => (
        <CarteGalerie key={element._id} ctx={ctx} element={element} proprietes={proprietes} />
      ))}

      <button
        type="button"
        onClick={() => ctx.creerElement()}
        disabled={!ctx.peutEditer}
        className={cn(
          'flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm texte-faible',
          ctx.peutEditer && 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
        )}
        style={{ borderColor: 'var(--bordure-forte)' }}
      >
        <Plus className="h-5 w-5" />
        Nouveau
      </button>
    </div>
  );
}

/** Carte de la vue galerie. */
function CarteGalerie({
  ctx,
  element,
  proprietes,
}: {
  ctx: ContexteVue;
  element: Element;
  proprietes: ReturnType<typeof proprietesDeVue>;
}) {
  const teinte = teinteDe(element.etiquette || element.titre);
  const initiale = (element.titre || '?').trim().charAt(0).toUpperCase();
  const resume = element.etiquette || formaterValeur(valeurDe(element, proprietes[0]?.nom || ''));

  return (
    <button
      type="button"
      onClick={() => ctx.ouvrirElement(element)}
      className="carte overflow-hidden text-left transition-shadow hover:shadow-md"
    >
      <div
        className="flex h-24 items-center justify-center"
        style={{
          background: `linear-gradient(135deg, hsl(${teinte} 70% 88%), hsl(${(teinte + 40) % 360} 70% 78%))`,
        }}
      >
        <span className="text-2xl font-semibold text-white/90 drop-shadow">{initiale}</span>
      </div>
      <div className="p-3">
        <p className="flex items-center gap-1.5 truncate font-medium">
          <FileText className="h-3.5 w-3.5 shrink-0 texte-faible" />
          {element.titre}
        </p>
        {resume && <p className="mt-0.5 truncate text-xs texte-doux">{resume}</p>}
        {proprietes.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {proprietes.slice(0, 3).map((propriete) => (
              <ValeurPropriete
                key={propriete.nom}
                propriete={propriete}
                valeur={valeurDe(element, propriete.nom)}
                className="text-xs"
              />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
