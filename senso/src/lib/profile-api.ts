import { apiRequest } from "@/lib/api-client"
import { getBackendBaseUrl } from "@/lib/config"

const API_BASE = getBackendBaseUrl()

export type CategorizationStatus =
    | "not_started"
    | "queued"
    | "categorizing"
    | "generating_insights"
    | "complete"
    | "failed"

export type ProgressFile = {
    id: string
    name: string
    status: "pending" | "processing" | "done"
    txn_count: number | null
}

export type ProgressDetail = {
    files: ProgressFile[]
    txn_total: number
    txn_categorised: number
    current_step_detail: string
}

export type CategorizationStatusResponse = {
    status: CategorizationStatus
    errorMessage?: string | null
    startedAt?: string | null
    completedAt?: string | null
    /** SHA-256 fingerprint stored at the time of the last completed categorization */
    uploadsFingerprint?: string | null
    /** SHA-256 fingerprint of currently confirmed uploads (live-computed) */
    currentUploadsFingerprint?: string | null
    /** Granular per-file progress populated during a categorization run */
    progressDetail?: ProgressDetail | null
}

export type IncomeSummary = {
    amount: number
    currency: string
    source: "payslip" | "questionnaire" | "estimated_from_transactions"
}

export type InsightCard = {
    headline: string
    data_point: string
    educational_framing: string
}

// ── IncomeSource ───────────────────────────────────────────────────────────

export type IncomeSourceType =
    | "employment_net"        // user enters monthly net directly
    | "employment_gross"      // RAL + Italian payroll computation
    | "self_employment"       // freelance / P.IVA
    | "rental"
    | "investment_dividends"
    | "pension"
    | "benefits"
    | "family_support"
    | "other"

export type IncomeSource = {
    id: string                              // uuid
    label: string                           // user-facing name
    type: IncomeSourceType
    currency: string                        // default "EUR"

    /** true → value_min == value_max, single input in UI */
    isFixed: boolean
    valueMin: number                        // monthly net minimum
    valueMax: number                        // monthly net maximum (incl. variable parts)

    /** For hourly rate display: monthly_net / (weeklyHours × 4.33) */
    weeklyHours?: number | null
    /** Overtime starts after this many hours/week (per CCNL) */
    overtimeWeeklyHoursMin?: number | null
    /** Max overtime hours/week (CCNL cap) */
    overtimeWeeklyHoursMax?: number | null
    /** e.g. 1.25 for +25% overtime pay */
    overtimeMultiplier?: number | null

    /** Substrings (case-insensitive by default) matched against transaction descriptions */
    transactionLabels: string[]
    transactionLabelsCaseSensitive: boolean

    hideFromGraphs: boolean
    hideFromAssistant: boolean

    // ── Italian employment-specific (type === "employment_gross") ──
    /** Reddito Annuo Lordo */
    ral?: number | null
    /** References CCNL preset id */
    ccnlId?: string | null
    /** 13 = only 13ª mensilità, 14 = 13ª + 14ª */
    extraMonths?: number | null
    /** Annual production bonus (premio di produzione) */
    productionBonusAnnual?: number | null
    /** Annual welfare aziendale budget (non-taxable up to €1,000/y) */
    welfareAnnual?: number | null
    /** Face value per meal voucher in EUR */
    mealVoucherFaceValue?: number | null
    /**
     * Estimated office working days per month.
     * Variable due to smart working / sick days / leave - labelled as "stima".
     * Contributes to valueMax but NOT valueMin.
     */
    mealVoucherEstimatedDaysMonth?: number | null
    /** true = electronic vouchers (€8 exempt threshold), false = paper (€4) */
    mealVoucherElectronic: boolean
}

/** Sensible defaults for a new IncomeSource */
export function makeIncomeSource(overrides?: Partial<IncomeSource>): IncomeSource {
    return {
        id: crypto.randomUUID(),
        label: "",
        type: "employment_net",
        currency: "EUR",
        isFixed: true,
        valueMin: 0,
        valueMax: 0,
        transactionLabels: [],
        transactionLabelsCaseSensitive: false,
        hideFromGraphs: false,
        hideFromAssistant: false,
        mealVoucherElectronic: true,
        ...overrides,
    }
}

// ── CCNL presets (mirrors backend italian_payroll.py) ─────────────────────

