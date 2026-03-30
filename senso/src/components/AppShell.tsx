import { useState, useEffect, useRef, useCallback } from "react"
import { NavLink, useNavigate, Link } from "react-router-dom"
import { User, MessageCircle, Settings, LogOut, X, Menu, Globe, ChevronDown, ShieldCheck, BookOpen, Bell } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthContext } from "@/features/auth/AuthContext"
import { UserAvatar } from "@/components/UserAvatar"
import { getDisplayName } from "@/lib/user-avatar"
import { NotificationPanel } from "@/features/notifications/NotificationPanel"
import { getNotifications } from "@/api/notificationsApi"

// ── Topbar-buttons preference (localStorage, no backend needed) ───────────────

const TOPBAR_STORAGE_KEY = "senso:topbarButtons"

export function readTopbarButtons(): boolean {
  try {
    return localStorage.getItem(TOPBAR_STORAGE_KEY) !== "false"
  } catch {
    return true
  }
}

export function writeTopbarButtons(value: boolean) {
  try {
    localStorage.setItem(TOPBAR_STORAGE_KEY, value ? "true" : "false")
  } catch { /* ignore */ }
}

// ── SensoLogo ─────────────────────────────────────────────────────────────────
// Shows /assets/logo-light.svg on light theme, /assets/logo-dark.svg on dark.
// Falls back to text if both fail.

function SensoLogo() {
  const [lightFailed, setLightFailed] = useState(false)
  const [darkFailed, setDarkFailed] = useState(false)

  return (
    <>
      {/* light-mode logo */}
      {!lightFailed && (
        <img
          src="/assets/logo-light.svg"
          alt="S.E.N.S.O."
          className="h-7 w-auto block dark:hidden"
          onError={() => setLightFailed(true)}
        />
      )}
      {/* dark-mode logo */}
      {!darkFailed && (
        <img
          src="/assets/logo-dark.svg"
          alt="S.E.N.S.O."
          className="h-7 w-auto hidden dark:block"
          onError={() => setDarkFailed(true)}
        />
      )}
      {/* text fallback — only shows if both images fail */}
      {(lightFailed && darkFailed) && (
        <span className="font-bold tracking-tight text-foreground">S.E.N.S.O.</span>
      )}
    </>
  )
}

// ── Nav items ─────────────────────────────────────────────────────────────────

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
}

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        [
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        ].join(" ")
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  )
}

// Compact top-bar link (icon + label)
function TopBarNavLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        [
          "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        ].join(" ")
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  )
}

// ── LanguageSwitcher ──────────────────────────────────────────────────────────

