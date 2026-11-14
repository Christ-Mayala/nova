/**
 * Types TypeScript des entités NOVA.
 *
 * Ils reflètent fidèlement les schémas Mongoose du backend DRY
 * (`dryApp/Nova/features/<nom>/model/<nom>.schema.js`) enrichis des champs
 * ajoutés automatiquement par le plugin global DRY : `slug`, `label`, `status`,
 * `deletedAt`, `createdBy`, `updatedBy`, `createdAt`, `updatedAt`.
 */

/** Statuts DRY posés par le plugin Mongoose global. */
export type StatutDRY = 'active' | 'inactive' | 'deleted' | 'banned';

/** Référence d'utilisateur renvoyée par les `populate` (createdBy / updatedBy). */
export interface UtilisateurRef {
  _id: string;
  name?: string;
  nom?: string;
  email?: string;
}

/** Champs communs injectés par le plugin DRY sur toutes les entités NOVA. */
export interface BaseDRY {
  _id: string;
  slug?: string;
  label?: string;
  status?: StatutDRY;
  deletedAt?: string;
  createdBy?: UtilisateurRef | string;
  updatedBy?: UtilisateurRef | string;
  createdAt: string;
  updatedAt: string;
}

/** Métadonnées de pagination renvoyées par le framework DRY. */
export interface Pagination {
  total: number;
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  next?: { page: number; limit: number };
  prev?: { page: number; limit: number };
}

/** Enveloppe de réponse standard du framework DRY. */
export interface ReponseAPI<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
  pagination?: Pagination;
  requestId?: string;
}

/** Paramètres de requête acceptés par le `queryBuilder` DRY. */
export interface ParametresRequete {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  fields?: string;
  select?: string;
  json?: string;
  /** Inclut les documents supprimés (corbeille). */
  includeDeleted?: boolean;
  [cle: string]: string | number | boolean | undefined;
}

/* ------------------------------------------------------------------ */
/* Espace de travail (workspace)                                        */
/* ------------------------------------------------------------------ */

/**
 * Espace de travail : conteneur de premier niveau, au-dessus des espaces
 * d'équipe. Un utilisateur peut en posséder jusqu'à 5 ; basculer d'un espace
 * de travail à l'autre change l'intégralité du contenu affiché.
 */
export interface Workspace extends BaseDRY {
  nom: string;
  icone?: string;
  description?: string;
  ordre?: number;
}

/* ------------------------------------------------------------------ */
/* Espace d'équipe (teamspace)                                          */
/* ------------------------------------------------------------------ */

export type VisibiliteEspace = 'ouvert' | 'ferme' | 'prive';

