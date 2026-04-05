/**
 * MessagesPage — /messages route (Phase 15)
 * Shell placeholder — full implementation in Plan 15-04.
 */
import { useTranslation } from "react-i18next";

export function MessagesPage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("messages.loading")}</p>
    </main>
  );
}