export type CCNLPreset = {
    id: string
    label: string
    extraMonths: 13 | 14
    overtimeThresholdWeekly: number
    overtimeOrdinaryMultiplier: number
    overtimeOrdinaryMaxWeekly: number
    overtimeExtraordinaryMultiplier: number
    notes: string
}

export const CCNL_PRESETS: CCNLPreset[] = [
    { id: "metalmeccanico_industria", label: "Metalmeccanico / Industria (FIM-CISL/FIOM-CGIL/UILM)", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.25, overtimeOrdinaryMaxWeekly: 2, overtimeExtraordinaryMultiplier: 1.5, notes: "14ª in giugno. Straordinario oltre 10h/sett: +50%." },
    { id: "commercio_terziario", label: "Commercio e Terziario (CONFCOMMERCIO)", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.3, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.45, notes: "14ª in luglio." },
    { id: "edilizia_industria", label: "Edilizia Industria (ANCE)", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.25, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "14ª in agosto." },
    { id: "chimico_farmaceutico", label: "Chimico-Farmaceutico (Federchimica/Farmindustria)", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.28, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "14ª in luglio." },
    { id: "bancario_abi", label: "Bancario (ABI)", extraMonths: 14, overtimeThresholdWeekly: 37.5, overtimeOrdinaryMultiplier: 1.35, overtimeOrdinaryMaxWeekly: 6, overtimeExtraordinaryMultiplier: 1.5, notes: "Orario contrattuale 37.5h/sett. 14ª in luglio." },
    { id: "pubblico_impiego", label: "Pubblico impiego / Funzioni centrali (ARAN)", extraMonths: 13, overtimeThresholdWeekly: 36, overtimeOrdinaryMultiplier: 1.15, overtimeOrdinaryMaxWeekly: 4, overtimeExtraordinaryMultiplier: 1.3, notes: "Orario 36h/sett. Solo 13ª." },
    { id: "sanita_pubblica", label: "Sanità pubblica (ARAN)", extraMonths: 13, overtimeThresholdWeekly: 36, overtimeOrdinaryMultiplier: 1.15, overtimeOrdinaryMaxWeekly: 4, overtimeExtraordinaryMultiplier: 1.3, notes: "Orario 36h/sett. Solo 13ª." },
    { id: "istruzione_ricerca", label: "Istruzione e Ricerca (ARAN)", extraMonths: 13, overtimeThresholdWeekly: 36, overtimeOrdinaryMultiplier: 1.15, overtimeOrdinaryMaxWeekly: 4, overtimeExtraordinaryMultiplier: 1.3, notes: "Solo 13ª." },
    { id: "telecomunicazioni", label: "Telecomunicazioni (Asstel)", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.25, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "14ª in luglio." },
    { id: "informatica_tlc", label: "Informatica / TLC privato (Assinform)", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.25, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "14ª in luglio. Smart working ampiamente previsto." },
    { id: "turismo_pubblici_esercizi", label: "Turismo / Pubblici esercizi (FIPE)", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.3, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "14ª variabile." },
    { id: "trasporti_logistica", label: "Trasporti e Logistica", extraMonths: 14, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.25, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "14ª in luglio." },
    { id: "artigianato", label: "Artigianato (CNA/Confartigianato)", extraMonths: 13, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.25, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "Solo 13ª (alcune categorie hanno 14ª)." },
    { id: "altro", label: "Altro / Non so", extraMonths: 13, overtimeThresholdWeekly: 40, overtimeOrdinaryMultiplier: 1.25, overtimeOrdinaryMaxWeekly: 8, overtimeExtraordinaryMultiplier: 1.5, notes: "Usa valori tipici di riferimento." },
]

// ── IRPEF 2024 gross-to-net (frontend mirror of backend italian_payroll.py) ─

const IRPEF_BRACKETS: [number | null, number][] = [
    [28_000, 0.23],
    [50_000, 0.35],
    [null, 0.43],
]
const INPS_RATE = 0.0919
const INPS_MASSIMALE = 119_650
const ADDIZIONALE_RATE = 0.0173
const WELFARE_EXEMPT_MAX = 1_000
const PROD_BONUS_REDUCED_RATE = 0.10
const PROD_BONUS_MAX_REDUCED = 3_000

