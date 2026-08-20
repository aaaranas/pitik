import { RollDetail } from "@/components/roll/roll-detail";

/**
 * Rolls live in IndexedDB on the device, so the server has nothing to render
 * here and nothing to prerender for. The page is a shell; the client resolves
 * the id against local storage.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RollDetail rollId={id} />;
}
