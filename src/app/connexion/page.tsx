'use client';

import { Loader2, TriangleAlert } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/** Écran d'authentification : connexion et création de compte. */
export default function PageConnexion() {
  const { connexion, inscription, estConnecte } = useAuth();
  const toasts = useToasts();
  const router = useRouter();

  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion');
  const [name, setNom] = useState('');
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setMotDePasse] = useState('Admin@2026');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      if (mode === 'connexion') {
        await connexion(email, password);
      } else {
        await inscription({ name: name || email, email, password });
      }
      toasts.succes('Connexion réussie', 'Bienvenue dans votre espace de travail.');
      router.push(ROUTES.accueil);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Échec de l’authentification.';
      setErreur(message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: 'var(--fond-secondaire)' }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/assets/logo/logo.jpg"
            alt="NOVA"
            width={64}
            height={64}
            priority
            className="mb-3 h-16 w-16 rounded-xl object-cover shadow-sm"
          />
          <h1 className="text-xl font-bold">NOVA Workspace</h1>
          <p className="mt-1 text-sm texte-doux">
            Think. Organize. Create. — Un espace de travail tout-en-un pour vos notes, bases et projets.
          </p>
        </div>

        <div className="carte p-5">
          <div className="mb-4 flex rounded-md p-0.5" style={{ backgroundColor: 'var(--fond-secondaire)' }}>
            <button
              type="button"
              onClick={() => setMode('connexion')}
              className={cn(
                'flex-1 rounded px-3 py-1.5 text-sm transition-colors',
                mode === 'connexion' ? 'font-medium' : 'texte-doux'
              )}
              style={mode === 'connexion' ? { backgroundColor: 'var(--fond)' } : undefined}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setMode('inscription')}
              className={cn(
                'flex-1 rounded px-3 py-1.5 text-sm transition-colors',
                mode === 'inscription' ? 'font-medium' : 'texte-doux'
              )}
              style={mode === 'inscription' ? { backgroundColor: 'var(--fond)' } : undefined}
            >
              Créer un compte
            </button>
          </div>

          <form onSubmit={soumettre} className="flex flex-col gap-3">
            {mode === 'inscription' && (
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium texte-doux">Nom</span>
                <input
                  className="champ"
                  value={name}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Votre nom"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Adresse e-mail</span>
              <input
                type="email"
                className="champ"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                autoComplete="email"
                required
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium texte-doux">Mot de passe</span>
              <input
                type="password"
                className="champ"
                value={password}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
                required
              />
            </label>

            {erreur && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{erreur}</span>
              </div>
            )}

            <button type="submit" disabled={enCours} className="bouton bouton-primaire mt-1 w-full">
              {enCours && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'connexion' ? 'Se connecter' : 'Créer le compte'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs texte-faible">
          Compte de démonstration : admin@admin.com / Admin@2026
        </p>
        {estConnecte && (
          <p className="mt-2 text-center text-xs texte-doux">Vous êtes déjà connecté.</p>
        )}
      </div>
    </div>
  );
}
