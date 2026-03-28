import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { updateMe } from "@/features/auth/session"
import { readAccessToken } from "@/features/auth/storage"
import type { VoiceGender } from "@/features/auth/types"

type Props = {
  onComplete: (firstName: string, lastName: string | null) => void
}

type Step = "name" | "gender"

export function ProfileSetupScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("name")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [voiceGender, setVoiceGender] = useState<VoiceGender | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { t } = useTranslation()

  const trimmedFirst = firstName.trim()
  const canSubmitName = trimmedFirst.length > 0 && !loading

  const handleNameNext = () => {
    if (!canSubmitName) return
    setStep("gender")
  }

  const handleGenderSubmit = async (selectedGender: VoiceGender | null) => {
    setLoading(true)
    setError(null)
    const token = readAccessToken()
    if (!token) {
      setError(t("profileSetup.errorSession"))
      setLoading(false)
      return
    }
    try {
      await updateMe(token, {
        firstName: trimmedFirst,
        lastName: lastName.trim() || null,
        voiceGender: selectedGender ?? "indifferent",
      })
      onComplete(trimmedFirst, lastName.trim() || null)
    } catch {
      setError(t("profileSetup.errorSave"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mx-auto max-w-[480px]">
        <h1 className="mb-2 text-2xl font-bold text-foreground">{t("profileSetup.heading")}</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {t("profileSetup.subtitle")}
        </p>

        {step === "name" ? (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="firstName">
                {t("profileSetup.firstName")} <span className="text-destructive">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleNameNext() }}
                placeholder={t("profileSetup.firstNamePlaceholder")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground" htmlFor="lastName">
                {t("profileSetup.lastName")}{" "}
                <span className="text-xs text-muted-foreground">{t("profileSetup.lastNameOptional")}</span>
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleNameNext() }}
                placeholder={t("profileSetup.lastNamePlaceholder")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              className="w-full"
              disabled={!canSubmitName}
              onClick={handleNameNext}
            >
              {t("profileSetup.continue")}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">
                {t("profileSetup.genderHeading")}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t("profileSetup.genderSubtitle")}
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: "masculine" as VoiceGender, label: t("profileSetup.genderMasculine") },
                    { value: "feminine" as VoiceGender, label: t("profileSetup.genderFeminine") },
                    { value: "neutral" as VoiceGender, label: t("profileSetup.genderNeutral") },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVoiceGender(opt.value)}
                    className={[
                      "w-full rounded-xl border px-4 py-3 text-sm font-medium text-left transition-colors",
                      voiceGender === opt.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-primary hover:bg-accent",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setStep("name")}
                disabled={loading}
              >
                {t("questionnaire.back")}
              </Button>
              <Button
                className="flex-1"
                disabled={loading}
                onClick={() => void handleGenderSubmit(voiceGender)}
              >
                {loading ? t("profileSetup.saving") : voiceGender ? t("profileSetup.continue") : t("profileSetup.genderSkip")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
