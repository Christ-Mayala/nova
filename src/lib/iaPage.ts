/**
 * Écriture assistée par l'IA dans une page NOVA.
 *
 * L'assistant transforme une idée (ou un contenu brut) en un plan structuré de
 * blocs, puis ce plan est appliqué à une page :
 *   - `nouvelle_page` : une page est créée avec le contenu ;
 *   - `ajouter`       : le contenu est ajouté à la fin d'une page existante ;
 *   - `remplacer`     : le contenu d'une page existante est remplacé.
 *
 * Toute modification d'une page existante crée au préalable une version de
 * sauvegarde : l'utilisateur peut toujours revenir en arrière depuis
 * l'historique de la page (aucun contenu n'est perdu).
 */
'use client';

import {
  blocs as apiBlocs,
  demanderIA,
  listerTout,
  pages as apiPages,
  versions as apiVersions,
  type MessageIA,
} from '@/lib/api';
import type { Bloc, BlocVersion, Page, ProprietesBloc, TypeBloc, VersionPage } from '@/lib/types';

/** Action appliquée au contenu d'une page. */
export type ActionPlanIA = 'nouvelle_page' | 'ajouter' | 'remplacer';

/** Bloc préparé par l'assistant, avant enregistrement. */
export interface BlocPlanifie {
  type: TypeBloc;
  contenu: string;
  proprietes?: ProprietesBloc;
}

/** Plan d'écriture proposé (ou corrigé) par l'assistant. */
export interface PlanIAPage {
  action: ActionPlanIA;
  titre: string;
  blocs: BlocPlanifie[];
}

/** Types de blocs que l'assistant est autorisé à produire. */
const TYPES_AUTORISES: TypeBloc[] = [
  'titre_1',
  'titre_2',
  'titre_3',
  'paragraphe',
  'liste_a_puces',
  'liste_numerotee',
  'a_faire',
  'encadre',
  'citation',
  'separateur',
  'code',
  'tableau',
  'onglets',
];

