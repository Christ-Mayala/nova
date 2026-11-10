'use client';

import { Clock, FileText, Star, Building2, Sparkles, Inbox } from 'lucide-react';
import Link from 'next/link';

import { Avatar } from '@/components/ui/Avatar';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { Chargement, EtatVide } from '@/components/ui/Etats';
import { useDonnees } from '@/context/DonneesContext';
import { useAuth } from '@/context/AuthContext';
import { ROUTES, lienPage } from '@/lib/navigation';
import type { Espace, Page } from '@/lib/types';
import { enTableau, formaterDateRelative, identifiantDe, nomUtilisateur } from '@/lib/utils';

/** Page d'accueil : visites récentes, favoris et vue d'ensemble des espaces. */
export default function PageAccueil() {
  const { pages, espaces, chargement, erreur, pagesFavorites, pagesParEspace, notificationsNonLues } =
    useDonnees();
  const { utilisateur } = useAuth();

  if (chargement) return <Chargement libelle="Chargement de votre espace…" />;

  const recentes = pages
    .slice()
    .sort((a, b) => {
      const da = a.derniereVisite ? new Date(a.derniereVisite).getTime() : new Date(a.updatedAt).getTime();
      const db = b.derniereVisite ? new Date(b.derniereVisite).getTime() : new Date(b.updatedAt).getTime();
      return db - da;
    })
    .slice(0, 6);

  const favoris = pagesFavorites();
  const prenom = nomUtilisateur(utilisateur) || utilisateur?.email?.split('@')[0] || '';

  return (
    <div className="mx-auto w-full max-w-contenu-large px-8 py-10">
      <div className="mb-8 flex items-center gap-3">
        {utilisateur && (
          <Avatar src={utilisateur.avatarUrl} nom={prenom || utilisateur.email} taille="lg" />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {prenom ? `Bonjour ${prenom}` : 'Bienvenue dans votre espace de travail'}
          </h1>
          <p className="mt-1 texte-doux">
            Rassemblez notes, bases de données, wikis et projets au même endroit.
          </p>
        </div>
      </div>

      {erreur && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          {erreur}
        </div>
      )}

      {/* Raccourcis */}
      <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Raccourci
          href={ROUTES.recherche}
          icone={Sparkles}
          titre="Rechercher"
          description="Trouver une page, un bloc ou un élément"
        />
        <Raccourci
          href={ROUTES.ia}
          icone={Sparkles}
          titre="NOVA IA"
          description="Poser une question sur votre espace"
        />
        <Raccourci
          href={ROUTES.inbox}
          icone={Inbox}
          titre="Boîte de réception"
          description={notificationsNonLues > 0 ? `${notificationsNonLues} non lue(s)` : 'Aucune nouvelle activité'}
        />
      </div>

      {/* Visites récentes */}
      <Section titre="Consultés récemment" icone={Clock}>
        {recentes.length === 0 ? (
          <EtatVide
            icone={FileText}
            titre="Aucune page pour l’instant"
            description="Créez votre première page pour commencer à organiser vos connaissances."
          />
        ) : (
          <GrillePages pages={recentes} />
        )}
      </Section>

      {/* Favoris */}
      <Section titre="Favoris" icone={Star}>
        {favoris.length === 0 ? (
          <p className="px-1 py-4 text-sm texte-doux">
            Ajoutez des pages en favori pour les retrouver ici en un clic.
          </p>
        ) : (
          <GrillePages pages={favoris} />
        )}
      </Section>

      {/* Espaces */}
      <Section titre="Vos espaces d’équipe" icone={Building2}>
        {espaces.length === 0 ? (
          <p className="px-1 py-4 text-sm texte-doux">Aucun espace d’équipe configuré.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {espaces.map((espace) => (
              <CarteEspace key={espace._id} espace={espace} nombre={pagesParEspace(espace._id).length} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/** Section titrée de la page d'accueil. */
function Section({
  titre,
  icone: Icone,
  children,
}: {
  titre: string;
  icone: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center gap-2">
        <Icone className="h-4 w-4 texte-faible" />
        <h2 className="text-sm font-semibold texte-doux">{titre}</h2>
      </div>
      {children}
    </section>
  );
}

/** Raccourci d'action en haut de la page d'accueil. */
function Raccourci({
  href,
  icone: Icone,
  titre,
  description,
}: {
  href: string;
  icone: typeof Clock;
  titre: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="carte flex items-start gap-3 p-4 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: 'var(--fond-secondaire)' }}
      >
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{titre}</span>
        <span className="mt-0.5 block text-xs texte-doux">{description}</span>
      </span>
    </Link>
  );
}

/** Grille de cartes de pages. */
function GrillePages({ pages }: { pages: Page[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pages.map((page) => {
        const espace = typeof page.espaceId === 'object' && page.espaceId ? (page.espaceId as Espace) : null;
        return (
          <Link
            key={page._id}
            href={lienPage(page)}
            className="carte flex items-center gap-3 p-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          >
            <IconeDonnee icone={page.icone} className="h-4 w-4 shrink-0 texte-doux" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{page.titre}</span>
              <span className="mt-0.5 block truncate text-xs texte-doux">
                {espace ? `${espace.nom} · ` : ''}
                {formaterDateRelative(page.derniereVisite || page.updatedAt)}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** Carte d'un espace d'équipe. */
function CarteEspace({ espace, nombre }: { espace: Espace; nombre: number }) {
  const { pages } = useDonnees();
  const membres = new Set<string>();
  pages
    .filter((p) => identifiantDe(p.espaceId) === espace._id)
    .forEach((p) => {
      const createur = nomUtilisateur(p.createdBy as { name?: string; email?: string } | string);
      if (createur) membres.add(createur);
    });

  return (
    <Link
      href={`/${espace.slug || espace._id}`}
      className="carte flex flex-col gap-2 p-4 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-2">
        <IconeDonnee icone={espace.icone} repli={Building2} className="h-4 w-4 shrink-0 texte-doux" />
        <span className="truncate font-medium">{espace.nom}</span>
      </div>
      <div className="flex items-center gap-3 text-xs texte-doux">
        <span>
          {nombre} page{nombre > 1 ? 's' : ''}
        </span>
        {espace.visibilite && <span className="capitalize">{espace.visibilite}</span>}
      </div>
      {enTableau(espace.description).length > 0 && (
        <p className="line-clamp-2 text-xs texte-doux">{espace.description}</p>
      )}
    </Link>
  );
}
