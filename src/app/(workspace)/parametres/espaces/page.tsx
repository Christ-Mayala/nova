'use client';

import { Building2, Lock, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Chargement, EtatVide } from '@/components/ui/Etats';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Modale } from '@/components/ui/Modale';
import { SelecteurIcone } from '@/components/ui/SelecteurIcone';
import { useToasts } from '@/components/ui/Toasts';
import { useConfirmation } from '@/components/ui/Confirmation';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { espaces as apiEspaces } from '@/lib/api';
import type { Espace, VisibiliteEspace } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

/** Libellés français des niveaux de visibilité d'un espace. */
const VISIBILITES: Array<{ valeur: VisibiliteEspace; libelle: string }> = [
  { valeur: 'ouvert', libelle: 'Ouvert' },
  { valeur: 'ferme', libelle: 'Fermé' },
  { valeur: 'prive', libelle: 'Privé' },
];

interface Brouillon {
  _id?: string;
  nom: string;
  icone: string;
  description: string;
  visibilite: VisibiliteEspace;
}

const BROUILLON_VIDE: Brouillon = {
  nom: '',
  icone: '🏢',
  description: '',
  visibilite: 'ouvert',
};

/** Gestion des espaces d'équipe (teamspaces) : création, édition, suppression. */
export default function PageParametresEspaces() {
  const { espaces, pages, chargement, workspaceActif, rafraichir } = useDonnees();
  const { estAdmin, utilisateur, rafraichirProfil } = useAuth();
  const toasts = useToasts();
  const confirmer = useConfirmation();

  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  /** Statistiques (pages, membres) par identifiant d'espace. */
  const statistiques = useMemo(() => {
    const table = new Map<string, { pages: number; membres: Set<string> }>();
    pages.forEach((page) => {
      const espaceId = identifiantDe(page.espaceId);
      if (!espaceId) return;
      const entree = table.get(espaceId) || { pages: 0, membres: new Set<string>() };
      entree.pages += 1;
      const auteur = identifiantDe(page.createdBy);
      if (auteur) entree.membres.add(auteur);
      table.set(espaceId, entree);
    });
    return table;
  }, [pages]);

  const ouvrirCreation = useCallback(() => {
    setBrouillon({ ...BROUILLON_VIDE });
  }, []);

  const ouvrirEdition = useCallback((espace: Espace) => {
    setBrouillon({
      _id: espace._id,
      nom: espace.nom,
      icone: espace.icone || '🏢',
      description: espace.description || '',
      visibilite: espace.visibilite || 'ouvert',
    });
  }, []);

  /** Enregistre le brouillon (création ou mise à jour). */
  const enregistrer = useCallback(async () => {
    if (!brouillon) return;
    if (brouillon._id && !estAdmin) {
      toasts.erreur('Action réservée aux administrateurs');
      return;
    }
    if (!brouillon._id && !workspaceActif) {
      toasts.erreur('Sélectionnez d’abord un espace de travail');
      return;
    }
    const nom = brouillon.nom.trim();
    if (!nom) {
      toasts.erreur('Le nom de l’espace est obligatoire');
      return;
    }
    setEnregistrement(true);
    try {
      const donnees: Partial<Espace> = {
        nom,
        icone: brouillon.icone,
        description: brouillon.description.trim(),
        visibilite: brouillon.visibilite,
      };
      if (brouillon._id) {
        await apiEspaces.maj(brouillon._id, donnees);
        toasts.succes('Espace mis à jour');
      } else {
        await apiEspaces.creer({
          ...donnees,
          ordre: espaces.length,
          workspaceId: workspaceActif?._id,
        });
        toasts.succes('Espace créé');
      }
      setBrouillon(null);
      // Un nouvel espace est rattaché au périmètre de son auteur côté serveur :
      // on recharge le profil (novaEspaceIds) puis les données pour le voir
      // apparaître sans rechargement de page.
      if (!brouillon._id) await rafraichirProfil();
      await rafraichir();
    } catch (e) {
      toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnregistrement(false);
    }
  }, [brouillon, estAdmin, workspaceActif, espaces.length, rafraichir, rafraichirProfil, toasts]);

  /** Supprime un espace après confirmation. */
  const supprimer = useCallback(
    async (espace: Espace) => {
      if (!estAdmin) {
        toasts.erreur('Action réservée aux administrateurs');
        return;
      }
      const ok = await confirmer({
        titre: `Supprimer « ${espace.nom} » ?`,
        message: 'Les pages de cet espace ne seront plus accessibles depuis la navigation.',
        libelleConfirmer: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
      try {
        await apiEspaces.supprimer(espace._id);
        toasts.succes('Espace supprimé');
        await rafraichir();
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [estAdmin, confirmer, rafraichir, toasts]
  );

  if (chargement) return <Chargement libelle="Chargement des espaces…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Espaces d’équipe</h1>
        <span className="etiquette" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          {espaces.length}
        </span>
        <button
          type="button"
          onClick={ouvrirCreation}
          className="bouton bouton-primaire ml-auto gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nouvel espace
        </button>
      </div>

      {espaces.length === 0 ? (
        <EtatVide
          icone={Building2}
          titre="Aucun espace d’équipe"
          description="Regroupez les pages et les bases par équipe ou par projet."
          action={
            <button
              type="button"
              onClick={ouvrirCreation}
              className="bouton bouton-primaire gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Créer un espace
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {espaces.map((espace) => {
            const stats = statistiques.get(espace._id);
            return (
              <li
                key={espace._id}
                className="carte group flex items-center gap-3 p-3.5"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'var(--fond-secondaire)' }}
                >
                  <IconeDonnee icone={espace.icone} repli={Building2} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{espace.nom}</p>
                    <BadgeVisibilite visibilite={espace.visibilite || 'ouvert'} />
                  </div>
                  {espace.description && (
                    <p className="mt-0.5 truncate text-sm texte-doux">{espace.description}</p>
                  )}
                </div>
                <div className="hidden shrink-0 items-center gap-4 text-xs texte-faible sm:flex">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {stats?.membres.size ?? (utilisateur ? 1 : 0)}
                  </span>
                  <span>{stats?.pages ?? 0} page(s)</span>
                </div>
                {estAdmin && (
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => ouvrirEdition(espace)}
                      className="bouton p-1.5"
                      aria-label="Modifier l’espace"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => supprimer(espace)}
                      className="bouton p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      aria-label="Supprimer l’espace"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modale
        ouvert={Boolean(brouillon)}
        onFermer={() => setBrouillon(null)}
        titre={brouillon?._id ? 'Modifier l’espace' : 'Nouvel espace d’équipe'}
        description="Les espaces regroupent les pages et les bases d’une équipe ou d’un projet."
        pied={
          <>
            <button type="button" className="bouton" onClick={() => setBrouillon(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="bouton bouton-primaire"
              onClick={enregistrer}
              disabled={enregistrement}
            >
              {brouillon?._id ? 'Enregistrer' : 'Créer'}
            </button>
          </>
        }
      >
        {brouillon && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <SelecteurIcone
                valeur={brouillon.icone}
                onChange={(emoji) => setBrouillon((b) => (b ? { ...b, icone: emoji } : b))}
                taille="grande"
              />
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-medium texte-doux">Nom</span>
                <input
                  className="champ"
                  autoFocus
                  value={brouillon.nom}
                  placeholder="Nom de l’espace"
                  onChange={(e) => setBrouillon((b) => (b ? { ...b, nom: e.target.value } : b))}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Description</span>
              <textarea
                className="champ min-h-[72px] resize-y"
                value={brouillon.description}
                placeholder="À quoi sert cet espace ?"
                onChange={(e) => setBrouillon((b) => (b ? { ...b, description: e.target.value } : b))}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium texte-doux">Visibilité</span>
              <div className="flex flex-wrap gap-2">
                {VISIBILITES.map((option) => (
                  <button
                    key={option.valeur}
                    type="button"
                    onClick={() => setBrouillon((b) => (b ? { ...b, visibilite: option.valeur } : b))}
                    className={cn(
                      'etiquette px-3 py-1.5 transition-colors',
                      brouillon.visibilite === option.valeur
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'texte-doux'
                    )}
                    style={
                      brouillon.visibilite === option.valeur
                        ? undefined
                        : { backgroundColor: 'var(--fond-secondaire)' }
                    }
                  >
                    {option.libelle}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modale>
    </div>
  );
}

/** Pastille de visibilité d'un espace. */
function BadgeVisibilite({ visibilite }: { visibilite: VisibiliteEspace }) {
  const libelle = VISIBILITES.find((v) => v.valeur === visibilite)?.libelle || 'Ouvert';
  const prive = visibilite === 'prive';
  return (
    <span
      className={cn(
        'etiquette inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px]',
        prive
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
          : 'texte-doux'
      )}
      style={prive ? undefined : { backgroundColor: 'var(--fond-secondaire)' }}
    >
      {prive && <Lock className="h-3 w-3" />}
      {libelle}
    </span>
  );
}
