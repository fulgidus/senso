import { useTranslation } from "react-i18next"

type BalanceMaskProps = {
  value: string | number
  masked: boolean
  className?: string
}

export function BalanceMask({ value, masked, className }: BalanceMaskProps) {
  const { t } = useTranslation()

  if (masked) {
    return (
      <span className={className} aria-label={t("accessibility.balanceHidden")}>
        ****
      </span>
    )
  }

  return <span className={className}>{value}</span>
}
