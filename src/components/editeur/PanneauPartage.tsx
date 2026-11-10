'use client';

import { Building2, Check, Copy, Globe, Link2, Loader2, Lock, Send, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Bascule } from '@/components/ui/Bascule';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { listerTout, pages as apiPages, publications as apiPublications } from '@/lib/api';
import type { AccesPublication, InvitePublication, Page, PorteePublication, Publication } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

/** Panneau de partage et de publication d'une page. */
export function PanneauPartage({
  page,
  onFermer,
  onPageChange,
}: {
  page: Page;
  onFermer: () => void;
  /** Notifie la vue parente d'un changement de la page (emplacement, partage). */
  onPageChange?: (patch: Partial<Page>) => void;
}) {
  const { peutPartager } = useAuth();
  const { espaces, rafraichir, majPageLocale } = useDonnees();
  const toasts = useToasts();
  const [publication, setPublication] = useState<Publication | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [deplacement, setDeplacement] = useState(false);
  const [emailInvite, setEmailInvite] = useState('');

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const trouves = await listerTout(apiPublications, { sort: '-createdAt' });
      const existante = trouves.find((p) => idPage(p) === page._id) || null;
      setPublication(existante);
      // Aligne le bandeau de la page sur l'état réel de publication.
      appliquerPage({ publie: Boolean(existante?.actif) });
    } catch {
      setPublication(null);
    } finally {
      setChargement(false);
    }
  }, [page._id]);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Crée ou met à jour la publication. */
  async function enregistrer(patch: Partial<Publication>) {
    if (!peutPartager) {
      toasts.erreur('Partage non autorisé pour votre rôle');
      return;
    }
    setEnregistrement(true);
    try {
      let resultat: Publication;
      if (publication) {
        resultat = await apiPublications.maj(publication._id, patch);
      } else {
        resultat = await apiPublications.creer({
          pageId: page._id,
          portee: 'web',
          acces: 'lecture',
          actif: false,
          invites: [],
          ...patch,
        } as Partial<Publication>);
      }
      setPublication(resultat);
      // Reflète immédiatement l'état de partage sur la page : le bandeau
      // « Publié sur le Web / Privé » doit suivre sans rechargement.
      if ('actif' in patch || !publication) {
        appliquerPage({ publie: Boolean(resultat.actif) });
      }
      toasts.succes('Partage mis à jour');
    } catch (e) {
      toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnregistrement(false);
    }
  }

  /** Met à jour la page à la fois dans la vue locale et dans le contexte global. */
  function appliquerPage(patch: Partial<Page>) {
    majPageLocale(page._id, patch);
    onPageChange?.(patch);
  }

  async function ajouterInvite() {
    const email = emailInvite.trim();
    if (!email) return;
    const invites: InvitePublication[] = [...(publication?.invites || []), { email, role: 'lecture' }];
    await enregistrer({ invites });
    setEmailInvite('');
  }

  async function retirerInvite(email: string) {
    const invites = (publication?.invites || []).filter((i) => i.email !== email);
    await enregistrer({ invites });
  }

  const espaceCourant = identifiantDe(page.espaceId);
  /** Emplacement courant : identifiant d'espace d'équipe, sinon « prive ». */
  const emplacement =
    espaceCourant && espaces.some((e) => e._id === espaceCourant) ? espaceCourant : 'prive';

  /**
   * Déplace la page dans un espace d'équipe (ou la repasse en privé). Le
   * changement d'`espaceId` s'accompagne du `section` correspondant pour que la
   * page apparaisse au bon endroit dans la barre latérale.
   */
  async function deplacerVers(valeur: string) {
    if (valeur === emplacement) return;
    if (!peutPartager) {
      toasts.erreur('Partage non autorisé pour votre rôle');
      return;
    }
    setDeplacement(true);
    try {
      const patch: Partial<Page> = {
        espaceId: valeur === 'prive' ? null : valeur,
        section: valeur === 'prive' ? 'prive' : 'equipe',
      };
      await apiPages.maj(page._id, patch);
      // Effet immédiat : la sélection, l'arbre latéral et le fil d'Ariane
      // reflètent le nouvel emplacement sans rechargement manuel.
      appliquerPage(patch);
      await rafraichir();
      toasts.succes(
        valeur === 'prive' ? 'Page déplacée dans votre espace privé' : 'Page déplacée dans l’espace d’équipe'
      );
    } catch (e) {
      toasts.erreur('Déplacement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setDeplacement(false);
    }
  }

  const lienPublic = publication?.domaine
    ? `https://${publication.domaine}/${page._id}`
    : `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${page._id}`;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Fermer le partage" onClick={onFermer} />
      <div
        className="relative flex h-full w-full max-w-md animate-glissement flex-col shadow-2xl"
        style={{ backgroundColor: 'var(--fond)' }}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--bordure)' }}>
          <Send className="h-4 w-4 texte-faible" />
          <h3 className="text-sm font-semibold">Partager</h3>
          <button
            type="button"
            onClick={onFermer}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 defilement-fin">
          {chargement ? (
            <div className="flex items-center justify-center py-10 texte-doux">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Emplacement : espace d'équipe ou espace privé */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 texte-faible" />
                  <h4 className="text-xs font-semibold texte-doux">Emplacement</h4>
                </div>
                <select
                  className="champ"
                  value={emplacement}
                  disabled={deplacement || espaces.length === 0}
                  onChange={(e) => deplacerVers(e.target.value)}
                >
                  <option value="prive">Privé (moi uniquement)</option>
                  {espaces.map((espace) => (
                    <option key={espace._id} value={espace._id}>
                      {espace.nom}
                    </option>
                  ))}
                </select>
                <p className="text-xs texte-faible">
                  Déplacer la page dans un espace d’équipe la rend visible par les membres de cet espace.
                </p>
              </section>

              {/* Publication web */}
              <section className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: 'var(--fond-secondaire)' }}
                  >
                    <Globe className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Publier sur le Web</p>
                    <p className="mt-0.5 text-xs texte-doux">
                      Rendre cette page accessible à toute personne disposant du lien.
                    </p>
                  </div>
                  <Bascule
                    actif={Boolean(publication?.actif)}
                    desactive={enregistrement}
                    onChange={(valeur) => enregistrer({ actif: valeur })}
                    libelle="Publier sur le Web"
                  />
                </div>

                {publication?.actif && (
                  <div className="flex flex-col gap-3 rounded-md p-3" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium texte-doux">Portée</span>
                      <select
                        className="champ"
                        value={publication.portee || 'web'}
                        onChange={(e) => enregistrer({ portee: e.target.value as PorteePublication })}
                      >
                        <option value="web">Web (public)</option>
                        <option value="personnes">Personnes invitées</option>
                        <option value="invite">Invités uniquement</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium texte-doux">Niveau d’accès</span>
                      <select
                        className="champ"
                        value={publication.acces || 'lecture'}
                        onChange={(e) => enregistrer({ acces: e.target.value as AccesPublication })}
                      >
                        <option value="lecture">Lecture seule</option>
                        <option value="commentaire">Lecture et commentaire</option>
                        <option value="edition">Édition du contenu</option>
                        <option value="complet">Accès complet</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium texte-doux">Domaine personnalisé</span>
                      <input
                        className="champ"
                        placeholder="wiki.mon-entreprise.fr"
                        defaultValue={publication.domaine || ''}
                        onBlur={(e) => enregistrer({ domaine: e.target.value.trim() })}
                      />
                    </label>
                    <BoutonCopier valeur={lienPublic} />
                  </div>
                )}
              </section>

              {/* Invitations */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 texte-faible" />
                  <h4 className="text-xs font-semibold texte-doux">Inviter des personnes</h4>
                </div>
                <div className="flex gap-2">
                  <input
                    className="champ"
                    type="email"
                    placeholder="nom@exemple.fr"
                    value={emailInvite}
                    onChange={(e) => setEmailInvite(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') ajouterInvite();
                    }}
                  />
                  <button
                    type="button"
                    onClick={ajouterInvite}
                    disabled={!emailInvite.trim() || enregistrement}
                    className="bouton bouton-primaire shrink-0 gap-1.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    Inviter
                  </button>
                </div>

                {(publication?.invites?.length || 0) === 0 ? (
                  <p className="text-xs texte-faible">Aucune personne invitée pour le moment.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {publication?.invites?.map((invite) => (
                      <li
                        key={invite.email}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5"
                        style={{ backgroundColor: 'var(--fond-secondaire)' }}
                      >
                        <Link2 className="h-3.5 w-3.5 shrink-0 texte-faible" />
                        <span className="min-w-0 flex-1 truncate text-sm">{invite.email}</span>
                        <span className="shrink-0 text-xs texte-doux capitalize">{invite.role || 'lecture'}</span>
                        <button
                          type="button"
                          onClick={() => retirerInvite(invite.email || '')}
                          className="shrink-0 rounded p-0.5 texte-faible hover:bg-black/5 dark:hover:bg-white/10"
                          aria-label="Retirer l’invité"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Bouton de copie du lien public. */
function BoutonCopier({ valeur }: { valeur: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valeur);
          setCopie(true);
          setTimeout(() => setCopie(false), 1800);
        } catch {
          /* presse-papiers indisponible */
        }
      }}
      className={cn('bouton justify-between gap-2 text-xs')}
      style={{ backgroundColor: 'var(--fond)', border: '1px solid var(--bordure-forte)' }}
    >
      <span className="truncate">{valeur}</span>
      {copie ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Extrait l'identifiant de page d'une publication (référence peuplée ou brute). */
function idPage(publication: Publication): string {
  const ref = publication.pageId;
  return typeof ref === 'string' ? ref : ref._id;
}
