'use client';

import { Check, MessageSquare, Send, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useEvenementTempsReel } from '@/context/TempsReelContext';
import { commentaires as apiCommentaires, listerTout } from '@/lib/api';
import type { Commentaire } from '@/lib/types';
import { cn, formaterDateRelative } from '@/lib/utils';

/** Panneau de commentaires attachés à une page (liste, ajout, résolution). */
export function PanneauCommentaires({
  pageId,
  onFermer,
}: {
  pageId: string;
  onFermer?: () => void;
}) {
  const { utilisateur, peutCommenter } = useAuth();
  const toasts = useToasts();
  const [liste, setListe] = useState<Commentaire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const trouves = await listerTout(apiCommentaires, { pageId, sort: 'createdAt' });
      setListe(trouves.filter((c) => c.pageId === pageId || !c.pageId));
    } catch {
      setListe([]);
    } finally {
      setChargement(false);
    }
  }, [pageId]);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Applique un commentaire reçu en temps réel (création ou mise à jour). */
  const appliquerCommentaireTempsReel = useCallback(
    (commentaire: Commentaire, remplacement: boolean) => {
      if (String(commentaire.pageId || '') !== pageId) return;
      setListe((prec) => {
        const index = prec.findIndex((c) => c._id === commentaire._id);
        if (index === -1) return [...prec, commentaire];
        if (!remplacement) return prec;
        const copie = prec.slice();
        copie[index] = { ...copie[index], ...commentaire };
        return copie;
      });
    },
    [pageId]
  );

  useEvenementTempsReel<Commentaire>('commentaire:nouveau', (commentaire) =>
    appliquerCommentaireTempsReel(commentaire, false)
  );
  useEvenementTempsReel<Commentaire>('commentaire:maj', (commentaire) =>
    appliquerCommentaireTempsReel(commentaire, true)
  );

  async function envoyer() {
    const contenu = texte.trim();
    if (!contenu) return;
    if (!peutCommenter) {
      toasts.erreur('Commentaire non autorisé pour votre rôle');
      return;
    }
    setEnvoi(true);
    try {
      const cree = await apiCommentaires.creer({
        pageId,
        auteurNom: utilisateur?.name || utilisateur?.nom || utilisateur?.email || 'Moi',
        auteurAvatar: utilisateur?.avatarUrl || null,
        contenu,
        resolu: false,
      } as Partial<Commentaire>);
      setListe((prec) => [...prec, cree]);
      setTexte('');
    } catch (e) {
      toasts.erreur('Envoi impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnvoi(false);
    }
  }

  async function basculerResolution(commentaire: Commentaire) {
    if (!peutCommenter) return;
    try {
      await apiCommentaires.maj(commentaire._id, { resolu: !commentaire.resolu });
      setListe((prec) =>
        prec.map((c) => (c._id === commentaire._id ? { ...c, resolu: !c.resolu } : c))
      );
    } catch {
      toasts.erreur('Action impossible');
    }
  }

  const actifs = liste.filter((c) => !c.resolu);
  const resolus = liste.filter((c) => c.resolu);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--bordure)' }}>
        <MessageSquare className="h-4 w-4 texte-faible" />
        <h3 className="text-sm font-semibold">Commentaires</h3>
        <span className="texte-faible text-xs">({actifs.length})</span>
        {onFermer && (
          <button
            type="button"
            onClick={onFermer}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Fermer les commentaires"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 defilement-fin">
        {chargement ? (
          <Chargement libelle="Chargement…" />
        ) : liste.length === 0 ? (
          <EtatVide
            icone={MessageSquare}
            titre="Aucun commentaire"
            description="Discutez avec votre équipe directement sur la page."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {actifs.map((commentaire) => (
              <CarteCommentaire
                key={commentaire._id}
                commentaire={commentaire}
                onResoudre={() => basculerResolution(commentaire)}
              />
            ))}
            {resolus.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-medium texte-faible">Résolus</p>
                <div className="flex flex-col gap-3 opacity-60">
                  {resolus.map((commentaire) => (
                    <CarteCommentaire
                      key={commentaire._id}
                      commentaire={commentaire}
                      onResoudre={() => basculerResolution(commentaire)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t p-3" style={{ borderColor: 'var(--bordure)' }}>
        <div className="flex items-end gap-2">
          <Avatar
            src={utilisateur?.avatarUrl}
            nom={utilisateur?.name || utilisateur?.nom || utilisateur?.email}
            taille="sm"
          />
          <textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                envoyer();
              }
            }}
            rows={2}
            placeholder="Écrire un commentaire…"
            className="champ min-h-[38px] resize-none"
          />
          <button
            type="button"
            onClick={envoyer}
            disabled={envoi || !texte.trim()}
            className="bouton bouton-primaire shrink-0 p-2"
            aria-label="Envoyer le commentaire"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Carte d'un commentaire. */
function CarteCommentaire({
  commentaire,
  onResoudre,
}: {
  commentaire: Commentaire;
  onResoudre: () => void;
}) {
  return (
    <div className="flex gap-2.5">
      <Avatar
        src={commentaire.auteurAvatar}
        nom={commentaire.auteurNom}
        taille="sm"
        className={cn(commentaire.resolu && 'opacity-60')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{commentaire.auteurNom}</span>
          <span className="shrink-0 text-xs texte-faible">
            {formaterDateRelative(commentaire.createdAt)}
          </span>
        </div>
        <p className={cn('mt-0.5 whitespace-pre-wrap text-sm', commentaire.resolu && 'line-through texte-doux')}>
          {commentaire.contenu}
        </p>
        <button
          type="button"
          onClick={onResoudre}
          className="mt-1 inline-flex items-center gap-1 text-xs texte-doux hover:texte"
        >
          {commentaire.resolu ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          {commentaire.resolu ? 'Rouvrir' : 'Résoudre'}
        </button>
      </div>
    </div>
  );
}
