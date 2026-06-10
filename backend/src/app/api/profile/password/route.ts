import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "New password must be at least 6 characters."),
});

export async function PATCH(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) return jsonError("Unauthorized.", 401);

    const body = await request.json();
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) return jsonError("User not found.", 404);

    if (!user.passwordHash) {
      return jsonError("This account uses Google login. Password cannot be changed.", 400);
    }

    const valid = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!valid) return jsonError("Current password is incorrect.", 400);

    await prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash: bcrypt.hashSync(newPassword, 10) },
    });

    return jsonOk({ message: "Password updated successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to change password.";
    return jsonError(message, 400);
  }
}
