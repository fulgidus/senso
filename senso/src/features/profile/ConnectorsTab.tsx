import { Building2 } from "lucide-react"
import { useTranslation } from "react-i18next"

const BANKS = [
  "Intesa Sanpaolo",
  "UniCredit",
  "Fineco",
  "ING Italia",
  "N26",
  "Revolut",
]

export function ConnectorsTab() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-foreground">
          {t("connectors.title")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("connectors.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {BANKS.map((bank) => (
          <div
            key={bank}
            className="rounded-2xl border border-border bg-card p-4 flex flex-col items-center gap-2"
          >
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground text-center">
              {bank}
            </p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t("connectors.comingSoon")}
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{t("connectors.hint")}</p>
    </div>
  )
}
