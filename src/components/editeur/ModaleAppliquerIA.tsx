'use client';

import {
  ArrowDownToLine,
  FilePlus2,
  Loader2,
  Replace,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Modale } from '@/components/ui/Modale';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { appliquerPlanIA, type ActionPlanIA, type BlocPlanifie, type PlanIAPage } from '@/lib/iaPage';
import { iconeParTypeBloc, libelleTypeBloc } from '@/lib/icones';
import { cn, identifiantDe, nomUtilisateur } from '@/lib/utils';

/** Actions proposées à l'insertion du plan. */
const ACTIONS: Array<{
  valeur: ActionPlanIA;
  libelle: string;
  description: string;
  icone: LucideIcon;
}> = [
  {
    valeur: 'nouvelle_page',
    libelle: 'Créer une page',
    description: 'Une nouvelle page est créée avec ce contenu.',
    icone: FilePlus2,
  },
  {
    valeur: 'ajouter',
    libelle: 'Écrire à la fin',
    description: 'Le contenu est ajouté à la fin de la page choisie.',
    icone: ArrowDownToLine,
  },
  {
    valeur: 'remplacer',
    libelle: 'Remplacer le contenu',
    description: 'Le contenu de la page est remplacé (une sauvegarde est créée).',
    icone: Replace,
  },
];

/** Résumé lisible d'un bloc dans l'aperçu (les tableaux n'ont pas de texte). */
function apercuBloc(bloc: BlocPlanifie): string {
  if (bloc.type === 'separateur') return '—';
  if (bloc.type === 'tableau') {
    const t = bloc.proprietes?.tableau as { colonnes?: unknown[]; lignes?: unknown[] } | undefined;
    const colonnes = Array.isArray(t?.colonnes) ? t.colonnes.length : 0;
    const lignes = Array.isArray(t?.lignes) ? t.lignes.length : 0;
    return `Tableau ${colonnes} colonne${colonnes > 1 ? 's' : ''} × ${lignes} ligne${lignes > 1 ? 's' : ''}`;
  }
  return bloc.contenu;
}

/** Aperçu du plan et choix de destination avant application dans une page. */
export function ModaleAppliquerIA({
  ouvert,
  onFermer,
  plan,
  pageDefaut,
  onApplique,
}: {
  ouvert: boolean;
  onFermer: () => void;
  plan: PlanIAPage | null;
  /** Page présélectionnée lorsque l'action cible une page existante. */
  pageDefaut?: string;
  /** Appelé après application : identifiant de la page visée et mode retenu. */
  onApplique?: (resultat: { pageId: string; mode: ActionPlanIA }) => void;
}) {
  const { pages, pageParId, espaces, workspaceActif, rafraichir } = useDonnees();
  const { utilisateur, peutEditer } = useAuth();
  const toasts = useToasts();

  const [action, setAction] = useState<ActionPlanIA>('nouvelle_page');
  const [pageId, setPageId] = useState('');
  const [titre, setTitre] = useState('');
  const [enCours, setEnCours] = useState(false);

  /* Chaque ouverture repart du plan proposé par l'assistant. */
  useEffect(() => {
    if (!ouvert || !plan) return;
    setAction(plan.action);
    setPageId(pageDefaut || pages[0]?._id || '');
    setTitre(plan.titre || 'Sans titre');
    setEnCours(false);
  }, [ouvert, plan, pages, pageDefaut]);

  const appliquer = async () => {
    if (!plan) return;
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    if (action !== 'nouvelle_page' && !pageId) {
      toasts.erreur('Choisissez une page cible');
      return;
    }
    setEnCours(true);
    try {
      const cible = action !== 'nouvelle_page' ? pageParId(pageId) : undefined;
      const resultat = await appliquerPlanIA({
        action,
        titre,
        blocs: plan.blocs,
        pageId: action !== 'nouvelle_page' ? pageId : undefined,
        espaceId: identifiantDe(cible?.espaceId) || espaces[0]?._id,
        workspaceId: workspaceActif?._id,
        parentId: cible ? cible.parentId ?? null : null,
        auteurNom: utilisateur ? nomUtilisateur(utilisateur) || utilisateur.email : null,
      });
      await rafraichir();
      toasts.succes(
        action === 'nouvelle_page'
          ? 'Page créée'
          : action === 'remplacer'
            ? 'Contenu remplacé (sauvegarde créée)'
            : 'Contenu ajouté à la page'
      );
      onApplique?.({ pageId: resultat.pageId, mode: action });
      onFermer();
    } catch (e) {
      toasts.erreur('Application impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(false);
    }
  };

  if (!plan) return null;

  return (
    <Modale
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Écrire dans une page"
      description="Choisissez la destination, puis vérifiez l’aperçu avant d’appliquer."
      largeur="max-w-xl"
      pied={
        <>
          <button type="button" className="bouton text-sm" onClick={onFermer} disabled={enCours}>
            Annuler
          </button>
          <button
            type="button"
            className="bouton bouton-primaire gap-1.5 text-sm"
            onClick={appliquer}
            disabled={enCours}
          >
            {enCours ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {enCours ? 'Application…' : 'Appliquer'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Action */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium texte-doux">Où écrire</span>
          <div className="grid gap-1.5">
            {ACTIONS.map((entree) => {
              const Icone = entree.icone;
              const actif = action === entree.valeur;
              return (
                <button
                  key={entree.valeur}
                  type="button"
                  onClick={() => setAction(entree.valeur)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors',
                    actif
                      ? 'border-transparent bg-black/[0.04] dark:bg-white/[0.07]'
                      : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'
                  )}
                  style={actif ? undefined : { borderColor: 'var(--bordure)' }}
                >
                  <Icone
                    className={cn('mt-0.5 h-4 w-4 shrink-0', !actif && 'texte-doux')}
                    style={actif ? { color: 'var(--accent)' } : undefined}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{entree.libelle}</span>
                    <span className="block text-xs texte-faible">{entree.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Destination */}
        {action === 'nouvelle_page' ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium texte-doux">Titre de la nouvelle page</span>
            <input className="champ" value={titre} onChange={(e) => setTitre(e.target.value)} />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium texte-doux">Page cible</span>
            <select className="champ" value={pageId} onChange={(e) => setPageId(e.target.value)}>
              <option value="">Choisir une page…</option>
              {pages.map((page) => (
                <option key={page._id} value={page._id}>
                  {page.titre || 'Sans titre'}
                </option>
              ))}
            </select>
            {action === 'remplacer' && (
              <span className="text-xs texte-faible">
                Une version de sauvegarde sera créée pour pouvoir revenir en arrière.
              </span>
            )}
          </label>
        )}

        {/* Aperçu */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium texte-doux">
            Aperçu · {plan.blocs.length} bloc{plan.blocs.length > 1 ? 's' : ''}
          </span>
          <div
            className="max-h-64 overflow-y-auto rounded-md border p-2 defilement-fin"
            style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
          >
            <ul className="flex flex-col gap-1">
              {plan.blocs.map((bloc, index) => {
                const Icone = iconeParTypeBloc[bloc.type];
                return (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Icone className="mt-0.5 h-3.5 w-3.5 shrink-0 texte-faible" />
                    <span className="min-w-0">
                      <span className="block text-[11px] uppercase tracking-wide texte-faible">
                        {libelleTypeBloc[bloc.type]}
                      </span>
                      <span className="block truncate texte-doux">{apercuBloc(bloc)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </Modale>
  );
}
