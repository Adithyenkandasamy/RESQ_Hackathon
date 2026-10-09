/**
 * Tiny cn() helper – merges class names.
 * Avoids a full clsx dependency for now.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
