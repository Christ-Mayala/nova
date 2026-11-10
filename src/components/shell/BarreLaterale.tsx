'use client';

import {
  Building2,
  CalendarDays,
  ChevronsLeft,
  Download,
  ChevronsRight,
  ChevronsUpDown,
  FilePlus2,
  Home,
  Inbox,
  LayoutTemplate,
  ListChecks,
  Lock,
  MessagesSquare,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ArbrePages } from '@/components/shell/ArbrePages';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { InfoBulles } from '@/components/ui/InfoBulles';
import { Menu, MenuElement, MenuSeparateur, MenuTitre } from '@/components/ui/Menu';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { useInterface } from '@/context/InterfaceContext';
import { useLangue } from '@/context/LangueContext';
import { pages as apiPages } from '@/lib/api';
import { ROUTES, lienPage } from '@/lib/navigation';
import { consigneInstallation, estStandalone, lancerInstallation } from '@/lib/pwa';
import type { Espace } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Barre latérale principale : navigation, favoris, espaces, pages privées/partagées. */
export function BarreLaterale() {
  const {
    barreMobileOuverte,
    fermerBarreMobile,
    barreRepliee,
    basculerBarreRepliee,
    largeurBarre,
    definirLargeurBarre,
  } = useInterface();
  const { espaces, workspaceActif, rafraichir } = useDonnees();
  const { peutEditer } = useAuth();
  const { t } = useLangue();
  const toasts = useToasts();
  const chemin = usePathname();
  const router = useRouter();
  const [redimension, setRedimension] = useState(false);
  const [installe, setInstalle] = useState(false);
  const refBarre = useRef<HTMLElement>(null);

  useEffect(() => {
    setInstalle(estStandalone());
  }, []);

  // Écouter l'événement appinstalled pour masquer le bouton après installation
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      setInstalle(true);
    };
    window.addEventListener('appinstalled', handler);
    return () => {
      window.removeEventListener('appinstalled', handler);
    };
  }, []);

  const installerNova = useCallback(async () => {
    fermerBarreMobile();
    const resultat = await lancerInstallation();
    if (resultat === 'indisponible') {
      toasts.info('Installer NOVA', consigneInstallation());
    }
  }, [fermerBarreMobile, toasts]);

  // Redimensionnement par glissement de la poignée verticale.
  const debutRedimension = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setRedimension(true);
    },
    []
  );

  useEffect(() => {
    if (!redimension) return;
    const surDeplacement = (e: MouseEvent) => {
      const gauche = refBarre.current?.getBoundingClientRect().left ?? 0;
      definirLargeurBarre(e.clientX - gauche);
    };
    const surRelachement = () => setRedimension(false);
    document.addEventListener('mousemove', surDeplacement);
    document.addEventListener('mouseup', surRelachement);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', surDeplacement);
      document.removeEventListener('mouseup', surRelachement);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [redimension, definirLargeurBarre]);

  async function nouvellePage() {
    if (!peutEditer) {
      toasts.erreur(t('barre.connexionRequise'), t('barre.reconnectez'));
      return;
    }
    const premierEspace = espaces[0];
    try {
      const page = await apiPages.creer({
        titre: t('barre.sansTitre'),
        espaceId: premierEspace?._id,
        workspaceId: workspaceActif?._id,
        section: 'prive',
        ordre: 0,
      });
      await rafraichir();
      router.push(lienPage(page));
    } catch (e) {
      toasts.erreur(t('barre.creationImpossible'), e instanceof Error ? e.message : undefined);
    }
  }

  const contenu = (
    <div className="flex h-full min-h-0 flex-col">
      {/* En-tête : identité de l'espace de travail + nouvelle page */}
      <div className="flex shrink-0 items-center gap-1 px-2 pb-1 pt-2">
        <EspaceTravailActif />
        <div className="ml-auto flex items-center gap-0.5">
          <InfoBulles contenu={t('barre.nouvellePage')}>
            <button
              type="button"
              onClick={nouvellePage}
              className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={t('barre.nouvellePage')}
            >
              <FilePlus2 className="h-4 w-4" />
            </button>
          </InfoBulles>
          <InfoBulles contenu={barreRepliee ? t('barre.deplierBarre') : t('barre.replierBarre')}>
            <button
              type="button"
              onClick={basculerBarreRepliee}
              className="hidden h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 lg:flex dark:hover:bg-white/10"
              aria-label={t('barre.replierBarreLaterale')}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </InfoBulles>
        </div>
      </div>

      {/* Zone défilante : navigation, favoris, espaces d'équipe et pages.
          Un seul conteneur scrollable maximise l'espace utile du menu. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 defilement-fin">
        {/* Navigation principale */}
        <div className="flex flex-col gap-px">
          <TitreGroupe>{t('nav.groupeTravail')}</TitreGroupe>
          <LienBarre
            href={ROUTES.accueil}
            icone={Home}
            libelle={t('nav.accueil')}
            actif={chemin === ROUTES.accueil}
            onClick={fermerBarreMobile}
          />
          <LienBarre
            href={ROUTES.recherche}
            icone={Search}
            libelle={t('nav.rechercher')}
            raccourci="⌘K"
            actif={chemin === ROUTES.recherche}
            onClick={fermerBarreMobile}
          />
          <LienBarre
            href={ROUTES.inbox}
            icone={Inbox}
            libelle={t('nav.inbox')}
            actif={chemin.startsWith(ROUTES.inbox)}
            onClick={fermerBarreMobile}
            compteur={<CompteurNotifications />}
          />
          <LienBarre
            href={ROUTES.messagerie}
            icone={MessagesSquare}
            libelle={t('nav.messagerie')}
            actif={chemin.startsWith(ROUTES.messagerie)}
            onClick={fermerBarreMobile}
          />
          <LienBarre
            href={ROUTES.reunions}
            icone={CalendarDays}
            libelle={t('nav.reunions')}
            actif={chemin.startsWith(ROUTES.reunions)}
            onClick={fermerBarreMobile}
          />
          <LienBarre
            href={ROUTES.taches}
            icone={ListChecks}
            libelle={t('nav.taches')}
            actif={chemin.startsWith(ROUTES.taches)}
            onClick={fermerBarreMobile}
          />

          <TitreGroupe>{t('nav.groupeOutils')}</TitreGroupe>
          <LienBarre
            href={ROUTES.ia}
            icone={Sparkles}
            libelle={t('nav.ia')}
            actif={chemin.startsWith(ROUTES.ia)}
            onClick={fermerBarreMobile}
          />
          <LienBarre
            href={ROUTES.modeles}
            icone={LayoutTemplate}
            libelle={t('nav.modeles')}
            actif={chemin.startsWith(ROUTES.modeles)}
            onClick={fermerBarreMobile}
          />
        </div>

        {/* Favoris */}
        <SectionBarre titre={t('barre.favoris')} icone={Star}>
          <ListeFavoris onClick={fermerBarreMobile} />
        </SectionBarre>

        {/* Espaces d'équipe */}
        <TitreGroupe
          action={
            <InfoBulles contenu={t('barre.nouvelEspaceEquipe')}>
              <Link
                href={ROUTES.parametresEspaces}
                onClick={fermerBarreMobile}
                className="flex h-5 w-5 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                aria-label={t('barre.nouvelEspaceEquipe')}
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </InfoBulles>
          }
        >
          {t('barre.espacesEquipe')}
        </TitreGroupe>
        {espaces.map((espace) => (
          <SectionEspace key={espace._id} espace={espace} onClick={fermerBarreMobile} />
        ))}
        {espaces.length === 0 && (
          <p className="px-2 py-1 text-xs texte-faible">{t('barre.aucunEspaceEquipe')}</p>
        )}

        {/* Privé */}
        <SectionBarre titre={t('barre.prive')} icone={Lock}>
          <ArbrePages filtre={{ section: 'prive' }} />
        </SectionBarre>

        {/* Partagé */}
        <SectionBarre titre={t('barre.partage')} icone={Users}>
          <ArbrePages filtre={{ section: 'partage' }} />
        </SectionBarre>
      </div>

      {/* Pied : corbeille et paramètres (le compte est en haut à droite). */}
      <div className="flex shrink-0 flex-col gap-px border-t px-2 py-2" style={{ borderColor: 'var(--bordure)' }}>
        {!installe && (
          <button
            type="button"
            onClick={() => void installerNova()}
            className="lien-barre w-full"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">Installer NOVA</span>
          </button>
        )}
        <LienBarre
          href={ROUTES.corbeille}
          icone={Trash2}
          libelle={t('nav.corbeille')}
          actif={chemin.startsWith(ROUTES.corbeille)}
          onClick={fermerBarreMobile}
        />
        <LienBarre
          href={ROUTES.parametres}
          icone={Settings}
          libelle={t('nav.parametres')}
          actif={chemin.startsWith(ROUTES.parametres)}
          onClick={fermerBarreMobile}
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Version bureau : colonne redimensionnable */}
      <aside
        ref={refBarre}
        className={cn(
          'relative hidden shrink-0 border-r lg:block',
          barreRepliee && 'overflow-hidden'
        )}
        style={{
          width: barreRepliee ? 0 : largeurBarre,
          borderColor: barreRepliee ? 'transparent' : 'var(--bordure)',
          backgroundColor: 'var(--fond-barre)',
          transition: redimension ? 'none' : 'width 160ms ease',
        }}
      >
        <div style={{ width: largeurBarre }} className="h-full" aria-hidden={barreRepliee}>
          {contenu}
        </div>
        {!barreRepliee && (
          <div
            role="separator"
            aria-orientation="vertical"
            onMouseDown={debutRedimension}
            className={cn(
              'absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors',
              redimension ? 'bg-sky-500/50' : 'hover:bg-sky-500/30'
            )}
          />
        )}
      </aside>

      {/* Version mobile / tablette : tiroir */}
      {barreMobileOuverte && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t('barre.fermerNavigation')}
            onClick={fermerBarreMobile}
          />
          <div
            className="relative h-full w-[280px] max-w-[85vw] animate-glissement shadow-xl"
            style={{ backgroundColor: 'var(--fond-barre)' }}
          >
            {contenu}
            <button
              type="button"
              onClick={fermerBarreMobile}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={t('barre.fermerNavigation')}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Briques élémentaires                                                */
/* ------------------------------------------------------------------ */

/** Intitulé d'un groupe de navigation (« Espace de travail », « Outils »). */
function TitreGroupe({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <span className="group/titre flex items-center gap-1 px-2 pb-0.5 pt-3 text-[11px] font-semibold uppercase tracking-wide texte-faible">
      <span className="truncate">{children}</span>
      {action && (
        <span className="ml-auto hidden items-center group-hover/titre:flex">{action}</span>
      )}
    </span>
  );
}

/** Lien de navigation de la barre latérale. */
function LienBarre({
  href,
  icone: Icone,
  libelle,
  actif,
  raccourci,
  compteur,
  onClick,
}: {
  href: string;
  icone: LucideIcon;
  libelle: string;
  actif?: boolean;
  raccourci?: string;
  compteur?: ReactNode;
  onClick?: () => void;
}) {
  const { ouvrirPalette } = useInterface();
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (href === ROUTES.recherche) {
          e.preventDefault();
          ouvrirPalette();
          onClick?.();
          return;
        }
        onClick?.();
      }}
      className={cn('lien-barre', actif && 'lien-barre-actif')}
    >
      <Icone className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{libelle}</span>
      {raccourci && <span className="texte-faible text-xs">{raccourci}</span>}
      {compteur}
    </Link>
  );
}

