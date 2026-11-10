'use client';

import type { ReactNode } from 'react';

import { BarreLaterale } from '@/components/shell/BarreLaterale';
import { ChangementMotDePasseObligatoire } from '@/components/shell/ChangementMotDePasseObligatoire';
import { EnTete } from '@/components/shell/EnTete';
import { PaletteCommande } from '@/components/shell/PaletteCommande';
import { useAuth } from '@/context/AuthContext';

/**
 * Coquille de l'application : barre latérale, en-tête (fil d'Ariane + actions)
 * et palette de commandes. Enveloppe toutes les routes de l'espace de travail.
 *
 * Un compte créé par invitation est bloqué sur l'écran de changement de mot de
 * passe tant que le mot de passe provisoire n'a pas été remplacé.
 */
export function CoquilleApp({ children }: { children: ReactNode }) {
  const { utilisateur } = useAuth();

  if (utilisateur?.mustChangePassword) {
    return <ChangementMotDePasseObligatoire />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <BarreLaterale />
      <div className="flex min-w-0 flex-1 flex-col">
        <EnTete />
        <main className="min-h-0 flex-1 overflow-y-auto defilement-fin">{children}</main>
      </div>
      <PaletteCommande />
    </div>
  );
}
