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
  });
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
      setState({
        status: data.status,
        errorMessage: data.errorMessage ?? null,
        progressDetail: data.progressDetail ?? null,
      });
      if (data.status === "complete" && !completedRef.current) {
        completedRef.current = true;
        clearPolling();
        setTimeout(onComplete, 500);
      } else if (data.status === "failed" || data.status === "not_started") {
        clearPolling();
      }
    } catch {
      // Polling errors are silent - keep retrying
    }
  };

  useEffect(() => {
    if (!enabled || !token) return;
    completedRef.current = false;

    // 3s initial delay before first poll (UI-SPEC)
    const initialDelay = setTimeout(() => {
      void poll();
      intervalRef.current = setInterval(() => void poll(), 5000);
    }, 3000);

    return () => {
      clearTimeout(initialDelay);
      clearPolling();
    };
  }, [token, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
