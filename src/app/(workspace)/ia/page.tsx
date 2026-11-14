'use client';

import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  FilePlus2,
  FileText,
  Languages,
  ListChecks,
  Loader2,
  NotebookPen,
  Send,
  Sparkles,
  Trash2,
  Undo2,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ModaleAgentIA } from '@/components/editeur/ModaleAgentIA';
import { ModaleAppliquerIA } from '@/components/editeur/ModaleAppliquerIA';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Markdown } from '@/components/ui/Markdown';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import {
  blocs as apiBlocs,
  demanderIA,
  listerTout,
  requetesIA as apiRequetesIA,
  type MessageIA,
} from '@/lib/api';
import { lienPage } from '@/lib/navigation';
import {
  annulerDerniereApplication,
  construireContexteAgent,
  demanderPlanAgent,
  derniereApplication,
  resumePlanAgent,
  type ApplicationAgent,
  type PlanAgent,
} from '@/lib/iaAgent';
import { convertirMarkdownEnBlocs, type PlanIAPage } from '@/lib/iaPage';
import type { Page, RequeteIA, SourceIA, TypeRequeteIA } from '@/lib/types';
import { cn, formaterDateRelative } from '@/lib/utils';

interface TypeIA {
  valeur: TypeRequeteIA;
  libelle: string;
  icone: LucideIcon;
  invite: string;
  consigne: string;
  exemple: string;
}

/** Types de requêtes proposés par l'assistant (cf. « NOVA AI »). */
const TYPES: TypeIA[] = [
  {
    valeur: 'agent',
    libelle: 'Agent',
    icone: Wand2,
    invite: 'Décrivez ce que NOVA doit faire',
    // Le mode « Agent » a sa propre consigne (plan d'actions JSON) : ce champ
    // n'est utilisé que par les modes de rédaction.
    consigne: '',
    exemple:
      'Crée une page « Lancement produit » avec un plan, ajoute un rendez-vous de lancement dans Réunions et une tâche de préparation dans Mes tâches.',
  },
  {
    valeur: 'question',
    libelle: 'Question',
    icone: Sparkles,
    invite: 'Posez une question sur votre espace',
    consigne: 'Réponds en français, de façon concise et factuelle, en t’appuyant sur le contexte fourni.',
    exemple: 'Quelles décisions ont été prises lors de la dernière réunion ?',
  },
  {
    valeur: 'redaction',
    libelle: 'Rédaction',
    icone: NotebookPen,
    invite: 'Décrivez le texte à rédiger',
    consigne: 'Rédige en français un texte clair, structuré et professionnel.',
    exemple: 'Rédige un compte rendu de sprint en trois parties.',
  },
  {
    valeur: 'resume',
    libelle: 'Résumé',
    icone: BookOpen,
    invite: 'Que faut-il résumer ?',
    consigne: 'Résume en français les points clés du contexte, sous forme de puces.',
    exemple: 'Résume les points clés de cette page.',
  },
  {
    valeur: 'traduction',
    libelle: 'Traduction',
    icone: Languages,
    invite: 'Indiquez la langue cible et le texte',
    consigne: 'Traduis le texte fourni en français, en conservant le ton et le format.',
    exemple: 'Traduis ce paragraphe en français.',
  },
  {
    valeur: 'autoremplissage',
    libelle: 'Auto-remplissage',
    icone: Wand2,
    invite: 'Indiquez ce qu’il faut compléter',
    consigne: 'Complète le contenu en français de façon cohérente avec le contexte.',
    exemple: 'Propose les prochaines étapes à partir de ce contexte.',
  },
];

