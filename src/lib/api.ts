/**
 * Client HTTP typé vers l'API DRY multi-tenant.
 *
 * Toutes les requêtes passent par la réécriture Next.js (`/api/*` → backend DRY,
 * voir `next.config.mjs`), ce qui garde le navigateur en same-origin et évite
 * toute dépendance à la configuration CORS du serveur.
 *
 * Le format de réponse respecté est celui du framework :
 *   { success, message, data, timestamp, pagination? }
 */

import type {
  Apparence,
  Base,
  Bloc,
  Commentaire,
  Connexion,
  Element,
  Espace,
  Favori,
  Membre,
  MessageEquipe,
  Modele,
  Notification,
  Page,
  Pagination,
  Parametre,
  ParametresRequete,
  Police,
  Publication,
  ReponseAPI,
  RequeteIA,
  SessionAuth,
  Utilisateur,
  VersionPage,
  Workspace,
} from './types';

/** Racine de l'application NOVA côté backend. */
export const BASE_API = '/api/v1/nova';

/** Erreur applicative enrichie du code HTTP et du message backend. */
export class ErreurAPI extends Error {
  statut: number;
  details?: unknown;

  constructor(message: string, statut = 500, details?: unknown) {
    super(message);
    this.name = 'ErreurAPI';
    this.statut = statut;
    this.details = details;
  }
}

/* ------------------------------------------------------------------ */
/* Gestion du jeton JWT                                                */
/* ------------------------------------------------------------------ */

const CLE_TOKEN = 'nova.token';
const CLE_REFRESH = 'nova.refreshToken';

let jetonMemoire: string | null = null;

/** Lit le jeton depuis la mémoire puis le stockage local. */
export function lireToken(): string | null {
  if (jetonMemoire) return jetonMemoire;
  if (typeof window === 'undefined') return null;
  jetonMemoire = window.localStorage.getItem(CLE_TOKEN);
  return jetonMemoire;
}

/** Enregistre (ou efface) le jeton d'accès et de rafraîchissement. */
export function definirToken(token: string | null, refreshToken?: string | null): void {
  jetonMemoire = token;
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(CLE_TOKEN, token);
    if (refreshToken) window.localStorage.setItem(CLE_REFRESH, refreshToken);
  } else {
    window.localStorage.removeItem(CLE_TOKEN);
    window.localStorage.removeItem(CLE_REFRESH);
  }
}

/** Construit une chaîne de requête à partir d'un objet de paramètres. */
export function construireRequete(params?: ParametresRequete): string {
  if (!params) return '';
  const morceaux: string[] = [];
  Object.entries(params).forEach(([cle, valeur]) => {
    if (valeur === undefined || valeur === null || valeur === '') return;
    morceaux.push(`${encodeURIComponent(cle)}=${encodeURIComponent(String(valeur))}`);
  });
  return morceaux.length ? `?${morceaux.join('&')}` : '';
}

interface OptionsRequete {
  methode?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  corps?: unknown;
  params?: ParametresRequete;
  signal?: AbortSignal;
}

/**
 * Résultat d'une tentative de renouvellement :
 * - `ok`        : un nouveau jeton d'accès a été obtenu ;
 * - `sans_jeton`: aucun refresh token stocké (session jamais établie) ;
 * - `invalide`  : le refresh token a été rejeté (révoqué ou expiré) ;
 * - `reseau`    : serveur injoignable — la session reste valable.
 */
export type ResultatRafraichissement = 'ok' | 'sans_jeton' | 'invalide' | 'reseau';

/**
 * Mutex : lorsque plusieurs requêtes échouent en 401 simultanément, on ne
 * déclenche qu'un seul appel `/user/refresh` et on partage son résultat.
 */
let rafraichissementEnCours: Promise<ResultatRafraichissement> | null = null;

/**
 * Tente de renouveler le jeton d'accès à partir du refresh token stocké.
 * Écrit la paire de jetons via `definirToken` en cas de succès.
 */
