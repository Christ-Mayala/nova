/**
 * Client Socket.IO de l'application NOVA.
 *
 * Une seule connexion est partagée par toute l'application : chaque composant
 * s'abonne aux événements dont il a besoin (`message:nouveau`,
 * `commentaire:nouveau`, `notification:nouvelle`…) sans ouvrir de socket
 * supplémentaire.
 *
 * En développement, l'URL est laissée à l'origine courante : la réécriture
 * Next proxifie `/socket.io` vers le backend DRY, ce qui évite toute
 * dépendance CORS. En production (Netlify), le temps réel est servi par la
 * même API que le reste de l'application : `NEXT_PUBLIC_SOCKET_URL` pointe
 * donc vers l'API Render, et le client s'y connecte directement car les
 * WebSockets ne traversent pas les fonctions serverless Netlify.
 */

import { io, type Socket } from 'socket.io-client';

import { lireToken } from './api';

let socket: Socket | null = null;

/**
 * Retourne la connexion partagée, en l'ouvrant si nécessaire.
 * Renvoie `null` lorsqu'aucune session n'est établie (pas de jeton).
 */
export function obtenirSocket(): Socket | null {
  if (typeof window === 'undefined') return null;
  const token = lireToken();
  if (!token) {
    fermerSocket();
    return null;
  }

  if (socket) {
    // Le jeton a pu être renouvelé : on met à jour l'authentification et on
    // relance la connexion si elle a été interrompue.
    socket.auth = { token };
    if (!socket.connected) socket.connect();
    return socket;
  }

  const urlServeur = (process.env.NEXT_PUBLIC_SOCKET_URL || '').trim().replace(/\/$/, '');

  socket = io(urlServeur || window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    withCredentials: true,
    reconnection: true,
  });

  return socket;
}

/** Ferme la connexion partagée (déconnexion, changement de compte). */
export function fermerSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}
