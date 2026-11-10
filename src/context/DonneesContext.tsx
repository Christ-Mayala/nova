'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  espaces as apiEspaces,
  favoris as apiFavoris,
  listerTout,
  notifications as apiNotifications,
  pages as apiPages,
  parametres as apiParametres,
  workspaces as apiWorkspaces,
} from '@/lib/api';
import type { Espace, Favori, Notification, Page, Parametre, Workspace } from '@/lib/types';
import { identifiantDe } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useEvenementTempsReel } from '@/context/TempsReelContext';
import { useToasts } from '@/components/ui/Toasts';

/** Filtres optionnels appliqués à l'arbre des pages. */
export interface FiltrePages {
  espaceId?: string;
  section?: Page['section'];
}

/** Clé de persistance de l'espace de travail actif (bascule rapide au retour). */
const CLE_WORKSPACE_ACTIF = 'nova.workspaceActif';

/** Lit l'identifiant d'espace de travail mémorisé côté navigateur. */
function lireWorkspaceActif(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CLE_WORKSPACE_ACTIF);
}

/**
 * Écarte les documents à la corbeille : l'interface ne doit jamais proposer un
 * élément dont le statut est « deleted », même si le serveur en renvoie.
 */
function sansSupprimes<T extends { status?: string }>(liste: T[]): T[] {
  return liste.filter((item) => item.status !== 'deleted');
}

interface ValeurDonnees {
  espaces: Espace[];
  pages: Page[];
  favoris: Favori[];
  notifications: Notification[];
  parametre: Parametre | null;
  /** Espaces de travail de l'utilisateur (5 au maximum). */
  workspaces: Workspace[];
  /** Espace de travail actuellement sélectionné. */
  workspaceActif: Workspace | null;
  /** Bascule vers un autre espace de travail (le contenu chargé suit). */
  changerWorkspace: (id: string) => void;
  chargement: boolean;
  erreur: string | null;
  rafraichir: () => Promise<void>;
  enfantsDe: (parentId: string | null, filtre?: FiltrePages) => Page[];
  pageParId: (id: string) => Page | undefined;
  espaceParId: (id: string) => Espace | undefined;
  espaceParSlug: (slug: string) => Espace | undefined;
  pagesParEspace: (espaceId: string) => Page[];
  /** Pages favorites, dans l'ordre défini par les favoris. */
  pagesFavorites: () => Page[];
  estFavori: (pageId: string) => boolean;
  basculerFavori: (page: Page) => Promise<void>;
  /** Met à jour une page dans la liste locale (titre, icône…) sans rechargement. */
  majPageLocale: (id: string, patch: Partial<Page>) => void;
  notificationsNonLues: number;
  marquerNotificationLue: (id: string) => Promise<void>;
  toutMarquerLu: () => Promise<void>;
}

const DonneesContext = createContext<ValeurDonnees | null>(null);