export async function rafraichirJeton(): Promise<ResultatRafraichissement> {
  if (typeof window === 'undefined') return 'sans_jeton';
  const refreshToken = window.localStorage.getItem(CLE_REFRESH);
  if (!refreshToken) return 'sans_jeton';

  if (!rafraichissementEnCours) {
    rafraichissementEnCours = (async (): Promise<ResultatRafraichissement> => {
      const tenter = async (jeton: string): Promise<ResultatRafraichissement> => {
        let reponse: Response;
        try {
          reponse = await fetch(`${BASE_API}/user/refresh`, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: jeton }),
            cache: 'no-store',
          });
        } catch {
          // Panne réseau : le jeton reste valable, on ne déconnecte pas.
          return 'reseau';
        }
        const charge = (await reponse.json().catch(() => null)) as
          | { data?: { token?: string; refreshToken?: string } }
          | null;
        const donnees = charge?.data;
        if (!reponse.ok || !donnees?.token) {
          return reponse.status === 401 || reponse.status === 400 ? 'invalide' : 'reseau';
        }
        definirToken(donnees.token, donnees.refreshToken || jeton);
        return 'ok';
      };

      try {
        const premier = await tenter(refreshToken);
        if (premier === 'ok') return 'ok';
        // Un autre onglet a peut-être déjà fait tourner le jeton : on rejoue
        // une fois avec la valeur la plus récente du stockage.
        const dernier = window.localStorage.getItem(CLE_REFRESH);
        if (dernier && dernier !== refreshToken) return tenter(dernier);
        return premier;
      } finally {
        rafraichissementEnCours = null;
      }
    })();
  }
  return rafraichissementEnCours;
}

/**
 * Exécute une requête vers l'API et normalise la réponse.
 * En cas de `401`, tente un renouvellement transparent du jeton et rejoue la
 * requête une seule fois avant d'abandonner (auquel cas la session est purgée).
 * Lève une `ErreurAPI` si `success` est faux ou le statut HTTP en erreur.
 */
export async function executer<T>(chemin: string, options: OptionsRequete = {}): Promise<ReponseAPI<T>> {
  const { methode = 'GET', corps, params, signal } = options;
  const url = `${BASE_API}${chemin}${construireRequete(params)}`;

  const envoyer = (): Promise<Response> => {
    const entetes: Record<string, string> = { Accept: 'application/json' };
    const token = lireToken();
    if (token) entetes.Authorization = `Bearer ${token}`;
    if (corps !== undefined) entetes['Content-Type'] = 'application/json';
    return fetch(url, {
      method: methode,
      headers: entetes,
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
      signal,
      cache: 'no-store',
    });
  };

  let reponse: Response;
  try {
    reponse = await envoyer();
  } catch (erreur) {
    throw new ErreurAPI(
      "Impossible de joindre le serveur. Vérifiez que l'API DRY est démarrée.",
      0,
      erreur
    );
  }

  // Jeton d'accès expiré : on renouvelle puis on rejoue la requête une fois.
  if (reponse.status === 401) {
    const resultat = await rafraichirJeton();
    if (resultat === 'ok') {
      try {
        reponse = await envoyer();
      } catch (erreur) {
        throw new ErreurAPI(
          "Impossible de joindre le serveur. Vérifiez que l'API DRY est démarrée.",
          0,
          erreur
        );
      }
    } else if (resultat === 'invalide' || resultat === 'sans_jeton') {
      // Session définitivement terminée : on purge les jetons locaux.
      definirToken(null);
    }
    // 'reseau' : serveur injoignable, on conserve la session pour réessayer.
  }

  let charge: ReponseAPI<T> | null = null;
  try {
    charge = (await reponse.json()) as ReponseAPI<T>;
  } catch {
    charge = null;
  }

  if (!reponse.ok || (charge && charge.success === false)) {
    const message = charge?.message || `Erreur ${reponse.status}`;
    throw new ErreurAPI(message, reponse.status, charge);
  }

  return charge as ReponseAPI<T>;
}

/**
 * Exécute une requête `multipart/form-data` (upload de fichier).
 * Le `Content-Type` est laissé au navigateur afin qu'il pose la frontière.
 */
