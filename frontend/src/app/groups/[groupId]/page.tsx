import { GroupPreviewPage } from "@/components/pages/groups/group-preview-page";

export default async function GroupPreviewRoute({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { groupId } = await params;
  const { tab } = await searchParams;
  return <GroupPreviewPage groupId={Number(groupId)} initialTab={tab === "settlements" ? "settlements" : undefined} />;
}
