'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Bold,
  ChevronDown,
  ChevronRight,
  Code,
  Columns3,
  Copy,
  Download,
  Eraser,
  ExternalLink,
  FileText,
  GripVertical,
  Highlighter,
  Italic,
  Lightbulb,
  Link2,
  List,
  Loader2,
  PaintBucket,
  Palette,
  Paperclip,
  Plus,
  Sparkles,
  Strikethrough,
  Trash2,
  Underline,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import katex from 'katex';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Highlight, themes } from 'prism-react-renderer';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import {
  ChampAuto,
  ChampRiche,
  EVENEMENT_FORMAT_CHAMP,
} from '@/components/editeur/ChampAuto';
import { filtrerCatalogue, MenuSlash, MenuTransformer } from '@/components/editeur/MenuSlash';
import { ModaleAgentIA } from '@/components/editeur/ModaleAgentIA';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Menu, MenuElement, MenuSeparateur, MenuTitre } from '@/components/ui/Menu';
import { Modale } from '@/components/ui/Modale';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { demanderIA, medias } from '@/lib/api';
import { iconeParTypeBloc, libelleTypeBloc } from '@/lib/icones';
import { construireContexteAgent, demanderPlanAgent, type PlanAgent } from '@/lib/iaAgent';
import { lienEspace, lienPage } from '@/lib/navigation';
import type { Bloc, Page, TypeBloc } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

/** Entrée du sommaire : un titre de la page avec son niveau hiérarchique. */
export interface TitreSommaire {
  id: string;
  niveau: number;
  texte: string;
}

interface ProprietesBlocEditeur {
  bloc: Bloc;
  titres: TitreSommaire[];
  textePage: string;
  onContenu: (valeur: string) => void;
  onPropriete: (cle: string, valeur: unknown) => void;
  onType: (type: TypeBloc) => void;
  onSupprimer: () => void;
  onAjouterApres: (type?: TypeBloc) => void;
  onDeplacer: (direction: 'haut' | 'bas') => void;
  onDupliquer: () => void;
  onFocusPrecedent: () => void;
  /** Crée une base de données rattachée à la page (bloc « base en ligne »). */
  onCreerBase?: () => void;
  /** Recharge les blocs de la page (après une écriture assistée par l'IA). */
  onRechargerBlocs?: () => void;
  /** Glisser-déposer : le bloc vient d'être saisi (début du déplacement). */
  onGlisserDebut?: () => void;
  /** Glisser-déposer : le curseur survole ce bloc, à la position indiquée. */
  onGlisserSur?: (position: 'avant' | 'apres') => void;
  /** Glisser-déposer : le déplacement est terminé (dépôt ou annulation). */
  onGlisserFin?: () => void;
  /** Glisser-déposer : le bloc est déposé à cet endroit. */
  onDeposer?: () => void;
  /** Ce bloc est en cours de déplacement (rendu atténué). */
  enGlissement?: boolean;
  /** Repère d'insertion affiché au-dessus ou en dessous de ce bloc. */
  positionInsertion?: 'avant' | 'apres' | null;
}

/**
 * Page verrouillée (ou droits insuffisants) : tous les blocs deviennent des
 * blocs de consultation, sans possibilité de saisie.
 */
const ContexteLectureSeule = createContext(false);

/** Fournit l'état « page verrouillée » aux blocs de la page. */
export function FournisseurLectureSeule({
  verrouille,
  children,
}: {
  verrouille: boolean;
  children: ReactNode;
}) {
  return <ContexteLectureSeule.Provider value={verrouille}>{children}</ContexteLectureSeule.Provider>;
}

/** Un bloc de la page est-il en lecture seule ? */
export function useLectureSeule(): boolean {
  const { peutEditer } = useAuth();
  return !peutEditer || useContext(ContexteLectureSeule);
}

/** Types de blocs dont le texte accepte le formatage Markdown (gras, italique…). */
const TYPES_TEXTE_RICHE: TypeBloc[] = [
  'paragraphe',
  'titre_1',
  'titre_2',
  'titre_3',
  'titre_4',
  'titre_5',
  'titre_6',
  'liste_a_puces',
  'liste_numerotee',
  'a_faire',
  'bascule',
  'citation',
  'encadre',
];

/**
 * Échelles de taille de texte proposées par la barre d'outils (comme sur Word :
 * on agrandit ou on réduit le texte du bloc par paliers).
 */
const TAILLES_TEXTE = [0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3];

/** Normalise la taille de texte stockée dans les propriétés d'un bloc. */
function echelleTexte(valeur: unknown): number {
  const nombre = Number(valeur);
  if (!Number.isFinite(nombre) || nombre <= 0) return 1;
  return Math.min(TAILLES_TEXTE[TAILLES_TEXTE.length - 1], Math.max(TAILLES_TEXTE[0], nombre));
}

/** Palier le plus proche d'une échelle (pour naviguer dans `TAILLES_TEXTE`). */
function palierTaille(echelle: number): number {
  let meilleur = 0;
  TAILLES_TEXTE.forEach((taille, index) => {
    if (Math.abs(taille - echelle) < Math.abs(TAILLES_TEXTE[meilleur] - echelle)) meilleur = index;
  });
  return meilleur;
}

/** Niveau d'imbrication maximal d'un bloc (indentation Tab). */
export const INDENTATION_MAX = 5;

/** Niveau d'imbrication d'un bloc, normalisé entre 0 et `INDENTATION_MAX`. */
export function indentationDe(bloc: Bloc): number {
  const valeur = Number((bloc.proprietes as Record<string, unknown> | undefined)?.indentation);
  if (!Number.isFinite(valeur) || valeur <= 0) return 0;
  return Math.min(INDENTATION_MAX, Math.floor(valeur));
}

/** Couleurs proposées par la barre d'outils (texte et arrière-plan). */
const COULEURS_FORMAT: Array<{ cle: string; nom: string; texte: string; fond: string }> = [
  { cle: 'defaut', nom: 'Par défaut', texte: '', fond: '' },
  { cle: 'gris', nom: 'Gris', texte: '#787774', fond: 'rgba(120, 119, 116, 0.28)' },
  { cle: 'rouge', nom: 'Rouge', texte: '#e03e3e', fond: 'rgba(224, 62, 62, 0.28)' },
  { cle: 'orange', nom: 'Orange', texte: '#d9730d', fond: 'rgba(217, 115, 13, 0.28)' },
  { cle: 'jaune', nom: 'Jaune', texte: '#c29300', fond: 'rgba(223, 171, 1, 0.32)' },
  { cle: 'vert', nom: 'Vert', texte: '#0f7b6c', fond: 'rgba(15, 123, 108, 0.28)' },
  { cle: 'bleu', nom: 'Bleu', texte: '#0b6e99', fond: 'rgba(11, 110, 153, 0.28)' },
  { cle: 'violet', nom: 'Violet', texte: '#6940a5', fond: 'rgba(105, 64, 165, 0.28)' },
  { cle: 'rose', nom: 'Rose', texte: '#ad1a72', fond: 'rgba(173, 26, 114, 0.28)' },
];

