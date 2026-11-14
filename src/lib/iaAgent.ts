/**
 * Agent NOVA : au-delà de l'écriture de blocs, l'assistant agit sur l'espace de
 * travail — il crée des pages et des sous-pages, réécrit une page (avec
 * sauvegarde), renomme / déplace / archive une page, crée une base de données
 * et y ajoute des lignes (rendez-vous, tâches…).
 *
 * L'assistant ne renvoie qu'un plan d'actions en JSON ; c'est ce module qui le
 * traduit en appels réels. Rien n'est inventé : les cibles sont résolues par
 * titre sur le contenu réellement présent (pages connues, bases existantes).
 */
'use client';

import {
  bases as apiBases,
  blocs as apiBlocs,
  demanderIA,
  elements as apiElements,
  listerTout,
  pages as apiPages,
  versions as apiVersions,
  type MessageIA,
} from '@/lib/api';
import {
  appliquerPlanIA,
  cleType,
  convertirMarkdownEnBlocs,
  extraireJson,
  normaliserBlocs,
  type BlocPlanifie,
} from '@/lib/iaPage';
import type {
  Base,
  Bloc,
  Element,
  Page,
  Priorite,
  ProprieteBase,
  TypePropriete,
  VueBase,
} from '@/lib/types';
import { identifiantDe } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Plan d'actions                                                      */
/* ------------------------------------------------------------------ */

/** Crée une page, éventuellement en sous-page d'une page existante. */
export interface ActionCreerPage {
  type: 'creer_page';
  titre: string;
  icone?: string;
  /** Titre de la page parente (sous-page) ou `null` pour une page racine. */
  pageParente?: string | null;
  blocs?: BlocPlanifie[];
}

/** Écrit (ou réécrit) le contenu d'une page existante. */
export interface ActionEcrirePage {
  type: 'ecrire_page';
  /** Titre de la page cible. */
  page: string;
  /** « ajouter » complète la page, « remplacer » la réécrit (sauvegarde créée). */
  mode: 'ajouter' | 'remplacer';
  blocs: BlocPlanifie[];
}

export interface ActionRenommerPage {
  type: 'renommer_page';
  page: string;
  titre: string;
  icone?: string;
}

export interface ActionDeplacerPage {
  type: 'deplacer_page';
  page: string;
  /** Titre de la nouvelle page parente, ou `null` pour remonter à la racine. */
  pageParente: string | null;
}

export interface ActionArchiverPage {
  type: 'archiver_page';
  page: string;
}

export interface ActionCreerBase {
  type: 'creer_base';
  titre: string;
  icone?: string;
  proprietes?: ProprieteBase[];
}

export interface ActionCreerElement {
  type: 'creer_element';
  /** Titre de la base qui reçoit la ligne (créée si elle n'existe pas). */
  base: string;
  titre: string;
  /** Valeurs indexées par nom de propriété. */
  valeurs?: Record<string, unknown>;
  dateDebut?: string;
  dateFin?: string;
  priorite?: Priorite;
}

export interface ActionSupprimerElement {
  type: 'supprimer_element';
  /** Titre de la base qui contient la ou les lignes. */
  base: string;
  /** Supprime une seule ligne : son titre exact. */
  titre?: string;
  /** Supprime les lignes d'une période : borne de début (incluse). */
  du?: string;
  /** Supprime les lignes d'une période : borne de fin (incluse). */
  au?: string;
}

export interface ActionModifierElement {
  type: 'modifier_element';
  /** Titre de la base qui contient la ligne. */
  base: string;
  /** Titre exact de la ligne à modifier. */
  titre: string;
  /** Nouveau titre, si la ligne doit être renommée. */
  nouveauTitre?: string;
  /** Valeurs indexées par nom de propriété (fusionnées avec l'existant). */
  valeurs?: Record<string, unknown>;
  dateDebut?: string;
  dateFin?: string;
  priorite?: Priorite;
}

/**
 * L'assistant ne peut pas agir : il demande une précision. Chaque option est
 * proposée à l'utilisateur, qui la relance d'un clic.
 */
export interface ActionDemander {
  type: 'demander';
  question: string;
  options: Array<{ titre: string; instruction: string }>;
}

/** Action élémentaire produite par l'assistant. */
export type ActionAgent =
  | ActionCreerPage
  | ActionEcrirePage
  | ActionRenommerPage
  | ActionDeplacerPage
  | ActionArchiverPage
  | ActionCreerBase
  | ActionCreerElement
  | ActionModifierElement
  | ActionSupprimerElement
  | ActionDemander;

/** Plan d'actions proposé par l'assistant avant application. */
export interface PlanAgent {
  resume: string;
  actions: ActionAgent[];
}

/* ------------------------------------------------------------------ */
/* Contexte transmis à l'assistant                                     */
/* ------------------------------------------------------------------ */

/** Vue synthétique d'une page existante (résolution des cibles par titre). */
export interface PageConnue {
  id: string;
  titre: string;
  parentId?: string | null;
}

/** Vue synthétique d'une base existante et de ses propriétés. */
export interface BaseConnue {
  id: string;
  titre: string;
  proprietes: Array<{ nom: string; type: string }>;
  /** Lignes déjà présentes : titre et date, pour désigner la bonne ligne. */
  lignes: Array<{ titre: string; date?: string }>;
}

/** Contexte réel remis à l'assistant pour qu'il raisonne sur l'existant. */
export interface ContexteAgent {
  pages: PageConnue[];
  bases: BaseConnue[];
  /** Page ouverte / de contexte : l'assistant peut la lire avant de la réécrire. */
  pageCourante?: {
    id: string;
    titre: string;
    blocs: Array<{ type: string; contenu: string }>;
  };
}

