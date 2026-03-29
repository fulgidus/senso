import { useState } from "react"
import { useTranslation } from "react-i18next"
import * as RadixSlider from "@radix-ui/react-slider"
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
  expenseCategoryRanges?: Record<string, { min: number; max: number }>
  expenseCategoryIsRange?: Record<string, boolean>
}

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

// ── Dual-thumb slider ──────────────────────────────────────────────────────

function DualSlider({
  min,
  max,
  step,
  values,
  onChange,
}: {
  min: number
  max: number
  step: number
  values: [number, number]
  onChange: (v: [number, number]) => void
}) {
  return (
    <RadixSlider.Root
      className="relative flex items-center select-none touch-none w-full h-5"
      min={min}
      max={max}
      step={step}
      value={values}
      onValueChange={(v: number[]) => onChange([v[0], v[1]] as [number, number])}
      minStepsBetweenThumbs={0}
    >
      <RadixSlider.Track className="bg-secondary relative grow rounded-full h-1.5">
        <RadixSlider.Range className="absolute bg-primary rounded-full h-full" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="block w-4 h-4 bg-background border-2 border-primary rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 hover:bg-primary/10 transition-colors" />
      <RadixSlider.Thumb className="block w-4 h-4 bg-background border-2 border-primary rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 hover:bg-primary/10 transition-colors" />
    </RadixSlider.Root>
  )
}

