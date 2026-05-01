import { EditExpensePage } from "@/components/pages/expenses/edit-expense-page";

export default async function NewExpenseRoute({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return <EditExpensePage groupId={Number(groupId)} />;
}
