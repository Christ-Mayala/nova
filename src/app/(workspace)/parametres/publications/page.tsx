'use client';

import { Globe, Link2, Pencil, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Bascule } from '@/components/ui/Bascule';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Modale } from '@/components/ui/Modale';
import { useConfirmation } from '@/components/ui/Confirmation';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { listerTout, publications as apiPublications } from '@/lib/api';
import { lienPage } from '@/lib/navigation';
import type { AccesPublication, InvitePublication, Page, PorteePublication, Publication } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Portées de publication (cf. « Publish » de NOVA). */
const PORTEES: Array<{ valeur: PorteePublication; libelle: string; description: string }> = [
  { valeur: 'web', libelle: 'Sur le Web', description: 'N’importe qui disposant du lien.' },
  { valeur: 'personnes', libelle: 'Personnes invitées', description: 'Uniquement les personnes invitées.' },
  { valeur: 'invite', libelle: 'Lien d’invitation', description: 'Accès avec le lien secret.' },
];

/** Niveaux d'accès d'une publication. */
const ACCES: Array<{ valeur: AccesPublication; libelle: string }> = [
  { valeur: 'lecture', libelle: 'Lecture seule' },
  { valeur: 'commentaire', libelle: 'Peut commenter' },
  { valeur: 'edition', libelle: 'Peut modifier' },
  { valeur: 'complet', libelle: 'Accès complet' },
];

interface Brouillon {
  _id?: string;
  pageId: string;
  portee: PorteePublication;
  domaine: string;
  acces: AccesPublication;
  actif: boolean;
  invites: InvitePublication[];
}