function irpefAndDetrazione(imponibile: number): [number, number] {
    let irpef = 0
    let prev = 0
    for (const [top, rate] of IRPEF_BRACKETS) {
        if (top === null) {
            irpef += Math.max(0, imponibile - prev) * rate
            break
        }
        if (imponibile <= prev) break
        irpef += (Math.min(imponibile, top) - prev) * rate
        prev = top
    }
    let det: number
    if (imponibile <= 15_000) {
        det = 1_955
    } else if (imponibile <= 28_000) {
        det = 1_955 * (28_000 - imponibile) / 13_000 + 700 * (imponibile - 15_000) / 13_000
    } else if (imponibile <= 50_000) {
        det = 700 * (50_000 - imponibile) / 22_000
    } else {
        det = 0
    }
    return [irpef, Math.max(0, det)]
}

export type NetResult = {
    netMonthly: number
    netAnnual: number
    inpsAnnual: number
    irpefNet: number
    addizionali: number
    /** Monthly meal voucher estimate (variable - label as stima) */
    mealVoucherMonthlyEstimate: number
    /** netMonthly + mealVoucherMonthlyEstimate (valueMax) */
    netMonthlyMax: number
}

export function computeNetFromRal(
    ral: number,
    _extraMonths: number = 13,
    productionBonusAnnual: number = 0,
    welfareAnnual: number = 0,
    mealVoucherFaceValue: number = 0,
    mealVoucherEstimatedDaysMonth: number = 0,
    mealVoucherElectronic: boolean = true,
): NetResult {
    const inpsBase = Math.min(ral, INPS_MASSIMALE)
    const inpsAnnual = inpsBase * INPS_RATE
    const imponibile = Math.max(0, ral - inpsAnnual)
    const [irpefGross, detrazione] = irpefAndDetrazione(imponibile)
    const irpefNet = Math.max(0, irpefGross - detrazione)
    const addizionali = imponibile * ADDIZIONALE_RATE
    let prodBonusTax = 0
    if (productionBonusAnnual > 0) {
        const reduced = Math.min(productionBonusAnnual, PROD_BONUS_MAX_REDUCED)
        const excess = Math.max(0, productionBonusAnnual - PROD_BONUS_MAX_REDUCED)
        prodBonusTax = reduced * PROD_BONUS_REDUCED_RATE + excess * 0.43
    }
    const welfareNet = Math.min(welfareAnnual, WELFARE_EXEMPT_MAX)
    const totalDeductions = inpsAnnual + irpefNet + addizionali + prodBonusTax
    const netAnnual = ral + productionBonusAnnual - totalDeductions + welfareNet
    const netMonthly = netAnnual / 12

    // Meal vouchers - variable, contributes to valueMax only
    const exemptPerDay = mealVoucherElectronic ? 8 : 4
    const taxablePerDay = Math.max(0, mealVoucherFaceValue - exemptPerDay)
    const grossMonthly = mealVoucherFaceValue * mealVoucherEstimatedDaysMonth
    const taxableMonthly = taxablePerDay * mealVoucherEstimatedDaysMonth
    const mealVoucherMonthlyEstimate = grossMonthly - taxableMonthly * 0.27

    return {
        netMonthly: Math.round(netMonthly * 100) / 100,
        netAnnual: Math.round(netAnnual * 100) / 100,
        inpsAnnual: Math.round(inpsAnnual * 100) / 100,
        irpefNet: Math.round(irpefNet * 100) / 100,
        addizionali: Math.round(addizionali * 100) / 100,
        mealVoucherMonthlyEstimate: Math.round(mealVoucherMonthlyEstimate * 100) / 100,
        netMonthlyMax: Math.round((netMonthly + mealVoucherMonthlyEstimate) * 100) / 100,
    }
}

// ── Profile / Questionnaire types ─────────────────────────────────────────

export type UserProfile = {
    id: string
    userId: string
    incomeSummary: IncomeSummary | null
    monthlyExpenses: number | null
    monthlyMargin: number | null
    categoryTotals: Record<string, number>
    insightCards: InsightCard[]
    questionnaireAnswers: Record<string, unknown> | null
    dataSources: string[]
    confirmed: boolean
    profileGeneratedAt: string | null
    updatedAt: string
}

