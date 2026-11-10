'use client';

import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Menu déroulant flottant (clic extérieur et Échap pour fermer). */
export function Menu({
  declencheur,
  children,
  alignement = 'gauche',
  largeur,
  className,
}: {
  declencheur: ReactNode;
  children: ReactNode;
  alignement?: 'gauche' | 'droite' | 'centre';
  largeur?: string;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surClic = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false);
    };
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', surClic);
    document.addEventListener('keydown', surTouche);
    return () => {
      document.removeEventListener('mousedown', surClic);
      document.removeEventListener('keydown', surTouche);
    };
  }, [ouvert]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div onClick={() => setOuvert((o) => !o)} className="contents">
        {declencheur}
      </div>
      {ouvert && (
        <div
          className={cn(
            'menu-flottant absolute mt-1 animate-apparition',
            alignement === 'gauche' && 'left-0',
            alignement === 'droite' && 'right-0',
            alignement === 'centre' && 'left-1/2 -translate-x-1/2',
            largeur
          )}
          onClick={(e) => {
            // Seul un clic sur un élément de menu referme : les panneaux
            // interactifs (champs, selects, boutons) restent ouverts.
            if ((e.target as HTMLElement).closest('.menu-item')) setOuvert(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Élément cliquable d'un menu. */
export function MenuElement({
  icone: Icone,
  onClick,
  children,
  actif,
  danger,
  raccourci,
  disabled,
}: {
  icone?: LucideIcon;
  onClick?: () => void;
  children: ReactNode;
  actif?: boolean;
  danger?: boolean;
  raccourci?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'menu-item group',
        actif && 'font-medium',
        danger &&
          'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      style={actif ? { backgroundColor: 'var(--survol)' } : undefined}
    >
      {Icone ? (
        <Icone
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--texte-faible)] transition-colors',
            !danger && 'group-hover:text-[var(--texte)]'
          )}
        />
      ) : (
        <span className="w-4" />
      )}
      <span className="flex-1 truncate">{children}</span>
      {raccourci && <span className="text-[var(--texte-faible)] text-xs">{raccourci}</span>}
    </button>
  );
}

/** Séparateur horizontal dans un menu. */
export function MenuSeparateur() {
  return <div className="my-1.5 h-px" style={{ backgroundColor: 'var(--bordure)' }} />;
}

/** Titre de section dans un menu. */
export function MenuTitre({ children }: { children: ReactNode }) {
  return (
    <div className="truncate px-2.5 py-1.5 text-xs font-medium text-[var(--texte-faible)]">
      {children}
    </div>
  );
}
