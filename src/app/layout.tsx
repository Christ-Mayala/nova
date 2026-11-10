import type { Metadata, Viewport } from 'next';

import './globals.css';
import { EnregistrementSW } from '@/components/pwa/EnregistrementSW';
import { GuideInstallation } from '@/components/pwa/GuideInstallation';
import { InviteInstallation } from '@/components/pwa/InviteInstallation';
import { FournisseurConfirmation } from '@/components/ui/Confirmation';
import { FournisseurToasts } from '@/components/ui/Toasts';
import { FournisseurApparence } from '@/context/ApparenceContext';
import { FournisseurAuth } from '@/context/AuthContext';
import { FournisseurDonnees } from '@/context/DonneesContext';
import { FournisseurInterface } from '@/context/InterfaceContext';
import { FournisseurLangue } from '@/context/LangueContext';
import { FournisseurTempsReel } from '@/context/TempsReelContext';

export const metadata: Metadata = {
  applicationName: 'NOVA',
  title: 'NOVA — Espace de travail tout-en-un',
  description:
    'NOVA Workspace — Think. Organize. Create. Éditeur de blocs, bases de données multi-vues, wikis et documents réunis dans un même espace de travail.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192.png',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'NOVA',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  // La traduction automatique du navigateur mute les nœuds de texte gérés par
  // React (erreur NotFoundError: insertBefore/removeChild). L'application
  // fournit déjà son propre sélecteur de langue.
  other: { google: 'notranslate' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#191919' },
  ],
};

/**
 * Capture `beforeinstallprompt` avant l'hydratation : certains navigateurs
 * déclenchent l'événement très tôt, avant que le composant d'invitation soit
 * monté. L'événement est conservé pour être rejoué depuis l'interface.
 */
const SCRIPT_INSTALLATION = `(function(){window.__novaInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__novaInstallPrompt=e;window.dispatchEvent(new CustomEvent('nova:installprompt'));});window.addEventListener('appinstalled',function(){window.__novaInstallPrompt=null;});})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_INSTALLATION }} />
      </head>
      <body>
        <FournisseurApparence>
          <FournisseurToasts>
            <FournisseurConfirmation>
              <FournisseurAuth>
                <FournisseurTempsReel>
                  <FournisseurDonnees>
                    <FournisseurLangue>
                      <FournisseurInterface>{children}</FournisseurInterface>
                    </FournisseurLangue>
                  </FournisseurDonnees>
                </FournisseurTempsReel>
              </FournisseurAuth>
            </FournisseurConfirmation>
          </FournisseurToasts>
        </FournisseurApparence>
        <EnregistrementSW />
        <InviteInstallation />
        <GuideInstallation />
      </body>
    </html>
  );
}
