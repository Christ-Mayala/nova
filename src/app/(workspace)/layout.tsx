import type { ReactNode } from 'react';

import { CoquilleApp } from '@/components/shell/CoquilleApp';

/** Enveloppe toutes les routes de l'espace de travail (barre latérale + en-tête). */
export default function LayoutEspace({ children }: { children: ReactNode }) {
  return <CoquilleApp>{children}</CoquilleApp>;
}
