'use client';

import { useEffect } from 'react';

/**
 * Enregistre le service worker de la PWA.
 *
 * L'enregistrement est volontairement limité au build de production : en
 * développement, un service worker mettrait en cache des chunks éphémères et
 * provoquerait des écrans obsolètes.
 */
export function EnregistrementSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;

    const avaitControleur = Boolean(navigator.serviceWorker.controller);
    let dejaRecharge = false;

    const surControle = () => {
      if (!avaitControleur || dejaRecharge) return;
      dejaRecharge = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', surControle);
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', surControle);
    };
  }, []);

  return null;
}
