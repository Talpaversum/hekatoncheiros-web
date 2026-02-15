export function readErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybeStatus = (error as { status?: unknown }).status;
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeStatus === "number" && typeof maybeMessage === "string") {
      return `HTTP ${maybeStatus}: ${maybeMessage}`;
    }
    if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Neočekávaná chyba.";
}
