import { VuePage } from '@/components/editeur/VuePage';

/** Page accessible sans slug d'espace : URL `/page/:pageId`. */
export default function PageSansSlug({ params }: { params: { pageId: string } }) {
  return <VuePage pageId={params.pageId} />;
}
