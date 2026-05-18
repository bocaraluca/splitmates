import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendPasswordResetEmail } from "./mail-service";

export async function createPasswordResetToken(email: string) {
    const user = await prisma.user.findUnique({ 
        where: {
            email: email.trim().toLowerCase()
        }
    })
    if (!user) {
        return null;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await prisma.passwordResetToken.create({
        data: {
            token,
            userId: user.id,
            expiresAt
        }    
    });

    await sendPasswordResetEmail(user.email, token);

    return { token, userId: user.id };
}