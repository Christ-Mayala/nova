'use client';

import { FileText, Hash, Loader2, Search, Table } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { useDonnees } from '@/context/DonneesContext';
import { rechercherGlobalement, type ResultatRecherche } from '@/lib/api';
import { ROUTES, lienPage } from '@/lib/navigation';
import type { Page } from '@/lib/types';
import { cn, formaterDateRelative, identifiantDe } from '@/lib/utils';

type FiltreType = 'tout' | 'page' | 'bloc' | 'element';
type Tri = 'pertinence' | 'recent' | 'ancien';

/** Page de résultats de recherche avec filtres par type, espace et tri. */
export default function PageRecherche() {
  const { pageParId, espaces, chargement: chargementDonnees } = useDonnees();

  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [chargement, setChargement] = useState(false);
  const [filtreType, setFiltreType] = useState<FiltreType>('tout');
  const [filtreEspace, setFiltreEspace] = useState<string>('');
  const [tri, setTri] = useState<Tri>('pertinence');
  const [rechercheLancee, setRechercheLancee] = useState(false);

  useEffect(() => {
    const recherche = terme.trim();
    if (!recherche) {
      setResultats([]);
      setRechercheLancee(false);
      return;
    }
    setChargement(true);
    const minuteur = setTimeout(async () => {
      try {
        const trouves = await rechercherGlobalement(recherche);
        setResultats(trouves);
        setRechercheLancee(true);
      } catch {
        setResultats([]);
      } finally {
        setChargement(false);
      }
    }, 260);
    return () => clearTimeout(minuteur);
  }, [terme]);

  const resultatsFiltres = useMemo(() => {
    let liste = resultats;
    if (filtreType !== 'tout') liste = liste.filter((r) => r.type === filtreType);
    if (filtreEspace) {
      liste = liste.filter((r) => {
        if (!r.pageId) return false;
        const page = pageParId(r.pageId);
        return page ? identifiantDe(page.espaceId) === filtreEspace : false;
      });
    }
    if (tri !== 'pertinence') {
      liste = liste.slice().sort((a, b) => {
        const da = a.pageId ? pageParId(a.pageId)?.updatedAt : undefined;
        const db = b.pageId ? pageParId(b.pageId)?.updatedAt : undefined;
        const ta = da ? new Date(da).getTime() : 0;
        const tb = db ? new Date(db).getTime() : 0;
        return tri === 'recent' ? tb - ta : ta - tb;
      });
    }
    return liste;
  }, [resultats, filtreType, filtreEspace, tri, pageParId]);

  if (chargementDonnees) return <Chargement />;

  return (
    <div className="mx-auto w-full max-w-contenu px-8 py-8">
      <h1 className="mb-4 text-xl font-bold">Rechercher</h1>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 texte-faible" />
        <input
          autoFocus
          value={terme}
          onChange={(e) => setTerme(e.target.value)}
          placeholder="Rechercher dans les pages, blocs et éléments…"
          className="champ pl-9"
        />
        {chargement && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin texte-faible" />
        )}
      </div>

      {/* Filtres */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <GroupeFiltres
          valeur={filtreType}
          onChange={(v) => setFiltreType(v as FiltreType)}
          options={[
            { valeur: 'tout', libelle: 'Tout' },
            { valeur: 'page', libelle: 'Pages' },
            { valeur: 'bloc', libelle: 'Blocs' },
            { valeur: 'element', libelle: 'Éléments' },
          ]}
        />
        <select
          className="champ w-auto"
          value={filtreEspace}
          onChange={(e) => setFiltreEspace(e.target.value)}
        >
          <option value="">Tous les espaces</option>
          {espaces.map((espace) => (
            <option key={espace._id} value={espace._id}>
              {espace.nom}
            </option>
          ))}
        </select>
        <select className="champ w-auto" value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
          <option value="pertinence">Meilleure correspondance</option>
          <option value="recent">Modifié récemment</option>
          <option value="ancien">Plus ancien</option>
        </select>
      </div>

      {!terme.trim() ? (
        <EtatVide
          icone={Search}
          titre="Lancez une recherche"
          description="Saisissez un mot-clé pour explorer les titres de pages, le contenu des blocs et les éléments de bases de données."
        />
      ) : rechercheLancee && resultatsFiltres.length === 0 ? (
        <EtatVide
          icone={Search}
          titre="Aucun résultat"
          description={`Rien ne correspond à « ${terme.trim()} » avec ces filtres.`}
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {resultatsFiltres.map((resultat) => (
            <LigneResultat
              key={`${resultat.type}-${resultat.id}`}
              resultat={resultat}
              pageParId={pageParId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Barre de filtres segmentée. */
function GroupeFiltres({
  valeur,
  onChange,
  options,
}: {
  valeur: string;
  onChange: (v: string) => void;
  options: Array<{ valeur: string; libelle: string }>;
}) {
  return (
    <div className="flex rounded-md p-0.5" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
      {options.map((option) => (
        <button
          key={option.valeur}
          type="button"
          onClick={() => onChange(option.valeur)}
          className={cn(
            'rounded px-2.5 py-1 text-xs transition-colors',
            valeur === option.valeur ? 'font-medium' : 'texte-doux'
          )}
          style={valeur === option.valeur ? { backgroundColor: 'var(--fond)' } : undefined}
        >
          {option.libelle}
        </button>
      ))}
    </div>
  );
}

/** Ligne d'un résultat de recherche. */
function LigneResultat({
  resultat,
  pageParId,
}: {
  resultat: ResultatRecherche;
  pageParId: (id: string) => Page | undefined;
}) {
  const page = resultat.pageId ? pageParId(resultat.pageId) : undefined;
  const href = page ? lienPage(page) : resultat.type === 'page' ? `/page/${resultat.id}` : ROUTES.recherche;
  const Icone = resultat.type === 'element' ? Table : resultat.type === 'bloc' ? Hash : FileText;

  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      >
        {resultat.type === 'page' ? (
          <IconeDonnee icone={resultat.icone} className="h-4 w-4 shrink-0 texte-doux" />
        ) : (
          <Icone className="h-4 w-4 shrink-0 texte-faible" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate">{resultat.titre}</span>
          {resultat.extrait && <span className="mt-0.5 block truncate text-xs texte-doux">{resultat.extrait}</span>}
        </span>
        <span className="shrink-0 text-xs texte-faible">
          {page ? formaterDateRelative(page.updatedAt) : ''}
        </span>
      </Link>
    </li>
  );
}
