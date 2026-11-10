'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';

import { VueBase } from '@/components/base/VueBase';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { bases as apiBases, listerTout } from '@/lib/api';
import type { Base, ProprieteBase, VueBase as VueBaseDef } from '@/lib/types';
import { identifiantDe } from '@/lib/utils';

/** Description d'une base dédiée rattachée à une page de l'application. */
export interface ConfigBaseDediee {
  titre: string;
  icone: string;
  description?: string;
  proprietes: ProprieteBase[];
  vues: VueBaseDef[];
}

/**
 * Cache des créations en cours, partagé au niveau module : deux montages
 * rapprochés (StrictMode, aller-retour de navigation) partagent la même
 * promesse et ne créent donc qu'une seule base.
 */
const creationsEnCours = new Map<string, Promise<Base>>();

/**
 * Affiche une base de données NOVA dédiée à une page (Réunions, Mes tâches…).
 * La base est recherchée par son titre dans l'espace courant, puis créée à la
 * volée avec ses propriétés et ses vues si elle n'existe pas encore.
 */
export function BaseDediee({
  config,
  iconeVide,
}: {
  config: ConfigBaseDediee;
  iconeVide: LucideIcon;
}) {
  const { espaces, chargement: chargementDonnees } = useDonnees();
  const { peutEditer } = useAuth();

  const [base, setBase] = useState<Base | null>(null);
  const [chargement, setChargement] = useState(true);

  const espaceId = espaces[0]?._id;

  useEffect(() => {
    if (chargementDonnees) return;
    let annule = false;
    setChargement(true);
    const cle = `${config.titre}:${espaceId || ''}`;

    (async () => {
      try {
        const trouvees = await listerTout(apiBases, { titre: config.titre });
        const existante =
          trouvees.find((b) => identifiantDe(b.espaceId) === espaceId) || trouvees[0];
        if (existante) {
          if (!annule) setBase(existante);
          return;
        }
        if (!peutEditer) {
          if (!annule) setBase(null);
          return;
        }

        let promesse = creationsEnCours.get(cle);
        if (!promesse) {
          promesse = apiBases.creer({
            titre: config.titre,
            icone: config.icone,
            espaceId: espaceId || undefined,
            enLigne: true,
            proprietes: config.proprietes,
            vues: config.vues,
          } as Partial<Base>);
          creationsEnCours.set(cle, promesse);
        }
        const cree = await promesse;
        creationsEnCours.delete(cle);
        if (!annule) setBase(cree);
      } catch {
        creationsEnCours.delete(cle);
        if (!annule) setBase(null);
      } finally {
        if (!annule) setChargement(false);
      }
    })();

    return () => {
      annule = true;
    };
  }, [config, chargementDonnees, espaceId, peutEditer]);

  if (chargement) return <Chargement libelle="Chargement…" />;

  if (!base) {
    return (
      <EtatVide
        icone={iconeVide}
        titre={`« ${config.titre} » n’est pas encore disponible`}
        description={
          peutEditer
            ? 'La base n’a pas pu être initialisée. Rechargez la page pour réessayer.'
            : 'Connectez-vous pour créer et utiliser cette base.'
        }
      />
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden>
            {base.icone || config.icone}
          </span>
          <h1 className="text-xl font-bold">{base.titre}</h1>
        </div>
        {config.description && <p className="mt-1.5 text-sm texte-doux">{config.description}</p>}
      </div>
      <div className="carte p-4">
        <VueBase base={base} />
      </div>
    </div>
  );
}
