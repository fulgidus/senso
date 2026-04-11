import { useEffect, useMemo, useRef, useState } from "react";
import {
  createProfileApi,
  type CategorizationStatus,
  type ProgressDetail,
} from "@/lib/profile-api";
import { useAuthContext } from "@/features/auth/AuthContext";

type UseProfileStatusOptions = {
  token: string | null;
  onComplete: () => void;
  enabled?: boolean;
};

type ProfileStatusState = {
  status: CategorizationStatus;
  errorMessage: string | null;
  progressDetail: ProgressDetail | null;
  pollError: string | null; // Error from polling itself (not job failure)
};

export function useProfileStatus({
  token,
  onComplete,
  enabled = true,
}: UseProfileStatusOptions): ProfileStatusState {
  const { onUnauthorized } = useAuthContext();
  const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized]);
  const [state, setState] = useState<ProfileStatusState>({
    status: "queued",
    errorMessage: null,
    progressDetail: null,
    pollError: null,
  });
  const consecutiveErrorsRef = useRef(0);
  const MAX_CONSECUTIVE_ERRORS = 5;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const clearPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const poll = async () => {
    if (!token || completedRef.current) return;
    try {
      const data = await profileApi.getProfileStatus(token);
      consecutiveErrorsRef.current = 0; // Reset on success
      setState({
        status: data.status,
        errorMessage: data.errorMessage ?? null,
        progressDetail: data.progressDetail ?? null,
        pollError: null,
      });
      if (data.status === "complete" && !completedRef.current) {
        completedRef.current = true;
        clearPolling();
        setTimeout(onComplete, 500);
      } else if (data.status === "failed" || data.status === "not_started") {
        clearPolling();
      }
    } catch (err) {
      consecutiveErrorsRef.current++;
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[profile] poll failed (${consecutiveErrorsRef.current}/${MAX_CONSECUTIVE_ERRORS}):`,
        err,
      );

      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
        clearPolling();
        setState((s) => ({
          ...s,
          pollError: `API polling failed after ${MAX_CONSECUTIVE_ERRORS} attempts: ${errorMsg}`,
        }));
      }
    }
  };

  useEffect(() => {
    if (!enabled || !token) return;
    completedRef.current = false;

    // Immediate first poll - don't wait 3s
    void poll();
    intervalRef.current = setInterval(() => void poll(), 3000); // Poll every 3s instead of 5s

    return () => {
      clearPolling();
    };
  }, [token, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
