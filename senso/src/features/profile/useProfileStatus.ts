import { useEffect, useRef, useState } from "react"
import { getProfileStatus, type CategorizationStatus } from "@/lib/profile-api"

type UseProfileStatusOptions = {
  token: string | null
  onComplete: () => void
  enabled?: boolean
}

type ProfileStatusState = {
  status: CategorizationStatus
  errorMessage: string | null
}

export function useProfileStatus({
  token,
  onComplete,
  enabled = true,
}: UseProfileStatusOptions): ProfileStatusState {
  const [state, setState] = useState<ProfileStatusState>({
    status: "queued",
    errorMessage: null,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const completedRef = useRef(false)

  const clearPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const poll = async () => {
    if (!token || completedRef.current) return
    try {
      const data = await getProfileStatus(token)
      setState({ status: data.status, errorMessage: data.errorMessage ?? null })
      if (data.status === "complete" && !completedRef.current) {
        completedRef.current = true
        clearPolling()
        setTimeout(onComplete, 500)
      } else if (data.status === "failed") {
        clearPolling()
      }
    } catch {
      // Polling errors are silent — keep retrying
    }
  }

  useEffect(() => {
    if (!enabled || !token) return
    completedRef.current = false

    // 3s initial delay before first poll (UI-SPEC)
    const initialDelay = setTimeout(() => {
      void poll()
      intervalRef.current = setInterval(() => void poll(), 5000)
    }, 3000)

    return () => {
      clearTimeout(initialDelay)
      clearPolling()
    }
  }, [token, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
