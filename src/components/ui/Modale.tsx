'use client';

import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Fenêtre modale centrée, fermable par Échap ou clic sur l'arrière-plan. */
export function Modale({
  ouvert,
  onFermer,
  titre,
  description,
  children,
  pied,
  largeur = 'max-w-lg',
}: {
  ouvert: boolean;
  onFermer: () => void;
  titre?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  pied?: ReactNode;
  largeur?: string;
}) {
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.body.style.overflow = overflow;
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Fermer"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onFermer}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full animate-apparition overflow-hidden rounded-xl shadow-2xl',
          largeur
        )}
        style={{ backgroundColor: 'var(--fond)', border: '1px solid var(--bordure)' }}
      >
        {(titre || description) && (
          <div className="flex items-start justify-between gap-4 px-5 pt-4">
            <div className="min-w-0">
              {titre && <h2 className="truncate text-base font-semibold">{titre}</h2>}
              {description && <p className="mt-0.5 text-sm texte-doux">{description}</p>}
            </div>
            <button type="button" className="bouton -mr-1 p-1.5" onClick={onFermer} aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {pied && (
          <div
            className="flex items-center justify-end gap-2 px-5 py-3"
            style={{ borderTop: '1px solid var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
          >
            {pied}
          </div>
        )}
      </div>
    </div>
  );
}
