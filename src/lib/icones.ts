import {
  AlignLeft,
  Ambulance,
  BarChart3,
  BookOpen,
  Bookmark,
  Building2,
  Calculator,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckSquare,
  ChevronRight,
  Code,
  Columns3,
  Database,
  File,
  FileText,
  Fingerprint,
  FlaskConical,
  FolderOpen,
  GitBranch,
  Globe,
  Handshake,
  HardHat,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image as IconeImage,
  Images,
  Kanban,
  LayoutGrid,
  LayoutPanelTop,
  LayoutTemplate,
  Lightbulb,
  Link,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  ListTree,
  Lock,
  Mail,
  Megaphone,
  Minus,
  MonitorPlay,
  Music,
  Navigation,
  NotebookPen,
  NotebookText,
  Orbit,
  Paperclip,
  Phone,
  Puzzle,
  Quote,
  RefreshCw,
  Repeat,
  Rocket,
  Sigma,
  Sparkles,
  Star,
  Table,
  TriangleAlert,
  Type,
  UserRound,
  Video,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

import type {
  TypeBloc,
  TypePropriete,
  TypeVue,
  Priorite,
} from './types';
import { normaliserEmoji } from './utils';

/**
 * Correspondance emoji → icône Lucide.
 *
 * L'application n'affiche JAMAIS d'emoji : les emojis éventuellement présents
 * dans les données (icônes de pages/bases provenant du seed) sont traduits en
 * icônes vectorielles professionnelles. Tout emoji inconnu retombe sur
 * l'icône fournie par l'appelant (par défaut `FileText`).
 */
export const iconeParEmoji: Record<string, LucideIcon> = {
  '🏢': Building2,
  '📄': FileText,
  '📚': BookOpen,
  '🏗': HardHat,
  '🧩': Puzzle,
  '🚑': Ambulance,
  '📝': NotebookPen,
  '📊': BarChart3,
  '📣': Megaphone,
  '🗓': CalendarDays,
  '🔒': Lock,
  '🤝': Handshake,
  '🌐': Globe,
  '🪐': Orbit,
  '💡': Lightbulb,
  '⚠': TriangleAlert,
  '🚀': Rocket,
  '🔬': FlaskConical,
  '🔄': RefreshCw,
  '📓': NotebookText,
  '📁': FolderOpen,
  '📅': Calendar,
  '⭐': Star,
  '🗑': Minus,
  '🔖': Bookmark,
  '📈': BarChart3,
  '🧠': Sparkles,
  '🤖': Sparkles,
  '🔗': Link2,
  '🧪': FlaskConical,
  '📌': Bookmark,
  '✅': CheckSquare,
};

/** Icônes vectorielles par type de bloc (menu slash et rendu). */
export const iconeParTypeBloc: Record<TypeBloc, LucideIcon> = {
  paragraphe: Type,
  titre_1: Heading1,
  titre_2: Heading2,
  titre_3: Heading3,
  titre_4: Heading4,
  titre_5: Heading5,
  titre_6: Heading6,
  liste_a_puces: List,
  liste_numerotee: ListOrdered,
  a_faire: CheckSquare,
  bascule: ChevronRight,
  image: IconeImage,
  video: Video,
  audio: Music,
  fichier: Paperclip,
  signet: Bookmark,
  embed: MonitorPlay,
  tableau: Table,
  base_en_ligne: Database,
  colonne: Columns3,
  separateur: Minus,
  sommaire: ListTree,
  fil_ariane: Navigation,
  encadre: Lightbulb,
  citation: Quote,
  code: Code,
  math: Sigma,
  bouton_modele: LayoutTemplate,
  bloc_synchro: Repeat,
  lien_page: Link2,
  ia_resume: Sparkles,
  ia_actions: ListChecks,
  note: NotebookText,
  onglets: LayoutPanelTop,
  galerie: LayoutGrid,
  galerie_medias: Images,
  graphique: BarChart3,
  raccourci: Link,
  ia_page: Wand2,
};

/** Icônes vectorielles par type de propriété de base. */
export const iconeParTypePropriete: Record<TypePropriete, LucideIcon> = {
  titre: Type,
  texte: AlignLeft,
  nombre: Hash,
  selection: ListChecks,
  selection_multiple: ListChecks,
  statut: RefreshCw,
  case: CheckSquare,
  date: Calendar,
  personne: UserRound,
  fichier: Paperclip,
  url: Link,
  email: Mail,
  telephone: Phone,
  formule: Sigma,
  relation: GitBranch,
  rollup: Calculator,
  id_unique: Fingerprint,
  cree_le: CalendarClock,
  modifie_le: CalendarClock,
  cree_par: UserRound,
  modifie_par: UserRound,
};

/** Icônes vectorielles par type de vue de base. */
export const iconeParTypeVue: Record<TypeVue, LucideIcon> = {
  tableau: Table,
  kanban: Kanban,
  galerie: LayoutGrid,
  liste: List,
  calendrier: CalendarDays,
  chronologie: CalendarRange,
};

/** Résout l'icône à afficher pour un champ `icone` de donnée (emoji ou vide).
 * Un emoji connu est traduit ; sinon on retombe sur `repli`.
 */
export function iconeDepuisChamp(champ: string | undefined, repli: LucideIcon = FileText): LucideIcon {
  if (!champ) return repli;
  const icone = iconeParEmoji[normaliserEmoji(champ)];
  return icone || repli;
}

/**
 * Palette d'icônes proposée à l'utilisateur (pages, espaces, bases).
 * Chaque entrée conserve l'emoji canonique utilisé en base de données :
 * l'interface n'affiche que l'icône vectorielle correspondante.
 */
export const paletteIcones: Array<{ emoji: string; icone: LucideIcon }> = Object.entries(iconeParEmoji).map(
  ([emoji, icone]) => ({ emoji, icone })
);

/** Libellés français des types de blocs (menu slash). */
export const libelleTypeBloc: Record<TypeBloc, string> = {
  paragraphe: 'Texte',
  titre_1: 'Titre 1',
  titre_2: 'Titre 2',
  titre_3: 'Titre 3',
  titre_4: 'Titre 4',
  titre_5: 'Titre 5',
  titre_6: 'Titre 6',
  liste_a_puces: 'Liste à puces',
  liste_numerotee: 'Liste numérotée',
  a_faire: 'Case à cocher',
  bascule: 'Bascule',
  image: 'Image',
  video: 'Vidéo',
  audio: 'Audio',
  fichier: 'Fichier',
  signet: 'Signet',
  embed: 'Intégration',
  tableau: 'Tableau simple',
  base_en_ligne: 'Base de données en ligne',
  colonne: 'Colonnes',
  separateur: 'Séparateur',
  sommaire: 'Sommaire',
  fil_ariane: 'Fil d’Ariane',
  encadre: 'Encadré',
  citation: 'Citation',
  code: 'Code',
  math: 'Équation mathématique',
  bouton_modele: 'Bouton de modèle',
  bloc_synchro: 'Bloc synchronisé',
  lien_page: 'Lien vers une page',
  ia_resume: 'Résumé IA',
  ia_actions: 'Actions IA',
  note: 'Note',
  onglets: 'Onglets',
  galerie: 'Galerie',
  galerie_medias: 'Galerie de médias',
  graphique: 'Graphique',
  raccourci: 'Raccourci',
  ia_page: 'IA → page',
};

/** Libellés français des types de propriétés de base. */
export const libelleTypePropriete: Record<TypePropriete, string> = {
  titre: 'Titre',
  texte: 'Texte',
  nombre: 'Nombre',
  selection: 'Sélection',
  selection_multiple: 'Sélection multiple',
  statut: 'Statut',
  case: 'Case à cocher',
  date: 'Date',
  personne: 'Personne',
  fichier: 'Fichiers et médias',
  url: 'URL',
  email: 'E-mail',
  telephone: 'Téléphone',
  formule: 'Formule',
  relation: 'Relation',
  rollup: 'Rollup',
  id_unique: 'Identifiant unique',
  cree_le: 'Date de création',
  modifie_le: 'Dernière modification',
  cree_par: 'Créé par',
  modifie_par: 'Modifié par',
};

/** Libellés français des types de vues de base. */
export const libelleTypeVue: Record<TypeVue, string> = {
  tableau: 'Tableau',
  kanban: 'Kanban',
  galerie: 'Galerie',
  liste: 'Liste',
  calendrier: 'Calendrier',
  chronologie: 'Chronologie',
};

/** Libellés français des priorités d'élément. */
export const libellePriorite: Record<Priorite, string> = {
  basse: 'Basse',
  moyenne: 'Moyenne',
  haute: 'Haute',
  urgente: 'Urgente',
};

/**
 * Catalogue du menu slash : blocs regroupés par famille, avec mots-clés de
 * recherche. L'ordre met en avant les blocs les plus utilisés (cf. IA.md).
 */
export interface EntreeCatalogueBloc {
  type: TypeBloc;
  libelle: string;
  description: string;
  motsCles: string;
}

export interface GroupeCatalogueBloc {
  famille: string;
  blocs: EntreeCatalogueBloc[];
}

export const catalogueBlocs: GroupeCatalogueBloc[] = [
  {
    famille: 'Essentiels',
    blocs: [
      { type: 'paragraphe', libelle: 'Texte', description: 'Commencer à écrire du texte brut.', motsCles: 'texte paragraphe p' },
      { type: 'titre_1', libelle: 'Titre 1', description: 'Grand titre de section.', motsCles: 'titre h1 heading' },
      { type: 'titre_2', libelle: 'Titre 2', description: 'Titre de sous-section.', motsCles: 'titre h2 heading sous' },
      { type: 'titre_3', libelle: 'Titre 3', description: 'Petit titre.', motsCles: 'titre h3 heading petit' },
      { type: 'titre_4', libelle: 'Titre 4', description: 'Titre de niveau 4.', motsCles: 'titre h4 heading niveau' },
      { type: 'titre_5', libelle: 'Titre 5', description: 'Titre de niveau 5.', motsCles: 'titre h5 heading niveau' },
      { type: 'titre_6', libelle: 'Titre 6', description: 'Titre de niveau 6.', motsCles: 'titre h6 heading niveau' },
      { type: 'liste_a_puces', libelle: 'Liste à puces', description: 'Liste non ordonnée.', motsCles: 'liste puces ul bullet' },
      { type: 'liste_numerotee', libelle: 'Liste numérotée', description: 'Liste ordonnée.', motsCles: 'liste numerotee ol nombre' },
      { type: 'a_faire', libelle: 'Case à cocher', description: 'Suivre les tâches.', motsCles: 'tache todo case cocher' },
      { type: 'bascule', libelle: 'Bascule', description: 'Contenu repliable.', motsCles: 'bascule toggle repli' },
      { type: 'note', libelle: 'Note', description: 'Titre et zone de texte libre.', motsCles: 'note carnet annotation bloc' },
    ],
  },
  {
    famille: 'Médias',
    blocs: [
      { type: 'image', libelle: 'Image', description: 'Insérer une image.', motsCles: 'image photo media' },
      { type: 'video', libelle: 'Vidéo', description: 'Intégrer une vidéo.', motsCles: 'video film media' },
      { type: 'audio', libelle: 'Audio', description: 'Intégrer un fichier audio.', motsCles: 'audio son musique' },
      { type: 'fichier', libelle: 'Fichier', description: 'Joindre un fichier.', motsCles: 'fichier piece jointe upload' },
      { type: 'signet', libelle: 'Signet', description: 'Aperçu d’un lien.', motsCles: 'signet bookmark lien url' },
      { type: 'embed', libelle: 'Intégration', description: 'Intégrer un service externe.', motsCles: 'embed integration iframe figma loom' },
      { type: 'galerie_medias', libelle: 'Galerie de médias', description: 'Grille d’images et de vidéos.', motsCles: 'galerie medias images videos photo film grille' },
    ],
  },
  {
    famille: 'Données & mise en page',
    blocs: [
      { type: 'base_en_ligne', libelle: 'Base de données en ligne', description: 'Base complète dans la page.', motsCles: 'base donnees database table' },
      { type: 'tableau', libelle: 'Tableau simple', description: 'Tableau statique.', motsCles: 'tableau table grille' },
      { type: 'colonne', libelle: 'Colonnes', description: 'Disposer en colonnes.', motsCles: 'colonne layout colonnes' },
      { type: 'sommaire', libelle: 'Sommaire', description: 'Table des matières de la page.', motsCles: 'sommaire toc table matieres' },
      { type: 'fil_ariane', libelle: 'Fil d’Ariane', description: 'Chemin de navigation.', motsCles: 'fil ariane breadcrumb chemin' },
      { type: 'separateur', libelle: 'Séparateur', description: 'Ligne de séparation.', motsCles: 'separateur divider ligne' },
    ],
  },
  {
    famille: 'Annotations',
    blocs: [
      { type: 'encadre', libelle: 'Encadré', description: 'Mettre en avant une information.', motsCles: 'encadre callout note info' },
      { type: 'citation', libelle: 'Citation', description: 'Citer une source.', motsCles: 'citation quote blockquote' },
      { type: 'code', libelle: 'Code', description: 'Bloc de code coloré.', motsCles: 'code snippet langage' },
      { type: 'math', libelle: 'Équation', description: 'Formule mathématique.', motsCles: 'math equation formule katex' },
    ],
  },
  {
    famille: 'Interactif & IA',
    blocs: [
      { type: 'lien_page', libelle: 'Lien vers une page', description: 'Référencer une page existante.', motsCles: 'lien page reference mention' },
      { type: 'bloc_synchro', libelle: 'Bloc synchronisé', description: 'Contenu partagé entre pages.', motsCles: 'synchro synchronise partage' },
      { type: 'bouton_modele', libelle: 'Bouton de modèle', description: 'Dupliquer un modèle en un clic.', motsCles: 'modele template bouton' },
      { type: 'ia_resume', libelle: 'Résumé IA', description: 'Résumé généré automatiquement.', motsCles: 'ia resume summary assistant' },
      { type: 'ia_actions', libelle: 'Actions IA', description: 'Extraire les actions à mener.', motsCles: 'ia actions taches assistant' },
      { type: 'ia_page', libelle: 'IA → page', description: 'Demander à l’IA d’organiser et d’écrire dans la page.', motsCles: 'ia page ecrire generer organiser rendez-vous tableau plan' },
    ],
  },
  {
    famille: 'Avancé',
    blocs: [
      { type: 'onglets', libelle: 'Onglets', description: 'Regrouper du contenu par onglets.', motsCles: 'onglets tabs onglet panneau' },
      { type: 'galerie', libelle: 'Galerie', description: 'Grille d’images.', motsCles: 'galerie images photos grille galerie' },
      { type: 'graphique', libelle: 'Graphique', description: 'Diagramme en barres.', motsCles: 'graphique diagramme barres chart statistiques' },
      { type: 'raccourci', libelle: 'Raccourci', description: 'Renvoi vers une page ou une adresse.', motsCles: 'raccourci shortcut renvoi lien rapide' },
    ],
  },
];
