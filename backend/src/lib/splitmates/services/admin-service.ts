import { prisma } from "@/lib/prisma";

function toIsoDate(date: Date) {
  return date.toISOString();
}

export async function getAdminOverview() {
  const [users, groups] = await Promise.all([
    prisma.user.findMany({
      include: {
        role: true,
        _count: {
          select: {
            memberships: true,
            groupsCreated: true,
            expensesPaid: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.group.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: toIsoDate(user.createdAt),
      role: user.role.title,
      membershipsCount: user._count.memberships,
      groupsCreatedCount: user._count.groupsCreated,
      expensesPaidCount: user._count.expensesPaid,
    })),
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      createdAt: toIsoDate(group.createdAt),
      admins: group.members.filter(m => m.isAdmin).map((member) => member.user),
      memberCount: group.members.length,
    })),
  };
}

export async function deleteUserAccount(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.session.deleteMany({ where: { userId } });
    await transaction.expenseParticipant.deleteMany({ where: { userId } });
    await transaction.payment.deleteMany({ where: { OR: [{ fromUserId: userId }, { toUserId: userId }] } });
    await transaction.expense.deleteMany({ where: { paidByUserId: userId } });
    await transaction.group.deleteMany({ where: { createdByUserId: userId } });
    await transaction.user.delete({ where: { id: userId } });
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: toIsoDate(user.createdAt),
  };
}

export async function updateUserRole(userId: number, roleTitle: string) {
  const normalizedRoleTitle = roleTitle.trim().toLowerCase();
  if (!normalizedRoleTitle) {
    throw new Error("Role is required.");
  }

  const role = await prisma.role.findUnique({
    where: { title: normalizedRoleTitle },
  });

  if (!role) {
    throw new Error("Role not found.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
    },
  });

  if (!user) {
    return null;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { roleId: role.id },
  });

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: toIsoDate(user.createdAt),
    role: role.title,
  };
}