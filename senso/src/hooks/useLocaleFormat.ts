import { useTranslation } from "react-i18next"
import { useMemo } from "react"

export function useLocaleFormat() {
  const { i18n } = useTranslation()
  const locale = i18n.language

  return useMemo(() => ({
    currency: (value: number, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
        ...opts,
      }).format(value),

    number: (value: number, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, opts).format(value),

    percent: (value: number, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
        ...opts,
      }).format(value),

    date: (value: string | Date, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, opts).format(
        typeof value === "string" ? new Date(value) : value
      ),
  }), [locale])
}
