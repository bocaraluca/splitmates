-- DropForeignKey
ALTER TABLE `expense` DROP FOREIGN KEY `Expense_groupId_fkey`;

-- DropForeignKey
ALTER TABLE `expenseparticipant` DROP FOREIGN KEY `ExpenseParticipant_expenseId_fkey`;

-- DropForeignKey
ALTER TABLE `payment` DROP FOREIGN KEY `Payment_groupId_fkey`;

-- AddForeignKey
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExpenseParticipant` ADD CONSTRAINT `ExpenseParticipant_expenseId_fkey` FOREIGN KEY (`expenseId`) REFERENCES `Expense`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `Group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
