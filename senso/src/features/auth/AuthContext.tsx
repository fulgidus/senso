import { createContext, useContext } from "react"
import type { User } from "@/features/auth/types"

export type AuthContextValue = {
  user: User
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuthContext must be used inside AuthContext.Provider")
  return ctx
}