export async function executerFormulaire<T>(
  chemin: string,
  methode: 'POST' | 'PATCH',
  donnees: FormData
): Promise<ReponseAPI<T>> {
  const url = `${BASE_API}${chemin}`;

  const envoyer = (): Promise<Response> => {
    const entetes: Record<string, string> = { Accept: 'application/json' };
    const token = lireToken();
    if (token) entetes.Authorization = `Bearer ${token}`;
    return fetch(url, { method: methode, headers: entetes, body: donnees, cache: 'no-store' });
  };

  let reponse: Response;
  try {
    reponse = await envoyer();
  } catch (erreur) {
    throw new ErreurAPI(
      "Impossible de joindre le serveur. Vérifiez que l'API DRY est démarrée.",
      0,
      erreur
    );
  }

  if (reponse.status === 401) {
    const resultat = await rafraichirJeton();
    if (resultat === 'ok') {
      reponse = await envoyer();
    } else if (resultat === 'invalide' || resultat === 'sans_jeton') {
      definirToken(null);
    }
  }

  let charge: ReponseAPI<T> | null = null;
  try {
    charge = (await reponse.json()) as ReponseAPI<T>;
  } catch {
    charge = null;
  }

  if (!reponse.ok || (charge && charge.success === false)) {
    const message = charge?.message || `Erreur ${reponse.status}`;
    throw new ErreurAPI(message, reponse.status, charge);
  }

  return charge as ReponseAPI<T>;
}

/** Raccourci : exécute et renvoie directement le champ `data`. */
export async function executerData<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  const reponse = await executer<T>(chemin, options);
  return reponse.data;
}

/**
 * Récupère l'intégralité d'une liste en parcourant les pages.
 * Le `queryBuilder` DRY plafonne `limit` à 100 : on boucle donc jusqu'à
 * épuisement des pages.
 */
export async function listerTout<T extends { _id: string }>(
  ressource: Ressource<T>,
  params: ParametresRequete = {}
): Promise<T[]> {
  const limite = 100;
  let page = 1;
  const tout: T[] = [];
  // Garde-fou : on borne à 50 pages (5 000 documents) pour éviter toute boucle infinie.
  for (; page <= 50; page += 1) {
    const reponse = await ressource.lister({ ...params, page, limit: limite });
    tout.push(...(reponse.data || []));
    const pagination = reponse.pagination;
    if (!pagination || page >= pagination.totalPages) break;
  }
  return tout;
}

/* ------------------------------------------------------------------ */
/* Ressource CRUD générique                                            */
/* ------------------------------------------------------------------ */

export interface Ressource<T> {
  lister: (params?: ParametresRequete) => Promise<ReponseAPI<T[]>>;
  obtenir: (id: string) => Promise<T>;
  creer: (payload: Partial<T>) => Promise<T>;
  /** Met à jour un document ; `params` permet par ex. `includeDeleted` (corbeille). */
  maj: (id: string, payload: Partial<T>, params?: ParametresRequete) => Promise<T>;
  /** Supprime un document ; `params` permet par ex. `includeDeleted` (corbeille). */
  supprimer: (id: string, params?: ParametresRequete) => Promise<null>;
}

/** Fabrique une ressource CRUD pour une feature DRY donnée. */
export function creerRessource<T extends { _id: string }>(feature: string): Ressource<T> {
  return {
    lister: (params) => executer<T[]>(`/${feature}`, { params }),
    obtenir: (id) => executerData<T>(`/${feature}/${id}`),
    creer: (payload) => executerData<T>(`/${feature}`, { methode: 'POST', corps: payload }),
    maj: (id, payload, params) =>
      executerData<T>(`/${feature}/${id}`, { methode: 'PUT', corps: payload, params }),
    supprimer: (id, params) =>
      executerData<null>(`/${feature}/${id}`, { methode: 'DELETE', params }),
  };
}

/** Ressources exposées par l'application NOVA (une par feature backend). */
export const workspaces = creerRessource<Workspace>('workspaces');
export const espaces = creerRessource<Espace>('espaces');
export const pages = {
  ...creerRessource<Page>('pages'),
  /**
   * Restaure une page et ses sous-pages depuis la corbeille.
   * `supprimer` (DELETE) archive en cascade ; avec `includeDeleted`, il purge.
   */
  restaurer: (id: string) =>
    executerData<{ pageId: string }>(`/pages/${id}/restaurer`, { methode: 'POST' }),
};
export const blocs = creerRessource<Bloc>('blocs');
export const bases = creerRessource<Base>('bases');
export const elements = creerRessource<Element>('elements');
export const commentaires = creerRessource<Commentaire>('commentaires');
export const modeles = creerRessource<Modele>('modeles');
export const connexions = creerRessource<Connexion>('connexions');
export const favoris = creerRessource<Favori>('favoris');
export const notifications = creerRessource<Notification>('notifications');
export const parametres = creerRessource<Parametre>('parametres');
export const membres = {
  ...creerRessource<Membre>('membres'),
  /**
   * Réexpédie l'invitation d'un membre. Un nouveau mot de passe provisoire est
   * généré, afin que les identifiants reçus par e-mail soient valides.
   */
  renvoyerInvitation: (id: string) =>
    executerData<{ envoye: boolean }>(`/membres/${id}/renvoyer-invitation`, { methode: 'POST' }),
};
export const publications = creerRessource<Publication>('publications');
export const messages = creerRessource<MessageEquipe>('messages');
export const requetesIA = creerRessource<RequeteIA>('ia');
export const versions = {
  ...creerRessource<VersionPage>('versions'),
  /** Restaure une version : page et blocs sont remplacés par l'instantané. */
  restaurer: (id: string) =>
    executerData<{ pageId: string }>(`/versions/${id}/restaurer`, { methode: 'POST' }),
};

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

