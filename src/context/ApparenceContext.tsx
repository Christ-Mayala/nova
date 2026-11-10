'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Apparence, Police } from '@/lib/types';

interface ValeurApparence {
  apparence: Apparence;
  police: Police;
  /** Thème effectivement appliqué (résout « systeme »). */
  theme: 'clair' | 'sombre';
  definirApparence: (apparence: Apparence) => void;
  definirPolice: (police: Police) => void;
}

const ApparenceContext = createContext<ValeurApparence | null>(null);

const CLE_APPARENCE = 'nova.apparence';
const CLE_POLICE = 'nova.police';

function lireApparence(): Apparence {
  if (typeof window === 'undefined') return 'clair';
  const v = window.localStorage.getItem(CLE_APPARENCE);
  return v === 'sombre' || v === 'systeme' || v === 'clair' ? v : 'clair';
}

function lirePolice(): Police {
  if (typeof window === 'undefined') return 'defaut';
  const v = window.localStorage.getItem(CLE_POLICE);
  return v === 'serif' || v === 'mono' || v === 'defaut' ? v : 'defaut';
}

/** Applique le thème (clair/sombre/système) et la police à toute l'application. */
export function FournisseurApparence({ children }: { children: ReactNode }) {
  const [apparence, setApparence] = useState<Apparence>('clair');
  const [police, setPolice] = useState<Police>('defaut');
  const [prefereSombre, setPrefereSombre] = useState(false);

  // Hydratation depuis le stockage local + suivi de la préférence système.
  useEffect(() => {
    setApparence(lireApparence());
    setPolice(lirePolice());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefereSombre(media.matches);
    const surChangement = (e: MediaQueryListEvent) => setPrefereSombre(e.matches);
    media.addEventListener('change', surChangement);
    return () => media.removeEventListener('change', surChangement);
  }, []);

  const theme: 'clair' | 'sombre' =
    apparence === 'systeme' ? (prefereSombre ? 'sombre' : 'clair') : apparence;

  useEffect(() => {
    const racine = document.documentElement;
    racine.classList.toggle('dark', theme === 'sombre');
    racine.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.police = police;
  }, [police]);

  const definirApparence = useCallback((valeur: Apparence) => {
    setApparence(valeur);
    window.localStorage.setItem(CLE_APPARENCE, valeur);
  }, []);

  const definirPolice = useCallback((valeur: Police) => {
    setPolice(valeur);
    window.localStorage.setItem(CLE_POLICE, valeur);
  }, []);

  const valeur = useMemo<ValeurApparence>(
    () => ({ apparence, police, theme, definirApparence, definirPolice }),
    [apparence, police, theme, definirApparence, definirPolice]
  );

  return <ApparenceContext.Provider value={valeur}>{children}</ApparenceContext.Provider>;
}

/** Accède au contexte d'apparence (doit être sous `FournisseurApparence`). */
export function useApparence(): ValeurApparence {
  const contexte = useContext(ApparenceContext);
  if (!contexte) throw new Error('useApparence doit être utilisé dans un FournisseurApparence');
  return contexte;
}
