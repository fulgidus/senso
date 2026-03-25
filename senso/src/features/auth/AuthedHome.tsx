import { useCallback, useEffect, useState } from "react"
import type { User } from "@/features/auth/types"
import { readAccessToken } from "@/features/auth/storage"
import { IngestionScreen } from "@/features/ingestion/IngestionScreen"
import { ProcessingScreen } from "@/features/profile/ProcessingScreen"
import { ProfileScreen } from "@/features/profile/ProfileScreen"
import { OnboardingChoiceScreen } from "@/features/profile/OnboardingChoiceScreen"
import { QuestionnaireScreen } from "@/features/profile/QuestionnaireScreen"
import { getProfileStatus, triggerCategorization } from "@/lib/profile-api"
import { apiRequest } from "@/lib/api-client"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

type Screen = "ingestion" | "processing" | "profile" | "onboarding" | "questionnaire"
type QuestionnaireMode = "quick" | "thorough"

type AuthedHomeProps = {
  user: User
  onSignOut: () => Promise<void>
}

export function AuthedHome({ user, onSignOut }: AuthedHomeProps) {
  const token = readAccessToken()
  const [screen, setScreen] = useState<Screen>("ingestion")
  const [questionnaireMode, setQuestionnaireMode] = useState<QuestionnaireMode>("quick")

  // On mount: resume correct screen based on job status
  useEffect(() => {
    if (!token) return
    void getProfileStatus(token)
      .then((data) => {
        if (
          data.status === "queued" ||
          data.status === "categorizing" ||
          data.status === "generating_insights"
        ) {
          setScreen("processing")
        } else if (data.status === "complete") {
          setScreen("profile")
        }
        // else: not_started or failed → stay on ingestion
      })
      .catch(() => {
        // Stay on ingestion
      })
  }, [token])

  const handleConfirmAll = useCallback(async () => {
    if (!token) return
    try {
      await apiRequest(API_BASE, "/ingestion/confirm-all", {
        method: "POST",
        token,
      })
      setScreen("processing")
    } catch {
      // Stay on ingestion on failure
    }
  }, [token])

  const handleQuestionnaireComplete = useCallback(async () => {
    if (!token) return
    try {
      await triggerCategorization(token)
    } catch {
      // Best-effort trigger
    }
    setScreen("processing")
  }, [token])

  if (!token) {
    return null
  }

  switch (screen) {
    case "processing":
      return (
        <ProcessingScreen
          user={user}
          token={token}
          onBack={() => setScreen("ingestion")}
          onComplete={() => setScreen("profile")}
        />
      )

    case "profile":
      return (
        <ProfileScreen
          user={user}
          token={token}
          onAddDocuments={() => setScreen("ingestion")}
          onSignOut={onSignOut}
        />
      )

    case "onboarding":
      return (
        <OnboardingChoiceScreen
          user={user}
          onChooseFiles={() => setScreen("ingestion")}
          onChooseQuestionnaire={() => {
            setQuestionnaireMode("quick")
            setScreen("questionnaire")
          }}
          onSignOut={onSignOut}
        />
      )

    case "questionnaire":
      return (
        <QuestionnaireScreen
          user={user}
          token={token}
          mode={questionnaireMode}
          onComplete={() => void handleQuestionnaireComplete()}
          onBack={() => setScreen("onboarding")}
        />
      )

    default: // "ingestion"
      return (
        <IngestionScreen
          user={user}
          onSignOut={onSignOut}
          onConfirmAll={() => void handleConfirmAll()}
        />
      )
  }
}