/** Assistant IA : rédaction, résumés, traduction et questions sur l’espace. */
export default function PageIA() {
  const { pages, pageParId, rafraichir } = useDonnees();
  const { peutEditer } = useAuth();
  const toasts = useToasts();

  const [type, setType] = useState<TypeRequeteIA>('agent');
  const [question, setQuestion] = useState('');
  const [pageSource, setPageSource] = useState<string>('');
  const [enCours, setEnCours] = useState(false);
  const [historique, setHistorique] = useState<RequeteIA[]>([]);
  const [chargement, setChargement] = useState(true);
  /** Clés des groupes de l'historique repliés (page de contexte). */
  const [groupesReplies, setGroupesReplies] = useState<string[]>([]);
  /** Réponse en cours d'écriture dans une page (plan + destination). */
  const [planInsertion, setPlanInsertion] = useState<PlanIAPage | null>(null);
  const [pageInsertion, setPageInsertion] = useState<string | undefined>(undefined);
  const [insertionOuverte, setInsertionOuverte] = useState(false);
  /** Plan d'actions proposé par l'agent (mode « Agent ») et sa modale d'aperçu. */
  const [planAgent, setPlanAgent] = useState<PlanAgent | null>(null);
  const [agentOuvert, setAgentOuvert] = useState(false);
  /** Dernière application de l'agent, encore annulable. */
  const [derniereAgent, setDerniereAgent] = useState<ApplicationAgent | null>(null);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);
  const zoneRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDerniereAgent(derniereApplication());
  }, []);

  /** Replie ou déplie un groupe de l'historique. */
  const basculerGroupe = useCallback((cle: string) => {
    setGroupesReplies((prec) => (prec.includes(cle) ? prec.filter((c) => c !== cle) : [...prec, cle]));
  }, []);

  const typeActif = useMemo(() => TYPES.find((t) => t.valeur === type) || TYPES[0], [type]);

  const chargerHistorique = useCallback(async () => {
    try {
      const liste = await listerTout(apiRequetesIA, { sort: '-createdAt' });
      setHistorique(liste);
    } catch {
      setHistorique([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    chargerHistorique();
  }, [chargerHistorique]);

  // Si la page choisie comme contexte a été supprimée (ou sort de l'espace de
  // travail actif), on réinitialise la sélection : le filtre ne doit jamais
  // proposer ni conserver une page inexistante.
  useEffect(() => {
    if (pageSource && !pages.some((p) => p._id === pageSource)) {
      setPageSource('');
    }
  }, [pages, pageSource]);

  /** Construit le contexte textuel d'une page (blocs concaténés). */
  const contexteDePage = useCallback(async (pageId: string): Promise<string> => {
    if (!pageId) return '';
    try {
      const blocs = await listerTout(apiBlocs, { pageId, sort: 'ordre' });
      const texte = blocs
        .map((bloc) => bloc.contenu || '')
        .filter((contenu) => contenu.trim())
        .join('\n');
      return texte.slice(0, 4000);
    } catch {
      return '';
    }
  }, []);

  const demander = useCallback(
    async (instructionForcee?: string) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      const instruction = (instructionForcee ?? question).trim();
      if (!instruction) {
        toasts.erreur('Saisissez votre demande');
        return;
      }
      setEnCours(true);
      try {
        const sources: SourceIA[] = [];
        if (pageSource) {
          const page = pageParId(pageSource);
          sources.push({ titre: page?.titre, pageId: pageSource });
        }

        // Mode « Agent » : NOVA lit le contexte réel (pages, bases, page courante)
        // puis propose un plan d'actions — créer des pages et des sous-pages, une
        // base, un rendez-vous ou une tâche, réécrire du contenu — vérifié dans
        // une modale avant application.
        if (type === 'agent') {
          const plan = await demanderPlanAgent(
            instruction,
            await construireContexteAgent({ pages, pageCouranteId: pageSource || undefined })
          );
          if (plan.actions.length === 0) {
            throw new Error("NOVA n'a proposé aucune action exploitable. Reformulez la demande.");
          }
          setPlanAgent(plan);
          setAgentOuvert(true);
          setQuestion('');

          const maintenant = new Date().toISOString();
          const reponse = resumePlanAgent(plan);
          const local: RequeteIA = {
            _id: `local-${Date.now()}`,
            question: instruction,
            reponse,
            sources,
            pageId: pageSource || undefined,
            type: 'agent',
            createdAt: maintenant,
            updatedAt: maintenant,
          };
          setHistorique((prec) => [local, ...prec]);
          try {
            const enregistre = await apiRequetesIA.creer({
              question: instruction,
              reponse,
              sources,
              pageId: pageSource || undefined,
              type: 'agent',
            } as Partial<RequeteIA>);
            setHistorique((prec) => prec.map((r) => (r._id === local._id ? enregistre : r)));
          } catch (e) {
            toasts.erreur('Plan affiché mais non enregistré', e instanceof Error ? e.message : undefined);
          }
          return;
        }

        const contexte = await contexteDePage(pageSource);
        const messages: MessageIA[] = [{ role: 'system', content: typeActif.consigne }];
        if (contexte) {
          messages.push({ role: 'system', content: `Contexte de la page :\n${contexte}` });
        }
        messages.push({ role: 'user', content: instruction });

        const resultat = await demanderIA(messages);
        if (!resultat.contenu.trim()) {
          throw new Error("L'assistant n'a renvoyé aucun texte. Réessayez.");
        }

        // Affiche la réponse immédiatement, même si l'enregistrement échoue :
        // l'utilisateur ne doit jamais « perdre » une réponse déjà générée.
        const maintenant = new Date().toISOString();
        const local: RequeteIA = {
          _id: `local-${Date.now()}`,
          question: instruction,
          reponse: resultat.contenu,
          sources,
          modele: resultat.modele,
          pageId: pageSource || undefined,
          dureeMs: resultat.dureeMs,
          type,
          createdAt: maintenant,
          updatedAt: maintenant,
        };
        setHistorique((prec) => [local, ...prec]);
        setQuestion('');

        try {
          const enregistre = await apiRequetesIA.creer({
            question: instruction,
            reponse: resultat.contenu,
            sources,
            modele: resultat.modele,
            pageId: pageSource || undefined,
            dureeMs: resultat.dureeMs,
            type,
          } as Partial<RequeteIA>);
          setHistorique((prec) => prec.map((r) => (r._id === local._id ? enregistre : r)));
        } catch (e) {
          toasts.erreur('Réponse affichée mais non enregistrée', e instanceof Error ? e.message : undefined);
        }
      } catch (e) {
        toasts.erreur('Réponse impossible', e instanceof Error ? e.message : undefined);
      } finally {
        setEnCours(false);
      }
    },
    [peutEditer, question, pageSource, typeActif, contexteDePage, pageParId, type, pages, toasts]
  );

  /** Annule la dernière application de l'agent (journal local). */
  const annulerAgent = useCallback(async () => {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    setAnnulationEnCours(true);
    try {
      const faits = await annulerDerniereApplication();
      await rafraichir();
      setDerniereAgent(derniereApplication());
      toasts.succes(
        `${faits.length} action${faits.length > 1 ? 's' : ''} annulée${faits.length > 1 ? 's' : ''}`,
        faits.slice(0, 3).join(' · ')
      );
    } catch (e) {
      toasts.erreur('Annulation impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setAnnulationEnCours(false);
    }
  }, [peutEditer, rafraichir, toasts]);

  const supprimer = useCallback(
    async (requete: RequeteIA) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      try {
        // Entrée locale non encore persistée : suppression purement visuelle.
        if (!requete._id.startsWith('local-')) {
          await apiRequetesIA.supprimer(requete._id);
        }
        setHistorique((prec) => prec.filter((r) => r._id !== requete._id));
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [peutEditer, toasts]
  );

  /** Prépare l'écriture d'une réponse dans une page (destination choisie ensuite). */
  const preparerInsertion = useCallback(
    (requete: RequeteIA) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      const blocs = convertirMarkdownEnBlocs(requete.reponse || '');
      if (blocs.length === 0) {
        toasts.erreur('Cette réponse est vide');
        return;
      }
      const page = requete.pageId ? pageParId(requete.pageId) : undefined;
      setPlanInsertion({
        action: requete.pageId ? 'ajouter' : 'nouvelle_page',
        titre: page?.titre || requete.question.slice(0, 80) || 'Sans titre',
        blocs,
      });
      setPageInsertion(requete.pageId);
      setInsertionOuverte(true);
    },
    [peutEditer, pageParId, toasts]
  );

  /** Historique regroupé par page de contexte (les échanges sont datés). */
  const groupes = useMemo(() => {
    const table = new Map<string, { page?: Page; requetes: RequeteIA[] }>();
    historique.forEach((requete) => {
      const cle = requete.pageId || '__sans_page__';
      const entree =
        table.get(cle) || { page: requete.pageId ? pageParId(requete.pageId) : undefined, requetes: [] };
      entree.requetes.push(requete);
      table.set(cle, entree);
    });
    return Array.from(table.entries()).map(([cle, valeur]) => ({ cle, ...valeur }));
  }, [historique, pageParId]);

  return (
    <div className="mx-auto w-full max-w-contenu px-8 py-8">
      <div className="mb-5 flex items-center gap-2">
        <Sparkles className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">NOVA IA</h1>
        <p className="ml-2 text-sm texte-doux">Interrogez votre espace, rédigez et résumez.</p>
      </div>

      {/* Composer */}
      <section className="carte flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((entree) => {
            const Icone = entree.icone;
            const actif = type === entree.valeur;
            return (
              <button
                key={entree.valeur}
                type="button"
                onClick={() => setType(entree.valeur)}
                className={cn('etiquette gap-1.5 px-2.5 py-1', actif ? 'lien-barre-actif' : 'texte-doux')}
                style={!actif ? { backgroundColor: 'var(--fond-secondaire)' } : undefined}
              >
                <Icone className="h-3.5 w-3.5" />
                {entree.libelle}
              </button>
            );
          })}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium texte-doux">Page de contexte (facultatif)</span>
          <select className="champ" value={pageSource} onChange={(e) => setPageSource(e.target.value)}>
            <option value="">Aucune page</option>
            {pages.map((page) => (
              <option key={page._id} value={page._id}>
                {page.titre || 'Sans titre'}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium texte-doux">{typeActif.invite}</span>
          <textarea
            ref={zoneRef}
            className="champ min-h-[96px] resize-y"
            value={question}
            placeholder={typeActif.exemple}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                demander();
              }
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs texte-faible">Ctrl/⌘ + Entrée pour envoyer</p>
          <button
            type="button"
            className="bouton bouton-primaire gap-1.5"
            onClick={() => demander()}
            disabled={enCours || !question.trim()}
          >
            <Send className="h-4 w-4" />
            {enCours ? 'Génération…' : 'Demander'}
          </button>
        </div>
      </section>

      {/* Dernière application de l'agent : annulable tant qu'une autre n'a pas eu lieu. */}
      {derniereAgent && (
        <div
          className="mt-4 flex items-center gap-3 rounded-md border px-3 py-2"
          style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
        >
          <Undo2 className="h-3.5 w-3.5 shrink-0 texte-faible" />
          <span className="min-w-0 flex-1 truncate text-xs texte-doux">
            Dernière application : {derniereAgent.resume}
          </span>
          <button
            type="button"
            className="bouton shrink-0 gap-1.5 text-xs"
            onClick={annulerAgent}
            disabled={annulationEnCours}
          >
            {annulationEnCours ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Undo2 className="h-3.5 w-3.5" />
            )}
            {annulationEnCours ? 'Annulation…' : 'Annuler les actions'}
          </button>
        </div>
      )}

      {/* Historique */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="h-4 w-4 texte-faible" />
          <h2 className="text-sm font-semibold texte-doux">Historique</h2>
          {groupes.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setGroupesReplies(
                  groupes.every((groupe) => groupesReplies.includes(groupe.cle))
                    ? []
                    : groupes.map((groupe) => groupe.cle)
                )
              }
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
              {groupes.every((groupe) => groupesReplies.includes(groupe.cle))
                ? 'Tout déplier'
                : 'Tout plier'}
            </button>
          )}
        </div>

        {chargement ? (
          <Chargement libelle="Chargement de l’historique…" />
        ) : historique.length === 0 ? (
          <EtatVide
            icone={Sparkles}
            titre="Aucune demande pour l’instant"
            description="Posez votre première question : les échanges apparaîtront ici."
          />
        ) : (
          <div className="flex flex-col gap-6">
            {groupes.map((groupe) => {
              const replie = groupesReplies.includes(groupe.cle);
              return (
                <section key={groupe.cle}>
                  <header className="mb-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => basculerGroupe(groupe.cle)}
                      aria-expanded={!replie}
                      aria-label={replie ? 'Déplier la conversation' : 'Replier la conversation'}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <ChevronRight
                        className={cn('h-4 w-4 transition-transform', !replie && 'rotate-90')}
                      />
                    </button>
                    {groupe.page ? (
                      <>
                        <IconeDonnee
                          icone={groupe.page.icone}
                          repli={FileText}
                          className="h-4 w-4 shrink-0 texte-doux"
                        />
                        <Link href={lienPage(groupe.page)} className="truncate font-medium hover:underline">
                          {groupe.page.titre || 'Sans titre'}
                        </Link>
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 shrink-0 texte-faible" />
                        <span className="texte-doux">Sans page de contexte</span>
                      </>
                    )}
                    <span className="etiquette px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
                      {groupe.requetes.length}
                    </span>
                  </header>
                  {!replie && (
                    <ul className="flex flex-col gap-3">
                      {groupe.requetes.map((requete) => (
                        <LigneRequete
                          key={requete._id}
                          requete={requete}
                          page={requete.pageId ? pageParId(requete.pageId) : undefined}
                          onSupprimer={() => supprimer(requete)}
                          onInserer={() => preparerInsertion(requete)}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      {/* Écriture d'une réponse dans une page : destination et aperçu choisis ici. */}
      <ModaleAppliquerIA
        ouvert={insertionOuverte}
        plan={planInsertion}
        pageDefaut={pageInsertion}
        onFermer={() => setInsertionOuverte(false)}
      />

      {/* Plan d'actions de l'agent : aperçu global puis application en un clic. */}
      <ModaleAgentIA
        ouvert={agentOuvert}
        plan={planAgent}
        pageCouranteId={pageSource || undefined}
        onFermer={() => setAgentOuvert(false)}
        onApplique={() => setDerniereAgent(derniereApplication())}
        onRelancer={(instruction) => {
          setAgentOuvert(false);
          demander(instruction);
        }}
      />
    </div>
  );
}

/** Libellé français d'un type de requête. */
function libelleType(type?: TypeRequeteIA): string {
  return TYPES.find((t) => t.valeur === type)?.libelle || 'Question';
}

/** Échange IA : question, réponse, sources et métadonnées. */
/** Longueur au-delà de laquelle une réponse est repliée par défaut. */
const LONGUEUR_REPLI = 700;

function LigneRequete({
  requete,
  page,
  onSupprimer,
  onInserer,
}: {
  requete: RequeteIA;
  page?: Page;
  onSupprimer: () => void;
  onInserer: () => void;
}) {
  const longue = (requete.reponse?.length ?? 0) > LONGUEUR_REPLI;
  const [deplie, setDeplie] = useState(!longue);

  return (
    <li className="carte group flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <span className="etiquette px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          {libelleType(requete.type)}
        </span>
        <p className="min-w-0 flex-1 font-medium">{requete.question}</p>
        <span className="shrink-0 text-xs texte-faible">{formaterDateRelative(requete.createdAt)}</span>
        <button
          type="button"
          onClick={onSupprimer}
          className="bouton p-1 text-red-600 opacity-0 transition-opacity hover:bg-red-50 group-hover:opacity-100 focus:opacity-100 dark:text-red-400 dark:hover:bg-red-950/40"
          aria-label="Supprimer l’échange"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {requete.reponse && (
        <div className="relative">
          <div className={cn(!deplie && 'max-h-44 overflow-hidden')}>
            {requete.type === 'agent' ? (
              // Le plan de l'agent contient des identifiants techniques (…_page,
              // …_base) : on l'affiche tel quel, sans le réinterpréter en Markdown.
              <p className="whitespace-pre-wrap break-words text-sm texte-doux">{requete.reponse}</p>
            ) : (
              <Markdown contenu={requete.reponse} className="contenu-bloc flex flex-col gap-2 text-sm texte-doux" />
            )}
          </div>
          {!deplie && (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{ background: 'linear-gradient(to top, var(--fond), transparent)' }}
            />
          )}
        </div>
      )}

      {requete.reponse && longue && (
        <button
          type="button"
          onClick={() => setDeplie((v) => !v)}
          className="flex items-center gap-1 self-start text-xs font-medium texte-doux hover:underline"
        >
          {deplie ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {deplie ? 'Réduire la réponse' : 'Afficher toute la réponse'}
        </button>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs texte-faible">
        {requete.reponse && (
          <button
            type="button"
            onClick={onInserer}
            className="flex items-center gap-1 font-medium texte-doux hover:underline"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Insérer dans une page
          </button>
        )}
        {page && (
          <Link href={lienPage(page)} className="hover:underline">
            {page.titre || 'Page'}
          </Link>
        )}
        {requete.modele && <span>Modèle : {requete.modele}</span>}
        {typeof requete.dureeMs === 'number' && <span>{(requete.dureeMs / 1000).toFixed(1)} s</span>}
      </div>
    </li>
  );
}
