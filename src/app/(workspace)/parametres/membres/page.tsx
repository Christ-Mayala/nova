'use client';

import { Check, Clock, Layers, Mail, Minus, ShieldCheck, Trash2, UserPlus, UserRound, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Avatar } from '@/components/ui/Avatar';
import { Chargement } from '@/components/ui/Etats';
import { Modale } from '@/components/ui/Modale';
import { useConfirmation } from '@/components/ui/Confirmation';
import { useToasts } from '@/components/ui/Toasts';
import { useAuth } from '@/context/AuthContext';
import { useDonnees } from '@/context/DonneesContext';
import { useLangue } from '@/context/LangueContext';
import { membres as apiMembres } from '@/lib/api';
import type { Membre, PermissionsNova, RoleMembre } from '@/lib/types';
import { cn, formaterDate, identifiantDe, nomUtilisateur } from '@/lib/utils';

/** Ligne affichée dans la liste des membres (API ou utilisateur courant). */
interface Ligne {
  id: string;
  nom: string;
  email: string;
  role: RoleMembre;
  permissions: PermissionsNova;
  statut: 'invite' | 'actif';
  modifiable: boolean;
  invitation?: string;
  avatarUrl?: string | null;
  espaceIds?: string[];
}

/** Permissions par défaut d'un rôle (miroir du backend). */
function permissionsPourRole(role: RoleMembre): PermissionsNova {
  if (role === 'admin') {
    return { lecture: true, edition: true, commentaire: true, partage: true, admin: true };
  }
  if (role === 'invite') {
    return { lecture: true, edition: false, commentaire: false, partage: false, admin: false };
  }
  return { lecture: true, edition: true, commentaire: true, partage: false, admin: false };
}

/** Clés de traduction des rôles proposés dans l'espace (cf. contrôle d'accès de NOVA). */
const CLES_ROLES: Record<RoleMembre, string> = {
  admin: 'membres.roleAdmin',
  membre: 'membres.roleMembre',
  invite: 'membres.roleInvite',
};

/**
 * Nombre d'espaces d'équipe explicitement attribués au membre.
 */
function nombreEspaces(ligne: Ligne): number {
  return Array.isArray(ligne.espaceIds) ? ligne.espaceIds.length : 0;
}

/** Rôles et permissions de l'espace (cf. contrôle d'accès de NOVA). */
const PERMISSIONS: Array<{ cleRole: string; lecture: boolean; edition: boolean; commentaire: boolean; partage: boolean; admin: boolean }> = [
  { cleRole: 'membres.roleInvite', lecture: true, edition: false, commentaire: false, partage: false, admin: false },
  { cleRole: 'membres.roleMembre', lecture: true, edition: true, commentaire: true, partage: false, admin: false },
  { cleRole: 'membres.roleResponsable', lecture: true, edition: true, commentaire: true, partage: true, admin: true },
  { cleRole: 'membres.roleAdmin', lecture: true, edition: true, commentaire: true, partage: true, admin: true },
];

