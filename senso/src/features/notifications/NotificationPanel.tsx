/**
 * NotificationPanel.tsx — Dropdown notification list.
 *
 * Renders inside AppShell when bell is clicked.
 * Shows user notifications with type icons, unread styling, mark-read actions.
 */

import { useEffect, useState, useRef, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  Clock,
  ShieldOff,
  CheckCircle,
  RotateCcw,
  Bell,
} from "lucide-react"
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationDTO,
  type NotificationsListDTO,
} from "@/api/notificationsApi"
import { useNavigate } from "react-router-dom"

// ── Type icon map ─────────────────────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  switch (type) {
    case "moderation_warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
    case "moderation_timeout":
      return <Clock className="h-4 w-4 text-orange-500 shrink-0" />
    case "moderation_ban":
      return <ShieldOff className="h-4 w-4 text-destructive shrink-0" />
    case "appeal_confirmed":
      return <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
    case "appeal_reverted":
      return <RotateCcw className="h-4 w-4 text-primary shrink-0" />
    default:
      return <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
  }
}

// ── Relative time helper ──────────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "adesso"
  if (diffMin < 60) return `${diffMin} min fa`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} ore fa`
  const diffD = Math.floor(diffH / 24)
  return `${diffD} giorni fa`
}

// ── Props ─────────────────────────────────────────────────────────────────────

type NotificationPanelProps = {
  isOpen: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationPanel({ isOpen, onClose, onUnreadCountChange }: NotificationPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [data, setData] = useState<NotificationsListDTO | null>(null)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Load notifications when panel opens
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getNotifications(20)
      setData(result)
      onUnreadCountChange?.(result.unread_count)
    } catch {
      // fail silently — show empty state
      setData({ items: [], unread_count: 0 })
    } finally {
      setLoading(false)
    }
  }, [onUnreadCountChange])

  useEffect(() => {
    if (isOpen) {
      void load()
    }
  }, [isOpen, load])

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [isOpen, onClose])

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      await load()
    } catch {
      // ignore
    }
  }, [load])

  const handleClickNotif = useCallback(
    async (notif: NotificationDTO) => {
      if (!notif.is_read) {
        try {
          await markNotificationRead(notif.id)
          setData((prev) => {
            if (!prev) return prev
            const items = prev.items.map((n) =>
              n.id === notif.id ? { ...n, is_read: true } : n,
            )
            const unread_count = items.filter((n) => !n.is_read).length
            onUnreadCountChange?.(unread_count)
            return { items, unread_count }
          })
        } catch {
          // ignore
        }
      }
      if (notif.action_url) {
        onClose()
        void navigate(notif.action_url)
      }
    },
    [navigate, onClose, onUnreadCountChange],
  )

  if (!isOpen) return null

  const unreadCount = data?.unread_count ?? 0

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t("notifications.panelTitle")}
      className="absolute right-0 top-full mt-1 z-50 w-80 max-h-[480px] overflow-y-auto rounded-xl border border-border bg-background shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-background z-10">
        <h3 className="text-sm font-semibold text-foreground">
          {t("notifications.panelTitle")}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={() => void handleMarkAllRead()}
            className="text-sm text-primary hover:underline"
          >
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-4 py-3 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded bg-muted h-12" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <Bell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
        </div>
      )}

      {/* Notification list */}
      {!loading && data && data.items.length > 0 && (
        <ul>
          {data.items.map((notif) => (
            <li
              key={notif.id}
              onClick={() => void handleClickNotif(notif)}
              className={[
                "px-4 py-3 hover:bg-accent transition-colors cursor-pointer",
                !notif.is_read ? "border-l-2 border-primary bg-primary/5" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <NotifIcon type={notif.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground leading-snug">
                    {notif.title}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {notif.body}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {relativeTime(notif.created_at)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
