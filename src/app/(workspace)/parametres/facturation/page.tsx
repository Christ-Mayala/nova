'use client';

import { BadgeCheck, CreditCard, FileText, HardDrive, Receipt, Sparkles, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Chargement } from '@/components/ui/Etats';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { elements as apiElements, listerTout, parametres as apiParametres } from '@/lib/api';
import type { Plan } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

interface Formule {
  plan: Plan;
  nom: string;
  prix: string;
  periode?: string;
  description: string;
  avantages: string[];
  vedette?: boolean;
}

/** Formules d'abonnement proposées. */
const FORMULES: Formule[] = [
  {
    plan: 'gratuit',
    nom: 'Gratuit',
    prix: '0 €',
    periode: 'pour toujours',
    description: 'Pour découvrir l’espace de travail en équipe réduite.',
    avantages: ['Pages et blocs illimités', 'Jusqu’à 10 invités', 'Bases de données et vues', 'Historique de 7 jours'],
  },
  {
    plan: 'plus',
    nom: 'Plus',
    prix: '12 €',
    periode: 'par membre / mois',
    description: 'Pour les équipes qui collaborent au quotidien.',
    avantages: ['Invités illimités', 'Historique illimité', 'Assistant IA illimité', 'Publication sur le Web', 'Connexions et intégrations'],
    vedette: true,
  },
  {
    plan: 'entreprise',
    nom: 'Entreprise',
    prix: 'Sur devis',
    description: 'Pour les organisations avec des exigences avancées.',
    avantages: ['Authentification SAML SSO', 'Provisionnement SCIM', 'Audit et conformité', 'Assistance dédiée', 'Contrôles d’administration avancés'],
  },
];

/** Formules et facturation de l'espace de travail. */
export default function PageParametresFacturation() {
  const { parametre, espaces, pages, chargement, rafraichir } = useDonnees();
  const { estAdmin } = useAuth();
  const toasts = useToasts();

  const [nbElements, setNbElements] = useState(0);
  const [enregistrement, setEnregistrement] = useState(false);

  const planActuel: Plan = parametre?.plan || 'gratuit';

  /* Comptage des éléments de bases pour l'indicateur d'utilisation. */
  useEffect(() => {
    let annule = false;
    listerTout(apiElements, { fields: 'titre', limit: 100 })
      .then((liste) => {
        if (!annule) setNbElements(liste.length);
      })
      .catch(() => {
        if (!annule) setNbElements(0);
      });
    return () => {
      annule = true;
    };
  }, []);

  /** Nombre de membres distincts (auteurs de pages) + utilisateur courant. */
  const nbMembres = useMemo(() => {
    const ids = new Set<string>();
    pages.forEach((page) => {
      const auteur = identifiantDe(page.createdBy);
      if (auteur) ids.add(auteur);
    });
    return Math.max(ids.size, 1);
  }, [pages]);

  const changerFormule = useCallback(
    async (plan: Plan) => {
      if (!parametre) {
        toasts.erreur('Espace de travail non configuré');
        return;
      }
      if (!estAdmin) {
        toasts.erreur('Action réservée aux administrateurs');
        return;
      }
      if (plan === planActuel) return;
      setEnregistrement(true);
      try {
        await apiParametres.maj(parametre._id, { plan });
        await rafraichir();
        toasts.succes(`Formule « ${FORMULES.find((f) => f.plan === plan)?.nom} » activée`);
      } catch (e) {
        toasts.erreur('Changement de formule impossible', e instanceof Error ? e.message : undefined);
      } finally {
        setEnregistrement(false);
      }
    },
    [parametre, estAdmin, planActuel, rafraichir, toasts]
  );

  if (chargement) return <Chargement libelle="Chargement de la facturation…" />;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <CreditCard className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Formules et facturation</h1>
        <span className="etiquette ml-1 bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
          {FORMULES.find((f) => f.plan === planActuel)?.nom}
        </span>
      </div>

      {/* Utilisation */}
      <section className="carte p-5">
        <h2 className="mb-4 text-sm font-semibold">Utilisation de l’espace</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Indicateur icone={Users} libelle="Membres" valeur={String(nbMembres)} />
          <Indicateur icone={FileText} libelle="Pages" valeur={String(pages.length)} />
          <Indicateur icone={HardDrive} libelle="Éléments" valeur={String(nbElements)} />
          <Indicateur icone={BadgeCheck} libelle="Espaces" valeur={String(espaces.length)} />
        </div>
      </section>

      {/* Formules */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Choisir une formule</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {FORMULES.map((formule) => (
            <FormuleCarte
              key={formule.plan}
              formule={formule}
              actif={formule.plan === planActuel}
              desactive={!estAdmin || enregistrement}
              onChoisir={() => changerFormule(formule.plan)}
            />
          ))}
        </div>
        {!estAdmin && (
          <p className="text-xs texte-doux">Seul un administrateur peut modifier la formule de l’espace.</p>
        )}
      </section>

      {/* Facturation */}
      <section className="carte p-5">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="h-4 w-4 texte-faible" />
          <h2 className="text-sm font-semibold">Historique de facturation</h2>
        </div>
        <p className="rounded-md px-3 py-6 text-center text-sm texte-doux" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          Aucune facture pour le moment. Les factures apparaîtront ici dès le premier paiement.
        </p>
      </section>
    </div>
  );
}

/** Indicateur d'utilisation (icône, libellé, valeur). */
function Indicateur({
  icone: Icone,
  libelle,
  valeur,
}: {
  icone: typeof Users;
  libelle: string;
  valeur: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: 'var(--fond-secondaire)' }}
      >
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold leading-tight">{valeur}</p>
        <p className="text-xs texte-doux">{libelle}</p>
      </div>
    </div>
  );
}

/** Carte d'une formule d'abonnement. */
function FormuleCarte({
  formule,
  actif,
  desactive,
  onChoisir,
}: {
  formule: Formule;
  actif: boolean;
  desactive: boolean;
  onChoisir: () => void;
}) {
  return (
    <div
      className={cn('carte flex flex-col gap-4 p-5', formule.vedette && !actif && 'ring-1 ring-sky-400')}
    >
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold">{formule.nom}</h3>
          {formule.vedette && !actif && (
            <span className="etiquette bg-sky-100 px-1.5 py-0.5 text-[11px] text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <Sparkles className="mr-1 inline h-3 w-3" />
              Recommandé
            </span>
          )}
          {actif && (
            <span className="etiquette bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              Formule actuelle
            </span>
          )}
        </div>
        <p className="mt-2 flex items-baseline gap-1">
          <span className="text-xl font-bold">{formule.prix}</span>
          {formule.periode && <span className="text-xs texte-doux">{formule.periode}</span>}
        </p>
        <p className="mt-1 text-sm texte-doux">{formule.description}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {formule.avantages.map((avantage) => (
          <li key={avantage} className="flex items-start gap-2 text-sm">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{avantage}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onChoisir}
        disabled={actif || desactive}
        className={cn('bouton w-full justify-center', !actif && 'bouton-primaire')}
      >
        {actif ? 'Formule active' : 'Choisir cette formule'}
      </button>
    </div>
  );
}
