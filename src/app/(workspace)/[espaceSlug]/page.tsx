'use client';

import { Building2, Database, FilePlus2, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { MessagerieEquipe } from '@/components/equipe/MessagerieEquipe';
import { ArbrePages } from '@/components/shell/ArbrePages';
import { Avatar } from '@/components/ui/Avatar';
import { IconeDonnee } from '@/components/ui/IconeDonnee';
import { EtatVide, Chargement } from '@/components/ui/Etats';
import { InfoBulles } from '@/components/ui/InfoBulles';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { useLangue } from '@/context/LangueContext';
import { bases as apiBases, listerTout, membres as apiMembres, pages as apiPages } from '@/lib/api';
import { lienPage } from '@/lib/navigation';
import type { Base, Espace, Membre, Page } from '@/lib/types';
import { identifiantDe, nomUtilisateur } from '@/lib/utils';

/** Accueil d'un espace d'équipe : arborescence des pages et bases de données. */
export default function PageEspace({ params }: { params: { espaceSlug: string } }) {
  const { espaceParSlug, pagesParEspace, rafraichir, chargement } = useDonnees();
  const { peutEditer, utilisateur } = useAuth();
  const { t } = useLangue();
  const toasts = useToasts();
  const router = useRouter();
  const [bases, setBases] = useState<Base[]>([]);
  const [membresEquipe, setMembresEquipe] = useState<Membre[]>([]);

  const espace: Espace | undefined = espaceParSlug(params.espaceSlug) || undefined;

  useEffect(() => {
    if (!espace) return;
    let annule = false;
    listerTout(apiBases, { espaceId: espace._id })
      .then((trouvees) => {
        if (!annule) setBases(trouvees.filter((b) => identifiantDe(b.espaceId as { _id: string } | string) === espace._id));
      })
      .catch(() => {
        if (!annule) setBases([]);
      });
    return () => {
      annule = true;
    };
  }, [espace?._id]);

  /* Membres ayant accès à cet espace d'équipe (champ `espaceIds` du membre). */
  useEffect(() => {
    if (!espace) return;
    let annule = false;
    listerTout(apiMembres, { limit: 100 })
      .then((liste) => {
        if (annule) return;
        setMembresEquipe(liste.filter((m) => (m.espaceIds || []).includes(espace._id)));
      })
      .catch(() => {
        if (!annule) setMembresEquipe([]);
      });
    return () => {
      annule = true;
    };
  }, [espace?._id]);

  /**
   * Liste affichée : les membres ayant accès à l'espace, complétés par
   * l'utilisateur courant s'il n'y figure pas (créateur/propriétaire).
   */
  const membresAffiches = useMemo<Membre[]>(() => {
    if (!utilisateur || !utilisateur.email) return membresEquipe;
    const dejaPresent = membresEquipe.some(
      (m) => (m.email || '').toLowerCase() === utilisateur.email.toLowerCase()
    );
    if (dejaPresent) return membresEquipe;
    return [
      {
        _id: utilisateur._id,
        email: utilisateur.email,
        nom: nomUtilisateur(utilisateur),
        avatarUrl: utilisateur.avatarUrl || null,
      } as Membre,
      ...membresEquipe,
    ];
  }, [membresEquipe, utilisateur]);

  if (chargement) return <Chargement libelle="Chargement de l’espace…" />;

  if (!espace) {
    return (
      <div className="mx-auto w-full max-w-contenu px-8 py-16">
        <EtatVide
          icone={Building2}
          titre="Espace introuvable"
          description="Cet espace de travail n’existe pas ou ne vous est pas accessible."
          action={
            <Link href="/" className="bouton bouton-primaire">
              Revenir à l’accueil
            </Link>
          }
        />
      </div>
    );
  }

  const pages = pagesParEspace(espace._id);

  async function nouvellePage() {
    if (!peutEditer) {
      toasts.erreur('Connexion requise');
      return;
    }
    try {
      const page = await apiPages.creer({
        titre: 'Sans titre',
        espaceId: espace!._id,
        workspaceId: identifiantDe(espace!.workspaceId) || undefined,
        section: 'equipe',
        ordre: pages.length,
      } as Partial<Page>);
      await rafraichir();
      router.push(lienPage(page));
    } catch (e) {
      toasts.erreur('Création impossible', e instanceof Error ? e.message : undefined);
    }
  }

  return (
    <div className="mx-auto w-full max-w-contenu-large px-8 py-10">
      <div className="mb-8 flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--fond-secondaire)' }}
        >
          <IconeDonnee icone={espace.icone} repli={Building2} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{espace.nom}</h1>
          {espace.description && <p className="mt-1 texte-doux">{espace.description}</p>}
        </div>
        <InfoBulles contenu="Nouvelle page dans cet espace">
          <button type="button" onClick={nouvellePage} className="bouton ml-auto text-sm">
            <FilePlus2 className="h-4 w-4" />
            Nouvelle page
          </button>
        </InfoBulles>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold texte-doux">Pages</h2>
          {pages.length === 0 ? (
            <p className="text-sm texte-faible">Aucune page dans cet espace pour l’instant.</p>
          ) : (
            <ArbrePages filtre={{ espaceId: espace._id }} />
          )}
        </section>

        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold texte-doux">
            <Database className="h-4 w-4 texte-faible" />
            Bases de données
          </h2>
          {bases.length === 0 ? (
            <p className="text-sm texte-faible">Aucune base de données.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {bases.map((b) => {
                const idPage = identifiantDe(b.pageId as { _id: string } | string | undefined);
                const contenu = (
                  <>
                    <IconeDonnee icone={b.icone} repli={Database} className="h-3.5 w-3.5 shrink-0 texte-doux" />
                    <span className="truncate">{b.titre}</span>
                  </>
                );
                return (
                  <li key={b._id}>
                    {idPage ? (
                      <Link
                        href={lienPage({ _id: idPage, espaceId: espace } as Page)}
                        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                      >
                        {contenu}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-2 rounded px-2 py-1.5 text-sm texte-doux">{contenu}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold texte-doux">
          <Users className="h-4 w-4 texte-faible" />
          {t('equipe.membresTitre')}
          <span className="texte-faible">· {t('equipe.membresNombre', { nb: membresAffiches.length })}</span>
        </h2>
        {membresAffiches.length === 0 ? (
          <p className="text-sm texte-faible">{t('equipe.aucunMembre')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {membresAffiches.map((m) => (
              <li
                key={m._id}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                style={{ borderColor: 'var(--bordure)' }}
              >
                <Avatar src={m.avatarUrl} nom={m.nom || m.email} taille="xs" />
                <span className="text-sm">{m.nom || m.email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <MessagerieEquipe espaceId={espace._id} />
      </section>
    </div>
  );
}