function LanguageSwitcher() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Build the list dynamically from loaded resources: each locale labels itself
  const langs = Object.keys(i18n.store.data).map((code) => ({
    code,
    label: i18n.getResourceBundle(code, "translation")?.nav?.languageFullName as string ?? code,
  }))

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={t("nav.languageMenuLabel")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Globe className="h-4 w-4" />
        <span className="text-xs font-medium uppercase hidden sm:inline">{i18n.language.slice(0, 2)}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-xl border border-border bg-background shadow-lg py-1"
        >
          {langs.map((lang) => (
            <button
              key={lang.code}
              role="menuitem"
              onClick={() => { void i18n.changeLanguage(lang.code); setOpen(false) }}
              className={[
                "w-full text-left px-4 py-2 text-sm transition-colors",
                i18n.language.startsWith(lang.code)
                  ? "text-foreground font-semibold bg-accent"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              ].join(" ")}
            >
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── UserMenu ──────────────────────────────────────────────────────────────────
// Dropdown from avatar: Settings + Logout

type UserMenuProps = {
  showEmail?: boolean
}

function UserMenu({ showEmail = false }: UserMenuProps) {
  const { user, signOut } = useAuthContext()
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  const handleSignOut = useCallback(async () => {
    setOpen(false)
    await signOut()
  }, [signOut])

  const handleSettings = useCallback(() => {
    setOpen(false)
    void navigate("/settings")
  }, [navigate])

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={t("nav.userMenuLabel")}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1 hover:bg-accent transition-colors"
      >
        {showEmail ? (
          <div className="hidden md:flex flex-col items-end min-w-0">
            <span className="text-xs font-medium text-foreground leading-tight truncate max-w-[160px]">
              {getDisplayName(user)}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[160px]">
              {user.email}
            </span>
          </div>
        ) : (
          <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[120px]">
            {getDisplayName(user)}
          </span>
        )}
        <UserAvatar user={user} size="sm" />
        <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-xl border border-border bg-background shadow-lg py-1"
        >
          <button
            role="menuitem"
            onClick={handleSettings}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="h-4 w-4 shrink-0" />
            {t("nav.settings")}
          </button>
          <div className="my-1 border-t border-border" />
          <button
            role="menuitem"
            onClick={() => void handleSignOut()}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t("nav.logout")}
          </button>
        </div>
      )}
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuthContext()
  const { t } = useTranslation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [topbarButtons, setTopbarButtons] = useState(readTopbarButtons)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // ── Notification bell state ──
  const [notifOpen, setNotifOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchUnread = useCallback(() => {
    getNotifications(1)
      .then((r) => setUnreadCount(r.unread_count))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 30_000)
    return () => clearInterval(interval)
  }, [fetchUnread])

  // Expose setter so SettingsScreen can update it live
  ;(window as unknown as Record<string, unknown>)["__sensoSetTopbarButtons"] = (v: boolean) => {
    writeTopbarButtons(v)
    setTopbarButtons(v)
  }

  const NAV_ITEMS: NavItem[] = [
    { to: "/profile", label: t("nav.profile"), icon: <User className="h-5 w-5" /> },
    { to: "/chat", label: t("nav.coach"), icon: <MessageCircle className="h-5 w-5" /> },
    { to: "/learn", label: t("nav.learn"), icon: <BookOpen className="h-5 w-5" /> },
  ]

  // Admin-only nav items
  if (user.isAdmin) {
    NAV_ITEMS.push({
      to: "/admin/content",
      label: t("nav.adminContent"),
      icon: <ShieldCheck className="h-5 w-5" />,
    })
    NAV_ITEMS.push({
      to: "/admin/merchant-map",
      label: t("admin.merchantMap.title"),
      icon: <ShieldCheck className="h-5 w-5" />,
    })
    NAV_ITEMS.push({
      to: "/admin/moderation",
      label: t("admin.moderation.title"),
      icon: <ShieldCheck className="h-5 w-5" />,
    })
  }

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return
    function handleClick(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setDrawerOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [drawerOpen])

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [drawerOpen])

  const handleSignOut = useCallback(async () => {
    setDrawerOpen(false)
    await signOut()
  }, [signOut])

  // Hamburger is shown:
  //   - always on mobile (< md)
  //   - on desktop only when topbarButtons is OFF
  const hamburgerClass = topbarButtons
    ? "flex md:hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    : "flex shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-background px-4 gap-2">

        {/* Hamburger */}
        <button
          aria-label={t("nav.openMenu")}
          onClick={() => setDrawerOpen(true)}
          className={hamburgerClass}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo — clickable, goes to / */}
        <NavLink
          to="/"
          end
          aria-label="S.E.N.S.O. — Home"
          className="shrink-0 flex items-center"
        >
          <SensoLogo />
        </NavLink>

        {/* Inline nav — only on md+ when topbarButtons is ON */}
        {topbarButtons && (
          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV_ITEMS.map((item) => (
              <TopBarNavLink key={item.to} item={item} />
            ))}
          </nav>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* Notification bell */}
          <div className="relative">
            <button
              aria-label={
                unreadCount > 0
                  ? t("notifications.bellAriaLabel_other", { count: unreadCount })
                  : t("notifications.bellAriaLabel_zero")
              }
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-accent-foreground"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <NotificationPanel
              isOpen={notifOpen}
              onClose={() => setNotifOpen(false)}
              onUnreadCountChange={setUnreadCount}
            />
          </div>
          <LanguageSwitcher />
          <UserMenu showEmail={topbarButtons} />
        </div>
      </header>

      {/* Sidebar overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      {/* Sidebar drawer */}
      <div
        ref={sidebarRef}
        className={[
          "fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-background border-r border-border shadow-xl transition-transform duration-200",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        {...(drawerOpen ? { role: "dialog", "aria-modal": "true", "aria-label": t("nav.menuLabel") } : {})}
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <SensoLogo />
          <button
            aria-label={t("nav.closeMenu")}
            onClick={() => setDrawerOpen(false)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User badge */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {getDisplayName(user)}
              </p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>

        {/* Nav items (all routes including Settings) */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {[...NAV_ITEMS, { to: "/settings", label: t("nav.settings"), icon: <Settings className="h-5 w-5" /> }].map((item) => (
            <NavItemLink key={item.to} item={item} onClick={() => setDrawerOpen(false)} />
          ))}
        </nav>

        {/* Footer - Logout */}
        <div className="border-t border-border px-3 py-4">
          <button
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

// ── PublicShell ───────────────────────────────────────────────────────────────
// Lightweight shell for unauthenticated /learn visitors.
// Shows: logo + language switcher + login CTA. No sidebar, no user menu.

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-background px-4 gap-2">
        {/* Logo — clickable, goes to /learn for public visitors */}
        <NavLink
          to="/learn"
          aria-label="S.E.N.S.O. — Learn"
          className="shrink-0 flex items-center"
        >
          <SensoLogo />
        </NavLink>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <LanguageSwitcher />
          <Link
            to="/"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t("nav.loginCta")}
          </Link>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
