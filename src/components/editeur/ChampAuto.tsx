'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type KeyboardEventHandler,
  type TextareaHTMLAttributes,
} from 'react';

import { MarkdownInline } from '@/components/ui/Markdown';
import { cn } from '@/lib/utils';

/**
 * Zone de texte qui s'ajuste automatiquement à son contenu.
 * Utilisée par tous les blocs éditables de la page (texte, titres, listes…).
 */
export function ChampAuto({
  valeur,
  onChange,
  className,
  autoFocus,
  ...reste
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  className?: string;
  autoFocus?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'autoFocus'>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [valeur]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full resize-none overflow-hidden bg-transparent outline-none placeholder:texte-faible',
        className
      )}
      {...reste}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Champ riche : aperçu formaté + édition Markdown                     */
/* ------------------------------------------------------------------ */

/** Demande le passage en édition d'un champ (émis par `focusBloc`). */
export const EVENEMENT_FOCUS_CHAMP = 'nova:focus-champ';
/** Demande l'application d'un formatage (gras, couleur…) sur un champ. */
export const EVENEMENT_FORMAT_CHAMP = 'nova:format-champ';

/** Détail transporté par `EVENEMENT_FORMAT_CHAMP`. */
export interface DetailFormatChamp {
  /** Identifiant du bloc ciblé. */
  id: string;
  /** Marqueur inséré avant la sélection (ex. `**`, `{rouge:`). */
  avant: string;
  /** Marqueur inséré après la sélection (ex. `**`, `}`). */
  apres: string;
  /** Retire les marqueurs de formatage présents dans la sélection. */
  nettoyer?: boolean;
  /** Retire uniquement la couleur du texte (`couleur`) ou du fond (`fond`). */
  retirer?: 'couleur' | 'fond';
  /** Texte inséré quand rien n'est sélectionné (ex. l'URL d'un lien). */
  repli?: string;
}

/** Retire les marqueurs Markdown d'un texte (action « Effacer le formatage »). */
function nettoyerSelection(texte: string): string {
  return texte
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .replace(/~~([^~]*)~~/g, '$1')
    .replace(/\+\+([^+]*)\+\+/g, '$1')
    .replace(/==([^=]*)==/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\{[a-z-]+:([^}]*)\}/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/_([^_]*)_/g, '$1');
}

/** Retire uniquement les couleurs (texte ou fond) d'un texte (coloris « Par défaut »). */
function retirerCouleur(texte: string, fond: boolean): string {
  return fond
    ? texte.replace(/\{fond-[a-z-]+:([^}]*)\}/g, '$1')
    : texte.replace(/\{(?!fond-)[a-z-]+:([^}]*)\}/g, '$1');
}

/**
 * Champ de texte enrichi : affiche le contenu formaté (Markdown « en ligne »)
 * tant que le bloc n'est pas édité, puis bascule en zone de texte au clic.
 * Le contenu reste stocké en Markdown brut (`**gras**`, `*italique*`).
 */
