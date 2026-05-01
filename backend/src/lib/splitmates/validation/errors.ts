import { ZodError } from "zod";

export function formatValidationError(error: unknown, fallbackMessage: string) {
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    if (firstIssue) {
      const fieldName = firstIssue.path[0];
      const prefix = typeof fieldName === "string" && fieldName.length > 0 ? `${fieldName[0].toUpperCase()}${fieldName.slice(1)}: ` : "";
      return `${prefix}${firstIssue.message}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}
