import type { Espace, Page } from './types';

/** Routes de l'application (miroir de la structure d'information). */
export const ROUTES = {
  accueil: '/',
  recherche: '/recherche',
  corbeille: '/corbeille',
  inbox: '/inbox',
  messagerie: '/messagerie',
  ia: '/ia',
  modeles: '/modeles',
  reunions: '/reunions',
  taches: '/taches',
  parametres: '/parametres',
  parametresProfil: '/parametres/profil',
  parametresMembres: '/parametres/membres',
  parametresEspacesTravail: '/parametres/espaces-travail',
  parametresEspaces: '/parametres/espaces',
  parametresConnexions: '/parametres/connexions',
  parametresPublications: '/parametres/publications',
  parametresFacturation: '/parametres/facturation',
} as const;

/** Extrait le slug de l'espace d'une page (référence peuplée ou identifiant brut). */
export function slugEspaceDePage(page: Page): string | undefined {
  const ref = page.espaceId;
  if (ref && typeof ref === 'object') return (ref as Espace).slug;
  return undefined;
}

/** Construit le lien vers une page : `/:espaceSlug/:pageId`. */
export function lienPage(page: Page): string {
  const slug = slugEspaceDePage(page);
  return slug ? `/${slug}/${page._id}` : `/page/${page._id}`;
}

/** Construit le lien vers la racine d'un espace : `/:espaceSlug`. */
export function lienEspace(espace: Espace): string {
  return `/${espace.slug || espace._id}`;
}

/** Construit le lien d'une base avec une vue active : `/:espaceSlug/:pageId?v=:index`. */
export function lienBase(page: Page, indexVue: number): string {
  return `${lienPage(page)}?v=${indexVue}`;
}
