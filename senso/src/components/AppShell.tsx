import { useState, useEffect, useRef, useCallback } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { Home, User, MessageCircle, Settings, LogOut, X, Menu } from "lucide-react"
import { useAuthContext } from "@/features/auth/AuthContext"
import { UserAvatar } from "@/components/UserAvatar"
import { getDisplayName } from "@/lib/user-avatar"

// ── SensoLogo ────────────────────────────────────────────────────────────────

function SensoLogo() {
  const [imgFailed, setImgFailed] = useState(false)
  if (!imgFailed) {
    return (
      <img
        src="/assets/logo.svg"
        alt="SENSO"
        className="h-7 w-auto"
        onError={() => setImgFailed(true)}
      />
    )
  }
  return <span className="font-bold tracking-tight text-foreground">S.E.N.S.O.</span>
}

// ── Nav items ─────────────────────────────────────────────────────────────────

type NavItem = {
  to: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: <Home className="h-5 w-5" /> },
  { to: "/profile", label: "Profilo", icon: <User className="h-5 w-5" /> },
  { to: "/chat", label: "Coach", icon: <MessageCircle className="h-5 w-5" /> },
  { to: "/settings", label: "Impostazioni", icon: <Settings className="h-5 w-5" /> },
]

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

// Compact top-bar link (icon only when short, icon+label when space is available)
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

// ── AppShell ──────────────────────────────────────────────────────────────────

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuthContext()
  const [open, setOpen] = useState(false)
  const [showTopNav, setShowTopNav] = useState(false)
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLElement>(null)
  const navContainerRef = useRef<HTMLDivElement>(null)

  // Responsive nav: use ResizeObserver to show inline nav when top bar has room
  useEffect(() => {
    const bar = topBarRef.current
    if (!bar) return

    // We need to measure whether there's enough room for all nav links.
    // We measure the nav container's scrollWidth vs clientWidth.
    const observer = new ResizeObserver(() => {
      const nav = navContainerRef.current
      if (!nav) return
      // Make nav visible temporarily to measure its natural width
      const parentWidth = bar.clientWidth
      // Logo ~120px, user area ~180px, hamburger ~48px, padding ~32px
      const reservedWidth = 380
      setShowTopNav(parentWidth - reservedWidth > 0)
    })

    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  // Close drawer on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // Close drawer on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  const handleSignOut = useCallback(async () => {
    setOpen(false)
    await signOut()
  }, [signOut])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top bar */}
      <header
        ref={topBarRef}
        className="sticky top-0 z-30 flex h-14 shrink-0 items-center border-b border-border bg-background px-4 gap-2"
      >
        {/* Hamburger — always shown; hides drawer when top nav is visible but keeps it accessible */}
        <button
          aria-label="Apri menu"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Logo */}
        <div className="shrink-0">
          <SensoLogo />
        </div>

        {/* Inline nav — only rendered/shown when there's room */}
        <div
          ref={navContainerRef}
          className={["flex items-center gap-1 ml-4", showTopNav ? "flex" : "hidden"].join(" ")}
        >
          {NAV_ITEMS.map((item) => (
            <TopBarNavLink key={item.to} item={item} />
          ))}
        </div>

        {/* Right side: user info */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="hidden text-xs text-muted-foreground sm:block">
            {getDisplayName(user)}
          </span>
          <UserAvatar user={user} size="sm" />
        </div>
      </header>

      {/* Sidebar overlay */}
      {open && (
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
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigazione"
      >
        {/* Sidebar header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <SensoLogo />
          <button
            aria-label="Chiudi menu"
            onClick={() => setOpen(false)}
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

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} item={item} onClick={() => setOpen(false)} />
          ))}
        </nav>

        {/* Footer — Logout only (Settings is already in NAV_ITEMS above) */}
        <div className="border-t border-border px-3 py-4">
          <button
            onClick={() => void handleSignOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Esci</span>
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
