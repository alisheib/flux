// Strip HTML tags and trim whitespace from string inputs
export function sanitize(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/<[^>]*>/g, "").trim();
}

// Sanitize an object's string values (shallow)
export function sanitizeBody<T extends Record<string, unknown>>(body: T): T {
  const result = { ...body } as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    if (typeof result[key] === "string") {
      result[key] = sanitize(result[key] as string);
    }
  }
  return result as T;
}
