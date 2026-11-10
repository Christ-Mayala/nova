'use client';

import {
  Figma,
  FileText,
  Github,
  HardDrive,
  Kanban,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plug,
  PlugZap,
  Plus,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Bascule } from '@/components/ui/Bascule';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { Modale } from '@/components/ui/Modale';
import { useConfirmation } from '@/components/ui/Confirmation';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { connexions as apiConnexions, executer, listerTout } from '@/lib/api';
import type { Connexion } from '@/lib/types';

interface ChampConfig {
  cle: string;
  label: string;
  placeholder?: string;
}

interface TypeConnexion {
  type: string;
  libelle: string;
  icone: LucideIcon;
  description: string;
  champs: ChampConfig[];
}

/** Catalogue des intégrations proposées (cf. « Connections » de NOVA). */
const CATALOGUE: TypeConnexion[] = [
  {
    type: 'slack',
    libelle: 'Slack',
    icone: MessageSquare,
    description: 'Recevoir les notifications et mentions dans vos canaux.',
    champs: [
      { cle: 'canal', label: 'Canal', placeholder: '#general' },
      { cle: 'webhook', label: 'URL de webhook', placeholder: 'https://hooks.slack.com/…' },
    ],
  },
  {
    type: 'github',
    libelle: 'GitHub',
    icone: Github,
    description: 'Synchroniser issues, pull requests et dépôts.',
    champs: [
      { cle: 'organisation', label: 'Organisation', placeholder: 'acme' },
      { cle: 'depotDefaut', label: 'Dépôt par défaut', placeholder: 'api' },
      { cle: 'jeton', label: 'Jeton d’accès', placeholder: 'ghp_…' },
    ],
  },
  {
    type: 'jira',
    libelle: 'Jira',
    icone: Kanban,
    description: 'Importer les tickets et les sprints.',
    champs: [
      { cle: 'projet', label: 'Clé de projet', placeholder: 'SPRINT' },
      { cle: 'domaine', label: 'Domaine', placeholder: 'acme.atlassian.net' },
    ],
  },
  {
    type: 'google_drive',
    libelle: 'Google Drive',
    icone: HardDrive,
    description: 'Importer des fichiers et des dossiers.',
    champs: [
      { cle: 'dossierRacine', label: 'Dossier racine', placeholder: 'NOVA/Exports' },
      { cle: 'jeton', label: 'Jeton d’accès Google (OAuth)', placeholder: 'ya29.…' },
    ],
  },
  {
    type: 'figma',
    libelle: 'Figma',
    icone: Figma,
    description: 'Intégrer les maquettes et les prototypes.',
    champs: [
      { cle: 'equipe', label: 'Équipe', placeholder: 'Design' },
      { cle: 'fichierDefaut', label: 'Fichier par défaut' },
    ],
  },
  {
    type: 'import_fichiers',
    libelle: 'Import de fichiers',
    icone: FileText,
    description: 'Importer un espace de travail existant depuis des fichiers Markdown ou CSV.',
    champs: [{ cle: 'dossierSource', label: 'Dossier source', placeholder: 'exports/' }],
  },
  {
    type: 'zoom',
    libelle: 'Zoom',
    icone: Video,
    description: 'Créer des réunions directement depuis vos pages.',
    champs: [{ cle: 'compte', label: 'Compte' }],
  },
  {
    type: 'gmail',
    libelle: 'Gmail',
    icone: Mail,
    description: 'Capturer les e-mails et leurs pièces jointes.',
    champs: [{ cle: 'libelle', label: 'Libellé', placeholder: 'INBOX' }],
  },
];

/** Icône d'une connexion selon son type (repli générique). */
function iconeConnexion(type: string): LucideIcon {
  return CATALOGUE.find((t) => t.type === type)?.icone || Plug;
}

/** Libellé d'un type de connexion. */
function libelleConnexion(type: string): string {
  return CATALOGUE.find((t) => t.type === type)?.libelle || type;
}

interface Brouillon {
  _id?: string;
  type: string;
  nom: string;
  active: boolean;
  config: Record<string, string>;
}

