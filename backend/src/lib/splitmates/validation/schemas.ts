import { z } from "zod";
import { EXPENSE_CATEGORIES, GROUP_CATEGORIES } from "../model/types";

const moneySchema = z.coerce.number().positive();
const idSchema = z.coerce.number().int().positive();

export const signupSchema = z
  .object({
    username: z.string().trim().min(3, "Username must be at least 3 characters.").max(30, "Username must be 30 characters or fewer."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters.").max(100, "Password must be 100 characters or fewer."),
    confirmPassword: z.string().min(6, "Confirm your password.").max(100, "Confirm password must be 100 characters or fewer."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Username or email must be at least 3 characters.").max(120, "Username or email must be 120 characters or fewer."),
  password: z.string().min(6, "Password must be at least 6 characters.").max(100, "Password must be 100 characters or fewer."),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters.").max(80, "Group name must be 80 characters or fewer."),
  description: z.string().trim().max(160, "Description must be 160 characters or fewer.").optional(),
  category: z.enum(GROUP_CATEGORIES),
});

export const addGroupMemberSchema = z.object({
  identifier: z.string().trim().min(3, "Username or email must be at least 3 characters.").max(120, "Username or email must be 120 characters or fewer."),
});

export const settlementSchema = z
  .object({
    fromUserId: idSchema,
    toUserId: idSchema,
    amount: moneySchema,
    date: z.string().trim().min(4).optional(),
    note: z.string().trim().max(160).optional(),
  })
  .refine((value) => value.fromUserId !== value.toUserId, {
    message: "A settlement must involve two different users.",
    path: ["toUserId"],
  });

const shareSchema = z.object({
  userId: idSchema,
  amount: moneySchema,
});

export const expenseSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    amount: moneySchema,
    currency: z.literal("RON").default("RON"),
    category: z.enum(EXPENSE_CATEGORIES),
    date: z.string().trim().min(4),
    paidByUserId: idSchema,
    splitType: z.enum(["equal", "custom"]),
    memberIds: z.array(idSchema).default([]),
    shares: z.array(shareSchema).default([]),
  })
  .superRefine((value, context) => {
    if (value.splitType === "equal") {
      if (value.memberIds.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one member is required for equal split.",
          path: ["memberIds"],
        });
      }
      if (value.shares.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Equal split cannot include explicit shares.",
          path: ["shares"],
        });
      }
    }

    if (value.splitType === "custom") {
      if (value.shares.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom split requires shares.",
          path: ["shares"],
        });
      }

      const totalShares = value.shares.reduce((sum, share) => sum + share.amount, 0);
      if (Math.abs(totalShares - value.amount) > 0.01) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Custom shares must add up to the expense amount.",
          path: ["shares"],
        });
      }
    }
  });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().refine((value) => [5, 10, 20].includes(value), {
    message: "pageSize must be 5, 10, or 20.",
  }).default(5),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  paidByUserId: idSchema.optional(),
  sortBy: z.enum(["date", "amount"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const dashboardSchema = z.object({
  userId: idSchema.optional(),
});

export const generatorSchema = z.object({
  groupId: idSchema.optional(),
});
