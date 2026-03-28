import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"
import {
  submitQuestionnaire,
  makeIncomeSource,
  computeNetFromRal,
  CCNL_PRESETS,
  type QuestionnaireAnswers,
  type IncomeSource,
  type IncomeSourceType,
} from "@/lib/profile-api"

type Props = {
  user: User
  token: string
  mode: "quick" | "thorough"
  onComplete: () => void
  onBack: () => void
}

type PartialAnswers = Partial<QuestionnaireAnswers> & {
  expenseCategories?: Record<string, number>
}

// ── Static option lists ────────────────────────────────────────────────────

const EMPLOYMENT_OPTIONS = [
  { label: "Dipendente", value: "employed" },
  { label: "Autonomo / Freelance", value: "self_employed" },
  { label: "Studente", value: "student" },
  { label: "Altro", value: "other" },
] as const

const INCOME_TYPE_OPTIONS: { label: string; value: IncomeSourceType; emoji: string }[] = [
  { label: "Stipendio netto", value: "employment_net", emoji: "💼" },
  { label: "Stipendio lordo (RAL)", value: "employment_gross", emoji: "🇮🇹" },
  { label: "Freelance / P.IVA", value: "self_employment", emoji: "🧾" },
  { label: "Affitti", value: "rental", emoji: "🏠" },
  { label: "Investimenti", value: "investment_dividends", emoji: "📈" },
  { label: "Pensione", value: "pension", emoji: "🏦" },
  { label: "Sussidi / Assegni", value: "benefits", emoji: "🤝" },
  { label: "Supporto familiare", value: "family_support", emoji: "👨‍👩‍👧" },
  { label: "Altro reddito", value: "other", emoji: "💰" },
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

const EXPENSE_CATEGORIES: { key: string; label: string; max: number }[] = [
  { key: "Affitto / Mutuo", label: "Affitto / Mutuo", max: 3000 },
  { key: "Cibo e spesa", label: "Cibo e spesa", max: 1500 },
  { key: "Trasporti", label: "Trasporti", max: 1000 },
  { key: "Utenze", label: "Utenze (luce, gas, internet…)", max: 500 },
  { key: "Abbonamenti", label: "Abbonamenti e servizi", max: 300 },
  { key: "Salute", label: "Salute e farmaci", max: 500 },
  { key: "Svago", label: "Svago e uscite", max: 1000 },
  { key: "Altro", label: "Altro", max: 1000 },
]

// ── Shared sub-components ──────────────────────────────────────────────────

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
      type="button"
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

function ExpenseCategoryRow({
  category,
  value,
  currency,
  onChange,
}: {
  category: { key: string; label: string; max: number }
  value: number
  currency: string
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm text-foreground">{category.label}</label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">{currency}</span>
          <input
            type="number"
            min={0}
            max={category.max * 2}
            step={10}
            value={value || ""}
            placeholder="0"
            onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={category.max}
        step={10}
        value={Math.min(value || 0, category.max)}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

// ── IncomeSource editor ────────────────────────────────────────────────────

function IncomeSourceEditor({
  source,
  currency,
  onChange,
  onRemove,
}: {
  source: IncomeSource
  currency: string
  onChange: (updated: IncomeSource) => void
  onRemove: () => void
}) {
  const set = <K extends keyof IncomeSource>(k: K, v: IncomeSource[K]) =>
    onChange({ ...source, [k]: v })

  // Live net computation for employment_gross
  const net =
    source.type === "employment_gross" && (source.ral ?? 0) > 0
      ? computeNetFromRal(
          source.ral ?? 0,
          source.extraMonths ?? 13,
          source.productionBonusAnnual ?? 0,
          source.welfareAnnual ?? 0,
          source.mealVoucherFaceValue ?? 0,
          source.mealVoucherEstimatedDaysMonth ?? 0,
          source.mealVoucherElectronic ?? true,
        )
      : null

  // Auto-update valueMin/valueMax when net changes
  const handleRalChange = (ral: number) => {
    const updated = { ...source, ral }
    const n = computeNetFromRal(
      ral,
      updated.extraMonths ?? 13,
      updated.productionBonusAnnual ?? 0,
      updated.welfareAnnual ?? 0,
      updated.mealVoucherFaceValue ?? 0,
      updated.mealVoucherEstimatedDaysMonth ?? 0,
      updated.mealVoucherElectronic ?? true,
    )
    onChange({ ...updated, valueMin: n.netMonthly, valueMax: n.netMonthlyMax })
  }

  const handleCcnlChange = (ccnlId: string) => {
    const preset = CCNL_PRESETS.find((p) => p.id === ccnlId)
    if (!preset) { set("ccnlId", ccnlId); return }
    onChange({
      ...source,
      ccnlId,
      extraMonths: preset.extraMonths,
      overtimeWeeklyHoursMin: preset.overtimeThresholdWeekly,
      overtimeWeeklyHoursMax: preset.overtimeOrdinaryMaxWeekly,
      overtimeMultiplier: preset.overtimeOrdinaryMultiplier,
    })
  }

  const handleExtraMonthsChange = (extraMonths: number) => {
    const updated = { ...source, extraMonths }
    if ((updated.ral ?? 0) > 0) {
      const n = computeNetFromRal(
        updated.ral ?? 0,
        extraMonths,
        updated.productionBonusAnnual ?? 0,
        updated.welfareAnnual ?? 0,
        updated.mealVoucherFaceValue ?? 0,
        updated.mealVoucherEstimatedDaysMonth ?? 0,
        updated.mealVoucherElectronic ?? true,
      )
      onChange({ ...updated, valueMin: n.netMonthly, valueMax: n.netMonthlyMax })
    } else {
      onChange(updated)
    }
  }

  const handleVoucherChange = (
    field: "mealVoucherFaceValue" | "mealVoucherEstimatedDaysMonth" | "mealVoucherElectronic",
    value: number | boolean,
  ) => {
    const updated = { ...source, [field]: value }
    if ((updated.ral ?? 0) > 0) {
      const n = computeNetFromRal(
        updated.ral ?? 0,
        updated.extraMonths ?? 13,
        updated.productionBonusAnnual ?? 0,
        updated.welfareAnnual ?? 0,
        updated.mealVoucherFaceValue ?? 0,
        updated.mealVoucherEstimatedDaysMonth ?? 0,
        updated.mealVoucherElectronic ?? true,
      )
      onChange({ ...updated, valueMin: n.netMonthly, valueMax: n.netMonthlyMax })
    } else {
      onChange(updated)
    }
  }

  const currencySymbol = currency === "EUR" ? "€" : currency

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          placeholder="Nome fonte (es. Stipendio principale)"
          value={source.label}
          onChange={(e) => set("label", e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
          aria-label="Rimuovi fonte"
        >
          ✕
        </button>
      </div>

      {/* Type selector */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo</p>
        <div className="flex flex-wrap gap-1.5">
          {INCOME_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("type", opt.value)}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${
                source.type === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground border-border hover:border-primary"
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* employment_gross — RAL flow */}
      {source.type === "employment_gross" ? (
        <div className="space-y-3">
          {/* RAL */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              RAL (Reddito Annuo Lordo)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{currencySymbol}</span>
              <input
                type="number"
                min={0}
                step={500}
                placeholder="0"
                value={source.ral ?? ""}
                onChange={(e) => handleRalChange(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* CCNL */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Contratto (CCNL)
            </label>
            <select
              value={source.ccnlId ?? ""}
              onChange={(e) => handleCcnlChange(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">— Seleziona CCNL —</option>
              {CCNL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {source.ccnlId && (() => {
              const preset = CCNL_PRESETS.find((p) => p.id === source.ccnlId)
              return preset?.notes ? (
                <p className="mt-1 text-xs text-muted-foreground">{preset.notes}</p>
              ) : null
            })()}
          </div>

          {/* Extra months */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Mensilità
            </label>
            <div className="flex gap-2">
              {[13, 14].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleExtraMonthsChange(m)}
                  className={`rounded-full px-4 py-1 text-sm border transition-colors ${
                    (source.extraMonths ?? 13) === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-secondary-foreground border-border hover:border-primary"
                  }`}
                >
                  {m}ª mensilità
                </button>
              ))}
            </div>
          </div>

          {/* Production bonus */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Premio di produzione annuo (opzionale)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{currencySymbol}</span>
              <input
                type="number"
                min={0}
                step={100}
                placeholder="0"
                value={source.productionBonusAnnual ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0
                  const updated = { ...source, productionBonusAnnual: v }
                  if ((updated.ral ?? 0) > 0) {
                    const n = computeNetFromRal(updated.ral ?? 0, updated.extraMonths ?? 13, v, updated.welfareAnnual ?? 0, updated.mealVoucherFaceValue ?? 0, updated.mealVoucherEstimatedDaysMonth ?? 0, updated.mealVoucherElectronic ?? true)
                    onChange({ ...updated, valueMin: n.netMonthly, valueMax: n.netMonthlyMax })
                  } else {
                    onChange(updated)
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Tassato al 10% fino a €3.000/anno</p>
          </div>

          {/* Welfare aziendale */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Welfare aziendale annuo (opzionale)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{currencySymbol}</span>
              <input
                type="number"
                min={0}
                step={50}
                placeholder="0"
                value={source.welfareAnnual ?? ""}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0
                  const updated = { ...source, welfareAnnual: v }
                  if ((updated.ral ?? 0) > 0) {
                    const n = computeNetFromRal(updated.ral ?? 0, updated.extraMonths ?? 13, updated.productionBonusAnnual ?? 0, v, updated.mealVoucherFaceValue ?? 0, updated.mealVoucherEstimatedDaysMonth ?? 0, updated.mealVoucherElectronic ?? true)
                    onChange({ ...updated, valueMin: n.netMonthly, valueMax: n.netMonthlyMax })
                  } else {
                    onChange(updated)
                  }
                }}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Esentasse fino a €1.000/anno (2024)</p>
          </div>

          {/* Buoni pasto */}
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Buoni pasto (opzionale)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Valore facciale ({currencySymbol}/giorno)
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="0"
                  value={source.mealVoucherFaceValue ?? ""}
                  onChange={(e) =>
                    handleVoucherChange("mealVoucherFaceValue", parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  Giorni/mese in ufficio <span className="text-amber-500">(stima)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  step={1}
                  placeholder="0"
                  value={source.mealVoucherEstimatedDaysMonth ?? ""}
                  onChange={(e) =>
                    handleVoucherChange("mealVoucherEstimatedDaysMonth", parseFloat(e.target.value) || 0)
                  }
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleVoucherChange("mealVoucherElectronic", !source.mealVoucherElectronic)}
                className={`w-8 h-4 rounded-full transition-colors ${
                  source.mealVoucherElectronic ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`block w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${
                    source.mealVoucherElectronic ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs text-muted-foreground">
                Buoni elettronici (esentasse fino a €8/gg vs €4 per cartacei)
              </span>
            </div>
            {(source.mealVoucherFaceValue ?? 0) > 0 && (source.mealVoucherEstimatedDaysMonth ?? 0) > 0 && net && (
              <p className="text-xs text-muted-foreground">
                Stima mensile: ~{currencySymbol}{net.mealVoucherMonthlyEstimate.toFixed(0)}/mese
                <span className="ml-1 text-amber-500">(variabile)</span>
              </p>
            )}
          </div>

          {/* Net preview */}
          {net && (source.ral ?? 0) > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Calcolo netto stimato
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Netto base mensile</span>
                <span className="font-medium text-foreground">
                  {currencySymbol}{net.netMonthly.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                </span>
              </div>
              {net.mealVoucherMonthlyEstimate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">+ Buoni pasto <span className="text-amber-500">(stima)</span></span>
                  <span className="font-medium text-foreground">
                    +{currencySymbol}{net.mealVoucherMonthlyEstimate.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-1 mt-1">
                <span>INPS (9.19%)</span>
                <span>-{currencySymbol}{net.inpsAnnual.toLocaleString("it-IT", { maximumFractionDigits: 0 })}/anno</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>IRPEF</span>
                <span>-{currencySymbol}{net.irpefNet.toLocaleString("it-IT", { maximumFractionDigits: 0 })}/anno</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Addizionali (~1.73%)</span>
                <span>-{currencySymbol}{net.addizionali.toLocaleString("it-IT", { maximumFractionDigits: 0 })}/anno</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* All other types: direct monthly net input */
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {source.isFixed ? "Importo mensile netto" : "Range mensile netto (min – max)"}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{currencySymbol}</span>
              {source.isFixed ? (
                <input
                  type="number"
                  min={0}
                  step={50}
                  placeholder="0"
                  value={source.valueMin || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    onChange({ ...source, valueMin: v, valueMax: v })
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              ) : (
                <>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    placeholder="min"
                    value={source.valueMin || ""}
                    onChange={(e) =>
                      set("valueMin", parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-muted-foreground">–</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    placeholder="max"
                    value={source.valueMax || ""}
                    onChange={(e) =>
                      set("valueMax", parseFloat(e.target.value) || 0)
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => set("isFixed", !source.isFixed)}
              className={`w-8 h-4 rounded-full transition-colors ${
                !source.isFixed ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`block w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${
                  !source.isFixed ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-xs text-muted-foreground">Importo variabile (range)</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function QuestionnaireScreen({ user: _user, token, mode, onComplete, onBack }: Props) {
  // Steps for quick mode:
  //  0 = employment type (+ job_other if "other")
  //  1 = income sources (rich IncomeSource builder)
  //  2 = currency
  //  3 = monthly expenses by category
  // Thorough mode appends 4–6 (household, savings, goal)
  const QUICK_STEPS = 4
  const totalQuestions = mode === "quick" ? QUICK_STEPS : QUICK_STEPS + 3

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<PartialAnswers>({
    currency: "EUR",
    expenseCategories: {},
    incomeSources: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currency = answers.currency ?? "EUR"

  const setAnswer = (key: keyof PartialAnswers, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const setExpenseCategory = (key: string, value: number) => {
    setAnswers((prev) => ({
      ...prev,
      expenseCategories: { ...(prev.expenseCategories ?? {}), [key]: value },
    }))
  }

  const incomeSources: IncomeSource[] = (answers.incomeSources as IncomeSource[]) ?? []

  const addIncomeSource = () => {
    setAnswer("incomeSources", [
      ...incomeSources,
      makeIncomeSource({ currency, label: "" }),
    ])
  }

  const updateIncomeSource = (idx: number, updated: IncomeSource) => {
    const next = incomeSources.map((s, i) => (i === idx ? updated : s))
    setAnswer("incomeSources", next)
  }

  const removeIncomeSource = (idx: number) => {
    setAnswer("incomeSources", incomeSources.filter((_, i) => i !== idx))
  }

  // Derived monthly net income from income sources (sum of valueMin, non-hidden)
  const derivedMonthlyNet = incomeSources
    .filter((s) => !s.hideFromAssistant)
    .reduce((sum, s) => sum + (s.valueMin || 0), 0)

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return !!answers.employmentType
      case 1: {
        // At least one source with a non-zero value
        const sources = incomeSources
        if (sources.length === 0) return false
        return sources.every((s) => {
          if (s.type === "employment_gross") return (s.ral ?? 0) > 0
          return (s.valueMin ?? 0) > 0
        })
      }
      case 2: return !!answers.currency
      case 3: return true // expense categories optional
      default: return true
    }
  }

  const handleNext = async () => {
    if (step < totalQuestions - 1) {
      setStep((s) => s + 1)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await submitQuestionnaire(token, mode, {
        employmentType: answers.employmentType ?? "other",
        jobOther: answers.jobOther ?? null,
        monthlyNetIncome: derivedMonthlyNet,
        currency,
        incomeSources: incomeSources,
        expenseCategories: answers.expenseCategories ?? {},
        ...(mode === "thorough" && {
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

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Employment type ─────────────────────────────────────────
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
            {answers.employmentType === "other" && (
              <div className="mt-4">
                <label className="mb-1 block text-sm text-muted-foreground">
                  Specifica (opzionale)
                </label>
                <input
                  type="text"
                  placeholder="es. Pensionato, Casalingo, Volontario…"
                  value={answers.jobOther ?? ""}
                  onChange={(e) => setAnswer("jobOther", e.target.value || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )

      // ── Step 1: Income sources (rich builder) ───────────────────────────
      case 1:
        return (
          <div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">
              Da dove proviene il tuo reddito?
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Aggiungi una o più fonti di reddito con i dettagli.
            </p>

            <div className="space-y-3">
              {incomeSources.map((src, idx) => (
                <IncomeSourceEditor
                  key={src.id}
                  source={src}
                  currency={currency}
                  onChange={(updated) => updateIncomeSource(idx, updated)}
                  onRemove={() => removeIncomeSource(idx)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addIncomeSource}
              className="mt-3 w-full rounded-xl border border-dashed border-primary/40 py-3 text-sm text-primary hover:border-primary hover:bg-primary/5 transition-colors"
            >
              + Aggiungi fonte di reddito
            </button>

            {derivedMonthlyNet > 0 && (
              <div className="mt-4 rounded-lg bg-secondary/50 px-4 py-2 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Totale netto mensile (base)</span>
                <span className="text-sm font-semibold text-foreground">
                  {currency === "EUR" ? "€" : currency}
                  {derivedMonthlyNet.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
          </div>
        )

      // ── Step 2: Currency ────────────────────────────────────────────────
      case 2:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Qual è la tua valuta principale?
            </h2>
            <select
              value={currency}
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

      // ── Step 3: Expenses by category ────────────────────────────────────
      case 3: {
        const cats = answers.expenseCategories ?? {}
        const total = Object.values(cats).reduce((s, v) => s + (v || 0), 0)
        return (
          <div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">
              Quanto spendi ogni mese?
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Imposta le categorie che ti riguardano — le altre restano a zero.
            </p>
            <div className="space-y-4">
              {EXPENSE_CATEGORIES.map((cat) => (
                <ExpenseCategoryRow
                  key={cat.key}
                  category={cat}
                  value={cats[cat.key] ?? 0}
                  currency={currency}
                  onChange={(v) => setExpenseCategory(cat.key, v)}
                />
              ))}
            </div>
            {total > 0 && (
              <p className="mt-4 text-right text-sm font-medium text-foreground">
                Totale: <span className="text-primary">{currency} {total.toLocaleString("it-IT")}</span>
              </p>
            )}
          </div>
        )
      }

      // ── Thorough-only steps ──────────────────────────────────────────────
      case 4:
        return (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-foreground">
              Quante persone nel tuo nucleo familiare?
            </h2>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() =>
                  setAnswer("householdSize", Math.max(1, (answers.householdSize ?? 1) - 1))
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

      case 5:
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

      case 6:
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

      <div className="mx-auto max-w-[560px]">
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
              {loading
                ? "Salvataggio..."
                : step === totalQuestions - 1
                  ? "Fine"
                  : "Avanti"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
