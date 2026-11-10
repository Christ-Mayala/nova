'use client';

import { useEffect, useRef, type KeyboardEvent, type TextareaHTMLAttributes } from 'react';

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

/** Accesseur pratique : cible la zone de texte d'un bloc par identifiant. */
export function focusBloc(id: string, position: 'debut' | 'fin' = 'fin') {
  const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-bloc="${id}"]`);
  if (!el) return;
  el.focus();
  const fin = el.value.length;
  const pos = position === 'debut' ? 0 : fin;
  el.setSelectionRange(pos, pos);
}

/** Gestionnaire de touche par défaut retiré des attributs natifs. */
export type ToucheChamp = (e: KeyboardEvent<HTMLTextAreaElement>) => void;
