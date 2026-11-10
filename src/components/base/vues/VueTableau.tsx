'use client';

import { MoreHorizontal, Plus, Trash2 } from 'lucide-react';

import { CellulePropriete, type ContexteVue } from '@/components/base/commun';
import { proprietesDeVue } from '@/components/base/filtrage';
import { Menu, MenuElement } from '@/components/ui/Menu';
import { cn } from '@/lib/utils';

/** Vue en tableau : une ligne par élément, une colonne par propriété visible. */
export function VueTableau({ ctx }: { ctx: ContexteVue }) {
  const proprietes = proprietesDeVue(ctx.base, ctx.vue);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--bordure)' }}>
            <th className="sticky left-0 z-10 min-w-[240px] bg-[color:var(--fond)] px-2 py-1.5 text-left font-medium texte-doux">
              Titre
            </th>
            {proprietes.map((propriete) => (
              <th
                key={propriete.nom}
                className="min-w-[150px] px-2 py-1.5 text-left font-medium texte-doux"
              >
                {propriete.nom}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {ctx.elements.map((element) => (
            <tr
              key={element._id}
              className="group/ligne border-b hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
              style={{ borderColor: 'var(--bordure)' }}
            >
              <td className="sticky left-0 z-10 bg-[color:var(--fond)] px-1 py-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => ctx.ouvrirElement(element)}
                    className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    {element.titre}
                  </button>
                </div>
              </td>
              {proprietes.map((propriete) => (
                <td key={propriete.nom} className="px-1.5 py-1 align-middle">
                  <CellulePropriete ctx={ctx} element={element} propriete={propriete} />
                </td>
              ))}
              <td className="px-1 py-1 align-middle">
                {ctx.peutEditer && (
                  <div className="opacity-0 transition-opacity group-hover/ligne:opacity-100">
                    <Menu
                      alignement="droite"
                      declencheur={
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                          aria-label="Actions de la ligne"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      }
                    >
                      <MenuElement onClick={() => ctx.ouvrirElement(element)}>Ouvrir</MenuElement>
                      <MenuElement icone={Trash2} danger onClick={() => ctx.supprimerElement(element._id)}>
                        Supprimer
                      </MenuElement>
                    </Menu>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => ctx.creerElement()}
        disabled={!ctx.peutEditer}
        className={cn(
          'mt-1 flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm texte-faible',
          ctx.peutEditer && 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        )}
      >
        <Plus className="h-4 w-4" />
        Nouveau
      </button>
    </div>
  );
}
