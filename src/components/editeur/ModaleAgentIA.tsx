'use client';

import {
  Archive,
  CalendarPlus,
  CircleHelp,
  Database,
  FilePlus2,
  Loader2,
  MoveRight,
  Pencil,
  PenLine,
  Sparkles,
  SquarePen,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Modale } from '@/components/ui/Modale';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import {
  apercuSuppressions,
  appliquerPlanAgent,
  decrireAction,
  estExecutable,
  LIBELLES_ACTION,
  resoudrePlanAgent,
  type ActionAgent,
  type ActionDemander,
  type ApercuSuppression,
  type PlanAgent,
  type ResultatAgent,
} from '@/lib/iaAgent';
import { cn, nomUtilisateur } from '@/lib/utils';

/** Icône associée à chaque type d'action. */
const ICONES_ACTION: Record<ActionAgent['type'], LucideIcon> = {
  creer_page: FilePlus2,
  ecrire_page: PenLine,
  renommer_page: Pencil,
  deplacer_page: MoveRight,
  archiver_page: Archive,
  creer_base: Database,
  creer_element: CalendarPlus,
  modifier_element: SquarePen,
  supprimer_element: Trash2,
  demander: CircleHelp,
};

/** Actions qui touchent une page existante (une sauvegarde est alors créée). */
const ACTIONS_SENSIBLES: ActionAgent['type'][] = [
  'ecrire_page',
  'renommer_page',
  'deplacer_page',
  'archiver_page',
];

/**
 * Aperçu global du plan d'actions de l'agent NOVA : toutes les actions sont
 * listées avant application, puis appliquées d'un seul clic. Chaque
 * modification d'une page existante crée une version de sauvegarde, ce qui
 * permet de revenir en arrière depuis l'historique de la page.
 */
