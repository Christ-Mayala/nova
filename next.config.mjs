/**
 * Configuration Next.js.
 *
 * Le front consomme l'API DRY (multi-tenant) exposée sur `/api/v1/notion/*`.
 * On passe par une réécriture (proxy serveur) plutôt que par un appel direct
 * navigateur → serveur DRY : cela évite toute dépendance à la configuration
 * CORS du backend et garde le navigateur en same-origin.
 *
 * L'URL du backend est configurable via la variable d'environnement
 * `DRY_API_URL` (par défaut http://localhost:5000, le port du serveur DRY).
 */
const DRY_API_URL = (process.env.DRY_API_URL || 'http://localhost:5000').replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Permet de construire dans un dossier séparé pendant qu'un serveur de
  // développement occupe `.next` (utile en local ; Netlify garde `.next`).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${DRY_API_URL}/api/:path*`,
      },
      {
        // Assistant IA : le proxy OpenAI-compatible de FreeLLM est monté à la
        // racine du backend DRY (`/v1/...`), en dehors du préfixe multi-tenant.
        source: '/v1/:path*',
        destination: `${DRY_API_URL}/v1/:path*`,
      },
      {
        // Temps réel : Socket.IO est monté à la racine du backend DRY
        // (`/socket.io/...`). En local, la réécriture proxifie le handshake ;
        // en production, le client se connecte directement à l'API via
        // NEXT_PUBLIC_SOCKET_URL (les WebSockets ne passent pas par Netlify).
        source: '/socket.io/:path*',
        destination: `${DRY_API_URL}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;
