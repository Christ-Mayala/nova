'use client';

import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { type ContexteVue } from '@/components/base/commun';
import {
  OPERATEURS,
  familleOperateurs,
  formaterValeur,
  normaliserNom,
  proprietesDisponibles,
  proprietesDeVue,
} from '@/components/base/filtrage';
import { Bascule } from '@/components/ui/Bascule';
import { MenuElement } from '@/components/ui/Menu';
import { iconeParTypePropriete, libelleTypePropriete } from '@/lib/icones';
import type { FiltreVue, ProprieteBase, TriVue, TypePropriete } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Panneau « Filtrer » : conditions combinées en ET sur la vue active. */
export function PanneauFiltres({ ctx }: { ctx: ContexteVue }) {
  const proprietes = proprietesDisponibles(ctx.base);
  const filtres = ctx.vue.filtres || [];

  function majFiltres(suivants: FiltreVue[]) {
    ctx.majVue({ filtres: suivants });
  }

  function ajouter() {
    const premiere = proprietes[0];
    if (!premiere) return;
    const famille = familleOperateurs(premiere.type);
    const operateur = OPERATEURS[famille][0].valeur;
    majFiltres([...filtres, { propriete: premiere.nom, operateur, valeur: '' }]);
  }

  return (
    <div className="flex w-80 flex-col gap-2 p-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium texte-faible">Filtrer</span>
        <button type="button" className="bouton text-xs" onClick={ajouter} disabled={!ctx.peutEditer}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>

      {filtres.length === 0 && <p className="px-1 py-2 text-sm texte-faible">Aucun filtre.</p>}

      {filtres.map((filtre, index) => {
        const propriete = proprietes.find((p) => normaliserNom(p.nom) === normaliserNom(filtre.propriete));
        const famille = familleOperateurs(propriete?.type);
        const sansValeur = ['est_vide', 'nest_pas_vide', 'est_coche', 'nest_pas_coche'].includes(filtre.operateur);

        function remplacer(patch: Partial<FiltreVue>) {
          majFiltres(filtres.map((f, i) => (i === index ? { ...f, ...patch } : f)));
        }

        return (
          <div key={index} className="flex flex-col gap-1 rounded p-1" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
            <div className="flex items-center gap-1">
              <select
                className="champ py-1 text-xs"
                value={filtre.propriete}
                onChange={(e) => remplacer({ propriete: e.target.value })}
                disabled={!ctx.peutEditer}
              >
                {proprietes.map((p) => (
                  <option key={p.nom} value={p.nom}>
                    {p.nom}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => majFiltres(filtres.filter((_, i) => i !== index))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Retirer le filtre"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <select
                className="champ py-1 text-xs"
                value={filtre.operateur}
                onChange={(e) => remplacer({ operateur: e.target.value })}
                disabled={!ctx.peutEditer}
              >
                {OPERATEURS[famille].map((operateur) => (
                  <option key={operateur.valeur} value={operateur.valeur}>
                    {operateur.libelle}
                  </option>
                ))}
              </select>
              {!sansValeur && (
                <input
                  className="champ py-1 text-xs"
                  type={famille === 'nombre' ? 'number' : famille === 'date' ? 'date' : 'text'}
                  value={formaterValeur(filtre.valeur)}
                  onChange={(e) => remplacer({ valeur: e.target.value })}
                  disabled={!ctx.peutEditer}
                  placeholder="Valeur"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Panneau « Trier » : tris successifs appliqués à la vue active. */
export function PanneauTris({ ctx }: { ctx: ContexteVue }) {
  const proprietes = proprietesDisponibles(ctx.base);
  const tris = ctx.vue.tris || [];

  function majTris(suivants: TriVue[]) {
    ctx.majVue({ tris: suivants });
  }

  function ajouter() {
    const premiere = proprietes[0];
    if (!premiere) return;
    majTris([...tris, { propriete: premiere.nom, direction: 'asc' }]);
  }

  return (
    <div className="flex w-72 flex-col gap-2 p-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium texte-faible">Trier</span>
        <button type="button" className="bouton text-xs" onClick={ajouter} disabled={!ctx.peutEditer}>
          <Plus className="h-3.5 w-3.5" />
          Ajouter
        </button>
      </div>

      {tris.length === 0 && <p className="px-1 py-2 text-sm texte-faible">Aucun tri.</p>}

      {tris.map((tri, index) => (
        <div key={index} className="flex items-center gap-1">
          <select
            className="champ py-1 text-xs"
            value={tri.propriete}
            onChange={(e) => majTris(tris.map((t, i) => (i === index ? { ...t, propriete: e.target.value } : t)))}
            disabled={!ctx.peutEditer}
          >
            {proprietes.map((p) => (
              <option key={p.nom} value={p.nom}>
                {p.nom}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="bouton shrink-0 px-1.5 py-1"
            onClick={() =>
              majTris(
                tris.map((t, i) => (i === index ? { ...t, direction: t.direction === 'asc' ? 'desc' : 'asc' } : t))
              )
            }
            disabled={!ctx.peutEditer}
            title={tri.direction === 'asc' ? 'Croissant' : 'Décroissant'}
            aria-label="Changer le sens du tri"
          >
            {tri.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => majTris(tris.filter((_, i) => i !== index))}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Retirer le tri"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Panneau « Grouper » : propriété de regroupement de la vue active. */
export function PanneauGroupes({ ctx }: { ctx: ContexteVue }) {
  const proprietes = proprietesDisponibles(ctx.base).filter(
    (p) => p.type === 'selection' || p.type === 'statut' || p.type === 'selection_multiple'
  );
  const actuelle = ctx.vue.groupes?.[0]?.propriete || '';

  return (
    <div className="flex w-64 flex-col gap-1 p-1">
      <span className="px-1 text-xs font-medium texte-faible">Grouper par</span>
      <MenuElement actif={!actuelle} onClick={() => ctx.majVue({ groupes: [] })}>
        Aucun
      </MenuElement>
      {proprietes.map((propriete) => (
        <MenuElement
          key={propriete.nom}
          actif={normaliserNom(propriete.nom) === normaliserNom(actuelle)}
          onClick={() => ctx.majVue({ groupes: [{ propriete: propriete.nom }] })}
        >
          {propriete.nom}
        </MenuElement>
      ))}
      {proprietes.length === 0 && (
        <p className="px-1 py-1 text-xs texte-faible">Aucune propriété compatible.</p>
      )}
    </div>
  );
}

/** Panneau « Affichage » : choix des propriétés visibles dans la vue active. */
export function PanneauAffichage({ ctx }: { ctx: ContexteVue }) {
  const toutes = proprietesDisponibles(ctx.base).filter((p) => p.type !== 'titre');
  const visibles = new Set(proprietesDeVue(ctx.base, ctx.vue).map((p) => p.nom));

  function basculer(nom: string, actif: boolean) {
    const suivantes = actif
      ? [...toutes.filter((p) => visibles.has(p.nom)).map((p) => p.nom), nom]
      : toutes.filter((p) => visibles.has(p.nom) && p.nom !== nom).map((p) => p.nom);
    ctx.majVue({ proprietesVisibles: suivantes });
  }

  return (
    <div className="flex w-64 flex-col gap-1 p-1">
      <span className="px-1 text-xs font-medium texte-faible">Propriétés affichées</span>
      {toutes.map((propriete) => {
        const Icone = iconeParTypePropriete[propriete.type];
        return (
          <div key={propriete.nom} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
            <Icone className="h-3.5 w-3.5 shrink-0 texte-doux" />
            <span className="min-w-0 flex-1 truncate text-sm">{propriete.nom}</span>
            <Bascule
              actif={visibles.has(propriete.nom)}
              onChange={(actif) => basculer(propriete.nom, actif)}
              desactive={!ctx.peutEditer}
              libelle={`Afficher ${propriete.nom}`}
            />
          </div>
        );
      })}
      {toutes.length === 0 && <p className="px-1 py-1 text-xs texte-faible">Aucune propriété.</p>}
    </div>
  );
}

/** Panneau de gestion des propriétés de la base (ajout / suppression). */
export function PanneauProprietes({
  ctx,
  onAjouter,
  onSupprimer,
}: {
  ctx: ContexteVue;
  onAjouter: (nom: string, type: TypePropriete) => void;
  onSupprimer: (nom: string) => void;
}) {
  const [nom, setNom] = useState('');
  const [type, setType] = useState<TypePropriete>('texte');
  const typesDisponibles = (Object.keys(libelleTypePropriete) as TypePropriete[]).filter(
    (t) => t !== 'titre' && t !== 'cree_le' && t !== 'cree_par'
  );

  return (
    <div className="flex w-72 flex-col gap-2 p-1">
      <span className="px-1 text-xs font-medium texte-faible">Propriétés de la base</span>

      <div className="flex flex-col gap-1">
        {(ctx.base.proprietes || []).map((propriete) => (
          <div key={propriete.nom} className="flex items-center gap-2 rounded px-2 py-1">
            {(() => {
              const Icone = iconeParTypePropriete[propriete.type];
              return <Icone className="h-3.5 w-3.5 shrink-0 texte-doux" />;
            })()}
            <span className="min-w-0 flex-1 truncate text-sm">{propriete.nom}</span>
            <span className="text-xs texte-faible">{libelleTypePropriete[propriete.type]}</span>
            <button
              type="button"
              onClick={() => onSupprimer(propriete.nom)}
              disabled={!ctx.peutEditer}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={`Supprimer ${propriete.nom}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--bordure)' }}>
        <input
          className="champ text-xs"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom de la propriété"
          disabled={!ctx.peutEditer}
        />
        <select
          className="champ text-xs"
          value={type}
          onChange={(e) => setType(e.target.value as TypePropriete)}
          disabled={!ctx.peutEditer}
        >
          {typesDisponibles.map((t) => (
            <option key={t} value={t}>
              {libelleTypePropriete[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={cn('bouton bouton-primaire text-xs')}
          disabled={!ctx.peutEditer || !nom.trim()}
          onClick={() => {
            onAjouter(nom.trim(), type);
            setNom('');
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter la propriété
        </button>
      </div>
    </div>
  );
}
