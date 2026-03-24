import type { User } from "@/features/auth/types"
import { IngestionScreen } from "@/features/ingestion/IngestionScreen"

type AuthedHomeProps = {
  user: User
  onSignOut: () => Promise<void>
}

export function AuthedHome({ user, onSignOut }: AuthedHomeProps) {
  return <IngestionScreen user={user} onSignOut={onSignOut} />
}