export const authentification = {
  /** Connexion par e-mail / mot de passe. */
  connexion: (email: string, password: string) =>
    executerData<SessionAuth>('/user/login', { methode: 'POST', corps: { email, password } }),

  /** Inscription d'un nouvel utilisateur. */
  inscription: (payload: { name: string; email: string; password: string }) =>
    executerData<SessionAuth>('/user/register', { methode: 'POST', corps: payload }),

  /** Recharge le profil de l'utilisateur courant à partir du jeton. */
  profil: () => executerData<Utilisateur>('/user/profile'),

  /** Renouvelle le jeton d'accès. */
  rafraichir: (refreshToken: string) =>
    executerData<{ token: string; refreshToken: string }>('/user/refresh', {
      methode: 'POST',
      corps: { refreshToken },
    }),

  /** Met à jour le profil (nom, e-mail, téléphone, avatar) — multipart. */
  majProfil: (donnees: {
    name?: string;
    email?: string;
    telephone?: string;
    avatar?: File | null;
  }): Promise<ReponseAPI<Utilisateur>> => {
    const formulaire = new FormData();
    if (donnees.name !== undefined) formulaire.append('name', donnees.name);
    if (donnees.email !== undefined) formulaire.append('email', donnees.email);
    if (donnees.telephone !== undefined) formulaire.append('telephone', donnees.telephone);
    if (donnees.avatar) formulaire.append('avatar', donnees.avatar);
    return executerFormulaire<Utilisateur>('/user/profile', 'PATCH', formulaire);
  },

  /** Change le mot de passe de l'utilisateur connecté. */
  changerMotDePasse: (currentPassword: string, newPassword: string) =>
    executerData<null>('/user/password', {
      methode: 'PATCH',
      corps: { currentPassword, newPassword },
    }),

  /** Déconnexion serveur (révocation des jetons de rafraîchissement). */
  deconnexion: () => executerData<null>('/user/logout', { methode: 'POST' }),
};

/* ------------------------------------------------------------------ */
/* Médias (téléversement local)                                        */
/* ------------------------------------------------------------------ */

export const medias = {
  /** Téléverse un média local (image, vidéo, audio) et renvoie son URL. */
  televerser: (
    fichier: File
  ): Promise<ReponseAPI<{ url: string; nom?: string; type?: string; taille?: number }>> => {
    const formulaire = new FormData();
    formulaire.append('fichier', fichier);
    return executerFormulaire<
      { url: string; nom?: string; type?: string; taille?: number }
    >('/medias', 'POST', formulaire);
  },
};

/* ------------------------------------------------------------------ */
/* Assistant IA (proxy FreeLLM, compatible OpenAI)                     */
/* ------------------------------------------------------------------ */

/**
 * Racine du proxy d'inférence IA. FreeLLM expose son API compatible OpenAI
 * à la racine du backend DRY (`/v1/...`), en dehors du préfixe multi-tenant ;
 * la réécriture Next la rend disponible en same-origin.
 */
const BASE_IA = '/v1';

