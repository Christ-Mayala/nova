'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { Modale } from './Modale';

export interface OptionsConfirmation {
  titre: string;
  message?: string;
  libelleConfirmer?: string;
  libelleAnnuler?: string;
  danger?: boolean;
}

type Confirmer = (options: OptionsConfirmation) => Promise<boolean>;

const ConfirmationContext = createContext<Confirmer | null>(null);

/**
 * Fournit des boîtes de confirmation claires pour les actions sensibles
 * (suppressions notamment) : `const ok = await confirmer({ ... })`.
 */
export function FournisseurConfirmation({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<{ options: OptionsConfirmation; resoudre: (v: boolean) => void } | null>(
    null
  );

  const confirmer = useCallback<Confirmer>((options) => {
    return new Promise<boolean>((resoudre) => setEtat({ options, resoudre }));
  }, []);

  const terminer = useCallback(
    (valeur: boolean) => {
      setEtat((courant) => {
        courant?.resoudre(valeur);
        return null;
      });
    },
    []
  );

  const valeur = useMemo(() => confirmer, [confirmer]);

  return (
    <ConfirmationContext.Provider value={valeur}>
      {children}
      <Modale
        ouvert={Boolean(etat)}
        onFermer={() => terminer(false)}
        titre={etat?.options.titre}
        description={etat?.options.message}
        largeur="max-w-md"
        pied={
          <>
            <button type="button" className="bouton" onClick={() => terminer(false)}>
              {etat?.options.libelleAnnuler || 'Annuler'}
            </button>
            <button
              type="button"
              className={
                etat?.options.danger
                  ? 'bouton bg-red-600 text-white hover:bg-red-700'
                  : 'bouton bouton-primaire'
              }
              onClick={() => terminer(true)}
            >
              {etat?.options.libelleConfirmer || 'Confirmer'}
            </button>
          </>
        }
      >
        <p className="text-sm texte-doux">
          Cette action est immédiate. Vérifiez votre choix avant de continuer.
        </p>
      </Modale>
    </ConfirmationContext.Provider>
  );
}

/** Accède à la fonction de confirmation (doit être sous `FournisseurConfirmation`). */
export function useConfirmation(): Confirmer {
  const contexte = useContext(ConfirmationContext);
  if (!contexte) throw new Error('useConfirmation doit être utilisé dans un FournisseurConfirmation');
  return contexte;
}
