import { prisma } from "@/lib/prisma";

export async function getUserPermissions(userId: number) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            role: {
                include: {
                    rolePermissions: {
                        include: {
                            permission: true,
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        throw new Error("User not found.");
    }

    return {
        role: user.role.title,
        permissions: user.role.rolePermissions.map((rolePermission) => rolePermission.permission.title),
    };
}

export async function requirePermission(userId: number, permissionTitle: string) {
    const { role, permissions } = await getUserPermissions(userId);

    if (role === "admin") {
        return;
    }

    if (!permissions.includes(permissionTitle)) {
        const error = new Error("You do not have permission to perform this action.") as Error & { status?: number };
        error.status = 403;
        throw error;
    }
}