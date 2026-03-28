import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"
import { submitQuestionnaire, type QuestionnaireAnswers } from "@/lib/profile-api"

type Props = {
  user: User
  token: string
  mode: "quick" | "thorough"
  onComplete: () => void
  onBack: () => void
}

type PartialAnswers = Partial<QuestionnaireAnswers>

const EMPLOYMENT_OPTIONS = [
  { label: "Dipendente", value: "employed" },
  { label: "Autonomo / Freelance", value: "self_employed" },
  { label: "Studente", value: "student" },
  { label: "Altro", value: "other" },
] as const

const INCOME_SOURCE_OPTIONS = [
  { label: "Lavoro extra", value: "side_work" },
  { label: "Affitti", value: "rental_income" },
  { label: "Investimenti", value: "investments" },
  { label: "Sussidi / Assegni", value: "benefits" },
  { label: "Nessuna", value: "none" },
]

const SAVINGS_OPTIONS = [
  { label: "Non risparmio", value: "not_saving" },
  { label: "Risparmio occasionale", value: "occasional" },
  { label: "Risparmio regolare", value: "regular" },
] as const

const GOAL_OPTIONS = [
  { label: "Risparmiare di più", value: "save_more" },
  { label: "Ridurre i debiti", value: "reduce_debt" },
  { label: "Monitorare le spese", value: "just_track" },
] as const

function OptionPill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm border transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary text-secondary-foreground border-border hover:border-primary"
      }`}
    >
      {label}
    </button>
  )
}

export function QuestionnaireScreen({ user: _user, token, mode, onComplete, onBack }: Props) {
  const totalQuestions = mode === "quick" ? 3 : 8
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<PartialAnswers>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setAnswer = (key: keyof QuestionnaireAnswers, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const toggleMulti = (key: keyof QuestionnaireAnswers, value: string) => {
    const current = (answers[key] as string[]) ?? []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    setAnswer(key, updated)
  }

  const canAdvance = () => {
    if (step === 0) return !!answers.employmentType
    if (step === 1) return (answers.monthlyNetIncome ?? 0) > 0
    if (step === 2) return !!answers.currency
    return true // thorough questions are optional
  }

  const handleNext = async () => {
    if (step < totalQuestions - 1) {
      setStep((s) => s + 1)
    } else {
      setLoading(true)
      setError(null)
      try {
        await submitQuestionnaire(token, mode, {
          employmentType: answers.employmentType ?? "other",
          monthlyNetIncome: answers.monthlyNetIncome ?? 0,
          currency: answers.currency ?? "EUR",
          ...(mode === "thorough" && {
            fixedMonthlyCosts: answers.fixedMonthlyCosts,
            otherIncomeSources: answers.otherIncomeSources ?? [],
            householdSize: answers.householdSize,
            savingsBehavior: answers.savingsBehavior,
            financialGoal: answers.financialGoal,
          }),
        })
        onComplete()
      } catch {
        setError("Profilo non salvato. Controlla la connessione e riprova.")
      } finally {
        setLoading(false)
      }
    }
  }

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Qual è la tua situazione lavorativa?
            </h2>
            <div className="flex flex-wrap gap-2">
              {EMPLOYMENT_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  label={opt.label}
                  selected={answers.employmentType === opt.value}
                  onClick={() => setAnswer("employmentType", opt.value)}
                />
              ))}
            </div>
          </div>
        )
      case 1:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Qual è il tuo reddito netto mensile?
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {answers.currency ?? "€"}
              </span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={answers.monthlyNetIncome ?? ""}
                onChange={(e) =>
                  setAnswer("monthlyNetIncome", parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )
      case 2:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Qual è la tua valuta principale?
            </h2>
            <select
              value={answers.currency ?? "EUR"}
              onChange={(e) => setAnswer("currency", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="EUR">EUR — Euro</option>
              <option value="USD">USD — Dollaro americano</option>
              <option value="GBP">GBP — Sterlina britannica</option>
              <option value="CHF">CHF — Franco svizzero</option>
              <option value="other">Altra valuta</option>
            </select>
          </div>
        )
      case 3:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Costi fissi mensili stimati?
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Affitto, utenze, abbonamenti — tutte le spese ricorrenti combinate.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">€</span>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={answers.fixedMonthlyCosts ?? ""}
                onChange={(e) =>
                  setAnswer("fixedMonthlyCosts", parseFloat(e.target.value) || 0)
                }
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        )
      case 4:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Hai altre fonti di reddito?
            </h2>
            <div className="flex flex-wrap gap-2">
              {INCOME_SOURCE_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  label={opt.label}
                  selected={(answers.otherIncomeSources ?? []).includes(opt.value)}
                  onClick={() => toggleMulti("otherIncomeSources", opt.value)}
                />
              ))}
            </div>
          </div>
        )
      case 5:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Quante persone nel tuo nucleo familiare?
            </h2>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() =>
                  setAnswer(
                    "householdSize",
                    Math.max(1, (answers.householdSize ?? 1) - 1),
                  )
                }
              >
                −
              </Button>
              <span className="text-xl font-semibold">{answers.householdSize ?? 1}</span>
              <Button
                variant="outline"
                onClick={() =>
                  setAnswer("householdSize", Math.min(6, (answers.householdSize ?? 1) + 1))
                }
              >
                +
              </Button>
            </div>
          </div>
        )
      case 6:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Con che frequenza risparmi?
            </h2>
            <div className="flex flex-wrap gap-2">
              {SAVINGS_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  label={opt.label}
                  selected={answers.savingsBehavior === opt.value}
                  onClick={() => setAnswer("savingsBehavior", opt.value)}
                />
              ))}
            </div>
          </div>
        )
      case 7:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Qual è il tuo principale obiettivo finanziario?
            </h2>
            <div className="flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((opt) => (
                <OptionPill
                  key={opt.value}
                  label={opt.label}
                  selected={answers.financialGoal === opt.value}
                  onClick={() => setAnswer("financialGoal", opt.value)}
                />
              ))}
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <h1 className="text-2xl font-bold text-foreground">S.E.N.S.O.</h1>
        <span className="text-sm text-muted-foreground">
          Domanda {step + 1} di {totalQuestions}
        </span>
      </div>

      <div className="mx-auto max-w-[480px]">
        <div className="rounded-2xl border border-border bg-card p-6">
          {renderStep()}

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={step === 0 ? onBack : () => setStep((s) => s - 1)}
            >
              Indietro
            </Button>
            <Button
              variant="default"
              disabled={!canAdvance() || loading}
              onClick={() => void handleNext()}
            >
              {loading ? "Salvataggio..." : step === totalQuestions - 1 ? "Fine" : "Avanti"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