/** Publications : rendre des pages accessibles hors de l’espace de travail. */
export default function PageParametresPublications() {
  const { pages, pageParId } = useDonnees();
  const { estAdmin } = useAuth();
  const toasts = useToasts();
  const confirmer = useConfirmation();

  const [publications, setPublications] = useState<Publication[]>([]);
  const [chargement, setChargement] = useState(true);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const charger = useCallback(async () => {
    try {
      const liste = await listerTout(apiPublications, { sort: '-createdAt' });
      setPublications(liste);
    } catch {
      setPublications([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Pages publiables (toutes les pages de l’espace). */
  const pagesDisponibles = useMemo(
    () => pages.slice().sort((a, b) => (a.titre || '').localeCompare(b.titre || '')),
    [pages]
  );

  const ouvrirCreation = useCallback(() => {
    if (!pagesDisponibles.length) {
      toasts.erreur('Créez d’abord une page à publier');
      return;
    }
    setBrouillon({
      pageId: pagesDisponibles[0]._id,
      portee: 'web',
      domaine: '',
      acces: 'lecture',
      actif: true,
      invites: [],
    });
  }, [pagesDisponibles, toasts]);

  const ouvrirEdition = useCallback((publication: Publication) => {
    const pageId =
      typeof publication.pageId === 'string' ? publication.pageId : publication.pageId?._id || '';
    setBrouillon({
      _id: publication._id,
      pageId,
      portee: publication.portee || 'web',
      domaine: publication.domaine || '',
      acces: publication.acces || 'lecture',
      actif: publication.actif !== false,
      invites: (publication.invites || []).map((i) => ({ email: i.email, role: i.role })),
    });
  }, []);

  const enregistrer = useCallback(async () => {
    if (!brouillon) return;
    if (!estAdmin) {
      toasts.erreur('Action réservée aux administrateurs');
      return;
    }
    setEnregistrement(true);
    try {
      const donnees: Partial<Publication> = {
        pageId: brouillon.pageId,
        portee: brouillon.portee,
        domaine: brouillon.domaine.trim(),
        acces: brouillon.acces,
        actif: brouillon.actif,
        invites: brouillon.invites.filter((i) => (i.email || '').trim()),
      };
      if (brouillon._id) {
        await apiPublications.maj(brouillon._id, donnees);
        toasts.succes('Publication mise à jour');
      } else {
        await apiPublications.creer(donnees);
        const nbInvites = donnees.invites?.length || 0;
        toasts.succes(nbInvites ? `Page publiée · ${nbInvites} invitation(s) envoyée(s)` : 'Page publiée');
      }
      setBrouillon(null);
      await charger();
    } catch (e) {
      toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setEnregistrement(false);
    }
  }, [brouillon, estAdmin, charger, toasts]);

  const supprimer = useCallback(
    async (publication: Publication) => {
      if (!estAdmin) {
        toasts.erreur('Action réservée aux administrateurs');
        return;
      }
      const ok = await confirmer({
        titre: 'Dépublier cette page ?',
        message: 'Le lien public cessera immédiatement de fonctionner.',
        libelleConfirmer: 'Dépublier',
        danger: true,
      });
      if (!ok) return;
      try {
        await apiPublications.supprimer(publication._id);
        setPublications((prec) => prec.filter((p) => p._id !== publication._id));
        toasts.succes('Publication retirée');
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [estAdmin, confirmer, toasts]
  );

  const basculerActif = useCallback(
    async (publication: Publication, valeur: boolean) => {
      if (!estAdmin) {
        toasts.erreur('Action réservée aux administrateurs');
        return;
      }
      setPublications((prec) =>
        prec.map((p) => (p._id === publication._id ? { ...p, actif: valeur } : p))
      );
      try {
        await apiPublications.maj(publication._id, { actif: valeur });
      } catch (e) {
        setPublications((prec) =>
          prec.map((p) => (p._id === publication._id ? { ...p, actif: !valeur } : p))
        );
        toasts.erreur('Mise à jour impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [estAdmin, toasts]
  );

  if (chargement) return <Chargement libelle="Chargement des publications…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Publications</h1>
        <span className="etiquette" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          {publications.length}
        </span>
        {estAdmin && (
          <button type="button" onClick={ouvrirCreation} className="bouton bouton-primaire ml-auto gap-1.5">
            <Plus className="h-4 w-4" />
            Publier une page
          </button>
        )}
      </div>

      {publications.length === 0 ? (
        <EtatVide
          icone={Globe}
          titre="Aucune page publiée"
          description="Partagez une page sur le Web, avec des personnes invitées ou via un lien secret."
          action={
            estAdmin ? (
              <button type="button" onClick={ouvrirCreation} className="bouton bouton-primaire gap-1.5">
                <Plus className="h-4 w-4" />
                Publier une page
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {publications.map((publication) => {
            const page = resoudrePage(publication, pageParId);
            return (
              <li key={publication._id} className="carte group flex items-center gap-3 p-3.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'var(--fond-secondaire)' }}
                >
                  <IconeDonnee icone={page?.icone} repli={Globe} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {page ? (
                      <Link href={lienPage(page)} className="truncate font-medium hover:underline">
                        {page.titre}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">Page introuvable</span>
                    )}
                    <BadgePortee portee={publication.portee || 'web'} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 truncate text-sm texte-doux">
                    {publication.domaine ? (
                      <span className="flex items-center gap-1">
                        <Link2 className="h-3.5 w-3.5" />
                        {publication.domaine}
                      </span>
                    ) : (
                      <span>Lien interne</span>
                    )}
                    <span>·</span>
                    <span>{libelleAcces(publication.acces)}</span>
                    {publication.invites && publication.invites.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {publication.invites.length}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Bascule
                    actif={publication.actif !== false}
                    desactive={!estAdmin}
                    libelle="Activer la publication"
                    onChange={(valeur) => basculerActif(publication, valeur)}
                  />
                  {estAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => ouvrirEdition(publication)}
                        className="bouton p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        aria-label="Modifier la publication"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => supprimer(publication)}
                        className="bouton p-1.5 text-red-600 opacity-0 transition-opacity hover:bg-red-50 group-hover:opacity-100 focus:opacity-100 dark:text-red-400 dark:hover:bg-red-950/40"
                        aria-label="Dépublier"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modale
        ouvert={Boolean(brouillon)}
        onFermer={() => setBrouillon(null)}
        titre={brouillon?._id ? 'Modifier la publication' : 'Publier une page'}
        description="Choisissez qui peut accéder à cette page en dehors de l’espace."
        pied={
          <>
            <button type="button" className="bouton" onClick={() => setBrouillon(null)}>
              Annuler
            </button>
            <button
              type="button"
              className="bouton bouton-primaire"
              onClick={enregistrer}
              disabled={enregistrement}
            >
              {brouillon?._id ? 'Enregistrer' : 'Publier'}
            </button>
          </>
        }
      >
        {brouillon && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Page</span>
              <select
                className="champ"
                value={brouillon.pageId}
                disabled={Boolean(brouillon._id)}
                onChange={(e) => setBrouillon((b) => (b ? { ...b, pageId: e.target.value } : b))}
              >
                {pagesDisponibles.map((page) => (
                  <option key={page._id} value={page._id}>
                    {page.titre || 'Sans titre'}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium texte-doux">Portée</span>
              <div className="flex flex-col gap-1.5">
                {PORTEES.map((option) => (
                  <button
                    key={option.valeur}
                    type="button"
                    onClick={() => setBrouillon((b) => (b ? { ...b, portee: option.valeur } : b))}
                    className={cn(
                      'flex flex-col items-start rounded-md px-3 py-2 text-left transition-colors',
                      brouillon.portee === option.valeur ? 'ring-1 ring-sky-400' : ''
                    )}
                    style={{ backgroundColor: 'var(--fond-secondaire)' }}
                  >
                    <span className="text-sm font-medium">{option.libelle}</span>
                    <span className="text-xs texte-doux">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium texte-doux">Domaine public</span>
                <input
                  className="champ"
                  value={brouillon.domaine}
                  placeholder="ma-page.nova.app"
                  onChange={(e) => setBrouillon((b) => (b ? { ...b, domaine: e.target.value } : b))}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium texte-doux">Accès</span>
                <select
                  className="champ"
                  value={brouillon.acces}
                  onChange={(e) =>
                    setBrouillon((b) => (b ? { ...b, acces: e.target.value as AccesPublication } : b))
                  }
                >
                  {ACCES.map((option) => (
                    <option key={option.valeur} value={option.valeur}>
                      {option.libelle}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {brouillon.portee !== 'web' && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium texte-doux">Personnes invitées</span>
                {brouillon.invites.map((invite, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      className="champ flex-1"
                      value={invite.email || ''}
                      placeholder="adresse@exemple.fr"
                      onChange={(e) =>
                        setBrouillon((b) =>
                          b
                            ? {
                                ...b,
                                invites: b.invites.map((it, i) =>
                                  i === index ? { ...it, email: e.target.value } : it
                                ),
                              }
                            : b
                        )
                      }
                    />
                    <select
                      className="champ w-40"
                      value={invite.role || 'lecteur'}
                      onChange={(e) =>
                        setBrouillon((b) =>
                          b
                            ? {
                                ...b,
                                invites: b.invites.map((it, i) =>
                                  i === index ? { ...it, role: e.target.value } : it
                                ),
                              }
                            : b
                        )
                      }
                    >
                      <option value="lecteur">Lecteur</option>
                      <option value="commentateur">Commentateur</option>
                      <option value="editeur">Éditeur</option>
                    </select>
                    <button
                      type="button"
                      className="bouton p-1.5"
                      aria-label="Retirer l’invité"
                      onClick={() =>
                        setBrouillon((b) =>
                          b ? { ...b, invites: b.invites.filter((_, i) => i !== index) } : b
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="bouton w-fit gap-1.5 text-sm"
                  onClick={() =>
                    setBrouillon((b) =>
                      b ? { ...b, invites: [...b.invites, { email: '', role: 'lecteur' }] } : b
                    )
                  }
                >
                  <UserPlus className="h-4 w-4" />
                  Ajouter une personne
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm">Publication active</span>
              <Bascule
                actif={brouillon.actif}
                libelle="Activer la publication"
                onChange={(valeur) => setBrouillon((b) => (b ? { ...b, actif: valeur } : b))}
              />
            </div>
          </div>
        )}
      </Modale>
    </div>
  );
}

/** Retrouve la page d'une publication (référence peuplée ou identifiant). */
function resoudrePage(
  publication: Publication,
  pageParId: (id: string) => Page | undefined
): Page | undefined {
  const ref = publication.pageId;
  if (ref && typeof ref === 'object') return ref as Page;
  return typeof ref === 'string' ? pageParId(ref) : undefined;
}

/** Libellé français du niveau d'accès. */
function libelleAcces(acces?: AccesPublication): string {
  return ACCES.find((a) => a.valeur === acces)?.libelle || 'Lecture seule';
}

/** Pastille de portée d'une publication. */
function BadgePortee({ portee }: { portee: PorteePublication }) {
  const libelle = PORTEES.find((p) => p.valeur === portee)?.libelle || 'Sur le Web';
  const publique = portee === 'web';
  return (
    <span
      className={cn(
        'etiquette px-1.5 py-0.5 text-[11px]',
        publique
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'texte-doux'
      )}
      style={publique ? undefined : { backgroundColor: 'var(--fond-secondaire)' }}
    >
      {libelle}
    </span>
  );
}
