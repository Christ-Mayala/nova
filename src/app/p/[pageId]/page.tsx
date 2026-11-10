'use client';

import { Globe, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { EditeurBlocs } from '@/components/editeur/EditeurBlocs';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { BandeauErreur, Chargement } from '@/components/ui/Etats';
import { executerData } from '@/lib/api';
import type { Page, Publication } from '@/lib/types';

/**
 * Vue publique d'une page publiée sur le Web : accessible à toute personne
 * disposant du lien, sans authentification ni barre latérale. Le contenu est
 * affiché en lecture seule (aucun droit d'édition sans session).
 */
export default function PagePubliee({ params }: { params: { pageId: string } }) {
  const [page, setPage] = useState<Page | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    executerData<{ page: Page; publication: Publication }>(`/pages/${params.pageId}/public`)
      .then((donnees) => {
        if (!annule) setPage(donnees.page);
      })
      .catch((e) => {
        if (!annule) setErreur(e instanceof Error ? e.message : 'Page inaccessible.');
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [params.pageId]);

  if (chargement) {
    return (
      <div className="mx-auto w-full max-w-contenu px-8 py-16">
        <Chargement libelle="Chargement de la page publiée…" />
      </div>
    );
  }

  if (erreur || !page) {
    return (
      <div className="mx-auto flex w-full max-w-contenu flex-col gap-4 px-8 py-16">
        <BandeauErreur message={erreur || 'Cette page n’est pas accessible.'} />
        <p className="flex items-center gap-2 text-sm texte-doux">
          <Lock className="h-4 w-4 shrink-0" />
          Cette page n’est pas publiée sur le Web, ou le lien n’est plus valide.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--fond)' }}>
      <div className="mx-auto w-full max-w-contenu px-10 py-12">
        <div className="mb-6 flex items-center gap-2 text-xs texte-faible">
          <Globe className="h-3.5 w-3.5" />
          <span>Page publiée sur le Web</span>
        </div>

        <div className="flex flex-col">
          <IconeDonnee icone={page.icone} className="h-12 w-12" />
          <h1 className="mt-2 text-4xl font-bold leading-tight">{page.titre || 'Sans titre'}</h1>
        </div>

        <div className="mt-6">
          <EditeurBlocs pageId={page._id} lectureSeule />
        </div>
      </div>
    </div>
  );
}
