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

interface ValeurInterface {
  /** Palette de commandes (⌘K / Ctrl+K). */
  paletteOuverte: boolean;
  ouvrirPalette: () => void;
  fermerPalette: () => void;

  /** Barre latérale en mode tiroir (mobile / tablette). */
  barreMobileOuverte: boolean;
  ouvrirBarreMobile: () => void;
  fermerBarreMobile: () => void;

  /** Barre latérale repliée en rail d'icônes (bureau). */
  barreRepliee: boolean;
  basculerBarreRepliee: () => void;

  /** Largeur redimensionnable de la barre latérale (bureau), en pixels. */
  largeurBarre: number;
  definirLargeurBarre: (largeur: number) => void;
}

const InterfaceContext = createContext<ValeurInterface | null>(null);

const CLE_LARGEUR = 'nova.largeurBarre';
const CLE_REPLIEE = 'nova.barreRepliee';
export const LARGEUR_BARRE_MIN = 200;
export const LARGEUR_BARRE_MAX = 420;

/** Expose les états d'interface globaux (barre latérale, palette de commandes). */
export function FournisseurInterface({ children }: { children: ReactNode }) {
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [barreMobileOuverte, setBarreMobileOuverte] = useState(false);
  const [barreRepliee, setBarreRepliee] = useState(false);
  const [largeurBarre, setLargeurBarre] = useState(240);

  useEffect(() => {
    const largeur = Number(window.localStorage.getItem(CLE_LARGEUR));
    if (largeur >= LARGEUR_BARRE_MIN && largeur <= LARGEUR_BARRE_MAX) setLargeurBarre(largeur);
    setBarreRepliee(window.localStorage.getItem(CLE_REPLIEE) === '1');
  }, []);

  // Raccourci global ⌘K / Ctrl+K pour la palette de commandes.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte((o) => !o);
      }
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, []);

  const ouvrirPalette = useCallback(() => setPaletteOuverte(true), []);
  const fermerPalette = useCallback(() => setPaletteOuverte(false), []);
  const ouvrirBarreMobile = useCallback(() => setBarreMobileOuverte(true), []);
  const fermerBarreMobile = useCallback(() => setBarreMobileOuverte(false), []);

  const basculerBarreRepliee = useCallback(() => {
    setBarreRepliee((prec) => {
      const suivant = !prec;
      window.localStorage.setItem(CLE_REPLIEE, suivant ? '1' : '0');
      return suivant;
    });
  }, []);

  const definirLargeurBarre = useCallback((largeur: number) => {
    const bornee = Math.min(LARGEUR_BARRE_MAX, Math.max(LARGEUR_BARRE_MIN, largeur));
    setLargeurBarre(bornee);
    window.localStorage.setItem(CLE_LARGEUR, String(bornee));
  }, []);

  const valeur = useMemo<ValeurInterface>(
    () => ({
      paletteOuverte,
      ouvrirPalette,
      fermerPalette,
      barreMobileOuverte,
      ouvrirBarreMobile,
      fermerBarreMobile,
      barreRepliee,
      basculerBarreRepliee,
      largeurBarre,
      definirLargeurBarre,
    }),
    [
      paletteOuverte,
      ouvrirPalette,
      fermerPalette,
      barreMobileOuverte,
      ouvrirBarreMobile,
      fermerBarreMobile,
      barreRepliee,
      basculerBarreRepliee,
      largeurBarre,
      definirLargeurBarre,
    ]
  );

  return <InterfaceContext.Provider value={valeur}>{children}</InterfaceContext.Provider>;
}

/** Accède aux états d'interface globaux. */
export function useInterface(): ValeurInterface {
  const contexte = useContext(InterfaceContext);
  if (!contexte) throw new Error('useInterface doit être utilisé dans un FournisseurInterface');
  return contexte;
}
