/**
 * Utilitaires de filtrage, tri et lecture de valeurs pour les bases de données.
 * Les valeurs d'un élément proviennent de `element.valeurs[nomPropriete]`, plus
 * quelques champs intégrés (titre, priorité, étiquette, assigné, dates).
 */

import type {
  Base,
  Element,
  FiltreVue,
  Priorite,
  ProprieteBase,
  TriVue,
  TypePropriete,
  VueBase as VueBaseDef,
} from '@/lib/types';

/** Liste des opérateurs disponibles par type de propriété. */
export const OPERATEURS: Record<string, { valeur: string; libelle: string }[]> = {
  texte: [
    { valeur: 'contient', libelle: 'contient' },
    { valeur: 'ne_contient_pas', libelle: 'ne contient pas' },
    { valeur: 'est', libelle: 'est' },
    { valeur: 'nest_pas', libelle: "n'est pas" },
    { valeur: 'commence_par', libelle: 'commence par' },
    { valeur: 'finit_par', libelle: 'finit par' },
    { valeur: 'est_vide', libelle: 'est vide' },
    { valeur: 'nest_pas_vide', libelle: "n'est pas vide" },
  ],
  nombre: [
    { valeur: 'egal', libelle: '=' },
    { valeur: 'different', libelle: '≠' },
    { valeur: 'superieur', libelle: '>' },
    { valeur: 'inferieur', libelle: '<' },
    { valeur: 'superieur_ou_egal', libelle: '≥' },
    { valeur: 'inferieur_ou_egal', libelle: '≤' },
  ],
  selection: [
    { valeur: 'est', libelle: 'est' },
    { valeur: 'nest_pas', libelle: "n'est pas" },
    { valeur: 'est_vide', libelle: 'est vide' },
    { valeur: 'nest_pas_vide', libelle: "n'est pas vide" },
  ],
  date: [
    { valeur: 'est', libelle: 'est' },
    { valeur: 'avant', libelle: 'avant' },
    { valeur: 'apres', libelle: 'après' },
    { valeur: 'est_vide', libelle: 'est vide' },
    { valeur: 'nest_pas_vide', libelle: "n'est pas vide" },
  ],
  case: [
    { valeur: 'est_coche', libelle: 'est coché' },
    { valeur: 'nest_pas_coche', libelle: "n'est pas coché" },
  ],
  personne: [
    { valeur: 'est', libelle: 'est' },
    { valeur: 'nest_pas', libelle: "n'est pas" },
    { valeur: 'est_vide', libelle: 'est vide' },
    { valeur: 'nest_pas_vide', libelle: "n'est pas vide" },
  ],
};

/** Renvoie la famille d'opérateurs correspondant à un type de propriété. */
export function familleOperateurs(type?: TypePropriete): keyof typeof OPERATEURS {
  switch (type) {
    case 'nombre':
    case 'formule':
    case 'rollup':
      return 'nombre';
    case 'selection':
    case 'selection_multiple':
    case 'statut':
      return 'selection';
    case 'date':
    case 'cree_le':
    case 'modifie_le':
      return 'date';
    case 'case':
      return 'case';
    case 'personne':
    case 'cree_par':
    case 'modifie_par':
    case 'relation':
      return 'personne';
    default:
      return 'texte';
  }
}

/** Champs intégrés à l'élément, exposés comme des propriétés de la base. */
const CHAMPS_INTEGRES = ['titre', 'priorite', 'etiquette', 'assigne', 'dateDebut', 'dateFin', 'createdAt', 'updatedAt'];

/** Indique si une propriété est un champ intégré de l'élément. */
export function estChampIntegre(nom: string): boolean {
  return CHAMPS_INTEGRES.includes(nom);
}

