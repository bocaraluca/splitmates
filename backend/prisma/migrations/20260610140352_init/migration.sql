-- CreateEnum
CREATE TYPE "GroupCategory" AS ENUM ('household', 'trip', 'friends', 'family', 'roommates', 'other');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('rent', 'groceries', 'utilities', 'transport', 'entertainment', 'food', 'other', 'alcohol', 'gambling', 'smoking', 'fast_food', 'luxury', 'online_shopping', 'subscriptions');

-- CreateEnum
CREATE TYPE "SplitType" AS ENUM ('equal', 'custom');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('manual', 'wise');

-- CreateEnum
CREATE TYPE "LogOutcome" AS ENUM ('success', 'failed', 'forbidden', 'validation_error', 'not_found', 'rate_limited');

-- CreateEnum
CREATE TYPE "LogActionType" AS ENUM ('GROUP_CHAT_HISTORY_GET', 'GROUP_CHAT_HISTORY_GET_INVALID_GROUP_ID', 'GROUP_CHAT_HISTORY_GET_UNAUTHORIZED', 'GROUP_CHAT_HISTORY_GET_INVALID_PAGINATION', 'GROUP_CHAT_HISTORY_GET_FORBIDDEN', 'GROUP_CHAT_HISTORY_GET_NOT_FOUND', 'GROUP_CHAT_HISTORY_GET_FAILED', 'GROUP_CHAT_MESSAGE_DELETE', 'GROUP_CHAT_MESSAGE_DELETE_INVALID_GROUP_ID', 'GROUP_CHAT_MESSAGE_DELETE_UNAUTHORIZED', 'GROUP_CHAT_MESSAGE_DELETE_FORBIDDEN', 'GROUP_CHAT_MESSAGE_DELETE_NOT_FOUND', 'GROUP_CHAT_MESSAGE_DELETE_FAILED', 'GROUP_DETAIL_GET', 'GROUP_DETAIL_GET_INVALID_GROUP_ID', 'GROUP_DETAIL_GET_UNAUTHORIZED', 'GROUP_DETAIL_GET_FORBIDDEN', 'GROUP_DETAIL_GET_NOT_FOUND', 'GROUP_DETAIL_GET_FAILED', 'GROUP_DETAIL_PATCH', 'GROUP_DETAIL_PATCH_INVALID_GROUP_ID', 'GROUP_DETAIL_PATCH_UNAUTHORIZED', 'GROUP_DETAIL_PATCH_NOT_FOUND', 'GROUP_DETAIL_PATCH_FAILED', 'GROUP_DETAIL_DELETE', 'GROUP_DETAIL_DELETE_INVALID_GROUP_ID', 'GROUP_DETAIL_DELETE_UNAUTHORIZED', 'GROUP_DETAIL_DELETE_NOT_FOUND', 'GROUP_DETAIL_DELETE_FAILED', 'ADMIN_GROUP_DELETE', 'ADMIN_GROUP_DELETE_INVALID_GROUP_ID', 'ADMIN_GROUP_DELETE_UNAUTHORIZED', 'ADMIN_GROUP_DELETE_FORBIDDEN', 'ADMIN_GROUP_DELETE_NOT_FOUND', 'ADMIN_GROUP_DELETE_FAILED', 'ADMIN_OVERVIEW_GET', 'ADMIN_OVERVIEW_GET_UNAUTHORIZED', 'ADMIN_OVERVIEW_GET_FORBIDDEN', 'ADMIN_OVERVIEW_GET_FAILED', 'ADMIN_USER_DELETE', 'ADMIN_USER_DELETE_INVALID_USER_ID', 'ADMIN_USER_DELETE_UNAUTHORIZED', 'ADMIN_USER_DELETE_FORBIDDEN', 'ADMIN_USER_DELETE_NOT_FOUND', 'ADMIN_USER_DELETE_FAILED', 'ADMIN_USER_ROLE_UPDATE', 'ADMIN_USER_ROLE_UPDATE_INVALID_USER_ID', 'ADMIN_USER_ROLE_UPDATE_INVALID_ROLE', 'ADMIN_USER_ROLE_UPDATE_UNAUTHORIZED', 'ADMIN_USER_ROLE_UPDATE_FORBIDDEN', 'ADMIN_USER_ROLE_UPDATE_NOT_FOUND', 'ADMIN_USER_ROLE_UPDATE_FAILED', 'ADMIN_LOGS_GET', 'ADMIN_LOGS_GET_UNAUTHORIZED', 'ADMIN_LOGS_GET_FORBIDDEN', 'ADMIN_LOGS_GET_FAILED', 'ADMIN_SUSPICIOUS_GET', 'ADMIN_SUSPICIOUS_GET_UNAUTHORIZED', 'ADMIN_SUSPICIOUS_GET_FORBIDDEN', 'ADMIN_SUSPICIOUS_GET_FAILED', 'ADMIN_SUSPICIOUS_PATCH', 'ADMIN_SUSPICIOUS_PATCH_UNAUTHORIZED', 'ADMIN_SUSPICIOUS_PATCH_FORBIDDEN', 'ADMIN_SUSPICIOUS_PATCH_INVALID_USER_ID', 'ADMIN_SUSPICIOUS_PATCH_NOT_FOUND', 'ADMIN_SUSPICIOUS_PATCH_FAILED', 'DASHBOARD_GET', 'DASHBOARD_GET_NO_USERS', 'DASHBOARD_GET_FAILED', 'EVENTS_STREAM_CONNECT', 'EVENTS_STREAM_DISCONNECT', 'GENERATOR_START', 'GENERATOR_START_INVALID_PAYLOAD', 'GENERATOR_START_FAILED', 'GENERATOR_STATUS_GET', 'GENERATOR_STATUS_GET_FAILED', 'GENERATOR_STOP', 'GENERATOR_STOP_FAILED', 'GROUPS_GET', 'GROUPS_GET_UNAUTHORIZED', 'GROUPS_GET_FAILED', 'GROUPS_CREATE', 'GROUPS_CREATE_UNAUTHORIZED', 'GROUPS_CREATE_FAILED', 'GROUP_MEMBERS_ADD', 'GROUP_MEMBERS_ADD_UNAUTHORIZED', 'GROUP_MEMBERS_ADD_INVALID_GROUP_ID', 'GROUP_MEMBERS_ADD_FAILED', 'GROUP_MEMBERS_REMOVE', 'GROUP_MEMBERS_REMOVE_UNAUTHORIZED', 'GROUP_MEMBERS_REMOVE_INVALID_GROUP_ID', 'GROUP_MEMBERS_REMOVE_NOT_FOUND', 'GROUP_MEMBERS_REMOVE_FAILED', 'GROUP_EXPENSES_GET', 'GROUP_EXPENSES_GET_INVALID_GROUP_ID', 'GROUP_EXPENSES_GET_NOT_FOUND', 'GROUP_EXPENSES_GET_FAILED', 'GROUP_EXPENSES_CREATE', 'GROUP_EXPENSES_CREATE_UNAUTHORIZED', 'GROUP_EXPENSES_CREATE_INVALID_GROUP_ID', 'GROUP_EXPENSES_CREATE_FAILED', 'GROUP_EXPENSES_DETAIL_GET', 'GROUP_EXPENSES_DETAIL_GET_INVALID_GROUP_ID', 'GROUP_EXPENSES_DETAIL_GET_NOT_FOUND', 'GROUP_EXPENSES_DETAIL_GET_FAILED', 'GROUP_EXPENSES_DETAIL_PATCH', 'GROUP_EXPENSES_DETAIL_PATCH_UNAUTHORIZED', 'GROUP_EXPENSES_DETAIL_PATCH_INVALID_GROUP_ID', 'GROUP_EXPENSES_DETAIL_PATCH_NOT_FOUND', 'GROUP_EXPENSES_DETAIL_PATCH_FAILED', 'GROUP_EXPENSES_DETAIL_DELETE', 'GROUP_EXPENSES_DETAIL_DELETE_UNAUTHORIZED', 'GROUP_EXPENSES_DETAIL_DELETE_INVALID_GROUP_ID', 'GROUP_EXPENSES_DETAIL_DELETE_NOT_FOUND', 'GROUP_EXPENSES_DETAIL_DELETE_FAILED', 'GROUP_STATS_GET', 'GROUP_STATS_GET_INVALID_GROUP_ID', 'GROUP_STATS_GET_NOT_FOUND', 'GROUP_STATS_GET_FAILED', 'GROUP_PAYMENTS_GET', 'GROUP_PAYMENTS_GET_INVALID_GROUP_ID', 'GROUP_PAYMENTS_GET_NOT_FOUND', 'GROUP_PAYMENTS_GET_FAILED', 'GROUP_PAYMENTS_CREATE', 'GROUP_PAYMENTS_CREATE_UNAUTHORIZED', 'GROUP_PAYMENTS_CREATE_INVALID_GROUP_ID', 'GROUP_PAYMENTS_CREATE_FAILED', 'GROUP_LEAVE', 'GROUP_LEAVE_UNAUTHORIZED', 'GROUP_LEAVE_INVALID_GROUP_ID', 'GROUP_LEAVE_FAILED', 'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_LOGOUT_FAILED', 'AUTH_SIGNUP_SUCCESS', 'AUTH_SIGNUP_FAILED', 'DASHBOARD_GET_UNAUTHORIZED', 'EVENTS_STREAM_UNAUTHORIZED', 'GENERATOR_START_UNAUTHORIZED', 'GENERATOR_STATUS_GET_UNAUTHORIZED', 'GENERATOR_STOP_UNAUTHORIZED', 'GROUP_EXPENSES_GET_UNAUTHORIZED', 'GROUP_EXPENSES_DETAIL_GET_UNAUTHORIZED', 'GROUP_PAYMENTS_GET_UNAUTHORIZED', 'GROUP_STATS_GET_UNAUTHORIZED', 'AUTH_FORGOT_PASSWORD', 'AUTH_FORGOT_PASSWORD_FAILED', 'AUTH_RESET_PASSWORD', 'AUTH_RESET_PASSWORD_FAILED', 'AUTH_RESET_PASSWORD_INVALID_TOKEN', 'AUTH_MAGIC_LINK_REQUEST', 'AUTH_MAGIC_LINK_REQUEST_FAILED', 'AUTH_MAGIC_LINK_VERIFY', 'AUTH_MAGIC_LINK_VERIFY_INVALID_TOKEN', 'AUTH_GOOGLE_LOGIN_SUCCESS', 'AUTH_GOOGLE_LOGIN_FAILED');

