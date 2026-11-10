'use client';

import { Download, Plus, Share, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  EVENEMENT_INVITE,
  estStandalone,
  estiOS,
  inviteInstallation,
  lancerInstallation,
} from '@/lib/pwa';

const CLE_INVITE = 'nova.pwa.invite';
const DELAI_REFUS = 30 * 24 * 60 * 60 * 1000;
const DELAI_AFFICHAGE = 1500;

const inviteRefuseeRecemment = () => {
  try {
    const date = Number(window.localStorage.getItem(CLE_INVITE) || 0);
    return Number.isFinite(date) && Date.now() - date < DELAI_REFUS;
  } catch {
    return false;
  }
};

/**
 * Invitation discrète à installer NOVA.
 *
 * - Chrome / Edge / Android : utilise l'événement `beforeinstallprompt`,
 *   capturé tôt dans le layout pour ne jamais le manquer.
 * - iOS / Safari : affiche la procédure « Partager → Sur l'écran d'accueil ».
 *
 * La bannière est visible sur mobile comme sur ordinateur, et peut être
 * masquée pendant 30 jours.
 */
export function InviteInstallation() {
  const [visible, setVisible] = useState(false);
  const [plateforme, setPlateforme] = useState<'natif' | 'ios' | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || estStandalone()) return;

    let minuterie: number | null = null;
    let dejaPropose = false;

    const proposer = (type: 'natif' | 'ios') => {
      if (dejaPropose || inviteRefuseeRecemment()) return;
      dejaPropose = true;
      setPlateforme(type);
      minuterie = window.setTimeout(() => setVisible(true), DELAI_AFFICHAGE);
    };

    if (inviteInstallation()) {
      proposer('natif');
    } else if (estiOS()) {
      proposer('ios');
    }

    const surInvite = () => proposer('natif');

    const surInstalle = () => {
      setVisible(false);
      setPlateforme(null);
    };

    window.addEventListener(EVENEMENT_INVITE, surInvite);
    window.addEventListener('beforeinstallprompt', surInvite);
    window.addEventListener('appinstalled', surInstalle);

    return () => {
      if (minuterie !== null) window.clearTimeout(minuterie);
      window.removeEventListener(EVENEMENT_INVITE, surInvite);
      window.removeEventListener('beforeinstallprompt', surInvite);
      window.removeEventListener('appinstalled', surInstalle);
    };
  }, []);

  const refuser = () => {
    try {
      window.localStorage.setItem(CLE_INVITE, String(Date.now()));
    } catch {
      // stockage indisponible : on masque simplement pour la session
    }
    setVisible(false);
  };

  const installer = async () => {
    const resultat = await lancerInstallation();
    if (resultat === 'accepted') {
      setVisible(false);
      setPlateforme(null);
      return;
    }
    refuser();
  };

  if (!visible || !plateforme) return null;

  return (
    <div
      className="fixed inset-x-4 z-40 rounded-xl border shadow-lg sm:left-auto sm:right-4 sm:w-[22rem]"
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
                onClick={() => void installer()}
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
