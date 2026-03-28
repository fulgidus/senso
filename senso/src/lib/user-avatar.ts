import type { User } from "@/features/auth/types"

/**
 * Returns 1-2 uppercase initials for the user.
 * Priority: firstName + lastName initials → firstName initial → email initial → "U"
 */
export function getInitials(user: User): string {
  const first = user.firstName?.trim()
  const last = user.lastName?.trim()
  if (first && last) {
    return (first[0] + last[0]).toUpperCase()
  }
  if (first) {
    return first[0].toUpperCase()
  }
  if (user.email) {
    return user.email[0].toUpperCase()
  }
  return "U"
}

/**
 * Returns the display name for the user.
 * Priority: firstName → "Utente"
 */
export function getDisplayName(user: User): string {
  const first = user.firstName?.trim()
  if (first) return first
  return "Utente"
}