/** Clé de comparaison d'un type : minuscules, sans accent ni séparateur. */
export function cleType(valeur: unknown): string {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Types de blocs indexés par clé tolérante (« titre_1 » comme « titre1 »). */
const TYPES_PAR_CLE: Record<string, TypeBloc> = {};
for (const type of TYPES_AUTORISES) TYPES_PAR_CLE[cleType(type)] = type;

const ACTIONS: ActionPlanIA[] = ['nouvelle_page', 'ajouter', 'remplacer'];

/** Consigne donnée à l'assistant : produire un plan de blocs en JSON strict. */
const CONSIGNE_PLAN = `Tu organises des idées dans une page de l'application NOVA.
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, au format :
{"action":"nouvelle_page|ajouter|remplacer","titre":"Titre de la page","blocs":[{"type":"paragraphe","contenu":"texte"}]}
Règles :
- "action" : "nouvelle_page" si le contenu doit aller dans une nouvelle page, "ajouter" s'il complète une page existante, "remplacer" s'il remplace un contenu existant.
- "titre" : titre court et explicite de la page concernée.
- "blocs" : liste ordonnée de blocs ; "type" vaut exactement l'un de : titre_1, titre_2, titre_3, paragraphe, liste_a_puces, liste_numerotee, a_faire, encadre, citation, separateur, code, tableau, onglets.
- "contenu" : le texte du bloc, en français, sans Markdown ni puce (le type porte déjà la puce).
- Pour un bloc "a_faire", ajoute "proprietes":{"coche":false}.
- Pour un bloc "code", ajoute "proprietes":{"langage":"javascript"}.
- Pour un tableau, utilise le type "tableau" avec "contenu":"" et
  "proprietes":{"tableau":{"colonnes":["Colonne 1","Colonne 2"],"lignes":[["valeur","valeur"]]}}.
  Chaque ligne de "lignes" a autant de valeurs que "colonnes". N'écris jamais un tableau en Markdown dans "contenu".
- Pour des onglets, utilise le type "onglets" avec "contenu":"" et
  "proprietes":{"onglets":[{"titre":"Onglet 1","contenu":"texte de l'onglet"}]}.
- N'invente pas d'autre type ni de champ hors de ce format.`;

/** Retire les délimiteurs de code et isole le premier objet JSON du texte. */
export function extraireJson(texte: string): unknown {
  const nettoye = texte.replace(/```(?:json)?/gi, '').trim();
  const debut = nettoye.indexOf('{');
  const fin = nettoye.lastIndexOf('}');
  if (debut === -1 || fin === -1 || fin <= debut) return null;
  try {
    return JSON.parse(nettoye.slice(debut, fin + 1));
  } catch {
    return null;
  }
}

/**
 * Normalise une liste de blocs bruts renvoyés par l'assistant : type inconnu
 * ramené à « paragraphe », tableaux structurés ou écrits en Markdown éclatés.
 */
export function normaliserBlocs(brutBlocs: unknown): BlocPlanifie[] {
  const liste = Array.isArray(brutBlocs) ? brutBlocs : [];
  const blocs: BlocPlanifie[] = [];
  for (const element of liste) {
    if (!element || typeof element !== 'object') continue;
    const entree = element as Record<string, unknown>;
    const type = TYPES_PAR_CLE[cleType(entree.type)] ?? 'paragraphe';
    const contenu = typeof entree.contenu === 'string' ? entree.contenu : '';
    const proprietes =
      entree.proprietes && typeof entree.proprietes === 'object'
        ? (entree.proprietes as ProprietesBloc)
        : undefined;

    // Tableau : accepté en propriétés structurées ou en Markdown dans « contenu ».
    if (type === 'tableau') {
      const tableau = normaliserTableau(proprietes?.tableau, contenu);
      if (tableau) blocs.push({ type: 'tableau', contenu: '', proprietes: { tableau } });
      continue;
    }

    // Un autre bloc peut contenir un tableau Markdown dans son texte.
    if (contenu.includes('|') && contientTableauMarkdown(contenu)) {
      blocs.push(...convertirMarkdownEnBlocs(contenu));
      continue;
    }

    // Un bloc sans texte est ignoré, sauf le séparateur et les onglets dont la
    // matière est portée par les propriétés.
    if (!contenu.trim() && type !== 'separateur' && type !== 'onglets') continue;
    blocs.push({ type, contenu, ...(proprietes ? { proprietes } : {}) });
  }
  return blocs;
}

/** Valide et normalise le plan renvoyé par l'assistant (`null` si illisible). */
function analyserPlan(texte: string): PlanIAPage | null {
  const brut = extraireJson(texte);
  if (!brut || typeof brut !== 'object') return null;
  const objet = brut as Record<string, unknown>;
  const action = ACTIONS.includes(String(objet.action) as ActionPlanIA)
    ? (objet.action as ActionPlanIA)
    : 'nouvelle_page';
  const titre =
    typeof objet.titre === 'string' && objet.titre.trim() ? objet.titre.trim().slice(0, 120) : 'Sans titre';
  const blocs = normaliserBlocs(objet.blocs);
  if (blocs.length === 0) return null;
  return { action, titre, blocs };
}

/** Titre de page déduit de la première ligne d'une demande. */
function titreDepuis(instruction: string): string {
  const premiere =
    instruction
      .split('\n')
      .map((ligne) => ligne.trim())
      .find(Boolean) || 'Sans titre';
  return premiere.replace(/^#{1,6}\s*/, '').slice(0, 80);
}

/** Ligne de délimitation d'un tableau Markdown (ex. `|---|---|`). */
function estSeparateurTableau(ligne: string): boolean {
  return ligne.includes('|') && ligne.includes('-') && /^[\s|:-]+$/.test(ligne);
}

/** Découpe une ligne de tableau Markdown en cellules. */
function decouperLigneTableau(ligne: string): string[] {
  return ligne
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cellule) => cellule.trim());
}

/**
 * Tableau écrit sur une seule ligne (l'assistant a remplacé les retours à la
 * ligne par des espaces) : « | a | b | |---|---| | c | d | ».
 */
function tableauSurLigne(ligne: string): { colonnes: string[]; lignes: string[][] } | null {
  if (!ligne.includes('|')) return null;
  const cellules = ligne.split('|').map((cellule) => cellule.trim());
  const estDelimitation = (cellule: string) => /^:?-+:?$/.test(cellule);
  const debut = cellules.findIndex(estDelimitation);
  if (debut === -1) return null;

  let fin = debut;
  while (fin + 1 < cellules.length && estDelimitation(cellules[fin + 1])) fin += 1;
  const nombre = fin - debut + 1;
  const entete = cellules.slice(0, debut).filter(Boolean);
  if (entete.length === 0) return null;
  const colonnes = entete.length >= nombre ? entete.slice(entete.length - nombre) : entete;

  // Les cellules vides sont les séparateurs de colonne et de ligne d'origine.
  const reste = cellules.slice(fin + 1).filter(Boolean);
  const lignes: string[][] = [];
  for (let i = 0; i < reste.length; i += colonnes.length) {
    lignes.push(colonnes.map((_, j) => reste[i + j] ?? ''));
  }
  return { colonnes, lignes };
}

/** Lit un tableau Markdown à partir de la ligne `depart` (replié ou multiligne). */
function lireTableau(
  lignes: string[],
  depart: number
): { tableau: { colonnes: string[]; lignes: string[][] }; consomme: number } | null {
  const entete = (lignes[depart] ?? '').trim();
  if (!entete.includes('|')) return null;

  const replie = tableauSurLigne(entete);
  if (replie) return { tableau: replie, consomme: 1 };

  if (depart + 1 >= lignes.length || !estSeparateurTableau(lignes[depart + 1].trim())) return null;
  const colonnes = decouperLigneTableau(entete);
  const corps: string[][] = [];
  let index = depart + 2;
  while (index < lignes.length && lignes[index].trim() && lignes[index].includes('|')) {
    const cellules = decouperLigneTableau(lignes[index].trim());
    corps.push(colonnes.map((_, i) => cellules[i] ?? ''));
    index += 1;
  }
  return { tableau: { colonnes, lignes: corps }, consomme: index - depart };
}

/** Le texte contient-il un tableau Markdown (replié ou multiligne) ? */
function contientTableauMarkdown(texte: string): boolean {
  const lignes = texte.replace(/\r\n?/g, '\n').split('\n');
  return lignes.some((_, i) => lireTableau(lignes, i) !== null);
}

/**
 * Normalise un tableau en colonnes + lignes, que l'assistant l'ait fourni en
 * propriétés structurées (`proprietes.tableau`) ou en Markdown dans le contenu.
 */
function normaliserTableau(
  proprietes: unknown,
  contenu: string
): { colonnes: string[]; lignes: string[][] } | null {
  const brut = proprietes as { colonnes?: unknown; lignes?: unknown } | undefined;
  if (brut && Array.isArray(brut.colonnes) && brut.colonnes.length > 0) {
    const colonnes = brut.colonnes.map((valeur) => String(valeur ?? ''));
    const lignes = Array.isArray(brut.lignes)
      ? brut.lignes.map((ligne) =>
          Array.isArray(ligne)
            ? colonnes.map((_, i) => String((ligne as unknown[])[i] ?? ''))
            : colonnes.map(() => '')
        )
      : [];
    return { colonnes, lignes };
  }
  // Repli : tableau écrit en Markdown dans le contenu du bloc.
  const table = convertirMarkdownEnBlocs(contenu).find((bloc) => bloc.type === 'tableau');
  const donnees = table?.proprietes?.tableau as
    | { colonnes: string[]; lignes: string[][] }
    | undefined;
  return donnees ?? null;
}

/** Une ligne Markdown ouvre-t-elle un bloc particulier (fin de paragraphe) ? */
function estLigneSpeciale(ligne: string): boolean {
  return (
    /^(#{1,6})\s+/.test(ligne) ||
    /^>\s?/.test(ligne) ||
    /^[-*+]\s+/.test(ligne) ||
    /^\d+[.)]\s+/.test(ligne) ||
    /^```/.test(ligne) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(ligne)
  );
}

/**
 * Convertit un texte Markdown en blocs NOVA. Sert de repli lorsque l'assistant
 * répond en texte libre plutôt qu'en JSON.
 */
export function convertirMarkdownEnBlocs(markdown: string): BlocPlanifie[] {
  const blocs: BlocPlanifie[] = [];
  const lignes = markdown.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;
  while (index < lignes.length) {
    const ligne = lignes[index].trim();
    if (!ligne) {
      index += 1;
      continue;
    }

    // Bloc de code clôturé par « ``` ».
    if (ligne.startsWith('```')) {
      const langage = ligne.slice(3).trim() || 'text';
      const contenu: string[] = [];
      index += 1;
      while (index < lignes.length && !lignes[index].trim().startsWith('```')) {
        contenu.push(lignes[index]);
        index += 1;
      }
      index += 1;
      blocs.push({ type: 'code', contenu: contenu.join('\n'), proprietes: { langage } });
      continue;
    }

    // Tableau Markdown (replié sur une ligne ou réparti sur plusieurs lignes).
    const table = lireTableau(lignes, index);
    if (table) {
      blocs.push({ type: 'tableau', contenu: '', proprietes: { tableau: table.tableau } });
      index += table.consomme;
      continue;
    }

    // Séparateur horizontal.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(ligne)) {
      blocs.push({ type: 'separateur', contenu: '' });
      index += 1;
      continue;
    }

    // Titres `#` à `######`.
    const titre = /^(#{1,6})\s+(.*)$/.exec(ligne);
    if (titre) {
      const niveau = Math.min(titre[1].length, 6);
      blocs.push({ type: `titre_${niveau}` as TypeBloc, contenu: titre[2].trim() });
      index += 1;
      continue;
    }

    // Citation.
    if (ligne.startsWith('>')) {
      blocs.push({ type: 'citation', contenu: ligne.replace(/^>\s?/, '').trim() });
      index += 1;
      continue;
    }

    // Case à cocher.
    const tache = /^[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(ligne);
    if (tache) {
      blocs.push({
        type: 'a_faire',
        contenu: tache[2].trim(),
        proprietes: { coche: tache[1].toLowerCase() === 'x' },
      });
      index += 1;
      continue;
    }

    // Liste à puces.
    if (/^[-*+]\s+/.test(ligne)) {
      blocs.push({ type: 'liste_a_puces', contenu: ligne.replace(/^[-*+]\s+/, '').trim() });
      index += 1;
      continue;
    }

    // Liste numérotée.
    if (/^\d+[.)]\s+/.test(ligne)) {
      blocs.push({ type: 'liste_numerotee', contenu: ligne.replace(/^\d+[.)]\s+/, '').trim() });
      index += 1;
      continue;
    }

    // Paragraphe : les lignes suivantes sont agrégées jusqu'au prochain bloc.
    const paragraphe = [ligne];
    index += 1;
    while (index < lignes.length) {
      const suite = lignes[index].trim();
      if (!suite || estLigneSpeciale(suite)) break;
      // Début d'un tableau Markdown : le paragraphe s'arrête ici.
      if (lireTableau(lignes, index)) break;
      paragraphe.push(suite);
      index += 1;
    }
    blocs.push({ type: 'paragraphe', contenu: paragraphe.join(' ') });
  }
  return blocs;
}

