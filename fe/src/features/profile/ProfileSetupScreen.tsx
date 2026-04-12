import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { updateMe } from "@/features/auth/session";
import { readAccessToken } from "@/features/auth/storage";
import type { VoiceGender } from "@/features/auth/types";

type Props = {
  onComplete: () => void;
};

type Step = "name" | "gender";

export function ProfileSetupScreen({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("name");
  const [firstName, setFirstName] = useState("");
  const [voiceGender, setVoiceGender] = useState<VoiceGender | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleNameSubmit = () => {
    if (!firstName.trim()) return;
    setStep("gender");
  };

  const handleGenderSubmit = async (selectedGender: VoiceGender | null) => {
    setLoading(true);
    setError(null);
    const token = readAccessToken();
    if (!token) {
      setError(t("profileSetup.errorSession"));
      setLoading(false);
      return;
    }
    try {
      await updateMe(token, {
        firstName: firstName.trim(),
        voiceGender: selectedGender ?? "indifferent",
      });
      onComplete();
    } catch {
      setError(t("profileSetup.errorSave"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mx-auto max-w-[480px]">
        <h1 className="mb-2 text-2xl font-bold text-foreground">{t("profileSetup.heading")}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{t("profileSetup.subtitle")}</p>

        {step === "name" && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">
                {t("profileSetup.nameHeading")}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">{t("profileSetup.nameSubtitle")}</p>
              <input
                autoFocus
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNameSubmit();
                }}
                placeholder={t("profileSetup.namePlaceholder")}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" disabled={!firstName.trim()} onClick={handleNameSubmit}>
              {t("profileSetup.continue")}
            </Button>
          </div>
        )}

        {step === "gender" && (
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

            <Button
              className="w-full"
              disabled={loading}
              onClick={() => void handleGenderSubmit(voiceGender)}
            >
              {loading
                ? t("profileSetup.saving")
                : voiceGender
                  ? t("profileSetup.continue")
                  : t("profileSetup.genderSkip")}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