export type QuestionnaireAnswers = {
    employmentType: "employed" | "self_employed" | "student" | "other"
    /** Free-text job description when employmentType === "other" */
    jobOther?: string | null
    monthlyNetIncome: number
    currency: string
    /** Rich income source objects */
    incomeSources?: IncomeSource[]
    /** Per-category monthly expense amounts e.g. { "Affitto": 800, "Cibo": 400 } */
    expenseCategories?: Record<string, number>
    // Thorough extras
    fixedMonthlyCosts?: number | null
    otherIncomeSources?: string[]
    householdSize?: number | null
    savingsBehavior?: "not_saving" | "occasional" | "regular" | null
    financialGoal?: "save_more" | "reduce_debt" | "just_track" | null
}

export async function getProfileStatus(
    token: string,
): Promise<CategorizationStatusResponse> {
    return apiRequest<CategorizationStatusResponse>(API_BASE, "/profile/status", {
        token,
    })
}

export async function getProfile(token: string): Promise<UserProfile> {
    return apiRequest<UserProfile>(API_BASE, "/profile", { token })
}

export async function triggerCategorization(
    token: string,
): Promise<{ status: string }> {
    return apiRequest<{ status: string }>(
        API_BASE,
        "/profile/trigger-categorization",
        { method: "POST", token },
    )
}

export async function confirmProfile(
    token: string,
    payload: {
        incomeOverride?: number | null
        expensesOverride?: number | null
        incomeSourceOverride?: string | null
    },
): Promise<UserProfile> {
    return apiRequest<UserProfile>(API_BASE, "/profile/confirm", {
        method: "POST",
        token,
        body: payload,
    })
}

export async function submitQuestionnaire(
    token: string,
    mode: "quick" | "thorough",
    answers: QuestionnaireAnswers,
): Promise<{ status: string }> {
    return apiRequest<{ status: string }>(API_BASE, "/profile/questionnaire", {
        method: "POST",
        token,
        body: { mode, answers },
    })
}

// ── Phase 9: Timeline + Uncategorized types ────────────────────────────────

export interface TimelineEventDTO {
    id: string
    event_type: string
    event_date: string // ISO date "YYYY-MM-DD"
    title: string
    description: string | null
    evidence_json: Record<string, unknown> | null
    user_context_distilled: string | null
    context_tos_status: string
    is_user_dismissed: boolean
    dismissed_reason: string | null
}

export interface UncategorizedTransactionDTO {
    id: string
    description: string | null
    amount: number | null
    date: string | null
    source_filename: string | null
    type: "income" | "expense" | "transfer" | null
    counterpart_name: string | null
}

// ── Phase 9: Timeline API functions ───────────────────────────────────────

export async function getTimeline(
    token: string,
    includeDismissed = false,
): Promise<TimelineEventDTO[]> {
    return apiRequest<TimelineEventDTO[]>(
        API_BASE,
        `/profile/timeline?include_dismissed=${includeDismissed}`,
        { token },
    )
}

export async function dismissTimelineEvent(
    token: string,
    eventId: string,
    reason: string,
    detail?: string,
): Promise<void> {
    await apiRequest<void>(API_BASE, `/profile/timeline/${eventId}/dismiss`, {
        method: "POST",
        token,
        body: { reason, detail },
    })
}

export async function addTimelineContext(
    token: string,
    eventId: string,
    text: string,
): Promise<void> {
    await apiRequest<void>(API_BASE, `/profile/timeline/${eventId}/context`, {
        method: "POST",
        token,
        body: { text },
    })
}

// ── Phase 9: Uncategorized API functions ──────────────────────────────────

export async function getUncategorized(
    token: string,
): Promise<UncategorizedTransactionDTO[]> {
    return apiRequest<UncategorizedTransactionDTO[]>(API_BASE, "/profile/uncategorized", {
        token,
    })
}

export async function updateTransactionCategory(
    token: string,
    transactionId: string,
    category: string,
): Promise<void> {
    await apiRequest<void>(
        API_BASE,
        `/profile/transactions/${transactionId}/category`,
        {
            method: "PATCH",
            token,
            body: { category },
        },
    )
}

export async function bulkUpdateCategoryByDescription(
    token: string,
    description: string,
    category: string,
): Promise<{ updated: number; category: string }> {
    return apiRequest<{ updated: number; category: string }>(
        API_BASE,
        `/profile/transactions/by-description/category`,
        {
            method: "PATCH",
            token,
            body: { description, category },
        },
    )
}