export function ModaleAgentIA({
  ouvert,
  onFermer,
  plan,
  onApplique,
  onRelancer,
}: {
  ouvert: boolean;
  onFermer: () => void;
  plan: PlanAgent | null;
  /** Appelé après application, avec le détail de ce qui a été fait. */
  onApplique?: (resultat: ResultatAgent) => void;
  /** Relance l'agent avec l'instruction choisie (option d'une question). */
  onRelancer?: (instruction: string) => void;
}) {
  const { pages, espaces, workspaceActif, rafraichir } = useDonnees();
  const { utilisateur, peutEditer } = useAuth();
  const toasts = useToasts();
  const [enCours, setEnCours] = useState(false);
  /** Lignes réellement visées par chaque suppression, lues dans les données. */
  const [cibles, setCibles] = useState<Record<number, ApercuSuppression>>({});
  /** Indices des actions retenues (toutes les actions exécutables par défaut). */
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const espaceChoisi = espaces[0]?._id;
  // Une « création » qui vise une page déjà existante devient une écriture dans
  // cette page : l'aperçu comme l'application utilisent ce plan corrigé.
  const planFinal = useMemo(() => (plan ? resoudrePlanAgent(plan, pages) : null), [plan, pages]);

  useEffect(() => {
    if (ouvert) setEnCours(false);
  }, [ouvert]);

  // À chaque nouveau plan, toutes les actions exécutables sont retenues ; un
  // clic sur une case permet d'en écarter une avant d'appliquer.
  useEffect(() => {
    if (!ouvert || !plan) {
      setSelection(new Set());
      return;
    }
    setSelection(
      new Set(
        plan.actions
          .map((action, index) => (estExecutable(action) ? index : -1))
          .filter((index) => index >= 0)
      )
    );
  }, [ouvert, plan]);

  const basculer = (index: number) => {
    setSelection((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(index)) suivant.delete(index);
      else suivant.add(index);
      return suivant;
    });
  };

  // Détail des suppressions : la modale affiche le nombre exact de lignes ainsi
  // que leurs titres, pour éviter toute suppression à l'aveugle.
  useEffect(() => {
    if (!ouvert || !planFinal) {
      setCibles({});
      return;
    }
    let annule = false;
    apercuSuppressions(planFinal, { pages, espaceId: espaceChoisi, workspaceId: workspaceActif?._id })
      .then((apercu) => {
        if (!annule) setCibles(apercu);
      })
      .catch(() => {
        if (!annule) setCibles({});
      });
    return () => {
      annule = true;
    };
  }, [ouvert, planFinal, pages, espaceChoisi, workspaceActif?._id]);

  const appliquer = async () => {
    if (!planFinal) return;
    const actions = planFinal.actions.filter((_, index) => selection.has(index));
    if (actions.length === 0) {
      toasts.erreur('Aucune action sélectionnée');
      return;
    }
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    // Seules les actions qui créent quelque chose ont besoin d'un espace d'équipe.
    const creation = actions.some(
      (action) =>
        action.type === 'creer_page' || action.type === 'creer_base' || action.type === 'creer_element'
    );
    if (creation && !espaceChoisi) {
      toasts.erreur('Aucun espace d’équipe pour créer le contenu');
      return;
    }
    setEnCours(true);
    try {
      const resultat = await appliquerPlanAgent(
        { ...planFinal, actions },
        {
          pages,
          espaceId: espaceChoisi,
          workspaceId: workspaceActif?._id,
          auteurNom: utilisateur ? nomUtilisateur(utilisateur) || utilisateur.email : null,
        }
      );
      await rafraichir();
      toasts.succes(
        `${resultat.faits.length} action${resultat.faits.length > 1 ? 's' : ''} appliquée${
          resultat.faits.length > 1 ? 's' : ''
        }`,
        resultat.faits.slice(0, 3).join(' · ')
      );
      onApplique?.(resultat);
      onFermer();
    } catch (e) {
      toasts.erreur('Application impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(false);
    }
  };

  if (!planFinal) return null;

  const actions = planFinal.actions;
  const nbExecutables = actions.filter(estExecutable).length;
  const nbRetenues = actions.filter((_, index) => selection.has(index)).length;
  const questions = actions.filter((action): action is ActionDemander => action.type === 'demander');
  const sensible = actions.some(
    (action, index) => selection.has(index) && ACTIONS_SENSIBLES.includes(action.type)
  );
  const supprime = actions.some(
    (action, index) => selection.has(index) && action.type === 'supprimer_element'
  );

  return (
    <Modale
      ouvert={ouvert}
      onFermer={onFermer}
      titre="Actions de NOVA"
      description="Vérifiez le plan complet avant de l’appliquer."
      largeur="max-w-xl"
      pied={
        <>
          <button type="button" className="bouton text-sm" onClick={onFermer} disabled={enCours}>
            {nbRetenues > 0 ? 'Annuler' : 'Fermer'}
          </button>
          {nbRetenues > 0 && (
            <button
              type="button"
              className="bouton bouton-primaire gap-1.5 text-sm"
              onClick={appliquer}
              disabled={enCours}
            >
              {enCours ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {enCours
                ? 'Application…'
                : `Appliquer ${nbRetenues} action${nbRetenues > 1 ? 's' : ''}`}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Résumé */}
        <div
          className="flex items-start gap-2.5 rounded-md border p-3"
          style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
        >
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
          <p className="text-sm texte-doux">{planFinal.resume}</p>
        </div>

        {/* Questions de NOVA : une précision est attendue, rien n'est appliqué. */}
        {questions.map((question, index) => (
          <div
            key={`question-${index}`}
            className="flex flex-col gap-2 rounded-md border p-3"
            style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
          >
            <span className="flex items-center gap-2 text-xs font-medium texte-doux">
              <CircleHelp className="h-3.5 w-3.5 shrink-0" />
              NOVA a besoin d’une précision
            </span>
            <p className="text-sm texte-doux">{question.question}</p>
            {question.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {question.options.map((option, rang) => (
                  <button
                    key={rang}
                    type="button"
                    className="bouton text-xs"
                    onClick={() => onRelancer?.(option.instruction)}
                    disabled={enCours || !onRelancer}
                  >
                    {option.titre}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Actions */}
        {nbExecutables > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium texte-doux">
              Plan · {nbRetenues} action{nbRetenues > 1 ? 's' : ''} retenue
              {nbRetenues > 1 ? 's' : ''} sur {nbExecutables}
            </span>
            <div
              className="max-h-72 overflow-y-auto rounded-md border p-2 defilement-fin"
              style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
            >
              <ul className="flex flex-col gap-1.5">
                {actions.map((action, index) => {
                  if (!estExecutable(action)) return null;
                  const Icone = ICONES_ACTION[action.type];
                  const danger =
                    action.type === 'archiver_page' || action.type === 'supprimer_element';
                  const detail = action.type === 'supprimer_element' ? cibles[index] : undefined;
                  const retenue = selection.has(index);
                  return (
                    <li key={index}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-neutral-400 accent-sky-500"
                          checked={retenue}
                          onChange={() => basculer(index)}
                          disabled={enCours}
                        />
                        <Icone
                          className={cn(
                            'mt-0.5 h-3.5 w-3.5 shrink-0',
                            danger && 'text-red-500',
                            !danger && 'texte-faible'
                          )}
                        />
                        <span className={cn('min-w-0', !retenue && 'opacity-50')}>
                          <span className="block text-[11px] uppercase tracking-wide texte-faible">
                            {LIBELLES_ACTION[action.type]}
                          </span>
                          <span className="block break-words texte-doux">{decrireAction(action)}</span>
                          {detail && (
                            <span
                              className={cn(
                                'block break-words text-[11px]',
                                detail.total === 0 ? 'texte-faible' : 'text-red-500'
                              )}
                            >
                              {detail.baseIntrouvable
                                ? 'Base introuvable — cette action sera ignorée'
                                : detail.total === 0
                                  ? 'Aucune ligne correspondante — cette action sera ignorée'
                                  : `${detail.total} ligne${detail.total > 1 ? 's' : ''} : ${detail.titres.join(' · ')}${
                                      detail.total > detail.titres.length ? ' …' : ''
                                    }`}
                            </span>
                          )}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {sensible && (
          <p className="text-xs texte-faible">
            Une version de sauvegarde est créée avant chaque modification de page : tu pourras
            revenir en arrière depuis « Historique de la page ».
          </p>
        )}

        {supprime && (
          <p className="text-xs text-red-500">
            Les lignes supprimées sont retirées de leur base : tu pourras les rétablir juste après
            avec « Annuler les actions de NOVA ».
          </p>
        )}
      </div>
    </Modale>
  );
}
