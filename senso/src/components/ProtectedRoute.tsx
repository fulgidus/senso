import { Navigate } from "react-router-dom"
import { useAuthContext } from "@/features/auth/AuthContext"

type ProtectedRouteProps = {
  adminOnly?: boolean
  children: React.ReactNode
}

/**
 * Thin auth gate.  If adminOnly is set, non-admin users are redirected to /.
 *
 * Auth check (unauthenticated → /login#{currentPath}) is handled at the
 * AppRoutes level before the AuthContext.Provider, so reaching this component
 * already guarantees the user is authenticated.
 */
export function ProtectedRoute({ adminOnly, children }: ProtectedRouteProps) {
  const { user } = useAuthContext()

  if (adminOnly && !user.isAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
