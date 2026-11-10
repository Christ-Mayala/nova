'use client';

import { Bell, Languages, Palette, Type } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { Bascule } from '@/components/ui/Bascule';
import { Chargement } from '@/components/ui/Etats';
import { SelecteurIcone } from '@/components/ui/SelecteurIcone';
import { useToasts } from '@/components/ui/Toasts';
import { useApparence } from '@/context/ApparenceContext';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { useLangue } from '@/context/LangueContext';
import { parametres as apiParametres, workspaces as apiWorkspaces } from '@/lib/api';
import { LANGUES, estLangue } from '@/lib/i18n';
import type { Parametre, Workspace } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Réglages de l'espace de travail : identité, apparence, langue et notifications. */
export default function PageParametresEspace() {
  const { parametre, chargement, rafraichir, workspaceActif } = useDonnees();
  const { apparence, police, definirApparence, definirPolice } = useApparence();
  const { estAdmin } = useAuth();
  const { t, definirLangue } = useLangue();
  const toasts = useToasts();

  const [local, setLocal] = useState<Parametre | null>(parametre);
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    setLocal(parametre);
  }, [parametre]);

  /** Enregistre une modification du paramètre d'espace (réservé aux admins). */
  const enregistrer = useCallback(
    async (patch: Partial<Parametre>) => {
      if (!local) return;
      if (!estAdmin) {
        toasts.erreur(t('parametres.actionAdmin'));
        return;
      }
      setLocal((prec) => (prec ? { ...prec, ...patch } : prec));
      setEnregistrement(true);
      try {
        const maj = await apiParametres.maj(local._id, patch);
        setLocal(maj);
        // Le nom/icône de l'espace de travail est affiché dans la barre
        // latérale : on rafraîchit le contexte partagé pour le voir à jour
        // sans recharger la page.
        await rafraichir();
      } catch (e) {
        toasts.erreur(t('parametres.enregistrementImpossible'), e instanceof Error ? e.message : undefined);
      } finally {
        setEnregistrement(false);
      }
    },
    [local, estAdmin, rafraichir, toasts, t]
  );

  /**
   * Modifie l'espace de travail actif lui-même (nom, icône). Ces valeurs sont
   * celles affichées dans la barre latérale : on rafraîchit le contexte pour
   * que le changement soit immédiatement visible partout.
   */
  const majEspace = useCallback(
    async (patch: Partial<Workspace>) => {
      if (!workspaceActif) return;
      setEnregistrement(true);
      try {
        await apiWorkspaces.maj(workspaceActif._id, patch);
        await rafraichir();
      } catch (e) {
        toasts.erreur(t('parametres.enregistrementImpossible'), e instanceof Error ? e.message : undefined);
      } finally {
        setEnregistrement(false);
      }
    },
    [workspaceActif, rafraichir, toasts, t]
  );

  /** Crée le paramètre d'espace s'il n'existe pas encore. */
  const creerParametre = useCallback(async () => {
    if (!estAdmin) return;
    try {
      const cree = await apiParametres.creer({ nomEspace: t('espace.nomParDefaut'), icone: '🪐' } as Partial<Parametre>);
      setLocal(cree);
      await rafraichir();
      toasts.succes(t('espace.initialise'));
    } catch (e) {
      toasts.erreur(t('espace.initialisationImpossible'), e instanceof Error ? e.message : undefined);
    }
  }, [estAdmin, rafraichir, toasts, t]);

  if (chargement) return <Chargement libelle={t('espace.chargement')} />;

  return (
    <div className="flex flex-col gap-8">
      {/* Identité de l'espace de travail actif : le nom et l'icône modifiés ici
          sont ceux affichés dans la barre latérale. */}
      <Bloc icone={Palette} titre={t('espace.identiteTitre')} description={t('espace.identiteDescription')}>
        <div className="flex items-start gap-4">
          <SelecteurIcone
            valeur={workspaceActif?.icone || '🏠'}
            onChange={(emoji) => majEspace({ icone: emoji })}
            taille="grande"
          />
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label={t('espace.nomLabel')}>
              <input
                key={workspaceActif?._id}
                className="champ"
                defaultValue={workspaceActif?.nom || ''}
                placeholder={t('espace.nomParDefaut')}
                disabled={!workspaceActif || enregistrement}
                onBlur={(e) => majEspace({ nom: e.target.value.trim() || t('espace.nomParDefaut') })}
              />
            </Champ>
            <Champ label={t('espace.domaineLabel')}>
              <input
                className="champ"
                defaultValue={local?.domaine || ''}
                placeholder="mon-espace.nova.app"
                disabled={!estAdmin || !local}
                onBlur={(e) => enregistrer({ domaine: e.target.value.trim() })}
              />
            </Champ>
          </div>
        </div>
      </Bloc>

      {!local ? (
        <div className="carte p-6">
          <h2 className="text-base font-semibold">{t('espace.nonConfigureTitre')}</h2>
          <p className="mt-1 text-sm texte-doux">{t('espace.nonConfigureDescription')}</p>
          <button type="button" onClick={creerParametre} className="bouton bouton-primaire mt-4" disabled={!estAdmin}>
            {t('espace.initialiser')}
          </button>
        </div>
      ) : (
        <>
          <Bloc icone={Palette} titre={t('espace.apparenceTitre')} description={t('espace.apparenceDescription')}>
            <Segments
              valeur={apparence}
              onChange={(valeur) => {
                definirApparence(valeur);
                enregistrer({ apparence: valeur });
              }}
              options={[
                { valeur: 'clair', libelle: t('espace.clair') },
                { valeur: 'sombre', libelle: t('espace.sombre') },
                { valeur: 'systeme', libelle: t('espace.systeme') },
              ]}
            />
          </Bloc>

          <Bloc icone={Type} titre={t('espace.policeTitre')} description={t('espace.policeDescription')}>
            <Segments
              valeur={police}
              onChange={(valeur) => {
                definirPolice(valeur);
                enregistrer({ police: valeur });
              }}
              options={[
                { valeur: 'defaut', libelle: t('espace.policeParDefaut') },
                { valeur: 'serif', libelle: t('espace.policeSerif') },
                { valeur: 'mono', libelle: t('espace.policeMono') },
              ]}
            />
          </Bloc>

          <Bloc icone={Languages} titre={t('espace.langueTitre')} description={t('espace.langueDescription')}>
            <Champ label={t('espace.langueLabel')} className="max-w-xs">
              <select
                className="champ"
                value={local.langue || 'fr'}
                disabled={!estAdmin}
                onChange={(e) => {
                  const valeur = e.target.value;
                  if (estLangue(valeur)) definirLangue(valeur);
                  enregistrer({ langue: valeur });
                }}
              >
                {LANGUES.map((langue) => (
                  <option key={langue.code} value={langue.code}>
                    {langue.libelle}
                  </option>
                ))}
              </select>
            </Champ>
          </Bloc>

          <Bloc icone={Bell} titre={t('espace.notificationsTitre')} description={t('espace.notificationsDescription')}>
            <LigneBascule
              titre={t('espace.resumeEmailTitre')}
              description={t('espace.resumeEmailDescription')}
              actif={Boolean(local.notifEmail)}
              desactive={!estAdmin || enregistrement}
              onChange={(valeur) => enregistrer({ notifEmail: valeur })}
            />
          </Bloc>
        </>
      )}
    </div>
  );
}

