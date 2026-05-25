import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { getAppBalancesNoCache, getAppBalancesOptimized } from "@/lib/splitmates/services/app-balances-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
    try {
        const currentUser = await getCurrentUserFromRequest(request);
        if (!currentUser) {
            return jsonError("You are not logged in!", 401);
        }

        await requirePermission(currentUser.id, "View all users");

        const {searchParams} = new URL(request.url);
        const optimized = searchParams.get("optimized") === "true";

        const result = optimized ? await getAppBalancesOptimized() : await getAppBalancesNoCache();

        return jsonOk(result);
    }
    catch (error) {
        const status = (error as any)?.status;
        const message = error instanceof Error ? error.message : "Failed to compute app balances.";
        return jsonError(message, status ?? 500);
    }
}