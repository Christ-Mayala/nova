'use client';

import { LayoutTemplate, Plus, Search, Sparkles, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Chargement, EtatVide } from '@/components/ui/Etats';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Modale } from '@/components/ui/Modale';
import { SelecteurIcone } from '@/components/ui/SelecteurIcone';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { blocs as apiBlocs, listerTout, modeles as apiModeles, pages as apiPages } from '@/lib/api';
import type { Bloc, CategorieModele, Modele, Page, TypeBloc } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

type FiltreCategorie = 'tous' | CategorieModele;

/** Onglets de la galerie de modèles. */
const ONGLETS: Array<{ valeur: FiltreCategorie; libelle: string; icone: typeof Sparkles }> = [
  { valeur: 'tous', libelle: 'Tous', icone: LayoutTemplate },
  { valeur: 'officiel', libelle: 'Officiels', icone: Sparkles },
  { valeur: 'communaute', libelle: 'Communauté', icone: Users },
  { valeur: 'perso', libelle: 'Mes modèles', icone: LayoutTemplate },
];

interface Brouillon {
  nom: string;
  description: string;
  icone: string;
  categorie: CategorieModele;
}

/** Galerie de modèles : officiels, communauté et modèles personnels. */
export default function PageModeles() {
  const { espaces, workspaceActif, rafraichir } = useDonnees();
  const { peutEditer } = useAuth();
  const toasts = useToasts();
  const router = useRouter();

  const [modeles, setModeles] = useState<Modele[]>([]);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState<FiltreCategorie>('tous');
  const [recherche, setRecherche] = useState('');
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [creationEnCours, setCreationEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const liste = await listerTout(apiModeles, { sort: 'nom' });
      setModeles(liste);
    } catch {
      setModeles([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return modeles
      .filter((modele) => (filtre === 'tous' ? true : (modele.categorie || 'officiel') === filtre))
      .filter((modele) => {
        if (!terme) return true;
        return (
          modele.nom.toLowerCase().includes(terme) ||
          (modele.description || '').toLowerCase().includes(terme)
        );
      });
  }, [modeles, filtre, recherche]);

  /** Duplique un modèle : crée une page et ses blocs initiaux. */
  const utiliserModele = useCallback(
    async (modele: Modele) => {
      if (!peutEditer) {
        toasts.erreur('Connexion requise');
        return;
      }
      setCreationEnCours(modele._id);
      try {
        const espaceId = identifiantDe(modele.espaceId) || espaces[0]?._id;
        const page = await apiPages.creer({
          titre: modele.nom,
          icone: modele.icone,
          espaceId,
          workspaceId: workspaceActif?._id,
          parentId: null,
          // Les pages créées depuis un modèle rejoignent directement l'onglet « Privé »
          // du membre pour rester confidentielles et personnelles à leur propriétaire.
          section: 'prive',
          ordre: 0,
        } as Partial<Page>);

        const sections = extraireSections(modele);
        const blocs: Array<Partial<Bloc>> = [
          { pageId: page._id, type: 'titre_1', contenu: modele.nom, ordre: 0 },
          ...sections.map((section, index) => ({
            pageId: page._id,
            type: 'titre_2' as TypeBloc,
            contenu: section,
            ordre: index + 1,
          })),
        ];
        await Promise.all(blocs.map((bloc) => apiBlocs.creer(bloc)));

        await rafraichir();
        toasts.succes(`Page « ${modele.nom} » créée depuis le modèle`);
        const espace = espaces.find((e) => e._id === espaceId);
        router.push(espace ? `/${espace.slug || espace._id}/${page._id}` : `/page/${page._id}`);
      } catch (e) {
        toasts.erreur('Création impossible', e instanceof Error ? e.message : undefined);
      } finally {
        setCreationEnCours(null);
      }
    },
    [peutEditer, espaces, workspaceActif, rafraichir, router, toasts]
  );

  const enregistrerBrouillon = useCallback(async () => {
    if (!brouillon) return;
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    const nom = brouillon.nom.trim();
    if (!nom) {
      toasts.erreur('Le nom du modèle est obligatoire');
      return;
    }
    try {
      await apiModeles.creer({
        nom,
        description: brouillon.description.trim(),
        icone: brouillon.icone,
        categorie: brouillon.categorie,
      } as Partial<Modele>);
      setBrouillon(null);
      setFiltre(brouillon.categorie);
      await charger();
      toasts.succes('Modèle enregistré');
    } catch (e) {
      toasts.erreur('Enregistrement impossible', e instanceof Error ? e.message : undefined);
    }
  }, [brouillon, peutEditer, charger, toasts]);

  if (chargement) return <Chargement libelle="Chargement des modèles…" />;

  return (
    <div className="mx-auto w-full max-w-contenu-large px-8 py-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <LayoutTemplate className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Modèles</h1>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 texte-faible" />
          <input
            className="champ w-56 pl-8"
            placeholder="Rechercher un modèle…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="bouton gap-1.5"
          onClick={() =>
            setBrouillon({ nom: '', description: '', icone: '🧩', categorie: 'perso' })
          }
        >
          <Plus className="h-4 w-4" />
          Nouveau modèle
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {ONGLETS.map((onglet) => {
          const Icone = onglet.icone;
          const actif = filtre === onglet.valeur;
          return (
            <button
              key={onglet.valeur}
              type="button"
              onClick={() => setFiltre(onglet.valeur)}
              className={cn('etiquette gap-1.5 px-2.5 py-1', actif ? 'lien-barre-actif' : 'texte-doux')}
              style={!actif ? { backgroundColor: 'var(--fond-secondaire)' } : undefined}
            >
              <Icone className="h-3.5 w-3.5" />
              {onglet.libelle}
            </button>
          );
        })}
      </div>

      {filtres.length === 0 ? (
        <EtatVide
          icone={LayoutTemplate}
          titre="Aucun modèle"
          description="Changez de filtre ou créez un modèle réutilisable pour votre équipe."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtres.map((modele) => (
            <CarteModele
              key={modele._id}
              modele={modele}
              enCours={creationEnCours === modele._id}
              onUtiliser={() => utiliserModele(modele)}
            />
          ))}
        </div>
      )}

      <Modale
        ouvert={Boolean(brouillon)}
        onFermer={() => setBrouillon(null)}
        titre="Nouveau modèle"
        description="Un modèle est une page prête à l’emploi, duplicable en un clic."
        pied={
          <>
            <button type="button" className="bouton" onClick={() => setBrouillon(null)}>
              Annuler
            </button>
            <button type="button" className="bouton bouton-primaire" onClick={enregistrerBrouillon}>
              Enregistrer
            </button>
          </>
        }
      >
        {brouillon && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <SelecteurIcone
                valeur={brouillon.icone}
                onChange={(emoji) => setBrouillon((b) => (b ? { ...b, icone: emoji } : b))}
                taille="grande"
              />
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-medium texte-doux">Nom</span>
                <input
                  className="champ"
                  autoFocus
                  value={brouillon.nom}
                  placeholder="Nom du modèle"
                  onChange={(e) => setBrouillon((b) => (b ? { ...b, nom: e.target.value } : b))}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Description</span>
              <textarea
                className="champ min-h-[72px] resize-y"
                value={brouillon.description}
                placeholder="À quoi sert ce modèle ?"
                onChange={(e) => setBrouillon((b) => (b ? { ...b, description: e.target.value } : b))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Catégorie</span>
              <select
                className="champ"
                value={brouillon.categorie}
                onChange={(e) =>
                  setBrouillon((b) => (b ? { ...b, categorie: e.target.value as CategorieModele } : b))
                }
              >
                <option value="perso">Mes modèles</option>
                <option value="officiel">Officiels</option>
                <option value="communaute">Communauté</option>
              </select>
            </label>
          </div>
        )}
      </Modale>
    </div>
  );
}