/** Bloc de réglage titré avec icône. */
function Bloc({
  icone: Icone,
  titre,
  description,
  children,
}: {
  icone: typeof Palette;
  titre: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="carte p-5">
      <div className="mb-4 flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <Icone className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{titre}</h2>
          {description && <p className="mt-0.5 text-xs texte-doux">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Champ de formulaire étiqueté. */
function Champ({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium texte-doux">{label}</span>
      {children}
    </label>
  );
}

/** Sélecteur segmenté (une valeur parmi N). */
function Segments<T extends string>({
  valeur,
  onChange,
  options,
}: {
  valeur: T;
  onChange: (valeur: T) => void;
  options: Array<{ valeur: T; libelle: string }>;
}) {
  return (
    <div className="inline-flex rounded-md p-0.5" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
      {options.map((option) => (
        <button
          key={option.valeur}
          type="button"
          onClick={() => onChange(option.valeur)}
          className={cn(
            'rounded px-3 py-1.5 text-sm transition-colors',
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

/** Ligne de réglage avec interrupteur. */
function LigneBascule({
  titre,
  description,
  actif,
  desactive,
  onChange,
}: {
  titre: string;
  description?: string;
  actif: boolean;
  desactive?: boolean;
  onChange: (valeur: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm">{titre}</p>
        {description && <p className="mt-0.5 text-xs texte-doux">{description}</p>}
      </div>
      <Bascule actif={actif} desactive={desactive} onChange={onChange} libelle={titre} />
    </div>
  );
}
