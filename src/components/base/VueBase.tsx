'use client';

import {
  ArrowUpDown,
  Columns3,
  Layers,
  ListFilter,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { BarreVues } from '@/components/base/BarreVues';
import { ElementDetail } from '@/components/base/ElementDetail';
import { PanneauAffichage, PanneauFiltres, PanneauGroupes, PanneauProprietes, PanneauTris } from '@/components/base/PanneauxBase';
import { type ContexteVue } from '@/components/base/commun';
import {
  appliquerFiltres,
  appliquerTris,
  formaterValeur,
  normaliserNom,
  patchValeur,
} from '@/components/base/filtrage';
import { VueCalendrier } from '@/components/base/vues/VueCalendrier';
import { VueChronologie } from '@/components/base/vues/VueChronologie';
import { VueGalerie } from '@/components/base/vues/VueGalerie';
import { VueKanban } from '@/components/base/vues/VueKanban';
import { VueListe } from '@/components/base/vues/VueListe';
import { VueTableau } from '@/components/base/vues/VueTableau';
import { Chargement } from '@/components/ui/Etats';
import { Menu, MenuElement } from '@/components/ui/Menu';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { bases as apiBases, elements as apiElements, listerTout } from '@/lib/api';
import type { Base, Element, ProprieteBase, TypePropriete, TypeVue, VueBase as VueBaseDef } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

const VUE_PAR_DEFAUT: VueBaseDef = { nom: 'Tableau', type: 'tableau' };

/**
 * Base de données d'une page : onglets de vues (tableau, kanban, galerie, liste,
 * calendrier, chronologie), filtres/tris/groupes par vue, gestion des
 * propriétés et des éléments.
 */
export function VueBase({ base }: { base: Base }) {
  const { peutEditer } = useAuth();
  const toasts = useToasts();

  const [baseLocale, setBaseLocale] = useState<Base>(base);
  const [elements, setElements] = useState<Element[]>([]);
  const [chargement, setChargement] = useState(true);
  const [indexVue, setIndexVue] = useState(0);
  const [requete, setRequete] = useState('');
  const [elementOuvert, setElementOuvert] = useState<string | null>(null);
  const minuteurs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const vues = baseLocale.vues && baseLocale.vues.length > 0 ? baseLocale.vues : [VUE_PAR_DEFAUT];
  const indexSur = Math.min(indexVue, vues.length - 1);
  const vue = vues[indexSur];

  /* Synchronise la copie locale quand la base change (navigation entre pages). */
  useEffect(() => {
    setBaseLocale(base);
    setIndexVue(0);
    setRequete('');
  }, [base._id]);

  /* Charge les éléments de la base. */
  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      try {
        const trouves = await listerTout(apiElements, { baseId: base._id, sort: 'ordre' });
        const propres = trouves.filter((e) => identifiantDe(e.baseId) === base._id);
        if (!annule) setElements(propres);
      } catch {
        if (!annule) setElements([]);
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [base._id]);

  /* Nettoyage des minuteurs d'enregistrement. */
  useEffect(() => {
    const courants = minuteurs.current;
    return () => {
      Object.values(courants).forEach(clearTimeout);
    };
  }, []);

  /* Restaure la vue active depuis l'URL (?v=index). */
  useEffect(() => {
    const valeur = new URLSearchParams(window.location.search).get('v');
    const index = Number(valeur);
    if (Number.isInteger(index) && index >= 0 && index < vues.length) setIndexVue(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Persiste les changements de structure de la base (vues, propriétés). */
  const enregistrerBase = useCallback(
    async (suivante: Base) => {
      if (!peutEditer) return;
      try {
        await apiBases.maj(suivante._id, { vues: suivante.vues, proprietes: suivante.proprietes });
      } catch (e) {
        toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [peutEditer, toasts]
  );

  /** Enregistre un élément avec un léger différé. */
  const enregistrerElement = useCallback(
    (element: Element) => {
      if (!peutEditer) return;
      const existant = minuteurs.current[element._id];
      if (existant) clearTimeout(existant);
      minuteurs.current[element._id] = setTimeout(async () => {
        try {
          await apiElements.maj(element._id, {
            titre: element.titre,
            valeurs: element.valeurs,
            assigne: element.assigne,
            priorite: element.priorite,
            etiquette: element.etiquette,
            dateDebut: element.dateDebut,
            dateFin: element.dateFin,
          });
        } catch (e) {
          toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
        }
      }, 600);
    },
    [peutEditer, toasts]
  );

  const majElement = useCallback(
    (id: string, patch: Partial<Element>) => {
      setElements((prec) => {
        const suivant = prec.map((e) => (e._id === id ? { ...e, ...patch } : e));
        const modifie = suivant.find((e) => e._id === id);
        if (modifie) enregistrerElement(modifie);
        return suivant;
      });
    },
    [enregistrerElement]
  );

  const ecrireValeur = useCallback(
    (element: Element, nom: string, valeur: unknown) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      majElement(element._id, patchValeur(element, nom, valeur));
    },
    [peutEditer, majElement, toasts]
  );

  const creerElement = useCallback(
    async (initial: Partial<Element> = {}) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      try {
        const cree = await apiElements.creer({
          baseId: base._id,
          ...initial,
          titre: initial.titre || 'Sans titre',
          valeurs: initial.valeurs || {},
          ordre: elements.length,
        } as Partial<Element>);
        setElements((prec) => [...prec, cree]);
        setElementOuvert(cree._id);
      } catch (e) {
        toasts.erreur('Création impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [base._id, elements.length, peutEditer, toasts]
  );

  const supprimerElement = useCallback(
    async (id: string) => {
      if (!peutEditer) return;
      try {
        await apiElements.supprimer(id);
        setElements((prec) => prec.filter((e) => e._id !== id));
        setElementOuvert((courant) => (courant === id ? null : courant));
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [peutEditer, toasts]
  );

  /** Met à jour la vue active (filtres, tris, groupes, propriétés visibles). */
  const majVue = useCallback(
    (patch: Partial<VueBaseDef>) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      setBaseLocale((prec) => {
        const vuesPrec = prec.vues && prec.vues.length > 0 ? prec.vues : [VUE_PAR_DEFAUT];
        const suivantes = vuesPrec.map((v, i) => (i === indexSur ? { ...v, ...patch } : v));
        const suivante = { ...prec, vues: suivantes };
        enregistrerBase(suivante);
        return suivante;
      });
    },
    [enregistrerBase, peutEditer, indexSur, toasts]
  );

  /* Gestion des vues */
  function changerVue(index: number) {
    setIndexVue(index);
    const url = new URL(window.location.href);
    url.searchParams.set('v', String(index));
    window.history.replaceState(null, '', url.toString());
  }

  function ajouterVue(type: TypeVue) {
    if (!peutEditer) return;
    const noms: Record<TypeVue, string> = {
      tableau: 'Tableau',
      kanban: 'Kanban',
      galerie: 'Galerie',
      liste: 'Liste',
      calendrier: 'Calendrier',
      chronologie: 'Chronologie',
    };
    setBaseLocale((prec) => {
      const vuesPrec = prec.vues && prec.vues.length > 0 ? prec.vues : [VUE_PAR_DEFAUT];
      const suivantes = [...vuesPrec, { nom: noms[type], type }];
      const suivante = { ...prec, vues: suivantes };
      enregistrerBase(suivante);
      setIndexVue(suivantes.length - 1);
      return suivante;
    });
  }

  function renommerVue(index: number, nom: string) {
    setBaseLocale((prec) => {
      const vuesPrec = prec.vues || [];
      const suivantes = vuesPrec.map((v, i) => (i === index ? { ...v, nom } : v));
      const suivante = { ...prec, vues: suivantes };
      enregistrerBase(suivante);
      return suivante;
    });
  }

  function dupliquerVue(index: number) {
    if (!peutEditer) return;
    setBaseLocale((prec) => {
      const vuesPrec = prec.vues || [];
      const origine = vuesPrec[index];
      if (!origine) return prec;
      const suivantes = [...vuesPrec];
      suivantes.splice(index + 1, 0, { ...origine, nom: `${origine.nom} (copie)` });
      const suivante = { ...prec, vues: suivantes };
      enregistrerBase(suivante);
      setIndexVue(index + 1);
      return suivante;
    });
  }

  function supprimerVue(index: number) {
    if (!peutEditer) return;
    setBaseLocale((prec) => {
      const vuesPrec = prec.vues || [];
      if (vuesPrec.length <= 1) return prec;
      const suivantes = vuesPrec.filter((_, i) => i !== index);
      const suivante = { ...prec, vues: suivantes };
      enregistrerBase(suivante);
      setIndexVue(Math.max(0, Math.min(index, suivantes.length - 1)));
      return suivante;
    });
  }

  /* Gestion des propriétés */
  function ajouterPropriete(nom: string, type: TypePropriete) {
    if (!peutEditer) return;
    const existante = (baseLocale.proprietes || []).some((p) => normaliserNom(p.nom) === normaliserNom(nom));
    if (existante) {
      toasts.info('Une propriété porte déjà ce nom');
      return;
    }
    const propriete: ProprieteBase = {
      nom,
      type,
      options: type === 'selection' || type === 'selection_multiple' ? { options: [] } : {},
    };
    setBaseLocale((prec) => {
      const suivante = { ...prec, proprietes: [...(prec.proprietes || []), propriete] };
      enregistrerBase(suivante);
      return suivante;
    });
    toasts.succes('Propriété ajoutée');
  }

  function supprimerPropriete(nom: string) {
    if (!peutEditer) return;
    setBaseLocale((prec) => {
      const cible = normaliserNom(nom);
      const suivante: Base = {
        ...prec,
        proprietes: (prec.proprietes || []).filter((p) => normaliserNom(p.nom) !== cible),
        vues: (prec.vues || []).map((v) => ({
          ...v,
          proprietesVisibles: (v.proprietesVisibles || []).filter((n) => normaliserNom(n) !== cible),
          filtres: (v.filtres || []).filter((f) => normaliserNom(f.propriete) !== cible),
          tris: (v.tris || []).filter((t) => normaliserNom(t.propriete) !== cible),
          groupes: (v.groupes || []).filter((g) => normaliserNom(g.propriete) !== cible),
        })),
      };
      enregistrerBase(suivante);
      return suivante;
    });
    toasts.info('Propriété supprimée');
  }

  /* Filtrage + tri + recherche appliqués aux éléments. */
  const affiches = useMemo(() => {
    const filtreTexte = requete.trim().toLowerCase();
    const parRecherche = filtreTexte
      ? elements.filter((e) => {
          const texte = [e.titre, formaterValeur(e.etiquette), ...Object.values(e.valeurs || {}).map(formaterValeur)]
            .join(' ')
            .toLowerCase();
          return texte.includes(filtreTexte);
        })
      : elements;
    return appliquerTris(appliquerFiltres(parRecherche, vue?.filtres), vue?.tris);
  }, [elements, requete, vue?.filtres, vue?.tris]);

  const ctx: ContexteVue = {
    base: baseLocale,
    elements: affiches,
    tousLesElements: elements,
    vue,
    peutEditer,
    creerElement,
    supprimerElement,
    ouvrirElement: (element) => setElementOuvert(element._id),
    ecrireValeur,
    ajouterPropriete,
    majVue,
  };

  const nbFiltres = vue?.filtres?.length || 0;
  const nbTris = vue?.tris?.length || 0;
  const groupement = vue?.groupes?.[0]?.propriete;

  function vueRendue() {
    switch (vue.type) {
      case 'kanban':
        return <VueKanban ctx={ctx} />;
      case 'galerie':
        return <VueGalerie ctx={ctx} />;
      case 'liste':
        return <VueListe ctx={ctx} />;
      case 'calendrier':
        return <VueCalendrier ctx={ctx} />;
      case 'chronologie':
        return <VueChronologie ctx={ctx} />;
      default:
        return <VueTableau ctx={ctx} />;
    }
  }

  return (
    <div className="flex flex-col">
      {/* Barre d'outils de la base */}
      <div className="flex flex-wrap items-center gap-1 border-b pb-2" style={{ borderColor: 'var(--bordure)' }}>
        <BarreVues
          vues={vues}
          indexActif={indexSur}
          peutEditer={peutEditer}
          onChanger={changerVue}
          onAjouter={ajouterVue}
          onRenommer={renommerVue}
          onDupliquer={dupliquerVue}
          onSupprimer={supprimerVue}
        />

        <div className="ml-auto flex items-center gap-0.5">
          {/* Recherche locale */}
          <label className="flex items-center gap-1.5 rounded px-2 py-1" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
            <Search className="h-3.5 w-3.5 texte-faible" />
            <input
              value={requete}
              onChange={(e) => setRequete(e.target.value)}
              placeholder="Rechercher…"
              className="w-32 bg-transparent text-sm outline-none placeholder:texte-faible"
            />
          </label>

          <BoutonBarre icone={ListFilter} libelle="Filtrer" actif={nbFiltres > 0} compteur={nbFiltres}>
            <PanneauFiltres ctx={ctx} />
          </BoutonBarre>
          <BoutonBarre icone={ArrowUpDown} libelle="Trier" actif={nbTris > 0} compteur={nbTris}>
            <PanneauTris ctx={ctx} />
          </BoutonBarre>
          <BoutonBarre icone={Layers} libelle="Grouper" actif={Boolean(groupement)}>
            <PanneauGroupes ctx={ctx} />
          </BoutonBarre>
          <BoutonBarre icone={SlidersHorizontal} libelle="Affichage">
            <PanneauAffichage ctx={ctx} />
          </BoutonBarre>
          <BoutonBarre icone={Columns3} libelle="Propriétés">
            <PanneauProprietes ctx={ctx} onAjouter={ajouterPropriete} onSupprimer={supprimerPropriete} />
          </BoutonBarre>

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
            <MenuElement icone={Plus} onClick={() => creerElement()}>
              Nouvel élément
            </MenuElement>
          </Menu>
        </div>
      </div>

      {/* Contenu de la vue */}
      <div className="pt-3">
        {chargement ? <Chargement libelle="Chargement de la base…" /> : vueRendue()}
      </div>

      {/* Fiche d'un élément */}
      {elementOuvert && (() => {
        const element = elements.find((e) => e._id === elementOuvert);
        if (!element) return null;
        return <ElementDetail ctx={ctx} element={element} onFermer={() => setElementOuvert(null)} />;
      })()}
    </div>
  );
}

/** Bouton de la barre d'outils ouvrant un panneau déroulant. */
function BoutonBarre({
  icone: Icone,
  libelle,
  actif,
  compteur,
  children,
}: {
  icone: typeof ListFilter;
  libelle: string;
  actif?: boolean;
  compteur?: number;
  children: React.ReactNode;
}) {
  return (
    <Menu
      alignement="droite"
      declencheur={
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-1 text-sm',
            actif ? 'font-medium' : 'texte-doux',
            'hover:bg-black/5 dark:hover:bg-white/10'
          )}
          aria-label={libelle}
        >
          <Icone className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{libelle}</span>
          {compteur ? (
            <span className="rounded-full px-1 text-[10px] font-semibold" style={{ backgroundColor: 'var(--survol)' }}>
              {compteur}
            </span>
          ) : null}
        </button>
      }
    >
      {children}
    </Menu>
  );
}
