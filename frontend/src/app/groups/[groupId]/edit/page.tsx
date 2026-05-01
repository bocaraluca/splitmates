import { EditGroupPage } from "@/components/pages/groups/edit-group-page";

export default async function EditGroupRoute({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <EditGroupPage groupId={Number(groupId)} />;
}
