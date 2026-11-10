'use client';

import { useEffect, useState } from 'react';

import { cn, initiales } from '@/lib/utils';

const TAILLES = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-12 w-12 text-base',
  xl: 'h-20 w-20 text-2xl',
} as const;

/**
 * Photo de profil avec repli sur les initiales.
 * Utilisée partout où un utilisateur est affiché (barre latérale, commentaires,
 * membres, partage…).
 */
export function Avatar({
  src,
  nom,
  taille = 'sm',
  className,
}: {
  src?: string | null;
  nom?: string;
  taille?: keyof typeof TAILLES;
  className?: string;
}) {
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    setEchec(false);
  }, [src]);

  const afficherImage = Boolean(src) && !echec;

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white',
        TAILLES[taille],
        className
      )}
      style={{ backgroundColor: 'var(--accent)' }}
    >
      {afficherImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src as string}
          alt={nom || 'Avatar'}
          className="h-full w-full object-cover"
          onError={() => setEchec(true)}
        />
      ) : (
        initiales(nom)
      )}
    </span>
  );
}
