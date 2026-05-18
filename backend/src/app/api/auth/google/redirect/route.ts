import { jsonError } from "@/lib/splitmates/api/http";
import { createSession } from "@/lib/splitmates/services/auth/session-service";
import { prisma } from "@/lib/prisma";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
        void logHttpAction({
            request,
            actionType: ACTION_TYPES.AUTH_GOOGLE_LOGIN_FAILED,
            outcome: LogOutcome.failed,
            actionJson: { method: "google", reason: "Missing code parameter" },
        })
        return Response.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
    }

    try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenResponse.json() as { access_token: string };

        if (!tokenData.access_token) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.AUTH_GOOGLE_LOGIN_FAILED,
                outcome: LogOutcome.failed,
                actionJson: { method: "google", reason: "No access token returned" },
            });
            return Response.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
        }

        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const googleUser = await userInfoResponse.json() as { id: string, email: string, name: string };

        if (!googleUser.email) {
            void logHttpAction({
                request,
                actionType: ACTION_TYPES.AUTH_GOOGLE_LOGIN_FAILED,
                outcome: LogOutcome.failed,
                actionJson: { method: "google", reason: "No email returned from Google" },
            });
            return Response.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
        }

        let user = await prisma.user.findUnique({ where: { email: googleUser.email } });

        if (!user) {
            const role = await prisma.role.findFirst({ where: { title: "user" } });
            if (!role) {
                return jsonError("Default user role not found", 500);
            }

            const baseUsername = googleUser.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
            let username = baseUsername;
            let suffix = 1;
            while (await prisma.user.findUnique({ where: { username } })) {
                username = `${baseUsername}${suffix++}`;
            }

            user = await prisma.user.create({
                data: {
                    email: googleUser.email,
                    username,
                    roleId: role.id,
                },
            }); 
        }

        const session = await createSession(user.id);

        const roleWithPermissions = await prisma.role.findUnique({
            where: { id: user.roleId },
            include: { rolePermissions: { include: { permission: true } } },
        });

        void logHttpAction({
            request,
            actionType: ACTION_TYPES.AUTH_GOOGLE_LOGIN_SUCCESS,
            outcome: LogOutcome.success,
            fallbackUserId: user.id,
            actionJson: { method: "google" },
        });

        const permissions = roleWithPermissions?.rolePermissions.map(rp => rp.permission.title) ?? [];

        return Response.redirect(
            `${process.env.FRONTEND_URL}/auth/google/callback?token=${session.token}&username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(roleWithPermissions?.title ?? "user")}&permissions=${encodeURIComponent(JSON.stringify(permissions))}`
        );
    }
    catch (error) {
        void logHttpAction({
            request,
            actionType: ACTION_TYPES.AUTH_GOOGLE_LOGIN_FAILED,
            outcome: LogOutcome.failed,
            actionJson: { method: "google", reason: "Unexpected error" },
        });

        return Response.redirect(`${process.env.FRONTEND_URL}/login?error=google_failed`);
    }
}