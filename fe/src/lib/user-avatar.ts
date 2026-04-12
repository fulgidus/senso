import type { User } from "@/features/auth/types";

/**
 * Strip the `$` or `!` prefix from a username for display purposes.
 * e.g. `$witty-otter-42` → `witty-otter-42`, `!admin` → `admin`
 */
export function stripUsernamePrefix(username: string): string {
  if (username.startsWith("$") || username.startsWith("!")) {
    return username.slice(1);
  }
  return username;
}

/**
 * Returns 1-2 uppercase initials for the user.
 * Priority: username[0] (prefix stripped) → email[0] → "U"
 */
export function getInitials(user: User): string {
  if (user.username) {
    const stripped = stripUsernamePrefix(user.username);
    return (stripped[0] ?? "U").toUpperCase();
  }
  if (user.email) {
    return user.email[0].toUpperCase();
  }
  return "U";
}

/**
 * Returns the display name for the user.
 * Priority: username (prefix stripped) → "Utente"
 */
export function getDisplayName(user: User): string {
  if (user.username) {
    return stripUsernamePrefix(user.username);
  }
  return "Utente";
}
