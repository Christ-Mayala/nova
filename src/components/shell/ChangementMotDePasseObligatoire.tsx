'use client';

import { KeyRound, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { authentification } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/**
 * Écran bloquant affiché lorsqu'un compte a été créé par invitation et doit
 * remplacer son mot de passe provisoire lors de sa première connexion.
 * Tant que le mot de passe n'a pas été changé, l'accès à l'espace est refusé.
 */
export function ChangementMotDePasseObligatoire() {
  const { utilisateur, rafraichirProfil, deconnexion } = useAuth();

  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (nouveauMotDePasse.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (nouveauMotDePasse !== confirmation) {
      setErreur('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setEnCours(true);
    try {
      await authentification.changerMotDePasse(motDePasseActuel, nouveauMotDePasse);
      // Le profil est rechargé : `mustChangePassword` repasse à false et
      // l'utilisateur accède alors normalement à l'application.
      await rafraichirProfil();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Le changement de mot de passe a échoué.');
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: 'var(--fond-secondaire)' }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span
            className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-bold">Première connexion</h1>
          <p className="mt-1 text-sm texte-doux">
            Pour sécuriser votre compte, vous devez remplacer le mot de passe provisoire
            qui vous a été communiqué par e-mail.
          </p>
        </div>

        <form onSubmit={soumettre} className="carte flex flex-col gap-4 p-5">
          <div className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs texte-doux" style={{ borderColor: 'var(--bordure)' }}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Connecté(e) en tant que <strong>{utilisateur?.email}</strong>. Ce changement est
              obligatoire et ne peut pas être ignoré.
            </span>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium texte-doux">Mot de passe provisoire</span>
            <input
              type="password"
              className="champ"
              autoComplete="current-password"
              value={motDePasseActuel}
              onChange={(e) => setMotDePasseActuel(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium texte-doux">Nouveau mot de passe</span>
            <input
              type="password"
              className="champ"
              autoComplete="new-password"
              value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)}
              required
            />
            <span className="text-[11px] texte-faible">8 caractères minimum.</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium texte-doux">Confirmer le nouveau mot de passe</span>
            <input
              type="password"
              className="champ"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          </label>

          {erreur && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erreur}</span>
            </div>
          )}

          <button type="submit" disabled={enCours} className="bouton bouton-primaire w-full">
            {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
            Définir mon mot de passe
          </button>

          <button
            type="button"
            onClick={() => void deconnexion()}
            className="text-center text-xs texte-faible hover:underline"
          >
            Se déconnecter
          </button>
        </form>
      </div>
    </div>
  );
}
