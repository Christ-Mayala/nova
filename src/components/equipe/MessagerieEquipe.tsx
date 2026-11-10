'use client';

import { Loader2, MessagesSquare, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useLangue } from '@/context/LangueContext';
import { useEvenementTempsReel } from '@/context/TempsReelContext';
import { listerTout, messages as apiMessages } from '@/lib/api';
import type { MessageEquipe } from '@/lib/types';
import { cn, formaterDateHeure, identifiantDe } from '@/lib/utils';

/** Ordre chronologique : du message le plus ancien au plus récent. */
function parDate(a: MessageEquipe, b: MessageEquipe): number {
  return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
}

/**
 * Messagerie d'un espace d'équipe, en temps réel. Les messages sont chargés à
 * l'ouverture puis complétés par l'événement socket `message:nouveau` diffusé
 * aux membres connectés de la room `equipe:<id>`.
 */
export function MessagerieEquipe({ espaceId }: { espaceId: string }) {
  const { utilisateur } = useAuth();
  const { t } = useLangue();
  const toasts = useToasts();

  const [messages, setMessages] = useState<MessageEquipe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const listeRef = useRef<HTMLDivElement | null>(null);

  /** Ajoute un message s'il n'est pas déjà présent (évite le doublon socket + POST). */
  const ajouter = useCallback((message: MessageEquipe) => {
    setMessages((prec) =>
      prec.some((m) => m._id === message._id) ? prec : [...prec, message].sort(parDate)
    );
  }, []);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    listerTout(apiMessages, { espaceId, sort: 'createdAt' })
      .then((liste) => {
        if (annule) return;
        setMessages(liste.filter((m) => identifiantDe(m.espaceId) === espaceId).sort(parDate));
      })
      .catch(() => {
        if (!annule) setMessages([]);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [espaceId]);

  useEvenementTempsReel<MessageEquipe>('message:nouveau', (message) => {
    if (!message || identifiantDe(message.espaceId) !== espaceId) return;
    ajouter(message);
  });

  /* Défilement automatique vers le dernier message. */
  useEffect(() => {
    const liste = listeRef.current;
    if (liste) liste.scrollTop = liste.scrollHeight;
  }, [messages.length]);

  const envoyer = useCallback(async () => {
    const contenu = texte.trim();
    if (!contenu) return;
    if (!utilisateur) {
      toasts.erreur(t('equipe.connexionRequise'));
      return;
    }
    setEnvoi(true);
    try {
      const cree = await apiMessages.creer({ espaceId, contenu } as Partial<MessageEquipe>);
      ajouter(cree);
      setTexte('');
    } catch (e) {
      toasts.erreur(t('equipe.envoiImpossible'), e instanceof Error ? e.message : undefined);
    } finally {
      setEnvoi(false);
    }
  }, [texte, utilisateur, espaceId, ajouter, toasts, t]);

  return (
    <section className="carte flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--bordure)' }}>
        <MessagesSquare className="h-4 w-4 texte-faible" />
        <h2 className="text-sm font-semibold">{t('equipe.messagerieTitre')}</h2>
      </div>

      <div
        ref={listeRef}
        className="flex min-h-[12rem] max-h-96 flex-col gap-3 overflow-y-auto px-5 py-4"
      >
        {chargement ? (
          <p className="text-sm texte-faible">…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm texte-doux">{t('equipe.messagerieVide')}</p>
        ) : (
          messages.map((m) => {
            const moi = Boolean(utilisateur && String(m.auteurId) === String(utilisateur._id));
            return (
              <div key={m._id} className={cn('flex items-start gap-2', moi && 'flex-row-reverse')}>
                <Avatar src={m.auteurAvatar} nom={m.auteurNom} taille="sm" />
                <div
                  className="max-w-[75%] rounded-lg px-3 py-2"
                  style={{ backgroundColor: 'var(--fond-secondaire)' }}
                >
                  <div className={cn('flex items-baseline gap-2', moi && 'flex-row-reverse')}>
                    <span className="text-xs font-semibold">{m.auteurNom || '—'}</span>
                    <span className="text-[10px] texte-faible">{formaterDateHeure(m.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm">{m.contenu}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-end gap-2 border-t px-3 py-3" style={{ borderColor: 'var(--bordure)' }}>
        <textarea
          className="champ max-h-32 min-h-[2.5rem] flex-1 resize-none"
          rows={1}
          value={texte}
          placeholder={t('equipe.messagePlaceholder')}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void envoyer();
            }
          }}
        />
        <button
          type="button"
          className="bouton bouton-primaire"
          onClick={() => void envoyer()}
          disabled={envoi || !texte.trim()}
          aria-label={t('equipe.envoyer')}
        >
          {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}
