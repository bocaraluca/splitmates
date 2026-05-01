import { EditExpensePage } from "@/components/pages/expenses/edit-expense-page";

export default async function EditExpenseRoute({ params }: { params: Promise<{ groupId: string; expenseId: string }> }) {
  const { groupId, expenseId } = await params;
  return <EditExpensePage groupId={Number(groupId)} expenseId={Number(expenseId)} />;
}