export interface Espace extends BaseDRY {
  nom: string;
  icone?: string;
  description?: string;
  /** Espace de travail auquel cet espace d'équipe appartient. */
  workspaceId?: Workspace | string;
  visibilite?: VisibiliteEspace;
  ordre?: number;
  estPrive?: boolean;
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export type SectionPage = 'equipe' | 'prive' | 'partage';

export interface Page extends BaseDRY {
  titre: string;
  icone?: string;
  couverture?: string;
  /** « remplir » recadre l'image, « contenir » l'affiche entièrement. */
  couvertureAjustement?: 'remplir' | 'contenir';
  /** Alignement vertical de l'image de couverture. */
  couverturePosition?: 'haut' | 'centre' | 'bas';
  espaceId?: Espace | string | null;
  /** Espace de travail auquel cette page appartient. */
  workspaceId?: Workspace | string | null;
  parentId?: string | null;
  ordre?: number;
  favori?: boolean;
  pleineLargeur?: boolean;
  /** Page verrouillée : consultation seule (aucune modification possible). */
  verrouillee?: boolean;
  publie?: boolean;
  section?: SectionPage;
  derniereVisite?: string;
}

/* ------------------------------------------------------------------ */
/* Bloc                                                                 */
/* ------------------------------------------------------------------ */

/** Taxonomie complète des types de blocs (miroir de l'énumération backend). */
export type TypeBloc =
  | 'paragraphe'
  | 'titre_1'
  | 'titre_2'
  | 'titre_3'
  | 'titre_4'
  | 'titre_5'
  | 'titre_6'
  | 'liste_a_puces'
  | 'liste_numerotee'
  | 'a_faire'
  | 'bascule'
  | 'image'
  | 'video'
  | 'audio'
  | 'fichier'
  | 'signet'
  | 'embed'
  | 'tableau'
  | 'base_en_ligne'
  | 'colonne'
  | 'separateur'
  | 'sommaire'
  | 'fil_ariane'
  | 'encadre'
  | 'citation'
  | 'code'
  | 'math'
  | 'bouton_modele'
  | 'bloc_synchro'
  | 'lien_page'
  | 'ia_resume'
  | 'ia_actions'
  | 'note'
  | 'onglets'
  | 'galerie'
  | 'galerie_medias'
  | 'graphique'
  | 'raccourci'
  | 'ia_page';

/** Propriétés libres d'un bloc (url, langage, coche, emoji, pageId...). */
export interface ProprietesBloc {
  url?: string;
  legende?: string;
  langage?: string;
  coche?: boolean;
  emoji?: string;
  pageId?: string;
  ouvert?: boolean;
  [cle: string]: unknown;
}

export interface Bloc extends BaseDRY {
  pageId?: string;
  parentId?: string | null;
  type: TypeBloc;
  contenu?: string;
  proprietes?: ProprietesBloc;
  enfants?: Bloc[];
  ordre?: number;
}

/* ------------------------------------------------------------------ */
/* Base de données                                                      */
/* ------------------------------------------------------------------ */

export type TypePropriete =
  | 'titre'
  | 'texte'
  | 'nombre'
  | 'selection'
  | 'selection_multiple'
  | 'statut'
  | 'case'
  | 'date'
  | 'personne'
  | 'fichier'
  | 'url'
  | 'email'
  | 'telephone'
  | 'formule'
  | 'relation'
  | 'rollup'
  | 'id_unique'
  | 'cree_le'
  | 'modifie_le'
  | 'cree_par'
  | 'modifie_par';

export interface ProprieteBase {
  nom: string;
  type: TypePropriete;
  options?: {
    options?: string[];
    groupes?: string[];
    formule?: string;
    [cle: string]: unknown;
  };
}

export type TypeVue = 'tableau' | 'kanban' | 'galerie' | 'liste' | 'calendrier' | 'chronologie';

export interface FiltreVue {
  propriete: string;
  operateur: string;
  valeur?: unknown;
}

export interface TriVue {
  propriete: string;
  direction: 'asc' | 'desc';
}

export interface GroupeVue {
  propriete: string;
}

export interface VueBase {
  nom: string;
  type: TypeVue;
  filtres?: FiltreVue[];
  tris?: TriVue[];
  groupes?: GroupeVue[];
  proprietesVisibles?: string[];
}

export interface Base extends BaseDRY {
  titre: string;
  icone?: string;
  pageId?: string;
  espaceId?: Espace | string;
  /** Visibilité de la base : « prive » (défaut), « equipe » ou « partage ». */
  section?: SectionPage;
  enLigne?: boolean;
  proprietes?: ProprieteBase[];
  vues?: VueBase[];
  modeles?: Record<string, unknown>[];
}

/* ------------------------------------------------------------------ */
/* Élément (ligne de base)                                              */
/* ------------------------------------------------------------------ */

export type Priorite = 'basse' | 'moyenne' | 'haute' | 'urgente';

export interface Element extends BaseDRY {
  baseId?: Base | string;
  pageId?: string;
  titre: string;
  valeurs?: Record<string, unknown>;
  assigne?: string;
  priorite?: Priorite;
  etiquette?: string;
  dateDebut?: string;
  dateFin?: string;
  sousElements?: Record<string, unknown>[];
}

/* ------------------------------------------------------------------ */
/* Commentaire                                                          */
/* ------------------------------------------------------------------ */

export interface Commentaire extends BaseDRY {
  pageId?: string;
  blocId?: string;
  auteurNom: string;
  auteurAvatar?: string | null;
  contenu: string;
  resolu?: boolean;
  position?: { x?: number; y?: number };
}

/** Message de la messagerie temps réel d'un espace d'équipe. */
export interface MessageEquipe extends BaseDRY {
  espaceId: string;
  pageId?: string | null;
  auteurId?: string;
  auteurNom?: string;
  auteurAvatar?: string | null;
  contenu: string;
}

/** Bloc archivé dans une version de page (instantané). */
export interface BlocVersion {
  type: TypeBloc;
  contenu?: string;
  proprietes?: Record<string, unknown>;
  ordre?: number;
  parentId?: string | null;
  enfants?: unknown[];
}

/** Version (instantané) d'une page, restaurable. */
export interface VersionPage extends BaseDRY {
  pageId: string;
  titre?: string;
  icone?: string | null;
  couverture?: string | null;
  publie?: boolean;
  blocs?: BlocVersion[];
  auteurNom?: string | null;
}

/* ------------------------------------------------------------------ */
/* Modèle (gabarit)                                                     */
/* ------------------------------------------------------------------ */

export type CategorieModele = 'officiel' | 'communaute' | 'perso';

export interface Modele extends BaseDRY {
  nom: string;
  description?: string;
  categorie?: CategorieModele;
  icone?: string;
  baseCible?: string;
  espaceId?: Espace | string;
  contenu?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Connexion (intégration)                                              */
/* ------------------------------------------------------------------ */

export interface Connexion extends BaseDRY {
  type: string;
  nom: string;
  config?: Record<string, unknown>;
  espaceId?: Espace | string;
  active?: boolean;
}

/* ------------------------------------------------------------------ */
/* Favori                                                               */
/* ------------------------------------------------------------------ */

export interface Favori extends BaseDRY {
  pageId: Page | string;
  utilisateurId?: string;
  espaceId?: string;
  ordre?: number;
}

/* ------------------------------------------------------------------ */
/* Notification                                                         */
/* ------------------------------------------------------------------ */

export type TypeNotification = 'mention' | 'commentaire' | 'partage' | 'rappel' | 'systeme';

export interface Notification extends BaseDRY {
  destinataireId?: string;
  type?: TypeNotification;
  titre: string;
  message?: string;
  pageId?: Page | string;
  lu?: boolean;
}

/* ------------------------------------------------------------------ */
/* Membre (espace de travail)                                           */
/* ------------------------------------------------------------------ */

export type RoleMembre = 'admin' | 'membre' | 'invite';
export type StatutMembre = 'invite' | 'actif';

/** Droits fins accordés à un membre de l'espace. */
export interface PermissionsNova {
  lecture: boolean;
  edition: boolean;
  commentaire: boolean;
  partage: boolean;
  admin: boolean;
}

export interface Membre extends BaseDRY {
  email: string;
  nom?: string;
  role?: RoleMembre;
  permissions?: PermissionsNova;
  statut?: StatutMembre;
  utilisateurId?: string;
  avatarUrl?: string | null;
  espaceIds?: string[];
  dateInvitation?: string;
  derniereConnexion?: string;
}

/* ------------------------------------------------------------------ */
/* Paramètre (réglages de l'espace)                                     */
/* ------------------------------------------------------------------ */

export type Apparence = 'clair' | 'sombre' | 'systeme';
export type Police = 'defaut' | 'serif' | 'mono';
export type Plan = 'gratuit' | 'plus' | 'entreprise';

export interface Parametre extends BaseDRY {
  nomEspace: string;
  espaceId?: Espace | string;
  icone?: string;
  domaine?: string;
  apparence?: Apparence;
  police?: Police;
  langue?: string;
  notifEmail?: boolean;
  plan?: Plan;
}

/* ------------------------------------------------------------------ */
/* Publication                                                          */
/* ------------------------------------------------------------------ */

export type PorteePublication = 'web' | 'personnes' | 'invite';
export type AccesPublication = 'lecture' | 'commentaire' | 'edition' | 'complet';

export interface InvitePublication {
  email?: string;
  role?: string;
}

export interface Publication extends BaseDRY {
  pageId: Page | string;
  portee?: PorteePublication;
  domaine?: string;
  acces?: AccesPublication;
  invites?: InvitePublication[];
  actif?: boolean;
}

/* ------------------------------------------------------------------ */
/* Requête IA                                                           */
/* ------------------------------------------------------------------ */

export type TypeRequeteIA =
  | 'question'
  | 'redaction'
  | 'resume'
  | 'traduction'
  | 'autoremplissage'
  | 'agent';

export interface SourceIA {
  titre?: string;
  pageId?: string;
}

export interface RequeteIA extends BaseDRY {
  question: string;
  reponse?: string;
  sources?: SourceIA[];
  modele?: string;
  pageId?: string;
  dureeMs?: number;
  type?: TypeRequeteIA;
}

/* ------------------------------------------------------------------ */
/* Utilisateur / authentification                                       */
/* ------------------------------------------------------------------ */

export interface Utilisateur {
  _id: string;
  name?: string;
  nom?: string;
  email: string;
  role?: string;
  /** Rôle dans l'espace NOVA (synchronisé avec la fiche Membre). */
  novaRole?: RoleMembre | null;
    /** Droits fins dans NOVA. Absent = accès complet (compte propriétaire). */
    novaPermissions?: PermissionsNova | null;
    /** Espaces d'équipe accessibles. Absent = aucun filtrage (propriétaire). */
    novaEspaceIds?: string[];
    avatarUrl?: string | null;
  isPremium?: boolean;
  premiumPlan?: string;
  premiumUntil?: string;
  /** Compte créé par invitation : mot de passe provisoire à changer. */
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionAuth {
  token: string;
  refreshToken: string;
  user: Utilisateur;
}