function SingleSlider({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  return (
    <RadixSlider.Root
      className="relative flex items-center select-none touch-none w-full h-5"
      min={min}
      max={max}
      step={step}
      value={[value]}
      onValueChange={(v: number[]) => onChange(v[0])}
    >
      <RadixSlider.Track className="bg-secondary relative grow rounded-full h-1.5">
        <RadixSlider.Range className="absolute bg-primary rounded-full h-full" />
      </RadixSlider.Track>
      <RadixSlider.Thumb className="block w-4 h-4 bg-background border-2 border-primary rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 hover:bg-primary/10 transition-colors" />
    </RadixSlider.Root>
  )
}

// ── ExpenseCategoryRow ─────────────────────────────────────────────────────

function ExpenseCategoryRow({
  category,
  value,
  valueRange,
  isRange,
  currency,
  onChange,
  onRangeChange,
  onToggleRange,
}: {
  category: { key: string; label: string; max: number }
  value: number
  valueRange: { min: number; max: number }
  isRange: boolean
  currency: string
  onChange: (v: number) => void
  onRangeChange: (v: { min: number; max: number }) => void
  onToggleRange: () => void
}) {
  const { t } = useTranslation()
  const sliderMax = category.max
  const currencySymbol = currency === "EUR" ? "€" : currency

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm text-foreground">{category.label}</label>
        <div className="flex items-center gap-1.5">
          {isRange ? (
            <>
              <span className="text-xs text-muted-foreground">{currencySymbol}</span>
              <input
                type="number"
                min={0}
                step={10}
                value={valueRange.min || ""}
                placeholder={t("questionnaire.expenseRangeMin")}
                onChange={(e) => {
                  const v = Math.max(0, parseFloat(e.target.value) || 0)
                  onRangeChange({ min: v, max: Math.max(v, valueRange.max) })
                }}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-xs text-muted-foreground">-</span>
              <input
                type="number"
                min={0}
                step={10}
                value={valueRange.max || ""}
                placeholder={t("questionnaire.expenseRangeMax")}
                onChange={(e) => {
                  const v = Math.max(0, parseFloat(e.target.value) || 0)
                  onRangeChange({ min: Math.min(valueRange.min, v), max: v })
                }}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm text-right text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">{currencySymbol}</span>
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
            </>
          )}
        </div>
      </div>

      {isRange ? (
        <DualSlider
          min={0}
          max={sliderMax}
          step={10}
          values={[Math.min(valueRange.min, sliderMax), Math.min(valueRange.max, sliderMax)]}
          onChange={([lo, hi]) => onRangeChange({ min: lo, max: Math.max(lo, hi) })}
        />
      ) : (
        <SingleSlider
          min={0}
          max={sliderMax}
          step={10}
          value={Math.min(value || 0, sliderMax)}
          onChange={onChange}
        />
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleRange}
          className={`w-8 h-4 rounded-full transition-colors ${isRange ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`block w-3 h-3 rounded-full bg-white mx-0.5 transition-transform ${
              isRange ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
        <span className="text-xs text-muted-foreground">{t("questionnaire.expenseRangeToggle")}</span>
      </div>
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
  const { t } = useTranslation()

  const INCOME_TYPE_OPTIONS: { label: string; value: IncomeSourceType; emoji: string }[] = [
    { label: t("questionnaire.incomeTypeEmploymentNet"), value: "employment_net", emoji: "💼" },
    { label: t("questionnaire.incomeTypeEmploymentGross"), value: "employment_gross", emoji: "🇮🇹" },
    { label: t("questionnaire.incomeTypeSelfEmployment"), value: "self_employment", emoji: "🧾" },
    { label: t("questionnaire.incomeTypeRental"), value: "rental", emoji: "🏠" },
    { label: t("questionnaire.incomeTypeInvestment"), value: "investment_dividends", emoji: "📈" },
    { label: t("questionnaire.incomeTypePension"), value: "pension", emoji: "🏦" },
    { label: t("questionnaire.incomeTypeBenefits"), value: "benefits", emoji: "🤝" },
    { label: t("questionnaire.incomeTypeFamilySupport"), value: "family_support", emoji: "👨‍👩‍👧" },
    { label: t("questionnaire.incomeTypeOther"), value: "other", emoji: "💰" },
  ]

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

  // Slider max for income: sensible cap based on type
  const incomeSliderMax = source.type === "employment_gross" ? 10000 : 8000
  const rangeSliderMax = incomeSliderMax

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <input
          type="text"
          placeholder={t("questionnaire.incomeSourceNamePlaceholder")}
          value={source.label}
          onChange={(e) => set("label", e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
          aria-label={t("questionnaire.incomeSourceRemove")}
        >
          ✕
        </button>
      </div>

      {/* Type selector */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("questionnaire.incomeSourceTypeLabel")}
        </p>
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

      {/* employment_gross - RAL flow */}
      {source.type === "employment_gross" ? (
        <div className="space-y-3">
          {/* RAL */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("questionnaire.incomeRalLabel")}
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
              {t("questionnaire.incomeCcnlLabel")}
            </label>
            <select
              value={source.ccnlId ?? ""}
              onChange={(e) => handleCcnlChange(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">{t("questionnaire.incomeCcnlPlaceholder")}</option>
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
              {t("questionnaire.incomeExtraMonths")}
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
                  {m}{t("questionnaire.incomeExtraMonthsLabel")}
                </button>
              ))}
            </div>
          </div>

          {/* Production bonus */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("questionnaire.incomeProductionBonus")}
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("questionnaire.incomeProductionBonusHint")}
            </p>
          </div>

          {/* Welfare aziendale */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t("questionnaire.incomeWelfare")}
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
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("questionnaire.incomeWelfareHint")}
            </p>
          </div>

          {/* Buoni pasto */}
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("questionnaire.incomeMealVoucher")}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {t("questionnaire.incomeMealVoucherFaceValue", { currency: currencySymbol })}
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
                  {t("questionnaire.incomeMealVoucherDays")}{" "}
                  <span className="text-amber-500">{t("questionnaire.incomeMealVoucherDaysHint")}</span>
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
                {t("questionnaire.incomeMealVoucherElectronic")}
              </span>
            </div>
            {(source.mealVoucherFaceValue ?? 0) > 0 && (source.mealVoucherEstimatedDaysMonth ?? 0) > 0 && net && (
              <p className="text-xs text-muted-foreground">
                {t("questionnaire.incomeMealVoucherEstimate", {
                  currency: currencySymbol,
                  amount: net.mealVoucherMonthlyEstimate.toFixed(0),
                })}
                <span className="ml-1 text-amber-500">{t("questionnaire.incomeMealVoucherVariable")}</span>
              </p>
            )}
          </div>

          {/* Net preview */}
          {net && (source.ral ?? 0) > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                {t("questionnaire.incomeNetCalculation")}
              </p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("questionnaire.incomeNetBase")}</span>
                <span className="font-medium text-foreground">
                  {currencySymbol}{net.netMonthly.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                </span>
              </div>
              {net.mealVoucherMonthlyEstimate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("questionnaire.incomeMealPlusLabel")}{" "}
                    <span className="text-amber-500">{t("questionnaire.incomeMealVoucherDaysHint")}</span>
                  </span>
                  <span className="font-medium text-foreground">
                    +{currencySymbol}{net.mealVoucherMonthlyEstimate.toLocaleString("it-IT", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-xs text-muted-foreground border-t border-border pt-1 mt-1">
                <span>{t("questionnaire.incomeInps")}</span>
                <span>-{currencySymbol}{net.inpsAnnual.toLocaleString("it-IT", { maximumFractionDigits: 0 })}/anno</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("questionnaire.incomeIrpef")}</span>
                <span>-{currencySymbol}{net.irpefNet.toLocaleString("it-IT", { maximumFractionDigits: 0 })}/anno</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t("questionnaire.incomeAddizionali")}</span>
                <span>-{currencySymbol}{net.addizionali.toLocaleString("it-IT", { maximumFractionDigits: 0 })}/anno</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* All other types: direct monthly net input with optional range */
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {source.isFixed
                ? t("questionnaire.incomeFixedAmountLabel")
                : t("questionnaire.incomeRangeLabel")}
            </label>
            {source.isFixed ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">{currencySymbol}</span>
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
                </div>
                <SingleSlider
                  min={0}
                  max={incomeSliderMax}
                  step={50}
                  value={Math.min(source.valueMin || 0, incomeSliderMax)}
                  onChange={(v) => onChange({ ...source, valueMin: v, valueMax: v })}
                />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    placeholder={t("questionnaire.expenseRangeMin")}
                    value={source.valueMin || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      set("valueMin", v)
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    placeholder={t("questionnaire.expenseRangeMax")}
                    value={source.valueMax || ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      set("valueMax", v)
                    }}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <DualSlider
                  min={0}
                  max={rangeSliderMax}
                  step={50}
                  values={[
                    Math.min(source.valueMin || 0, rangeSliderMax),
                    Math.min(source.valueMax || 0, rangeSliderMax),
                  ]}
                  onChange={([lo, hi]) => onChange({ ...source, valueMin: lo, valueMax: Math.max(lo, hi) })}
                />
              </>
            )}
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
            <span className="text-xs text-muted-foreground">
              {t("questionnaire.incomeVariableToggle")}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function QuestionnaireScreen({ user: _user, token, mode, onComplete, onBack }: Props) {
  const { t } = useTranslation()
  const effectiveGender: "masculine" | "feminine" | "neutral" =
    _user.voiceGender && _user.voiceGender !== "indifferent"
      ? (_user.voiceGender as "masculine" | "feminine" | "neutral")
      : "neutral"

  // ── Option arrays (inside component so t() is available) ──────────────────

  const EMPLOYMENT_OPTIONS = [
    { label: t("questionnaire.employmentEmployed"), value: "employed" },
    { label: t("questionnaire.employmentSelfEmployed"), value: "self_employed" },
    { label: t("questionnaire.employmentStudent"), value: "student" },
    { label: t("questionnaire.employmentOther"), value: "other" },
  ] as const

  const SAVINGS_OPTIONS = [
    { label: t("questionnaire.savingsNotSaving"), value: "not_saving" },
    { label: t("questionnaire.savingsOccasional"), value: "occasional" },
    { label: t("questionnaire.savingsRegular"), value: "regular" },
  ] as const

  const GOAL_OPTIONS = [
    { label: t("questionnaire.goalSaveMore"), value: "save_more" },
    { label: t("questionnaire.goalReduceDebt"), value: "reduce_debt" },
    { label: t("questionnaire.goalJustTrack"), value: "just_track" },
  ] as const

  const EXPENSE_CATEGORIES: { key: string; label: string; max: number }[] = [
    { key: "Affitto / Mutuo", label: t("questionnaire.expenseCategoryRent"), max: 3000 },
    { key: "Cibo e spesa", label: t("questionnaire.expenseCategoryFood"), max: 1500 },
    { key: "Trasporti", label: t("questionnaire.expenseCategoryTransport"), max: 1000 },
    { key: "Utenze", label: t("questionnaire.expenseCategoryUtilities"), max: 500 },
    { key: "Abbonamenti", label: t("questionnaire.expenseCategorySubscriptions"), max: 300 },
    { key: "Salute", label: t("questionnaire.expenseCategoryHealth"), max: 500 },
    { key: "Svago", label: t("questionnaire.expenseCategoryLeisure"), max: 1000 },
    { key: "Altro", label: t("questionnaire.expenseCategoryOther"), max: 1000 },
  ]

  const QUICK_STEPS = 4
  const totalQuestions = mode === "quick" ? QUICK_STEPS : QUICK_STEPS + 3

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<PartialAnswers>({
    currency: "EUR",
    expenseCategories: {},
    expenseCategoryRanges: {},
    expenseCategoryIsRange: {},
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

  const setExpenseCategoryRange = (key: string, value: { min: number; max: number }) => {
    setAnswers((prev) => ({
      ...prev,
      expenseCategoryRanges: { ...(prev.expenseCategoryRanges ?? {}), [key]: value },
      // Keep expenseCategories in sync with min value for downstream use
      expenseCategories: { ...(prev.expenseCategories ?? {}), [key]: value.min },
    }))
  }

  const toggleExpenseCategoryRange = (key: string) => {
    setAnswers((prev) => {
      const wasRange = (prev.expenseCategoryIsRange ?? {})[key] ?? false
      return {
        ...prev,
        expenseCategoryIsRange: { ...(prev.expenseCategoryIsRange ?? {}), [key]: !wasRange },
      }
    })
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

  const derivedMonthlyNet = incomeSources
    .filter((s) => !s.hideFromAssistant)
    .reduce((sum, s) => sum + (s.valueMin || 0), 0)

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return !!answers.employmentType
      case 1: {
        const sources = incomeSources
        if (sources.length === 0) return false
        return sources.every((s) => {
          if (s.type === "employment_gross") return (s.ral ?? 0) > 0
          return (s.valueMin ?? 0) > 0
        })
      }
      case 2: return !!answers.currency
      case 3: return true
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
      setError(t("questionnaire.errorSave"))
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
              {t("questionnaire.step0Title")}
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
                  {t("questionnaire.step0OtherLabel")}
                </label>
                <input
                  type="text"
                  placeholder={t(`questionnaire.step0OtherPlaceholder.${effectiveGender}`)}
                  value={answers.jobOther ?? ""}
                  onChange={(e) => setAnswer("jobOther", e.target.value || null)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )

      // ── Step 1: Income sources ──────────────────────────────────────────
      case 1:
        return (
          <div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">
              {t("questionnaire.step1Title")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("questionnaire.step1Subtitle")}
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
              {t("questionnaire.step1AddSource")}
            </button>

            {derivedMonthlyNet > 0 && (
              <div className="mt-4 rounded-lg bg-secondary/50 px-4 py-2 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {t("questionnaire.step1TotalNet")}
                </span>
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
              {t("questionnaire.step2Title")}
            </h2>
            <select
              value={currency}
              onChange={(e) => setAnswer("currency", e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="EUR">EUR - Euro</option>
              <option value="USD">USD - Dollaro americano</option>
              <option value="GBP">GBP - Sterlina britannica</option>
              <option value="CHF">CHF - Franco svizzero</option>
              <option value="other">Altra valuta</option>
            </select>
          </div>
        )

      // ── Step 3: Expenses by category ────────────────────────────────────
      case 3: {
        const cats = answers.expenseCategories ?? {}
        const catRanges = answers.expenseCategoryRanges ?? {}
        const catIsRange = answers.expenseCategoryIsRange ?? {}
        const total = Object.entries(cats).reduce((s, [, v]) => s + (v || 0), 0)
        return (
          <div>
            <h2 className="mb-1 text-xl font-semibold text-foreground">
              {t("questionnaire.step3Title")}
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("questionnaire.step3Subtitle")}
            </p>
            <div className="space-y-5">
              {EXPENSE_CATEGORIES.map((cat) => (
                <ExpenseCategoryRow
                  key={cat.key}
                  category={cat}
                  value={cats[cat.key] ?? 0}
                  valueRange={catRanges[cat.key] ?? { min: cats[cat.key] ?? 0, max: cats[cat.key] ?? 0 }}
                  isRange={catIsRange[cat.key] ?? false}
                  currency={currency}
                  onChange={(v) => setExpenseCategory(cat.key, v)}
                  onRangeChange={(v) => setExpenseCategoryRange(cat.key, v)}
                  onToggleRange={() => toggleExpenseCategoryRange(cat.key)}
                />
              ))}
            </div>
            {total > 0 && (
              <p className="mt-4 text-right text-sm font-medium text-foreground">
                {t("questionnaire.step3Total")}{" "}
                <span className="text-primary">{currency} {total.toLocaleString("it-IT")}</span>
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
              {t("questionnaire.step4Title")}
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
              {t("questionnaire.step5Title")}
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
              {t("questionnaire.step6Title")}
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
      <div className="mb-8 flex items-center justify-end">
        <span className="text-sm text-muted-foreground">
          {t("questionnaire.stepCounter", { current: step + 1, total: totalQuestions })}
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
              {t("questionnaire.back")}
            </Button>
            <Button
              variant="default"
              disabled={!canAdvance() || loading}
              onClick={() => void handleNext()}
            >
              {loading
                ? t("questionnaire.saving")
                : step === totalQuestions - 1
                  ? t("questionnaire.finish")
                  : t("questionnaire.next")}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
