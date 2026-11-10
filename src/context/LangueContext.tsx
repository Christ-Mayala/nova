'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useDonnees } from '@/context/DonneesContext';
import { LANGUE_DEFAUT, estLangue, traduire, type Langue } from '@/lib/i18n';

interface ValeurLangue {
  /** Langue d'affichage courante. */
  langue: Langue;
  /** Change la langue et la mémorise localement. */
  definirLangue: (langue: Langue) => void;
  /** Traduit une clé (avec interpolation optionnelle de jetons `{nom}`). */
  t: (cle: string, valeurs?: Record<string, string | number>) => string;
}

const LangueContext = createContext<ValeurLangue | null>(null);

const CLE_LANGUE = 'nova.langue';

/** Expose la langue d'affichage et la fonction de traduction. */
export function FournisseurLangue({ children }: { children: ReactNode }) {
  const { parametre } = useDonnees();
  const [langue, setLangue] = useState<Langue>(LANGUE_DEFAUT);
  // Dernière valeur appliquée depuis le réglage serveur : évite qu'un réglage
  // d'espace encore en mémoire (non rafraîchi) n'écrase un choix local.
  const valeurServeurAppliquee = useRef<Langue | null>(null);

  // Hydratation depuis le stockage local (jamais pendant le rendu).
  useEffect(() => {
    const stockee = window.localStorage.getItem(CLE_LANGUE);
    if (estLangue(stockee)) setLangue(stockee);
  }, []);

  // Le réglage serveur fait foi à son chargement (et à chaque changement réel).
  useEffect(() => {
    const reglee = parametre?.langue;
    if (!estLangue(reglee) || valeurServeurAppliquee.current === reglee) return;
    valeurServeurAppliquee.current = reglee;
    setLangue(reglee);
  }, [parametre?.langue]);

  // Synchronise l'attribut lang du document.
  useEffect(() => {
    document.documentElement.lang = langue;
  }, [langue]);

  const definirLangue = useCallback((valeur: Langue) => {
    setLangue(valeur);
    window.localStorage.setItem(CLE_LANGUE, valeur);
  }, []);

  const t = useCallback(
    (cle: string, valeurs?: Record<string, string | number>) => traduire(langue, cle, valeurs),
    [langue]
  );

  const valeur = useMemo<ValeurLangue>(
    () => ({ langue, definirLangue, t }),
    [langue, definirLangue, t]
  );

  return <LangueContext.Provider value={valeur}>{children}</LangueContext.Provider>;
}

/** Accède à la langue courante (doit être sous `FournisseurLangue`). */
export function useLangue(): ValeurLangue {
  const contexte = useContext(LangueContext);
  if (!contexte) throw new Error('useLangue doit être utilisé dans un FournisseurLangue');
  return contexte;
}
