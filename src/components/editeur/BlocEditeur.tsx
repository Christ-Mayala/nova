'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Columns3,
  Copy,
  FileText,
  GripVertical,
  Lightbulb,
  List,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState, type KeyboardEvent } from 'react';

import { ChampAuto } from '@/components/editeur/ChampAuto';
import { filtrerCatalogue, MenuSlash, MenuTransformer } from '@/components/editeur/MenuSlash';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Menu, MenuElement, MenuSeparateur, MenuTitre } from '@/components/ui/Menu';
import { Modale } from '@/components/ui/Modale';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { demanderIA, medias } from '@/lib/api';
import { iconeParTypeBloc, libelleTypeBloc } from '@/lib/icones';
import { lienEspace, lienPage } from '@/lib/navigation';
import type { Bloc, Page, TypeBloc } from '@/lib/types';
import { cn, identifiantDe } from '@/lib/utils';

/** Entrée du sommaire : un titre de la page avec son niveau hiérarchique. */
export interface TitreSommaire {
  id: string;
  niveau: number;
  texte: string;
}

interface ProprietesBlocEditeur {
  bloc: Bloc;
  titres: TitreSommaire[];
  textePage: string;
  onContenu: (valeur: string) => void;
  onPropriete: (cle: string, valeur: unknown) => void;
  onType: (type: TypeBloc) => void;
  onSupprimer: () => void;
  onAjouterApres: (type?: TypeBloc) => void;
  onDeplacer: (direction: 'haut' | 'bas') => void;
  onDupliquer: () => void;
  onFocusPrecedent: () => void;
  /** Crée une base de données rattachée à la page (bloc « base en ligne »). */
  onCreerBase?: () => void;
}

