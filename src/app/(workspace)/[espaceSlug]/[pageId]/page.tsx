import { VuePage } from '@/components/editeur/VuePage';

/** Page d'un espace identifié par son slug : URL `/:espaceSlug/:pageId`. */
export default function PageEspacePage({ params }: { params: { espaceSlug: string; pageId: string } }) {
  return <VuePage pageId={params.pageId} />;
}
