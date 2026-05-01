import { GroupPreviewPage } from "@/components/pages/groups/group-preview-page";

export default async function GroupPreviewRoute({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <GroupPreviewPage groupId={Number(groupId)} />;
}
