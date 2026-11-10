'use client';

import { Loader2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Indicateur de chargement centré. */
export function Chargement({ libelle = 'Chargement…' }: { libelle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 texte-doux">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{libelle}</span>
    </div>
  );
}

/** État vide générique (icône, titre, description, action). */
export function EtatVide({
  icone: Icone,
  titre,
  description,
  action,
}: {
  icone: LucideIcon;
  titre: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg py-16 text-center">
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--fond-secondaire)' }}
      >
        <Icone className="h-5 w-5 texte-faible" />
      </div>
      <div>
        <p className="font-medium">{titre}</p>
        {description && <p className="mt-1 max-w-sm text-sm texte-doux">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Bandeau d'erreur discret. */
export function BandeauErreur({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
      {message}
    </div>
  );
}