/** Extrait les sections d'un modèle (contenu libre du backend). */
function extraireSections(modele: Modele): string[] {
  const sections = (modele.contenu as { sections?: unknown } | undefined)?.sections;
  if (Array.isArray(sections)) return sections.filter((s): s is string => typeof s === 'string');
  return [];
}

/** Carte d'un modèle de la galerie. */
function CarteModele({
  modele,
  enCours,
  onUtiliser,
}: {
  modele: Modele;
  enCours: boolean;
  onUtiliser: () => void;
}) {
  const libelleCategorie =
    modele.categorie === 'communaute' ? 'Communauté' : modele.categorie === 'perso' ? 'Personnel' : 'Officiel';

  return (
    <div className="carte group flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <IconeDonnee icone={modele.icone} repli={LayoutTemplate} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{modele.nom}</p>
          <span className="etiquette mt-1 inline-block px-1.5 py-0.5 text-[11px]" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
            {libelleCategorie}
          </span>
        </div>
      </div>
      {modele.description && <p className="line-clamp-3 text-sm texte-doux">{modele.description}</p>}
      <button
        type="button"
        onClick={onUtiliser}
        disabled={enCours}
        className="bouton mt-auto w-full justify-center gap-1.5"
      >
        <Plus className="h-4 w-4" />
        {enCours ? 'Création…' : 'Utiliser ce modèle'}
      </button>
    </div>
  );
}
