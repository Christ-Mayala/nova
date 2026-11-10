'use client';

import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BlocEditeur, type TitreSommaire } from '@/components/editeur/BlocEditeur';
import { focusBloc } from '@/components/editeur/ChampAuto';
import { Chargement } from '@/components/ui/Etats';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { blocs as apiBlocs, listerTout } from '@/lib/api';
import type { Bloc, TypeBloc } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Copie d'une liste de blocs destinée à l'historique (contenu/propriétés). */
function copieEtat(etat: Bloc[]): Bloc[] {
  return etat.map((b) => ({ ...b, proprietes: { ...b.proprietes } }));
}

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

  /* Historique local : annulation (Ctrl+Z) et rétablissement (Ctrl+Maj+Z). */
  const historique = useRef<{ pile: Bloc[][]; index: number }>({ pile: [], index: -1 });
  const dernierAjout = useRef(0);

  const reinitialiserHistorique = useCallback((etat: Bloc[]) => {
    historique.current = { pile: [copieEtat(etat)], index: 0 };
    dernierAjout.current = 0;
  }, []);

  /** Empile un instantané ; les frappes rapprochées sont fusionnées en une étape. */
  const pousserHistorique = useCallback((etat: Bloc[], structurel = false) => {
    const maintenant = Date.now();
    const h = historique.current;
    const coalescer = !structurel && h.index > 0 && maintenant - dernierAjout.current < 800;
    dernierAjout.current = maintenant;
    if (coalescer) {
      h.pile = [...h.pile.slice(0, h.index), copieEtat(etat)];
      return;
    }
    const tronque = h.pile.slice(0, h.index + 1);
    tronque.push(copieEtat(etat));
    if (tronque.length > 100) tronque.shift();
    historique.current = { pile: tronque, index: tronque.length - 1 };
  }, []);

  /** Restaure un instantané localement puis le persiste côté serveur. */
  const appliquerInstantane = useCallback((etat: Bloc[]) => {
    setBlocs(etat);
    etat.forEach((b) => {
      void apiBlocs
        .maj(b._id, { contenu: b.contenu, proprietes: b.proprietes, type: b.type, ordre: b.ordre })
        .catch(() => undefined);
    });
    setEtatSauvegarde('enregistre');
  }, []);

  const annuler = useCallback(() => {
    const h = historique.current;
    if (h.index <= 0) return;
    h.index -= 1;
    dernierAjout.current = 0;
    appliquerInstantane(h.pile[h.index]);
  }, [appliquerInstantane]);

  const retablir = useCallback(() => {
    const h = historique.current;
    if (h.index >= h.pile.length - 1) return;
    h.index += 1;
    dernierAjout.current = 0;
    appliquerInstantane(h.pile[h.index]);
  }, [appliquerInstantane]);

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
      } catch (e) {
        setEtatSauvegarde('erreur');
        toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [toasts]
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
        }
      });
    },
    [lireSeulement, toasts]
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
      try {
        const cree = await apiBlocs.creer({
          pageId,
          type,
          contenu: '',
          ordre: position,
          proprietes: {},
        } as Partial<Bloc>);
        const suivant = blocs.slice();
        suivant.splice(position, 0, cree);
        const reordonne = suivant.map((b, i) => ({ ...b, ordre: i }));
        setBlocs(reordonne);
        reinitialiserHistorique(reordonne);
        persisterOrdres(blocs, reordonne);
        setTimeout(() => focusBloc(cree._id), 30);
      } catch (e) {
        toasts.erreur('Ajout impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [blocs, pageId, lireSeulement, persisterOrdres, reinitialiserHistorique, toasts]
  );

  const supprimer = useCallback(
    async (id: string) => {
      if (lireSeulement) return;
      try {
        await apiBlocs.supprimer(id);
        const suivant = blocs.filter((b) => b._id !== id);
        setBlocs(suivant);
        reinitialiserHistorique(suivant);
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [blocs, lireSeulement, reinitialiserHistorique, toasts]
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
      setBlocs(reordonne);
      reinitialiserHistorique(reordonne);
      persisterOrdres(blocs, reordonne);
    },
    [blocs, lireSeulement, persisterOrdres, reinitialiserHistorique]
  );

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
        setBlocs(reordonne);
        reinitialiserHistorique(reordonne);
        persisterOrdres(blocs, reordonne);
      } catch (e) {
        toasts.erreur('Duplication impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [blocs, pageId, lireSeulement, persisterOrdres, reinitialiserHistorique, toasts]
  );

  /* Titres de la page (pour le bloc « Sommaire »). */
  const titres = useMemo<TitreSommaire[]>(
    () =>
      blocs
        .filter(
          (b) =>
            (b.type === 'titre_1' || b.type === 'titre_2' || b.type === 'titre_3') &&
            (b.contenu || '').trim().length > 0
        )
        .map((b) => ({
          id: b._id,
          niveau: b.type === 'titre_1' ? 1 : b.type === 'titre_2' ? 2 : 3,
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
      {blocs.length === 0 && (
        <button
          type="button"
          onClick={() => ajouterApres(null)}
          className="flex items-center gap-2 rounded-md px-2 py-3 text-left text-sm texte-faible hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          <Plus className="h-4 w-4" />
          Cliquez ici pour écrire, ou tapez « / » pour insérer un bloc.
        </button>
      )}

      {blocs.map((bloc, index) => (
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
            const precedent = blocs[index - 1];
            if (precedent) setTimeout(() => focusBloc(precedent._id), 20);
          }}
          onCreerBase={onCreerBase}
        />
      ))}

      {blocs.length > 0 && (
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
