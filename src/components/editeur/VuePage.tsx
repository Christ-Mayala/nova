'use client';

import {
  Clock,
  ImagePlus,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Send,
  Star,
  Trash2,
  Copy,
  Link2,
  FileText,
  History,
  RotateCcw,
  Save,
  Table,
  Unlock,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { VueBase } from '@/components/base/VueBase';
import { PanneauCommentaires } from '@/components/editeur/PanneauCommentaires';
import { PanneauPartage } from '@/components/editeur/PanneauPartage';
import { EditeurBlocs } from '@/components/editeur/EditeurBlocs';
import { FournisseurLectureSeule } from '@/components/editeur/BlocEditeur';
import { ChampAuto } from '@/components/editeur/ChampAuto';
import { BandeauErreur, Chargement } from '@/components/ui/Etats';
import { InfoBulles } from '@/components/ui/InfoBulles';
import { Menu, MenuElement, MenuSeparateur } from '@/components/ui/Menu';
import { Modale } from '@/components/ui/Modale';
import { SelecteurIcone } from '@/components/ui/SelecteurIcone';
import { useConfirmation } from '@/components/ui/Confirmation';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import {
  bases as apiBases,
  blocs as apiBlocs,
  listerTout,
  medias,
  pages as apiPages,
  versions as apiVersions,
} from '@/lib/api';
import { lienPage } from '@/lib/navigation';
import type { Base as BaseDonnees, Bloc, Page, VersionPage } from '@/lib/types';
import { cn, formaterDateHeure, identifiantDe, nomUtilisateur } from '@/lib/utils';

/**
 * Couvertures proposées par défaut dans la modale.
 * Ce sont des dégradés CSS : ils s'affichent toujours (aucune connexion
 * Internet ni image distante requise) et restent nets à toutes les tailles.
 */
const COUVERTURES_PROPOSEES: Array<{ nom: string; valeur: string }> = [
  { nom: 'Aurore', valeur: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { nom: 'Océan', valeur: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)' },
  { nom: 'Forêt', valeur: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' },
  { nom: 'Crépuscule', valeur: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)' },
  { nom: 'Sable', valeur: 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)' },
  { nom: 'Nuit', valeur: 'linear-gradient(135deg, #232526 0%, #414345 100%)' },
  { nom: 'Pastel', valeur: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
  { nom: 'Violet', valeur: 'linear-gradient(135deg, #8e2de2 0%, #4a00e0 100%)' },
  { nom: 'Corail', valeur: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)' },
];

/** Une couverture est-elle un dégradé CSS (plutôt qu'une URL d'image) ? */
function estDegrade(valeur?: string): boolean {
  return Boolean(valeur && /^\s*(linear|radial|conic)-gradient\(/i.test(valeur));
}

/** Traduit l'alignement vertical en `object-position` CSS. */
function positionImage(position?: Page['couverturePosition']): string {
  if (position === 'haut') return 'top';
  if (position === 'bas') return 'bottom';
  return 'center';
}

/** Vue d'une page : en-tête (icône, couverture, titre), contenu et panneaux. */
export function VuePage({ pageId }: { pageId: string }) {
  const { pageParId, rafraichir, estFavori, basculerFavori, majPageLocale, chargement: chargementDonnees } = useDonnees();
  const { utilisateur, peutEditer } = useAuth();
  const toasts = useToasts();
  const confirmer = useConfirmation();
  const router = useRouter();

  const [page, setPage] = useState<Page | null>(null);
  const [base, setBase] = useState<BaseDonnees | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [commentairesOuverts, setCommentairesOuverts] = useState(false);
  const [partageOuvert, setPartageOuvert] = useState(false);
  const [historiqueOuvert, setHistoriqueOuvert] = useState(false);
  const [etatTitre, setEtatTitre] = useState<'inactif' | 'en_cours' | 'enregistre' | 'erreur'>('inactif');
  const [versionsListe, setVersionsListe] = useState<VersionPage[]>([]);
  const [chargementVersions, setChargementVersions] = useState(false);
  const [versionEnCours, setVersionEnCours] = useState<string | null>(null);
  const [cleEdition, setCleEdition] = useState(0);
  const [couvertureOuverte, setCouvertureOuverte] = useState(false);
  const [urlCouverture, setUrlCouverture] = useState('');
  const [envoiCouverture, setEnvoiCouverture] = useState(false);
  const fichierCouverture = useRef<HTMLInputElement>(null);
  const minuteurTitre = useRef<ReturnType<typeof setTimeout>>();
  const titreEnAttente = useRef<Partial<Page> | null>(null);
  const flushTitreRef = useRef<() => void>(() => undefined);

  /** Page verrouillée : consultation seule, aucune modification possible. */
  const verrouillee = Boolean(page?.verrouillee);
  const lireSeulement = !peutEditer || verrouillee;

  // La recherche dans le contexte est gardée dans une réf : `charger` reste
  // ainsi stable entre deux rafraîchissements de l'arbre (une mise à jour de
  // titre ne doit pas relancer le chargement complet de la page).
  const pageParIdRef = useRef(pageParId);
  useEffect(() => {
    pageParIdRef.current = pageParId;
  }, [pageParId]);

  /* Charge la page (depuis le contexte si possible) et sa base éventuelle. */
  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      let trouvee = pageParIdRef.current(pageId);
      if (!trouvee) trouvee = await apiPages.obtenir(pageId);
      setPage(trouvee);

      const listeBases = await listerTout(apiBases, { pageId });
      const associee = listeBases.find((b) => b.pageId === pageId) || null;
      setBase(associee);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Page introuvable.');
      setPage(null);
    } finally {
      setChargement(false);
    }
  }, [pageId]);

  useEffect(() => {
    charger();
  }, [charger]);

  /* Marque la page comme récemment consultée (écriture réservée aux admins). */
  useEffect(() => {
    if (!page || lireSeulement) return;
    apiPages.maj(page._id, { derniereVisite: new Date().toISOString() }).catch(() => undefined);
  }, [page?._id, lireSeulement]);

  /** Enregistre une modification de la page avec un léger différé. */
  const majPage = useCallback(
    (patch: Partial<Page>, differe = false) => {
      if (!peutEditer || !page) {
        toasts.erreur('Connexion requise');
        return;
      }
      setPage((prec) => (prec ? { ...prec, ...patch } : prec));
      const envoyer = async (donnees: Partial<Page>) => {
        try {
          setEtatTitre('en_cours');
          await apiPages.maj(page._id, donnees);
          setEtatTitre('enregistre');
          // L'arbre des pages (barre latérale) lit le titre depuis le contexte :
          // on le met à jour localement pour éviter un rechargement manuel.
          majPageLocale(page._id, donnees);
        } catch (e) {
          setEtatTitre('erreur');
          toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
        }
      };
      if (!differe) {
        void envoyer(patch);
        return;
      }
      titreEnAttente.current = { ...(titreEnAttente.current || {}), ...patch };
      if (minuteurTitre.current) clearTimeout(minuteurTitre.current);
      minuteurTitre.current = setTimeout(() => {
        const donnees = titreEnAttente.current || patch;
        titreEnAttente.current = null;
        void envoyer(donnees);
      }, 600);
    },
    [peutEditer, page, majPageLocale, toasts]
  );

  /** Envoie immédiatement une éventuelle modification de titre en attente. */
  const flushTitre = useCallback(() => {
    if (minuteurTitre.current) {
      clearTimeout(minuteurTitre.current);
      minuteurTitre.current = undefined;
    }
    const donnees = titreEnAttente.current;
    if (!donnees || !page) return;
    titreEnAttente.current = null;
    setEtatTitre('en_cours');
    void apiPages
      .maj(page._id, donnees)
      .then(() => {
        setEtatTitre('enregistre');
        majPageLocale(page._id, donnees);
      })
      .catch((e) => {
        setEtatTitre('erreur');
        toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
      });
  }, [page, majPageLocale, toasts]);

  /** Ouvre la modale de couverture en repartant de l'URL actuelle. */
  const ouvrirCouverture = useCallback(() => {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    setUrlCouverture(page?.couverture || '');
    setCouvertureOuverte(true);
  }, [peutEditer, page?.couverture, toasts]);

  /** Applique une couverture (URL distante ou média téléversé). */
  const appliquerCouverture = useCallback(
    (url: string) => {
      const propre = url.trim();
      if (!propre) return;
      majPage({ couverture: propre });
      setCouvertureOuverte(false);
    },
    [majPage]
  );

  /** Téléverse un fichier image puis l'utilise comme couverture. */
  const televerserCouverture = useCallback(
    async (fichier: File) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      setEnvoiCouverture(true);
      try {
        const reponse = await medias.televerser(fichier);
        const url = reponse.data?.url;
        if (!url) throw new Error('Le serveur n’a renvoyé aucune URL.');
        appliquerCouverture(url);
        toasts.succes('Couverture mise à jour');
      } catch (e) {
        toasts.erreur('Téléversement impossible', e instanceof Error ? e.message : undefined);
      } finally {
        setEnvoiCouverture(false);
        if (fichierCouverture.current) fichierCouverture.current.value = '';
      }
    },
    [peutEditer, appliquerCouverture, toasts]
  );

  useEffect(() => {
    flushTitreRef.current = flushTitre;
  }, [flushTitre]);

  useEffect(() => {
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') flushTitreRef.current();
    };
    const surAvantQuitter = () => flushTitreRef.current();
    document.addEventListener('visibilitychange', surVisibilite);
    window.addEventListener('beforeunload', surAvantQuitter);
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite);
      window.removeEventListener('beforeunload', surAvantQuitter);
      flushTitreRef.current();
    };
  }, []);

  useEffect(() => {
    if (!historiqueOuvert || !page) return;
    let annule = false;
    setChargementVersions(true);
    listerTout(apiVersions, { pageId: page._id, sort: '-createdAt' })
      .then((liste) => {
        if (!annule) setVersionsListe(liste);
      })
      .catch(() => {
        if (!annule) setVersionsListe([]);
      })
      .finally(() => {
        if (!annule) setChargementVersions(false);
      });
    return () => {
      annule = true;
    };
  }, [historiqueOuvert, page?._id]);

  const enregistrerVersion = useCallback(async () => {
    if (!page) return;
    setVersionEnCours('nouvelle');
    try {
      const blocs = await listerTout(apiBlocs, { pageId: page._id, sort: 'ordre' });
      const cree = await apiVersions.creer({
        pageId: page._id,
        titre: page.titre,
        icone: page.icone,
        couverture: page.couverture,
        publie: page.publie,
        auteurNom: utilisateur ? nomUtilisateur(utilisateur) || utilisateur.email : null,
        blocs: blocs.map((bloc) => ({
          type: bloc.type,
          contenu: bloc.contenu,
          proprietes: bloc.proprietes,
          ordre: bloc.ordre,
          parentId: bloc.parentId ?? null,
        })),
      } as Partial<VersionPage>);
      setVersionsListe((prec) => [cree, ...prec]);
      toasts.succes('Version enregistrée', formaterDateHeure(cree.createdAt));
    } catch (e) {
      toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    } finally {
      setVersionEnCours(null);
    }
  }, [page, utilisateur, toasts]);

  const restaurerVersion = useCallback(
    async (version: VersionPage) => {
      if (!page) return;
      const ok = await confirmer({
        titre: 'Restaurer cette version ?',
        message: `La page sera remplacée par la version du ${formaterDateHeure(version.createdAt)}. Une sauvegarde de l’état actuel sera créée.`,
        libelleConfirmer: 'Restaurer',
      });
      if (!ok) return;
      setVersionEnCours(version._id);
      try {
        await apiVersions.restaurer(version._id);
        const fraiche = await apiPages.obtenir(page._id);
        setPage(fraiche);
        setCleEdition((n) => n + 1);
        await rafraichir();
        toasts.succes('Version restaurée');
        setHistoriqueOuvert(false);
      } catch (e) {
        toasts.erreur('Restauration impossible', e instanceof Error ? e.message : undefined);
      } finally {
        setVersionEnCours(null);
      }
    },
    [page, confirmer, rafraichir, toasts]
  );

  async function supprimerPage() {
    if (!page) return;
    const ok = await confirmer({
      titre: `Déplacer « ${page.titre} » vers la corbeille ?`,
      message: 'La page pourra être restaurée depuis la corbeille.',
      libelleConfirmer: 'Déplacer vers la corbeille',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiPages.supprimer(page._id);
      await rafraichir();
      toasts.succes('Page déplacée vers la corbeille');
      router.push('/');
    } catch (e) {
      toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
    }
  }

  async function dupliquerPage() {
    if (!page) return;
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    try {
      const copie = await apiPages.creer({
        titre: `${page.titre} (copie)`,
        icone: page.icone,
        espaceId: identifiantDe(page.espaceId) || undefined,
        workspaceId: identifiantDe(page.workspaceId) || undefined,
        parentId: page.parentId || null,
        section: page.section,
      } as Partial<Page>);
      await rafraichir();
      toasts.succes('Page dupliquée');
      router.push(lienPage(copie));
    } catch (e) {
      toasts.erreur('Duplication impossible', e instanceof Error ? e.message : undefined);
    }
  }

  /** Transforme la page en tableau : crée une base de données rattachée. */
  const creerBase = useCallback(async () => {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    if (lireSeulement) {
      toasts.erreur('Page verrouillée', 'Déverrouillez la page pour la modifier.');
      return;
    }
    if (!page) return;
    try {
      const cree = await apiBases.creer({
        titre: page.titre || 'Tableau',
        icone: '📊',
        pageId: page._id,
        espaceId: identifiantDe(page.espaceId) || undefined,
        enLigne: true,
        proprietes: [
          { nom: 'Statut', type: 'statut', options: { groupes: ['À faire', 'En cours', 'Terminé'] } },
          { nom: 'Date', type: 'date' },
        ],
        vues: [{ nom: 'Tableau', type: 'tableau' }],
      } as Partial<BaseDonnees>);
      setBase(cree);
      toasts.succes('Tableau créé');
    } catch (e) {
      toasts.erreur('Création impossible', e instanceof Error ? e.message : undefined);
    }
  }, [lireSeulement, peutEditer, page, toasts]);

  /** Supprime la base (tableau) rattachée à la page. */
  const supprimerBase = useCallback(async () => {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    if (lireSeulement) {
      toasts.erreur('Page verrouillée', 'Déverrouillez la page pour la modifier.');
      return;
    }
    if (!base) return;
    const ok = await confirmer({
      titre: 'Supprimer ce tableau ?',
      message:
        'La base de données et ses éléments seront supprimés. Le texte et les autres blocs de la page sont conservés.',
      libelleConfirmer: 'Supprimer le tableau',
      danger: true,
    });
    if (!ok) return;
    try {
      await apiBases.supprimer(base._id);
      setBase(null);
      toasts.succes('Tableau supprimé');
    } catch (e) {
      toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
    }
  }, [lireSeulement, peutEditer, base, confirmer, toasts]);

  if (chargement || chargementDonnees) return <Chargement libelle="Chargement de la page…" />;

  if (erreur || !page) {
    return (
      <div className="mx-auto w-full max-w-contenu px-8 py-16">
        <BandeauErreur message={erreur || 'Page introuvable.'} />
      </div>
    );
  }

  const favori = estFavori(page._id);
  const pleineLargeur = Boolean(page.pleineLargeur);

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1">
        {/* Barre d'actions de la page */}
        <div className="sticky top-0 z-20 flex items-center justify-end gap-0.5 px-6 py-2 backdrop-blur">
          <span className="mr-auto flex items-center gap-2 pl-1 text-xs texte-faible">
            <span>{page.publie ? 'Publié sur le Web' : 'Privé'}</span>
            {!lireSeulement && etatTitre !== 'inactif' && (
              <span
                className={cn(etatTitre === 'erreur' && 'text-red-600 dark:text-red-400')}
                aria-live="polite"
              >
                {etatTitre === 'en_cours'
                  ? 'Enregistrement…'
                  : etatTitre === 'erreur'
                    ? 'Échec de l’enregistrement'
                    : 'Enregistré'}
              </span>
            )}
          </span>
          <InfoBulles contenu={favori ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
            <button
              type="button"
              onClick={() => {
                if (!peutEditer) {
                  toasts.erreur('Connexion requise');
                  return;
                }
                basculerFavori(page).catch(() => toasts.erreur('Action impossible'));
              }}
              className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Favori"
            >
              <Star className={cn('h-4 w-4', favori && 'fill-amber-400 text-amber-500')} />
            </button>
          </InfoBulles>
          <InfoBulles contenu={pleineLargeur ? 'Largeur normale' : 'Pleine largeur'}>
            <button
              type="button"
              onClick={() => majPage({ pleineLargeur: !pleineLargeur })}
              className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Basculer la largeur"
            >
              {pleineLargeur ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </InfoBulles>
          {peutEditer && (
            <InfoBulles contenu={verrouillee ? 'Déverrouiller la page' : 'Verrouiller la page (lecture seule)'}>
              <button
                type="button"
                onClick={() => majPage({ verrouillee: !verrouillee })}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/10',
                  verrouillee ? 'text-amber-600 dark:text-amber-400' : 'texte-doux'
                )}
                aria-label={verrouillee ? 'Déverrouiller la page' : 'Verrouiller la page'}
                aria-pressed={verrouillee}
              >
                {verrouillee ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </button>
            </InfoBulles>
          )}
          <InfoBulles contenu="Commentaires">
            <button
              type="button"
              onClick={() => setCommentairesOuverts((o) => !o)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded px-2 texte-doux hover:bg-black/5 dark:hover:bg-white/10',
                commentairesOuverts && 'lien-barre-actif'
              )}
              aria-label="Commentaires"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          </InfoBulles>
          <button type="button" onClick={() => setPartageOuvert(true)} className="bouton text-sm">
            <Send className="h-3.5 w-3.5" />
            Partager
          </button>
          <Menu
            alignement="droite"
            declencheur={
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Plus d’actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            <MenuElement icone={ImagePlus} onClick={ouvrirCouverture}>
              {page.couverture ? 'Changer la couverture' : 'Ajouter une couverture'}
            </MenuElement>
            <MenuSeparateur />
            <MenuElement icone={Copy} onClick={dupliquerPage}>
              Dupliquer la page
            </MenuElement>
            {peutEditer &&
              (base ? (
                <MenuElement icone={Trash2} onClick={supprimerBase}>
                  Supprimer le tableau
                </MenuElement>
              ) : (
                <MenuElement icone={Table} onClick={creerBase}>
                  Créer un tableau
                </MenuElement>
              ))}
            <MenuElement icone={History} onClick={() => setHistoriqueOuvert(true)}>
              Historique de la page
            </MenuElement>
            <MenuElement
              icone={Link2}
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                toasts.info('Lien copié');
              }}
            >
              Copier le lien
            </MenuElement>
            <MenuSeparateur />
            <MenuElement icone={Trash2} danger onClick={supprimerPage}>
              Déplacer vers la corbeille
            </MenuElement>
          </Menu>
        </div>

        {/* En-tête de page */}
        <div className={cn('mx-auto w-full px-10', pleineLargeur ? 'max-w-contenu-large' : 'max-w-contenu')}>
          <div className="group relative">
            {page.couverture ? (
              <div
                className="mt-2 h-40 w-full overflow-hidden rounded-lg"
                style={{
                  backgroundColor: 'var(--fond-secondaire)',
                  backgroundImage: estDegrade(page.couverture) ? page.couverture : undefined,
                }}
              >
                {!estDegrade(page.couverture) && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={page.couverture}
                      alt=""
                      className={cn(
                        'h-full w-full',
                        page.couvertureAjustement === 'contenir' ? 'object-contain' : 'object-cover'
                      )}
                      style={{ objectPosition: positionImage(page.couverturePosition) }}
                    />
                  </>
                )}
                {peutEditer && (
                  <div className="absolute right-2 top-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={ouvrirCouverture}
                      className="flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/70"
                    >
                      <ImagePlus className="h-3.5 w-3.5" />
                      <span>Changer</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => majPage({ couverture: '' })}
                      className="flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/70"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Retirer</span>
                    </button>
                  </div>
                )}
              </div>
            ) : peutEditer ? (
              <button
                type="button"
                onClick={ouvrirCouverture}
                className="mt-3 flex items-center gap-1.5 rounded px-1 py-0.5 text-sm texte-faible hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <ImagePlus className="h-4 w-4" />
                <span>Ajouter une couverture</span>
              </button>
            ) : null}
          </div>

          <div className={cn('flex flex-col', page.couverture ? '-mt-6' : 'mt-2')}>
            <SelecteurIcone
              valeur={page.icone}
              onChange={(emoji) => majPage({ icone: emoji })}
              taille="grande"
              className={cn('self-start', page.couverture && 'pl-1')}
            />
            <ChampAuto
              valeur={page.titre}
              onChange={(valeur) => majPage({ titre: valeur }, true)}
              onBlur={flushTitre}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              placeholder="Sans titre"
              className="mt-1 text-4xl font-bold leading-tight"
              readOnly={lireSeulement}
            />
          </div>
        </div>

        {/* Contenu */}
        <div className={cn('mx-auto w-full px-10 pb-24 pt-4', pleineLargeur ? 'max-w-contenu-large' : 'max-w-contenu')}>
          {/* Le contenu de la page reste toujours visible : une base de données
              rattachée s'affiche en complément, sans remplacer les blocs. */}
          <FournisseurLectureSeule verrouille={lireSeulement}>
            <EditeurBlocs
              key={cleEdition}
              pageId={page._id}
              onCreerBase={creerBase}
              lectureSeule={lireSeulement}
            />
          </FournisseurLectureSeule>

          {base && (
            <div className="mt-8">
              <div className="mb-2 flex items-center gap-2">
                <Table className="h-4 w-4 texte-faible" />
                <h2 className="text-sm font-semibold texte-doux">{base.titre || 'Tableau'}</h2>
                {!lireSeulement && (
                  <button
                    type="button"
                    onClick={supprimerBase}
                    className="ml-auto flex items-center gap-1.5 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer le tableau
                  </button>
                )}
              </div>
              <VueBase base={base} />
            </div>
          )}

          <Retroliens pageId={page._id} />
        </div>
      </div>

      {/* Panneau de commentaires */}
      {commentairesOuverts && (
        <aside
          className="hidden w-80 shrink-0 border-l lg:block"
          style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
        >
          <PanneauCommentaires pageId={page._id} onFermer={() => setCommentairesOuverts(false)} />
        </aside>
      )}

      {partageOuvert && (
        <PanneauPartage
          page={page}
          onFermer={() => setPartageOuvert(false)}
          onPageChange={(patch) => setPage((prec) => (prec ? { ...prec, ...patch } : prec))}
        />
      )}

      <Modale
        ouvert={historiqueOuvert}
        onFermer={() => setHistoriqueOuvert(false)}
        titre="Historique de la page"
        description="Consultez et restaurez les versions enregistrées de cette page."
        largeur="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2 text-sm">
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 texte-faible" />
              <span className="texte-doux">Créée le</span>
              <span className="ml-auto">{formaterDateHeure(page.createdAt)}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 texte-faible" />
              <span className="texte-doux">Dernière modification</span>
              <span className="ml-auto">{formaterDateHeure(page.updatedAt)}</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 texte-faible" />
              <span className="texte-doux">Dernière visite</span>
              <span className="ml-auto">{page.derniereVisite ? formaterDateHeure(page.derniereVisite) : '—'}</span>
            </li>
          </ul>

          <div className="flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--bordure)' }}>
            <h3 className="text-sm font-semibold">Versions enregistrées</h3>
            {!lireSeulement && (
              <button
                type="button"
                className="bouton gap-1.5 text-sm"
                onClick={enregistrerVersion}
                disabled={versionEnCours !== null}
              >
                <Save className="h-3.5 w-3.5" />
                {versionEnCours === 'nouvelle' ? 'Enregistrement…' : 'Enregistrer la version actuelle'}
              </button>
            )}
          </div>

          {chargementVersions ? (
            <Chargement libelle="Chargement des versions…" />
          ) : versionsListe.length === 0 ? (
            <p className="text-sm texte-faible">
              Aucune version pour l’instant. Enregistrez un instantané pour pouvoir restaurer la page plus tard.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto defilement-fin">
              {versionsListe.map((version) => (
                <li
                  key={version._id}
                  className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <History className="h-4 w-4 shrink-0 texte-faible" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{version.titre || 'Sans titre'}</p>
                    <p className="truncate text-xs texte-faible">
                      {formaterDateHeure(version.createdAt)}
                      {version.auteurNom ? ` · ${version.auteurNom}` : ''}
                      {Array.isArray(version.blocs) ? ` · ${version.blocs.length} bloc(s)` : ''}
                    </p>
                  </div>
                  {!lireSeulement && (
                    <button
                      type="button"
                      className="bouton shrink-0 gap-1 p-1.5 text-xs"
                      onClick={() => restaurerVersion(version)}
                      disabled={versionEnCours !== null}
                      title="Restaurer cette version"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modale>

      <Modale
        ouvert={couvertureOuverte}
        onFermer={() => setCouvertureOuverte(false)}
        titre="Couverture de la page"
        description="Ajoutez une image d’en-tête pour donner du relief à cette page."
        largeur="max-w-lg"
      >
        <div className="flex flex-col gap-4">
          {page.couverture && (
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--bordure)' }}>
              {estDegrade(page.couverture) ? (
                <div className="h-28 w-full" style={{ backgroundImage: page.couverture }} />
              ) : (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.couverture}
                    alt=""
                    className={cn(
                      'h-28 w-full',
                      page.couvertureAjustement === 'contenir' ? 'object-contain' : 'object-cover'
                    )}
                    style={{ objectPosition: positionImage(page.couverturePosition) }}
                  />
                </>
              )}
            </div>
          )}

          {page.couverture && !estDegrade(page.couverture) && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium">Affichage</span>
                <div className="flex gap-1 rounded-md p-0.5" style={{ backgroundColor: 'var(--survol)' }}>
                  {(['remplir', 'contenir'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => majPage({ couvertureAjustement: mode })}
                      className={cn(
                        'rounded px-3 py-1 text-sm',
                        (page.couvertureAjustement || 'remplir') === mode
                          ? 'bg-white shadow-sm dark:bg-white/15'
                          : 'texte-doux'
                      )}
                    >
                      {mode === 'remplir' ? 'Remplir' : 'Image entière'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-medium">Alignement</span>
                <div className="flex gap-1 rounded-md p-0.5" style={{ backgroundColor: 'var(--survol)' }}>
                  {(
                    [
                      ['haut', 'Haut'],
                      ['centre', 'Centre'],
                      ['bas', 'Bas'],
                    ] as const
                  ).map(([valeur, libelle]) => (
                    <button
                      key={valeur}
                      type="button"
                      onClick={() => majPage({ couverturePosition: valeur })}
                      className={cn(
                        'rounded px-3 py-1 text-sm',
                        (page.couverturePosition || 'centre') === valeur
                          ? 'bg-white shadow-sm dark:bg-white/15'
                          : 'texte-doux'
                      )}
                    >
                      {libelle}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="champ-url-couverture">
              Lien d’une image
            </label>
            <div className="flex gap-2">
              <input
                id="champ-url-couverture"
                className="champ flex-1"
                value={urlCouverture}
                onChange={(e) => setUrlCouverture(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    appliquerCouverture(urlCouverture);
                  }
                }}
                placeholder="https://…"
              />
              <button
                type="button"
                className="bouton bouton-primaire shrink-0"
                onClick={() => appliquerCouverture(urlCouverture)}
                disabled={!urlCouverture.trim()}
              >
                Appliquer
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Téléverser une image</span>
            <input
              ref={fichierCouverture}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const fichier = e.target.files?.[0];
                if (fichier) void televerserCouverture(fichier);
              }}
            />
            <button
              type="button"
              className="bouton gap-1.5 self-start"
              onClick={() => fichierCouverture.current?.click()}
              disabled={envoiCouverture}
            >
              {envoiCouverture ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {envoiCouverture ? 'Envoi…' : 'Choisir un fichier'}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Suggestions</span>
            <div className="grid grid-cols-3 gap-2">
              {COUVERTURES_PROPOSEES.map((modele) => (
                <button
                  key={modele.nom}
                  type="button"
                  onClick={() => appliquerCouverture(modele.valeur)}
                  className="group relative h-16 overflow-hidden rounded-md border transition-opacity hover:opacity-90"
                  style={{ borderColor: 'var(--bordure)', backgroundImage: modele.valeur }}
                  aria-label={`Utiliser le dégradé ${modele.nom}`}
                >
                  <span className="absolute inset-x-0 bottom-0 bg-black/35 px-1.5 py-0.5 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {modele.nom}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {page.couverture && (
            <button
              type="button"
              className="flex items-center gap-1.5 self-start rounded px-1.5 py-1 text-sm text-red-600 hover:bg-red-500/10 dark:text-red-400"
              onClick={() => {
                majPage({ couverture: '' });
                setCouvertureOuverte(false);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Retirer la couverture
            </button>
          )}
        </div>
      </Modale>
    </div>
  );
}

/** Pages qui référencent la page courante (blocs de type « lien vers une page »). */
function Retroliens({ pageId }: { pageId: string }) {
  const { pageParId } = useDonnees();
  const [sources, setSources] = useState<Page[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const liens = await listerTout<Bloc>(apiBlocs, { type: 'lien_page' });
        const ids = new Set<string>();
        liens
          .filter((bloc) => String(bloc.proprietes?.pageId || '') === pageId)
          .forEach((bloc) => {
            if (bloc.pageId && bloc.pageId !== pageId) ids.add(bloc.pageId);
          });
        const pages = Array.from(ids)
          .map((id) => pageParId(id))
          .filter((p): p is Page => Boolean(p));
        if (!annule) setSources(pages);
      } catch {
        if (!annule) setSources([]);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [pageId, pageParId]);

  if (chargement) return null;

  return (
    <section className="mt-14 border-t pt-6" style={{ borderColor: 'var(--bordure)' }}>
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 texte-faible" />
        <h2 className="text-sm font-semibold texte-doux">
          Pages mentionnant celle-ci {sources.length > 0 && `(${sources.length})`}
        </h2>
      </div>
      {sources.length === 0 ? (
        <p className="text-sm texte-faible">
          Aucune page ne référence encore cette page. Utilisez un bloc « Lien vers une page » pour la mentionner.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sources.map((source) => (
            <li key={source._id}>
              <Link
                href={lienPage(source)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 texte-faible" />
                <span className="truncate">{source.titre}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
