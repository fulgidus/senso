import { useTranslation } from "react-i18next";
import { useMemo } from "react";

export function useLocaleFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;

  return useMemo(
    () => ({
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

      date: (value: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
        if (!value) return "—"; // em-dash for missing dates
        const date = typeof value === "string" ? new Date(value) : value;
        const time = date.getTime?.() ?? NaN;
        // Guard against invalid, infinite, or zero/epoch dates from backend
        if (isNaN(time) || !isFinite(time) || time <= 0) return "—";
        return new Intl.DateTimeFormat(locale, opts).format(date);
      },
    }),
    [locale],
  );
}
