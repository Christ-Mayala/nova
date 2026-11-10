'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { BarreLaterale } from '@/components/shell/BarreLaterale';
import { ChangementMotDePasseObligatoire } from '@/components/shell/ChangementMotDePasseObligatoire';
import { EnTete } from '@/components/shell/EnTete';
import { PaletteCommande } from '@/components/shell/PaletteCommande';
import { Chargement } from '@/components/ui/Etats';
import { useAuth } from '@/context/AuthContext';

/** Écran plein page affiché pendant la vérification de la session. */
function EcranSession({ libelle }: { libelle: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Chargement libelle={libelle} />
    </div>
  );
}

/**
 * Coquille de l'application : barre latérale, en-tête (fil d'Ariane + actions)
 * et palette de commandes. Enveloppe toutes les routes de l'espace de travail.
 *
 * Aucune interface n'est rendue sans session valide : les visiteurs sans compte
 * sont redirigés vers la page de connexion. Un compte créé par invitation est
 * bloqué sur l'écran de changement de mot de passe tant que le mot de passe
 * provisoire n'a pas été remplacé.
 */
export function CoquilleApp({ children }: { children: ReactNode }) {
  const { utilisateur, chargement, estConnecte } = useAuth();
  const router = useRouter();
  const chemin = usePathname();

  useEffect(() => {
    if (chargement || estConnecte) return;
    const suivant = `${chemin}${window.location.search}`;
    router.replace(`/connexion?suivant=${encodeURIComponent(suivant)}`);
  }, [chargement, estConnecte, chemin, router]);

  if (chargement) {
    return <EcranSession libelle="Vérification de votre session…" />;
  }

  if (!estConnecte) {
    return <EcranSession libelle="Redirection vers la connexion…" />;
  }

  if (utilisateur?.mustChangePassword) {
    return <ChangementMotDePasseObligatoire />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ height: '100dvh' }}>
      <BarreLaterale />
      <div className="flex min-w-0 flex-1 flex-col">
        <EnTete />
        <main className="min-h-0 flex-1 overflow-y-auto defilement-fin">{children}</main>
      </div>
      <PaletteCommande />
    </div>
  );
}