/**
 * Interroge l'assistant pour obtenir un plan d'écriture structuré.
 * Si la réponse n'est pas un JSON exploitable, son texte est converti en blocs.
 */
export async function demanderPlanIA(instruction: string, contexte?: string): Promise<PlanIAPage> {
  const messages: MessageIA[] = [{ role: 'system', content: CONSIGNE_PLAN }];
  if (contexte && contexte.trim()) {
    messages.push({ role: 'system', content: `Page concernée :\n${contexte.slice(0, 4000)}` });
  }
  messages.push({ role: 'user', content: instruction });

  const { contenu } = await demanderIA(messages, { temperature: 0.2, maxTokens: 2000 });
  if (!contenu.trim()) throw new Error("L'assistant n'a renvoyé aucun contenu.");

  const plan = analyserPlan(contenu);
  if (plan) return plan;

  return {
    action: 'nouvelle_page',
    titre: titreDepuis(instruction),
    blocs: convertirMarkdownEnBlocs(contenu),
  };
}

/** Instantané d'un bloc au format attendu par les versions. */
function versBlocVersion(bloc: Bloc): BlocVersion {
  return {
    type: bloc.type,
    contenu: bloc.contenu,
    proprietes: bloc.proprietes,
    ordre: bloc.ordre,
    parentId: bloc.parentId ?? null,
  };
}

