'use client';

import { ChevronRight, LogOut, Menu as IconeMenu, PanelLeft, Search, Sparkles, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, type ReactNode } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { InfoBulles } from '@/components/ui/InfoBulles';
import { Menu, MenuElement, MenuSeparateur, MenuTitre } from '@/components/ui/Menu';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { useInterface } from '@/context/InterfaceContext';
import { useLangue } from '@/context/LangueContext';
import { ROUTES, lienPage } from '@/lib/navigation';
import type { Page } from '@/lib/types';

/** Barre supérieure : accès mobile, fil d'Ariane et actions de la page. */
export function EnTete({ actions }: { actions?: ReactNode }) {
  const { ouvrirBarreMobile, ouvrirPalette, barreRepliee, basculerBarreRepliee } = useInterface();
  const { t } = useLangue();

  return (
    <header
      className="sticky top-0 z-30 flex h-11 shrink-0 items-center gap-2 px-2 backdrop-blur justify-end"
      style={{ backgroundColor: 'color-mix(in srgb, var(--fond) 88%, transparent)', borderBottom: '1px solid transparent' }}
    >
      <button
        type="button"
        onClick={ouvrirBarreMobile}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded texte-doux hover:bg-black/5 lg:hidden dark:hover:bg-white/10"
        aria-label={t('entete.ouvrirNavigation')}
      >
        <IconeMenu className="h-4 w-4" />
      </button>

      {barreRepliee && (
        <InfoBulles contenu={t('entete.deplierBarreLaterale')}>
          <button
            type="button"
            onClick={basculerBarreRepliee}
            className="hidden h-7 w-7 shrink-0 items-center justify-center rounded texte-doux hover:bg-black/5 lg:flex dark:hover:bg-white/10"
            aria-label={t('entete.deplierBarreLaterale')}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </InfoBulles>
      )}

      <FilAriane />

      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <InfoBulles contenu={t('entete.rechercherRaccourci')}>
          <button
            type="button"
            onClick={ouvrirPalette}
            className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={t('entete.rechercher')}
          >
            <Search className="h-4 w-4" />
          </button>
        </InfoBulles>
        <InfoBulles contenu={t('nav.ia')}>
          <Link
            href={ROUTES.ia}
            className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={t('nav.ia')}
          >
            <Sparkles className="h-4 w-4" />
          </Link>
        </InfoBulles>
        {actions}
        <MenuCompte />
      </div>
    </header>
  );
}

/** Menu du compte, en haut à droite : profil et déconnexion. */
function MenuCompte() {
  const { utilisateur, estConnecte, deconnexion } = useAuth();
  const { t } = useLangue();
  const toasts = useToasts();
  const router = useRouter();

  if (!estConnecte) {
    return (
      <Link
        href="/connexion"
        className="flex h-7 items-center gap-1.5 rounded px-2 text-sm texte-doux hover:bg-black/5 dark:hover:bg-white/10"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{t('compte.seConnecter')}</span>
      </Link>
    );
  }

  const nom = utilisateur?.name || utilisateur?.nom || utilisateur?.email || t('compte.utilisateur');

  return (
    <Menu
      alignement="droite"
      largeur="w-[240px] max-w-[calc(100vw-1rem)]"
      declencheur={
        <button
          type="button"
          className="flex h-7 items-center gap-1.5 rounded px-1 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={t('compte.monProfil')}
        >
          <Avatar src={utilisateur?.avatarUrl} nom={nom} taille="xs" />
        </button>
      }
    >
      <MenuTitre>{utilisateur?.email}</MenuTitre>
      <MenuSeparateur />
      <MenuElement icone={UserRound} onClick={() => router.push(ROUTES.parametresProfil)}>
        {t('compte.monProfil')}
      </MenuElement>
      <MenuElement onClick={() => router.push(ROUTES.parametres)}>
        {t('compte.parametresEtMembres')}
      </MenuElement>
      <MenuSeparateur />
      <MenuElement
        icone={LogOut}
        danger
        onClick={async () => {
          await deconnexion();
          toasts.info(t('compte.deconnecte'));
        }}
      >
        {t('compte.seDeconnecter')}
      </MenuElement>
    </Menu>
  );
}

/** Clés de traduction des routes statiques de premier niveau. */
const CLES_ROUTES: Record<string, string> = {
  recherche: 'nav.rechercher',
  corbeille: 'nav.corbeille',
  inbox: 'nav.inbox',
  ia: 'nav.ia',
  modeles: 'nav.modeles',
  parametres: 'nav.parametres',
  connexion: 'nav.connexion',
};

/** Fil d'Ariane : Espace > Page parente > Page courante. */
function FilAriane() {
  const chemin = usePathname();
  const { espaceParSlug, pageParId, espaces } = useDonnees();
  const { t } = useLangue();

  const segments = chemin.split('/').filter(Boolean);

  if (segments.length === 0) {
    return <span className="px-1 text-sm font-medium">{t('nav.accueil')}</span>;
  }

  // Routes statiques (Recherche, Corbeille, NOVA IA, Paramètres…).
  const cleRoute = CLES_ROUTES[segments[0]];
  if (cleRoute) {
    return (
      <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label={t('entete.filAriane')}>
        <span className="truncate px-1 texte-doux">{t(cleRoute)}</span>
        {segments.slice(1).map((segment) => (
          <Fragment key={segment}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 texte-faible" />
            <span className="truncate px-1 texte-doux">{segment}</span>
          </Fragment>
        ))}
      </nav>
    );
  }

  // Route de page : /:espaceSlug/:pageId
  const espace = espaceParSlug(segments[0]) || espaces.find((e) => e._id === segments[0]);
  const pageId = segments[1];
  const page = pageId ? pageParId(pageId) : undefined;

  if (!page) {
    return (
      <span className="truncate px-1 text-sm texte-doux">{espace?.nom || segments[0]}</span>
    );
  }

  const chaine = construireChaine(page, pageParId);

  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm" aria-label={t('entete.filAriane')}>
      {espace && (
        <>
          <Link href={`/${espace.slug || espace._id}`} className="flex items-center gap-1.5 truncate rounded px-1 hover:bg-black/5 dark:hover:bg-white/10">
            <IconeDonnee icone={espace.icone} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{espace.nom}</span>
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 texte-faible" />
        </>
      )}
      {chaine.map((element, index) => {
        const dernier = index === chaine.length - 1;
        return (
          <Fragment key={element._id}>
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 texte-faible" />}
            <Link
              href={lienPage(element)}
              className={`flex min-w-0 items-center gap-1.5 truncate rounded px-1 hover:bg-black/5 dark:hover:bg-white/10 ${
                dernier ? 'font-medium' : 'texte-doux'
              }`}
            >
              <IconeDonnee icone={element.icone} className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{element.titre}</span>
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** Construit la chaîne d'ascendants (racine → page courante). */
function construireChaine(page: Page, pageParId: (id: string) => Page | undefined): Page[] {
  const chaine: Page[] = [];
  let courant: Page | undefined = page;
  const vus = new Set<string>();
  while (courant && !vus.has(courant._id)) {
    vus.add(courant._id);
    chaine.unshift(courant);
    courant = courant.parentId ? pageParId(courant.parentId) : undefined;
  }
  return chaine;
}
