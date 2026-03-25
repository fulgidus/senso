import { apiRequest } from "@/lib/api-client"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export type CategorizationStatus =
  | "not_started"
  | "queued"
  | "categorizing"
  | "generating_insights"
  | "complete"
  | "failed"

export type CategorizationStatusResponse = {
  status: CategorizationStatus
  errorMessage?: string | null
  startedAt?: string | null
  completedAt?: string | null
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
  monthlyNetIncome: number
  currency: string
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