/** Crée les blocs d'un plan, à la suite de l'ordre `depart`. */
async function creerBlocs(pageId: string, blocs: BlocPlanifie[], depart: number): Promise<void> {
  for (let index = 0; index < blocs.length; index += 1) {
    const bloc = blocs[index];
    await apiBlocs.creer({
      pageId,
      type: bloc.type,
      contenu: bloc.contenu,
      proprietes: bloc.proprietes || {},
      ordre: depart + index,
    } as Partial<Bloc>);
  }
}

/** Résultat d'une application : identifiants et mode retenu. */
export interface ResultatPlanIA {
  pageId: string;
  mode: ActionPlanIA;
  page?: Page;
  /** Version de sauvegarde créée avant modification d'une page existante. */
  versionId?: string;
}

/**
 * Applique un plan : crée une page, écrit à la fin d'une page existante ou
 * remplace son contenu. Une version de sauvegarde est systématiquement créée
 * avant toute modification d'une page existante.
 */
export async function appliquerPlanIA(params: {
  action: ActionPlanIA;
  titre: string;
  blocs: BlocPlanifie[];
  pageId?: string;
  espaceId?: string;
  workspaceId?: string;
  parentId?: string | null;
  /** Section de la nouvelle page ; héritée du parent, « prive » par défaut. */
  section?: Page['section'];
  auteurNom?: string | null;
}): Promise<ResultatPlanIA> {
  const blocs = params.blocs.filter(
    (bloc) => bloc.contenu.trim() || bloc.type === 'separateur' || bloc.type === 'tableau'
  );

  // Nouvelle page : aucune sauvegarde nécessaire, la page n'existait pas.
  if (params.action === 'nouvelle_page' || !params.pageId) {
    const page = await apiPages.creer({
      titre: params.titre.trim() || 'Sans titre',
      espaceId: params.espaceId,
      workspaceId: params.workspaceId,
      parentId: params.parentId ?? null,
      section: params.section ?? 'prive',
      ordre: 0,
    } as Partial<Page>);
    await creerBlocs(page._id, blocs, 0);
    return { pageId: page._id, mode: 'nouvelle_page', page };
  }

  const pageId = params.pageId;
  const existants = await listerTout(apiBlocs, { pageId, sort: 'ordre' });
  const page = await apiPages.obtenir(pageId).catch(() => undefined);

  // Sauvegarde obligatoire : l'utilisateur doit pouvoir revenir en arrière.
  const version = await apiVersions.creer({
    pageId,
    titre: page?.titre,
    icone: page?.icone,
    couverture: page?.couverture,
    publie: page?.publie,
    auteurNom: params.auteurNom ?? 'Sauvegarde avant modification IA',
    blocs: existants.map(versBlocVersion),
  } as Partial<VersionPage>);

  if (params.action === 'remplacer') {
    await Promise.all(existants.map((bloc) => apiBlocs.supprimer(bloc._id).catch(() => undefined)));
    await creerBlocs(pageId, blocs, 0);
  } else {
    await creerBlocs(pageId, blocs, existants.length);
  }

  return { pageId, mode: params.action, page, versionId: version._id };
}
