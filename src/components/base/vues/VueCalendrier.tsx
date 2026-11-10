'use client';

import { CalendarDays, ChevronLeft, ChevronRight, Info, Lightbulb, Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { type ContexteVue } from '@/components/base/commun';
import { proprieteDate, patchValeur, valeurDe } from '@/components/base/filtrage';
import { InfoBulles } from '@/components/ui/InfoBulles';
import type { Element } from '@/lib/types';
import { NOMS_JOURS, NOMS_MOIS, cn, couleurEtiquette, grilleMois, memeJour } from '@/lib/utils';

/** Vue calendrier : éléments placés sur leur date dans une grille mensuelle. */
export function VueCalendrier({ ctx }: { ctx: ContexteVue }) {
  const propriete = proprieteDate(ctx.base, ctx.vue);
  const aujourdhui = new Date();
  const [curseur, setCurseur] = useState({ annee: aujourdhui.getFullYear(), mois: aujourdhui.getMonth() });
  const [aideVisible, setAideVisible] = useState(true);

  const jours = useMemo(() => grilleMois(curseur.annee, curseur.mois), [curseur]);

  const parJour = useMemo(() => {
    const carte = new Map<string, Element[]>();
    if (!propriete) return carte;
    ctx.elements.forEach((element) => {
      const brut = valeurDe(element, propriete.nom);
      if (!brut) return;
      const date = new Date(String(brut));
      if (Number.isNaN(date.getTime())) return;
      const cle = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      carte.set(cle, [...(carte.get(cle) || []), element]);
    });
    return carte;
  }, [ctx.elements, propriete]);

  if (!propriete) {
    return (
      <div
        className="flex flex-col items-start gap-3 rounded-lg border px-4 py-6"
        style={{ borderColor: 'var(--bordure)' }}
      >
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 texte-doux" />
          <p className="text-sm font-medium">Aucune date pour le calendrier</p>
        </div>
        <p className="max-w-prose text-sm texte-doux">
          Ajoutez une propriété de type « Date » à cette base, puis renseignez une date sur vos
          éléments : ils apparaîtront automatiquement sur le calendrier, placés sur leur jour.
        </p>
        <button
          type="button"
          disabled={!ctx.peutEditer}
          onClick={() => ctx.ajouterPropriete('Date', 'date')}
          className="bouton bouton-primaire text-sm"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une propriété « Date »
        </button>
        {!ctx.peutEditer && (
          <p className="text-xs texte-faible">Connexion requise.</p>
        )}
      </div>
    );
  }

  function decaler(delta: number) {
    setCurseur((c) => {
      const mois = c.mois + delta;
      return { annee: c.annee + Math.floor(mois / 12), mois: ((mois % 12) + 12) % 12 };
    });
  }

  /** Crée un élément pré-rempli avec la date du jour cliqué (comme sur Notion). */
  const propDate = propriete;
  const creerLe = (jour: Date) => {
    const iso = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate(), 12).toISOString();
    ctx.creerElement(patchValeur({ valeurs: {} } as Element, propDate.nom, iso));
  };

  const aucuneDatePlacee = parJour.size === 0 && ctx.elements.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Bandeau d'aide : accessibilité et prise en main du calendrier */}
      {aideVisible && (
        <div
          className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--bordure)', backgroundColor: 'var(--fond-secondaire)' }}
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 texte-doux" />
          <div className="min-w-0 flex-1 texte-doux">
            <p className="font-medium">Comment utiliser le calendrier</p>
            <p className="text-xs">
              Chaque élément est placé automatiquement sur le jour de sa date
              {propriete ? ` (« ${propriete.nom} »)` : ''}. Utilisez les flèches pour changer de mois,
              cliquez sur un élément pour l’ouvrir
              {ctx.peutEditer ? ', ou sur « + » dans un jour pour créer un élément à cette date' : ''}.
            </p>
          </div>
          <InfoBulles contenu="Les éléments sans date n’apparaissent pas. Pensez à renseigner la date.">
            <span className="flex h-5 w-5 items-center justify-center texte-faible">
              <Info className="h-3.5 w-3.5" />
            </span>
          </InfoBulles>
          <button
            type="button"
            onClick={() => setAideVisible(false)}
            className="flex h-5 w-5 items-center justify-center rounded texte-faible hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Masquer l’aide"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Barre de navigation mensuelle */}
      <div className="flex items-center gap-2">
        <InfoBulles contenu="Mois précédent">
          <button
            type="button"
            onClick={() => decaler(-1)}
            className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </InfoBulles>
        <InfoBulles contenu="Mois suivant">
          <button
            type="button"
            onClick={() => decaler(1)}
            className="flex h-7 w-7 items-center justify-center rounded texte-doux hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </InfoBulles>
        <h3 className="ml-1 text-base font-semibold capitalize">
          {NOMS_MOIS[curseur.mois]} {curseur.annee}
        </h3>
        <InfoBulles contenu="Les éléments sont placés automatiquement selon leur date.">
          <span className="flex h-5 w-5 items-center justify-center texte-faible">
            <Info className="h-3.5 w-3.5" />
          </span>
        </InfoBulles>
        <InfoBulles contenu="Revenir au mois courant">
          <button
            type="button"
            onClick={() => setCurseur({ annee: aujourdhui.getFullYear(), mois: aujourdhui.getMonth() })}
            className="bouton ml-auto text-sm"
          >
            Aujourd’hui
          </button>
        </InfoBulles>
      </div>

      {/* Rappel quand aucun élément n'a de date */}
      {aucuneDatePlacee && (
        <p className="text-xs texte-faible">
          Aucun élément n’a encore de date{propriete ? ` pour « ${propriete.nom} »` : ''} : le calendrier
          reste vide. Renseignez une date sur vos éléments pour les voir apparaître ici.
        </p>
      )}


      {/* Grille */}
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border" style={{ borderColor: 'var(--bordure)' }}>
        {NOMS_JOURS.map((jour) => (
          <div
            key={jour}
            className="px-2 py-1 text-center text-xs font-medium texte-faible"
            style={{ backgroundColor: 'var(--fond-secondaire)' }}
          >
            {jour}
          </div>
        ))}

        {jours.map((jour) => {
          const cle = `${jour.getFullYear()}-${jour.getMonth()}-${jour.getDate()}`;
          const elements = parJour.get(cle) || [];
          const horsMois = jour.getMonth() !== curseur.mois;
          const estAujourdhui = memeJour(jour, aujourdhui);
          return (
            <div
              key={cle}
              className={cn('min-h-[92px] border-t border-r p-1', horsMois && 'opacity-50')}
              style={{ borderColor: 'var(--bordure)' }}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={cn(
                    'text-xs',
                    estAujourdhui
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 font-medium text-white'
                      : 'texte-faible'
                  )}
                >
                  {jour.getDate()}
                </span>
                {ctx.peutEditer && (
                  <button
                    type="button"
                    onClick={() => creerLe(jour)}
                    title="Créer un élément"
                    className="opacity-0 transition-opacity hover:opacity-100"
                    aria-label="Ajouter un élément"
                  >
                    <Plus className="h-3 w-3 texte-faible" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {elements.slice(0, 3).map((element) => (
                  <button
                    key={element._id}
                    type="button"
                    onClick={() => ctx.ouvrirElement(element)}
                    className={cn('truncate rounded px-1 py-0.5 text-left text-[11px]', couleurEtiquette(element.etiquette || element.titre))}
                  >
                    {element.titre}
                  </button>
                ))}
                {elements.length > 3 && (
                  <span className="px-1 text-[11px] texte-faible">+{elements.length - 3} autre(s)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
