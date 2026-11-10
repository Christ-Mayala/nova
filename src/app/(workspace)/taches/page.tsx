'use client';

import { ListChecks } from 'lucide-react';

import { BaseDediee, type ConfigBaseDediee } from '@/components/base/BaseDediee';

/**
 * Base « Mes tâches » : les tâches sont reliées aux pages et aux objets
 * externes par des propriétés de relation (« Projet ») et d'URL (« Lien »),
 * à la manière des connecteurs de Notion.
 */
const CONFIG_TACHES: ConfigBaseDediee = {
  titre: 'Mes tâches',
  icone: '✅',
  description: 'Vos tâches, reliées à vos projets et à vos outils connectés.',
  proprietes: [
    {
      nom: 'Statut',
      type: 'statut',
      options: { groupes: ['À faire', 'En cours', 'Terminé'] },
    },
    { nom: 'Échéance', type: 'date' },
    { nom: 'Projet', type: 'relation' },
    { nom: 'Lien', type: 'url' },
  ],
  vues: [
    {
      nom: 'Tableau',
      type: 'tableau',
      proprietesVisibles: ['Statut', 'priorite', 'assigne', 'Échéance', 'Projet'],
    },
    { nom: 'Calendrier', type: 'calendrier', proprietesVisibles: ['Échéance'] },
  ],
};

/** Page « Mes tâches » : base de suivi des tâches de l'espace de travail. */
export default function PageTaches() {
  return (
    <div className="mx-auto w-full max-w-contenu-large px-8 py-8">
      <BaseDediee config={CONFIG_TACHES} iconeVide={ListChecks} />
    </div>
  );
}
