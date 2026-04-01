import { useOnlineStatus } from "@/hooks/useOnlineStatus"
import { useTranslation } from "react-i18next"
import { WifiOff } from "lucide-react"

export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const { t } = useTranslation()

  if (isOnline) return null

  return (
    <div
      role="alert"
      className="fixed top-14 left-0 right-0 z-[35] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
      {t("app.offlineBanner")}
    </div>
  )
}