/** Petit sélecteur de couleur (texte ou arrière-plan) de la barre d'outils. */
function PaletteCouleur({
  libelle,
  icone: Icone,
  fond,
  onChoisir,
  onDefaut,
}: {
  libelle: string;
  icone: LucideIcon;
  fond?: boolean;
  onChoisir: (debut: string) => void;
  /** Rétablit la couleur par défaut (sans couleur). */
  onDefaut: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', surClic);
    return () => document.removeEventListener('mousedown', surClic);
  }, [ouvert]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={libelle}
        aria-label={libelle}
        aria-expanded={ouvert}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOuvert((o) => !o)}
        className="flex h-6 w-6 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Icone className="h-3.5 w-3.5" />
      </button>
      {ouvert && (
        <div className="menu-flottant absolute left-0 top-full z-50 mt-1 w-44 p-1">
          <p className="px-1.5 py-1 text-xs font-medium texte-faible">{libelle}</p>
          <div className="grid grid-cols-5 gap-0.5">
            {COULEURS_FORMAT.map((couleur) => {
              const defaut = couleur.cle === 'defaut';
              return (
                <button
                  key={couleur.cle}
                  type="button"
                  title={couleur.nom}
                  aria-label={couleur.nom}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (defaut) onDefaut();
                    else onChoisir(fond ? `{fond-${couleur.cle}:` : `{${couleur.cle}:`);
                    setOuvert(false);
                  }}
                  className="flex h-7 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded border text-[11px] font-semibold"
                    style={
                      defaut
                        ? { borderColor: 'var(--bordure)', color: 'var(--texte)' }
                        : fond
                          ? { backgroundColor: couleur.fond, borderColor: 'transparent' }
                          : { color: couleur.texte, borderColor: 'var(--bordure)' }
                    }
                  >
                    {defaut ? (
                      fond ? (
                        <span className="block h-px w-3.5 rotate-45" style={{ backgroundColor: 'var(--texte-faible)' }} />
                      ) : (
                        'A'
                      )
                    ) : fond ? (
                      ''
                    ) : (
                      'A'
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Un bloc de la page : rendu, édition, menu slash et actions contextuelles. */
export function BlocEditeur({
  bloc,
  titres,
  textePage,
  onContenu,
  onPropriete,
  onType,
  onSupprimer,
  onAjouterApres,
  onDeplacer,
  onDupliquer,
  onFocusPrecedent,
  onCreerBase,
  onRechargerBlocs,
  onGlisserDebut,
  onGlisserSur,
  onGlisserFin,
  onDeposer,
  enGlissement,
  positionInsertion,
}: ProprietesBlocEditeur) {
  const [menuSlash, setMenuSlash] = useState<{ ouvert: boolean; requete: string; index: number }>({
    ouvert: false,
    requete: '',
    index: 0,
  });
  /** Le bloc devient glissable uniquement lorsqu'on saisit sa poignée. */
  const [pretAGlisser, setPretAGlisser] = useState(false);

  const texte = bloc.contenu || '';
  const formatable = TYPES_TEXTE_RICHE.includes(bloc.type);
  const echelle = echelleTexte(bloc.proprietes?.tailleTexte);
  /** État de repli de la bascule, lu directement dans les propriétés du bloc. */
  const basculeOuverte = Boolean(bloc.proprietes?.ouvert);
  const verrouille = useLectureSeule();

  /** Agrandit (`delta = 1`) ou réduit (`delta = -1`) la taille du texte du bloc. */
  function changerTaille(delta: number) {
    const suivant = Math.min(
      TAILLES_TEXTE.length - 1,
      Math.max(0, palierTaille(echelle) + delta)
    );
    if (TAILLES_TEXTE[suivant] === echelle) return;
    onPropriete('tailleTexte', TAILLES_TEXTE[suivant]);
  }

  /** Applique un formatage Markdown autour de la sélection du bloc. */
  function formater(avant: string, apres: string = avant) {
    window.dispatchEvent(
      new CustomEvent(EVENEMENT_FORMAT_CHAMP, { detail: { id: bloc._id, avant, apres } })
    );
  }

  /** Retire tous les marqueurs de formatage de la sélection. */
  function effacerFormatage() {
    window.dispatchEvent(
      new CustomEvent(EVENEMENT_FORMAT_CHAMP, {
        detail: { id: bloc._id, avant: '', apres: '', nettoyer: true },
      })
    );
  }

  /** Rétablit la couleur par défaut (retire la couleur du texte ou du fond). */
  function defautCouleur(fond: boolean) {
    window.dispatchEvent(
      new CustomEvent(EVENEMENT_FORMAT_CHAMP, {
        detail: { id: bloc._id, avant: '', apres: '', retirer: fond ? 'fond' : 'couleur' },
      })
    );
  }

  /**
   * Demande une adresse puis transforme la sélection en lien Markdown.
   * Sans sélection, l'URL sert de texte : le lien s'affiche aussitôt, sans
   * avoir à saisir un libellé supplémentaire.
   */
  function insererLien() {
    const url = window.prompt('Adresse du lien (URL)', 'https://');
    if (url === null) return;
    const adresse = url.trim() || 'https://';
    window.dispatchEvent(
      new CustomEvent(EVENEMENT_FORMAT_CHAMP, {
        detail: { id: bloc._id, avant: '[', apres: `](${adresse})`, repli: adresse },
      })
    );
  }

  /** Gère les raccourcis clavier communs à tous les blocs textuels. */
  function surTouche(e: KeyboardEvent<HTMLTextAreaElement>) {
    const cible = e.currentTarget;

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
      const touche = e.key.toLowerCase();
      const raccourcis: Record<string, () => void> = {
        b: () => formater('**'),
        i: () => formater('*'),
        u: () => formater('++'),
        e: () => formater('`'),
        k: () => insererLien(),
      };
      if (formatable && raccourcis[touche]) {
        e.preventDefault();
        raccourcis[touche]();
        return;
      }
    }

    if (menuSlash.ouvert) {
      const liste = filtrerCatalogue(menuSlash.requete);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuSlash((m) => ({ ...m, index: (m.index + 1) % Math.max(liste.length, 1) }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuSlash((m) => ({ ...m, index: (m.index - 1 + liste.length) % Math.max(liste.length, 1) }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const choix = liste[menuSlash.index];
        if (choix) choisirType(choix.type);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuSlash({ ouvert: false, requete: '', index: 0 });
        return;
      }
    }

    // Tab / Maj+Tab : imbrique ou désimbrique le bloc (indentation).
    if (e.key === 'Tab' && formatable) {
      e.preventDefault();
      const actuel = indentationDe(bloc);
      const suivant = e.shiftKey ? actuel - 1 : actuel + 1;
      onPropriete('indentation', Math.max(0, Math.min(INDENTATION_MAX, suivant)));
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAjouterApres();
      return;
    }

    if (e.key === 'Backspace' && texte === '' && cible.selectionStart === 0) {
      e.preventDefault();
      onFocusPrecedent();
      onSupprimer();
    }
  }

  /** Détecte la saisie de « / » en début de bloc pour ouvrir le menu slash. */
  function surChangement(valeur: string) {
    if (valeur.startsWith('/')) {
      setMenuSlash({ ouvert: true, requete: valeur.slice(1), index: 0 });
      onContenu('');
      return;
    }
    if (menuSlash.ouvert) setMenuSlash({ ouvert: false, requete: '', index: 0 });
    onContenu(valeur);
  }

  function choisirType(type: TypeBloc) {
    setMenuSlash({ ouvert: false, requete: '', index: 0 });
    onType(type);
  }

  return (
    <div
      className={cn(
        'group/bloc relative flex items-start',
        enGlissement && 'opacity-40'
      )}
      style={{ marginLeft: `${indentationDe(bloc) * 1.5}rem` }}
      draggable={pretAGlisser && !verrouille}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        // Firefox n'amorce pas le glissement sans données : le type suffit.
        e.dataTransfer.setData('text/plain', bloc._id);
        onGlisserDebut?.();
      }}
      onDragEnd={() => {
        setPretAGlisser(false);
        onGlisserFin?.();
      }}
      onDragOver={(e) => {
        if (verrouille || !onGlisserSur) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const apres = e.clientY > rect.top + rect.height / 2;
        onGlisserSur(apres ? 'apres' : 'avant');
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDeposer?.();
      }}
    >
      {/* Repère d'insertion pendant le glisser-déposer. */}
      {positionInsertion === 'avant' && (
        <span className="pointer-events-none absolute -top-px left-0 right-0 z-10 h-0.5 rounded bg-sky-500" />
      )}
      {positionInsertion === 'apres' && (
        <span className="pointer-events-none absolute -bottom-px left-0 right-0 z-10 h-0.5 rounded bg-sky-500" />
      )}

      {/* Poignée de déplacement et insertion (masquée en lecture seule) */}
      {!verrouille && (
        <div className="absolute -left-14 top-0 flex h-7 items-center gap-0.5 opacity-0 transition-opacity group-hover/bloc:opacity-100">
          <button
            type="button"
            onClick={() => onAjouterApres()}
            className="flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Ajouter un bloc en dessous"
          >
            <Plus className="h-4 w-4" />
          </button>
          <Menu
            alignement="gauche"
            largeur="w-72"
            declencheur={
              <button
                type="button"
                onMouseDown={() => setPretAGlisser(true)}
                onMouseUp={() => setPretAGlisser(false)}
                title="Glisser pour déplacer, cliquer pour les options"
                className="flex h-6 w-6 cursor-grab items-center justify-center rounded texte-faible hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"
                aria-label="Options du bloc"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            }
          >
            <div>
              <MenuElement icone={ArrowUp} onClick={() => onDeplacer('haut')}>
                Déplacer vers le haut
              </MenuElement>
              <MenuElement icone={ArrowDown} onClick={() => onDeplacer('bas')}>
                Déplacer vers le bas
              </MenuElement>
              <MenuElement icone={Copy} onClick={onDupliquer}>
                Dupliquer
              </MenuElement>
              <MenuElement icone={Trash2} danger onClick={onSupprimer}>
                Supprimer
              </MenuElement>
              <MenuSeparateur />
              <MenuTitre>Transformer en</MenuTitre>
              <MenuTransformer onChoisir={onType} />
            </div>
          </Menu>
        </div>
      )}

      {/* Barre d'outils de formatage du texte.
          Elle n'apparaît que pour le bloc réellement en cours d'édition
          (`focus-within`) : le survol d'un autre bloc ne fait plus surgir ses
          options de formatage, ce qui évitait de s'y perdre. */}
      {formatable && !verrouille && (
        <div
          className="pointer-events-none absolute -top-9 left-0 z-20 flex items-center gap-0.5 rounded-md border p-0.5 opacity-0 shadow-sm transition-opacity group-focus-within/bloc:pointer-events-auto group-focus-within/bloc:opacity-100"
          style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond)' }}
        >
          {[
            { icone: Bold, titre: 'Gras (Ctrl+B)', action: () => formater('**') },
            { icone: Italic, titre: 'Italique (Ctrl+I)', action: () => formater('*') },
            { icone: Underline, titre: 'Souligné (Ctrl+U)', action: () => formater('++') },
            { icone: Strikethrough, titre: 'Barré', action: () => formater('~~') },
            { icone: Code, titre: 'Code en ligne (Ctrl+E)', action: () => formater('`') },
            { icone: Highlighter, titre: 'Surlignage jaune', action: () => formater('==') },
          ].map(({ icone: Icone, titre, action }) => (
            <button
              key={titre}
              type="button"
              title={titre}
              aria-label={titre}
              onMouseDown={(e) => e.preventDefault()}
              onClick={action}
              className="flex h-6 w-6 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Icone className="h-3.5 w-3.5" />
            </button>
          ))}

          <span className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--bordure)' }} />

          {/* Taille du texte : réduire / agrandir, comme sur Word. */}
          <button
            type="button"
            title="Réduire la taille du texte"
            aria-label="Réduire la taille du texte"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changerTaille(-1)}
            disabled={palierTaille(echelle) === 0}
            className="flex h-6 items-center justify-center rounded px-1 text-[11px] font-semibold texte-doux hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
          >
            A−
          </button>
          <button
            type="button"
            title="Rétablir la taille normale (100 %)"
            aria-label="Rétablir la taille normale"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPropriete('tailleTexte', 1)}
            className="min-w-[38px] rounded px-1 text-center text-[11px] tabular-nums texte-faible hover:bg-black/5 dark:hover:bg-white/10"
          >
            {Math.round(echelle * 100)}%
          </button>
          <button
            type="button"
            title="Agrandir la taille du texte"
            aria-label="Agrandir la taille du texte"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => changerTaille(1)}
            disabled={palierTaille(echelle) === TAILLES_TEXTE.length - 1}
            className="flex h-6 items-center justify-center rounded px-1 text-[11px] font-semibold texte-doux hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10"
          >
            A+
          </button>

          <span className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--bordure)' }} />

          <PaletteCouleur
            libelle="Couleur du texte"
            icone={Palette}
            onChoisir={(debut) => formater(debut, '}')}
            onDefaut={() => defautCouleur(false)}
          />
          <PaletteCouleur
            libelle="Couleur d'arrière-plan"
            icone={PaintBucket}
            fond
            onChoisir={(debut) => formater(debut, '}')}
            onDefaut={() => defautCouleur(true)}
          />

          <span className="mx-0.5 h-4 w-px" style={{ backgroundColor: 'var(--bordure)' }} />

          <button
            type="button"
            title="Insérer un lien (Ctrl+K)"
            aria-label="Insérer un lien"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insererLien}
            className="flex h-6 w-6 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Effacer le formatage"
            aria-label="Effacer le formatage"
            onMouseDown={(e) => e.preventDefault()}
            onClick={effacerFormatage}
            className="flex h-6 w-6 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        className="relative min-w-0 flex-1"
        style={echelle === 1 ? undefined : { fontSize: `${echelle}em` }}
      >
        <RenduBloc
          bloc={bloc}
          texte={texte}
          titres={titres}
          textePage={textePage}
          basculeOuverte={basculeOuverte}
          surChangement={surChangement}
          surTouche={surTouche}
          onContenu={onContenu}
          onPropriete={onPropriete}
          onCreerBase={onCreerBase}
          onRechargerBlocs={onRechargerBlocs}
        />
        {menuSlash.ouvert && (
          <MenuSlash
            liste={filtrerCatalogue(menuSlash.requete)}
            indexActif={menuSlash.index}
            onChoisir={choisirType}
            onSurvol={(index) => setMenuSlash((m) => ({ ...m, index }))}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rendu selon le type de bloc                                         */
/* ------------------------------------------------------------------ */

/**
 * Tailles des titres exprimées en `em` (et non en `rem`) : elles suivent ainsi
 * la taille de texte choisie pour le bloc dans la barre d'outils.
 */
const CLASSES_TITRE: Record<string, string> = {
  titre_1: 'text-[1.875em] font-bold leading-tight',
  titre_2: 'text-[1.5em] font-semibold leading-tight',
  titre_3: 'text-[1.25em] font-semibold leading-tight',
  titre_4: 'text-[1.125em] font-semibold leading-tight',
  titre_5: 'text-[1em] font-semibold leading-tight',
  titre_6: 'text-[0.875em] font-semibold uppercase tracking-wide leading-tight',
};

function RenduBloc({
  bloc,
  texte,
  titres,
  textePage,
  basculeOuverte,
  surChangement,
  surTouche,
  onContenu,
  onPropriete,
  onCreerBase,
  onRechargerBlocs,
}: {
  bloc: Bloc;
  texte: string;
  titres: TitreSommaire[];
  textePage: string;
  basculeOuverte: boolean;
  surChangement: (valeur: string) => void;
  surTouche: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onContenu: (valeur: string) => void;
  onPropriete: (cle: string, valeur: unknown) => void;
  onCreerBase?: () => void;
  onRechargerBlocs?: () => void;
}) {
  // Les blocs textuels utilisent le champ enrichi (aperçu Markdown + édition),
  // les autres restent sur la zone de texte simple.
  const formatable = TYPES_TEXTE_RICHE.includes(bloc.type);
  const verrouille = useLectureSeule();
  const champ = (className?: string, placeholder?: string) =>
    formatable ? (
      <ChampRiche
        valeur={texte}
        onChange={surChangement}
        onKeyDown={surTouche}
        identifiant={bloc._id}
        placeholder={placeholder}
        className={className}
        lectureSeule={verrouille}
      />
    ) : (
      <ChampAuto
        valeur={texte}
        onChange={surChangement}
        onKeyDown={surTouche}
        data-bloc={bloc._id}
        placeholder={placeholder}
        className={className}
        readOnly={verrouille}
      />
    );

  switch (bloc.type) {
    case 'titre_1':
    case 'titre_2':
    case 'titre_3':
    case 'titre_4':
    case 'titre_5':
    case 'titre_6':
      return (
        <div className="py-0.5">
          {champ(`font-bold ${CLASSES_TITRE[bloc.type]}`, `Titre ${bloc.type.slice(-1)}`)}
        </div>
      );

    case 'liste_a_puces':
      return (
        <div className="flex items-start gap-2 py-0.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--texte)' }} />
          {champ()}
        </div>
      );

    case 'liste_numerotee':
      return (
        <div className="flex items-start gap-2 py-0.5">
          <span className="mt-1 w-4 shrink-0 text-right texte-doux">1.</span>
          {champ()}
        </div>
      );

    case 'a_faire':
      return (
        <div className="flex items-start gap-2 py-0.5">
          <input
            type="checkbox"
            checked={Boolean(bloc.proprietes?.coche)}
            onChange={(e) => onPropriete('coche', e.target.checked)}
            className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded border-neutral-400 accent-sky-500"
            aria-label="Tâche terminée"
          />
          {champ(Boolean(bloc.proprietes?.coche) ? 'line-through texte-doux' : undefined, 'À faire')}
        </div>
      );

    case 'bascule':
      return (
        <div className="py-0.5">
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => onPropriete('ouvert', !basculeOuverte)}
              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={basculeOuverte ? 'Replier' : 'Déplier'}
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', basculeOuverte && 'rotate-90')} />
            </button>
            {champ('font-medium', 'Bascule')}
          </div>
          {basculeOuverte && (
            <div className="ml-6 mt-1 text-sm texte-faible">
              Glissez des blocs en dessous puis indentez-les (Tab) : ils se
              replient avec cette bascule.
            </div>
          )}
        </div>
      );

    case 'citation':
      return (
        <div className="border-l-[3px] py-0.5 pl-3" style={{ borderColor: 'var(--texte)' }}>
          {champ(undefined, 'Citer une source…')}
        </div>
      );

    case 'encadre':
      return (
        <div
          className="flex items-start gap-2.5 rounded-md p-3"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
          {champ(undefined, 'Mettre en avant une information…')}
        </div>
      );

    case 'code':
      return <BlocCode bloc={bloc} onContenu={onContenu} onPropriete={onPropriete} />;

    case 'math':
      return <BlocMath bloc={bloc} onContenu={onContenu} />;

    case 'separateur':
      return (
        <div className="py-2">
          <div className="h-px w-full" style={{ backgroundColor: 'var(--bordure-forte)' }} />
        </div>
      );

    case 'image':
    case 'video':
    case 'audio':
    case 'fichier':
    case 'signet':
    case 'embed':
      return <BlocMedia bloc={bloc} onPropriete={onPropriete} />;

    case 'sommaire':
      return <BlocSommaire titres={titres} />;

    case 'fil_ariane':
      return <BlocFilAriane pageId={bloc.pageId} />;

    case 'colonne':
      return <BlocColonnes bloc={bloc} onPropriete={onPropriete} />;

    case 'tableau':
      return <BlocTableau bloc={bloc} onPropriete={onPropriete} />;

    case 'base_en_ligne':
      return <BlocBaseEnLigne onCreerBase={verrouille ? undefined : onCreerBase} />;

    case 'note':
      return <BlocNote bloc={bloc} onContenu={onContenu} onPropriete={onPropriete} />;

    case 'onglets':
      return <BlocOnglets bloc={bloc} onPropriete={onPropriete} />;

    case 'galerie':
      return <BlocGalerie bloc={bloc} onPropriete={onPropriete} />;

    case 'galerie_medias':
      return <BlocGalerieMedias bloc={bloc} onPropriete={onPropriete} />;

    case 'graphique':
      return <BlocGraphique bloc={bloc} onPropriete={onPropriete} />;

    case 'raccourci':
      return <BlocRaccourci bloc={bloc} onPropriete={onPropriete} />;

    case 'lien_page':
      return <BlocLienPage bloc={bloc} onPropriete={onPropriete} />;

    case 'ia_page':
      return <BlocIaPage bloc={bloc} onContenu={onContenu} onRechargerBlocs={onRechargerBlocs} />;

    case 'ia_resume':
    case 'ia_actions':
      return <BlocIA bloc={bloc} textePage={textePage} onPropriete={onPropriete} />;

    case 'bloc_synchro':
    case 'bouton_modele':
      return (
        <BlocPlaceholder
          icone={iconeParTypeBloc[bloc.type]}
          titre={libelleTypeBloc[bloc.type]}
          description={texte || descriptionParType(bloc.type)}
        />
      );

    default:
      return <div className="py-0.5">{champ(undefined, "Écrivez quelque chose, ou tapez « / » pour insérer un bloc…")}</div>;
  }
}

/** Descriptions par défaut des blocs spéciaux/IA. */
function descriptionParType(type: TypeBloc): string {
  switch (type) {
    case 'lien_page':
      return 'Référence vers une autre page de l’espace de travail.';
    case 'bloc_synchro':
      return 'Contenu partagé et synchronisé entre plusieurs pages.';
    case 'bouton_modele':
      return 'Insère un modèle prédéfini en un clic.';
    case 'ia_resume':
      return 'Résumé généré automatiquement à partir de la page.';
    case 'ia_actions':
      return 'Extrait les actions à mener depuis le contenu de la page.';
    default:
      return '';
  }
}

/** Extensions de fichiers lues directement par la balise `<video>` / `<audio>`. */
const EXTENSIONS_VIDEO = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i;
const EXTENSIONS_AUDIO = /\.(mp3|wav|ogg|oga|m4a|aac|flac)(\?.*)?$/i;
const EXTENSIONS_IMAGE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|tiff?)(\?.*)?$/i;

/**
 * Nature réelle d'un média déduite de son URL. Plus fiable que le type du
 * bloc : un fichier vidéo importé dans un bloc « Image » (ou l'inverse) reste
 * ainsi affiché avec le bon lecteur au lieu d'être ignoré.
 */
function natureMedia(url: string): 'video' | 'audio' | 'image' | null {
  const propre = url.trim();
  if (!propre) return null;
  if (EXTENSIONS_VIDEO.test(propre)) return 'video';
  if (EXTENSIONS_AUDIO.test(propre)) return 'audio';
  if (EXTENSIONS_IMAGE.test(propre)) return 'image';
  // Cloudinary peut livrer une URL sans extension : le segment de livraison
  // (`/video/upload/`, `/image/upload/`) indique alors la nature du média.
  if (/res\.cloudinary\.com\/[^/]+\/video\/upload\//i.test(propre)) return 'video';
  if (/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(propre)) return 'image';
  return null;
}

/**
 * Convertit l'URL d'un service connu en URL intégrable dans une `iframe`
 * (YouTube, Vimeo, Loom, Figma). Renvoie `null` si le service n'est pas géré.
 */
function urlIntegrable(url: string): string | null {
  const propre = url.trim();
  if (!propre) return null;
  try {
    const adresse = new URL(propre);
    const hote = adresse.hostname.replace(/^www\./, '');
    if (hote === 'youtube.com' || hote === 'm.youtube.com') {
      const identifiant = adresse.searchParams.get('v');
      if (identifiant) return `https://www.youtube.com/embed/${identifiant}`;
      const chemin = /^\/(?:embed|shorts|live)\/([\w-]+)/.exec(adresse.pathname);
      if (chemin) return `https://www.youtube.com/embed/${chemin[1]}`;
    }
    if (hote === 'youtu.be') {
      const identifiant = adresse.pathname.slice(1);
      if (identifiant) return `https://www.youtube.com/embed/${identifiant}`;
    }
    if (hote === 'vimeo.com') {
      const chemin = /^\/(\d+)/.exec(adresse.pathname);
      if (chemin) return `https://player.vimeo.com/video/${chemin[1]}`;
    }
    if (hote === 'loom.com') {
      const chemin = /^\/(?:share|embed)\/([\w-]+)/.exec(adresse.pathname);
      if (chemin) return `https://www.loom.com/embed/${chemin[1]}`;
    }
    if (hote === 'figma.com') {
      return `https://www.figma.com/embed?embed_host=nova&url=${encodeURIComponent(propre)}`;
    }
    return null;
  } catch {
    return null;
  }
}

/** Nom de fichier lisible extrait d'une URL (pour les blocs « fichier »). */
function nomFichier(url: string): string {
  try {
    const chemin = new URL(url).pathname;
    const nom = decodeURIComponent(chemin.split('/').filter(Boolean).pop() || '');
    return nom || url;
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Bloc code (coloration syntaxique) et bloc équation (KaTeX)           */
/* ------------------------------------------------------------------ */

/** Langages proposés pour la coloration syntaxique. */
const LANGAGES_CODE: Array<{ valeur: string; libelle: string }> = [
  { valeur: 'javascript', libelle: 'JavaScript' },
  { valeur: 'typescript', libelle: 'TypeScript' },
  { valeur: 'jsx', libelle: 'JSX' },
  { valeur: 'tsx', libelle: 'TSX' },
  { valeur: 'python', libelle: 'Python' },
  { valeur: 'json', libelle: 'JSON' },
  { valeur: 'bash', libelle: 'Bash' },
  { valeur: 'sql', libelle: 'SQL' },
  { valeur: 'css', libelle: 'CSS' },
  { valeur: 'markup', libelle: 'HTML' },
  { valeur: 'go', libelle: 'Go' },
  { valeur: 'rust', libelle: 'Rust' },
  { valeur: 'java', libelle: 'Java' },
  { valeur: 'yaml', libelle: 'YAML' },
  { valeur: 'markdown', libelle: 'Markdown' },
];

/** Bloc de code : coloration syntaxique à l'affichage, édition au clic. */
function BlocCode({
  bloc,
  onContenu,
  onPropriete,
}: {
  bloc: Bloc;
  onContenu: (valeur: string) => void;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const [edition, setEdition] = useState(false);
  const [langageOuvert, setLangageOuvert] = useState(false);
  const code = bloc.contenu || '';
  const langage = String(bloc.proprietes?.langage || 'javascript');
  const libelleLangage = LANGAGES_CODE.find((l) => l.valeur === langage)?.libelle || langage;

  const choisirLangage = (valeur: string) => {
    onPropriete('langage', valeur);
    setLangageOuvert(false);
  };

  return (
    <div className="my-1 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--bordure)' }}>
      <div
        className="relative flex items-center justify-between px-2.5 py-1 text-xs"
        style={{ backgroundColor: 'var(--fond-secondaire)' }}
      >
        {peutEditer ? (
          <button
            type="button"
            onClick={() => setLangageOuvert((o) => !o)}
            className="flex items-center gap-1 rounded px-1 py-0.5 texte-doux hover:bg-black/5 dark:hover:bg-white/10"
          >
            {libelleLangage}
            <ChevronDown className="h-3 w-3" />
          </button>
        ) : (
          <span className="texte-doux">{libelleLangage}</span>
        )}
        <div className="flex items-center gap-1">
          {peutEditer && (
            <button
              type="button"
              onClick={() => setEdition((e) => !e)}
              className="rounded px-1 py-0.5 texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            >
              {edition ? 'Terminer' : 'Modifier'}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(code)}
            className="rounded px-1 py-0.5 texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Copier le code"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        {langageOuvert && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              aria-label="Fermer"
              onClick={() => setLangageOuvert(false)}
            />
            <div
              className="menu-flottant absolute right-2 top-7 z-20 max-h-64 w-40 overflow-y-auto p-1"
              role="menu"
            >
              {LANGAGES_CODE.map((langageItem) => (
                <button
                  key={langageItem.valeur}
                  type="button"
                  onClick={() => choisirLangage(langageItem.valeur)}
                  className={cn(
                    'menu-item w-full text-left text-sm',
                    langageItem.valeur === langage && 'lien-barre-actif'
                  )}
                >
                  {langageItem.libelle}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {edition && peutEditer ? (
        <ChampAuto
          valeur={code}
          onChange={onContenu}
          placeholder="// votre code…"
          spellCheck={false}
          className="w-full p-3 font-mono text-[13px] leading-relaxed"
        />
      ) : (
        <Highlight theme={themes.oneDark} code={code.replace(/\n$/, '')} language={langage}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={cn(className, 'overflow-x-auto p-3 font-mono text-[13px] leading-relaxed')}
              style={{ ...style, margin: 0, background: 'transparent' }}
            >
              {tokens.map((ligne, index) => (
                <div key={index} {...getLineProps({ line: ligne })}>
                  {ligne.map((jeton, cle) => (
                    <span key={cle} {...getTokenProps({ token: jeton })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      )}
    </div>
  );
}

/** Bloc équation : rendu KaTeX en aperçu, saisie LaTeX en édition. */
function BlocMath({
  bloc,
  onContenu,
}: {
  bloc: Bloc;
  onContenu: (valeur: string) => void;
}) {
  const peutEditer = !useLectureSeule();
  const [edition, setEdition] = useState(false);
  const expression = bloc.contenu || '';

  const html = (() => {
    try {
      return katex.renderToString(expression || '\\text{Équation vide}', {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      return '';
    }
  })();

  if (edition && peutEditer) {
    return (
      <div className="my-1 rounded-md border p-3" style={{ borderColor: 'var(--bordure)' }}>
        <ChampAuto
          valeur={expression}
          onChange={onContenu}
          onBlur={() => setEdition(false)}
          placeholder="\\frac{a}{b}"
          spellCheck={false}
          className="w-full font-mono text-sm"
        />
        <p className="mt-1 text-xs texte-faible">
          Syntaxe LaTeX — ex. <code>\frac&#123;a&#125;&#123;b&#125;</code>, <code>x^2</code>, <code>\sqrt&#123;2&#125;</code>
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'my-1 overflow-x-auto rounded-md p-4 text-center',
        peutEditer && 'cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
      )}
      style={{ backgroundColor: 'var(--fond-secondaire)' }}
      onClick={() => peutEditer && setEdition(true)}
    >
      <span dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** Types de blocs dont l’URL peut être fournie par un fichier local. */
const TYPES_IMPORTABLES: TypeBloc[] = ['image', 'video', 'audio', 'fichier'];

/** Valeur de l’attribut `accept` du sélecteur de fichier selon le type de bloc. */
function acceptPour(type: TypeBloc): string | undefined {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'audio') return 'audio/*';
  return undefined; // « fichier » : tous types confondus.
}

/** Rendu d'un bloc média ou d'intégration (champ URL + import local + aperçu). */
function BlocMedia({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const url = String(bloc.proprietes?.url || '');
  const legende = String(bloc.proprietes?.legende || '');
  const nature = natureMedia(url);
  const integrable = urlIntegrable(url);
  // Un bloc « Vidéo » montre toujours un lecteur, sauf s'il s'agit d'une
  // plateforme d'intégration (YouTube, Vimeo…). Une URL sans extension connue
  // n'empêche donc plus l'affichage de la vidéo.
  const estVideo = nature === 'video' || (bloc.type === 'video' && !integrable);
  const peutEditer = !useLectureSeule();
  const Icone = iconeParTypeBloc[bloc.type];
  const { erreur: afficherErreur, succes: afficherSucces } = useToasts();
  const refFichier = useRef<HTMLInputElement>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  // Renseigné quand le navigateur ne parvient pas à lire le média (codec,
  // accès Cloudinary restreint…) : on propose alors un lien d'ouverture.
  const [lectureKO, setLectureKO] = useState(false);
  useEffect(() => setLectureKO(false), [url]);
  const importable = peutEditer && TYPES_IMPORTABLES.includes(bloc.type);
  const libelles: Partial<Record<TypeBloc, string>> = {
    image: 'Coller l’URL d’une image',
    video: 'Coller l’URL d’une vidéo (YouTube, Vimeo…)',
    audio: 'Coller l’URL d’un fichier audio',
    fichier: 'Coller l’URL d’un fichier',
    signet: 'Coller l’URL à mettre en signet',
    embed: 'Coller l’URL à intégrer (Figma, Loom, Maps…)',
  };

  const televerser = async (fichier: File | undefined) => {
    if (!fichier || envoiEnCours) return;
    setEnvoiEnCours(true);
    try {
      const reponse = await medias.televerser(fichier);
      const urlTeleversee = reponse.data?.url;
      if (!urlTeleversee) {
        afficherErreur('Import impossible', 'Le serveur n’a renvoyé aucune URL pour ce média.');
        return;
      }
      onPropriete('url', urlTeleversee);
      afficherSucces('Média importé', fichier.name);
    } catch (e) {
      afficherErreur(
        'Échec de l’import',
        e instanceof Error ? e.message : 'Le téléversement du fichier a échoué.'
      );
    } finally {
      setEnvoiEnCours(false);
      if (refFichier.current) refFichier.current.value = '';
    }
  };

  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--bordure)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icone className="h-4 w-4 shrink-0 texte-doux" />
          <input
            value={url}
            onChange={(e) => onPropriete('url', e.target.value)}
            readOnly={!peutEditer}
            placeholder={libelles[bloc.type] || 'URL'}
            className="w-full bg-transparent text-sm outline-none placeholder:texte-faible"
          />
        </div>
        {importable && (
          <>
            <button
              type="button"
              onClick={() => refFichier.current?.click()}
              disabled={envoiEnCours}
              className="bouton shrink-0 gap-1.5 text-xs"
            >
              {envoiEnCours ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {envoiEnCours ? 'Import en cours…' : 'Importer depuis l’appareil'}
            </button>
            <input
              ref={refFichier}
              type="file"
              accept={acceptPour(bloc.type)}
              className="hidden"
              onChange={(e) => televerser(e.target.files?.[0])}
            />
          </>
        )}
      </div>

      {url && estVideo && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          controls
          preload="metadata"
          playsInline
          src={url}
          onError={() => setLectureKO(true)}
          className="mt-3 max-h-96 w-full rounded bg-black"
        />
      )}

      {url && bloc.type === 'image' && !estVideo && nature !== 'audio' && (
        <div className="mt-3 overflow-hidden rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={legende || 'Image'} className="max-h-96 w-full object-contain" />
        </div>
      )}
      {url && bloc.type === 'signet' && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center gap-2 rounded border p-2 text-sm texte-doux hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          style={{ borderColor: 'var(--bordure)' }}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          <span className="truncate">{url}</span>
        </a>
      )}

      {url && nature === 'audio' && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={url} onError={() => setLectureKO(true)} className="mt-3 w-full" />
      )}

      {url &&
        bloc.type === 'video' &&
        !estVideo &&
        integrable && (
          <div className="mt-3 aspect-video w-full overflow-hidden rounded">
            <iframe
              src={integrable}
              title={legende || 'Vidéo intégrée'}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

      {/* Repli si le média ne peut pas être lu dans la page. */}
      {url && estVideo && lectureKO && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center gap-1.5 text-xs texte-doux underline"
        >
          <ExternalLink className="h-3 w-3" />
          Lecture impossible dans la page — ouvrir la vidéo
        </a>
      )}

      {url &&
        bloc.type === 'embed' &&
        (urlIntegrable(url) ? (
          <div className="mt-3 h-80 w-full overflow-hidden rounded">
            <iframe
              src={urlIntegrable(url) as string}
              title={legende || 'Contenu intégré'}
              className="h-full w-full border-0"
              allowFullScreen
            />
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-1.5 text-sm texte-doux underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ouvrir le contenu intégré
          </a>
        ))}

      {url && bloc.type === 'fichier' && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          download
          className="mt-3 flex items-center gap-2 rounded border p-2 text-sm texte-doux hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          style={{ borderColor: 'var(--bordure)' }}
        >
          <Paperclip className="h-4 w-4 shrink-0" />
          <span className="truncate">{nomFichier(url)}</span>
          <Download className="ml-auto h-3.5 w-3.5 shrink-0" />
        </a>
      )}

      <input
        value={legende}
        onChange={(e) => onPropriete('legende', e.target.value)}
        readOnly={!peutEditer}
        placeholder="Ajouter une légende…"
        className="mt-2 w-full bg-transparent text-xs outline-none placeholder:texte-faible texte-doux"
      />
    </div>
  );
}

/** Tableau éditable : colonnes et lignes stockées dans `proprietes.tableau`. */
function BlocTableau({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const brut = bloc.proprietes?.tableau as
    | { colonnes?: unknown; lignes?: unknown }
    | undefined;

  const colonnesBrutes = Array.isArray(brut?.colonnes)
    ? brut.colonnes
    : Array.isArray(bloc.proprietes?.colonnes)
      ? (bloc.proprietes.colonnes as unknown[])
      : [];
  // Par défaut, un tableau démarre avec deux colonnes : le nombre exact est
  // ensuite choisi librement par l'utilisateur (1, 2, 3…).
  const colonnesParDefaut = ['Colonne 1', 'Colonne 2'];
  const colonnes = (colonnesBrutes.length ? colonnesBrutes : colonnesParDefaut).map((valeur) =>
    String(valeur ?? '')
  );

  const lignesBrutes = Array.isArray(brut?.lignes)
    ? brut.lignes
    : Array.isArray(bloc.proprietes?.lignes)
      ? (bloc.proprietes.lignes as unknown[])
      : [];
  const lignes = lignesBrutes.length
    ? lignesBrutes.map((ligne) =>
        Array.isArray(ligne) ? colonnes.map((_, index) => String(ligne[index] ?? '')) : colonnes.map(() => '')
      )
    : [colonnes.map(() => ''), colonnes.map(() => '')];

  const enregistrer = (nouvellesColonnes: string[], nouvellesLignes: string[][]) =>
    onPropriete('tableau', { colonnes: nouvellesColonnes, lignes: nouvellesLignes });

  const modifierColonne = (index: number, valeur: string) => {
    const suite = colonnes.slice();
    suite[index] = valeur;
    enregistrer(suite, lignes.map((ligne) => ligne.slice()));
  };

  const modifierCellule = (ligne: number, colonne: number, valeur: string) => {
    const suite = lignes.map((l) => l.slice());
    while (suite[ligne].length < colonnes.length) suite[ligne].push('');
    suite[ligne][colonne] = valeur;
    enregistrer(colonnes.slice(), suite);
  };

  const ajouterLigne = () =>
    enregistrer(colonnes.slice(), [...lignes.map((ligne) => ligne.slice()), colonnes.map(() => '')]);

  const supprimerLigne = (index: number) =>
    enregistrer(
      colonnes.slice(),
      lignes.filter((_, i) => i !== index).map((ligne) => ligne.slice())
    );

  /** Supprime une colonne (au moins une colonne est toujours conservée). */
  const supprimerColonne = (index: number) => {
    if (colonnes.length <= 1) return;
    enregistrer(
      colonnes.filter((_, i) => i !== index),
      lignes.map((ligne) => ligne.filter((_, i) => i !== index))
    );
  };

  /** Fixe le nombre de colonnes du tableau (ajoute ou retire selon le besoin). */
  const definirNombreColonnes = (nombre: number) => {
    const cible = Math.max(1, Math.min(30, Math.floor(nombre)));
    if (cible === colonnes.length) return;
    const nouvellesColonnes = colonnes.slice(0, cible);
    while (nouvellesColonnes.length < cible) {
      nouvellesColonnes.push(`Colonne ${nouvellesColonnes.length + 1}`);
    }
    const nouvellesLignes = lignes.map((ligne) => {
      const suite = ligne.slice(0, cible);
      while (suite.length < cible) suite.push('');
      return suite;
    });
    enregistrer(nouvellesColonnes, nouvellesLignes);
  };

  return (
    <div
      className="my-1 overflow-x-auto rounded-lg border"
      style={{ borderColor: 'var(--bordure)' }}
    >
      <table className="w-full min-w-max border-collapse text-sm">
        <thead style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          <tr>
            {colonnes.map((titre, index) => (
              <th
                key={index}
                className="group/entete min-w-[140px] border-b px-0 text-left font-medium"
                style={{ borderColor: 'var(--bordure)' }}
              >
                <div className="flex items-center gap-1 pr-1">
                  <input
                    value={titre}
                    onChange={(e) => modifierColonne(index, e.target.value)}
                    readOnly={!peutEditer}
                    placeholder="Colonne"
                    className="w-full bg-transparent px-3 py-2 text-sm font-medium outline-none placeholder:texte-faible"
                  />
                  {peutEditer && colonnes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => supprimerColonne(index)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded texte-faible opacity-0 transition-opacity hover:bg-black/5 group-hover/entete:opacity-100 dark:hover:bg-white/10"
                      aria-label="Supprimer la colonne"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th className="w-8 border-b" style={{ borderColor: 'var(--bordure)' }} />
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, indexLigne) => (
            <tr
              key={indexLigne}
              className="group/ligne border-b last:border-b-0"
              style={{ borderColor: 'var(--bordure)' }}
            >
              {colonnes.map((_, indexColonne) => (
                <td key={indexColonne} className="px-0 align-middle">
                  <input
                    value={ligne[indexColonne] ?? ''}
                    onChange={(e) => modifierCellule(indexLigne, indexColonne, e.target.value)}
                    readOnly={!peutEditer}
                    placeholder="—"
                    className="w-full bg-transparent px-3 py-1.5 text-sm texte-doux outline-none placeholder:texte-faible"
                  />
                </td>
              ))}
              <td className="px-1 align-middle">
                {peutEditer && (
                  <button
                    type="button"
                    onClick={() => supprimerLigne(indexLigne)}
                    className="flex h-6 w-6 items-center justify-center rounded texte-faible opacity-0 transition-opacity hover:bg-black/5 group-hover/ligne:opacity-100 dark:hover:bg-white/10"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {peutEditer && (
        <div
          className="flex flex-wrap items-center gap-3 px-2 py-1.5"
          style={{ borderTop: '1px solid var(--bordure)' }}
        >
          <button
            type="button"
            onClick={ajouterLigne}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs texte-doux hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5" />
            Ligne
          </button>
          <button
            type="button"
            onClick={() => definirNombreColonnes(colonnes.length + 1)}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs texte-doux hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5" />
            Colonne
          </button>

          <label className="flex items-center gap-1.5 text-xs texte-doux">
            Colonnes
            <input
              key={colonnes.length}
              type="number"
              min={1}
              max={30}
              defaultValue={colonnes.length}
              onBlur={(e) => definirNombreColonnes(Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              className="h-6 w-14 rounded border bg-transparent px-1.5 text-xs outline-none"
              style={{ borderColor: 'var(--bordure)' }}
              aria-label="Nombre de colonnes"
            />
          </label>

          <span className="text-xs texte-faible">
            {lignes.length} ligne{lignes.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

/** Normalise la liste d'onglets stockée dans les propriétés d'un bloc. */
function normaliserOnglets(valeur: unknown): Array<{ titre: string; contenu: string }> {
  if (Array.isArray(valeur) && valeur.length > 0) {
    return valeur.map((element, index) => {
      const item = element as { titre?: unknown; contenu?: unknown };
      return {
        titre: String(item?.titre ?? `Onglet ${index + 1}`),
        contenu: String(item?.contenu ?? ''),
      };
    });
  }
  return [
    { titre: 'Onglet 1', contenu: '' },
    { titre: 'Onglet 2', contenu: '' },
  ];
}

/** Bloc « Onglets » : plusieurs panneaux de contenu, un seul affiché à la fois. */
function BlocOnglets({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const onglets = normaliserOnglets(bloc.proprietes?.onglets);
  const [actif, setActif] = useState(0);
  const index = Math.min(actif, onglets.length - 1);
  const courant = onglets[index];

  const enregistrer = (suite: Array<{ titre: string; contenu: string }>) => onPropriete('onglets', suite);
  const modifier = (patch: Partial<{ titre: string; contenu: string }>) =>
    enregistrer(onglets.map((onglet, i) => (i === index ? { ...onglet, ...patch } : onglet)));

  return (
    <div className="my-1 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--bordure)' }}>
      <div
        className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
        style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
      >
        {onglets.map((onglet, i) => (
          <span key={i} className="flex items-center">
            <button
              type="button"
              onClick={() => setActif(i)}
              className={cn(
                'max-w-[10rem] truncate rounded px-2 py-1 text-sm',
                i === index ? 'lien-barre-actif' : 'texte-doux hover:bg-black/5 dark:hover:bg-white/10'
              )}
            >
              {onglet.titre || `Onglet ${i + 1}`}
            </button>
            {peutEditer && onglets.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  enregistrer(onglets.filter((_, j) => j !== i));
                  setActif(0);
                }}
                className="flex h-5 w-5 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Supprimer l’onglet"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {peutEditer && (
          <button
            type="button"
            onClick={() => {
              enregistrer([...onglets, { titre: `Onglet ${onglets.length + 1}`, contenu: '' }]);
              setActif(onglets.length);
            }}
            className="flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Ajouter un onglet"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="p-3">
        {peutEditer && (
          <input
            value={courant.titre}
            onChange={(e) => modifier({ titre: e.target.value })}
            placeholder="Titre de l’onglet"
            className="mb-2 w-full bg-transparent font-medium outline-none placeholder:texte-faible"
          />
        )}
        <ChampAuto
          valeur={courant.contenu}
          onChange={(valeur) => modifier({ contenu: valeur })}
          placeholder="Contenu de l’onglet…"
          readOnly={!peutEditer}
          className="text-sm leading-relaxed texte-doux"
        />
      </div>
    </div>
  );
}

/** Bloc « Galerie » : grille d'images (URL ou import depuis l'appareil). */
function BlocGalerie({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const { erreur: afficherErreur, succes: afficherSucces } = useToasts();
  const [url, setUrl] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const refFichier = useRef<HTMLInputElement>(null);

  const images = Array.isArray(bloc.proprietes?.images)
    ? (bloc.proprietes.images as unknown[]).map((valeur) => String(valeur ?? ''))
    : [];
  const enregistrer = (suite: string[]) => onPropriete('images', suite);

  const ajouter = () => {
    const propre = url.trim();
    if (!propre) return;
    enregistrer([...images, propre]);
    setUrl('');
  };

  const televerser = async (fichier: File | undefined) => {
    if (!fichier || envoi) return;
    setEnvoi(true);
    try {
      const reponse = await medias.televerser(fichier);
      const urlTeleversee = reponse.data?.url;
      if (!urlTeleversee) throw new Error('Le serveur n’a renvoyé aucune URL.');
      enregistrer([...images, urlTeleversee]);
      afficherSucces('Image ajoutée', fichier.name);
    } catch (e) {
      afficherErreur('Import impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnvoi(false);
      if (refFichier.current) refFichier.current.value = '';
    }
  };

  return (
    <div className="my-1 rounded-lg border p-3" style={{ borderColor: 'var(--bordure)' }}>
      {images.length === 0 ? (
        <p className="mb-3 text-sm texte-faible">
          Aucune image pour l’instant. Ajoutez une adresse ou importez des fichiers ci-dessous.
        </p>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image, i) => (
            <div key={`${image}-${i}`} className="group/image relative overflow-hidden rounded-md border" style={{ borderColor: 'var(--bordure)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-28 w-full object-cover" />
              {peutEditer && (
                <button
                  type="button"
                  onClick={() => enregistrer(images.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/image:opacity-100"
                  aria-label="Retirer cette image"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {peutEditer && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ajouter();
              }
            }}
            placeholder="Coller l’URL d’une image…"
            className="champ min-w-0 flex-1"
          />
          <button type="button" onClick={ajouter} disabled={!url.trim()} className="bouton shrink-0 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
          <button
            type="button"
            onClick={() => refFichier.current?.click()}
            disabled={envoi}
            className="bouton shrink-0 gap-1.5 text-xs"
          >
            {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {envoi ? 'Import…' : 'Importer'}
          </button>
          <input
            ref={refFichier}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              Array.from(e.target.files ?? []).forEach((fichier) => void televerser(fichier));
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Types de fichiers acceptés par la galerie de médias. */
const MEDIAS_GALERIE = 'image/*,video/*';

/**
 * Bloc « Galerie de médias » : grille d'images **et** de vidéos. Contrairement
 * au bloc « Galerie » (images uniquement, où une vidéo apparaîtrait cassée),
 * chaque élément est affiché selon sa nature réelle (lecteur vidéo ou image).
 */
function BlocGalerieMedias({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const { erreur: afficherErreur, succes: afficherSucces } = useToasts();
  const [url, setUrl] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const refFichier = useRef<HTMLInputElement>(null);

  const elements = Array.isArray(bloc.proprietes?.medias)
    ? (bloc.proprietes.medias as unknown[]).map((valeur) => String(valeur ?? '')).filter(Boolean)
    : [];

  const enregistrer = (suite: string[]) => onPropriete('medias', suite);

  const ajouter = () => {
    const propre = url.trim();
    if (!propre) return;
    enregistrer([...elements, propre]);
    setUrl('');
  };

  const televerser = async (fichier: File | undefined) => {
    if (!fichier || envoi) return;
    setEnvoi(true);
    try {
      const reponse = await medias.televerser(fichier);
      const urlTeleversee = reponse.data?.url;
      if (!urlTeleversee) throw new Error('Le serveur n’a renvoyé aucune URL.');
      enregistrer([...elements, urlTeleversee]);
      afficherSucces('Média ajouté', fichier.name);
    } catch (e) {
      afficherErreur('Import impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnvoi(false);
      if (refFichier.current) refFichier.current.value = '';
    }
  };

  return (
    <div className="my-1 rounded-lg border p-3" style={{ borderColor: 'var(--bordure)' }}>
      {elements.length === 0 ? (
        <p className="mb-3 text-sm texte-faible">
          Aucun média pour l’instant. Ajoutez une adresse ou importez des images et des vidéos ci-dessous.
        </p>
      ) : (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {elements.map((element, i) => (
            <div
              key={`${element}-${i}`}
              className="group/media relative overflow-hidden rounded-md border"
              style={{ borderColor: 'var(--bordure)' }}
            >
              {natureMedia(element) === 'video' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  controls
                  preload="metadata"
                  playsInline
                  src={element}
                  className="h-28 w-full bg-black object-contain"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={element} alt="" className="h-28 w-full object-cover" />
              )}
              {peutEditer && (
                <button
                  type="button"
                  onClick={() => enregistrer(elements.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover/media:opacity-100"
                  aria-label="Retirer ce média"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {peutEditer && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ajouter();
              }
            }}
            placeholder="Coller l’URL d’une image ou d’une vidéo…"
            className="champ min-w-0 flex-1"
          />
          <button type="button" onClick={ajouter} disabled={!url.trim()} className="bouton shrink-0 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
          <button
            type="button"
            onClick={() => refFichier.current?.click()}
            disabled={envoi}
            className="bouton shrink-0 gap-1.5 text-xs"
          >
            {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {envoi ? 'Import…' : 'Importer'}
          </button>
          <input
            ref={refFichier}
            type="file"
            accept={MEDIAS_GALERIE}
            multiple
            className="hidden"
            onChange={(e) => {
              Array.from(e.target.files ?? []).forEach((fichier) => void televerser(fichier));
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Normalise les données d'un graphique ({ label, valeur }). */
function normaliserDonnees(valeur: unknown): Array<{ label: string; valeur: number }> {
  if (Array.isArray(valeur) && valeur.length > 0) {
    return valeur.map((element) => {
      const item = element as { label?: unknown; valeur?: unknown };
      return { label: String(item?.label ?? ''), valeur: Number(item?.valeur) || 0 };
    });
  }
  return [
    { label: 'A', valeur: 3 },
    { label: 'B', valeur: 6 },
    { label: 'C', valeur: 4 },
  ];
}

/** Bloc « Graphique » : diagramme en barres éditable. */
function BlocGraphique({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const donnees = normaliserDonnees(bloc.proprietes?.donnees);
  const maximum = Math.max(1, ...donnees.map((point) => Math.abs(point.valeur)));

  const enregistrer = (suite: Array<{ label: string; valeur: number }>) => onPropriete('donnees', suite);
  const modifier = (index: number, patch: Partial<{ label: string; valeur: number }>) =>
    enregistrer(donnees.map((point, i) => (i === index ? { ...point, ...patch } : point)));

  return (
    <div className="my-1 rounded-lg border p-3" style={{ borderColor: 'var(--bordure)' }}>
      <div className="flex flex-col gap-1.5">
        {donnees.map((point, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={point.label}
              onChange={(e) => modifier(index, { label: e.target.value })}
              readOnly={!peutEditer}
              placeholder="Étiquette"
              className="w-28 shrink-0 bg-transparent text-xs outline-none placeholder:texte-faible"
            />
            <div className="h-5 min-w-0 flex-1 overflow-hidden rounded" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
              <div
                className="h-full rounded bg-sky-500/70"
                style={{ width: `${Math.min(100, (Math.abs(point.valeur) / maximum) * 100)}%` }}
              />
            </div>
            <input
              type="number"
              value={point.valeur}
              onChange={(e) => modifier(index, { valeur: Number(e.target.value) })}
              readOnly={!peutEditer}
              className="h-6 w-16 shrink-0 rounded border bg-transparent px-1.5 text-xs outline-none"
              style={{ borderColor: 'var(--bordure)' }}
              aria-label="Valeur"
            />
            {peutEditer && donnees.length > 1 && (
              <button
                type="button"
                onClick={() => enregistrer(donnees.filter((_, i) => i !== index))}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Supprimer cette valeur"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {peutEditer && (
        <button
          type="button"
          onClick={() => enregistrer([...donnees, { label: `Élément ${donnees.length + 1}`, valeur: 0 }])}
          className="mt-2 flex items-center gap-1 rounded px-1.5 py-1 text-xs texte-doux hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une valeur
        </button>
      )}
    </div>
  );
}

/** Bloc « Raccourci » : carte renvoyant vers une page ou une adresse. */
function BlocRaccourci({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const titre = String(bloc.proprietes?.titre || '');
  const url = String(bloc.proprietes?.url || '');
  const adresse = url.trim();
  const valide = /^(https?:\/\/|mailto:|\/)/i.test(adresse);

  if (adresse && valide) {
    return (
      <a
        href={adresse}
        {...(/^https?:\/\//i.test(adresse) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="my-1 flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        style={{ borderColor: 'var(--bordure)' }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <ArrowUpRight className="h-4 w-4 texte-doux" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{titre || adresse}</span>
          <span className="block truncate text-xs texte-faible">{adresse}</span>
        </span>
        {peutEditer && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onPropriete('url', '');
            }}
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Retirer le raccourci"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </a>
    );
  }

  return (
    <div
      className="my-1 flex flex-col gap-2 rounded-lg border border-dashed p-3"
      style={{ borderColor: 'var(--bordure-forte)' }}
    >
      <div className="flex items-center gap-2">
        <ArrowUpRight className="h-4 w-4 shrink-0 texte-doux" />
        <input
          value={titre}
          onChange={(e) => onPropriete('titre', e.target.value)}
          readOnly={!peutEditer}
          placeholder="Titre du raccourci"
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:texte-faible"
        />
      </div>
      <input
        value={url}
        onChange={(e) => onPropriete('url', e.target.value)}
        readOnly={!peutEditer}
        placeholder="https://… ou /chemin"
        className="champ"
      />
    </div>
  );
}

/** Rendu d'un bloc non encore implémenté (données gérées par le backend). */
function BlocPlaceholder({
  icone: Icone,
  titre,
  description,
}: {
  icone: LucideIcon;
  titre: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed p-3" style={{ borderColor: 'var(--bordure-forte)' }}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{titre}</p>
        <p className="mt-0.5 text-xs texte-doux">{description}</p>
      </div>
    </div>
  );
}

/** Bloc « Base de données en ligne » : crée un tableau rattaché à la page. */
function BlocBaseEnLigne({ onCreerBase }: { onCreerBase?: () => void }) {
  const Icone = iconeParTypeBloc.base_en_ligne;
  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-dashed p-3"
      style={{ borderColor: 'var(--bordure-forte)' }}
    >
      <div className="flex items-start gap-3">
        <Icone className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Base de données en ligne</p>
          <p className="mt-0.5 text-xs texte-doux">
            Créez un tableau (colonnes, vues et lignes) directement lié à cette page.
          </p>
        </div>
      </div>
      {onCreerBase && (
        <button
          type="button"
          onClick={onCreerBase}
          className="bouton bouton-primaire self-start gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un tableau
        </button>
      )}
    </div>
  );
}

/**
 * Bloc « Note » : une note autonome (titre + zone de texte), distincte d'une
 * nouvelle page. La touche Entrée ajoute simplement une ligne — l'écriture
 * reste simple, sans découpage en blocs.
 */
function BlocNote({
  bloc,
  onContenu,
  onPropriete,
}: {
  bloc: Bloc;
  onContenu: (valeur: string) => void;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const Icone = iconeParTypeBloc.note;
  const titre = String(bloc.proprietes?.titre || '');
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Icone className="h-4 w-4 shrink-0 texte-doux" />
        <ChampAuto
          valeur={titre}
          onChange={(valeur) => onPropriete('titre', valeur)}
          data-bloc={bloc._id}
          readOnly={!peutEditer}
          placeholder="Titre de la note"
          className="font-semibold"
        />
      </div>
      <ChampAuto
        valeur={bloc.contenu || ''}
        onChange={onContenu}
        readOnly={!peutEditer}
        placeholder="Écrivez votre note…"
        className="text-sm leading-relaxed texte-doux"
      />
    </div>
  );
}

/** Bloc « Sommaire » : table des matières générée depuis les titres de la page. */
function BlocSommaire({ titres }: { titres: TitreSommaire[] }) {
  if (titres.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm texte-faible" style={{ borderColor: 'var(--bordure-forte)' }}>
        Ajoutez des titres à cette page pour générer un sommaire.
      </div>
    );
  }
  return (
    <nav className="rounded-md border p-3" style={{ borderColor: 'var(--bordure)' }} aria-label="Sommaire">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium texte-doux">
        <List className="h-3.5 w-3.5" />
        Sommaire
      </p>
      <ul className="flex flex-col gap-0.5">
        {titres.map((titre) => (
          <li key={titre.id} style={{ paddingLeft: `${(titre.niveau - 1) * 14}px` }}>
            <button
              type="button"
              onClick={() =>
                document
                  .querySelector(`[data-bloc="${titre.id}"]`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
              className="block w-full truncate rounded px-1.5 py-0.5 text-left text-sm texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            >
              {titre.texte}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Bloc « Fil d'Ariane » : chemin de navigation vers la page courante. */
function BlocFilAriane({ pageId }: { pageId?: string }) {
  const { pageParId, espaceParId } = useDonnees();

  const page = pageId ? pageParId(pageId) : undefined;
  if (!page) return <p className="py-1 text-sm texte-faible">Fil d’Ariane indisponible.</p>;

  const chaine: Page[] = [];
  const vus = new Set<string>();
  let courant: Page | undefined = page;
  while (courant && !vus.has(courant._id)) {
    vus.add(courant._id);
    chaine.unshift(courant);
    const parentId: string | null | undefined = courant.parentId;
    courant = parentId ? pageParId(parentId) : undefined;
  }

  const espace = page.espaceId ? espaceParId(identifiantDe(page.espaceId)) : undefined;

  return (
    <nav className="flex flex-wrap items-center gap-1 py-1 text-sm" aria-label="Fil d’Ariane">
      {espace && (
        <>
          <Link href={lienEspace(espace)} className="texte-doux hover:underline">
            {espace.nom}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 texte-faible" />
        </>
      )}
      {chaine.map((element, index) => (
        <span key={element._id} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 texte-faible" />}
          {index === chaine.length - 1 ? (
            <span className="font-medium">{element.titre || 'Sans titre'}</span>
          ) : (
            <Link href={lienPage(element)} className="texte-doux hover:underline">
              {element.titre || 'Sans titre'}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Bloc « Lien vers une page » : référence une autre page de l'espace. */
function BlocLienPage({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const { pages, pageParId } = useDonnees();
  const peutEditer = !useLectureSeule();
  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState('');

  const cibleId = String(bloc.proprietes?.pageId || '');
  const cible = cibleId ? pageParId(cibleId) : undefined;

  const terme = requete.trim().toLowerCase();
  const resultats = pages
    .filter((p) => p._id !== bloc.pageId)
    .filter((p) => !terme || (p.titre || 'Sans titre').toLowerCase().includes(terme))
    .slice(0, 40);

  return (
    <div className="py-0.5">
      {cible ? (
        <div className="flex items-center gap-2">
          <Link
            href={lienPage(cible)}
            className="flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <IconeDonnee icone={cible.icone} repli={FileText} className="h-4 w-4 shrink-0 texte-doux" />
            <span className="truncate font-medium">{cible.titre || 'Sans titre'}</span>
          </Link>
          <button
            type="button"
            onClick={() => peutEditer && setOuvert(true)}
            className={cn(
              'shrink-0 text-xs texte-faible',
              peutEditer ? 'hover:underline' : 'pointer-events-none opacity-0'
            )}
          >
            Changer
          </button>
        </div>
      ) : peutEditer ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="flex items-center gap-2 rounded border border-dashed px-2 py-1.5 text-sm texte-doux hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          style={{ borderColor: 'var(--bordure-forte)' }}
        >
          <FileText className="h-4 w-4" />
          Choisir une page à référencer
        </button>
      ) : (
        <span className="flex items-center gap-2 px-1 py-1 text-sm texte-faible">
          <FileText className="h-4 w-4" />
          Aucune page référencée
        </span>
      )}

      <Modale
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre="Lier une page"
        description="Sélectionnez la page à référencer depuis cette page."
        largeur="max-w-md"
      >
        <input
          autoFocus
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Rechercher une page…"
          className="champ mb-3"
        />
        <ul className="max-h-72 overflow-y-auto defilement-fin">
          {resultats.map((p) => (
            <li key={p._id}>
              <button
                type="button"
                onClick={() => {
                  onPropriete('pageId', p._id);
                  setOuvert(false);
                  setRequete('');
                }}
                className="menu-item w-full"
              >
                <IconeDonnee icone={p.icone} repli={FileText} className="h-4 w-4 shrink-0 texte-doux" />
                <span className="truncate">{p.titre || 'Sans titre'}</span>
              </button>
            </li>
          ))}
          {resultats.length === 0 && <li className="px-2 py-3 text-sm texte-faible">Aucune page trouvée.</li>}
        </ul>
      </Modale>
    </div>
  );
}

/** Bloc « Colonnes » : disposition de 2 à 5 colonnes. */
function BlocColonnes({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const peutEditer = !useLectureSeule();
  const nb = Math.min(5, Math.max(2, Number(bloc.proprietes?.colonnes) || 2));

  return (
    <div className="py-1">
      {peutEditer && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <Columns3 className="h-3.5 w-3.5 texte-faible" />
          <span className="text-xs texte-faible">Colonnes</span>
          <div className="flex items-center gap-0.5">
            {[2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onPropriete('colonnes', n)}
                className={cn(
                  'h-5 w-5 rounded text-xs',
                  n === nb
                    ? 'lien-barre-actif'
                    : 'texte-doux hover:bg-black/5 dark:hover:bg-white/10'
                )}
                aria-label={`${n} colonnes`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${nb}, minmax(0, 1fr))` }}>
        {Array.from({ length: nb }).map((_, index) => (
          <div
            key={index}
            className="rounded-md border border-dashed p-3 text-sm texte-faible"
            style={{ borderColor: 'var(--bordure-forte)' }}
          >
            Colonne {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bloc IA : résumé ou extraction d'actions générés via le proxy d'inférence. */
function BlocIA({
  bloc,
  textePage,
  onPropriete,
}: {
  bloc: Bloc;
  textePage: string;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const resume = bloc.type === 'ia_resume';
  const resultat = String(bloc.proprietes?.resultat || '');
  const Icone = iconeParTypeBloc[bloc.type];

  async function generer() {
    if (!textePage.trim()) {
      setErreur('Ajoutez du contenu à la page avant de générer.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const { contenu } = await demanderIA([
        {
          role: 'system',
          content: resume
            ? 'Tu résumes des documents en français, de façon concise et structurée.'
            : 'Tu extrais les tâches à accomplir d’un document, en français, sous forme de liste à puces.',
        },
        {
          role: 'user',
          content: resume
            ? `Résume le contenu de la page suivant :\n\n${textePage}`
            : `Liste les actions à mener à partir du contenu de la page suivant :\n\n${textePage}`,
        },
      ]);
      onPropriete('resultat', contenu);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Génération impossible.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
    >
      <div className="flex items-center gap-2">
        <Icone className="h-4 w-4 shrink-0 texte-doux" />
        <span className="text-sm font-medium">{resume ? 'Résumé IA' : 'Actions IA'}</span>
        <button
          type="button"
          onClick={generer}
          disabled={chargement}
          className="bouton ml-auto text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {chargement ? 'Génération…' : resultat ? 'Régénérer' : 'Générer'}
        </button>
      </div>
      {erreur && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{erreur}</p>}
      {resultat ? (
        <p className="mt-2 whitespace-pre-wrap text-sm texte-doux">{resultat}</p>
      ) : (
        !erreur && <p className="mt-2 text-xs texte-faible">{descriptionParType(bloc.type)}</p>
      )}
    </div>
  );
}

/**
 * Bloc « Agent NOVA » : NOVA lit la page courante et l'espace (pages, bases),
 * puis propose un plan d'actions — créer des pages et sous-pages, une base, un
 * rendez-vous ou une tâche, réécrire du contenu — validé dans la modale avant
 * application. Toute modification d'une page existante est précédée d'une
 * version de sauvegarde.
 */
function BlocIaPage({
  bloc,
  onContenu,
  onRechargerBlocs,
}: {
  bloc: Bloc;
  onContenu: (valeur: string) => void;
  onRechargerBlocs?: () => void;
}) {
  const peutEditer = !useLectureSeule();
  const toasts = useToasts();
  const router = useRouter();
  const { pages } = useDonnees();
  const [instruction, setInstruction] = useState(bloc.contenu || '');
  const [enCours, setEnCours] = useState(false);
  const [plan, setPlan] = useState<PlanAgent | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const Icone = iconeParTypeBloc.ia_page;

  useEffect(() => {
    setInstruction(bloc.contenu || '');
  }, [bloc.contenu]);

  const generer = async (demandeForcee?: string) => {
    const demande = (demandeForcee ?? instruction).trim();
    if (!demande) {
      toasts.erreur('Décrivez ce que NOVA doit faire');
      return;
    }
    setEnCours(true);
    try {
      const contexte = await construireContexteAgent({ pages, pageCouranteId: bloc.pageId });
      const proposition = await demanderPlanAgent(demande, contexte);
      if (proposition.actions.length === 0) {
        throw new Error("NOVA n'a proposé aucune action.");
      }
      setPlan(proposition);
      setOuvert(true);
    } catch (e) {
      toasts.erreur('Génération impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
    >
      <div className="flex items-center gap-2">
        <Icone className="h-4 w-4 shrink-0 texte-doux" />
        <span className="text-sm font-medium">Agent NOVA</span>
        {peutEditer && (
          <button
            type="button"
            onClick={() => generer()}
            disabled={enCours}
            className="bouton ml-auto text-xs"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {enCours ? 'Génération…' : 'Proposer des actions'}
          </button>
        )}
      </div>

      {peutEditer ? (
        <textarea
          value={instruction}
          onChange={(e) => {
            setInstruction(e.target.value);
            onContenu(e.target.value);
          }}
          placeholder="Décrivez ce que NOVA doit faire : créer une page, un rendez-vous, une base, réécrire cette page…"
          className="champ mt-2 min-h-[64px] resize-y"
        />
      ) : (
        instruction && <p className="mt-2 whitespace-pre-wrap text-sm texte-doux">{instruction}</p>
      )}

      <p className="mt-1.5 text-xs texte-faible">
        NOVA lit la page et l’espace de travail (pages, bases), puis propose des actions — créer des pages et des
        sous-pages, une base, un rendez-vous, une tâche, réécrire du contenu — que vous validez avant application
        (sauvegarde préalable en cas de modification).
      </p>

      <ModaleAgentIA
        ouvert={ouvert}
        plan={plan}
        pageCouranteId={bloc.pageId}
        onFermer={() => setOuvert(false)}
        onRelancer={(demande) => {
          setOuvert(false);
          generer(demande);
        }}
        onApplique={(resultat) => {
          if (resultat.premierePageId && resultat.premierePageId !== bloc.pageId) {
            router.push(`/page/${resultat.premierePageId}`);
            return;
          }
          onRechargerBlocs?.();
        }}
      />
    </div>
  );
}

