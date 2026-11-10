/**
 * Utilitaires transverses (formatage de dates en français, classes CSS,
 * manipulations de listes). Aucune dépendance externe : tout est local.
 */

/** Concatène des classes conditionnelles. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Retire la variation-sélecteur (U+FE0F) des emojis pour les comparer. */
export function normaliserEmoji(valeur?: string): string {
  return (valeur || '').replace(/\uFE0F/g, '').trim();
}

/** Génère un identifiant local (pour les clés de listes optimistes). */
export function identifiantLocal(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Tronque une chaîne proprement. */
export function tronquer(texte: string, longueur = 80): string {
  const valeur = texte || '';
  return valeur.length > longueur ? `${valeur.slice(0, longueur - 1)}…` : valeur;
}

/** Dérive des initiales à partir d'un nom ou d'un email. */
export function initiales(source?: string): string {
  if (!source) return '?';
  const base = source.includes('@') ? source.split('@')[0] : source;
  const mots = base.split(/[\s._-]+/).filter(Boolean);
  if (mots.length === 0) return '?';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return `${mots[0][0]}${mots[1][0]}`.toUpperCase();
}

/** Récupère un libellé d'affichage depuis un utilisateur (populate DRY). */
export function nomUtilisateur(u?: { name?: string; nom?: string; email?: string } | string | null): string {
  if (!u) return '';
  if (typeof u === 'string') return '';
  return u.name || u.nom || u.email || '';
}

const formateurDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formateurDateHeure = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Formate une date en français (ex. « 8 nov. 2026 »). */
export function formaterDate(valeur?: string | Date | null): string {
  if (!valeur) return '';
  const date = typeof valeur === 'string' ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return '';
  return formateurDate.format(date);
}

/** Formate une date avec l'heure en français. */
export function formaterDateHeure(valeur?: string | Date | null): string {
  if (!valeur) return '';
  const date = typeof valeur === 'string' ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return '';
  return formateurDateHeure.format(date);
}

/** Décrit une date de façon relative (« Il y a 3 jours », « Demain »). */
export function formaterDateRelative(valeur?: string | Date | null): string {
  if (!valeur) return '';
  const date = typeof valeur === 'string' ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return '';

  const maintenant = new Date();
  const debutJour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const jours = Math.round((debutJour(date) - debutJour(maintenant)) / (24 * 3600 * 1000));

  if (jours === 0) return "Aujourd'hui";
  if (jours === 1) return 'Demain';
  if (jours === -1) return 'Hier';
  if (jours > 1 && jours <= 7) return `Dans ${jours} jours`;
  if (jours < -1 && jours >= -7) return `Il y a ${Math.abs(jours)} jours`;
  return formaterDate(date);
}

/** Convertit une date au format `YYYY-MM-DD` attendu par les champs `<input type="date">`. */
export function versDateInput(valeur?: string | Date | null): string {
  if (!valeur) return '';
  const date = typeof valeur === 'string' ? new Date(valeur) : valeur;
  if (Number.isNaN(date.getTime())) return '';
  const mois = `${date.getMonth() + 1}`.padStart(2, '0');
  const jour = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${mois}-${jour}`;
}

/** Vrai si deux dates tombent le même jour. */
export function memeJour(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

const MOIS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export const NOMS_MOIS = MOIS_FR;

export const NOMS_JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

/** Grille (6 x 7) des jours affichés pour un mois donné, en commençant lundi. */
export function grilleMois(annee: number, mois: number): Date[] {
  const premier = new Date(annee, mois, 1);
  const decalage = (premier.getDay() + 6) % 7; // lundi = 0
  const debut = new Date(annee, mois, 1 - decalage);
  return Array.from({ length: 42 }, (_, i) => new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i));
}

/** Convertit une valeur en tableau sûr. */
export function enTableau<T>(valeur: T[] | T | undefined | null): T[] {
  if (valeur == null) return [];
  return Array.isArray(valeur) ? valeur : [valeur];
}

/** Extrait l'identifiant d'une référence (string ou objet peuplé). */
export function identifiantDe<T extends { _id: string }>(ref?: T | string | null): string {
  if (!ref) return '';
  return typeof ref === 'string' ? ref : ref._id;
}

/** Regroupe des éléments par clé. */
export function grouperPar<T, K extends string | number>(
  liste: T[],
  cle: (item: T) => K
): Record<K, T[]> {
  return liste.reduce((acc, item) => {
    const k = cle(item);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

/** Couleur de texte associée à une priorité (classes Tailwind). */
export function couleurPriorite(priorite?: string): string {
  switch (priorite) {
    case 'urgente':
      return 'text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-300';
    case 'haute':
      return 'text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300';
    case 'moyenne':
      return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300';
    default:
      return 'text-sky-600 bg-sky-50 dark:bg-sky-950/40 dark:text-sky-300';
  }
}

/** Couleur déterministe pour une étiquette (hash simple). */
export function couleurEtiquette(valeur: string): string {
  const palette = [
    'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
  ];
  let hash = 0;
  for (let i = 0; i < valeur.length; i += 1) hash = (hash * 31 + valeur.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}

/** Attend un court délai (utile pour la saisie différée). */
export function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Applique un anti-rebond à une fonction. */
export function antiRebond<A extends unknown[]>(fn: (...args: A) => void, delai = 250) {
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(() => fn(...args), delai);
  };
}
