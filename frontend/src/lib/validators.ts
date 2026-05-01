import { EXPENSE_CATEGORIES, GROUP_CATEGORIES, SPLIT_TYPES } from "./types";
import type { ExpenseCategory, GroupCategory, SplitType } from "./types";

function required(value: FormDataEntryValue | null, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

function positiveNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(required(value, label));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return parsed;
}

function splitIds(raw: string) {
  return raw
    .split(/[,\s]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function parseGroupForm(formData: FormData) {
  const name = required(formData.get("name"), "Group name");
  const category = required(formData.get("category"), "Category") as GroupCategory;
  if (!GROUP_CATEGORIES.includes(category)) {
    throw new Error("Choose a valid group category.");
  }
  return { name, category };
}

export function parseAuthLoginForm(formData: FormData) {
  return {
    identifier: required(formData.get("identifier"), "Username or email"),
    password: required(formData.get("password"), "Password"),
  };
}

export function parseAuthRegisterForm(formData: FormData) {
  const username = required(formData.get("username"), "Username");
  const email = required(formData.get("email"), "Email");
  const password = required(formData.get("password"), "Password");
  const confirmPassword = required(formData.get("confirmPassword"), "Confirm password");
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  return { username, email, password, confirmPassword };
}

export function parseExpenseForm(formData: FormData) {
  const title = required(formData.get("title"), "Title");
  const amount = positiveNumber(formData.get("amount"), "Amount");
  const category = required(formData.get("category"), "Category") as ExpenseCategory;
  const date = required(formData.get("date"), "Date");
  const paidByUserId = positiveNumber(formData.get("paidByUserId"), "Paid by");
  const splitType = required(formData.get("splitType"), "Split type") as SplitType;
  const memberIds = splitIds(required(formData.get("memberIds"), "Member IDs"));
  const sharesText = String(formData.get("shares") ?? "").trim();
  const shares = sharesText
    ? sharesText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [userIdText, amountText] = line.split(/[:=]/).map((part) => part.trim());
          const userId = Number(userIdText);
          const shareAmount = Number(amountText);
          if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(shareAmount) || shareAmount < 0) {
            throw new Error("Each custom share must look like userId:amount and use a non-negative value.");
          }
          return { userId, amount: shareAmount };
        })
    : [];

  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new Error("Choose a valid expense category.");
  }
  if (!SPLIT_TYPES.includes(splitType)) {
    throw new Error("Choose a valid split type.");
  }

  return {
    title,
    amount,
    currency: "RON" as const,
    category,
    date,
    paidByUserId,
    splitType,
    memberIds,
    shares,
  };
}

export function parseSettlementForm(formData: FormData) {
  return {
    fromUserId: positiveNumber(formData.get("fromUserId"), "From user"),
    toUserId: positiveNumber(formData.get("toUserId"), "To user"),
    amount: positiveNumber(formData.get("amount"), "Amount"),
    note: String(formData.get("note") ?? "").trim() || undefined,
  };
}
