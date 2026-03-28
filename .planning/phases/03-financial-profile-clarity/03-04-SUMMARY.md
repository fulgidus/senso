---
phase: 03-financial-profile-clarity
plan: 03-04
status: complete
completed_at: 2026-03-25
---

# Plan 03-04 Summary - Full Profile UI

## What was built

### senso/src/components/ui/chart.tsx (installed)
- Installed via `npx shadcn@latest add chart --yes`
- Adds `ChartContainer`, `ChartTooltip`, `ChartLegend` components wrapping Recharts
- Recharts installed as dependency

### senso/src/features/profile/OnboardingChoiceScreen.tsx (created)
Two-path onboarding screen:
- "From your files" card with `FileUp` icon → `onChooseFiles()`
- "Answer a few questions" card with `MessageSquare` icon → `onChooseQuestionnaire()`
- Responsive 2-column grid (sm:), `hover:border-primary` on cards
- Correct copy per UI-SPEC

### senso/src/features/profile/QuestionnaireScreen.tsx (created)
Step-by-step questionnaire:
- Quick mode: 3 questions (employment type, net income, currency)
- Thorough mode: 8 questions (adds fixed costs, other income sources, household size, savings behavior, financial goal)
- `OptionPill` component with selected/unselected states
- Progress indicator "Question N of M" top-right
- Back/Next/Finish navigation; `submitQuestionnaire()` on final step
- Error handling for failed submission

### senso/src/features/profile/ProfileScreen.tsx (created)
Full profile screen:
- **SummaryCard**: income / expenses / margin in 3-column grid; source badge on income; margin positive=`text-primary`, negative=`text-destructive`
- **SpendingBreakdown**: horizontal bar chart (Recharts), max 5 categories + "Other"; category pills below
- **IncomeVsExpenses**: grouped vertical bar chart; only shown when income data available
- **InsightCards**: 3 skeleton cards while loading, then 1-3 real cards with `Lightbulb` icon
- **ConfirmCorrect**: editable income/expenses inputs + "Save Profile" CTA; `confirmProfile()` on submit
- "Add more documents" ghost button → `onAddDocuments()`
- Loading skeleton state and error state

### senso/src/features/auth/AuthedHome.tsx (rewritten - final)
Full 5-screen routing:
- `"ingestion"` → `IngestionScreen` with `onConfirmAll` callback
- `"processing"` → `ProcessingScreen` with `onBack` / `onComplete`
- `"profile"` → `ProfileScreen` with `onAddDocuments` / `onSignOut`
- `"onboarding"` → `OnboardingChoiceScreen`
- `"questionnaire"` → `QuestionnaireScreen` with mode state
- On mount: status check resumes correct screen
- `handleQuestionnaireComplete`: triggers categorization then navigates to processing

## Verification
- TypeScript: no errors (`npx tsc --noEmit`)
- Build: passes (`npm run build`) - 2505 modules, ✓ built in 2.66s
- Chunk size warning (>500kB) is expected - Recharts bundle; not an error

## Discoveries
- Recharts `Tooltip.formatter` types require `ValueType | undefined` (not `number`) - fixed by narrowing with `typeof value === "number"`
