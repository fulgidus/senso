import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthContext } from "@/features/auth/AuthContext";
import { createProfileApi } from "@/lib/profile-api";
import { readAccessToken } from "@/features/auth/storage";

/**
 * "/" resolver - redirect-only, no UI of its own.
 *
 * Logic gates, evaluated in order:
 *   1. !user.username                               → /setup
 *   2. profile.confirmed === true                   → /chat  (questionnaire path)
 *   3. profileStatus in (complete, generating_insights, categorizing, queued)
 *                                                   → /chat  (document upload path - processing OK)
 *   4. uploads exist but not started                → /onboarding/processing#start
 *   5. otherwise                                    → /onboarding
 *
 * Auth check is already handled at the AppRoutes level (unauthenticated
 * users never reach this component).
 */
export function RootResolver() {
  const { user, onUnauthorized } = useAuthContext();
  const token = readAccessToken();
  const { t } = useTranslation();
  const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized]);
  const [target, setTarget] = useState<string | null>(null);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;

    // Gate 1: setup not done (Phase 29: username is the identity signal, not firstName)
    if (!user.username) {
      hasRunRef.current = true;
      setTarget("/setup");
      return;
    }

    // Gate 2+3: check both confirmed flag and categorization status
    if (!token) {
      hasRunRef.current = true;
      setTarget("/onboarding");
      return;
    }

    hasRunRef.current = true;

    void Promise.all([
      profileApi.getProfileStatus(token).catch(() => null),
      profileApi.getProfile(token).catch(() => null),
    ])
      .then(([statusData, profile]) => {
        // Questionnaire path: profile confirmed → go to chat directly
        if (profile?.confirmed) {
          setTarget("/chat");
          return;
        }
        // Document upload path: any processing status OK for chat (data exists)
        const processingStatuses = ["complete", "generating_insights", "categorizing", "queued"];
        if (statusData && processingStatuses.includes(statusData.status)) {
          setTarget("/chat");
          return;
        }
        // Uploads exist but not processed → trigger processing
        if (statusData?.currentUploadsFingerprint && statusData.status === "not_started") {
          setTarget("/onboarding/processing#start");
          return;
        }
        // Both calls failed → safe fallback
        if (!statusData && !profile) {
          setTarget("/onboarding");
          return;
        }
        // Otherwise, start onboarding
        setTarget("/onboarding");
      })
      .catch(() => {
        // On error, fall through to onboarding (safe default)
        setTarget("/onboarding");
      });
  }, [user.username, token, profileApi]);

  if (!target) {
    // Brief loading while we check profile status
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
      </main>
    );
  }

  return <Navigate to={target} replace />;
}
