'use client';

import {
  Building2,
  Hash,
  Loader2,
  MessagesSquare,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { useLangue } from '@/context/LangueContext';
import { useEvenementTempsReel } from '@/context/TempsReelContext';
import { listerTout, messages as apiMessages } from '@/lib/api';
import type { Espace, MessageEquipe } from '@/lib/types';
import { cn, formaterDateHeure, identifiantDe } from '@/lib/utils';

/** Tri chronologique croissant des messages. */
function parDate(a: MessageEquipe, b: MessageEquipe): number {
  return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
}

/**
 * 2ᵉ messagerie : vraie messagerie d'équipe plein écran façon Teams / Slack,
 * organisée par canaux d'espaces d'équipe avec synchronisation en temps réel.
 */
export default function PageMessagerie() {
  const { espaces, chargement: chargementEspaces } = useDonnees();
  const { utilisateur } = useAuth();
  const { t } = useLangue();
  const toasts = useToasts();

  const [espaceSelectionneId, setEspaceSelectionneId] = useState<string | null>(null);
  const [rechercheCanal, setRechercheCanal] = useState('');
  const [messages, setMessages] = useState<MessageEquipe[]>([]);
  const [chargementMessages, setChargementMessages] = useState(false);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const filRef = useRef<HTMLDivElement | null>(null);

  // Sélectionne par défaut le premier espace d'équipe disponible
  useEffect(() => {
    if (!espaceSelectionneId && espaces.length > 0) {
      setEspaceSelectionneId(espaces[0]._id);
    }
  }, [espaces, espaceSelectionneId]);

  const espaceActif = useMemo<Espace | undefined>(
    () => espaces.find((e) => e._id === espaceSelectionneId) || espaces[0],
    [espaces, espaceSelectionneId]
  );

  const canauxFiltres = useMemo(() => {
    const q = rechercheCanal.trim().toLowerCase();
    if (!q) return espaces;
    return espaces.filter((e) => (e.nom || '').toLowerCase().includes(q));
  }, [espaces, rechercheCanal]);

  /** Ajoute un message reçu ou envoyé en évitant les doublons (socket vs requête HTTP). */
  const ajouterMessage = useCallback((message: MessageEquipe) => {
    setMessages((prec) =>
      prec.some((m) => m._id === message._id) ? prec : [...prec, message].sort(parDate)
    );
  }, []);

  // Charge l'historique des messages de l'espace sélectionné
  useEffect(() => {
    if (!espaceActif?._id) {
      setMessages([]);
      return;
    }
    let annule = false;
    setChargementMessages(true);
    listerTout(apiMessages, { espaceId: espaceActif._id, sort: 'createdAt' })
      .then((liste) => {
        if (annule) return;
        setMessages(liste.filter((m) => identifiantDe(m.espaceId) === espaceActif._id).sort(parDate));
      })
      .catch(() => {
        if (!annule) setMessages([]);
      })
      .finally(() => {
        if (!annule) setChargementMessages(false);
      });

    return () => {
      annule = true;
    };
  }, [espaceActif?._id]);

  // Écoute en direct les nouveaux messages arrivant dans la room de l'espace
  useEvenementTempsReel<MessageEquipe>('message:nouveau', (message) => {
    if (!message || !espaceActif?._id) return;
    if (identifiantDe(message.espaceId) === espaceActif._id) {
      ajouterMessage(message);
    }
  });

  // Défilement automatique vers le bas à chaque nouveau message
  useEffect(() => {
    const fil = filRef.current;
    if (fil) {
      fil.scrollTop = fil.scrollHeight;
    }
  }, [messages.length]);

  const envoyer = useCallback(async () => {
    const contenu = texte.trim();
    if (!contenu || !espaceActif?._id) return;
    if (!utilisateur) {
      toasts.erreur(t('equipe.connexionRequise'));
      return;
    }
    setEnvoi(true);
    try {
      const cree = await apiMessages.creer({
        espaceId: espaceActif._id,
        contenu,
      } as Partial<MessageEquipe>);
      ajouterMessage(cree);
      setTexte('');
    } catch (e) {
      toasts.erreur(t('equipe.envoiImpossible'), e instanceof Error ? e.message : undefined);
    } finally {
      setEnvoi(false);
    }
  }, [texte, espaceActif?._id, utilisateur, ajouterMessage, toasts, t]);

  const surToucheClavier = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void envoyer();
    }
  };

  if (chargementEspaces) {
    return <Chargement libelle="Chargement de la messagerie…" />;
  }

  return (
    <div
      className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden"
      style={{ backgroundColor: 'var(--fond)' }}
    >
      {/* Colonne latérale gauche : liste des canaux d'espaces (façon Teams) */}
      <aside
        className="flex w-72 shrink-0 flex-col border-r"
        style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-barre)' }}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--bordure)' }}>
          <MessagesSquare className="h-5 w-5 text-sky-500" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold">{t('messagerie.titre')}</h1>
            <p className="truncate text-xs texte-faible">{t('messagerie.canaux')}</p>
          </div>
        </div>

        {/* Champ de recherche de canal */}
        <div className="border-b px-3 py-2" style={{ borderColor: 'var(--bordure)' }}>
          <div className="relative">
            <Search className="texte-faible pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5" />
            <input
              type="text"
              value={rechercheCanal}
              onChange={(e) => setRechercheCanal(e.target.value)}
              placeholder={t('messagerie.rechercheCanal')}
              className="champ h-8 w-full pl-8 text-xs"
            />
          </div>
        </div>

        {/* Liste des canaux */}
        <div className="flex-1 overflow-y-auto p-2">
          {canauxFiltres.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs texte-faible">
              {espaces.length === 0
                ? t('messagerie.aucunCanal')
                : t('messagerie.aucunCanalFiltre')}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {canauxFiltres.map((espace) => {
                const estActif = espaceActif?._id === espace._id;
                return (
                  <button
                    key={espace._id}
                    type="button"
                    onClick={() => setEspaceSelectionneId(espace._id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      estActif
                        ? 'bg-sky-500/10 font-semibold text-sky-600 dark:bg-sky-500/20 dark:text-sky-400'
                        : 'texte-doux hover:bg-black/5 dark:hover:bg-white/5'
                    )}
                  >
                    {espace.icone ? (
                      <IconeDonnee icone={espace.icone} className="h-4 w-4 shrink-0" />
                    ) : (
                      <Hash className="h-4 w-4 shrink-0 texte-faible" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{espace.nom}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* Zone centrale principale : fil de discussion du canal sélectionné */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {espaceActif ? (
          <>
            {/* En-tête du canal */}
            <header
              className="flex shrink-0 items-center justify-between border-b px-6 py-3.5"
              style={{ borderColor: 'var(--bordure)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                {espaceActif.icone ? (
                  <IconeDonnee icone={espaceActif.icone} className="h-6 w-6 shrink-0" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                    <Hash className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-bold">{espaceActif.nom}</h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {t('equipe.enLigne')}
                    </span>
                  </div>
                  {espaceActif.description && (
                    <p className="truncate text-xs texte-faible">{espaceActif.description}</p>
                  )}
                </div>
              </div>
            </header>

            {/* Fil des messages scrollable */}
            <div ref={filRef} className="flex-1 overflow-y-auto px-6 py-6">
              {chargementMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                    <MessagesSquare className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{t('equipe.messagerieVide')}</h3>
                  <p className="mt-1 text-xs texte-faible max-w-sm">
                    {t('messagerie.sousTitre')}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {messages.map((message) => {
                    const estAuteur =
                      utilisateur?._id &&
                      (identifiantDe(message.auteurId) === utilisateur._id ||
                        identifiantDe(message.createdBy) === utilisateur._id);

                    return (
                      <div
                        key={message._id}
                        className={cn(
                          'flex items-start gap-3',
                          estAuteur ? 'flex-row-reverse' : 'flex-row'
                        )}
                      >
                        <Avatar
                          src={message.auteurAvatar}
                          nom={message.auteurNom || 'Membre'}
                          taille="sm"
                        />
                        <div
                          className={cn(
                            'flex max-w-[70%] flex-col gap-1',
                            estAuteur ? 'items-end' : 'items-start'
                          )}
                        >
                          <div className="flex items-center gap-2 text-xs texte-faible">
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                              {estAuteur ? 'Vous' : message.auteurNom || 'Membre'}
                            </span>
                            {message.createdAt && (
                              <span>{formaterDateHeure(message.createdAt)}</span>
                            )}
                          </div>
                          <div
                            className={cn(
                              'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-xs',
                              estAuteur
                                ? 'bg-sky-600 text-white dark:bg-sky-600'
                                : 'border bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                            )}
                            style={estAuteur ? undefined : { borderColor: 'var(--bordure)' }}
                          >
                            {message.contenu}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Compositeur de message inférieur */}
            <footer
              className="border-t p-4"
              style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond)' }}
            >
              <div
                className="flex items-end gap-2 rounded-xl border p-2 shadow-xs transition-colors focus-within:border-sky-500"
                style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-barre)' }}
              >
                <textarea
                  rows={2}
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  onKeyDown={surToucheClavier}
                  placeholder={t('messagerie.placeholder', { nom: espaceActif.nom })}
                  disabled={envoi}
                  className="champ w-full resize-none border-0 bg-transparent p-1.5 text-sm focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => void envoyer()}
                  disabled={envoi || !texte.trim()}
                  className="bouton bouton-primaire h-9 w-9 shrink-0 p-0 rounded-lg flex items-center justify-center disabled:opacity-40"
                  aria-label={t('equipe.envoyer')}
                >
                  {envoi ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <EtatVide
              icone={Building2}
              titre={t('messagerie.selectionnerCanal')}
              description={t('messagerie.aucunCanal')}
            />
          </div>
        )}
      </main>
    </div>
  );
}
