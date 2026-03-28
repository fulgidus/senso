import type { User } from "@/features/auth/types"
import { useTranslation } from "react-i18next"
import { getInitials } from "@/lib/user-avatar"

type UserAvatarProps = {
  user: User
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-16 w-16 text-2xl font-bold",
}

export function UserAvatar({ user, size = "md", className = "" }: UserAvatarProps) {
  const initials = getInitials(user)
  const sizeClass = SIZE_CLASSES[size]
  const { t } = useTranslation()

  return (
    <div
      className={[
        "shrink-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold select-none",
        sizeClass,
        className,
      ].join(" ")}
      aria-label={t("avatar.ariaLabel", { name: user.firstName || initials })}
    >
      {initials}
    </div>
  )
}
