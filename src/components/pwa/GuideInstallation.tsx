'use client';

import { Download, Lightbulb, Share } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Modale } from '@/components/ui/Modale';
import {
  EVENEMENT_GUIDE,
  type GuideInstallation as Guide,
  guideInstallation,
  inviteInstallation,
  lancerInstallation,
} from '@/lib/pwa';

/**
 * Guide d'installation pas-à-pas.
 *
 * S'ouvre lorsqu'aucune boîte de dialogue native n'est disponible (iOS,
 * navigateur intégré, contexte non sécurisé…). La procédure est adaptée à
 * l'appareil : deux gestes sur Android (Chrome) comme sur iOS (Safari).
 *
 * Le composant écoute un événement global : n'importe quel bouton « Installer
 * NOVA » peut l'ouvrir via `ouvrirGuideInstallation()`.
 */
export function GuideInstallation() {
  const [ouvert, setOuvert] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [natifDisponible, setNatifDisponible] = useState(false);

  const ouvrir = useCallback(() => {
    setGuide(guideInstallation());
    setNatifDisponible(Boolean(inviteInstallation()));
    setOuvert(true);
  }, []);

  useEffect(() => {
    window.addEventListener(EVENEMENT_GUIDE, ouvrir);
    return () => window.removeEventListener(EVENEMENT_GUIDE, ouvrir);
  }, [ouvrir]);

  const installer = async () => {
    const resultat = await lancerInstallation();
    if (resultat === 'accepted') {
      setOuvert(false);
      return;
    }
    setNatifDisponible(Boolean(inviteInstallation()));
  };

  if (!guide) return null;

  return (
    <Modale
      ouvert={ouvert}
      onFermer={() => setOuvert(false)}
      titre={guide.titre}
      description={guide.intro}
      largeur="max-w-md"
    >
      <ol className="flex flex-col gap-3">
        {guide.etapes.map((etape, index) => (
          <li key={etape} className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--fond-tertiaire)', color: 'var(--texte)' }}
            >
              {index + 1}
            </span>
            <span className="text-sm leading-relaxed">
              {etape}
              {etape.includes('Partager') && (
                <Share className="ml-1 inline h-3.5 w-3.5 align-text-bottom texte-doux" />
              )}
            </span>
          </li>
        ))}
      </ol>

      {guide.astuce && (
        <p
          className="mt-4 flex items-start gap-2 rounded-lg p-3 text-xs texte-doux"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{guide.astuce}</span>
        </p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        {natifDisponible && (
          <button
            type="button"
            onClick={() => void installer()}
            className="bouton bouton-primaire gap-1.5 px-3 py-1.5 text-sm"
          >
            <Download className="h-4 w-4" />
            Installer maintenant
          </button>
        )}
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="bouton px-3 py-1.5 text-sm"
        >
          J’ai compris
        </button>
      </div>
    </Modale>
  );
}
