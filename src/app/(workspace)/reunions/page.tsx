'use client';

import { CalendarDays } from 'lucide-react';

import { BaseDediee, type ConfigBaseDediee } from '@/components/base/BaseDediee';

/** Base « Réunions » : créée automatiquement au premier accès. */
const CONFIG_REUNIONS: ConfigBaseDediee = {
  titre: 'Réunions',
  icone: '📅',
  description: 'Planifiez vos réunions sur un calendrier et suivez leur statut.',
  proprietes: [
    { nom: 'Date', type: 'date' },
    { nom: 'Heure', type: 'texte' },
    { nom: 'Participants', type: 'personne' },
    {
      nom: 'Statut',
      type: 'statut',
      options: { groupes: ['À venir', 'Confirmée', 'Annulée'] },
    },
    { nom: 'Ordre du jour', type: 'texte' },
  ],
  vues: [
    { nom: 'Calendrier', type: 'calendrier', proprietesVisibles: ['Date'] },
    {
      nom: 'Tableau',
      type: 'tableau',
      proprietesVisibles: ['Date', 'Heure', 'Participants', 'Statut'],
    },
  ],
};

/** Page « Réunions » : calendrier des réunions de l'espace de travail. */
export default function PageReunions() {
  return (
    <div className="mx-auto w-full max-w-contenu-large px-8 py-8">
      <BaseDediee config={CONFIG_REUNIONS} iconeVide={CalendarDays} />
    </div>
  );
}
