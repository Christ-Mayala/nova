'use client';

import { Building, Building2, CreditCard, Globe, Plug, Settings, UserRound, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useLangue } from '@/context/LangueContext';
import { ROUTES } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface SectionParametres {
  href: string;
  libelle: string;
  icone: LucideIcon;
}

/** Coquille des paramètres : navigation latérale + contenu de la section. */
export default function LayoutParametres({ children }: { children: ReactNode }) {
  const chemin = usePathname();
  const { t } = useLangue();

  /** Sections des paramètres, dans l'ordre de la structure d'information. */
  const sections: SectionParametres[] = [
    { href: ROUTES.parametresProfil, libelle: t('parametres.monCompte'), icone: UserRound },
    { href: ROUTES.parametres, libelle: t('parametres.espaceDeTravail'), icone: Settings },
    { href: ROUTES.parametresMembres, libelle: t('parametres.membresEtGroupes'), icone: Users },
    { href: ROUTES.parametresEspacesTravail, libelle: t('parametres.espacesTravail'), icone: Building },
    { href: ROUTES.parametresEspaces, libelle: t('parametres.espacesEquipe'), icone: Building2 },
    { href: ROUTES.parametresConnexions, libelle: t('parametres.connexions'), icone: Plug },
    { href: ROUTES.parametresPublications, libelle: t('parametres.publications'), icone: Globe },
    { href: ROUTES.parametresFacturation, libelle: t('parametres.facturation'), icone: CreditCard },
  ];

  return (
    <div className="mx-auto flex w-full max-w-contenu-large gap-8 px-6 py-8 sm:px-8">
      <nav className="hidden w-56 shrink-0 flex-col gap-px md:flex" aria-label={t('parametres.sectionsAria')}>
        <h1 className="mb-2 px-2 text-lg font-bold">{t('nav.parametres')}</h1>
        {sections.map((section) => {
          const Icone = section.icone;
          const actif = chemin === section.href;
          return (
            <Link
              key={section.href}
              href={section.href}
              className={cn('lien-barre', actif && 'lien-barre-actif')}
            >
              <Icone className="h-4 w-4 shrink-0" />
              <span className="truncate">{section.libelle}</span>
            </Link>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {/* Navigation compacte (mobile / tablette) */}
        <div className="mb-4 flex flex-wrap gap-1 md:hidden">
          {sections.map((section) => {
            const Icone = section.icone;
            const actif = chemin === section.href;
            return (
              <Link
                key={section.href}
                href={section.href}
                className={cn(
                  'etiquette gap-1.5 px-2 py-1',
                  actif ? 'lien-barre-actif' : 'texte-doux'
                )}
                style={!actif ? { backgroundColor: 'var(--fond-secondaire)' } : undefined}
              >
                <Icone className="h-3.5 w-3.5" />
                {section.libelle}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </div>
  );
}
