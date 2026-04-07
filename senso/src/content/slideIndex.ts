/**
 * slideIndex.ts - static import map for all MARP slide decks.
 *
 * Vite resolves `?raw` imports at build time; we enumerate them here so
 * MarpSlideViewer can look up any slide by its catalog ID without dynamic
 * import() calls that would require build-time glob patterns.
 */

import itBudgetBase from "./slides/it-slide-budget-base.md?raw"
import itTanTaeg from "./slides/it-slide-tan-taeg.md?raw"
import itFondoEmergenza from "./slides/it-slide-fondo-emergenza.md?raw"
import itEtfIntro from "./slides/it-slide-etf-intro.md?raw"
import enBudgetBasics from "./slides/en-slide-budget-basics.md?raw"
import enCompoundInterest from "./slides/en-slide-compound-interest.md?raw"

export const SLIDE_INDEX: Record<string, string> = {
    "it-slide-budget-base": itBudgetBase,
    "it-slide-tan-taeg": itTanTaeg,
    "it-slide-fondo-emergenza": itFondoEmergenza,
    "it-slide-etf-intro": itEtfIntro,
    "en-slide-budget-basics": enBudgetBasics,
    "en-slide-compound-interest": enCompoundInterest,
}
