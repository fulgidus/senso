"""
Italian payroll gross-to-net calculation.

Covers:
- IRPEF 2024 progressive brackets
- Detrazioni per lavoro dipendente (DL 3/2024 / Legge Biagi scale)
- INPS employee contribution (~9.19% up to massimale)
- Addizionali regionali/comunali (approximate average: 1.73%)
- 13ª/14ª mensilità extra months (spread across 12 months)
- Production bonus (tassazione separata: 10% up to €3,000/y)
- Welfare aziendale (non-taxable up to €1,000/y - 2024 threshold)
- Buoni pasto (non-taxable up to €8/day for electronic vouchers - 2024)

All monetary amounts are in EUR.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


# ── IRPEF 2024 brackets ────────────────────────────────────────────────────
# (Legge di Bilancio 2024 - DL 216/2023 converted)
# Brackets: (up_to, rate)
# last bracket has up_to=None (unbounded)
_IRPEF_BRACKETS: list[tuple[float | None, float]] = [
    (28_000.0, 0.23),
    (50_000.0, 0.35),
    (None, 0.43),
]

# INPS employee aliquota contributiva (lavoro dipendente settore privato)
INPS_RATE = 0.0919
# INPS massimale contributivo 2024 (IVS, art. 2 co. 18 L. 335/95)
INPS_MASSIMALE = 119_650.0

# Addizionali regionali + comunali - approximate national average 2024
ADDIZIONALE_RATE_APPROX = 0.0173

# Welfare aziendale esenzione fiscale 2024
WELFARE_EXEMPT_MAX = 1_000.0

# Buoni pasto - soglia esenzione 2024: €8/day for electronic vouchers
MEAL_VOUCHER_EXEMPT_MAX_ELECTRONIC = 8.0
MEAL_VOUCHER_EXEMPT_MAX_PAPER = 4.0  # paper vouchers lower threshold

# Premio di produzione - tassazione sostitutiva 10% fino a €3,000/y
PRODUCTION_BONUS_REDUCED_TAX_RATE = 0.10
PRODUCTION_BONUS_MAX_REDUCED = 3_000.0


# ── CCNL Presets ──────────────────────────────────────────────────────────


@dataclass
class CCNLPreset:
    id: str
    label: str
    extra_months: int  # 13 or 14
    # Overtime: ordinary threshold (hours/week above which OT applies)
    overtime_threshold_weekly: float
    # Ordinary overtime multiplier (e.g. 1.25)
    overtime_ordinary_multiplier: float
    # Max ordinary overtime hours per week
    overtime_ordinary_max_weekly: float
    # Extraordinary overtime multiplier (e.g. 1.50)
    overtime_extraordinary_multiplier: float
    # Notes for UI display
    notes: str = ""


CCNL_PRESETS: dict[str, CCNLPreset] = {
    "metalmeccanico_industria": CCNLPreset(
        id="metalmeccanico_industria",
        label="Metalmeccanico / Industria (FIM-CISL/FIOM-CGIL/UILM)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=2.0,  # up to 2h/day, 10h/week
        overtime_extraordinary_multiplier=1.50,
        notes="14ª in giugno. Straordinario oltre 10h/sett: +50%.",
    ),
    "commercio_terziario": CCNLPreset(
        id="commercio_terziario",
        label="Commercio e Terziario (CONFCOMMERCIO)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.30,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.45,
        notes="14ª in luglio.",
    ),
    "edilizia_industria": CCNLPreset(
        id="edilizia_industria",
        label="Edilizia Industria (ANCE)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="14ª in agosto.",
    ),
    "chimico_farmaceutico": CCNLPreset(
        id="chimico_farmaceutico",
        label="Chimico-Farmaceutico (Federchimica/Farmindustria)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.28,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="14ª in luglio.",
    ),
    "bancario_abi": CCNLPreset(
        id="bancario_abi",
        label="Bancario (ABI)",
        extra_months=14,
        overtime_threshold_weekly=37.5,
        overtime_ordinary_multiplier=1.35,
        overtime_ordinary_max_weekly=6.0,
        overtime_extraordinary_multiplier=1.50,
        notes="Orario contrattuale 37.5h/sett. 14ª in luglio.",
    ),
    "credito_assicurativo": CCNLPreset(
        id="credito_assicurativo",
        label="Credito / Assicurativo",
        extra_months=14,
        overtime_threshold_weekly=37.5,
        overtime_ordinary_multiplier=1.35,
        overtime_ordinary_max_weekly=6.0,
        overtime_extraordinary_multiplier=1.50,
        notes="14ª in luglio.",
    ),
    "pubblico_impiego": CCNLPreset(
        id="pubblico_impiego",
        label="Pubblico impiego / Funzioni centrali (ARAN)",
        extra_months=13,
        overtime_threshold_weekly=36.0,
        overtime_ordinary_multiplier=1.15,
        overtime_ordinary_max_weekly=4.0,
        overtime_extraordinary_multiplier=1.30,
        notes="Orario 36h/sett. Solo 13ª. Straordinario contingentato.",
    ),
    "sanita_pubblica": CCNLPreset(
        id="sanita_pubblica",
        label="Sanità pubblica (ARAN)",
        extra_months=13,
        overtime_threshold_weekly=36.0,
        overtime_ordinary_multiplier=1.15,
        overtime_ordinary_max_weekly=4.0,
        overtime_extraordinary_multiplier=1.30,
        notes="Orario 36h/sett. Solo 13ª.",
    ),
    "istruzione_ricerca": CCNLPreset(
        id="istruzione_ricerca",
        label="Istruzione e Ricerca (ARAN)",
        extra_months=13,
        overtime_threshold_weekly=36.0,
        overtime_ordinary_multiplier=1.15,
        overtime_ordinary_max_weekly=4.0,
        overtime_extraordinary_multiplier=1.30,
        notes="Solo 13ª.",
    ),
    "commercio_pmi": CCNLPreset(
        id="commercio_pmi",
        label="Commercio PMI (CONFESERCENTI)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.30,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.45,
        notes="14ª in luglio.",
    ),
    "artigianato": CCNLPreset(
        id="artigianato",
        label="Artigianato (varie categorie CNA/Confartigianato)",
        extra_months=13,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="Solo 13ª (alcune categorie hanno 14ª).",
    ),
    "trasporti_logistica": CCNLPreset(
        id="trasporti_logistica",
        label="Trasporti e Logistica (Conftrasporto/Assologistica)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="14ª in luglio.",
    ),
    "turismo_pubblici_esercizi": CCNLPreset(
        id="turismo_pubblici_esercizi",
        label="Turismo / Pubblici esercizi (Federturismo/FIPE)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.30,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="14ª variabile. Include festività retribuite.",
    ),
    "agricoltura_operai": CCNLPreset(
        id="agricoltura_operai",
        label="Agricoltura - Operai (Confagricoltura/CIA/Coldiretti)",
        extra_months=13,
        overtime_threshold_weekly=39.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=6.0,
        overtime_extraordinary_multiplier=1.50,
        notes="Solo 13ª per operai.",
    ),
    "telecomunicazioni": CCNLPreset(
        id="telecomunicazioni",
        label="Telecomunicazioni (Asstel)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="14ª in luglio.",
    ),
    "informatica_tlc": CCNLPreset(
        id="informatica_tlc",
        label="Informatica / TLC privato (Assinform/Assotelecomunicazioni)",
        extra_months=14,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="14ª in luglio. Smart working ampiamente previsto.",
    ),
    "altro": CCNLPreset(
        id="altro",
        label="Altro / Non so",
        extra_months=13,
        overtime_threshold_weekly=40.0,
        overtime_ordinary_multiplier=1.25,
        overtime_ordinary_max_weekly=8.0,
        overtime_extraordinary_multiplier=1.50,
        notes="Usa valori tipici di riferimento.",
    ),
}


# ── Core calculation ───────────────────────────────────────────────────────


@dataclass
class IrpefDetail:
    gross_taxable: float
    irpef_gross: float
    detrazione_lavoro_dipendente: float
    irpef_net: float
    addizionali: float
    inps_employee: float
    total_deductions: float
    net_annual: float
    net_monthly: float  # RAL / extra_months basis


def _compute_irpef(reddito_imponibile: float) -> tuple[float, float]:
    """
    Returns (irpef_lorda, detrazione_lavoro_dipendente).
    reddito_imponibile = RAL - INPS employee contribution.
    """
    irpef = 0.0
    prev_limit = 0.0
    for up_to, rate in _IRPEF_BRACKETS:
        if up_to is None:
            irpef += max(0.0, reddito_imponibile - prev_limit) * rate
            break
        bracket_top = up_to
        if reddito_imponibile <= prev_limit:
            break
        taxable_in_bracket = min(reddito_imponibile, bracket_top) - prev_limit
        irpef += taxable_in_bracket * rate
        prev_limit = bracket_top

    # Detrazione lavoro dipendente (art. 13 TUIR - valori 2024 post DL 3/2024)
    # Flat €1,955 up to €15,000
    # Linear slide from €1,955 to €700 between €15,001 and €28,000
    # Linear slide from €700 to €0 between €28,001 and €50,000
    # Zero above €50,000
    r = reddito_imponibile
    if r <= 15_000.0:
        detrazione = 1_955.0
    elif r <= 28_000.0:
        detrazione = 1_955.0 * (28_000.0 - r) / (28_000.0 - 15_000.0) + 700.0 * (
            r - 15_000.0
        ) / (28_000.0 - 15_000.0)
    elif r <= 50_000.0:
        detrazione = 700.0 * (50_000.0 - r) / (50_000.0 - 28_000.0)
    else:
        detrazione = 0.0

    return irpef, max(0.0, detrazione)


def compute_net_from_ral(
    ral: float,
    extra_months: int = 13,
    production_bonus_annual: float = 0.0,
    welfare_annual: float = 0.0,
    meal_voucher_face_value: float = 0.0,
    meal_voucher_estimated_days_month: float = 0.0,
    meal_voucher_electronic: bool = True,
) -> IrpefDetail:
    """
    Compute monthly net income from RAL (Reddito Annuo Lordo) for lavoro dipendente.

    Parameters
    ----------
    ral : RAL in EUR (gross annual, excluding 13ª/14ª which are already included).
    extra_months : 13 (13ª only) or 14 (13ª + 14ª).
    production_bonus_annual : Annual production bonus (tassazione sostitutiva 10% up to €3k).
    welfare_annual : Annual welfare aziendale budget (non-taxable up to €1,000).
    meal_voucher_face_value : Face value per voucher in EUR.
    meal_voucher_estimated_days_month : Estimated office days/month.
    meal_voucher_electronic : True = electronic vouchers (€8 exempt threshold).

    Returns
    -------
    IrpefDetail with net_monthly = estimated take-home per month (base, no meal vouchers).
    """
    # 1. INPS employee contribution on RAL (capped at massimale)
    inps_base = min(ral, INPS_MASSIMALE)
    inps_annual = inps_base * INPS_RATE

    # 2. IRPEF taxable = RAL - INPS employee
    irpef_base = max(0.0, ral - inps_annual)

    # 3. IRPEF lorda + detrazione lavoro dipendente
    irpef_gross, detrazione = _compute_irpef(irpef_base)
    irpef_net = max(0.0, irpef_gross - detrazione)

    # 4. Addizionali regionali + comunali (on same taxable base)
    addizionali = irpef_base * ADDIZIONALE_RATE_APPROX

    # 5. Production bonus tassazione sostitutiva (10% up to €3k, remainder IRPEF marginal)
    prod_bonus_tax = 0.0
    if production_bonus_annual > 0:
        reduced_base = min(production_bonus_annual, PRODUCTION_BONUS_MAX_REDUCED)
        excess = max(0.0, production_bonus_annual - PRODUCTION_BONUS_MAX_REDUCED)
        prod_bonus_tax = (
            reduced_base * PRODUCTION_BONUS_REDUCED_TAX_RATE + excess * 0.43
        )  # marginal top rate

    # 6. Total annual deductions
    total_deductions = inps_annual + irpef_net + addizionali + prod_bonus_tax

    # 7. Annual net from RAL (including production bonus net)
    net_annual = ral + production_bonus_annual - total_deductions
    # Welfare aziendale is non-taxable up to threshold → add net directly
    welfare_net = min(welfare_annual, WELFARE_EXEMPT_MAX)
    net_annual += welfare_net

    # 8. Monthly net - spread over 12 months
    # extra_months means the annual salary is split into extra_months pay packets but
    # we report as monthly. E.g. RAL 30k with 13 months → 30k/13 = base monthly,
    # but employer pays that same 30k over 13 pay packets. For the user's
    # monthly cash-flow, what matters is net_annual / 12 (calendar months).
    net_monthly = net_annual / 12.0

    return IrpefDetail(
        gross_taxable=irpef_base,
        irpef_gross=round(irpef_gross, 2),
        detrazione_lavoro_dipendente=round(detrazione, 2),
        irpef_net=round(irpef_net, 2),
        addizionali=round(addizionali, 2),
        inps_employee=round(inps_annual, 2),
        total_deductions=round(total_deductions, 2),
        net_annual=round(net_annual, 2),
        net_monthly=round(net_monthly, 2),
    )


def meal_voucher_monthly_estimate(
    face_value: float,
    estimated_days_month: float,
    electronic: bool = True,
) -> dict:
    """
    Estimate monthly meal voucher value and non-taxable portion.
    Returns {"gross_monthly", "taxable_monthly", "net_monthly_estimate"}.
    """
    gross = face_value * estimated_days_month
    exempt_per_day = (
        MEAL_VOUCHER_EXEMPT_MAX_ELECTRONIC
        if electronic
        else MEAL_VOUCHER_EXEMPT_MAX_PAPER
    )
    taxable_per_day = max(0.0, face_value - exempt_per_day)
    taxable_monthly = taxable_per_day * estimated_days_month
    # Net ≈ gross - tax on taxable portion (use 27% average rate as rough estimate)
    net_estimate = gross - taxable_monthly * 0.27
    return {
        "gross_monthly": round(gross, 2),
        "taxable_monthly": round(taxable_monthly, 2),
        "net_monthly_estimate": round(net_estimate, 2),
    }
