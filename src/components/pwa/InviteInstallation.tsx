'use client';

import { Download, Plus, Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const CLE_INVITE = 'nova.pwa.invite';
const DELAI_REFUS = 30 * 24 * 60 * 60 * 1000;
const DELAI_AFFICHAGE = 1800;

interface EvenementInstallation extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const estiOS = () => {
  if (typeof navigator === 'undefined') return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

const estStandalone = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

const inviteRefuseeRecemment = () => {
  try {
    const date = Number(window.localStorage.getItem(CLE_INVITE) || 0);
    return Number.isFinite(date) && Date.now() - date < DELAI_REFUS;
  } catch {
    return false;
  }
};

/**
 * Invitation discrète à installer NOVA sur l'écran d'accueil.
 *
 * - Android / Chrome : utilise l'événement `beforeinstallprompt`.
 * - iOS / Safari : affiche la procédure « Partager → Sur l'écran d'accueil ».
 */
export function InviteInstallation() {
  const [visible, setVisible] = useState(false);
  const [plateforme, setPlateforme] = useState<'android' | 'ios' | null>(null);
  const [invite, setInvite] = useState<EvenementInstallation | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || estStandalone() || inviteRefuseeRecemment()) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;

    const surInvite = (event: Event) => {
      event.preventDefault();
      setInvite(event as EvenementInstallation);
      setPlateforme('android');
    };

    window.addEventListener('beforeinstallprompt', surInvite);

    const minuterie = window.setTimeout(() => {
      if (estiOS()) {
        setPlateforme('ios');
        setVisible(true);
      }
    }, DELAI_AFFICHAGE);

    const surInstalle = () => {
      setVisible(false);
      setInvite(null);
    };
    window.addEventListener('appinstalled', surInstalle);

    return () => {
      window.clearTimeout(minuterie);
      window.removeEventListener('beforeinstallprompt', surInvite);
      window.removeEventListener('appinstalled', surInstalle);
    };
  }, []);

  useEffect(() => {
    if (!invite) return;
    setVisible(true);
  }, [invite]);

  const refuser = () => {
    try {
      window.localStorage.setItem(CLE_INVITE, String(Date.now()));
    } catch {
      // stockage indisponible : on masque simplement pour la session
    }
    setVisible(false);
  };

  const installer = async () => {
    if (!invite) {
      refuser();
      return;
    }
    await invite.prompt();
    const choix = await invite.userChoice;
    if (choix.outcome === 'accepted') {
      setVisible(false);
      setInvite(null);
    } else {
      refuser();
    }
  };

  if (!visible || !plateforme) return null;

  return (
    <div
      className="fixed inset-x-4 z-40 rounded-xl border shadow-lg md:hidden"
      style={{
        bottom: 'calc(1rem + env(safe-area-inset-bottom))',
        backgroundColor: 'var(--fond)',
        borderColor: 'var(--bordure)',
      }}
      role="dialog"
      aria-label="Installer NOVA"
      translate="no"
    >
      <div className="flex items-start gap-3 p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          className="h-11 w-11 shrink-0 rounded-lg"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Smartphone className="h-3.5 w-3.5" />
            Installer NOVA
          </p>
          {plateforme === 'ios' ? (
            <>
              <p className="mt-1 text-xs texte-doux">
                Dans Safari, touchez <Share className="inline h-3.5 w-3.5 align-text-bottom" />{' '}
                Partager, puis{' '}
                <span className="inline-flex items-center gap-0.5 font-medium">
                  <Plus className="inline h-3.5 w-3.5" />
                  Sur l’écran d’accueil
                </span>
                .
              </p>
              <button type="button" onClick={refuser} className="bouton mt-2.5 px-2.5 py-1 text-xs">
                J’ai compris
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs texte-doux">
                Accédez à NOVA comme une application, même hors ligne.
              </p>
              <button
                type="button"
                onClick={installer}
                className="bouton bouton-primaire mt-2.5 gap-1.5 px-2.5 py-1 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Installer
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={refuser}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Masquer l’invitation"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
