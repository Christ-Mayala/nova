import type { MetadataRoute } from 'next';

/**
 * Manifeste PWA de NOVA.
 *
 * Next.js sert automatiquement ce fichier sur `/manifest.webmanifest` et
 * ajoute la balise <link rel="manifest">. Les icônes sont générées dans
 * `public/icons` à partir du logo officiel.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'NOVA — Espace de travail',
    short_name: 'NOVA',
    description:
      'Éditeur de blocs, bases de données multi-vues, wikis et documents réunis dans un même espace de travail.',
    lang: 'fr',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#2383e2',
    categories: ['productivity', 'business', 'utilities'],
    icons: [
      {
        src: '/icons/icon-96.png',
        sizes: '96x96',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Tâches',
        short_name: 'Tâches',
        description: 'Ouvrir la vue des tâches',
        url: '/taches',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Recherche',
        short_name: 'Recherche',
        description: 'Rechercher dans tout l’espace de travail',
        url: '/recherche',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
