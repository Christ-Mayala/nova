'use client';

import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { cn, identifiantLocal } from '@/lib/utils';

type TypeToast = 'succes' | 'erreur' | 'info';

interface Toast {
  id: string;
  type: TypeToast;
  titre: string;
  message?: string;
}

interface ValeurToasts {
  afficher: (type: TypeToast, titre: string, message?: string) => void;
  succes: (titre: string, message?: string) => void;
  erreur: (titre: string, message?: string) => void;
  info: (titre: string, message?: string) => void;
}

const ToastsContext = createContext<ValeurToasts | null>(null);

/** Affiche des notifications éphémères (succès / erreur / information). */
export function FournisseurToasts({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const retirer = useCallback((id: string) => {
    setToasts((prec) => prec.filter((t) => t.id !== id));
  }, []);

  const afficher = useCallback(
    (type: TypeToast, titre: string, message?: string) => {
      const id = identifiantLocal();
      setToasts((prec) => [...prec, { id, type, titre, message }]);
      setTimeout(() => retirer(id), 5200);
    },
    [retirer]
  );

  const valeur = useMemo<ValeurToasts>(
    () => ({
      afficher,
      succes: (t, m) => afficher('succes', t, m),
      erreur: (t, m) => afficher('erreur', t, m),
      info: (t, m) => afficher('info', t, m),
    }),
    [afficher]
  );

  return (
    <ToastsContext.Provider value={valeur}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex animate-apparition items-start gap-2.5 rounded-lg px-3 py-2.5 shadow-lg"
            style={{ backgroundColor: 'var(--fond)', border: '1px solid var(--bordure)' }}
          >
            <span className="mt-0.5 shrink-0">
              {toast.type === 'succes' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {toast.type === 'erreur' && <TriangleAlert className="h-4 w-4 text-red-500" />}
              {toast.type === 'info' && <Info className="h-4 w-4 text-sky-500" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-medium', toast.type === 'erreur' && 'text-red-600 dark:text-red-400')}>
                {toast.titre}
              </p>
              {toast.message && <p className="mt-0.5 break-words text-xs texte-doux">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => retirer(toast.id)}
              className="shrink-0 rounded p-0.5 texte-faible fond-survol"
              aria-label="Fermer la notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastsContext.Provider>
  );
}

/** Accède au système de notifications éphémères. */
export function useToasts(): ValeurToasts {
  const contexte = useContext(ToastsContext);
  if (!contexte) throw new Error('useToasts doit être utilisé dans un FournisseurToasts');
  return contexte;
}