/** Normalise un nom de propriété pour la comparaison (minuscules, sans accents). */
export function normaliserNom(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Construit le correctif à envoyer à l'API pour écrire une valeur :
 * les champs intégrés sont écrits à la racine, les autres dans `valeurs`.
 */
export function patchValeur(element: Element, nom: string, valeur: unknown): Partial<Element> {
  switch (nom) {
    case 'titre':
      return { titre: String(valeur ?? '') };
    case 'priorite':
      return { priorite: (valeur || undefined) as Priorite | undefined };
    case 'etiquette':
      return { etiquette: valeur === '' || valeur == null ? undefined : String(valeur) };
    case 'assigne':
      return { assigne: valeur === '' || valeur == null ? undefined : String(valeur) };
    case 'dateDebut':
      return { dateDebut: valeur ? String(valeur) : undefined };
    case 'dateFin':
      return { dateFin: valeur ? String(valeur) : undefined };
    default:
      return { valeurs: { ...(element.valeurs || {}), [nom]: valeur } };
  }
}

/** Lit la valeur d'une propriété pour un élément donné. */
export function valeurDe(element: Element, nom: string): unknown {
  if (nom === 'titre') return element.titre;
  if (nom === 'priorite') return element.priorite;
  if (nom === 'etiquette') return element.etiquette;
  if (nom === 'assigne') return element.assigne;
  if (nom === 'dateDebut') return element.dateDebut;
  if (nom === 'dateFin') return element.dateFin;
  if (nom === 'createdAt') return element.createdAt;
  if (nom === 'updatedAt') return element.updatedAt;
  return element.valeurs?.[nom];
}

/** Formate une valeur pour l'affichage compact. */
export function formaterValeur(valeur: unknown): string {
  if (valeur === null || valeur === undefined || valeur === '') return '';
  if (typeof valeur === 'boolean') return valeur ? 'Oui' : 'Non';
  if (Array.isArray(valeur)) return valeur.map((v) => String(v)).join(', ');
  if (typeof valeur === 'object') return JSON.stringify(valeur);
  return String(valeur);
}

/** Applique un filtre unique à une valeur. */
export function correspond(valeur: unknown, operateur: string, cible: unknown): boolean {
  const texte = formaterValeur(valeur).toLowerCase();
  const cibleTexte = formaterValeur(cible).toLowerCase();
  const estVide = valeur === null || valeur === undefined || valeur === '' || (Array.isArray(valeur) && valeur.length === 0);

  switch (operateur) {
    case 'est_vide':
      return estVide;
    case 'nest_pas_vide':
      return !estVide;
    case 'est_coche':
      return valeur === true;
    case 'nest_pas_coche':
      return valeur !== true;
    case 'est':
      return texte === cibleTexte;
    case 'nest_pas':
      return texte !== cibleTexte;
    case 'contient':
      return texte.includes(cibleTexte);
    case 'ne_contient_pas':
      return !texte.includes(cibleTexte);
    case 'commence_par':
      return texte.startsWith(cibleTexte);
    case 'finit_par':
      return texte.endsWith(cibleTexte);
    case 'egal':
      return Number(valeur) === Number(cible);
    case 'different':
      return Number(valeur) !== Number(cible);
    case 'superieur':
      return Number(valeur) > Number(cible);
    case 'inferieur':
      return Number(valeur) < Number(cible);
    case 'superieur_ou_egal':
      return Number(valeur) >= Number(cible);
    case 'inferieur_ou_egal':
      return Number(valeur) <= Number(cible);
    case 'avant':
      return new Date(String(valeur)).getTime() < new Date(String(cible)).getTime();
    case 'apres':
      return new Date(String(valeur)).getTime() > new Date(String(cible)).getTime();
    default:
      return true;
  }
}

/** Applique l'ensemble des filtres d'une vue à une liste d'éléments. */
export function appliquerFiltres(elements: Element[], filtres?: FiltreVue[]): Element[] {
  if (!filtres || filtres.length === 0) return elements;
  return elements.filter((element) =>
    filtres.every((filtre) => correspond(valeurDe(element, filtre.propriete), filtre.operateur, filtre.valeur))
  );
}

/** Applique les tris successifs d'une vue à une liste d'éléments. */
export function appliquerTris(elements: Element[], tris?: TriVue[]): Element[] {
  if (!tris || tris.length === 0) return elements;
  const copie = elements.slice();
  copie.sort((a, b) => {
    for (const tri of tris) {
      const va = valeurDe(a, tri.propriete);
      const vb = valeurDe(b, tri.propriete);
      const sa = formaterValeur(va).toLowerCase();
      const sb = formaterValeur(vb).toLowerCase();
      const na = Number(va);
      const nb = Number(vb);
      const numerique = !Number.isNaN(na) && !Number.isNaN(nb) && sa !== '' && sb !== '';
      let comparaison = numerique ? na - nb : sa.localeCompare(sb);
      if (tri.direction === 'desc') comparaison = -comparaison;
      if (comparaison !== 0) return comparaison;
    }
    return 0;
  });
  return copie;
}

/**
 * Construit la liste des propriétés exploitables d'une base :
 * les propriétés déclarées, complétées par les champs intégrés de l'élément.
 */
export function proprietesDisponibles(base: Base): ProprieteBase[] {
  const declarees = base.proprietes || [];
  const nomsDeclares = new Set(declarees.map((p) => normaliserNom(p.nom)));
  const integres: ProprieteBase[] = (
    [
      { nom: 'priorite', type: 'selection', options: { options: ['basse', 'moyenne', 'haute', 'urgente'] } },
      { nom: 'etiquette', type: 'texte' },
      { nom: 'assigne', type: 'personne' },
      { nom: 'dateDebut', type: 'date' },
      { nom: 'dateFin', type: 'date' },
    ] as ProprieteBase[]
  ).filter((p) => !nomsDeclares.has(normaliserNom(p.nom)));
  return [...declarees, ...integres];
}

/** Options de sélection d'une propriété (pour kanban, filtres, cellules). */
export function optionsDe(propriete?: ProprieteBase): string[] {
  if (!propriete) return [];
  if (normaliserNom(propriete.nom) === 'priorite') return ['basse', 'moyenne', 'haute', 'urgente'];
  switch (propriete.type) {
    case 'statut':
      return propriete.options?.groupes || ['À faire', 'En cours', 'Terminé'];
    case 'selection':
    case 'selection_multiple':
      return propriete.options?.options || [];
    case 'case':
      return ['Oui', 'Non'];
    default:
      return propriete.options?.options || [];
  }
}

/** Propriétés affichées par une vue (colonnes d'un tableau, champs d'une fiche). */
export function proprietesDeVue(base: Base, vue: VueBaseDef): ProprieteBase[] {
  const disponibles = proprietesDisponibles(base).filter((p) => p.type !== 'titre');
  const noms = vue.proprietesVisibles && vue.proprietesVisibles.length > 0;
  if (!noms) return disponibles;
  const voulues = new Set((vue.proprietesVisibles || []).map((n) => normaliserNom(n)));
  const filtrees = disponibles.filter((p) => voulues.has(normaliserNom(p.nom)));
  return filtrees.length > 0 ? filtrees : disponibles;
}

/**
 * Propriété servant à regrouper les éléments (kanban, groupes).
 * Priorité au regroupement explicite de la vue, sinon première propriété de type
 * sélection/statut, sinon le champ intégré « priorite ».
 */
export function proprieteGroupement(base: Base, vue: VueBaseDef): ProprieteBase | undefined {
  const disponibles = proprietesDisponibles(base);
  const nomGroupe = vue.groupes?.[0]?.propriete;
  if (nomGroupe) {
    const trouvee = disponibles.find((p) => normaliserNom(p.nom) === normaliserNom(nomGroupe));
    if (trouvee) return trouvee;
  }
  return (
    disponibles.find((p) => p.type === 'statut') ||
    disponibles.find((p) => p.type === 'selection' || p.type === 'selection_multiple') ||
    disponibles.find((p) => normaliserNom(p.nom) === 'priorite')
  );
}

/** Propriété de type date servant de repère (calendrier, chronologie). */
export function proprieteDate(base: Base, vue: VueBaseDef): ProprieteBase | undefined {
  const disponibles = proprietesDisponibles(base);
  const visibles = new Set((vue.proprietesVisibles || []).map((n) => normaliserNom(n)));
  return (
    disponibles.find((p) => p.type === 'date' && visibles.has(normaliserNom(p.nom))) ||
    disponibles.find((p) => p.type === 'date') ||
    disponibles.find((p) => normaliserNom(p.nom) === 'datedebut') ||
    disponibles.find((p) => normaliserNom(p.nom) === 'datefin')
  );
}

/** Propriétés de début et de fin pour la vue chronologie. */
export function proprietesPeriode(
  base: Base,
  vue: VueBaseDef
): { debut?: ProprieteBase; fin?: ProprieteBase } {
  const disponibles = proprietesDisponibles(base);
  const parNom = (nom: string) => disponibles.find((p) => normaliserNom(p.nom) === nom);
  const datesDeclarees = disponibles.filter((p) => p.type === 'date');
  const debut = parNom('datedebut') || datesDeclarees[0];
  const fin = parNom('datefin') || datesDeclarees.find((p) => p !== debut);
  return { debut, fin: fin || debut };
}
