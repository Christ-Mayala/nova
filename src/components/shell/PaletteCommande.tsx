'use client';

import {
  CornerDownLeft,
  FileText,
  Hash,
  Inbox,
  Loader2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Table,
  Trash2,
  Home,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ModaleNouvellePage } from '@/components/shell/ModaleNouvellePage';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { useInterface } from '@/context/InterfaceContext';
import { rechercherGlobalement, type ResultatRecherche } from '@/lib/api';
import { ROUTES, lienPage } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface ActionRapide {
  id: string;
  libelle: string;
  icone: LucideIcon;
  executer: () => void;
}

/** Palette de commandes universelle (⌘K / Ctrl+K) : recherche + actions rapides. */
export function PaletteCommande() {
  const { paletteOuverte, fermerPalette } = useInterface();
  const { pageParId } = useDonnees();
  const { peutEditer } = useAuth();
  const toasts = useToasts();
  const router = useRouter();

  const [terme, setTerme] = useState('');
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [chargement, setChargement] = useState(false);
  const [indexActif, setIndexActif] = useState(0);
  const [nouvellePageOuverte, setNouvellePageOuverte] = useState(false);
  const [titreNouvellePage, setTitreNouvellePage] = useState('');
  const refEntree = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Réinitialise l'état à chaque ouverture et donne le focus au champ.
  useEffect(() => {
    if (paletteOuverte) {
      setTerme('');
      setResultats([]);
      setIndexActif(0);
      setTimeout(() => refEntree.current?.focus(), 20);
    }
  }, [paletteOuverte]);

  // Recherche transverse avec anti-rebond.
  useEffect(() => {
    if (!paletteOuverte) return;
    const recherche = terme.trim();
    if (!recherche) {
      setResultats([]);
      setChargement(false);
      return;
    }
    setChargement(true);
    const minuteur = setTimeout(async () => {
      abortRef.current?.abort();
      const controleur = new AbortController();
      abortRef.current = controleur;
      try {
        const trouves = await rechercherGlobalement(recherche, controleur.signal);
        setResultats(trouves.slice(0, 40));
        setIndexActif(0);
      } catch {
        /* requête annulée */
      } finally {
        setChargement(false);
      }
    }, 220);
    return () => clearTimeout(minuteur);
  }, [terme, paletteOuverte]);

  // La création demande d'abord la destination : on mémorise le titre saisi dans
  // la palette puis on ouvre la boîte de dialogue dédiée.
  const creerPage = useCallback(() => {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    setTitreNouvellePage(terme.trim());
    setNouvellePageOuverte(true);
  }, [terme, peutEditer, toasts]);

  const actions = useMemo<ActionRapide[]>(
    () => [
      {
        id: 'nouvelle-page',
        libelle: terme.trim() ? `Créer la page « ${terme.trim()} »` : 'Créer une nouvelle page',
        icone: Plus,
        executer: creerPage,
      },
      { id: 'accueil', libelle: 'Aller à l’accueil', icone: Home, executer: () => router.push(ROUTES.accueil) },
      { id: 'ia', libelle: 'Ouvrir NOVA IA', icone: Sparkles, executer: () => router.push(ROUTES.ia) },
      { id: 'inbox', libelle: 'Ouvrir la boîte de réception', icone: Inbox, executer: () => router.push(ROUTES.inbox) },
      { id: 'modeles', libelle: 'Parcourir les modèles', icone: Table, executer: () => router.push(ROUTES.modeles) },
      {
        id: 'parametres',
        libelle: 'Ouvrir les paramètres',
        icone: Settings,
        executer: () => router.push(ROUTES.parametres),
      },
      { id: 'corbeille', libelle: 'Ouvrir la corbeille', icone: Trash2, executer: () => router.push(ROUTES.corbeille) },
    ],
    [terme, creerPage, router]
  );

  const actionsFiltrees = useMemo(() => {
    const recherche = terme.trim().toLowerCase();
    if (!recherche) return actions;
    const parTexte = actions.filter((a) => a.libelle.toLowerCase().includes(recherche));
    return parTexte.length ? parTexte : [];
  }, [actions, terme]);

  /** Ouvre un résultat de recherche (page, bloc, élément). */
  const ouvrirResultat = useCallback(
    (resultat: ResultatRecherche) => {
      fermerPalette();
      if (resultat.type === 'page') {
        const page = pageParId(resultat.id);
        router.push(page ? lienPage(page) : `/page/${resultat.id}`);
        return;
      }
      if (resultat.pageId) {
        const page = pageParId(resultat.pageId);
        router.push(page ? lienPage(page) : `/page/${resultat.pageId}`);
        return;
      }
      router.push(ROUTES.recherche);
    },
    [fermerPalette, pageParId, router]
  );

  const totalActions = actionsFiltrees.length;
  const totalResultats = resultats.length;
  const total = totalActions + totalResultats;

  // Navigation clavier dans la liste.
  const surTouche = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndexActif((i) => (total ? (i + 1) % total : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndexActif((i) => (total ? (i - 1 + total) % total : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (indexActif < totalActions) {
        fermerPalette();
        actionsFiltrees[indexActif]?.executer();
      } else {
        const resultat = resultats[indexActif - totalActions];
        if (resultat) ouvrirResultat(resultat);
      }
    }
  };

  const modaleNouvellePage = (
    <ModaleNouvellePage
      ouvert={nouvellePageOuverte}
      onFermer={() => setNouvellePageOuverte(false)}
      titreInitial={titreNouvellePage}
    />
  );

  if (!paletteOuverte) return modaleNouvellePage;

  return (
    <>
      <div className="fixed inset-0 z-[75] flex items-start justify-center p-4 pt-[10vh]">
        <button
          type="button"
          aria-label="Fermer la palette de commandes"
          className="absolute inset-0 cursor-default bg-black/40"
          onClick={fermerPalette}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Palette de commandes"
          className="relative z-10 flex max-h-[70vh] w-full max-w-2xl animate-apparition flex-col overflow-hidden rounded-xl shadow-2xl"
          style={{ backgroundColor: 'var(--fond)', border: '1px solid var(--bordure)' }}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: 'var(--bordure)' }}>
            <Search className="h-4 w-4 shrink-0 texte-faible" />
            <input
              ref={refEntree}
              value={terme}
              onChange={(e) => setTerme(e.target.value)}
              onKeyDown={surTouche}
              placeholder="Rechercher des pages, blocs, éléments ou lancer une action…"
              className="w-full bg-transparent text-sm outline-none placeholder:texte-faible"
            />
            {chargement && <Loader2 className="h-4 w-4 shrink-0 animate-spin texte-faible" />}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5 defilement-fin">
            {actionsFiltrees.length > 0 && (
              <div className="mb-1">
                <p className="px-2 py-1 text-xs font-medium texte-faible">Actions rapides</p>
                {actionsFiltrees.map((action, index) => (
                  <BoutonResultat
                    key={action.id}
                    actif={indexActif === index}
                    icone={action.icone}
                    titre={action.libelle}
                    onSurvol={() => setIndexActif(index)}
                    onClick={() => {
                      fermerPalette();
                      action.executer();
                    }}
                  />
                ))}
              </div>
            )}

            {resultats.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-medium texte-faible">Résultats</p>
                {resultats.map((resultat, index) => {
                  const position = totalActions + index;
                  return (
                    <BoutonResultat
                      key={`${resultat.type}-${resultat.id}`}
                      actif={indexActif === position}
                      icone={resultat.type === 'element' ? Table : resultat.type === 'bloc' ? Hash : FileText}
                      titre={resultat.titre}
                      iconeDonnee={resultat.type === 'page' ? resultat.icone : undefined}
                      extrait={resultat.extrait}
                      onSurvol={() => setIndexActif(position)}
                      onClick={() => ouvrirResultat(resultat)}
                    />
                  );
                })}
              </div>
            )}

            {total === 0 && !chargement && terme.trim() && (
              <p className="px-3 py-8 text-center text-sm texte-doux">
                Aucun résultat pour « {terme.trim()} »
              </p>
            )}
            {total === 0 && !terme.trim() && (
              <p className="px-3 py-6 text-center text-xs texte-faible">
                Astuce : tapez pour rechercher dans tout l’espace de travail.
              </p>
            )}
          </div>

          <div
            className="flex items-center gap-4 px-3 py-2 text-xs texte-faible"
            style={{ borderTop: '1px solid var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
          >
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> pour ouvrir
            </span>
            <span>↑ ↓ pour naviguer</span>
            <span>Échap pour fermer</span>
          </div>
        </div>
      </div>

      {modaleNouvellePage}
    </>
  );
}

/** Ligne de résultat de la palette. */
function BoutonResultat({
  actif,
  icone: Icone,
  iconeDonnee,
  titre,
  extrait,
  onSurvol,
  onClick,
}: {
  actif?: boolean;
  icone: LucideIcon;
  iconeDonnee?: string;
  titre: string;
  extrait?: string;
  onSurvol?: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onSurvol}
      onClick={onClick}
      className={cn('menu-item', actif && 'lien-barre-actif')}
      style={actif ? { backgroundColor: 'var(--survol)' } : undefined}
    >
      {iconeDonnee !== undefined ? (
        <IconeDonnee icone={iconeDonnee} repli={Icone} className="h-4 w-4 shrink-0 texte-doux" />
      ) : (
        <Icone className="h-4 w-4 shrink-0 texte-doux" />
      )}
      <span className="min-w-0 flex-1 truncate">{titre}</span>
      {extrait && <span className="shrink-0 truncate text-xs texte-faible">{extrait}</span>}
    </button>
  );
}
