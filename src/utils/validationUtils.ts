// Argument checks for model edits: return the clean value or throw a readable error

/** A usable entity name: trimmed and not empty */
export const requireName = (name: unknown): string => {
  const value = typeof name === "string" ? name.trim() : "";
  if (!value) throw new Error("The name must not be empty");
  return value;
};

/** One of the allowed values, or a readable error listing them */
export const requireOneOf = <T extends string>(value: unknown, allowed: readonly T[], label: string): T => {
  if (!allowed.includes(value as T)) throw new Error(`${label} must be one of: ${allowed.join(", ")}`);
  return value as T;
};
