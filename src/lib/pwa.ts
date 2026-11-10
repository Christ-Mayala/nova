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

/* ------------------------------------------------------------------ */
/* Guide d'installation pas-à-pas                                      */
/* ------------------------------------------------------------------ */

export type Plateforme = 'android' | 'ios' | 'ordinateur';

/** Événement global demandant l'ouverture du guide d'installation. */
export const EVENEMENT_GUIDE = 'nova:ouvrir-guide-installation';

/** Ouvre le guide d'installation depuis n'importe quel composant. */
export function ouvrirGuideInstallation(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENEMENT_GUIDE));
}

/** Détecte la plateforme de l'appareil pour adapter la procédure. */
export function detecterPlateforme(): Plateforme {
  if (typeof navigator === 'undefined') return 'ordinateur';
  if (estiOS()) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  return 'ordinateur';
}

export interface GuideInstallation {
  plateforme: Plateforme;
  titre: string;
  intro: string;
  etapes: string[];
  astuce?: string;
}

/**
 * Procédure d'installation adaptée à l'appareil : deux gestes sur Android,
 * deux gestes sur iOS. Utilisée par le guide lorsqu'aucune boîte de dialogue
 * native n'est disponible.
 */
export function guideInstallation(): GuideInstallation {
  // L'installation (et l'événement `beforeinstallprompt`) exige un contexte
  // sécurisé : HTTPS, ou localhost. Une adresse http:// sur une IP locale
  // (test depuis un téléphone) est la cause la plus fréquente d'échec.
  const contexteNonSecurise =
    typeof window !== 'undefined' && !window.isSecureContext;
  const astuceSecurite =
    'Ouvrez NOVA depuis son adresse sécurisée (https://…) : l’installation est refusée sur une connexion non sécurisée.';

  switch (detecterPlateforme()) {
    case 'ios':
      return {
        plateforme: 'ios',
        titre: 'Installer NOVA sur iPhone / iPad',
        intro: 'Sur iPhone et iPad, l’installation se fait depuis Safari en deux gestes.',
        etapes: [
          'Ouvrez NOVA dans Safari (et non dans une application ou un autre navigateur).',
          'Touchez le bouton Partager, dans la barre du bas.',
          'Choisissez « Sur l’écran d’accueil », puis touchez « Ajouter ».',
          'NOVA apparaît sur votre écran d’accueil : ouvrez-le depuis cette icône.',
        ],
        astuce: contexteNonSecurise
          ? astuceSecurite
          : 'Une fois installée, la barre du navigateur disparaît et NOVA s’ouvre en plein écran.',
      };
    case 'android':
      return {
        plateforme: 'android',
        titre: 'Installer NOVA sur Android',
        intro: 'Sur Android, l’installation se fait depuis Chrome en deux gestes.',
        etapes: [
          'Ouvrez NOVA dans Chrome (et non dans une application ou un autre navigateur).',
          'Touchez le menu ⋮ en haut à droite.',
          'Choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».',
          'Confirmez : NOVA s’ouvre comme une application.',
        ],
        astuce: contexteNonSecurise
          ? astuceSecurite
          : 'Si l’option n’apparaît pas, rechargez la page une fois puis rouvrez le menu ⋮.',
      };
    default:
      return {
        plateforme: 'ordinateur',
        titre: 'Installer NOVA',
        intro: 'Installez NOVA pour l’ouvrir dans sa propre fenêtre.',
        etapes: [
          'Repérez l’icône d’installation à droite de la barre d’adresse.',
          'Sinon, ouvrez le menu du navigateur (⋮ ou …).',
          'Choisissez « Installer NOVA » ou « Installer l’application ».',
          'Confirmez : NOVA s’ouvre dans sa propre fenêtre.',
        ],
        astuce: contexteNonSecurise ? astuceSecurite : undefined,
      };
  }
}
