'use client';

import { Smile, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { InfoBulles } from '@/components/ui/InfoBulles';
import { paletteIcones } from '@/lib/icones';
import { cn } from '@/lib/utils';

/**
 * Sélecteur d'icône : propose une palette d'icônes vectorielles.
 * L'emoji canonique correspondant est enregistré côté API (compatibilité DRY),
 * mais l'interface n'affiche jamais d'emoji.
 */
export function SelecteurIcone({
  valeur,
  onChange,
  taille = 'moyenne',
  className,
}: {
  valeur?: string;
  onChange: (emoji: string) => void;
  taille?: 'petite' | 'moyenne' | 'grande';
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);

  const dimensions = {
    petite: 'h-5 w-5',
    moyenne: 'h-8 w-8',
    grande: 'h-14 w-14',
  }[taille];

  return (
    <div className={cn('relative', className)}>
      <InfoBulles contenu="Changer l’icône">
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className={cn(
            'flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10',
            dimensions
          )}
          aria-label="Changer l’icône"
        >
          {valeur ? (
            <IconeDonnee icone={valeur} repli={Smile} className={taille === 'grande' ? 'h-10 w-10' : 'h-5 w-5'} />
          ) : (
            <Smile className={taille === 'grande' ? 'h-8 w-8 texte-faible' : 'h-4 w-4 texte-faible'} />
          )}
        </button>
      </InfoBulles>

      {ouvert && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fermer le sélecteur d’icône"
            onClick={() => setOuvert(false)}
          />
          <div className="menu-flottant absolute left-0 top-full z-50 mt-1 w-72 animate-apparition">
            <div className="grid grid-cols-8 gap-0.5 p-1">
              {paletteIcones.map(({ emoji, icone: Icone }) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onChange(emoji);
                    setOuvert(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10"
                  title={emoji}
                >
                  <Icone className="h-4 w-4" />
                </button>
              ))}
            </div>
            <div className="border-t p-1" style={{ borderColor: 'var(--bordure)' }}>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOuvert(false);
                }}
                className="menu-item text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 texte-doux" />
                Retirer l’icône
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
