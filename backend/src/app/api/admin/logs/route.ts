import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { requirePermission } from "@/lib/splitmates/services/auth/permissions-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import { ACTION_TYPES } from "@/lib/splitmates/logging/action-types";
import { getLogs, LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

function serializeLog(log: Awaited<ReturnType<typeof getLogs>>["items"][number]) {
  return {
    id: log.id.toString(),
    userId: log.userId,
    user: log.user ? { username: log.user.username, email: log.user.email } : undefined,
    groupId: log.groupId,
    roleId: log.roleId,
    roleTitle: log.roleTitle,
    actionType: log.actionType,
    actionJson: log.actionJson,
    ip: log.ip,
    clientInfo: log.clientInfo,
    requestId: log.requestId,
    outcome: log.outcome,
    createdAt: log.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_LOGS_GET_UNAUTHORIZED,
        outcome: LogOutcome.forbidden,
      });
      return jsonError("You must be logged in to view logs.", 401);
    }

    try {
      await requirePermission(actor.id, "View all users");
    } catch (permissionError) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_LOGS_GET_FORBIDDEN,
        outcome: LogOutcome.forbidden,
      });
      throw permissionError;
    }

    const url = new URL(request.url);
    const userIdParam = url.searchParams.get("userId");
    const pageParam = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const pageSizeParam = Number.parseInt(url.searchParams.get("pageSize") ?? "50", 10);

    if (!userIdParam) {
      return jsonError("userId is required.", 400);
    }

    const userId = Number.parseInt(userIdParam, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return jsonError("Invalid userId.", 400);
    }

    const result = await getLogs(
      { userId },
      {
        page: Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1,
        pageSize: Number.isInteger(pageSizeParam) && pageSizeParam > 0 ? pageSizeParam : 50,
      },
    );

    await logHttpAction({
      request,
      actionType: ACTION_TYPES.ADMIN_LOGS_GET,
      outcome: LogOutcome.success,
      actionJson: { userId, total: result.total },
    });

    return jsonOk({
      logs: result.items.map(serializeLog),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
    const message = error instanceof Error ? error.message : "Unable to load logs.";

    if (status !== 403) {
      await logHttpAction({
        request,
        actionType: ACTION_TYPES.ADMIN_LOGS_GET_FAILED,
        outcome: LogOutcome.failed,
        actionJson: { error: message },
      });
    }

    return jsonError(message, status ?? 400);
  }
}
