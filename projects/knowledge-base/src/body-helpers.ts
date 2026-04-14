/**
 * Type-safe helpers for extracting typed values from parsed request bodies.
 * Kept in a separate module so tests can import these without starting the server.
 */

/**
 * Returns the string value for the given key in a parsed request body,
 * or undefined if the value is absent or not a string.
 */
export function getString(body: Record<string, unknown>, key: string): string | undefined {
  const v = body[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Returns the number value for the given key in a parsed request body,
 * or undefined if the value is absent or not a number.
 */
export function getNumber(body: Record<string, unknown>, key: string): number | undefined {
  const v = body[key];
  return typeof v === 'number' ? v : undefined;
}

/**
 * Returns the boolean value for the given key in a parsed request body,
 * or undefined if the value is absent or not a boolean.
 */
export function getBoolean(body: Record<string, unknown>, key: string): boolean | undefined {
  const v = body[key];
  return typeof v === 'boolean' ? v : undefined;
}
