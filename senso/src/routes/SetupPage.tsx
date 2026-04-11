import { Navigate } from "react-router-dom";
import { useAuthContext } from "@/features/auth/AuthContext";
import { ProfileSetupScreen } from "@/features/profile/ProfileSetupScreen";

/**
 * /setup route.
 *
 * Phase 29: Name entry removed. Setup only collects voice gender preference.
 * User is redirected to / after setup completes (handled by AppShell bootstrap logic).
 */
export function SetupPage() {
  const { user } = useAuthContext();

  // After Phase 29, setup is only needed for new users who haven't set voice gender yet.
  // Username (set at signup) is the primary identity signal now.
  if (user.username) {
    return <Navigate to="/" replace />;
  }

  return (
    <ProfileSetupScreen
      onComplete={() => {
        // Re-render will resolve routing via AppShell bootstrap
        window.location.replace("/");
      }}
    />
  );
}