-- CreateEnum
CREATE TYPE "SuspiciousStatus" AS ENUM ('underReview', 'cleared');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wiseEmail" TEXT,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "GroupCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" INTEGER NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","userId")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "paidByUserId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "splitType" "SplitType" NOT NULL,
    "isBadHabit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseParticipant" (
    "expenseId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ExpenseParticipant_pkey" PRIMARY KEY ("expenseId","userId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "fromUserId" INTEGER NOT NULL,
    "toUserId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "wiseTransferId" TEXT,
    "method" "PaymentMethod" NOT NULL DEFAULT 'manual',

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" BIGSERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "groupId" INTEGER,
    "roleId" INTEGER,
    "roleTitle" TEXT,
    "actionType" "LogActionType" NOT NULL,
    "actionJson" JSONB,
    "ip" TEXT,
    "clientInfo" TEXT,
    "requestId" TEXT,
    "outcome" "LogOutcome",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suspicious_users" (
    "userId" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "SuspiciousStatus" NOT NULL DEFAULT 'underReview',
    "lastSeen" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suspicious_users_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" SERIAL NOT NULL,
    "suspiciousUserId" INTEGER NOT NULL,
    "ruleId" INTEGER,
    "logId" BIGINT,
    "scoreIncrease" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "actionJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_rules" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detection_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_wiseEmail_key" ON "User"("wiseEmail");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE INDEX "Expense_groupId_idx" ON "Expense"("groupId");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");

-- CreateIndex
CREATE INDEX "Expense_paidByUserId_idx" ON "Expense"("paidByUserId");

-- CreateIndex
CREATE INDEX "Expense_isBadHabit_idx" ON "Expense"("isBadHabit");

-- CreateIndex
CREATE INDEX "ExpenseParticipant_userId_idx" ON "ExpenseParticipant"("userId");

-- CreateIndex
CREATE INDEX "Payment_groupId_idx" ON "Payment"("groupId");

-- CreateIndex
CREATE INDEX "Payment_fromUserId_idx" ON "Payment"("fromUserId");

-- CreateIndex
CREATE INDEX "Payment_toUserId_idx" ON "Payment"("toUserId");

-- CreateIndex
CREATE INDEX "Payment_wiseTransferId_idx" ON "Payment"("wiseTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_title_key" ON "Role"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_title_key" ON "Permission"("title");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "logs_requestId_key" ON "logs"("requestId");

-- CreateIndex
CREATE INDEX "logs_createdAt_idx" ON "logs"("createdAt");

-- CreateIndex
CREATE INDEX "logs_userId_createdAt_idx" ON "logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "logs_roleId_idx" ON "logs"("roleId");

-- CreateIndex
CREATE INDEX "logs_actionType_idx" ON "logs"("actionType");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_key" ON "magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "magic_link_tokens_userId_idx" ON "magic_link_tokens"("userId");

-- CreateIndex
CREATE INDEX "magic_link_tokens_token_idx" ON "magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "suspicious_users_status_idx" ON "suspicious_users"("status");

-- CreateIndex
CREATE INDEX "observations_suspiciousUserId_idx" ON "observations"("suspiciousUserId");

-- CreateIndex
CREATE INDEX "observations_ruleId_idx" ON "observations"("ruleId");

-- CreateIndex
CREATE INDEX "observations_createdAt_idx" ON "observations"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "detection_rules_key_key" ON "detection_rules"("key");

-- CreateIndex
CREATE INDEX "detection_rules_enabled_idx" ON "detection_rules"("enabled");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_tokens" ADD CONSTRAINT "magic_link_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suspicious_users" ADD CONSTRAINT "suspicious_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_suspiciousUserId_fkey" FOREIGN KEY ("suspiciousUserId") REFERENCES "suspicious_users"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "detection_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_logId_fkey" FOREIGN KEY ("logId") REFERENCES "logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
