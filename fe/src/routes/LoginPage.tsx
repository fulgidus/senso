import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthScreen } from "@/features/auth/AuthScreen";
import type { useAuth } from "@/features/auth/useAuth";

type LoginPageProps = {
  auth: ReturnType<typeof useAuth>;
};

/**
 * /login route with #returnUrl support.
 *
 * - /login#any/route → auth?OK → navigate to /any/route
 * - /login           → auth?OK → navigate to /
 * - /login           → auth?KO → <AuthScreen />
 */
export function LoginPage({ auth }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // When user becomes authenticated, redirect to hash target or /
  // After signup, always go to / (ignore returnUrl) so user flows through setup/onboarding
  useEffect(() => {
    if (auth.isAuthenticated && auth.user) {
      if (auth.mode === "signup") {
        navigate("/", { replace: true });
        return;
      }
      const hash = location.hash.slice(1); // remove the # prefix
      const target = hash && hash.startsWith("/") ? hash : "/";
      navigate(target, { replace: true });
    }
  }, [auth.isAuthenticated, auth.user, auth.mode, location.hash, navigate]);

  // Already authenticated → the useEffect above will handle the redirect.
  // Show nothing while it fires.
  if (auth.isAuthenticated && auth.user) return null;

  return (
    <AuthScreen
      mode={auth.mode}
      loading={auth.loading}
      error={auth.error}
      googleFallback={auth.googleFallback}
      onModeChange={auth.setMode}
      onSubmit={auth.submit}
      onGoogle={auth.beginGoogle}
    />
  );
}
