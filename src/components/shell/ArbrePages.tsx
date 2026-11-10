'use client';

import { ChevronRight, MoreHorizontal, Plus, Star, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { useConfirmation } from '@/components/ui/Confirmation';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { InfoBulles } from '@/components/ui/InfoBulles';
import { Menu, MenuElement, MenuSeparateur } from '@/components/ui/Menu';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees, type FiltrePages } from '@/context/DonneesContext';
import { favoris as apiFavoris, pages as apiPages } from '@/lib/api';
import { lienPage, ROUTES } from '@/lib/navigation';
import type { Page } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

/**
 * Arbre récursif des pages (racines si `parentId` est nul).
 * Le filtre optionnel restreint l'arbre à un espace ou à une section donnée.
 */
export function ArbrePages({
  parentId = null,
  filtre,
}: {
  parentId?: string | null;
  filtre?: FiltrePages;
}) {
  const { enfantsDe } = useDonnees();
  const enfants = enfantsDe(parentId, filtre);
  if (enfants.length === 0) return null;
  return (
    <ul className="flex flex-col gap-px">
      {enfants.map((page) => (
        <NoeudPage key={page._id} page={page} filtre={filtre} />
      ))}
    </ul>
  );
}

/** Un nœud de l'arbre : lien, repli/dépli et actions contextuelles. */
function NoeudPage({ page, filtre }: { page: Page; filtre?: FiltrePages }) {
  const { enfantsDe, rafraichir, estFavori, favoris } = useDonnees();
  const { peutEditer } = useAuth();
  const toasts = useToasts();
  const confirmer = useConfirmation();
  const router = useRouter();
  const chemin = usePathname();
  const url = lienPage(page);
  const enfant = enfantsDe(page._id, filtre);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState(false);

  const actif = chemin === url;
  const favori = estFavori(page._id);

  async function ajouterSousPage() {
    if (!peutEditer) {
      toasts.erreur('Connexion requise', 'Reconnectez-vous pour continuer.');
      return;
    }
    setEnCours(true);
    try {
      await apiPages.creer({
        titre: 'Sans titre',
        parentId: page._id,
        espaceId: identifiantDe(page.espaceId) || undefined,
        workspaceId: identifiantDe(page.workspaceId) || undefined,
        section: page.section,
      });
      await rafraichir();
      setOuvert(true);
      toasts.succes('Sous-page créée');
    } catch (e) {
      toasts.erreur('Création impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(false);
    }
  }

  async function basculerFavori() {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    try {
      const existant = favoris.find((f) => identifiantDe(f.pageId) === page._id);
      if (existant) {
        await apiFavoris.supprimer(existant._id);
      } else {
        await apiFavoris.creer({
          pageId: page._id,
          espaceId: identifiantDe(page.espaceId) || undefined,
          ordre: favoris.length,
        });
      }
      await rafraichir();
    } catch (e) {
      toasts.erreur('Action impossible', e instanceof Error ? e.message : undefined);
    }
  }

  async function supprimerPage() {
    if (suppression) return;
    if (!peutEditer) {
      toasts.erreur('Connexion requise', 'Reconnectez-vous pour continuer.');
      return;
    }
    const ok = await confirmer({
      titre: `Déplacer « ${page.titre} » vers la corbeille ?`,
      message: 'La page et ses sous-pages pourront être restaurées depuis la corbeille.',
      libelleConfirmer: 'Déplacer vers la corbeille',
      danger: true,
    });
    if (!ok) return;
    const etaitOuverte = chemin === url;
    setSuppression(true);
    try {
      await apiPages.supprimer(page._id);
      await rafraichir();
      toasts.succes('Page déplacée vers la corbeille', page.titre);
      if (etaitOuverte) router.push(ROUTES.accueil);
    } catch (e) {
      toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setSuppression(false);
    }
  }

  return (
    <li>
      <div
        className={cn('group/noeud flex items-center rounded pr-1', actif && 'lien-barre-actif')}
        style={actif ? { backgroundColor: 'var(--survol)' } : undefined}
      >
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className={cn(
            'flex h-6 w-5 shrink-0 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10',
            enfant.length === 0 && 'invisible'
          )}
          aria-label={ouvert ? 'Replier' : 'Déplier'}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', ouvert && 'rotate-90')} />
        </button>

        <Link href={url} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-sm">
          <IconeDonnee icone={page.icone} className="h-3.5 w-3.5 shrink-0 texte-doux" />
          <span className={cn('truncate', actif ? 'font-medium' : 'texte-doux')}>{page.titre}</span>
        </Link>

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/noeud:opacity-100">
          {favori && <Star className="mr-0.5 h-3 w-3 text-amber-500" />}
          <InfoBulles contenu="Ajouter une sous-page">
            <button
              type="button"
              onClick={ajouterSousPage}
              disabled={enCours}
              className="flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Ajouter une sous-page"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </InfoBulles>
          {peutEditer && (
            <InfoBulles contenu="Déplacer vers la corbeille">
              <button
                type="button"
                onClick={supprimerPage}
                disabled={suppression}
                className="flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                aria-label={`Déplacer la page ${page.titre} vers la corbeille`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </InfoBulles>
          )}
          <Menu
            alignement="droite"
            declencheur={
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Autres actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            }
          >
            <MenuElement icone={Star} onClick={basculerFavori}>
              {favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </MenuElement>
            <MenuElement icone={Plus} onClick={ajouterSousPage}>
              Ajouter une sous-page
            </MenuElement>
            <MenuSeparateur />
            <MenuElement
              onClick={() => {
                window.open(url, '_blank');
              }}
            >
              Ouvrir dans un nouvel onglet
            </MenuElement>
            <MenuSeparateur />
            <MenuElement icone={Trash2} danger disabled={suppression} onClick={supprimerPage}>
              Déplacer vers la corbeille
            </MenuElement>
          </Menu>
        </div>
      </div>

      {ouvert && enfant.length > 0 && (
        <div className="ml-4 border-l pl-1" style={{ borderColor: 'var(--bordure)' }}>
          <ArbrePages parentId={page._id} filtre={filtre} />
        </div>
      )}
    </li>
  );
}
