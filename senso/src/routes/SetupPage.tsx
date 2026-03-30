import { Navigate } from "react-router-dom"
import { useAuthContext } from "@/features/auth/AuthContext"
import { ProfileSetupScreen } from "@/features/profile/ProfileSetupScreen"

/**
 * /setup route.
 *
 * - user.firstName exists → / (already set up, let root resolve)
 * - otherwise             → <ProfileSetupScreen />, onComplete → /
 */
export function SetupPage() {
  const { user, updateUser } = useAuthContext()

  if (user.firstName) {
    return <Navigate to="/" replace />
  }

  return (
    <ProfileSetupScreen
      onComplete={(firstName, lastName) => {
        updateUser({ firstName, lastName })
        // navigate handled by the re-render: user.firstName now set → redirect to /
      }}
    />
  )
}
