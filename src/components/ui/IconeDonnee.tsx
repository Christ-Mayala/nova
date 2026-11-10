import { FileText, type LucideIcon } from 'lucide-react';

import { iconeDepuisChamp } from '@/lib/icones';

/**
 * Rend l'icône vectorielle correspondant au champ `icone` d'une donnée.
 * Aucun emoji n'est affiché : les emojis des données sont traduits en icônes.
 */
export function IconeDonnee({
  icone,
  repli = FileText,
  className,
}: {
  icone?: string;
  repli?: LucideIcon;
  className?: string;
}) {
  const Icone = iconeDepuisChamp(icone, repli);
  return <Icone className={className} aria-hidden />;
}
