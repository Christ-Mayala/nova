export interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type FenetreAvecInvite = Window & {
  __novaInstallPrompt?: EvenementInstallation | null;
};

export const EVENEMENT_INVITE = 'nova:installprompt';

export function estiOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function estStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Récupère l'événement `beforeinstallprompt` capturé tôt par le script du layout. */
export function inviteInstallation(): EvenementInstallation | null {
  if (typeof window === 'undefined') return null;
  return (window as FenetreAvecInvite).__novaInstallPrompt || null;
}

/** Déclenche la boîte de dialogue native d'installation, si disponible. */
export async function lancerInstallation(): Promise<
  'accepted' | 'dismissed' | 'indisponible'
> {
  const invite = inviteInstallation();
  if (!invite) return 'indisponible';

  try {
    await invite.prompt();
    const choix = await invite.userChoice;
    if (choix.outcome === 'accepted') {
      (window as FenetreAvecInvite).__novaInstallPrompt = null;
    }
    return choix.outcome;
  } catch {
    return 'indisponible';
  }
}

/** Consigne d'installation à afficher lorsque le navigateur ne propose pas de prompt. */
export function consigneInstallation(): string {
  if (estiOS()) {
    return 'Dans Safari, touchez Partager puis « Sur l’écran d’accueil ».';
  }
  return 'Ouvrez le menu de votre navigateur puis choisissez « Installer NOVA » (ou « Installer l’application »).';
}
