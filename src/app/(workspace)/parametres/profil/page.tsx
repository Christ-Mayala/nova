'use client';

import { AtSign, Camera, KeyRound, UserRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Chargement } from '@/components/ui/Etats';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useLangue } from '@/context/LangueContext';
import { authentification } from '@/lib/api';
import { cn, initiales } from '@/lib/utils';

/** Compte personnel : identité, photo de profil et mot de passe. */
export default function PageParametresProfil() {
  const { utilisateur, chargement, rafraichirProfil } = useAuth();
  const { t } = useLangue();
  const toasts = useToasts();

  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [fichierAvatar, setFichierAvatar] = useState<File | null>(null);
  const [apercuAvatar, setApercuAvatar] = useState<string | null>(null);
  const [enregistrementProfil, setEnregistrementProfil] = useState(false);

  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enregistrementMotDePasse, setEnregistrementMotDePasse] = useState(false);

  const refFichier = useRef<HTMLInputElement>(null);

  /* Initialise le formulaire depuis le profil chargé. */
  useEffect(() => {
    if (!utilisateur) return;
    setNom(utilisateur.name || utilisateur.nom || '');
    setEmail(utilisateur.email || '');
  }, [utilisateur]);

  /* Aperçu local du fichier choisi (URL révoquée au démontage). */
  useEffect(() => {
    if (!fichierAvatar) {
      setApercuAvatar(null);
      return;
    }
    const url = URL.createObjectURL(fichierAvatar);
    setApercuAvatar(url);
    return () => URL.revokeObjectURL(url);
  }, [fichierAvatar]);

  const enregistrerProfil = useCallback(async () => {
    const nomPropre = nom.trim();
    const emailPropre = email.trim();
    if (!emailPropre) {
      toasts.erreur(t('profil.emailObligatoire'));
      return;
    }
    setEnregistrementProfil(true);
    try {
      await authentification.majProfil({ name: nomPropre, email: emailPropre, avatar: fichierAvatar });
      await rafraichirProfil();
      setFichierAvatar(null);
      if (refFichier.current) refFichier.current.value = '';
      toasts.succes(t('profil.profilMaj'));
    } catch (e) {
      toasts.erreur(t('profil.majImpossible'), e instanceof Error ? e.message : undefined);
    } finally {
      setEnregistrementProfil(false);
    }
  }, [nom, email, fichierAvatar, rafraichirProfil, toasts, t]);

  const changerMotDePasse = useCallback(async () => {
    if (!motDePasseActuel) {
      toasts.erreur(t('profil.mdpActuelRequis'));
      return;
    }
    if (nouveauMotDePasse.length < 6) {
      toasts.erreur(t('profil.mdpMin6'));
      return;
    }
    if (nouveauMotDePasse !== confirmation) {
      toasts.erreur(t('profil.mdpNonConcordants'));
      return;
    }
    setEnregistrementMotDePasse(true);
    try {
      await authentification.changerMotDePasse(motDePasseActuel, nouveauMotDePasse);
      setMotDePasseActuel('');
      setNouveauMotDePasse('');
      setConfirmation('');
      toasts.succes(t('profil.mdpMaj'));
    } catch (e) {
      toasts.erreur(t('profil.changementImpossible'), e instanceof Error ? e.message : undefined);
    } finally {
      setEnregistrementMotDePasse(false);
    }
  }, [motDePasseActuel, nouveauMotDePasse, confirmation, toasts, t]);

  if (chargement) return <Chargement libelle={t('profil.chargement')} />;

  if (!utilisateur) {
    return (
      <div className="carte p-6">
        <h2 className="text-base font-semibold">{t('profil.indisponibleTitre')}</h2>
        <p className="mt-1 text-sm texte-doux">{t('profil.indisponibleDescription')}</p>
      </div>
    );
  }

  const sourcePhoto = apercuAvatar || utilisateur.avatarUrl || null;

  return (
    <div className="flex flex-col gap-8">
      <Bloc icone={UserRound} titre={t('profil.identiteTitre')} description={t('profil.identiteDescription')}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <span
              className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-lg font-semibold text-white"
              style={{
                backgroundColor: 'var(--accent)',
                backgroundImage: sourcePhoto ? `url(${sourcePhoto})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              aria-hidden={sourcePhoto ? true : undefined}
            >
              {!sourcePhoto && initiales(nom || utilisateur.email)}
            </span>
            <input
              ref={refFichier}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFichierAvatar(e.target.files?.[0] || null)}
            />
            <button type="button" className="bouton gap-1.5 text-xs" onClick={() => refFichier.current?.click()}>
              <Camera className="h-3.5 w-3.5" />
              {t('profil.changerPhoto')}
            </button>
          </div>

          <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label={t('profil.nomLabel')}>
              <input
                className="champ"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={t('profil.nomPlaceholder')}
              />
            </Champ>
            <Champ label={t('profil.emailLabel')}>
              <input
                className="champ"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('profil.emailPlaceholder')}
              />
            </Champ>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="bouton bouton-primaire"
            onClick={enregistrerProfil}
            disabled={enregistrementProfil}
          >
            {enregistrementProfil ? t('profil.enregistrementEnCours') : t('profil.enregistrer')}
          </button>
        </div>
      </Bloc>

      <Bloc
        icone={KeyRound}
        titre={t('profil.mdpTitre')}
        description={t('profil.mdpDescription')}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Champ label={t('profil.mdpActuelLabel')}>
            <input
              className="champ"
              type="password"
              autoComplete="current-password"
              value={motDePasseActuel}
              onChange={(e) => setMotDePasseActuel(e.target.value)}
            />
          </Champ>
          <Champ label={t('profil.nouveauMdpLabel')}>
            <input
              className="champ"
              type="password"
              autoComplete="new-password"
              value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)}
            />
          </Champ>
          <Champ label={t('profil.confirmerMdpLabel')}>
            <input
              className="champ"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </Champ>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs texte-doux">
            <AtSign className="h-3.5 w-3.5" />
            {t('profil.sessionActive')}
          </p>
          <button
            type="button"
            className="bouton bouton-primaire shrink-0"
            onClick={changerMotDePasse}
            disabled={enregistrementMotDePasse}
          >
            {enregistrementMotDePasse ? t('profil.miseAJourEnCours') : t('profil.mettreAJour')}
          </button>
        </div>
      </Bloc>
    </div>
  );
}

/** Bloc de réglage titré avec icône (mise en page cohérente avec les autres sections). */
function Bloc({
  icone: Icone,
  titre,
  description,
  children,
}: {
  icone: typeof UserRound;
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