/** Connexions et intégrations tierces de l'espace de travail. */
export default function PageParametresConnexions() {
  const { estAdmin } = useAuth();
  const toasts = useToasts();
  const confirmer = useConfirmation();

  const [connexions, setConnexions] = useState<Connexion[]>([]);
  const [chargement, setChargement] = useState(true);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [testEnCours, setTestEnCours] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const liste = await listerTout(apiConnexions, { sort: '-createdAt' });
      setConnexions(liste);
    } catch {
      setConnexions([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const ouvrirCreation = useCallback(() => {
    const premier = CATALOGUE[0];
    const config: Record<string, string> = {};
    premier.champs.forEach((champ) => {
      config[champ.cle] = '';
    });
    setBrouillon({ type: premier.type, nom: premier.libelle, active: true, config });
  }, []);

  const ouvrirEdition = useCallback((connexion: Connexion) => {
    const modele = CATALOGUE.find((t) => t.type === connexion.type);
    const config: Record<string, string> = {};
    const source = (connexion.config || {}) as Record<string, unknown>;
    (modele?.champs || []).forEach((champ) => {
      config[champ.cle] = source[champ.cle] ? String(source[champ.cle]) : '';
    });
    Object.entries(source).forEach(([cle, valeur]) => {
      if (!(cle in config)) config[cle] = valeur ? String(valeur) : '';
    });
    setBrouillon({
      _id: connexion._id,
      type: connexion.type,
      nom: connexion.nom,
      active: connexion.active !== false,
      config,
    });
  }, []);

  /** Change le type du brouillon et reconstruit les champs de configuration. */
  const changerType = useCallback((type: string) => {
    const modele = CATALOGUE.find((t) => t.type === type);
    if (!modele) return;
    setBrouillon((b) => {
      if (!b) return b;
      const config: Record<string, string> = {};
      modele.champs.forEach((champ) => {
        config[champ.cle] = b.config[champ.cle] || '';
      });
      return { ...b, type, nom: b._id ? b.nom : modele.libelle, config };
    });
  }, []);

  const enregistrer = useCallback(async () => {
    if (!brouillon) return;
    if (!estAdmin) {
      toasts.erreur('Action réservée aux administrateurs');
      return;
    }
    const nom = brouillon.nom.trim() || libelleConnexion(brouillon.type);
    setEnregistrement(true);
    try {
      const donnees: Partial<Connexion> = {
        type: brouillon.type,
        nom,
        active: brouillon.active,
        config: brouillon.config,
      };
      if (brouillon._id) {
        await apiConnexions.maj(brouillon._id, donnees);
        toasts.succes('Connexion mise à jour');
      } else {
        await apiConnexions.creer(donnees);
        toasts.succes('Connexion ajoutée');
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
    async (connexion: Connexion) => {
      if (!estAdmin) {
        toasts.erreur('Action réservée aux administrateurs');
        return;
      }
      const ok = await confirmer({
        titre: `Supprimer « ${connexion.nom} » ?`,
        message: 'Cette intégration ne sera plus disponible dans vos pages.',
        libelleConfirmer: 'Supprimer',
        danger: true,
      });
      if (!ok) return;
      try {
        await apiConnexions.supprimer(connexion._id);
        setConnexions((prec) => prec.filter((c) => c._id !== connexion._id));
        toasts.succes('Connexion supprimée');
      } catch (e) {
        toasts.erreur('Suppression impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [estAdmin, confirmer, toasts]
  );

  /** Active ou désactive une connexion. */
  const basculerActive = useCallback(
    async (connexion: Connexion, valeur: boolean) => {
      if (!estAdmin) {
        toasts.erreur('Action réservée aux administrateurs');
        return;
      }
      setConnexions((prec) => prec.map((c) => (c._id === connexion._id ? { ...c, active: valeur } : c)));
      try {
        await apiConnexions.maj(connexion._id, { active: valeur });
      } catch (e) {
        setConnexions((prec) =>
          prec.map((c) => (c._id === connexion._id ? { ...c, active: !valeur } : c))
        );
        toasts.erreur('Mise à jour impossible', e instanceof Error ? e.message : undefined);
      }
    },
    [estAdmin, toasts]
  );

  /** Exécute un test réel de la connexion (appel externe effectué côté serveur). */
  const tester = useCallback(
    async (connexion: Connexion) => {
      if (!estAdmin) {
        toasts.erreur('Action réservée aux administrateurs');
        return;
      }
      setTestEnCours(connexion._id);
      try {
        const reponse = await executer<{ supporte: boolean; ok: boolean; message: string }>(
          `/connexions/${connexion._id}/tester`,
          { methode: 'POST' }
        );
        const resultat = reponse.data;
        if (!resultat || !resultat.supporte) {
          toasts.info(resultat?.message || 'Test non disponible pour cette intégration.');
        } else if (resultat.ok) {
          toasts.succes(resultat.message);
        } else {
          toasts.erreur(resultat.message);
        }
      } catch (e) {
        toasts.erreur('Test impossible', e instanceof Error ? e.message : undefined);
      } finally {
        setTestEnCours(null);
      }
    },
    [estAdmin, toasts]
  );

  const modeleBrouillon = brouillon ? CATALOGUE.find((t) => t.type === brouillon.type) : undefined;

  if (chargement) return <Chargement libelle="Chargement des connexions…" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Plug className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Connexions</h1>
        <span className="etiquette" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
          {connexions.length}
        </span>
        {estAdmin && (
          <button type="button" onClick={ouvrirCreation} className="bouton bouton-primaire ml-auto gap-1.5">
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        )}
      </div>

      {connexions.length === 0 ? (
        <EtatVide
          icone={Plug}
          titre="Aucune connexion"
          description="Reliez Slack, GitHub, Figma ou Google Drive pour enrichir vos pages."
          action={
            estAdmin ? (
              <button type="button" onClick={ouvrirCreation} className="bouton bouton-primaire gap-1.5">
                <Plus className="h-4 w-4" />
                Ajouter une connexion
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {connexions.map((connexion) => {
            const Icone = iconeConnexion(connexion.type);
            const resume = resumerConfig(connexion.config);
            return (
              <li key={connexion._id} className="carte group flex items-center gap-3 p-3.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'var(--fond-secondaire)' }}
                >
                  <Icone className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{connexion.nom}</p>
                    <span className="etiquette text-[11px]" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
                      {libelleConnexion(connexion.type)}
                    </span>
                  </div>
                  {resume && <p className="mt-0.5 truncate text-sm texte-doux">{resume}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Bascule
                    actif={connexion.active !== false}
                    desactive={!estAdmin}
                    libelle={`Activer ${connexion.nom}`}
                    onChange={(valeur) => basculerActive(connexion, valeur)}
                  />
                  {estAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => tester(connexion)}
                        disabled={testEnCours === connexion._id}
                        className="bouton p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:opacity-100"
                        aria-label="Tester la connexion"
                        title="Tester la connexion"
                      >
                        {testEnCours === connexion._id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlugZap className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => ouvrirEdition(connexion)}
                        className="bouton p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        aria-label="Modifier la connexion"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => supprimer(connexion)}
                        className="bouton p-1.5 text-red-600 opacity-0 transition-opacity hover:bg-red-50 group-hover:opacity-100 focus:opacity-100 dark:text-red-400 dark:hover:bg-red-950/40"
                        aria-label="Supprimer la connexion"
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
        titre={brouillon?._id ? 'Modifier la connexion' : 'Nouvelle connexion'}
        description="Les identifiants sont stockés dans la configuration de l’espace."
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
              {brouillon?._id ? 'Enregistrer' : 'Ajouter'}
            </button>
          </>
        }
      >
        {brouillon && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Type d’intégration</span>
              <select
                className="champ"
                value={brouillon.type}
                onChange={(e) => changerType(e.target.value)}
              >
                {CATALOGUE.map((type) => (
                  <option key={type.type} value={type.type}>
                    {type.libelle}
                  </option>
                ))}
              </select>
            </label>

            {modeleBrouillon && (
              <p className="text-xs texte-doux">{modeleBrouillon.description}</p>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Nom affiché</span>
              <input
                className="champ"
                value={brouillon.nom}
                onChange={(e) => setBrouillon((b) => (b ? { ...b, nom: e.target.value } : b))}
              />
            </label>

            {modeleBrouillon && modeleBrouillon.champs.length > 0 && (
              <div className="flex flex-col gap-3">
                {modeleBrouillon.champs.map((champ) => (
                  <label key={champ.cle} className="flex flex-col gap-1">
                    <span className="text-xs font-medium texte-doux">{champ.label}</span>
                    <input
                      className="champ"
                      value={brouillon.config[champ.cle] || ''}
                      placeholder={champ.placeholder}
                      onChange={(e) =>
                        setBrouillon((b) =>
                          b ? { ...b, config: { ...b.config, [champ.cle]: e.target.value } } : b
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="flex-1 text-sm">Activer immédiatement</span>
              <Bascule
                actif={brouillon.active}
                libelle="Activer la connexion"
                onChange={(valeur) => setBrouillon((b) => (b ? { ...b, active: valeur } : b))}
              />
            </div>
          </div>
        )}
      </Modale>
    </div>
  );
}

/** Résume la configuration d'une connexion en une ligne lisible. */
function resumerConfig(config?: Record<string, unknown>): string {
  if (!config) return '';
  const valeurs = Object.values(config).filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
  if (!valeurs.length) return '';
  return valeurs.slice(0, 3).map((v) => String(v)).join(' · ');
}