/** Section repliable de la barre latérale (titre + contenu). */
function SectionBarre({
  titre,
  icone: Icone,
  children,
  action,
}: {
  titre: string;
  icone?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(true);
  return (
    <div className="mt-4">
      <div className="group/section flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-xs font-medium texte-faible hover:texte-doux"
        >
          <ChevronsLeft
            className={cn('h-3 w-3 shrink-0 transition-transform', ouvert ? 'rotate-[-90deg]' : '')}
          />
          {Icone && <Icone className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">{titre}</span>
        </button>
        {action}
      </div>
      {ouvert && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

/** Espace d'équipe : entête + arbre de ses pages. */
function SectionEspace({ espace, onClick }: { espace: Espace; onClick?: () => void }) {
  const { enfantsDe } = useDonnees();
  const { t } = useLangue();
  const racines = enfantsDe(null, { espaceId: espace._id, section: 'equipe' });

  return (
    <SectionBarre
      titre={espace.nom}
      icone={Building2}
      action={
        <span className="hidden shrink-0 items-center gap-0.5 group-hover/section:flex">
          <Link
            href={`/${espace.slug || espace._id}`}
            onClick={onClick}
            className="flex h-5 w-5 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={t('barre.ouvrirEspace', { nom: espace.nom })}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Link>
        </span>
      }
    >
      {racines.length === 0 ? (
        <p className="px-2 py-1 text-xs texte-faible">{t('barre.aucunePage')}</p>
      ) : (
        <ArbrePages filtre={{ espaceId: espace._id, section: 'equipe' }} />
      )}
    </SectionBarre>
  );
}

/** Liste des pages favorites. */
function ListeFavoris({ onClick }: { onClick?: () => void }) {
  const { pagesFavorites } = useDonnees();
  const { t } = useLangue();
  const chemin = usePathname();
  const favoris = pagesFavorites();
  if (favoris.length === 0) {
    return <p className="px-2 py-1 text-xs texte-faible">{t('barre.aucunFavori')}</p>;
  }
  return (
    <ul className="flex flex-col gap-px">
      {favoris.map((page) => {
        const url = lienPage(page);
        return (
          <li key={page._id}>
            <Link
              href={url}
              onClick={onClick}
              className={cn('lien-barre', chemin === url && 'lien-barre-actif')}
            >
              <IconeDonnee icone={page.icone} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{page.titre}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Badge du nombre de notifications non lues. */
function CompteurNotifications() {
  const { notificationsNonLues } = useDonnees();
  if (notificationsNonLues === 0) return null;
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-500 px-1 text-[10px] font-semibold text-white">
      {notificationsNonLues}
    </span>
  );
}

/** Sélecteur d'espace de travail : bascule la navigation ou en crée un nouveau. */
function EspaceTravailActif() {
  const { workspaces, workspaceActif, changerWorkspace } = useDonnees();
  const { t } = useLangue();
  const { fermerBarreMobile } = useInterface();
  const router = useRouter();
  const nom = workspaceActif?.nom || t('barre.monEspace');
  const icone = workspaceActif?.icone;

  /**
   * Bascule vers un espace de travail : le contenu affiché (espaces d'équipe,
   * pages, favoris) suit immédiatement la sélection. On revient à l'accueil pour
   * ne pas rester sur une page de l'ancien espace.
   */
  function choisir(id: string) {
    changerWorkspace(id);
    fermerBarreMobile();
    router.push(ROUTES.accueil);
  }

  return (
    <Menu
      className="min-w-0 flex-1"
      alignement="gauche"
      largeur="w-[280px] max-w-[calc(100vw-2rem)]"
      declencheur={
        <button
          type="button"
          className="flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-1 text-left hover:bg-black/5 dark:hover:bg-white/10"
        >
          <IconeDonnee icone={icone} className="h-4 w-4 shrink-0 texte-doux" />
          <span className="truncate text-sm font-medium">{nom}</span>
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 texte-faible" />
        </button>
      }
    >
      <MenuTitre>{t('barre.mesEspaces')}</MenuTitre>
      {workspaces.map((workspace) => (
        <MenuElement
          key={workspace._id}
          actif={workspace._id === workspaceActif?._id}
          onClick={() => choisir(workspace._id)}
        >
          {`${workspace.icone || '🏠'} ${workspace.nom}`}
        </MenuElement>
      ))}
      <MenuSeparateur />
      <MenuElement
        icone={Plus}
        onClick={() => {
          fermerBarreMobile();
          router.push(ROUTES.parametresEspacesTravail);
        }}
      >
        {t('barre.nouvelEspace')}
      </MenuElement>
    </Menu>
  );
}
