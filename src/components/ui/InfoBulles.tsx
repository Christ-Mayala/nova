'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Info-bulle affichée au survol d'un élément. */
export function InfoBulles({
  contenu,
  children,
  position = 'haut',
  className,
}: {
  contenu: ReactNode;
  children: ReactNode;
  position?: 'haut' | 'droite' | 'bas';
  className?: string;
}) {
  return (
    <span className={cn('group/infobulle relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-[70] hidden whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-white shadow-md group-hover/infobulle:block',
          position === 'haut' && 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
          position === 'droite' && 'left-full top-1/2 ml-2 -translate-y-1/2',
          position === 'bas' && 'top-full left-1/2 mt-1.5 -translate-x-1/2'
        )}
        style={{ backgroundColor: '#2f2f2f' }}
      >
        {contenu}
      </span>
    </span>
  );
}