/** Message d'un échange avec l'assistant. */
export interface MessageIA {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Réponse normalisée de l'assistant. */
export interface ReponseIA {
  contenu: string;
  modele?: string;
  dureeMs: number;
}

interface OptionsIA {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Délai maximal d'attente (ms) avant abandon côté client. */
  timeoutMs?: number;
}

/**
 * Interroge l'assistant IA (proxy FreeLLM du backend DRY, format OpenAI).
 * Le JWT de l'utilisateur authentifie l'appel ; le routeur choisit le modèle.
 */
export async function demanderIA(messages: MessageIA[], options: OptionsIA = {}): Promise<ReponseIA> {
  const debut = Date.now();
  const entetes: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const token = lireToken();
  if (token) entetes.Authorization = `Bearer ${token}`;

  // Abandon explicite : évite un spinner infini si le routeur met trop de temps.
  const controleur = new AbortController();
  const delai = setTimeout(() => controleur.abort(), options.timeoutMs ?? 90000);
  const surAnnulation = () => controleur.abort();
  options.signal?.addEventListener('abort', surAnnulation);

  let reponse: Response;
  try {
    reponse = await fetch(`${BASE_IA}/chat/completions`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify({
        model: options.model || 'auto',
        messages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 1500,
      }),
      signal: controleur.signal,
    });
  } catch (erreur) {
    if (controleur.signal.aborted && !options.signal?.aborted) {
      throw new ErreurAPI("L'assistant IA met trop de temps à répondre. Réessayez.", 0, erreur);
    }
    throw new ErreurAPI("Impossible de joindre l'assistant IA.", 0, erreur);
  } finally {
    clearTimeout(delai);
    options.signal?.removeEventListener('abort', surAnnulation);
  }

  const charge = (await reponse.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string }; text?: string }>; model?: string; error?: { message?: string }; message?: string }
    | null;

  if (!reponse.ok) {
    throw new ErreurAPI(
      charge?.error?.message || charge?.message || `Erreur ${reponse.status}`,
      reponse.status,
      charge
    );
  }

  const contenu = charge?.choices?.[0]?.message?.content ?? charge?.choices?.[0]?.text ?? '';
  return { contenu: contenu.trim(), modele: charge?.model, dureeMs: Date.now() - debut };
}

/* ------------------------------------------------------------------ */
/* Recherche transverse                                                */
/* ------------------------------------------------------------------ */

export interface ResultatRecherche {
  type: 'page' | 'bloc' | 'element' | 'base';
  id: string;
  titre: string;
  extrait?: string;
  pageId?: string;
  espaceSlug?: string;
  icone?: string;
}

/**
 * Recherche globale (palette ⌘K) : pages par titre, blocs par contenu,
 * éléments de bases par titre. Les requêtes sont lancées en parallèle.
 */
export async function rechercherGlobalement(
  terme: string,
  signal?: AbortSignal
): Promise<ResultatRecherche[]> {
  const recherche = terme.trim();
  if (!recherche) return [];

  const [repPages, repBlocs, repElements] = await Promise.all([
    pages.lister({ search: recherche, limit: 100 }).catch(() => null),
    blocs.lister({ search: recherche, fields: 'contenu', limit: 100 }).catch(() => null),
    elements.lister({ search: recherche, limit: 100 }).catch(() => null),
  ]);

  const resultats: ResultatRecherche[] = [];

  (repPages?.data || []).forEach((page) => {
    resultats.push({
      type: 'page',
      id: page._id,
      titre: page.titre,
      pageId: page._id,
      icone: page.icone,
      extrait: typeof page.espaceId === 'object' && page.espaceId ? (page.espaceId as Espace).nom : undefined,
    });
  });

  (repBlocs?.data || []).forEach((bloc) => {
    resultats.push({
      type: 'bloc',
      id: bloc._id,
      titre: (bloc.contenu || '').slice(0, 120) || 'Bloc sans contenu',
      pageId: bloc.pageId,
      extrait: `Bloc · ${bloc.type}`,
    });
  });

  (repElements?.data || []).forEach((element) => {
    resultats.push({
      type: 'element',
      id: element._id,
      titre: element.titre,
      extrait: 'Élément de base de données',
    });
  });

  return resultats;
}

/* ------------------------------------------------------------------ */
/* Aides paramètres & apparence                                        */
/* ------------------------------------------------------------------ */

/** Récupère le premier paramètre d'espace (l'app gère un espace de travail). */
export async function chargerParametres(): Promise<Parametre | null> {
  const reponse = await parametres.lister({ limit: 1, sort: 'createdAt' });
  return reponse.data?.[0] || null;
}

/** Type utilitaire : apparence/police manipulées par le contexte d'apparence. */
export type { Apparence, Police };
