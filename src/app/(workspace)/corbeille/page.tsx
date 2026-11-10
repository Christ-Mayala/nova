'use client';

import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { useConfirmation } from '@/components/ui/Confirmation';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { pages as apiPages } from '@/lib/api';
import type { Page } from '@/lib/types';
import { formaterDateHeure, identifiantDe } from '@/lib/utils';

/** Corbeille : pages supprimées (restauration ou suppression définitive). */
export default function PageCorbeille() {
  const { rafraichir, espaceParId } = useDonnees();
  const { peutEditer } = useAuth();
  const toasts = useToasts();
  const confirmer = useConfirmation();

  const [pagesSupprimees, setPagesSupprimees] = useState<Page[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const reponse = await apiPages.lister({ includeDeleted: true, limit: 100, sort: '-deletedAt' });
      setPagesSupprimees((reponse.data || []).filter((p) => p.status === 'deleted'));
    } catch {
      setPagesSupprimees([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function restaurer(page: Page) {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    setEnCours(page._id);
    try {
      await apiPages.restaurer(page._id);
      await charger();
      await rafraichir();
      toasts.succes('Page restaurée', page.titre);
    } catch (e) {
      toasts.erreur('Restauration impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(null);
    }
  }

  async function supprimerDefinitivement(page: Page) {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    const ok = await confirmer({
      titre: `Supprimer définitivement « ${page.titre} » ?`,
      message: 'Cette action est irréversible. La page et son contenu seront perdus.',
      libelleConfirmer: 'Supprimer définitivement',
      danger: true,
    });
    if (!ok) return;
    setEnCours(page._id);
    try {
      await apiPages.supprimer(page._id, { includeDeleted: true });
      setPagesSupprimees((prec) => prec.filter((p) => p._id !== page._id));
      toasts.succes('Page supprimée définitivement');
    } catch (e) {
      toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <Chargement libelle="Chargement de la corbeille…" />;

  return (
    <div className="mx-auto w-full max-w-contenu px-8 py-8">
      <div className="mb-5 flex items-center gap-2">
        <Trash2 className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Corbeille</h1>
        <span className="texte-faible text-sm">({pagesSupprimees.length})</span>
      </div>

      {pagesSupprimees.length === 0 ? (
        <EtatVide
          icone={Trash2}
          titre="La corbeille est vide"
          description="Les pages supprimées apparaissent ici pendant que vous pouvez encore les restaurer."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {pagesSupprimees.map((page) => {
            const espace = espaceParId(identifiantDe(page.espaceId));
            return (
              <li
                key={page._id}
                className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <IconeDonnee icone={page.icone} className="h-4 w-4 shrink-0 texte-doux" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{page.titre}</p>
                  <p className="mt-0.5 text-xs texte-doux">
                    {espace ? `${espace.nom} · ` : ''}
                    Supprimée le {formaterDateHeure(page.deletedAt || page.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restaurer(page)}
                  disabled={enCours === page._id}
                  className="bouton gap-1.5 text-xs"
                >
                  {enCours === page._id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Restaurer
                </button>
                <button
                  type="button"
                  onClick={() => supprimerDefinitivement(page)}
                  disabled={enCours === page._id}
                  className="bouton gap-1.5 text-xs text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
