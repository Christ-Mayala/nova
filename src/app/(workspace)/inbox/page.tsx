'use client';

import {
  AtSign,
  Bell,
  BellOff,
  CheckCheck,
  Clock,
  Inbox as IconeInbox,
  MessageSquare,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Chargement, EtatVide } from '@/components/ui/Etats';
import { useDonnees } from '@/context/DonneesContext';
import { ROUTES, lienPage } from '@/lib/navigation';
import type { Notification, Page, TypeNotification } from '@/lib/types';
import { cn, formaterDateRelative, identifiantDe } from '@/lib/utils';

/** Icônes par type de notification. */
const ICONES: Record<TypeNotification, LucideIcon> = {
  mention: AtSign,
  commentaire: MessageSquare,
  partage: Share2,
  rappel: Clock,
  systeme: Bell,
};

/** Boîte de réception : notifications, mentions et partages. */
export default function PageInbox() {
  const { notifications, chargement, marquerNotificationLue, toutMarquerLu, pageParId, notificationsNonLues } =
    useDonnees();

  if (chargement) return <Chargement libelle="Chargement de la boîte de réception…" />;

  return (
    <div className="mx-auto w-full max-w-contenu px-8 py-8">
      <div className="mb-5 flex items-center gap-2">
        <IconeInbox className="h-5 w-5 texte-faible" />
        <h1 className="text-xl font-bold">Boîte de réception</h1>
        {notificationsNonLues > 0 && (
          <span className="etiquette bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
            {notificationsNonLues} non lue(s)
          </span>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => toutMarquerLu()}
            disabled={notifications.length === 0}
            className="bouton gap-1.5 text-xs"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tout effacer
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <EtatVide
          icone={BellOff}
          titre="Aucune notification"
          description="Vous êtes à jour. Les mentions, commentaires et partages apparaîtront ici, puis disparaîtront une fois lus."
        />
      ) : (
        <ul className="flex flex-col gap-1">
          {notifications.map((notification) => (
            <LigneNotification
              key={notification._id}
              notification={notification}
              onLire={marquerNotificationLue}
              lien={resoudreLien(notification, pageParId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Détermine la destination d'une notification. */
function resoudreLien(
  notification: Notification,
  pageParId: (id: string) => Page | undefined
): string {
  if (!notification.pageId) return ROUTES.inbox;
  const id = identifiantDe(notification.pageId);
  const page = pageParId(id);
  return page ? lienPage(page) : `/page/${id}`;
}

/** Ligne d'une notification. */
function LigneNotification({
  notification,
  onLire,
  lien,
}: {
  notification: Notification;
  onLire: (id: string) => Promise<void>;
  lien: string;
}) {
  const Icone = ICONES[notification.type || 'systeme'] || Bell;
  const nonLue = !notification.lu;

  return (
    <li>
      <Link
        href={lien}
        onClick={() => onLire(notification._id)}
        className={cn(
          'flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
        )}
        style={nonLue ? { backgroundColor: 'var(--accent-doux)' } : undefined}
      >
        <span className="mt-0.5 shrink-0">
          <Icone className={cn('h-4 w-4', nonLue ? 'text-sky-600 dark:text-sky-400' : 'texte-faible')} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{notification.titre}</span>
          {notification.message && <span className="mt-0.5 block text-sm texte-doux">{notification.message}</span>}
        </span>
        <span className="shrink-0 text-xs texte-faible">{formaterDateRelative(notification.createdAt)}</span>
        {nonLue && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Non lue" />}
      </Link>
    </li>
  );
}
