'use client';

import { ChevronDown, Copy, PenLine, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Menu, MenuElement, MenuSeparateur } from '@/components/ui/Menu';
import { iconeParTypeVue, libelleTypeVue } from '@/lib/icones';
import type { TypeVue, VueBase as VueBaseDef } from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPES_VUE: TypeVue[] = ['tableau', 'kanban', 'galerie', 'liste', 'calendrier', 'chronologie'];

/** Onglets des vues d'une base + création et gestion des vues. */
export function BarreVues({
  vues,
  indexActif,
  peutEditer,
  onChanger,
  onAjouter,
  onRenommer,
  onDupliquer,
  onSupprimer,
}: {
  vues: VueBaseDef[];
  indexActif: number;
  peutEditer: boolean;
  onChanger: (index: number) => void;
  onAjouter: (type: TypeVue) => void;
  onRenommer: (index: number, nom: string) => void;
  onDupliquer: (index: number) => void;
  onSupprimer: (index: number) => void;
}) {
  const [renommage, setRenommage] = useState<number | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      {vues.map((vue, index) => {
        const Icone = iconeParTypeVue[vue.type];
        const actif = index === indexActif;

        if (renommage === index) {
          return (
            <input
              key={`renommage-${index}`}
              autoFocus
              defaultValue={vue.nom}
              onBlur={(e) => {
                onRenommer(index, e.target.value.trim() || vue.nom);
                setRenommage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setRenommage(null);
              }}
              className="champ w-32 py-1 text-sm"
            />
          );
        }

        return (
          <div key={`vue-${index}`} className="flex items-center">
            <button
              type="button"
              onClick={() => onChanger(index)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1 text-sm',
                actif ? 'bg-black/[0.06] font-medium dark:bg-white/[0.08]' : 'texte-doux hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
              )}
            >
              <Icone className="h-3.5 w-3.5 shrink-0" />
              {vue.nom}
            </button>

            {actif && (
              <Menu
                alignement="droite"
                declencheur={
                  <button
                    type="button"
                    className="flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Options de la vue"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                }
              >
                <MenuElement icone={PenLine} onClick={() => setRenommage(index)}>
                  Renommer
                </MenuElement>
                <MenuElement icone={Copy} onClick={() => onDupliquer(index)}>
                  Dupliquer la vue
                </MenuElement>
                <MenuSeparateur />
                <MenuElement
                  icone={Trash2}
                  danger
                  onClick={() => {
                    if (vues.length > 1) onSupprimer(index);
                  }}
                >
                  Supprimer la vue
                </MenuElement>
              </Menu>
            )}
          </div>
        );
      })}

      <Menu
        alignement="gauche"
        largeur="w-56"
        declencheur={
          <button
            type="button"
            disabled={!peutEditer}
            className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Ajouter une vue"
          >
            <Plus className="h-4 w-4" />
          </button>
        }
      >
        {TYPES_VUE.map((type) => {
          const Icone = iconeParTypeVue[type];
          return (
            <MenuElement key={type} icone={Icone} onClick={() => onAjouter(type)}>
              {libelleTypeVue[type]}
            </MenuElement>
          );
        })}
      </Menu>
    </div>
  );
}
