'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { authentification, definirToken, ErreurAPI, lireToken } from '@/lib/api';
import type { PermissionsNova, Utilisateur } from '@/lib/types';

/** Vrai si l'erreur traduit une session réellement invalide (et non une panne réseau). */
function sessionInvalide(e: unknown): boolean {
  return e instanceof ErreurAPI && (e.statut === 401 || e.statut === 403);
}

interface ValeurAuth {
  utilisateur: Utilisateur | null;
  chargement: boolean;
  estConnecte: boolean;
  /** Administrateur, ou propriétaire autonome (compte sans droits explicites). */
  estAdmin: boolean;
  /** Droits fins de l'espace (null = accès complet, compte propriétaire). */
  permissions: PermissionsNova | null;
  /** Droit d'écriture sur le contenu. */
  peutEditer: boolean;
  peutCommenter: boolean;
  peutPartager: boolean;
  connexion: (email: string, password: string) => Promise<void>;
  inscription: (payload: { name: string; email: string; password: string }) => Promise<void>;
  deconnexion: () => Promise<void>;
  rafraichirProfil: () => Promise<void>;
}

const AuthContext = createContext<ValeurAuth | null>(null);

/** Fournit l'état d'authentification (JWT) à toute l'application. */
export function FournisseurAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [chargement, setChargement] = useState(true);

  const rafraichirProfil = useCallback(async () => {
    if (!lireToken()) {
      setUtilisateur(null);
      return;
    }
    try {
      const profil = await authentification.profil();
      setUtilisateur(profil);
    } catch (e) {
      // Panne réseau : on garde la session en place, seule une session
      // réellement invalide doit déconnecter l'utilisateur.
      if (sessionInvalide(e)) {
        definirToken(null);
        setUtilisateur(null);
      }
    }
  }, []);

  useEffect(() => {
    let annule = false;
    (async () => {
      if (lireToken()) {
        try {
          const profil = await authentification.profil();
          if (!annule) setUtilisateur(profil);
        } catch (e) {
          if (sessionInvalide(e)) {
            definirToken(null);
          }
          if (!annule) setUtilisateur(null);
        }
      }
      if (!annule) setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, []);

  const connexion = useCallback(async (email: string, password: string) => {
    const session = await authentification.connexion(email, password);
    definirToken(session.token, session.refreshToken);
    setUtilisateur(session.user);
  }, []);

  const inscription = useCallback(async (payload: { name: string; email: string; password: string }) => {
    const session = await authentification.inscription(payload);
    definirToken(session.token, session.refreshToken);
    setUtilisateur(session.user);
  }, []);

  const deconnexion = useCallback(async () => {
    // Retour visuel immédiat : on vide l'état local avant l'appel réseau.
    definirToken(null);
    setUtilisateur(null);
    try {
      await authentification.deconnexion();
    } catch {
      /* silencieux : l'utilisateur est déjà déconnecté côté client */
    }
    // Ramène systématiquement à la page de connexion après déconnexion.
    router.push('/connexion');
  }, [router]);

  const valeur = useMemo<ValeurAuth>(() => {
    const permissions = utilisateur?.novaPermissions ?? null;
    const connecte = Boolean(utilisateur);
    return {
      utilisateur,
      chargement,
      estConnecte: connecte,
      // Un compte sans permissions explicites est le propriétaire de l'espace
      // de travail (auto-inscrit) : il administre au même titre qu'un admin.
      // Les membres invités reçoivent, eux, des permissions explicites.
      estAdmin:
        connecte &&
        (utilisateur?.role === 'admin' ||
          utilisateur?.role === 'superadmin' ||
          permissions?.admin === true ||
          permissions === null),
      permissions,
      // Sans permissions explicites, on conserve l'accès complet historique
      // (compte propriétaire auto-inscrit). Les membres invités reçoivent des
      // permissions explicites qui, elles, sont strictement appliquées.
      peutEditer: connecte && (permissions ? permissions.edition : true),
      peutCommenter: connecte && (permissions ? permissions.commentaire : true),
      peutPartager: connecte && (permissions ? permissions.partage : true),
      connexion,
      inscription,
      deconnexion,
      rafraichirProfil,
    };
  }, [utilisateur, chargement, connexion, inscription, deconnexion, rafraichirProfil]);

  return <AuthContext.Provider value={valeur}>{children}</AuthContext.Provider>;
}

/** Accède au contexte d'authentification (doit être sous `FournisseurAuth`). */
export function useAuth(): ValeurAuth {
  const contexte = useContext(AuthContext);
  if (!contexte) throw new Error('useAuth doit être utilisé dans un FournisseurAuth');
  return contexte;
}