/** Membres et groupes de l'espace de travail : inviter, changer les rôles, retirer. */
export default function PageParametresMembres() {
  const { pages, espaces } = useDonnees();
  const { utilisateur, estAdmin } = useAuth();
  const { t } = useLangue();
  const toasts = useToasts();
  const confirmer = useConfirmation();

  /** Rôles sélectionnables (libellés traduits). */
  const roles: Array<{ valeur: RoleMembre; libelle: string }> = (['admin', 'membre', 'invite'] as RoleMembre[]).map(
    (valeur) => ({ valeur, libelle: t(CLES_ROLES[valeur]) })
  );

  const [membresApi, setMembresApi] = useState<Membre[]>([]);
  const [chargement, setChargement] = useState(true);
  const [modaleOuverte, setModaleOuverte] = useState(false);
  const [emailInvite, setEmailInvite] = useState('');
  const [roleInvite, setRoleInvite] = useState<RoleMembre>('membre');
  const [permissionsInvite, setPermissionsInvite] = useState<PermissionsNova>(permissionsPourRole('membre'));
  const [espacesInvite, setEspacesInvite] = useState<string[]>([]);
  const [editionEspaces, setEditionEspaces] = useState<{ id: string; nom: string; ids: string[] } | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [majEnCours, setMajEnCours] = useState<string | null>(null);

  /** Charge la liste des membres depuis l'API. */
  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const reponse = await apiMembres.lister({ limit: 100, sort: '-createdAt' });
      setMembresApi(reponse.data || []);
    } catch (e) {
      toasts.erreur(t('membres.chargementImpossible'), e instanceof Error ? e.message : undefined);
    } finally {
      setChargement(false);
    }
  }, [toasts, t]);

  useEffect(() => {
    charger();
  }, [charger]);

  /** Lignes affichées : membres de l'API + l'utilisateur courant s'il n'y figure pas. */
  const lignes = useMemo<Ligne[]>(() => {
    const resultat: Ligne[] = membresApi.map((m) => {
      const role = (m.role || 'membre') as RoleMembre;
      return {
        id: m._id,
        nom: m.nom || m.email,
        email: m.email,
        role,
        permissions: m.permissions || permissionsPourRole(role),
        statut: m.statut || 'invite',
        modifiable: true,
        invitation: m.dateInvitation || m.createdAt,
        avatarUrl: m.avatarUrl || null,
        espaceIds: m.espaceIds || [],
      };
    });

    if (utilisateur && !membresApi.some((m) => (m.email || '').toLowerCase() === utilisateur.email.toLowerCase())) {
      const roleCourant: RoleMembre = estAdmin ? 'admin' : utilisateur.novaRole || 'membre';
      resultat.unshift({
        id: utilisateur._id,
        nom: nomUtilisateur(utilisateur) || utilisateur.email,
        email: utilisateur.email,
        role: roleCourant,
        permissions: utilisateur.novaPermissions || permissionsPourRole(roleCourant),
        statut: 'actif',
        modifiable: false,
        avatarUrl: utilisateur.avatarUrl || null,
        espaceIds: utilisateur.novaEspaceIds || [],
      });
    }

    return resultat.sort(
      (a, b) => Number(b.role === 'admin') - Number(a.role === 'admin') || a.nom.localeCompare(b.nom)
    );
  }, [membresApi, utilisateur, estAdmin]);

  /** Ouvre la modale d'invitation en présélectionnant tous les espaces. */
  const ouvrirInvitation = useCallback(() => {
    setEspacesInvite(espaces.map((e) => e._id));
    setModaleOuverte(true);
  }, [espaces]);

  /** Coche/décoche un espace dans l'invitation. */
  const basculerEspaceInvite = useCallback((id: string, coche: boolean) => {
    setEspacesInvite((prec) => (coche ? [...new Set([...prec, id])] : prec.filter((x) => x !== id)));
  }, []);

  /** Coche/décoche un espace pour un membre existant. */
  const basculerEspaceMembre = useCallback((id: string, coche: boolean) => {
    setEditionEspaces((prec) =>
      prec
        ? {
            ...prec,
            ids: coche ? [...new Set([...prec.ids, id])] : prec.ids.filter((x) => x !== id),
          }
        : prec
    );
  }, []);

  /** Active/désactive une permission de l'invitation. */
  const basculerPermission = useCallback((cle: keyof PermissionsNova, valeur: boolean) => {
    setPermissionsInvite((prec) => {
      const suivant: PermissionsNova = { ...prec, [cle]: valeur, lecture: true };
      if (cle === 'admin') {
        suivant.edition = valeur;
        suivant.commentaire = valeur;
        suivant.partage = valeur;
      }
      return suivant;
    });
  }, []);

  /** Invite une nouvelle personne par e-mail. */
  const inviter = useCallback(async () => {
    const adresse = emailInvite.trim().toLowerCase();
    if (!adresse) {
      toasts.erreur(t('membres.emailRequis'));
      return;
    }
    setEnvoiEnCours(true);
    try {
      await apiMembres.creer({
        email: adresse,
        role: roleInvite,
        permissions: permissionsInvite,
        espaceIds: espacesInvite,
      } as Partial<Membre>);
      await charger();
      setModaleOuverte(false);
      setEmailInvite('');
      setRoleInvite('membre');
      setPermissionsInvite(permissionsPourRole('membre'));
      setEspacesInvite([]);
      toasts.succes(t('membres.invitationEnvoyee'), t('membres.invitationEnvoyeeDesc', { email: adresse }));
    } catch (e) {
      toasts.erreur(t('membres.invitationImpossible'), e instanceof Error ? e.message : undefined);
    } finally {
      setEnvoiEnCours(false);
    }
  }, [emailInvite, roleInvite, permissionsInvite, espacesInvite, charger, toasts, t]);

  /** Modifie le rôle d'un membre. */
  const changerRole = useCallback(
    async (id: string, role: RoleMembre) => {
      setMajEnCours(id);
      try {
        // Un changement de rôle réinitialise les permissions sur les valeurs du
        // nouveau rôle : une rétrogradation révoque donc immédiatement les droits.
        const permissions = permissionsPourRole(role);
        await apiMembres.maj(id, { role, permissions } as Partial<Membre>);
        setMembresApi((prec) => prec.map((m) => (m._id === id ? { ...m, role, permissions } : m)));
        toasts.succes(t('membres.roleMaj'), t(CLES_ROLES[role]));
      } catch (e) {
        toasts.erreur(t('membres.modificationImpossible'), e instanceof Error ? e.message : undefined);
      } finally {
        setMajEnCours(null);
      }
    },
    [toasts, t]
  );

  /** Retire un membre de l'espace. */
  const retirer = useCallback(
    async (ligne: Ligne) => {
      const ok = await confirmer({
        titre: t('membres.retirerTitre'),
        message: t('membres.retirerMessage', { nom: ligne.nom, email: ligne.email }),
        libelleConfirmer: t('membres.retirer'),
        danger: true,
      });
      if (!ok) return;
      setMajEnCours(ligne.id);
      try {
        await apiMembres.supprimer(ligne.id);
        setMembresApi((prec) => prec.filter((m) => m._id !== ligne.id));
        toasts.succes(t('membres.membreRetire'), ligne.email);
      } catch (e) {
        toasts.erreur(t('membres.suppressionImpossible'), e instanceof Error ? e.message : undefined);
      } finally {
        setMajEnCours(null);
      }
    },
    [confirmer, toasts, t]
  );

  /** Réexpédie l'invitation (régénère un mot de passe provisoire). */
  const renvoyer = useCallback(
    async (ligne: Ligne) => {
      setMajEnCours(ligne.id);
      try {
        await apiMembres.renvoyerInvitation(ligne.id);
        toasts.succes(t('membres.invitationRenvoyee'), t('membres.invitationRenvoyeeDesc', { email: ligne.email }));
      } catch (e) {
        toasts.erreur(t('membres.renvoiImpossible'), e instanceof Error ? e.message : undefined);
      } finally {
        setMajEnCours(null);
      }
    },
    [toasts, t]
  );

  /** Enregistre les espaces d'équipe d'un membre existant. */
  const enregistrerEspaces = useCallback(async () => {
    if (!editionEspaces) return;
    setMajEnCours(editionEspaces.id);
    try {
      await apiMembres.maj(editionEspaces.id, { espaceIds: editionEspaces.ids } as Partial<Membre>);
      setMembresApi((prec) =>
        prec.map((m) => (m._id === editionEspaces.id ? { ...m, espaceIds: editionEspaces.ids } : m))
      );
      toasts.succes(t('membres.espacesMaj'), editionEspaces.nom);
      setEditionEspaces(null);
    } catch (e) {
      toasts.erreur(t('membres.modificationImpossible'), e instanceof Error ? e.message : undefined);
    } finally {
      setMajEnCours(null);
    }
  }, [editionEspaces, toasts, t]);

  if (chargement && membresApi.length === 0 && !utilisateur) {
    return <Chargement libelle={t('membres.chargement')} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="carte overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--bordure)' }}>
          <Users className="h-4 w-4 texte-faible" />
          <h2 className="text-sm font-semibold">{t('membres.titre', { nb: lignes.length })}</h2>
          <div className="ml-auto">
            <button
              type="button"
              className="bouton bouton-primaire gap-1.5"
              disabled={!estAdmin}
              onClick={ouvrirInvitation}
            >
              <UserPlus className="h-4 w-4" />
              {t('membres.inviter')}
            </button>
          </div>
        </div>

        {!estAdmin && (
          <p className="px-5 py-3 text-xs texte-doux">
            {t('membres.adminSeulement')}
          </p>
        )}

        {lignes.length === 0 ? (
          <p className="px-5 py-6 text-sm texte-doux">{t('membres.aucunMembre')}</p>
        ) : (
          <ul>
            {lignes.map((ligne) => (
              <li
                key={ligne.id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
                style={{ borderTop: '1px solid var(--bordure)' }}
              >
                <Avatar src={ligne.avatarUrl} nom={ligne.nom} taille="md" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{ligne.nom}</p>
                  <p className="truncate text-xs texte-doux">{ligne.email}</p>
                </div>

                <span
                  className={cn(
                    'etiquette shrink-0 gap-1',
                    ligne.statut === 'actif'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                  )}
                >
                  {ligne.statut === 'actif' ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {ligne.statut === 'actif' ? t('membres.statutActif') : t('membres.statutInvite')}
                </span>

                {ligne.invitation && (
                  <span className="hidden shrink-0 text-xs texte-doux sm:block">
                    {t('membres.inviteLe', { date: formaterDate(ligne.invitation) })}
                  </span>
                )}

                {ligne.modifiable && estAdmin ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="bouton gap-1 px-2 py-1.5"
                      onClick={() => setEditionEspaces({ id: ligne.id, nom: ligne.nom, ids: ligne.espaceIds || [] })}
                      title={t('membres.nbEspaces', { nb: nombreEspaces(ligne) })}
                      aria-label={t('membres.nbEspaces', { nb: nombreEspaces(ligne) })}
                    >
                      <Layers className="h-4 w-4" />
                      <span className="text-xs">{nombreEspaces(ligne)}</span>
                    </button>
                    <select
                      className="champ h-8 py-0 text-xs"
                      value={ligne.role}
                      disabled={majEnCours === ligne.id}
                      onChange={(e) => changerRole(ligne.id, e.target.value as RoleMembre)}
                      aria-label={t('membres.roleDe', { nom: ligne.nom })}
                    >
                      {roles.map((role) => (
                        <option key={role.valeur} value={role.valeur}>
                          {role.libelle}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="bouton p-1.5"
                      onClick={() => renvoyer(ligne)}
                      disabled={majEnCours === ligne.id}
                      title={t('membres.renvoyerInvitation')}
                      aria-label={t('membres.renvoyerInvitation')}
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="bouton p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      onClick={() => retirer(ligne)}
                      disabled={majEnCours === ligne.id}
                      aria-label={t('membres.retirerDe', { nom: ligne.nom })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      'etiquette shrink-0',
                      ligne.role === 'admin'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300'
                        : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300'
                    )}
                  >
                    {ligne.role === 'admin' && <ShieldCheck className="h-3 w-3" />}
                    {t(CLES_ROLES[ligne.role])}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte overflow-hidden">
        <div className="flex items-center gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--bordure)' }}>
          <UserRound className="h-4 w-4 texte-faible" />
          <h2 className="text-sm font-semibold">{t('membres.groupesTitre')}</h2>
        </div>
        {espaces.length === 0 ? (
          <p className="px-5 py-6 text-sm texte-doux">{t('membres.aucunGroupe')}</p>
        ) : (
          <ul>
            {espaces.map((espace) => (
              <li
                key={espace._id}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderTop: '1px solid var(--bordure)' }}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{espace.nom}</span>
                <span className="shrink-0 text-xs texte-doux capitalize">{espace.visibilite || 'ouvert'}</span>
                <span className="shrink-0 text-xs texte-doux">
                  {t('membres.nbPages', { nb: pages.filter((p) => identifiantDe(p.espaceId) === espace._id).length })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="carte overflow-x-auto">
        <div className="border-b px-5 py-3" style={{ borderColor: 'var(--bordure)' }}>
          <h2 className="text-sm font-semibold">{t('membres.rolesPermissionsTitre')}</h2>
          <p className="mt-0.5 text-xs texte-doux">
            {t('membres.rolesPermissionsDescription')}
          </p>
        </div>
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="texte-faible">
              <th className="px-5 py-2 text-left font-medium">{t('membres.colRole')}</th>
              <th className="px-3 py-2 text-center font-medium">{t('membres.colLecture')}</th>
              <th className="px-3 py-2 text-center font-medium">{t('membres.colEdition')}</th>
              <th className="px-3 py-2 text-center font-medium">{t('membres.colCommentaire')}</th>
              <th className="px-3 py-2 text-center font-medium">{t('membres.colPartage')}</th>
              <th className="px-3 py-2 text-center font-medium">{t('membres.colAdmin')}</th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((ligne) => (
              <tr key={ligne.cleRole} style={{ borderTop: '1px solid var(--bordure)' }}>
                <td className="px-5 py-2 font-medium">{t(ligne.cleRole)}</td>
                <Cellule actif={ligne.lecture} />
                <Cellule actif={ligne.edition} />
                <Cellule actif={ligne.commentaire} />
                <Cellule actif={ligne.partage} />
                <Cellule actif={ligne.admin} />
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Modale
        ouvert={modaleOuverte}
        onFermer={() => setModaleOuverte(false)}
        titre={t('membres.modaleTitre')}
        description={t('membres.modaleDescription')}
        largeur="max-w-md"
        pied={
          <>
            <button type="button" className="bouton" onClick={() => setModaleOuverte(false)}>
              {t('membres.annuler')}
            </button>
            <button type="button" className="bouton bouton-primaire" onClick={inviter} disabled={envoiEnCours}>
              {envoiEnCours ? t('membres.envoiEnCours') : t('membres.envoyerInvitation')}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium texte-doux">{t('membres.emailLabel')}</span>
            <input
              type="email"
              className="champ"
              value={emailInvite}
              onChange={(e) => setEmailInvite(e.target.value)}
              placeholder={t('membres.emailPlaceholder')}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium texte-doux">{t('membres.roleLabel')}</span>
            <select
              className="champ"
              value={roleInvite}
              onChange={(e) => {
                const role = e.target.value as RoleMembre;
                setRoleInvite(role);
                setPermissionsInvite(permissionsPourRole(role));
              }}
            >
              {roles.map((role) => (
                <option key={role.valeur} value={role.valeur}>
                  {role.libelle}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium texte-doux">{t('membres.espacesLabel')}</span>
            <p className="text-xs texte-faible">{t('membres.espacesDescription')}</p>
            {espaces.length === 0 ? (
              <p className="text-xs texte-faible">{t('membres.aucunGroupe')}</p>
            ) : (
              <div
                className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2"
                style={{ borderColor: 'var(--bordure)' }}
              >
                {espaces.map((espace) => (
                  <label key={espace._id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-sky-600"
                      checked={espacesInvite.includes(espace._id)}
                      onChange={(e) => basculerEspaceInvite(espace._id, e.target.checked)}
                    />
                    <span className="truncate">{espace.nom}</span>
                  </label>
                ))}
              </div>
            )}
            {espacesInvite.length === 0 && (
              <p className="text-xs texte-faible">{t('membres.aucunEspaceSelectionne')}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium texte-doux">{t('membres.rolesPermissionsTitre')}</span>
            <p className="text-xs texte-faible">{t('membres.rolesPermissionsDescription')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['lecture', 'membres.colLecture', true],
                  ['edition', 'membres.colEdition', false],
                  ['commentaire', 'membres.colCommentaire', false],
                  ['partage', 'membres.colPartage', false],
                  ['admin', 'membres.colAdmin', false],
                ] as const
              ).map(([cle, cleLabel, fixe]) => (
                <label key={cle} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-600"
                    checked={permissionsInvite[cle]}
                    disabled={fixe || (cle !== 'admin' && permissionsInvite.admin)}
                    onChange={(e) => basculerPermission(cle, e.target.checked)}
                  />
                  <span>{t(cleLabel)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modale>

      <Modale
        ouvert={editionEspaces !== null}
        onFermer={() => setEditionEspaces(null)}
        titre={t('membres.espacesTitre', { nom: editionEspaces?.nom || '' })}
        description={t('membres.espacesDescription')}
        largeur="max-w-md"
        pied={
          <>
            <button type="button" className="bouton" onClick={() => setEditionEspaces(null)}>
              {t('membres.annuler')}
            </button>
            <button
              type="button"
              className="bouton bouton-primaire"
              onClick={enregistrerEspaces}
              disabled={majEnCours === editionEspaces?.id}
            >
              {t('membres.enregistrer')}
            </button>
          </>
        }
      >
        {espaces.length === 0 ? (
          <p className="text-sm texte-faible">{t('membres.aucunGroupe')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div
              className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-md border p-2"
              style={{ borderColor: 'var(--bordure)' }}
            >
              {espaces.map((espace) => (
                <label key={espace._id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-sky-600"
                    checked={editionEspaces?.ids.includes(espace._id) ?? false}
                    onChange={(e) => basculerEspaceMembre(espace._id, e.target.checked)}
                  />
                  <span className="truncate">{espace.nom}</span>
                </label>
              ))}
            </div>
            {editionEspaces && editionEspaces.ids.length === 0 && (
              <p className="text-xs texte-faible">{t('membres.aucunEspaceSelectionne')}</p>
            )}
          </div>
        )}
      </Modale>
    </div>
  );
}

/** Cellule de la matrice de permissions. */
function Cellule({ actif }: { actif: boolean }) {
  return (
    <td className="px-3 py-2 text-center">
      {actif ? (
        <Check className="mx-auto h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Minus className="mx-auto h-4 w-4 texte-faible" />
      )}
    </td>
  );
}
