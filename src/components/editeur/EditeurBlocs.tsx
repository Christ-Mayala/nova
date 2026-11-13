'use client';

import { Plus, Redo2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BlocEditeur, indentationDe, type TitreSommaire } from '@/components/editeur/BlocEditeur';
import { focusBloc } from '@/components/editeur/ChampAuto';
import { Chargement } from '@/components/ui/Etats';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useSocketTempsReel } from '@/context/TempsReelContext';
import { blocs as apiBlocs, listerTout } from '@/lib/api';
import type { Bloc, TypeBloc } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Copie d'une liste de blocs destinée à l'historique (contenu/propriétés). */
function copieEtat(etat: Bloc[]): Bloc[] {
  return etat.map((b) => ({ ...b, proprietes: { ...b.proprietes } }));
}

/** Participant présent sur une page (édition collaborative). */
type PartenaireTempsReel = { socketId: string; userId: string; nom: string; couleur: string };

/**
 * Éditeur de blocs d'une page : liste ordonnée, insertion, déplacement,
 * transformation et enregistrement différé vers l'API DRY.
 */
export function EditeurBlocs({
  pageId,
  onCreerBase,
  lectureSeule,
}: {
  pageId: string;
  onCreerBase?: () => void;
  lectureSeule?: boolean;
}) {
  const { peutEditer } = useAuth();
  const toasts = useToasts();

  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [chargement, setChargement] = useState(true);
  const [etatSauvegarde, setEtatSauvegarde] = useState<'inactif' | 'en_cours' | 'enregistre' | 'erreur'>(
    'inactif'
  );
  const minuteurs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const enAttente = useRef<Map<string, Bloc>>(new Map());
  const lireSeulement = Boolean(lectureSeule) || !peutEditer;

  /* Édition collaborative : connexion partagée, participants présents et
     reflet de la connexion pour les rappels qui ne doivent pas être recréés. */
  const socket = useSocketTempsReel();
  const socketRef = useRef<ReturnType<typeof useSocketTempsReel>>(null);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  const [participants, setParticipants] = useState<PartenaireTempsReel[]>([]);

  /* Historique local : annulation (Ctrl+Z) et rétablissement (Ctrl+Maj+Z). */
  const historique = useRef<{ pile: Bloc[][]; index: number }>({ pile: [], index: -1 });
  const dernierAjout = useRef(0);
  /** Reflet de l'état courant : évite les fermetures obsolètes sur l'historique. */
  const blocsRef = useRef<Bloc[]>([]);
  useEffect(() => {
    blocsRef.current = blocs;
  }, [blocs]);
  const [peutAnnuler, setPeutAnnuler] = useState(false);
  const [peutRetablir, setPeutRetablir] = useState(false);

  /* Glisser-déposer : bloc saisi et emplacement d'insertion survolé. */
  const [blocGlisse, setBlocGlisse] = useState<string | null>(null);
  const [insertion, setInsertion] = useState<{ id: string; position: 'avant' | 'apres' } | null>(null);

  /** Met à jour l'état des boutons « Annuler / Rétablir ». */
  const synchroniserHistorique = useCallback(() => {
    const h = historique.current;
    setPeutAnnuler(h.index > 0);
    setPeutRetablir(h.index < h.pile.length - 1);
  }, []);

  const reinitialiserHistorique = useCallback(
    (etat: Bloc[]) => {
      historique.current = { pile: [copieEtat(etat)], index: 0 };
      dernierAjout.current = 0;
      synchroniserHistorique();
    },
    [synchroniserHistorique]
  );

  /** Empile un instantané ; les frappes rapprochées sont fusionnées en une étape. */
  const pousserHistorique = useCallback(
    (etat: Bloc[], structurel = false) => {
      const maintenant = Date.now();
      const h = historique.current;
      const coalescer = !structurel && h.index > 0 && maintenant - dernierAjout.current < 800;
      dernierAjout.current = maintenant;
      if (coalescer) {
        h.pile = [...h.pile.slice(0, h.index), copieEtat(etat)];
      } else {
        const tronque = h.pile.slice(0, h.index + 1);
        tronque.push(copieEtat(etat));
        if (tronque.length > 100) tronque.shift();
        historique.current = { pile: tronque, index: tronque.length - 1 };
      }
      synchroniserHistorique();
    },
    [synchroniserHistorique]
  );

  /**
   * Restaure un instantané : les blocs existants sont mis à jour, ceux ajoutés
   * depuis sont supprimés et ceux supprimés depuis sont recréés côté serveur.
   * Les fautes de frappe comme les suppressions accidentelles sont rattrapées.
   */
  const appliquerInstantane = useCallback(
    async (etat: Bloc[]) => {
      // Les enregistrements différés sont abandonnés : l'instantané fait foi.
      Object.values(minuteurs.current).forEach(clearTimeout);
      minuteurs.current = {};
      enAttente.current.clear();

      const actuels = blocsRef.current;
      const idsCible = new Set(etat.map((b) => b._id));
      const idsActuels = new Set(actuels.map((b) => b._id));

      // Blocs apparus depuis l'instantané : ils disparaissent à nouveau.
      actuels
        .filter((b) => !idsCible.has(b._id))
        .forEach((b) => void apiBlocs.supprimer(b._id).catch(() => undefined));

      const resultat: Bloc[] = [];
      for (const bloc of etat) {
        if (idsActuels.has(bloc._id)) {
          void apiBlocs
            .maj(bloc._id, {
              contenu: bloc.contenu,
              proprietes: bloc.proprietes,
              type: bloc.type,
              ordre: bloc.ordre,
            })
            .catch(() => undefined);
          resultat.push(bloc);
          continue;
        }
        // Bloc supprimé depuis l'instantané : il est recréé.
        try {
          const cree = await apiBlocs.creer({
            pageId,
            type: bloc.type,
            contenu: bloc.contenu,
            proprietes: bloc.proprietes,
            ordre: bloc.ordre,
          } as Partial<Bloc>);
          resultat.push({ ...bloc, _id: cree._id });
        } catch {
          resultat.push(bloc);
        }
      }

      blocsRef.current = resultat;
      setBlocs(resultat);
      setEtatSauvegarde('enregistre');
    },
    [pageId]
  );

  const annuler = useCallback(() => {
    const h = historique.current;
    if (h.index <= 0) return;
    h.index -= 1;
    dernierAjout.current = 0;
    synchroniserHistorique();
    void appliquerInstantane(h.pile[h.index]);
  }, [appliquerInstantane, synchroniserHistorique]);

  const retablir = useCallback(() => {
    const h = historique.current;
    if (h.index >= h.pile.length - 1) return;
    h.index += 1;
    dernierAjout.current = 0;
    synchroniserHistorique();
    void appliquerInstantane(h.pile[h.index]);
  }, [appliquerInstantane, synchroniserHistorique]);

  useEffect(() => {
    if (lireSeulement) return;
    const surTouche = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const touche = e.key.toLowerCase();
      if (touche === 'z' && !e.shiftKey) {
        e.preventDefault();
        annuler();
      } else if ((touche === 'z' && e.shiftKey) || touche === 'y') {
        e.preventDefault();
        retablir();
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [lireSeulement, annuler, retablir]);

  /* Chargement initial */
  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      try {
        const trouves = await listerTout(apiBlocs, { pageId, sort: 'ordre' });
        const filtre = trouves
          .filter((b) => b.pageId === pageId)
          .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
        if (!annule) {
          setBlocs(filtre);
          reinitialiserHistorique(filtre);
        }
      } catch {
        if (!annule) setBlocs([]);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [pageId, reinitialiserHistorique]);

  /**
   * Recharge les blocs depuis le serveur. Utilisé après une écriture assistée
   * par l'IA (bloc « IA → page ») : la liste affichée doit refléter
   * immédiatement le contenu enregistré côté serveur.
   */
  const recharger = useCallback(async () => {
    try {
      const trouves = await listerTout(apiBlocs, { pageId, sort: 'ordre' });
      const filtre = trouves
        .filter((b) => b.pageId === pageId)
        .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
      blocsRef.current = filtre;
      setBlocs(filtre);
      reinitialiserHistorique(filtre);
    } catch {
      /* Le contenu affiché reste inchangé si le rechargement échoue. */
    }
  }, [pageId, reinitialiserHistorique]);

  /** Envoie un bloc à l'API et met à jour l'indicateur d'enregistrement. */
  const sauvegarderBloc = useCallback(
    async (bloc: Bloc) => {
      enAttente.current.delete(bloc._id);
      try {
        await apiBlocs.maj(bloc._id, {
          contenu: bloc.contenu,
          proprietes: bloc.proprietes,
          type: bloc.type,
          ordre: bloc.ordre,
        });
        setEtatSauvegarde('enregistre');
        // Les autres éditeurs de la page appliquent la même version du bloc.
        socketRef.current?.emit('bloc:diffuser', { pageId, bloc });
      } catch (e) {
        setEtatSauvegarde('erreur');
        toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [pageId, toasts]
  );

  /* Enregistrement différé d'un bloc modifié */
  const enregistrer = useCallback(
    (bloc: Bloc) => {
      if (lireSeulement) return;
      enAttente.current.set(bloc._id, bloc);
      setEtatSauvegarde('en_cours');
      const existant = minuteurs.current[bloc._id];
      if (existant) clearTimeout(existant);
      minuteurs.current[bloc._id] = setTimeout(() => {
        void sauvegarderBloc(bloc);
      }, 250);
    },
    [lireSeulement, sauvegarderBloc]
  );

  /**
   * Sauvegarde immédiatement toutes les modifications en attente.
   * Appelée lorsque l'onglet passe en arrière-plan, avant fermeture et au
   * démontage : aucune saisie ne doit être perdue en quittant la page.
   */
  const sauvegarderEnAttente = useCallback(() => {
    Object.values(minuteurs.current).forEach(clearTimeout);
    minuteurs.current = {};
    const restants = Array.from(enAttente.current.values());
    enAttente.current.clear();
    restants.forEach((bloc) => {
      void apiBlocs
        .maj(bloc._id, {
          contenu: bloc.contenu,
          proprietes: bloc.proprietes,
          type: bloc.type,
          ordre: bloc.ordre,
        })
        .catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') sauvegarderEnAttente();
    };
    const surAvantQuitter = () => sauvegarderEnAttente();
    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('beforeunload', surAvantQuitter);
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('beforeunload', surAvantQuitter);
      sauvegarderEnAttente();
    };
  }, [sauvegarderEnAttente]);

  /* Présence : rejoint la room de la page et suit les participants en ligne. */
  useEffect(() => {
    if (!socket || !pageId) return;
    socket.emit('page:rejoindre', { pageId });
    const surPresence = (donnees: { pageId?: string; participants?: PartenaireTempsReel[] }) => {
      if (String(donnees?.pageId || '') !== String(pageId)) return;
      setParticipants(Array.isArray(donnees?.participants) ? donnees.participants : []);
    };
    socket.on('page:presence', surPresence);
    return () => {
      socket.off('page:presence', surPresence);
      socket.emit('page:quitter', { pageId });
      setParticipants([]);
    };
  }, [socket, pageId]);

  /* Synchronisation : applique les changements des autres éditeurs de la page. */
  useEffect(() => {
    if (!socket) return;

    const fusionner = (precedents: Bloc[], recu: Bloc): Bloc[] => {
      const suivant = precedents.map((b) => (b._id === recu._id ? { ...b, ...recu } : b));
      blocsRef.current = suivant;
      return suivant;
    };

    const surMaj = (donnees: { bloc?: Bloc }) => {
      const recu = donnees?.bloc;
      if (!recu?._id) return;
      // Une saisie locale encore en attente d'enregistrement prime : elle
      // écraserait la version distante de toute façon.
      if (enAttente.current.has(recu._id)) return;
      setBlocs((precedents) =>
        precedents.some((b) => b._id === recu._id) ? fusionner(precedents, recu) : precedents
      );
    };

    const surCree = (donnees: { bloc?: Bloc }) => {
      const recu = donnees?.bloc;
      if (!recu?._id) return;
      setBlocs((precedents) => {
        if (precedents.some((b) => b._id === recu._id)) return precedents;
        const suivant = [...precedents, recu].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
        blocsRef.current = suivant;
        return suivant;
      });
    };

    const surSupprime = (donnees: { id?: string }) => {
      const id = donnees?.id;
      if (!id) return;
      setBlocs((precedents) => {
        if (!precedents.some((b) => b._id === id)) return precedents;
        const suivant = precedents.filter((b) => b._id !== id);
        blocsRef.current = suivant;
        return suivant;
      });
    };

    socket.on('bloc:maj', surMaj);
    socket.on('bloc:cree', surCree);
    socket.on('bloc:supprime', surSupprime);
    return () => {
      socket.off('bloc:maj', surMaj);
      socket.off('bloc:cree', surCree);
      socket.off('bloc:supprime', surSupprime);
    };
  }, [socket]);

  /**
   * Persiste les nouveaux `ordre` des blocs dont la position a changé.
   * Les blocs tout juste créés (absents de `precedents`) sont ignorés :
   * ils ont déjà été enregistrés avec le bon `ordre`.
   */
  const persisterOrdres = useCallback(
    (precedents: Bloc[], suivants: Bloc[]) => {
      if (lireSeulement) return;
      suivants.forEach((bloc, index) => {
        const avant = precedents.find((b) => b._id === bloc._id);
        if (avant && (avant.ordre ?? -1) !== index) {
          void apiBlocs.maj(bloc._id, { ordre: index }).catch((e) =>
            toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined)
          );
          socketRef.current?.emit('bloc:diffuser', { pageId, bloc: { ...bloc, ordre: index } });
        }
      });
    },
    [lireSeulement, pageId, toasts]
  );

  /** Met à jour un bloc en local et programme son enregistrement. */
  const majLocal = useCallback(
    (id: string, patch: Partial<Bloc>) => {
      const courant = blocs.find((b) => b._id === id);
      if (!courant) return;
      const suivant = blocs.map((b) => (b._id === id ? { ...b, ...patch } : b));
      const misAJour = suivant.find((b) => b._id === id);
      if (misAJour) enregistrer(misAJour);
      pousserHistorique(suivant);
      setBlocs(suivant);
    },
    [blocs, enregistrer, pousserHistorique]
  );

  /** Insère un nouveau bloc après celui indiqué (ou à la fin). */
  const ajouterApres = useCallback(
    async (apresId: string | null, type: TypeBloc = 'paragraphe') => {
      if (lireSeulement) {
        toasts.erreur('Connexion requise');
        return;
      }
      const index = apresId ? blocs.findIndex((b) => b._id === apresId) : blocs.length - 1;
      const position = index === -1 ? blocs.length : index + 1;
      // Le nouveau bloc reprend l'indentation du bloc précédent : la saisie
      // d'un contenu imbriqué s'enchaîne sans re-indenter à chaque ligne.
      const source = apresId ? blocs.find((b) => b._id === apresId) : undefined;
      const indentation = source ? indentationDe(source) : 0;
      try {
        const cree = await apiBlocs.creer({
          pageId,
          type,
          contenu: '',
          ordre: position,
          proprietes: indentation > 0 ? { indentation } : {},
        } as Partial<Bloc>);
        const suivant = blocs.slice();
        suivant.splice(position, 0, cree);
        const reordonne = suivant.map((b, i) => ({ ...b, ordre: i }));
        blocsRef.current = reordonne;
        setBlocs(reordonne);
        pousserHistorique(reordonne, true);
        persisterOrdres(blocs, reordonne);
        socketRef.current?.emit('bloc:cree', { pageId, bloc: cree });
        setTimeout(() => focusBloc(cree._id), 30);
      } catch (e) {
        toasts.erreur('Ajout impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [blocs, pageId, lireSeulement, persisterOrdres, pousserHistorique, toasts]
  );

  const supprimer = useCallback(
    async (id: string) => {
      if (lireSeulement) return;
      // Annule la sauvegarde différée éventuellement en attente : une requête
      // envoyée après la suppression viserait un bloc inexistant (erreur 500).
      const minuteur = minuteurs.current[id];
      if (minuteur) clearTimeout(minuteur);
      delete minuteurs.current[id];
      enAttente.current.delete(id);
      try {
        await apiBlocs.supprimer(id);
        const suivant = blocs.filter((b) => b._id !== id);
        blocsRef.current = suivant;
        setBlocs(suivant);
        // L'état d'après suppression est empilé : Ctrl+Z recrée le bloc.
        pousserHistorique(suivant, true);
        socketRef.current?.emit('bloc:supprime', { pageId, id });
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [blocs, lireSeulement, pageId, pousserHistorique, toasts]
  );

  const deplacer = useCallback(
    (id: string, direction: 'haut' | 'bas') => {
      if (lireSeulement) return;
      const index = blocs.findIndex((b) => b._id === id);
      const cible = direction === 'haut' ? index - 1 : index + 1;
      if (index === -1 || cible < 0 || cible >= blocs.length) return;
      const suivant = blocs.slice();
      [suivant[index], suivant[cible]] = [suivant[cible], suivant[index]];
      const reordonne = suivant.map((b, i) => ({ ...b, ordre: i }));
      blocsRef.current = reordonne;
      setBlocs(reordonne);
      pousserHistorique(reordonne, true);
      persisterOrdres(blocs, reordonne);
    },
    [blocs, lireSeulement, persisterOrdres, pousserHistorique]
  );

  /** Réordonne la liste après un dépôt : le bloc saisi prend la place visée. */
  const reordonner = useCallback(
    (sourceId: string, cibleId: string, position: 'avant' | 'apres') => {
      if (lireSeulement || sourceId === cibleId) return;
      const source = blocs.findIndex((b) => b._id === sourceId);
      if (source === -1) return;
      const suivant = blocs.slice();
      const [deplace] = suivant.splice(source, 1);
      let destination = suivant.findIndex((b) => b._id === cibleId);
      if (destination === -1) return;
      if (position === 'apres') destination += 1;
      suivant.splice(destination, 0, deplace);
      // Aucun changement réel : on évite une écriture inutile.
      if (suivant.every((b, i) => b._id === blocs[i]._id)) return;
      const reordonne = suivant.map((b, i) => ({ ...b, ordre: i }));
      blocsRef.current = reordonne;
      setBlocs(reordonne);
      pousserHistorique(reordonne, true);
      persisterOrdres(blocs, reordonne);
    },
    [blocs, lireSeulement, persisterOrdres, pousserHistorique]
  );

  /** Début du glissement d'un bloc. */
  const glisserDebut = useCallback(
    (id: string) => {
      if (lireSeulement) return;
      setBlocGlisse(id);
      setInsertion(null);
    },
    [lireSeulement]
  );

  /** Survol pendant le glissement : met à jour le repère d'insertion. */
  const glisserSur = useCallback(
    (id: string, position: 'avant' | 'apres') => {
      if (!blocGlisse || blocGlisse === id) {
        setInsertion(null);
        return;
      }
      setInsertion((precedent) =>
        precedent && precedent.id === id && precedent.position === position
          ? precedent
          : { id, position }
      );
    },
    [blocGlisse]
  );

  /** Fin du glissement : réordonne si un emplacement a été visé. */
  const glisserFin = useCallback(() => {
    setBlocGlisse(null);
    setInsertion(null);
  }, []);

  const deposer = useCallback(() => {
    if (blocGlisse && insertion) reordonner(blocGlisse, insertion.id, insertion.position);
    glisserFin();
  }, [blocGlisse, insertion, reordonner, glisserFin]);

  const dupliquer = useCallback(
    async (bloc: Bloc) => {
      if (lireSeulement) return;
      const index = blocs.findIndex((b) => b._id === bloc._id);
      const position = index === -1 ? blocs.length : index + 1;
      try {
        const cree = await apiBlocs.creer({
          pageId,
          type: bloc.type,
          contenu: bloc.contenu,
          proprietes: bloc.proprietes,
          ordre: position,
        } as Partial<Bloc>);
        const suivant = blocs.slice();
        suivant.splice(position, 0, cree);
        const reordonne = suivant.map((b, i) => ({ ...b, ordre: i }));
        blocsRef.current = reordonne;
        setBlocs(reordonne);
        pousserHistorique(reordonne, true);
        persisterOrdres(blocs, reordonne);
        socketRef.current?.emit('bloc:cree', { pageId, bloc: cree });
      } catch (e) {
        toasts.erreur('Duplication impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [blocs, pageId, lireSeulement, persisterOrdres, pousserHistorique, toasts]
  );

  /**
   * Blocs réellement affichés : ceux indentés sous une bascule fermée sont
   * masqués, ce qui donne le repli hiérarchique à la Notion.
   */
  const blocsVisibles = useMemo(() => {
    const masques = new Set<string>();
    let seuil: number | null = null;
    for (const bloc of blocs) {
      const niveau = indentationDe(bloc);
      if (seuil !== null) {
        if (niveau > seuil) {
          masques.add(bloc._id);
          continue;
        }
        seuil = null;
      }
      if (bloc.type === 'bascule' && !bloc.proprietes?.ouvert) seuil = niveau;
    }
    return blocs.filter((bloc) => !masques.has(bloc._id));
  }, [blocs]);

  /* Titres de la page (pour le bloc « Sommaire »). */
  const titres = useMemo<TitreSommaire[]>(
    () =>
      blocs
        .filter((b) => /^titre_[1-6]$/.test(b.type) && (b.contenu || '').trim().length > 0)
        .map((b) => ({
          id: b._id,
          niveau: Number(b.type.slice(-1)),
          texte: (b.contenu || '').trim(),
        })),
    [blocs]
  );

  /* Texte agrégé de la page (pour les blocs IA). */
  const textePage = useMemo(
    () =>
      blocs
        .map((b) => (b.contenu || '').trim())
        .filter(Boolean)
        .join('\n'),
    [blocs]
  );

  if (chargement) return <Chargement libelle="Chargement du contenu…" />;

  return (
    <div className="flex flex-col gap-1 py-2">
      {/* Présence : qui d'autre consulte ou modifie cette page en direct. */}
      {participants.length > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs texte-faible">En ligne</span>
          <div className="flex -space-x-1.5">
            {participants.slice(0, 5).map((partenaire) => (
              <span
                key={partenaire.socketId}
                title={partenaire.nom}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold uppercase text-white"
                style={{ backgroundColor: partenaire.couleur, borderColor: 'var(--fond)' }}
              >
                {partenaire.nom.charAt(0)}
              </span>
            ))}
            {participants.length > 5 && (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold texte-doux"
                style={{ borderColor: 'var(--fond)', backgroundColor: 'var(--fond-secondaire)' }}
              >
                +{participants.length - 5}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Annulation : rattrape une faute de frappe ou une suppression par erreur. */}
      {!lireSeulement && (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={annuler}
            disabled={!peutAnnuler}
            title="Annuler la dernière modification (Ctrl+Z)"
            className="flex h-7 items-center gap-1.5 rounded px-2 text-xs texte-doux hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Annuler
          </button>
          <button
            type="button"
            onClick={retablir}
            disabled={!peutRetablir}
            title="Rétablir la modification annulée (Ctrl+Maj+Z)"
            className="flex h-7 items-center gap-1.5 rounded px-2 text-xs texte-doux hover:bg-black/5 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/10"
          >
            <Redo2 className="h-3.5 w-3.5" />
            Rétablir
          </button>
        </div>
      )}

      {!lireSeulement && blocs.length === 0 && (
        <button
          type="button"
          onClick={() => ajouterApres(null)}
          className="flex items-center gap-2 rounded-md px-2 py-3 text-left text-sm texte-faible hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          <Plus className="h-4 w-4" />
          Cliquez ici pour écrire, ou tapez « / » pour insérer un bloc.
        </button>
      )}

      {blocsVisibles.map((bloc, index) => (
        <BlocEditeur
          key={bloc._id}
          bloc={bloc}
          titres={titres}
          textePage={textePage}
          onContenu={(valeur) => majLocal(bloc._id, { contenu: valeur })}
          onPropriete={(cle, valeur) =>
            majLocal(bloc._id, { proprietes: { ...bloc.proprietes, [cle]: valeur } })
          }
          onType={(type) => majLocal(bloc._id, { type })}
          onSupprimer={() => supprimer(bloc._id)}
          onAjouterApres={(type) => ajouterApres(bloc._id, type)}
          onDeplacer={(direction) => deplacer(bloc._id, direction)}
          onDupliquer={() => dupliquer(bloc)}
          onFocusPrecedent={() => {
            const precedent = blocsVisibles[index - 1];
            if (precedent) setTimeout(() => focusBloc(precedent._id), 20);
          }}
          onCreerBase={onCreerBase}
          onRechargerBlocs={recharger}
          enGlissement={blocGlisse === bloc._id}
          positionInsertion={insertion?.id === bloc._id ? insertion.position : null}
          onGlisserDebut={() => glisserDebut(bloc._id)}
          onGlisserSur={(position) => glisserSur(bloc._id, position)}
          onGlisserFin={glisserFin}
          onDeposer={deposer}
        />
      ))}

      {!lireSeulement && blocs.length > 0 && (
        <button
          type="button"
          onClick={() => ajouterApres(blocs[blocs.length - 1]._id)}
          className="mt-1 flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm texte-faible hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          <Plus className="h-4 w-4" />
          Ajouter un bloc
        </button>
      )}

      {!lireSeulement && etatSauvegarde !== 'inactif' && (
        <p
          className={cn(
            'px-2 pt-2 text-xs',
            etatSauvegarde === 'erreur' ? 'text-red-600 dark:text-red-400' : 'texte-faible'
          )}
          aria-live="polite"
        >
          {etatSauvegarde === 'en_cours'
            ? 'Enregistrement…'
            : etatSauvegarde === 'erreur'
              ? 'Échec de l’enregistrement'
              : 'Enregistré'}
        </p>
      )}
    </div>
  );
}