/** Un bloc de la page : rendu, édition, menu slash et actions contextuelles. */
export function BlocEditeur({
  bloc,
  titres,
  textePage,
  onContenu,
  onPropriete,
  onType,
  onSupprimer,
  onAjouterApres,
  onDeplacer,
  onDupliquer,
  onFocusPrecedent,
  onCreerBase,
}: ProprietesBlocEditeur) {
  const [menuSlash, setMenuSlash] = useState<{ ouvert: boolean; requete: string; index: number }>({
    ouvert: false,
    requete: '',
    index: 0,
  });
  const [basculeOuverte, setBasculeOuverte] = useState(Boolean(bloc.proprietes?.ouvert));

  const texte = bloc.contenu || '';

  /** Gère les raccourcis clavier communs à tous les blocs textuels. */
  function surTouche(e: KeyboardEvent<HTMLTextAreaElement>) {
    const cible = e.currentTarget;

    if (menuSlash.ouvert) {
      const liste = filtrerCatalogue(menuSlash.requete);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMenuSlash((m) => ({ ...m, index: (m.index + 1) % Math.max(liste.length, 1) }));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMenuSlash((m) => ({ ...m, index: (m.index - 1 + liste.length) % Math.max(liste.length, 1) }));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const choix = liste[menuSlash.index];
        if (choix) choisirType(choix.type);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenuSlash({ ouvert: false, requete: '', index: 0 });
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onAjouterApres();
      return;
    }

    if (e.key === 'Backspace' && texte === '' && cible.selectionStart === 0) {
      e.preventDefault();
      onFocusPrecedent();
      onSupprimer();
    }
  }

  /** Détecte la saisie de « / » en début de bloc pour ouvrir le menu slash. */
  function surChangement(valeur: string) {
    if (valeur.startsWith('/')) {
      setMenuSlash({ ouvert: true, requete: valeur.slice(1), index: 0 });
      onContenu('');
      return;
    }
    if (menuSlash.ouvert) setMenuSlash({ ouvert: false, requete: '', index: 0 });
    onContenu(valeur);
  }

  function choisirType(type: TypeBloc) {
    setMenuSlash({ ouvert: false, requete: '', index: 0 });
    onType(type);
  }

  return (
    <div className="group/bloc relative flex items-start">
      {/* Poignée de déplacement et insertion */}
      <div className="absolute -left-14 top-0 flex h-7 items-center gap-0.5 opacity-0 transition-opacity group-hover/bloc:opacity-100">
        <button
          type="button"
          onClick={() => onAjouterApres()}
          className="flex h-6 w-6 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Ajouter un bloc en dessous"
        >
          <Plus className="h-4 w-4" />
        </button>
        <Menu
          alignement="gauche"
          largeur="w-64"
          declencheur={
            <button
              type="button"
              className="flex h-6 w-6 cursor-grab items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Options du bloc"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          }
        >
          <div className="max-h-[60vh] overflow-y-auto defilement-fin">
            <MenuElement icone={ArrowUp} onClick={() => onDeplacer('haut')}>
              Déplacer vers le haut
            </MenuElement>
            <MenuElement icone={ArrowDown} onClick={() => onDeplacer('bas')}>
              Déplacer vers le bas
            </MenuElement>
            <MenuElement icone={Copy} onClick={onDupliquer}>
              Dupliquer
            </MenuElement>
            <MenuElement icone={Trash2} danger onClick={onSupprimer}>
              Supprimer
            </MenuElement>
            <MenuSeparateur />
            <MenuTitre>Transformer en</MenuTitre>
            <MenuTransformer onChoisir={onType} />
          </div>
        </Menu>
      </div>

      <div className="relative min-w-0 flex-1">
        <RenduBloc
          bloc={bloc}
          texte={texte}
          titres={titres}
          textePage={textePage}
          basculeOuverte={basculeOuverte}
          setBasculeOuverte={setBasculeOuverte}
          surChangement={surChangement}
          surTouche={surTouche}
          onContenu={onContenu}
          onPropriete={onPropriete}
          onCreerBase={onCreerBase}
        />
        {menuSlash.ouvert && (
          <MenuSlash
            liste={filtrerCatalogue(menuSlash.requete)}
            indexActif={menuSlash.index}
            onChoisir={choisirType}
            onSurvol={(index) => setMenuSlash((m) => ({ ...m, index }))}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rendu selon le type de bloc                                         */
/* ------------------------------------------------------------------ */

const CLASSES_TITRE: Record<string, string> = {
  titre_1: 'text-3xl font-bold leading-tight',
  titre_2: 'text-2xl font-semibold leading-tight',
  titre_3: 'text-xl font-semibold leading-tight',
};

function RenduBloc({
  bloc,
  texte,
  titres,
  textePage,
  basculeOuverte,
  setBasculeOuverte,
  surChangement,
  surTouche,
  onContenu,
  onPropriete,
  onCreerBase,
}: {
  bloc: Bloc;
  texte: string;
  titres: TitreSommaire[];
  textePage: string;
  basculeOuverte: boolean;
  setBasculeOuverte: (v: boolean) => void;
  surChangement: (valeur: string) => void;
  surTouche: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onContenu: (valeur: string) => void;
  onPropriete: (cle: string, valeur: unknown) => void;
  onCreerBase?: () => void;
}) {
  const champ = (className?: string, placeholder?: string) => (
    <ChampAuto
      valeur={texte}
      onChange={surChangement}
      onKeyDown={surTouche}
      data-bloc={bloc._id}
      placeholder={placeholder}
      className={className}
    />
  );

  switch (bloc.type) {
    case 'titre_1':
    case 'titre_2':
    case 'titre_3':
      return (
        <div className="py-0.5">
          {champ(`font-bold ${CLASSES_TITRE[bloc.type]}`, `Titre ${bloc.type.slice(-1)}`)}
        </div>
      );

    case 'liste_a_puces':
      return (
        <div className="flex items-start gap-2 py-0.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--texte)' }} />
          {champ()}
        </div>
      );

    case 'liste_numerotee':
      return (
        <div className="flex items-start gap-2 py-0.5">
          <span className="mt-1 w-4 shrink-0 text-right texte-doux">1.</span>
          {champ()}
        </div>
      );

    case 'a_faire':
      return (
        <div className="flex items-start gap-2 py-0.5">
          <input
            type="checkbox"
            checked={Boolean(bloc.proprietes?.coche)}
            onChange={(e) => onPropriete('coche', e.target.checked)}
            className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded border-neutral-400 accent-sky-500"
            aria-label="Tâche terminée"
          />
          {champ(Boolean(bloc.proprietes?.coche) ? 'line-through texte-doux' : undefined, 'À faire')}
        </div>
      );

    case 'bascule':
      return (
        <div className="py-0.5">
          <div className="flex items-start gap-1">
            <button
              type="button"
              onClick={() => {
                setBasculeOuverte(!basculeOuverte);
                onPropriete('ouvert', !basculeOuverte);
              }}
              className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
              aria-label={basculeOuverte ? 'Replier' : 'Déplier'}
            >
              <ChevronRight className={cn('h-4 w-4 transition-transform', basculeOuverte && 'rotate-90')} />
            </button>
            {champ('font-medium', 'Bascule')}
          </div>
          {basculeOuverte && (
            <div className="ml-6 mt-1 text-sm texte-doux">
              Contenu repliable associé à cette bascule.
            </div>
          )}
        </div>
      );

    case 'citation':
      return (
        <div className="border-l-[3px] py-0.5 pl-3" style={{ borderColor: 'var(--texte)' }}>
          {champ(undefined, 'Citer une source…')}
        </div>
      );

    case 'encadre':
      return (
        <div
          className="flex items-start gap-2.5 rounded-md p-3"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
          {champ(undefined, 'Mettre en avant une information…')}
        </div>
      );

    case 'code':
      return (
        <div className="rounded-md p-3" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          <ChampAuto
            valeur={texte}
            onChange={surChangement}
            onKeyDown={surTouche}
            data-bloc={bloc._id}
            placeholder="// votre code…"
            spellCheck={false}
            className="font-mono text-[13px] leading-relaxed"
          />
        </div>
      );

    case 'math':
      return (
        <div className="rounded-md p-3 text-center" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          <ChampAuto
            valeur={texte}
            onChange={surChangement}
            onKeyDown={surTouche}
            data-bloc={bloc._id}
            placeholder="E = mc^2"
            spellCheck={false}
            className="text-center font-mono"
          />
        </div>
      );

    case 'separateur':
      return (
        <div className="py-2">
          <div className="h-px w-full" style={{ backgroundColor: 'var(--bordure-forte)' }} />
        </div>
      );

    case 'image':
    case 'video':
    case 'audio':
    case 'fichier':
    case 'signet':
    case 'embed':
      return <BlocMedia bloc={bloc} onPropriete={onPropriete} />;

    case 'sommaire':
      return <BlocSommaire titres={titres} />;

    case 'fil_ariane':
      return <BlocFilAriane pageId={bloc.pageId} />;

    case 'colonne':
      return <BlocColonnes bloc={bloc} onPropriete={onPropriete} />;

    case 'tableau':
      return <BlocTableau bloc={bloc} onPropriete={onPropriete} />;

    case 'base_en_ligne':
      return <BlocBaseEnLigne onCreerBase={onCreerBase} />;

    case 'note':
      return <BlocNote bloc={bloc} onContenu={onContenu} onPropriete={onPropriete} />;

    case 'lien_page':
      return <BlocLienPage bloc={bloc} onPropriete={onPropriete} />;

    case 'ia_resume':
    case 'ia_actions':
      return <BlocIA bloc={bloc} textePage={textePage} onPropriete={onPropriete} />;

    case 'bloc_synchro':
    case 'bouton_modele':
      return (
        <BlocPlaceholder
          icone={iconeParTypeBloc[bloc.type]}
          titre={libelleTypeBloc[bloc.type]}
          description={texte || descriptionParType(bloc.type)}
        />
      );

    default:
      return <div className="py-0.5">{champ(undefined, "Écrivez quelque chose, ou tapez « / » pour insérer un bloc…")}</div>;
  }
}

/** Descriptions par défaut des blocs spéciaux/IA. */
function descriptionParType(type: TypeBloc): string {
  switch (type) {
    case 'lien_page':
      return 'Référence vers une autre page de l’espace de travail.';
    case 'bloc_synchro':
      return 'Contenu partagé et synchronisé entre plusieurs pages.';
    case 'bouton_modele':
      return 'Insère un modèle prédéfini en un clic.';
    case 'ia_resume':
      return 'Résumé généré automatiquement à partir de la page.';
    case 'ia_actions':
      return 'Extrait les actions à mener depuis le contenu de la page.';
    default:
      return '';
  }
}

/** Types de blocs dont l’URL peut être fournie par un fichier local. */
const TYPES_IMPORTABLES: TypeBloc[] = ['image', 'video', 'audio', 'fichier'];

/** Valeur de l’attribut `accept` du sélecteur de fichier selon le type de bloc. */
function acceptPour(type: TypeBloc): string | undefined {
  if (type === 'image') return 'image/*';
  if (type === 'video') return 'video/*';
  if (type === 'audio') return 'audio/*';
  return undefined; // « fichier » : tous types confondus.
}

/** Rendu d'un bloc média ou d'intégration (champ URL + import local + aperçu). */
function BlocMedia({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const url = String(bloc.proprietes?.url || '');
  const legende = String(bloc.proprietes?.legende || '');
  const Icone = iconeParTypeBloc[bloc.type];
  const { erreur: afficherErreur, succes: afficherSucces } = useToasts();
  const refFichier = useRef<HTMLInputElement>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const importable = TYPES_IMPORTABLES.includes(bloc.type);
  const libelles: Partial<Record<TypeBloc, string>> = {
    image: 'Coller l’URL d’une image',
    video: 'Coller l’URL d’une vidéo (YouTube, Vimeo…)',
    audio: 'Coller l’URL d’un fichier audio',
    fichier: 'Coller l’URL d’un fichier',
    signet: 'Coller l’URL à mettre en signet',
    embed: 'Coller l’URL à intégrer (Figma, Loom, Maps…)',
  };

  const televerser = async (fichier: File | undefined) => {
    if (!fichier || envoiEnCours) return;
    setEnvoiEnCours(true);
    try {
      const reponse = await medias.televerser(fichier);
      const urlTeleversee = reponse.data?.url;
      if (!urlTeleversee) {
        afficherErreur('Import impossible', 'Le serveur n’a renvoyé aucune URL pour ce média.');
        return;
      }
      onPropriete('url', urlTeleversee);
      afficherSucces('Média importé', fichier.name);
    } catch (e) {
      afficherErreur(
        'Échec de l’import',
        e instanceof Error ? e.message : 'Le téléversement du fichier a échoué.'
      );
    } finally {
      setEnvoiEnCours(false);
      if (refFichier.current) refFichier.current.value = '';
    }
  };

  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--bordure)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icone className="h-4 w-4 shrink-0 texte-doux" />
          <input
            value={url}
            onChange={(e) => onPropriete('url', e.target.value)}
            placeholder={libelles[bloc.type] || 'URL'}
            className="w-full bg-transparent text-sm outline-none placeholder:texte-faible"
          />
        </div>
        {importable && (
          <>
            <button
              type="button"
              onClick={() => refFichier.current?.click()}
              disabled={envoiEnCours}
              className="bouton shrink-0 gap-1.5 text-xs"
            >
              {envoiEnCours ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {envoiEnCours ? 'Import en cours…' : 'Importer depuis l’appareil'}
            </button>
            <input
              ref={refFichier}
              type="file"
              accept={acceptPour(bloc.type)}
              className="hidden"
              onChange={(e) => televerser(e.target.files?.[0])}
            />
          </>
        )}
      </div>

      {url && bloc.type === 'image' && (
        <div className="mt-3 overflow-hidden rounded">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={legende || 'Image'} className="max-h-96 w-full object-contain" />
        </div>
      )}
      {url && bloc.type === 'signet' && (
        <a href={url} target="_blank" rel="noreferrer" className="mt-3 block rounded border p-2 text-sm texte-doux hover:bg-black/[0.03] dark:hover:bg-white/[0.04]" style={{ borderColor: 'var(--bordure)' }}>
          {url}
        </a>
      )}
      {url && (bloc.type === 'video' || bloc.type === 'embed') && (
        <p className="mt-3 text-xs texte-doux">Aperçu intégré disponible à l’ouverture du lien.</p>
      )}

      <input
        value={legende}
        onChange={(e) => onPropriete('legende', e.target.value)}
        placeholder="Ajouter une légende…"
        className="mt-2 w-full bg-transparent text-xs outline-none placeholder:texte-faible texte-doux"
      />
    </div>
  );
}

/** Tableau éditable : colonnes et lignes stockées dans `proprietes.tableau`. */
function BlocTableau({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const { peutEditer } = useAuth();
  const brut = bloc.proprietes?.tableau as
    | { colonnes?: unknown; lignes?: unknown }
    | undefined;

  const colonnesBrutes = Array.isArray(brut?.colonnes)
    ? brut.colonnes
    : Array.isArray(bloc.proprietes?.colonnes)
      ? (bloc.proprietes.colonnes as unknown[])
      : [];
  const colonnes = (colonnesBrutes.length ? colonnesBrutes : ['Colonne A', 'Colonne B', 'Colonne C']).map(
    (valeur) => String(valeur ?? '')
  );

  const lignesBrutes = Array.isArray(brut?.lignes)
    ? brut.lignes
    : Array.isArray(bloc.proprietes?.lignes)
      ? (bloc.proprietes.lignes as unknown[])
      : [];
  const lignes = lignesBrutes.length
    ? lignesBrutes.map((ligne) =>
        Array.isArray(ligne) ? colonnes.map((_, index) => String(ligne[index] ?? '')) : colonnes.map(() => '')
      )
    : [colonnes.map(() => ''), colonnes.map(() => '')];

  const enregistrer = (nouvellesColonnes: string[], nouvellesLignes: string[][]) =>
    onPropriete('tableau', { colonnes: nouvellesColonnes, lignes: nouvellesLignes });

  const modifierColonne = (index: number, valeur: string) => {
    const suite = colonnes.slice();
    suite[index] = valeur;
    enregistrer(suite, lignes.map((ligne) => ligne.slice()));
  };

  const modifierCellule = (ligne: number, colonne: number, valeur: string) => {
    const suite = lignes.map((l) => l.slice());
    while (suite[ligne].length < colonnes.length) suite[ligne].push('');
    suite[ligne][colonne] = valeur;
    enregistrer(colonnes.slice(), suite);
  };

  const ajouterLigne = () =>
    enregistrer(colonnes.slice(), [...lignes.map((ligne) => ligne.slice()), colonnes.map(() => '')]);

  const supprimerLigne = (index: number) =>
    enregistrer(
      colonnes.slice(),
      lignes.filter((_, i) => i !== index).map((ligne) => ligne.slice())
    );

  const ajouterColonne = () =>
    enregistrer(
      [...colonnes, `Colonne ${colonnes.length + 1}`],
      lignes.map((ligne) => [...ligne.slice(), ''])
    );

  return (
    <div
      className="my-1 overflow-x-auto rounded-lg border"
      style={{ borderColor: 'var(--bordure)' }}
    >
      <table className="w-full min-w-max border-collapse text-sm">
        <thead style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          <tr>
            {colonnes.map((titre, index) => (
              <th
                key={index}
                className="min-w-[140px] border-b px-0 text-left font-medium"
                style={{ borderColor: 'var(--bordure)' }}
              >
                <input
                  value={titre}
                  onChange={(e) => modifierColonne(index, e.target.value)}
                  readOnly={!peutEditer}
                  placeholder="Colonne"
                  className="w-full bg-transparent px-3 py-2 text-sm font-medium outline-none placeholder:texte-faible"
                />
              </th>
            ))}
            <th className="w-8 border-b" style={{ borderColor: 'var(--bordure)' }} />
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, indexLigne) => (
            <tr
              key={indexLigne}
              className="group/ligne border-b last:border-b-0"
              style={{ borderColor: 'var(--bordure)' }}
            >
              {colonnes.map((_, indexColonne) => (
                <td key={indexColonne} className="px-0 align-middle">
                  <input
                    value={ligne[indexColonne] ?? ''}
                    onChange={(e) => modifierCellule(indexLigne, indexColonne, e.target.value)}
                    readOnly={!peutEditer}
                    placeholder="—"
                    className="w-full bg-transparent px-3 py-1.5 text-sm texte-doux outline-none placeholder:texte-faible"
                  />
                </td>
              ))}
              <td className="px-1 align-middle">
                {peutEditer && (
                  <button
                    type="button"
                    onClick={() => supprimerLigne(indexLigne)}
                    className="flex h-6 w-6 items-center justify-center rounded texte-faible opacity-0 transition-opacity hover:bg-black/5 group-hover/ligne:opacity-100 dark:hover:bg-white/10"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {peutEditer && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1.5" style={{ borderTop: '1px solid var(--bordure)' }}>
          <button
            type="button"
            onClick={ajouterLigne}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs texte-doux hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5" />
            Ligne
          </button>
          <button
            type="button"
            onClick={ajouterColonne}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs texte-doux hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <Plus className="h-3.5 w-3.5" />
            Colonne
          </button>
        </div>
      )}
    </div>
  );
}

/** Rendu d'un bloc non encore implémenté (données gérées par le backend). */
function BlocPlaceholder({
  icone: Icone,
  titre,
  description,
}: {
  icone: LucideIcon;
  titre: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-dashed p-3" style={{ borderColor: 'var(--bordure-forte)' }}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{titre}</p>
        <p className="mt-0.5 text-xs texte-doux">{description}</p>
      </div>
    </div>
  );
}

/** Bloc « Base de données en ligne » : crée un tableau rattaché à la page. */
function BlocBaseEnLigne({ onCreerBase }: { onCreerBase?: () => void }) {
  const Icone = iconeParTypeBloc.base_en_ligne;
  return (
    <div
      className="flex flex-col gap-3 rounded-md border border-dashed p-3"
      style={{ borderColor: 'var(--bordure-forte)' }}
    >
      <div className="flex items-start gap-3">
        <Icone className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Base de données en ligne</p>
          <p className="mt-0.5 text-xs texte-doux">
            Créez un tableau (colonnes, vues et lignes) directement lié à cette page.
          </p>
        </div>
      </div>
      {onCreerBase && (
        <button
          type="button"
          onClick={onCreerBase}
          className="bouton bouton-primaire self-start gap-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un tableau
        </button>
      )}
    </div>
  );
}

/**
 * Bloc « Note » : une note autonome (titre + zone de texte), distincte d'une
 * nouvelle page. La touche Entrée ajoute simplement une ligne — l'écriture
 * reste simple, sans découpage en blocs.
 */
function BlocNote({
  bloc,
  onContenu,
  onPropriete,
}: {
  bloc: Bloc;
  onContenu: (valeur: string) => void;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const Icone = iconeParTypeBloc.note;
  const titre = String(bloc.proprietes?.titre || '');
  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Icone className="h-4 w-4 shrink-0 texte-doux" />
        <ChampAuto
          valeur={titre}
          onChange={(valeur) => onPropriete('titre', valeur)}
          data-bloc={bloc._id}
          placeholder="Titre de la note"
          className="font-semibold"
        />
      </div>
      <ChampAuto
        valeur={bloc.contenu || ''}
        onChange={onContenu}
        placeholder="Écrivez votre note…"
        className="text-sm leading-relaxed texte-doux"
      />
    </div>
  );
}

/** Bloc « Sommaire » : table des matières générée depuis les titres de la page. */
function BlocSommaire({ titres }: { titres: TitreSommaire[] }) {
  if (titres.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm texte-faible" style={{ borderColor: 'var(--bordure-forte)' }}>
        Ajoutez des titres à cette page pour générer un sommaire.
      </div>
    );
  }
  return (
    <nav className="rounded-md border p-3" style={{ borderColor: 'var(--bordure)' }} aria-label="Sommaire">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium texte-doux">
        <List className="h-3.5 w-3.5" />
        Sommaire
      </p>
      <ul className="flex flex-col gap-0.5">
        {titres.map((titre) => (
          <li key={titre.id} style={{ paddingLeft: `${(titre.niveau - 1) * 14}px` }}>
            <button
              type="button"
              onClick={() =>
                document
                  .querySelector(`[data-bloc="${titre.id}"]`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
              className="block w-full truncate rounded px-1.5 py-0.5 text-left text-sm texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            >
              {titre.texte}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Bloc « Fil d'Ariane » : chemin de navigation vers la page courante. */
function BlocFilAriane({ pageId }: { pageId?: string }) {
  const { pageParId, espaceParId } = useDonnees();

  const page = pageId ? pageParId(pageId) : undefined;
  if (!page) return <p className="py-1 text-sm texte-faible">Fil d’Ariane indisponible.</p>;

  const chaine: Page[] = [];
  const vus = new Set<string>();
  let courant: Page | undefined = page;
  while (courant && !vus.has(courant._id)) {
    vus.add(courant._id);
    chaine.unshift(courant);
    const parentId: string | null | undefined = courant.parentId;
    courant = parentId ? pageParId(parentId) : undefined;
  }

  const espace = page.espaceId ? espaceParId(identifiantDe(page.espaceId)) : undefined;

  return (
    <nav className="flex flex-wrap items-center gap-1 py-1 text-sm" aria-label="Fil d’Ariane">
      {espace && (
        <>
          <Link href={lienEspace(espace)} className="texte-doux hover:underline">
            {espace.nom}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 texte-faible" />
        </>
      )}
      {chaine.map((element, index) => (
        <span key={element._id} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 texte-faible" />}
          {index === chaine.length - 1 ? (
            <span className="font-medium">{element.titre || 'Sans titre'}</span>
          ) : (
            <Link href={lienPage(element)} className="texte-doux hover:underline">
              {element.titre || 'Sans titre'}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Bloc « Lien vers une page » : référence une autre page de l'espace. */
function BlocLienPage({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const { pages, pageParId } = useDonnees();
  const [ouvert, setOuvert] = useState(false);
  const [requete, setRequete] = useState('');

  const cibleId = String(bloc.proprietes?.pageId || '');
  const cible = cibleId ? pageParId(cibleId) : undefined;

  const terme = requete.trim().toLowerCase();
  const resultats = pages
    .filter((p) => p._id !== bloc.pageId)
    .filter((p) => !terme || (p.titre || 'Sans titre').toLowerCase().includes(terme))
    .slice(0, 40);

  return (
    <div className="py-0.5">
      {cible ? (
        <div className="flex items-center gap-2">
          <Link
            href={lienPage(cible)}
            className="flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            <IconeDonnee icone={cible.icone} repli={FileText} className="h-4 w-4 shrink-0 texte-doux" />
            <span className="truncate font-medium">{cible.titre || 'Sans titre'}</span>
          </Link>
          <button type="button" onClick={() => setOuvert(true)} className="shrink-0 text-xs texte-faible hover:underline">
            Changer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="flex items-center gap-2 rounded border border-dashed px-2 py-1.5 text-sm texte-doux hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          style={{ borderColor: 'var(--bordure-forte)' }}
        >
          <FileText className="h-4 w-4" />
          Choisir une page à référencer
        </button>
      )}

      <Modale
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        titre="Lier une page"
        description="Sélectionnez la page à référencer depuis cette page."
        largeur="max-w-md"
      >
        <input
          autoFocus
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          placeholder="Rechercher une page…"
          className="champ mb-3"
        />
        <ul className="max-h-72 overflow-y-auto defilement-fin">
          {resultats.map((p) => (
            <li key={p._id}>
              <button
                type="button"
                onClick={() => {
                  onPropriete('pageId', p._id);
                  setOuvert(false);
                  setRequete('');
                }}
                className="menu-item w-full"
              >
                <IconeDonnee icone={p.icone} repli={FileText} className="h-4 w-4 shrink-0 texte-doux" />
                <span className="truncate">{p.titre || 'Sans titre'}</span>
              </button>
            </li>
          ))}
          {resultats.length === 0 && <li className="px-2 py-3 text-sm texte-faible">Aucune page trouvée.</li>}
        </ul>
      </Modale>
    </div>
  );
}

/** Bloc « Colonnes » : disposition de 2 à 5 colonnes. */
function BlocColonnes({
  bloc,
  onPropriete,
}: {
  bloc: Bloc;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const nb = Math.min(5, Math.max(2, Number(bloc.proprietes?.colonnes) || 2));

  return (
    <div className="py-1">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Columns3 className="h-3.5 w-3.5 texte-faible" />
        <span className="text-xs texte-faible">Colonnes</span>
        <div className="flex items-center gap-0.5">
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPropriete('colonnes', n)}
              className={cn(
                'h-5 w-5 rounded text-xs',
                n === nb
                  ? 'lien-barre-actif'
                  : 'texte-doux hover:bg-black/5 dark:hover:bg-white/10'
              )}
              aria-label={`${n} colonnes`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${nb}, minmax(0, 1fr))` }}>
        {Array.from({ length: nb }).map((_, index) => (
          <div
            key={index}
            className="rounded-md border border-dashed p-3 text-sm texte-faible"
            style={{ borderColor: 'var(--bordure-forte)' }}
          >
            Colonne {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bloc IA : résumé ou extraction d'actions générés via le proxy d'inférence. */
function BlocIA({
  bloc,
  textePage,
  onPropriete,
}: {
  bloc: Bloc;
  textePage: string;
  onPropriete: (cle: string, valeur: unknown) => void;
}) {
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const resume = bloc.type === 'ia_resume';
  const resultat = String(bloc.proprietes?.resultat || '');
  const Icone = iconeParTypeBloc[bloc.type];

  async function generer() {
    if (!textePage.trim()) {
      setErreur('Ajoutez du contenu à la page avant de générer.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const { contenu } = await demanderIA([
        {
          role: 'system',
          content: resume
            ? 'Tu résumes des documents en français, de façon concise et structurée.'
            : 'Tu extrais les tâches à accomplir d’un document, en français, sous forme de liste à puces.',
        },
        {
          role: 'user',
          content: resume
            ? `Résume le contenu de la page suivant :\n\n${textePage}`
            : `Liste les actions à mener à partir du contenu de la page suivant :\n\n${textePage}`,
        },
      ]);
      onPropriete('resultat', contenu);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Génération impossible.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <div
      className="rounded-md border p-3"
      style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
    >
      <div className="flex items-center gap-2">
        <Icone className="h-4 w-4 shrink-0 texte-doux" />
        <span className="text-sm font-medium">{resume ? 'Résumé IA' : 'Actions IA'}</span>
        <button
          type="button"
          onClick={generer}
          disabled={chargement}
          className="bouton ml-auto text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {chargement ? 'Génération…' : resultat ? 'Régénérer' : 'Générer'}
        </button>
      </div>
      {erreur && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{erreur}</p>}
      {resultat ? (
        <p className="mt-2 whitespace-pre-wrap text-sm texte-doux">{resultat}</p>
      ) : (
        !erreur && <p className="mt-2 text-xs texte-faible">{descriptionParType(bloc.type)}</p>
      )}
    </div>
  );
}