export function ChampRiche({
  valeur,
  onChange,
  onKeyDown,
  className,
  placeholder,
  identifiant,
  lectureSeule,
}: {
  valeur: string;
  onChange: (valeur: string) => void;
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>;
  className?: string;
  placeholder?: string;
  /** Identifiant du bloc : sert à router les événements de focus/formatage. */
  identifiant?: string;
  /** Page verrouillée : le texte reste affiché mais n'est plus modifiable. */
  lectureSeule?: boolean;
}) {
  const [actif, setActif] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  /** Dernière sélection connue : permet de formater depuis la barre d'outils. */
  const selectionRef = useRef<{ debut: number; fin: number }>({ debut: 0, fin: 0 });
  /** Reporte la désactivation du champ pour laisser le temps à un clic de menu. */
  const minuteurBlur = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Indique que le champ doit prendre le focus à son montage (clic utilisateur). */
  const demanderFocus = useRef(false);

  const memoriser = (debut: number, fin: number) => {
    selectionRef.current = { debut, fin };
  };
  const memoriserSelection = (el: HTMLTextAreaElement) => {
    memoriser(el.selectionStart ?? 0, el.selectionEnd ?? 0);
  };

  // Ajuste la hauteur de la zone de texte à son contenu.
  useEffect(() => {
    if (!actif) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [valeur, actif]);

  // Place le curseur lorsqu'un clic sur l'aperçu fait basculer le champ.
  useEffect(() => {
    if (!actif || !demanderFocus.current) return;
    demanderFocus.current = false;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const position = el.value.length;
    el.setSelectionRange(position, position);
    memoriserSelection(el);
  }, [actif]);

  // Nettoyage du minuteur de désactivation.
  useEffect(
    () => () => {
      if (minuteurBlur.current) clearTimeout(minuteurBlur.current);
    },
    []
  );

  // Active et focalise le champ lorsqu'un autre composant le demande.
  useEffect(() => {
    if (!identifiant || lectureSeule) return;
    const surFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; position?: 'debut' | 'fin' }>).detail;
      if (!detail || detail.id !== identifiant) return;
      demanderFocus.current = false;
      setActif(true);
      requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        el.focus();
        const position = detail.position === 'debut' ? 0 : el.value.length;
        el.setSelectionRange(position, position);
        memoriserSelection(el);
      });
    };
    window.addEventListener(EVENEMENT_FOCUS_CHAMP, surFocus);
    return () => window.removeEventListener(EVENEMENT_FOCUS_CHAMP, surFocus);
  }, [identifiant, lectureSeule]);

  // Applique un formatage demandé (barre d'outils ou raccourcis clavier).
  useEffect(() => {
    if (!identifiant || lectureSeule) return;
    const surFormat = (e: Event) => {
      const detail = (e as CustomEvent<DetailFormatChamp>).detail;
      if (!detail || detail.id !== identifiant) return;
      // Un formatage vient d'être demandé : on annule la sortie d'édition.
      if (minuteurBlur.current) {
        clearTimeout(minuteurBlur.current);
        minuteurBlur.current = null;
      }

      const appliquer = (el: HTMLTextAreaElement, frais: boolean) => {
        const debut = frais ? selectionRef.current.debut : el.selectionStart ?? 0;
        const fin = frais ? selectionRef.current.fin : el.selectionEnd ?? 0;
        const selection = el.value.slice(debut, fin);
        // Sans sélection, un texte de repli (URL d'un lien) évite d'avoir à
        // retaper quelque chose : le contenu s'affiche immédiatement.
        const contenu = selection || detail.repli || '';
        const remplacement = detail.nettoyer
          ? nettoyerSelection(selection)
          : detail.retirer
            ? retirerCouleur(selection, detail.retirer === 'fond')
            : `${detail.avant}${contenu}${detail.apres}`;
        const suivant = el.value.slice(0, debut) + remplacement + el.value.slice(fin);
        let position = debut + detail.avant.length;
        if (detail.nettoyer || detail.retirer) position = debut + remplacement.length;
        else if (selection) position = debut + detail.avant.length + selection.length;
        else if (detail.repli) position = debut + remplacement.length;
        memoriser(position, position);
        onChangeRef.current(suivant);
        requestAnimationFrame(() => {
          const cible = ref.current;
          if (!cible) return;
          cible.focus();
          cible.setSelectionRange(position, position);
          memoriserSelection(cible);
        });
      };

      const el = ref.current;
      if (el) {
        appliquer(el, false);
        return;
      }
      demanderFocus.current = false;
      setActif(true);
      requestAnimationFrame(() => {
        if (ref.current) appliquer(ref.current, true);
      });
    };
    window.addEventListener(EVENEMENT_FORMAT_CHAMP, surFormat);
    return () => window.removeEventListener(EVENEMENT_FORMAT_CHAMP, surFormat);
  }, [identifiant, lectureSeule]);

  if (!actif || lectureSeule) {
    return (
      <div
        role="textbox"
        tabIndex={lectureSeule ? -1 : 0}
        data-bloc={identifiant}
        onClick={
          lectureSeule
            ? undefined
            : () => {
                demanderFocus.current = true;
                setActif(true);
              }
        }
        onFocus={
          lectureSeule
            ? undefined
            : () => {
                demanderFocus.current = true;
                setActif(true);
              }
        }
        className={cn(
          'w-full whitespace-pre-wrap break-words outline-none',
          !lectureSeule && 'cursor-text',
          className
        )}
      >
        {valeur ? (
          <MarkdownInline contenu={valeur} />
        ) : (
          <span className="texte-faible">{placeholder}</span>
        )}
      </div>
    );
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={valeur}
      data-bloc={identifiant}
      placeholder={placeholder}
      onFocus={(e) => {
        setActif(true);
        memoriserSelection(e.currentTarget);
      }}
      onSelect={(e) => memoriserSelection(e.currentTarget)}
      onKeyUp={(e) => memoriserSelection(e.currentTarget)}
      onMouseUp={(e) => memoriserSelection(e.currentTarget)}
      onBlur={(e) => {
        memoriserSelection(e.currentTarget);
        if (minuteurBlur.current) clearTimeout(minuteurBlur.current);
        minuteurBlur.current = setTimeout(() => {
          minuteurBlur.current = null;
          setActif(false);
        }, 200);
      }}
      onChange={(e) => onChangeRef.current(e.target.value)}
      onKeyDown={onKeyDown}
      className={cn(
        'w-full resize-none overflow-hidden bg-transparent outline-none placeholder:texte-faible',
        className
      )}
    />
  );
}

/** Accesseur pratique : cible la zone de texte d'un bloc par identifiant. */
export function focusBloc(id: string, position: 'debut' | 'fin' = 'fin') {
  // Les champs enrichis basculent en édition à la réception de cet événement.
  window.dispatchEvent(new CustomEvent(EVENEMENT_FOCUS_CHAMP, { detail: { id, position } }));
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-bloc="${id}"]`);
    if (!el) return;
    el.focus();
    const fin = el.value.length;
    const pos = position === 'debut' ? 0 : fin;
    el.setSelectionRange(pos, pos);
  });
}

/** Gestionnaire de touche par défaut retiré des attributs natifs. */
export type ToucheChamp = (e: KeyboardEvent<HTMLTextAreaElement>) => void;
