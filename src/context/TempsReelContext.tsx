'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';

import { fermerSocket, obtenirSocket } from '@/lib/tempsReel';
import { useAuth } from '@/context/AuthContext';

/**
 * Connexion Socket.IO partagée. Elle est ouverte dès qu'une session existe et
 * fermée à la déconnexion : tous les composants temps réel s'y abonnent.
 */
const TempsReelContext = createContext<Socket | null>(null);

export function FournisseurTempsReel({ children }: { children: ReactNode }) {
  const { utilisateur, chargement } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (chargement) return;
    if (!utilisateur) {
      fermerSocket();
      setSocket(null);
      return;
    }
    setSocket(obtenirSocket());
  }, [chargement, utilisateur?._id]);

  return <TempsReelContext.Provider value={socket}>{children}</TempsReelContext.Provider>;
}

/** Accède à la connexion partagée (peut être `null` hors session). */
export function useSocketTempsReel(): Socket | null {
  return useContext(TempsReelContext);
}

/**
 * S'abonne à un événement temps réel pendant la vie du composant.
 * Le gestionnaire est conservé dans une référence : l'abonnement n'est pas
 * recréé à chaque rendu, même si la fonction change d'identité.
 */
export function useEvenementTempsReel<T>(
  evenement: string,
  gestionnaire: (donnees: T) => void
): void {
  const socket = useContext(TempsReelContext);
  const ref = useRef(gestionnaire);
  ref.current = gestionnaire;

  useEffect(() => {
    if (!socket) return;
    const rappel = (donnees: T) => ref.current(donnees);
    socket.on(evenement, rappel as (...args: unknown[]) => void);
    return () => {
      socket.off(evenement, rappel as (...args: unknown[]) => void);
    };
  }, [socket, evenement]);
}