/** Jour normalisé « AAAA-MM-JJ » d'une valeur de date, ou `null` si illisible. */
function jour(valeur: string): string | null {
  const texte = valeur.trim();
  if (!texte) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Format français « 15/11/2026 ».
  const fr = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texte);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}`;
  const date = new Date(texte);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Propriétés de type date d'une base (elles portent l'échéance des lignes). */
function datesDeBase(base: Base): string[] {
  return (base.proprietes || [])
    .filter((propriete) => propriete.type === 'date')
    .map((propriete) => propriete.nom);
}

/**
 * Date affichable d'une ligne : le champ dédié s'il existe, sinon la première
 * propriété de type date renseignée.
 */
function dateLigne(element: Element, nomsDates: string[]): string | undefined {
  if (element.dateDebut) return jour(element.dateDebut) ?? undefined;
  for (const nom of nomsDates) {
    const valeur = element.valeurs?.[nom];
    if (typeof valeur === 'string' && valeur.trim()) return jour(valeur) ?? undefined;
  }
  return undefined;
}

/**
 * Rassemble le contexte réel de l'espace : pages visibles, bases existantes et,
 * si fournie, le contenu de la page courante (pour une refonte en connaissance
 * de cause).
 */
export async function construireContexteAgent(params: {
  pages: Page[];
  pageCouranteId?: string;
}): Promise<ContexteAgent> {
  const [listeBases, listeElements, blocsCourants] = await Promise.all([
    listerTout(apiBases).catch(() => [] as Base[]),
    listerTout(apiElements).catch(() => [] as Element[]),
    params.pageCouranteId
      ? listerTout(apiBlocs, { pageId: params.pageCouranteId, sort: 'ordre' }).catch(() => [] as Bloc[])
      : Promise.resolve([] as Bloc[]),
  ]);
  const page = params.pageCouranteId
    ? params.pages.find((p) => p._id === params.pageCouranteId)
    : undefined;

  return {
    pages: params.pages.map((p) => ({
      id: p._id,
      titre: p.titre || 'Sans titre',
      parentId: p.parentId ?? null,
    })),
    bases: listeBases.map((b) => {
      // Les propriétés de type date servent à afficher l'échéance de chaque
      // ligne : l'utilisateur désigne souvent un rendez-vous par sa date.
      const nomsDates = datesDeBase(b);
      return {
        id: b._id,
        titre: b.titre,
        proprietes: (b.proprietes || []).map((propriete) => ({
          nom: propriete.nom,
          type: propriete.type,
        })),
        lignes: listeElements
          .filter((element) => identifiantDe(element.baseId) === b._id)
          .map((element) => ({ titre: element.titre, date: dateLigne(element, nomsDates) }))
          .filter((ligne) => Boolean(ligne.titre)),
      };
    }),
    pageCourante: page
      ? {
          id: page._id,
          titre: page.titre || 'Sans titre',
          blocs: blocsCourants.map((bloc) => ({ type: bloc.type, contenu: bloc.contenu || '' })),
        }
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/* Consigne de l'assistant                                             */
/* ------------------------------------------------------------------ */

const TYPES_PROPRIETE: TypePropriete[] = [
  'titre',
  'texte',
  'nombre',
  'selection',
  'selection_multiple',
  'statut',
  'case',
  'date',
  'personne',
  'fichier',
  'url',
  'email',
  'telephone',
  'formule',
  'relation',
  'rollup',
];

const PRIORITES: Priorite[] = ['basse', 'moyenne', 'haute', 'urgente'];

/** Consigne donnée à l'assistant : produire un plan d'actions en JSON strict. */
const CONSIGNE_AGENT = `Tu es NOVA, l'assistant qui agit sur l'espace de travail (pages, bases de données, rendez-vous, tâches, contenu).
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour :
{"resume":"phrase courte décrivant ce qui va être fait","actions":[ ... ]}

Types d'actions autorisés (champ "type") :

1. "creer_page" — créer une page ou une sous-page.
   {"type":"creer_page","titre":"...","icone":"emoji facultatif","pageParente":"titre exact d'une page existante ou null","blocs":[ ... ]}
2. "ecrire_page" — écrire ou réécrire le contenu d'une page existante.
   {"type":"ecrire_page","page":"titre exact de la page","mode":"ajouter|remplacer","blocs":[ ... ]}
   "ajouter" complète la fin de la page ; "remplacer" réécrit toute la page (une sauvegarde est créée automatiquement).
3. "renommer_page" — {"type":"renommer_page","page":"...","titre":"nouveau titre","icone":"emoji facultatif"}
4. "deplacer_page" — {"type":"deplacer_page","page":"...","pageParente":"titre de la nouvelle page parente ou null"}
5. "archiver_page" — {"type":"archiver_page","page":"..."} (met la page et ses sous-pages à la corbeille)
6. "creer_base" — créer une base de données.
   {"type":"creer_base","titre":"...","icone":"emoji","proprietes":[{"nom":"Statut","type":"statut","options":{"groupes":["À faire","En cours","Terminé"]}},{"nom":"Échéance","type":"date"}]}
   Types de propriétés : ${TYPES_PROPRIETE.join(', ')}.
7. "creer_element" — ajouter une ligne (rendez-vous, tâche, contact…) dans une base.
   {"type":"creer_element","base":"titre exact de la base","titre":"...","valeurs":{"Nom de propriété":"valeur"},"dateDebut":"ISO facultatif","dateFin":"ISO facultatif","priorite":"basse|moyenne|haute|urgente"}
   Pour un rendez-vous utilise la base "Réunions", pour une tâche la base "Mes tâches" : elles sont créées automatiquement si elles n'existent pas.
8. "modifier_element" — modifier une ligne existante (décaler un rendez-vous, changer un statut, une échéance, un responsable…).
   {"type":"modifier_element","base":"titre exact de la base","titre":"titre exact de la ligne","valeurs":{"Nom de propriété":"nouvelle valeur"},"dateDebut":"ISO facultatif","priorite":"basse|moyenne|haute|urgente","nouveauTitre":"facultatif"}
   Seules les valeurs fournies changent ; les autres sont conservées. Reprends le titre exact de la ligne depuis « Lignes existantes ».
