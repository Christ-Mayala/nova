'use client';

import { cn } from '@/lib/utils';

/** Interrupteur binaire (case activée / désactivée). */
export function Bascule({
  actif,
  onChange,
  desactive,
  libelle,
}: {
  actif: boolean;
  onChange: (valeur: boolean) => void;
  desactive?: boolean;
  libelle?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={actif}
      aria-label={libelle}
      disabled={desactive}
      onClick={() => onChange(!actif)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        actif ? 'bg-sky-500' : 'bg-neutral-300 dark:bg-neutral-600'
      )}
    >
      <span
        className={cn(
          'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
          actif ? 'translate-x-[18px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  );
}
