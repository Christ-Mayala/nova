'use client';

import { Building, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { Chargement, EtatVide } from '@/components/ui/Etats';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Modale } from '@/components/ui/Modale';
import { SelecteurIcone } from '@/components/ui/SelecteurIcone';
import { useConfirmation } from '@/components/ui/Confirmation';
import { useToasts } from '@/components/ui/Toasts';
import { useDonnees } from '@/context/DonneesContext';
import { workspaces as apiWorkspaces } from '@/lib/api';
import { ROUTES } from '@/lib/navigation';
import type { Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Nombre maximal d'espaces de travail par utilisateur (façon Notion). */
const MAX_WORKSPACES_PAR_UTILISATEUR = 5;

interface Brouillon {
  _id?: string;
  nom: string;
  icone: string;
  description: string;
}

const BROUILLON_VIDE: Brouillon = {
  nom: '',
  icone: '🏠',
  description: '',
};

/** Gestion des espaces de travail : création (5 maximum), édition, suppression. */
export default function PageParametresEspacesTravail() {
  const { workspaces, workspaceActif, changerWorkspace, chargement, rafraichir } = useDonnees();
  const toasts = useToasts();
  const confirmer = useConfirmation();
  const router = useRouter();

  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const limiteAtteinte = workspaces.length >= MAX_WORKSPACES_PAR_UTILISATEUR;

  /**
   * Active un espace de travail puis ramène à l'accueil : le contenu affiché
   * (espaces d'équipe, pages) devient celui — vide au départ — de l'espace
   * choisi, sans rester sur une page incohérente.
   */
  const ouvrir = useCallback(
    (id: string) => {
      changerWorkspace(id);
      router.push(ROUTES.accueil);
    },
    [changerWorkspace, router]
  );

  const ouvrirCreation = useCallback(() => {
    if (limiteAtteinte) {
      toasts.erreur(`Limite de ${MAX_WORKSPACES_PAR_UTILISATEUR} espaces de travail atteinte`);
      return;
    }
    setBrouillon({ ...BROUILLON_VIDE });
  }, [limiteAtteinte, toasts]);

  const ouvrirEdition = useCallback((workspace: Workspace) => {
    setBrouillon({
      _id: workspace._id,
      nom: workspace.nom,
      icone: workspace.icone || '🏠',
      description: workspace.description || '',
    });
  }, []);

  /** Enregistre le brouillon (création ou mise à jour). */
  const enregistrer = useCallback(async () => {
    if (!brouillon) return;
    if (!brouillon._id && limiteAtteinte) {
      toasts.erreur(`Limite de ${MAX_WORKSPACES_PAR_UTILISATEUR} espaces de travail atteinte`);
      return;
    }
    const nom = brouillon.nom.trim();
    if (!nom) {
      toasts.erreur('Le nom de l’espace de travail est obligatoire');
      return;
    }
    setEnregistrement(true);
    try {
      const donnees: Partial<Workspace> = {
        nom,
        icone: brouillon.icone,
        description: brouillon.description.trim(),
      };
      if (brouillon._id) {
        await apiWorkspaces.maj(brouillon._id, donnees);
        toasts.succes('Espace de travail mis à jour');
        setBrouillon(null);
        await rafraichir();
      } else {
        const cree = await apiWorkspaces.creer({ ...donnees, ordre: workspaces.length });
        setBrouillon(null);
        await rafraichir();
        toasts.succes('Espace de travail créé', 'Il est vide : commencez par y créer une page ou un espace d’équipe.');
        // Bascule vers le nouvel espace (vide) et retour à l'accueil.
        ouvrir(cree._id);
      }
    } catch (e) {
      toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnregistrement(false);
    }
  }, [brouillon, limiteAtteinte, workspaces.length, ouvrir, rafraichir, toasts]);

  /** Supprime un espace de travail après confirmation. */
  const supprimer = useCallback(
    async (workspace: Workspace) => {
      const ok = await confirmer({
        titre: `Supprimer « ${workspace.nom} » ?`,
        message:
          'Les pages de cet espace de travail ne seront plus accessibles depuis la navigation.',
        libelleConfirmer: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
      try {
        await apiWorkspaces.supprimer(workspace._id);
        toasts.succes('Espace de travail supprimé');
        await rafraichir();
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [confirmer, rafraichir, toasts]
  );

  if (chargement) return <Chargement libelle="Chargement des espaces de travail…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Building className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Espaces de travail</h1>
        <span className="etiquette" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          {workspaces.length}/{MAX_WORKSPACES_PAR_UTILISATEUR}
        </span>
        <button
          type="button"
          onClick={ouvrirCreation}
          disabled={limiteAtteinte}
          className="bouton bouton-primaire ml-auto gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Nouvel espace de travail
        </button>
      </div>

      {workspaces.length === 0 ? (
        <EtatVide
          icone={Building}
          titre="Aucun espace de travail"
          description="Un espace de travail rassemble vos espaces d’équipe et vos pages (5 maximum)."
          action={
            <button
              type="button"
              onClick={ouvrirCreation}
              disabled={limiteAtteinte}
              className="bouton bouton-primaire gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Créer un espace de travail
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {workspaces.map((workspace) => {
            const actif = workspaceActif?._id === workspace._id;
            return (
              <li key={workspace._id} className="carte group flex items-center gap-3 p-3.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'var(--fond-secondaire)' }}
                >
                  <IconeDonnee icone={workspace.icone} repli={Building} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{workspace.nom}</p>
                    {actif && (
                      <span className="etiquette inline-flex items-center gap-1 bg-sky-100 px-1.5 py-0.5 text-[11px] text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                        <Check className="h-3 w-3" />
                        Actif
                      </span>
                    )}
                  </div>
                  {workspace.description && (
                    <p className="mt-0.5 truncate text-sm texte-doux">{workspace.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => ouvrir(workspace._id)}
                    disabled={actif}
                    className={cn('bouton text-xs', actif && 'opacity-50')}
                  >
                    {actif ? 'Sélectionné' : 'Ouvrir'}
                  </button>
                  <button
                    type="button"
                    onClick={() => ouvrirEdition(workspace)}
                    className="bouton p-1.5"
                    aria-label="Modifier l’espace de travail"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => supprimer(workspace)}
                    className="bouton p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    aria-label="Supprimer l’espace de travail"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modale
        ouvert={Boolean(brouillon)}
        onFermer={() => setBrouillon(null)}
        titre={brouillon?._id ? 'Modifier l’espace de travail' : 'Nouvel espace de travail'}
        description="Chaque espace de travail possède ses propres espaces d’équipe et pages."
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
                  placeholder="Nom de l’espace de travail"
                  onChange={(e) => setBrouillon((b) => (b ? { ...b, nom: e.target.value } : b))}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Description</span>
              <textarea
                className="champ min-h-[72px] resize-y"
                value={brouillon.description}
                placeholder="À quoi sert cet espace de travail ?"
                onChange={(e) =>
                  setBrouillon((b) => (b ? { ...b, description: e.target.value } : b))
                }
              />
            </label>
          </div>
        )}
      </Modale>
    </div>
  );
}