9. "supprimer_element" — supprimer une ligne, ou un groupe de lignes d'une même période, dans une base existante.
   Une ligne précise : {"type":"supprimer_element","base":"titre exact de la base","titre":"titre exact de la ligne"}
   Toutes les lignes d'une période : {"type":"supprimer_element","base":"titre exact de la base","du":"2026-11-15","au":"2026-11-20"}
   La période est en AAAA-MM-JJ, bornes incluses, comme les dates affichées dans « Lignes existantes ». « du » (à partir de) et/ou « au » (jusqu'à) suffisent ; les lignes sans date ne sont jamais supprimées par une période. Ne reprends pas les guillemets ni la date affichée dans le champ "titre". Un mois ou un moment relatif (« de décembre », « ce mois-ci », « cette semaine », « à partir du 15 ») doit être converti en bornes à partir de la « Date du jour » : décembre = du 01 au 31 du mois concerné. Il n'existe AUCUNE action pour vider une base : ne supprime jamais une ligne que l'utilisateur n'a pas désignée par son titre ou sa période. La suppression est définitive (une annulation reste possible juste après).
10. "demander" — quand la demande est trop vague pour agir sans risque, ne devine pas : demande une précision.
   {"type":"demander","question":"Quels rendez-vous faut-il supprimer ?","options":[{"titre":"Ceux de décembre","instruction":"supprime les rendez-vous de décembre"},{"titre":"Un seul","instruction":"supprime un seul rendez-vous : lequel ?"}]}
   2 à 4 options courtes ; "instruction" est la demande complète qui sera relancée si l'utilisateur clique. Utilise "demander" au lieu de "creer_page" quand aucun contenu n'est à produire. Ne t'en sers jamais pour faire confirmer une action déjà demandée : une demande explicite s'exécute directement.

Blocs (champ "blocs") : liste ordonnée d'objets {"type":"...","contenu":"...","proprietes":{...}}.
"type" vaut exactement l'un de : titre_1, titre_2, titre_3, paragraphe, liste_a_puces, liste_numerotee, a_faire, encadre, citation, separateur, code, tableau, onglets.
- "contenu" : le texte du bloc, en français, sans Markdown ni puce (le type porte déjà la puce).
- "a_faire" : ajoute "proprietes":{"coche":false}.
- "code" : ajoute "proprietes":{"langage":"javascript"}.
- "tableau" : "contenu":"" et "proprietes":{"tableau":{"colonnes":["A","B"],"lignes":[["1","2"]]}} ; n'écris jamais un tableau en Markdown.
- "onglets" : "contenu":"" et "proprietes":{"onglets":[{"titre":"Onglet 1","contenu":"texte"}]}.

Règles :
- Choisis l'action adaptée : « crée une page » → creer_page ; « améliore / réécris / mets à jour cette page » → ecrire_page avec "mode":"remplacer" sur cette page ; « ajoute à la fin » → ecrire_page avec "mode":"ajouter".
- « supprime / retire ce rendez-vous, cette tâche, cette ligne » → supprimer_element avec le titre exact de la ligne désignée. « supprime les rendez-vous du 15 au 20 » / « entre le 15 et le 20 » / « à partir du 15 » / « les tâches de décembre » → supprimer_element avec "du"/"au" (un mois se borne au premier et au dernier jour de ce mois, en te basant sur la « Date du jour » et sur les dates affichées dans « Lignes existantes »). Tu peux supprimer une ligne ou un groupe daté : ne réponds jamais qu'aucune action de suppression n'existe. En revanche tu ne vides jamais une base : une demande vague (« supprime mes rendez-vous ») doit être renvoyée à l'utilisateur pour qu'il précise lesquels ou quelle période, plutôt que d'effacer toute la base. Si aucune ligne du contexte ne correspond, n'invente ni titre ni période.
- « décale / change la date / passe la tâche en terminé / change le responsable / renomme cette ligne » → modifier_element sur la ligne existante (« Lignes existantes » donne son titre exact). N'ajoute jamais une ligne pour corriger une ligne existante.
- Si une demande est ambiguë au point qu'agir reviendrait à deviner, réponds par une action "demander" avec 2 à 4 options : l'utilisateur choisira. C'est toujours préférable à une action hasardeuse ou à un refus. En revanche "demander" lève une ambiguïté réelle (quelle cible, quelle période, quel contenu) : ce n'est pas une étape de confirmation. Quand la demande désigne déjà l'action, la cible et la source, exécute-la sans rien demander.
- Si une "Page courante" est fournie et que la demande porte sur « cette page » (améliore, réécris, complète, mets à jour, refonte), la cible est cette page : ecrire_page avec "page" égal à son titre exact.
- Ne crée jamais une page dont le titre existe déjà dans le contexte : écris dans la page existante (ecrire_page).
- Données à suivre dans le temps (dates, échéances, planning, jalons, statuts, responsables, avancement, tâches, rendez-vous) : ce sont des LIGNES DE BASE DE DONNÉES. Crée la base (creer_base) si elle n'existe pas, puis ajoute chaque ligne avec creer_element. N'écris JAMAIS ces données dans un bloc "tableau" et ne les recopie pas dans le texte de la page : cite seulement le nom de la base.
- Le bloc "tableau" est réservé aux petits tableaux statiques de présentation (comparaison, récapitulatif court) ; pour tout suivi modifiable, utilise une base de données.
- Réutilise les pages et les bases existantes listées dans le contexte (titre exact). N'invente pas de cible.
- Une demande peut produire plusieurs actions (ex. créer une base, y ajouter des lignes, puis réécrire la page qui la référence).
- Reste concis : au plus 12 lignes par base et 25 blocs par page, pour que le plan reste court et complet.
- N'invente aucun autre type ni champ hors de ce format.`;

/** Construit le message de contexte (date, pages, bases, page courante). */
function messageContexte(contexte: ContexteAgent): string {
  const lignes: string[] = [`Date du jour : ${new Date().toISOString().slice(0, 10)}`];

  if (contexte.pages.length) {
    lignes.push('Pages existantes (réutilise le titre exact) :');
    contexte.pages.slice(0, 200).forEach((page) => lignes.push(`- « ${page.titre} »`));
  }
  if (contexte.bases.length) {
    lignes.push('Bases existantes :');
    contexte.bases.slice(0, 50).forEach((base) => {
      const proprietes = base.proprietes.map((p) => `${p.nom} (${p.type})`).join(', ');
      lignes.push(`- « ${base.titre} » : ${proprietes || 'aucune propriété'}`);
      if (base.lignes.length) {
        const liste = base.lignes
          .slice(0, 40)
          .map((ligne) => (ligne.date ? `« ${ligne.titre} » (${ligne.date})` : `« ${ligne.titre} »`))
          .join(' | ');
        lignes.push(`  Lignes existantes : ${liste}`);
      }
    });
  }
  if (contexte.pageCourante) {
    lignes.push(`Page courante : « ${contexte.pageCourante.titre} »`);
    // Plafond volontairement large : une page de travail courante dépasse vite
    // quelques milliers de caractères (listes d'actions, plans…). À 4 000, le
    // modèle ne voyait que le début de la page et traitait une partie seulement
    // des actions demandées.
    const contenu = contexte.pageCourante.blocs
      .map((bloc) => `[${bloc.type}] ${bloc.contenu}`)
      .join('\n')
      .slice(0, 20000);
    if (contenu.trim()) lignes.push(`Contenu actuel de la page courante :\n${contenu}`);
  }
  return lignes.join('\n');
}

/* ------------------------------------------------------------------ */
/* Analyse du plan renvoyé                                             */
/* ------------------------------------------------------------------ */

/** Texte nettoyé d'un champ, borné en longueur. */
function texte(valeur: unknown, max: number): string {
  return typeof valeur === 'string' ? valeur.trim().slice(0, max) : '';
}

/** Priorité validée (les autres valeurs sont ignorées). */
function lirePriorite(valeur: unknown): Priorite | undefined {
  const candidat = String(valeur ?? '') as Priorite;
  return PRIORITES.includes(candidat) ? candidat : undefined;
}

/** Propriétés de base validées. */
function lireProprietes(valeur: unknown): ProprieteBase[] | undefined {
  if (!Array.isArray(valeur)) return undefined;
  const liste: ProprieteBase[] = [];
  for (const element of valeur) {
    if (!element || typeof element !== 'object') continue;
    const item = element as Record<string, unknown>;
    const nom = texte(item.nom, 100);
    const type = String(item.type ?? '') as TypePropriete;
    if (!nom || !TYPES_PROPRIETE.includes(type)) continue;
    liste.push({
      nom,
      type,
      options:
        item.options && typeof item.options === 'object'
          ? (item.options as ProprieteBase['options'])
          : undefined,
    });
  }
  return liste.length ? liste : undefined;
}

/** Types d'actions indexés par clé tolérante (« ecrire_page » comme « ecrirepage »). */
const TYPES_ACTION: Record<string, ActionAgent['type']> = {};
for (const type of [
  'creer_page',
  'ecrire_page',
  'renommer_page',
  'deplacer_page',
  'archiver_page',
  'creer_base',
  'creer_element',
  'modifier_element',
  'supprimer_element',
  'demander',
] as ActionAgent['type'][]) {
  TYPES_ACTION[cleType(type)] = type;
}

/** Valide une action brute ; renvoie `null` si elle est inexploitable. */
function analyserAction(element: unknown): ActionAgent | null {
  if (!element || typeof element !== 'object') return null;
  const entree = element as Record<string, unknown>;

  const type = TYPES_ACTION[cleType(entree.type)];
  if (!type) return null;

  switch (type) {
    case 'creer_page': {
      const titre = texte(entree.titre, 200);
      if (!titre) return null;
      return {
        type: 'creer_page',
        titre,
        icone: texte(entree.icone, 8) || undefined,
        pageParente: texte(entree.pageParente, 200) || null,
        blocs: normaliserBlocs(entree.blocs),
      };
    }
    case 'ecrire_page': {
      const page = texte(entree.page, 200);
      const blocs = normaliserBlocs(entree.blocs);
      if (!page || blocs.length === 0) return null;
      return {
        type: 'ecrire_page',
        page,
        mode: entree.mode === 'remplacer' ? 'remplacer' : 'ajouter',
        blocs,
      };
    }
    case 'renommer_page': {
      const page = texte(entree.page, 200);
      const titre = texte(entree.titre, 200);
      if (!page || !titre) return null;
      return { type: 'renommer_page', page, titre, icone: texte(entree.icone, 8) || undefined };
    }
    case 'deplacer_page': {
      const page = texte(entree.page, 200);
      if (!page) return null;
      return { type: 'deplacer_page', page, pageParente: texte(entree.pageParente, 200) || null };
    }
    case 'archiver_page': {
      const page = texte(entree.page, 200);
      return page ? { type: 'archiver_page', page } : null;
    }
    case 'creer_base': {
      const titre = texte(entree.titre, 200);
      if (!titre) return null;
      return {
        type: 'creer_base',
        titre,
        icone: texte(entree.icone, 8) || undefined,
        proprietes: lireProprietes(entree.proprietes),
      };
    }
    case 'creer_element': {
      const base = texte(entree.base, 200);
      const titre = texte(entree.titre, 300);
      if (!base || !titre) return null;
      return {
        type: 'creer_element',
        base,
        titre,
        valeurs:
          entree.valeurs && typeof entree.valeurs === 'object'
            ? (entree.valeurs as Record<string, unknown>)
            : undefined,
        dateDebut: texte(entree.dateDebut, 40) || undefined,
        dateFin: texte(entree.dateFin, 40) || undefined,
        priorite: lirePriorite(entree.priorite),
      };
    }
    case 'modifier_element': {
      const base = texte(entree.base, 200);
      const titre = texte(entree.titre, 300);
      if (!base || !titre) return null;
      return {
        type: 'modifier_element',
        base,
        titre,
        nouveauTitre: texte(entree.nouveauTitre, 300) || undefined,
        valeurs:
          entree.valeurs && typeof entree.valeurs === 'object'
            ? (entree.valeurs as Record<string, unknown>)
            : undefined,
        dateDebut: texte(entree.dateDebut, 40) || undefined,
        dateFin: texte(entree.dateFin, 40) || undefined,
        priorite: lirePriorite(entree.priorite),
      };
    }
    case 'supprimer_element': {
      const base = texte(entree.base, 200);
      const titre = texte(entree.titre, 300);
      const du = jour(texte(entree.du, 20));
      const au = jour(texte(entree.au, 20));
      // Une suppression vise soit une ligne nommée, soit une période bornée :
      // jamais une base entière.
      if (!base || (!titre && !du && !au)) return null;
      return {
        type: 'supprimer_element',
        base,
        titre: titre || undefined,
        du: du || undefined,
        au: au || undefined,
      };
    }
    case 'demander': {
      const question = texte(entree.question, 400);
      if (!question) return null;
      const brutes = Array.isArray(entree.options) ? entree.options : [];
      const options = brutes
        .map((option): ActionDemander['options'][number] | null => {
          // Une option peut être un simple texte : il sert alors de libellé et
          // d'instruction de relance.
          if (typeof option === 'string') {
            const valeur = option.trim().slice(0, 300);
            return valeur ? { titre: valeur, instruction: valeur } : null;
          }
          if (!option || typeof option !== 'object') return null;
          const item = option as Record<string, unknown>;
          const libelle = texte(item.titre ?? item.label, 120);
          const instruction = texte(item.instruction ?? item.demande, 400) || libelle;
          return libelle && instruction ? { titre: libelle, instruction } : null;
        })
        .filter((option): option is ActionDemander['options'][number] => Boolean(option));
      return { type: 'demander', question, options: options.slice(0, 4) };
    }
    default:
      return null;
  }
}

/** Index juste après l'accolade fermante correspondante, ou -1 si tronqué. */
function finObjet(texte: string, debut: number): number {
  let profondeur = 0;
  let dansChaine = false;
  let echappe = false;
  for (let i = debut; i < texte.length; i += 1) {
    const caractere = texte[i];
    if (echappe) {
      echappe = false;
      continue;
    }
    if (caractere === '\\') {
      echappe = true;
      continue;
    }
    if (caractere === '"') {
      dansChaine = !dansChaine;
      continue;
    }
    if (dansChaine) continue;
    if (caractere === '{') profondeur += 1;
    else if (caractere === '}') {
      profondeur -= 1;
      if (profondeur === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Récupère les actions complètes d'un plan tronqué (réponse coupée par la
 * limite de tokens) : on lit le tableau « actions » et on isole chaque objet en
 * équilibrant les accolades. Le dernier objet, incomplet, est abandonné.
 */
function extraireActionsTronquees(texte: string): unknown[] {
  const depart = texte.indexOf('"actions"');
  if (depart === -1) return [];
  const crochet = texte.indexOf('[', depart);
  if (crochet === -1) return [];

  const actions: unknown[] = [];
  let position = crochet + 1;
  while (position < texte.length) {
    while (position < texte.length && /[\s,]/.test(texte[position])) position += 1;
    if (position >= texte.length || texte[position] !== '{') break;
    const fin = finObjet(texte, position);
    if (fin === -1) break;
    try {
      actions.push(JSON.parse(texte.slice(position, fin)));
    } catch {
      // Objet illisible : on passe au suivant, rien n'est bloqué.
    }
    position = fin;
  }
  return actions;
}

/** Résumé lu directement dans le texte (plan tronqué, JSON invalide). */
function extraireResume(texteBrut: string): string {
  const trouve = /"(?:resume|résumé)"\s*:\s*"((?:[^"\\]|\\.)*)"/i.exec(texteBrut);
  return trouve ? trouve[1].replace(/\\"/g, '"').replace(/\\n/g, ' ') : '';
}

/** Valide et normalise le plan renvoyé par l'assistant (`null` si illisible). */
function analyserPlanAgent(contenu: string): PlanAgent | null {
  const brut = extraireJson(contenu);
  const objet = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : null;

  // Plan exploitable, ou plan tronqué dont on récupère les actions complètes.
  const liste = objet && Array.isArray(objet.actions) ? objet.actions : extraireActionsTronquees(contenu);

  const actions: ActionAgent[] = [];
  for (const element of liste) {
    const action = analyserAction(element);
    if (action) actions.push(action);
  }
  if (actions.length === 0) return null;

  const resume = texte(objet?.resume, 300) || texte(extraireResume(contenu), 300);
  return { resume: resume || `${actions.length} action(s) à appliquer`, actions };
}

/** Titre de repli déduit de la première ligne de la demande. */
function titreDepuis(instruction: string): string {
  const premiere =
    instruction
      .split('\n')
      .map((ligne) => ligne.trim())
      .find(Boolean) || 'Sans titre';
  return premiere.replace(/^#{1,6}\s*/, '').slice(0, 80);
}

/* ------------------------------------------------------------------ */
/* Demande à l'assistant                                               */
/* ------------------------------------------------------------------ */

/**
 * Interroge l'assistant pour obtenir un plan d'actions. Si la réponse n'est pas
 * un JSON exploitable, son texte est converti en une unique action de création
 * de page (aucune réponse n'est perdue).
 */
export async function demanderPlanAgent(
  instruction: string,
  contexte: ContexteAgent
): Promise<PlanAgent> {
  const messages: MessageIA[] = [
    { role: 'system', content: CONSIGNE_AGENT },
    { role: 'system', content: messageContexte(contexte) },
    { role: 'user', content: instruction },
  ];

  // Marge suffisante pour un plan complet (base + lignes + réécriture de page)
  // sans allonger inutilement la génération : au-delà, les fournisseurs `:free`
  // dépassaient leur timeout et le plan n'arrivait jamais.
  const { contenu } = await demanderIA(messages, { temperature: 0.2, maxTokens: 5000 });
  if (!contenu.trim()) throw new Error("L'assistant n'a renvoyé aucun contenu.");

  const plan = analyserPlanAgent(contenu);
  if (plan) return plan;

  // Réponse inexploitable : on ne crée jamais une page contenant un JSON brut.
  const brutJson = /^\s*[{[]/.test(contenu) || /"(?:actions|resume|type)"\s*:/.test(contenu);
  const blocs = convertirMarkdownEnBlocs(contenu);
  if (brutJson || blocs.length === 0) {
    // Journalisé pour diagnostiquer le format réellement renvoyé par le modèle.
    console.error('[NOVA agent] plan illisible — réponse brute du modèle :', contenu);
    const apercu = contenu.replace(/\s+/g, ' ').trim().slice(0, 300);
    throw new Error(
      `NOVA n'a pas pu formuler un plan d'actions lisible. Découpez la demande en plusieurs étapes. Début de la réponse reçue : « ${apercu} »`
    );
  }

  return {
    resume: 'Contenu généré converti en page',
    actions: [
      { type: 'creer_page', titre: titreDepuis(instruction), blocs },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Libellés (partagés entre la modale et l'historique)                 */
/* ------------------------------------------------------------------ */

/** Libellé court d'un type d'action. */
export const LIBELLES_ACTION: Record<ActionAgent['type'], string> = {
  creer_page: 'Créer une page',
  ecrire_page: 'Écrire dans une page',
  renommer_page: 'Renommer une page',
  deplacer_page: 'Déplacer une page',
  archiver_page: 'Archiver une page',
  creer_base: 'Créer une base',
  creer_element: 'Ajouter une ligne',
  modifier_element: 'Modifier une ligne',
  supprimer_element: 'Supprimer une ligne',
  demander: 'Précision demandée',
};

/**
 * Une action est exécutable sauf lorsqu'elle demande une précision : celle-ci
 * n'est jamais appliquée, elle propose des choix à l'utilisateur.
 */
export function estExecutable(action: ActionAgent): boolean {
  return action.type !== 'demander';
}

/** Détail lisible d'une action, affiché dans l'aperçu. */
export function decrireAction(action: ActionAgent): string {
  const nombreBlocs = (blocs: BlocPlanifie[]) =>
    `${blocs.length} bloc${blocs.length > 1 ? 's' : ''}`;

  switch (action.type) {
    case 'creer_page':
      return `« ${action.titre} »${action.pageParente ? ` · sous-page de « ${action.pageParente} »` : ''}${
        action.blocs?.length ? ` · ${nombreBlocs(action.blocs)}` : ''
      }`;
    case 'ecrire_page':
      return action.mode === 'remplacer'
        ? `« ${action.page} » · réécriture · ${nombreBlocs(action.blocs)} · sauvegarde créée`
        : `« ${action.page} » · ajout · ${nombreBlocs(action.blocs)}`;
    case 'renommer_page':
      return `« ${action.page} » → « ${action.titre} »`;
    case 'deplacer_page':
      return `« ${action.page} » → ${action.pageParente ? `sous « ${action.pageParente} »` : 'racine'}`;
    case 'archiver_page':
      return `« ${action.page} » envoyée à la corbeille`;
    case 'creer_base':
      return `« ${action.titre} » · ${action.proprietes?.length ?? 0} propriété${
        (action.proprietes?.length ?? 0) > 1 ? 's' : ''
      }`;
    case 'creer_element':
      return `« ${action.titre} » dans la base « ${action.base} »`;
    case 'modifier_element': {
      const champs = [
        action.nouveauTitre ? `titre → « ${action.nouveauTitre} »` : '',
        ...Object.entries(action.valeurs || {}).map(([nom, valeur]) => `${nom} → ${String(valeur)}`),
        action.dateDebut ? `date → ${jour(action.dateDebut) ?? action.dateDebut}` : '',
        action.priorite ? `priorité → ${action.priorite}` : '',
      ].filter(Boolean);
      return `« ${action.titre} » dans « ${action.base} » · ${champs.join(' · ') || 'aucun changement'}`;
    }
    case 'demander':
      return action.question;
    case 'supprimer_element':
      if (action.titre) return `« ${action.titre} » de la base « ${action.base} »`;
      if (action.du && action.au) {
        return `les lignes du ${action.du} au ${action.au} dans « ${action.base} »`;
      }
      return action.du
        ? `les lignes à partir du ${action.du} dans « ${action.base} »`
        : `les lignes jusqu’au ${action.au} dans « ${action.base} »`;
  }
}

/** Résumé textuel d'un plan (enregistré dans l'historique). */
export function resumePlanAgent(plan: PlanAgent): string {
  return [plan.resume, '', ...plan.actions.map((action) => `- ${decrireAction(action)}`)].join('\n');
}

/**
 * Ajuste un plan avant application : une création de page dont le titre
 * correspond à une page déjà existante devient une écriture dans cette page,
 * afin de ne jamais dupliquer une page que l'utilisateur voulait modifier.
 */
export function resoudrePlanAgent(plan: PlanAgent, pages: Page[]): PlanAgent {
  const actions = plan.actions.map((action): ActionAgent => {
    if (action.type !== 'creer_page' || !action.blocs?.length) return action;
    const cible = normaliserTitre(action.titre);
    const existante = pages.find((page) => normaliserTitre(page.titre || '') === cible);
    if (!existante) return action;
    return {
      type: 'ecrire_page',
      page: existante.titre || action.titre,
      mode: 'remplacer',
      blocs: action.blocs,
    };
  });
  return { ...plan, actions };
}

/* ------------------------------------------------------------------ */
/* Aperçu des suppressions                                             */
/* ------------------------------------------------------------------ */

/** Ce qu'une suppression retirera réellement, lu dans les données actuelles. */
export interface ApercuSuppression {
  /** Titres concernés (limités aux douze premiers). */
  titres: string[];
  /** Nombre total de lignes qui seront supprimées. */
  total: number;
  /** La base visée n'existe pas : l'action sera ignorée. */
  baseIntrouvable: boolean;
}

/**
 * Détaille, pour chaque action de suppression du plan, les lignes qu'elle
 * retirera. Permet de valider l'aperçu en connaissance de cause : la
 * suppression est définitive et n'a pas de version de sauvegarde.
 *
 * Le résultat est indexé par la position de l'action dans le plan.
 */
export async function apercuSuppressions(
  plan: PlanAgent,
  params: ParametresAgent
): Promise<Record<number, ApercuSuppression>> {
  const indexes = plan.actions
    .map((action, index) => (action.type === 'supprimer_element' ? index : -1))
    .filter((index) => index >= 0);
  if (indexes.length === 0) return {};

  const [listeBases, listeElements] = await Promise.all([
    listerTout(apiBases).catch(() => [] as Base[]),
    listerTout(apiElements).catch(() => [] as Element[]),
  ]);

  const apercu: Record<number, ApercuSuppression> = {};
  indexes.forEach((index) => {
    const action = plan.actions[index] as ActionSupprimerElement;
    const base = choisirBase(listeBases, action.base, params);
    if (!base) {
      apercu[index] = { titres: [], total: 0, baseIntrouvable: true };
      return;
    }
    const lignes = listeElements.filter(
      (element) => identifiantDe(element.baseId) === base._id
    );
    const visees = lignesVisees(lignes, action, datesDeBase(base));
    apercu[index] = {
      titres: visees.slice(0, 12).map((ligne) => ligne.titre || 'Sans titre'),
      total: visees.length,
      baseIntrouvable: false,
    };
  });
  return apercu;
}

/* ------------------------------------------------------------------ */
/* Application du plan                                                 */
/* ------------------------------------------------------------------ */

export interface ParametresAgent {
  /** Pages visibles de l'espace de travail (résolution des cibles par titre). */
  pages: Page[];
  /** Espace d'équipe par défaut pour les créations. */
  espaceId?: string;
  workspaceId?: string;
  auteurNom?: string | null;
}

export interface ResultatAgent {
  /** Description de chaque action appliquée. */
  faits: string[];
  /** Première page créée (pour proposer d'y naviguer). */
  premierePageId?: string;
}

/** Clé de comparaison de titres : insensible à la casse et aux accents. */
function normaliserTitre(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Bases créées d'office lorsqu'une action les mentionne sans qu'elles existent. */
const BASES_AUTOMATIQUES: Record<string, { icone: string; proprietes: ProprieteBase[]; vues: VueBase[] }> = {
  reunions: {
    icone: '📅',
    proprietes: [
      { nom: 'Date', type: 'date' },
      { nom: 'Heure', type: 'texte' },
      { nom: 'Participants', type: 'personne' },
      { nom: 'Statut', type: 'statut', options: { groupes: ['À venir', 'Confirmée', 'Annulée'] } },
      { nom: 'Ordre du jour', type: 'texte' },
    ],
    vues: [
      { nom: 'Calendrier', type: 'calendrier', proprietesVisibles: ['Date', 'Participants'] },
      {
        nom: 'Tableau',
        type: 'tableau',
        proprietesVisibles: ['Date', 'Heure', 'Participants', 'Statut'],
      },
    ],
  },
  'mes taches': {
    icone: '✅',
    proprietes: [
      { nom: 'Statut', type: 'statut', options: { groupes: ['À faire', 'En cours', 'Terminé'] } },
      { nom: 'Échéance', type: 'date' },
      { nom: 'Priorité', type: 'selection', options: { options: ['Basse', 'Moyenne', 'Haute'] } },
    ],
    vues: [
      { nom: 'Tableau', type: 'tableau' },
      { nom: 'Calendrier', type: 'calendrier', proprietesVisibles: ['Échéance'] },
    ],
  },
};

/** Retrouve une base par titre dans l'espace courant, dans une liste fournie. */
function choisirBase(bases: Base[], nom: string, params: ParametresAgent): Base | null {
  const cible = normaliserTitre(nom.trim() || 'Base');
  return (
    bases.find((base) => {
      if (normaliserTitre(base.titre) !== cible) return false;
      const espaceId = identifiantDe(base.espaceId);
      return !params.espaceId || !espaceId || espaceId === params.espaceId;
    }) ?? null
  );
}

/**
 * Lignes d'une base visées par une suppression : la ligne au titre exact, ou
 * les lignes dont la date tombe dans la période demandée (bornes incluses).
 * Une ligne sans date n'est jamais visée par une période.
 */
function lignesVisees(
  lignes: Element[],
  action: ActionSupprimerElement,
  nomsDates: string[]
): Element[] {
  if (action.titre) {
    const cible = normaliserTitre(action.titre);
    return lignes.filter((ligne) => normaliserTitre(ligne.titre || '') === cible);
  }
  const du = action.du || '';
  const au = action.au || '';
  return lignes.filter((ligne) => {
    const date = dateLigne(ligne, nomsDates);
    if (!date) return false;
    if (du && date < du) return false;
    if (au && date > au) return false;
    return true;
  });
}

/** Retrouve une base par titre dans l'espace courant (sans la créer). */
async function trouverBase(nom: string, params: ParametresAgent): Promise<Base | null> {
  const titre = nom.trim() || 'Base';
  const existantes = await listerTout(apiBases, { titre }).catch(() => [] as Base[]);
  return choisirBase(existantes, titre, params);
}

/** Retrouve une base par titre (dans l'espace courant) ou la crée. */
async function assurerBase(
  nom: string,
  params: ParametresAgent,
  proprietes?: ProprieteBase[],
  icone?: string
): Promise<Base> {
  const titre = nom.trim() || 'Base';
  const trouvee = await trouverBase(titre, params);
  if (trouvee) return trouvee;

  const defaut = BASES_AUTOMATIQUES[normaliserTitre(titre)];
  const proprietesBase: ProprieteBase[] =
    proprietes?.length ? proprietes : defaut?.proprietes ?? [{ nom: 'Titre', type: 'titre' }];
  const vuesBase: VueBase[] = defaut?.vues ?? [{ nom: 'Tableau', type: 'tableau' }];
  return apiBases.creer({
    titre,
    icone: icone || defaut?.icone || '📋',
    espaceId: params.espaceId,
    enLigne: true,
    proprietes: proprietesBase,
    vues: vuesBase,
  } as Partial<Base>);
}

/**
 * Applique un plan d'actions, dans l'ordre. Les pages créées sont aussitôt
 * ajoutées à l'index : une action suivante peut les cibler (sous-page, contenu).
 * Toute modification de page existante passe par `appliquerPlanIA`, qui crée une
 * version de sauvegarde avant d'écrire.
 */
export async function appliquerPlanAgent(
  plan: PlanAgent,
  params: ParametresAgent
): Promise<ResultatAgent> {
  const faits: string[] = [];
  // De quoi défaire chaque action appliquée : enregistré dans le journal pour
  // permettre « Annuler les actions de NOVA » juste après.
  const annulations: Annulation[] = [];
  let premierePageId: string | undefined;

  // Index vivant des pages connues (id → page), alimenté à chaque création.
  const connues = new Map<string, Page>();
  params.pages.forEach((page) => connues.set(page._id, page));

  const chercherPage = (nom: string): Page | undefined => {
    const cle = normaliserTitre(nom);
    const liste = Array.from(connues.values());
    return (
      liste.find((page) => normaliserTitre(page.titre || '') === cle) ??
      liste.find((page) => normaliserTitre(page.titre || '').includes(cle))
    );
  };

  for (const action of plan.actions) {
    switch (action.type) {
      case 'creer_page': {
        const parent = action.pageParente ? chercherPage(action.pageParente) : undefined;
        const resultat = await appliquerPlanIA({
          action: 'nouvelle_page',
          titre: action.titre,
          blocs: action.blocs || [],
          espaceId: parent ? identifiantDe(parent.espaceId) : params.espaceId,
          workspaceId: params.workspaceId,
          parentId: parent?._id ?? null,
          // Hérite la section du parent : une sous-page d'une page d'équipe doit
          // rester visible dans l'arbre d'équipe ; « prive » par défaut à la racine.
          section: parent?.section ?? 'prive',
        });
        if (resultat.page) connues.set(resultat.page._id, resultat.page);
        premierePageId = premierePageId ?? resultat.pageId;
        annulations.push({ type: 'page_creee', pageId: resultat.pageId });
        faits.push(`Page « ${action.titre} » créée`);
        break;
      }

      case 'ecrire_page': {
        const page = chercherPage(action.page);
        if (!page) {
          faits.push(`Page « ${action.page} » introuvable — action ignorée`);
          break;
        }
        const resultat = await appliquerPlanIA({
          action: action.mode,
          titre: page.titre,
          blocs: action.blocs,
          pageId: page._id,
          espaceId: identifiantDe(page.espaceId),
          workspaceId: params.workspaceId,
          auteurNom: params.auteurNom ?? null,
        });
        if (resultat.versionId) annulations.push({ type: 'page_ecrite', versionId: resultat.versionId });
        faits.push(
          action.mode === 'remplacer'
            ? `Contenu de « ${page.titre} » réécrit (sauvegarde créée)`
            : `Contenu ajouté à « ${page.titre} »`
        );
        break;
      }

      case 'renommer_page': {
        const page = chercherPage(action.page);
        if (!page) {
          faits.push(`Page « ${action.page} » introuvable — action ignorée`);
          break;
        }
        annulations.push({
          type: 'page_renommee',
          pageId: page._id,
          titre: page.titre,
          icone: page.icone,
        });
        const maj = await apiPages.maj(page._id, {
          titre: action.titre,
          ...(action.icone ? { icone: action.icone } : {}),
        } as Partial<Page>);
        connues.set(page._id, { ...page, ...maj });
        faits.push(`Page « ${page.titre} » renommée en « ${action.titre} »`);
        break;
      }

      case 'deplacer_page': {
        const page = chercherPage(action.page);
        if (!page) {
          faits.push(`Page « ${action.page} » introuvable — action ignorée`);
          break;
        }
        annulations.push({
          type: 'page_deplacee',
          pageId: page._id,
          parentId: page.parentId ?? null,
        });
        const parent = action.pageParente ? chercherPage(action.pageParente) : undefined;
        const maj = await apiPages.maj(page._id, {
          parentId: parent?._id ?? null,
        } as Partial<Page>);
        connues.set(page._id, { ...page, ...maj });
        faits.push(
          `Page « ${page.titre} » déplacée${parent ? ` sous « ${parent.titre} »` : ' à la racine'}`
        );
        break;
      }

      case 'archiver_page': {
        const page = chercherPage(action.page);
        if (!page) {
          faits.push(`Page « ${action.page} » introuvable — action ignorée`);
          break;
        }
        annulations.push({ type: 'page_archivee', pageId: page._id });
        await apiPages.supprimer(page._id);
        connues.delete(page._id);
        faits.push(`Page « ${page.titre} » envoyée à la corbeille`);
        break;
      }

      case 'creer_base': {
        // Une base déjà présente n'est pas recréée : elle ne doit donc pas être
        // supprimée lors d'une annulation.
        const existante = await trouverBase(action.titre, params);
        const base =
          existante ?? (await assurerBase(action.titre, params, action.proprietes, action.icone));
        if (!existante) annulations.push({ type: 'base_creee', baseId: base._id });
        faits.push(`Base « ${base.titre} » disponible`);
        break;
      }

      case 'creer_element': {
        const base = await assurerBase(action.base, params);
        const lignes = await listerTout(apiElements, { baseId: base._id }).catch(() => [] as Element[]);
        const cible = normaliserTitre(action.titre);
        const jourVise = action.dateDebut ? jour(action.dateDebut) : null;
        // Même titre et même jour (ou aucun jour) : la ligne existe déjà, on la
        // met à jour au lieu de créer un doublon (relancer un plan identique ne
        // duplique donc pas les lignes).
        const doublon = lignes.find((ligne) => {
          if (normaliserTitre(ligne.titre || '') !== cible) return false;
          const jourExistant = ligne.dateDebut ? jour(ligne.dateDebut) : null;
          return jourExistant === jourVise;
        });
        if (doublon) {
          const champs: Partial<Element> = {
            valeurs: { ...(doublon.valeurs || {}), ...(action.valeurs || {}) },
            ...(action.dateFin ? { dateFin: action.dateFin } : {}),
            ...(action.priorite ? { priorite: action.priorite } : {}),
          };
          annulations.push({
            type: 'ligne_modifiee',
            elementId: doublon._id,
            avant: instantane(doublon),
          });
          await apiElements.maj(doublon._id, champs);
          faits.push(`« ${doublon.titre} » déjà présent dans « ${base.titre} » — ligne mise à jour`);
          break;
        }
        const element = await apiElements.creer({
          baseId: base._id,
          titre: action.titre,
          valeurs: action.valeurs || {},
          dateDebut: action.dateDebut,
          dateFin: action.dateFin,
          priorite: action.priorite,
        } as Partial<Element>);
        annulations.push({ type: 'ligne_creee', elementId: element._id });
        faits.push(`« ${element.titre} » ajouté à la base « ${base.titre} »`);
        break;
      }

      case 'modifier_element': {
        const base = await trouverBase(action.base, params);
        if (!base) {
          faits.push(`Base « ${action.base} » introuvable — action ignorée`);
          break;
        }
        const lignes = await listerTout(apiElements, { baseId: base._id }).catch(() => [] as Element[]);
        const cible = normaliserTitre(action.titre);
        const ligne = lignes.find((item) => normaliserTitre(item.titre || '') === cible);
        if (!ligne) {
          faits.push(`Ligne « ${action.titre} » introuvable dans « ${base.titre} » — action ignorée`);
          break;
        }
        // Seules les valeurs fournies sont remplacées ; les autres sont gardées.
        const champs: Partial<Element> = {
          ...(action.nouveauTitre ? { titre: action.nouveauTitre } : {}),
          ...(action.valeurs ? { valeurs: { ...(ligne.valeurs || {}), ...action.valeurs } } : {}),
          ...(action.dateDebut ? { dateDebut: action.dateDebut } : {}),
          ...(action.dateFin ? { dateFin: action.dateFin } : {}),
          ...(action.priorite ? { priorite: action.priorite } : {}),
        };
        annulations.push({ type: 'ligne_modifiee', elementId: ligne._id, avant: instantane(ligne) });
        await apiElements.maj(ligne._id, champs);
        faits.push(`« ${action.nouveauTitre || ligne.titre} » modifié dans la base « ${base.titre} »`);
        break;
      }

      case 'demander': {
        // L'assistant réclame une précision : rien n'est appliqué, la modale
        // propose les options à l'utilisateur.
        faits.push(`Précision demandée : ${action.question}`);
        break;
      }

      case 'supprimer_element': {
        const base = await trouverBase(action.base, params);
        if (!base) {
          faits.push(`Base « ${action.base} » introuvable — action ignorée`);
          break;
        }
        const lignes = await listerTout(apiElements, { baseId: base._id }).catch(() => [] as Element[]);
        const supprimees = lignesVisees(lignes, action, datesDeBase(base));
        if (supprimees.length === 0) {
          faits.push(`Aucune ligne visée dans la base « ${base.titre} » — action ignorée`);
          break;
        }
        for (const ligne of supprimees) {
          await apiElements.supprimer(ligne._id);
          annulations.push({ type: 'ligne_supprimee', ligne: instantane(ligne) });
        }
        faits.push(
          supprimees.length === 1
            ? `« ${supprimees[0].titre} » supprimé de la base « ${base.titre} »`
            : `${supprimees.length} lignes supprimées de la base « ${base.titre} »`
        );
        break;
      }
    }
  }

  // Le journal n'est écrit que si quelque chose a été appliqué : il rend la
  // dernière application annulable.
  if (annulations.length > 0) {
    enregistrerApplication({
      date: new Date().toISOString(),
      resume: plan.resume,
      faits,
      annulations,
    });
  }

  return { faits, premierePageId };
}

/* ------------------------------------------------------------------ */
/* Journal des applications (annulation)                               */
/* ------------------------------------------------------------------ */

/** Instantané d'une ligne, suffisant pour la recréer ou la remettre en état. */
interface InstantaneLigne {
  baseId: string;
  titre: string;
  valeurs?: Record<string, unknown>;
  assigne?: string;
  priorite?: Priorite;
  etiquette?: string;
  dateDebut?: string;
  dateFin?: string;
}

/** Ce qu'il faut pour défaire une action appliquée par l'agent. */
type Annulation =
  | { type: 'page_creee'; pageId: string }
  | { type: 'page_ecrite'; versionId: string }
  | { type: 'page_renommee'; pageId: string; titre: string; icone?: string }
  | { type: 'page_deplacee'; pageId: string; parentId: string | null }
  | { type: 'page_archivee'; pageId: string }
  | { type: 'base_creee'; baseId: string }
  | { type: 'ligne_creee'; elementId: string }
  | { type: 'ligne_supprimee'; ligne: InstantaneLigne }
  | { type: 'ligne_modifiee'; elementId: string; avant: InstantaneLigne };

/** Une application de l'agent, avec de quoi la défaire intégralement. */
export interface ApplicationAgent {
  date: string;
  resume: string;
  faits: string[];
  annulations: Annulation[];
}

const CLE_JOURNAL = 'nova.agent.journal';
const JOURNAL_MAX = 5;

/** Instantané minimal d'une ligne, pour pouvoir la rétablir. */
function instantane(ligne: Element): InstantaneLigne {
  return {
    baseId: identifiantDe(ligne.baseId),
    titre: ligne.titre,
    valeurs: ligne.valeurs,
    assigne: ligne.assigne,
    priorite: ligne.priorite,
    etiquette: ligne.etiquette,
    dateDebut: ligne.dateDebut,
    dateFin: ligne.dateFin,
  };
}

function lireJournal(): ApplicationAgent[] {
  if (typeof window === 'undefined') return [];
  try {
    const brut = window.localStorage.getItem(CLE_JOURNAL);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? (liste as ApplicationAgent[]) : [];
  } catch {
    return [];
  }
}

function ecrireJournal(liste: ApplicationAgent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLE_JOURNAL, JSON.stringify(liste.slice(0, JOURNAL_MAX)));
  } catch {
    // Stockage indisponible : l'annulation n'est simplement pas proposée.
  }
}

function enregistrerApplication(application: ApplicationAgent): void {
  ecrireJournal([application, ...lireJournal()]);
}

/** Dernière application de l'agent, tant qu'elle n'a pas été annulée. */
export function derniereApplication(): ApplicationAgent | null {
  return lireJournal()[0] ?? null;
}

/** Retire la dernière application du journal sans rien défaire. */
export function oublierDerniereApplication(): void {
  ecrireJournal(lireJournal().slice(1));
}

/**
 * Annule la dernière application : chaque action est défaite en sens inverse,
 * afin que les dépendances créées restent cohérentes (une ligne est supprimée
 * avant la base qui l'accueille). Les échecs partiels sont signalés sans
 * interrompre le reste.
 */
export async function annulerDerniereApplication(): Promise<string[]> {
  const [derniere, ...reste] = lireJournal();
  if (!derniere) return [];

  const faits: string[] = [];
  for (const annulation of [...derniere.annulations].reverse()) {
    try {
      switch (annulation.type) {
        case 'page_creee':
          await apiPages.supprimer(annulation.pageId);
          faits.push('Page créée supprimée');
          break;
        case 'page_ecrite':
          await apiVersions.restaurer(annulation.versionId);
          faits.push('Contenu de page restauré');
          break;
        case 'page_renommee':
          await apiPages.maj(annulation.pageId, {
            titre: annulation.titre,
            ...(annulation.icone ? { icone: annulation.icone } : {}),
          } as Partial<Page>);
          faits.push('Titre de page rétabli');
          break;
        case 'page_deplacee':
          await apiPages.maj(annulation.pageId, {
            parentId: annulation.parentId,
          } as Partial<Page>);
          faits.push('Page remise à sa place');
          break;
        case 'page_archivee':
          await apiPages.restaurer(annulation.pageId);
          faits.push('Page restaurée depuis la corbeille');
          break;
        case 'base_creee':
          await apiBases.supprimer(annulation.baseId);
          faits.push('Base créée supprimée');
          break;
        case 'ligne_creee':
          await apiElements.supprimer(annulation.elementId);
          faits.push('Ligne créée supprimée');
          break;
        case 'ligne_supprimee':
          await apiElements.creer(annulation.ligne as Partial<Element>);
          faits.push(`Ligne « ${annulation.ligne.titre} » rétablie`);
          break;
        case 'ligne_modifiee':
          await apiElements.maj(annulation.elementId, annulation.avant as Partial<Element>);
          faits.push(`Ligne « ${annulation.avant.titre} » remise dans son état précédent`);
          break;
      }
    } catch (e) {
      faits.push(`Annulation partielle : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    }
  }

  ecrireJournal(reste);
  return faits;
}