/** Charge et expose les données transverses de l'espace de travail. */
export function FournisseurDonnees({ children }: { children: ReactNode }) {
  const { utilisateur, estAdmin, chargement: chargementAuth } = useAuth();
  const toasts = useToasts();
  const [espaces, setEspaces] = useState<Espace[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [favoris, setFavoris] = useState<Favori[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [parametre, setParametre] = useState<Parametre | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceActifId, setWorkspaceActifId] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async () => {
    try {
      setErreur(null);
      const [listeWorkspaces, listeEspaces, listePages, listeFavoris, listeNotifications, params] =
        await Promise.all([
          listerTout(apiWorkspaces, { sort: 'ordre' }),
          listerTout(apiEspaces, { sort: 'ordre' }),
          listerTout(apiPages, { sort: 'ordre' }),
          listerTout(apiFavoris, { sort: 'ordre' }),
          listerTout(apiNotifications, { sort: '-createdAt' }),
          apiParametres.lister({ limit: 1 }).then((r) => r.data?.[0] ?? null),
        ]);
      setWorkspaces(listeWorkspaces);
      setEspaces(listeEspaces);
      setPages(listePages);
      setFavoris(listeFavoris);
      setNotifications(listeNotifications);
      setParametre(params);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Erreur lors du chargement des données de l’espace.';
      setErreur(message);
    } finally {
      setChargement(false);
    }
  }, []);

  // Les espaces et pages sont filtrés côté serveur et exigent une session : on
  // n'interroge l'API qu'une fois le profil résolu et l'utilisateur connecté,
  // puis on recharge à chaque changement de compte (connexion / déconnexion).
  const utilisateurId = utilisateur?._id ?? null;

  useEffect(() => {
    if (chargementAuth) return;
    if (!utilisateurId) {
      setWorkspaces([]);
      setEspaces([]);
      setPages([]);
      setFavoris([]);
      setNotifications([]);
      setParametre(null);
      setErreur(null);
      setChargement(false);
      return;
    }
    setChargement(true);
    rafraichir();
  }, [chargementAuth, utilisateurId, rafraichir]);

  /** Recharge silencieusement l'arbre des pages (événements temps réel). */
  const rechargerPages = useCallback(async () => {
    try {
      const liste = await listerTout(apiPages, { sort: 'ordre' });
      setPages(liste);
    } catch {
      /* silencieux : un échec ponctuel ne doit pas casser l'affichage */
    }
  }, []);

  // Toute activité d'équipe diffusée en temps réel rafraîchit l'arbre des pages :
  // une page créée, déplacée, supprimée ou restaurée apparaît sans rechargement.
  useEvenementTempsReel<unknown>('page:nouveau', () => void rechargerPages());
  useEvenementTempsReel<unknown>('page:maj', () => void rechargerPages());
  useEvenementTempsReel<unknown>('page:supprime', () => void rechargerPages());
  useEvenementTempsReel<unknown>('page:restaure', () => void rechargerPages());

  // Notification d'équipe reçue en direct : on l'ajoute à la boîte de réception
  // et on affiche un toast en temps réel pour que l'utilisateur soit averti aussitôt.
  useEvenementTempsReel<Notification>('notification:nouvelle', (notification) => {
    if (!notification?._id) return;
    if (
      utilisateurId &&
      notification.destinataireId &&
      String(notification.destinataireId) !== String(utilisateurId)
    ) {
      return;
    }
    setNotifications((prec) =>
      prec.some((n) => n._id === notification._id) ? prec : [notification, ...prec]
    );
    if (notification.titre) {
      toasts.info(notification.titre, notification.message);
    }
  });

  // Espace de travail actif : on reprend celui mémorisé, à défaut le premier.
  // Un identifiant devenu invalide (espace supprimé) retombe sur le premier.
  useEffect(() => {
    if (workspaces.length === 0) {
      setWorkspaceActifId(null);
      return;
    }
    setWorkspaceActifId((prec) => {
      const candidat = prec || lireWorkspaceActif();
      return candidat && workspaces.some((w) => w._id === candidat)
        ? candidat
        : workspaces[0]._id;
    });
  }, [workspaces]);

  const changerWorkspace = useCallback((id: string) => {
    setWorkspaceActifId(id);
    if (typeof window !== 'undefined') window.localStorage.setItem(CLE_WORKSPACE_ACTIF, id);
  }, []);

  const workspaceActif = useMemo(
    () => workspaces.find((w) => w._id === workspaceActifId) ?? workspaces[0] ?? null,
    [workspaces, workspaceActifId]
  );

  const premierWorkspaceId = workspaces[0]?._id ?? null;

  // Filtrage des espaces d'équipe : un administrateur voit tout ; un membre
  // invité est limité aux espaces qui lui ont été attribués (`novaEspaceIds`).
  // `null` = aucun filtrage (propriétaire / compte sans restriction).
  const espaceIdsAutorises = useMemo<string[] | null>(() => {
    if (estAdmin) return null;
    const ids = utilisateur?.novaEspaceIds;
    return Array.isArray(ids) ? ids : null;
  }, [utilisateur, estAdmin]);

  /**
   * Vrai si un élément (page ou espace d'équipe) appartient à l'espace de
   * travail actif.
   *
   * - Aucun espace de travail (cas transitoire) : aucun filtrage.
   * - Élément sans `workspaceId` (contenu historique) ou partagé avec un membre
   *   invité : rattaché au premier espace de travail, « Mon Espace ».
   * - Sinon : l'élément n'apparaît que dans son propre espace de travail.
   */
  const appartientWorkspaceActif = useCallback(
    (item: { workspaceId?: Workspace | string | null }, partage = false) => {
      if (workspaces.length === 0) return true;
      const cible = workspaceActif?._id ?? premierWorkspaceId;
      const wid = identifiantDe(item.workspaceId);
      if (!wid || partage) return cible === premierWorkspaceId;
      return wid === cible;
    },
    [workspaces.length, workspaceActif, premierWorkspaceId]
  );

  const espacesVisibles = useMemo(() => {
    if (espaceIdsAutorises) {
      const autorises = new Set(espaceIdsAutorises);
      // Espaces d'équipe attribués au membre invité : ils appartiennent à son
      // espace par défaut, pas aux espaces de travail qu'il crée ensuite.
      return sansSupprimes(espaces).filter((e) => autorises.has(e._id) && appartientWorkspaceActif(e, true));
    }
    return sansSupprimes(espaces).filter((e) => appartientWorkspaceActif(e));
  }, [espaces, espaceIdsAutorises, appartientWorkspaceActif]);

  const pagesVisibles = useMemo(() => {
    const moi = utilisateur?._id ? String(utilisateur._id) : null;
    return sansSupprimes(pages).filter((p) => {
      // Une page privée n'appartient qu'à son créateur : personne d'autre ne doit la voir.
      const estPrivee = (p.section || 'equipe') === 'prive';
      const proprietaire = Boolean(moi && identifiantDe(p.createdBy) === moi);
      if (estPrivee && !proprietaire) return false;

      const espaceId = identifiantDe(p.espaceId);
      if (espaceIdsAutorises) {
        const autorises = new Set(espaceIdsAutorises);
        if (espaceId) return autorises.has(espaceId) && appartientWorkspaceActif(p, true);
        // Page sans espace : visible uniquement pour son auteur.
        return proprietaire && appartientWorkspaceActif(p);
      }
      return appartientWorkspaceActif(p);
    });
  }, [pages, espaceIdsAutorises, utilisateur, appartientWorkspaceActif]);

  const pageParId = useCallback((id: string) => pagesVisibles.find((p) => p._id === id), [pagesVisibles]);
  const espaceParId = useCallback((id: string) => espacesVisibles.find((e) => e._id === id), [espacesVisibles]);
  const espaceParSlug = useCallback((slug: string) => espacesVisibles.find((e) => e.slug === slug), [espacesVisibles]);
  const pagesParEspace = useCallback(
    (espaceId: string) =>
      pagesVisibles.filter((p) => {
        const ref = p.espaceId;
        const id = typeof ref === 'string' ? ref : ref?._id;
        return id === espaceId;
      }),
    [pagesVisibles]
  );

  const enfantsDe = useCallback(
    (parentId: string | null, filtre?: FiltrePages) =>
      pagesVisibles
        .filter((p) => (parentId ? p.parentId === parentId : !p.parentId))
        .filter((p) => {
          if (!filtre) return true;
          if (filtre.espaceId && identifiantDe(p.espaceId) !== filtre.espaceId) return false;
          if (filtre.section && (p.section || 'equipe') !== filtre.section) return false;
          return true;
        })
        .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)),
    [pagesVisibles]
  );

  const estFavori = useCallback(
    (pageId: string) => favoris.some((f) => (typeof f.pageId === 'string' ? f.pageId : f.pageId?._id) === pageId),
    [favoris]
  );

  const pagesFavorites = useCallback(() => {
    return favoris
      .slice()
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
      .map((f) => {
        const ref = f.pageId;
        const id = typeof ref === 'string' ? ref : ref?._id;
        return pagesVisibles.find((p) => p._id === id) || null;
      })
      .filter((p): p is Page => Boolean(p));
  }, [favoris, pagesVisibles]);

  const basculerFavori = useCallback(
    async (page: Page) => {
      const existant = favoris.find(
        (f) => (typeof f.pageId === 'string' ? f.pageId : f.pageId?._id) === page._id
      );
      if (existant) {
        await apiFavoris.supprimer(existant._id);
        setFavoris((prec) => prec.filter((f) => f._id !== existant._id));
      } else {
        const cree = await apiFavoris.creer({
          pageId: page._id,
          espaceId: typeof page.espaceId === 'string' ? page.espaceId : page.espaceId?._id,
          ordre: favoris.length,
        });
        setFavoris((prec) => [...prec, cree]);
      }
    },
    [favoris]
  );

  const majPageLocale = useCallback((id: string, patch: Partial<Page>) => {
    setPages((prec) => prec.map((p) => (p._id === id ? { ...p, ...patch } : p)));
  }, []);

  /**
   * Marque une notification comme lue puis la retire de la boîte de réception :
   * une notification traitée n'a plus besoin de rester affichée.
   */
  const marquerNotificationLue = useCallback(async (id: string) => {
    const retiree = notifications.find((n) => n._id === id) ?? null;
    setNotifications((prec) => prec.filter((n) => n._id !== id));
    try {
      await apiNotifications.supprimer(id);
    } catch {
      // Échec réseau : on restaure la notification pour ne pas la perdre.
      if (retiree) setNotifications((prec) => (prec.some((n) => n._id === id) ? prec : [retiree, ...prec]));
    }
  }, [notifications]);

  /** Vide la boîte de réception (toutes les notifications sont traitées). */
  const toutMarquerLu = useCallback(async () => {
    if (notifications.length === 0) return;
    const precedentes = notifications;
    setNotifications([]);
    try {
      await Promise.all(precedentes.map((n) => apiNotifications.supprimer(n._id)));
    } catch {
      // Échec partiel : on recharge l'état réel depuis le serveur.
      try {
        const liste = await listerTout(apiNotifications, { sort: '-createdAt' });
        setNotifications(liste);
      } catch {
        setNotifications(precedentes);
      }
    }
  }, [notifications]);

  const notificationsNonLues = useMemo(
    () => notifications.filter((n) => !n.lu).length,
    [notifications]
  );

  const valeur = useMemo<ValeurDonnees>(
    () => ({
      espaces: espacesVisibles,
      pages: pagesVisibles,
      favoris,
      notifications,
      parametre,
      workspaces,
      workspaceActif,
      changerWorkspace,
      chargement,
      erreur,
      rafraichir,
      enfantsDe,
      pageParId,
      espaceParId,
      espaceParSlug,
      pagesParEspace,
      pagesFavorites,
      estFavori,
      basculerFavori,
      majPageLocale,
      notificationsNonLues,
      marquerNotificationLue,
      toutMarquerLu,
    }),
    [
      espacesVisibles,
      pagesVisibles,
      favoris,
      notifications,
      parametre,
      workspaces,
      workspaceActif,
      changerWorkspace,
      chargement,
      erreur,
      rafraichir,
      enfantsDe,
      pageParId,
      espaceParId,
      espaceParSlug,
      pagesParEspace,
      pagesFavorites,
      estFavori,
      basculerFavori,
      majPageLocale,
      notificationsNonLues,
      marquerNotificationLue,
      toutMarquerLu,
    ]
  );

  return <DonneesContext.Provider value={valeur}>{children}</DonneesContext.Provider>;
}

/** Accède aux données transverses (doit être sous `FournisseurDonnees`). */
export function useDonnees(): ValeurDonnees {
  const contexte = useContext(DonneesContext);
  if (!contexte) throw new Error('useDonnees doit être utilisé dans un FournisseurDonnees');
  return contexte;
}
