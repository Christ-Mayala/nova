'use client';

import { Building2, Lock, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { Modale } from '@/components/ui/Modale';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { pages as apiPages } from '@/lib/api';
import { lienPage } from '@/lib/navigation';
import type { SectionPage } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Destination choisie pour la nouvelle page. */
interface Destination {
  id: string;
  libelle: string;
  description: string;
  icone: LucideIcon;
  section: SectionPage;
  espaceId?: string;
}

/**
 * Boîte de dialogue de création de page : l'utilisateur choisit la destination
 * (privé ou espace d'équipe, éventuellement sous une page parente) avant que la
 * page ne soit enregistrée, puis il est redirigé vers la page créée.
 */
export function ModaleNouvellePage({
  ouvert,
  onFermer,
  titreInitial = '',
}: {
  ouvert: boolean;
  onFermer: () => void;
  titreInitial?: string;
}) {
  const { espaces, workspaceActif, rafraichir, enfantsDe } = useDonnees();
  const { peutEditer } = useAuth();
  const toasts = useToasts();
  const router = useRouter();

  const [titre, setTitre] = useState(titreInitial);
  const [destinationId, setDestinationId] = useState('prive');
  const [parentId, setParentId] = useState('');
  const [enCours, setEnCours] = useState(false);

  // Chaque ouverture repart d'une arborescence vierge : titre pré-rempli (palette)
  // mais destination « Privé » et aucune page parente.
  useEffect(() => {
    if (!ouvert) return;
    setTitre(titreInitial);
    setDestinationId('prive');
    setParentId('');
    setEnCours(false);
  }, [ouvert, titreInitial]);

  const destinations = useMemo<Destination[]>(
    () => [
      {
        id: 'prive',
        libelle: 'Privé',
        description: 'Visible uniquement par vous',
        icone: Lock,
        section: 'prive',
      },
      ...espaces.map((espace) => ({
        id: espace._id,
        libelle: espace.nom,
        description: "Espace d'équipe",
        icone: Building2,
        section: 'equipe' as SectionPage,
        espaceId: espace._id,
      })),
    ],
    [espaces]
  );

  const destination = destinations.find((d) => d.id === destinationId) ?? destinations[0];

  // Pages parentes possibles : uniquement dans l'espace d'équipe sélectionné,
  // aplaties avec un retrait par niveau pour refléter la hiérarchie.
  const parents = useMemo(() => {
    const espaceId = destination?.espaceId;
    if (!espaceId) return [];
    const liste: { id: string; libelle: string }[] = [];
    const parcourir = (pid: string | null, profondeur: number) => {
      for (const page of enfantsDe(pid, { espaceId, section: 'equipe' })) {
        liste.push({ id: page._id, libelle: `${'— '.repeat(profondeur)}${page.titre}` });
        parcourir(page._id, profondeur + 1);
      }
    };
    parcourir(null, 0);
    return liste;
  }, [destination, enfantsDe]);

  async function valider() {
    if (!peutEditer) {
      toasts.erreur('Connexion requise', 'Reconnectez-vous pour continuer.');
      return;
    }
    if (enCours) return;
    setEnCours(true);
    try {
      const page = await apiPages.creer({
        titre: titre.trim() || 'Sans titre',
        espaceId: destination?.espaceId,
        workspaceId: workspaceActif?._id,
        parentId: parentId || null,
        section: destination?.section ?? 'prive',
      });
      await rafraichir();
      onFermer();
      router.push(lienPage(page));
    } catch (e) {
      toasts.erreur('Création impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Modale
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Créer une page"
      description="Choisissez où enregistrer la page."
      pied={
        <>
          <button type="button" className="bouton" onClick={onFermer} disabled={enCours}>
            Annuler
          </button>
          <button
            type="button"
            className="bouton bouton-primaire"
            onClick={valider}
            disabled={enCours}
          >
            Créer
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium texte-doux">Titre</span>
          <input
            autoFocus
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void valider();
              }
            }}
            placeholder="Sans titre"
            className="champ"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium texte-doux">Destination</span>
          <div className="flex flex-col gap-1">
            {destinations.map((item) => {
              const Icone = item.icone;
              const actif = item.id === destination?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDestinationId(item.id);
                    setParentId('');
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10',
                    actif && 'bg-sky-500/10'
                  )}
                  style={actif ? { boxShadow: 'inset 0 0 0 1px var(--accent)' } : undefined}
                >
                  <Icone className="h-4 w-4 shrink-0 texte-doux" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.libelle}</span>
                    <span className="block truncate text-xs texte-faible">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {parents.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium texte-doux">Page parente</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="champ"
            >
              <option value="">Racine de l’espace</option>
              {parents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.libelle}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </Modale>
  );
}
