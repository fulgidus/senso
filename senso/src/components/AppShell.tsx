import { useState, useEffect, useRef } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { Home, User, MessageCircle, Settings, LogOut, X, Menu } from "lucide-react"
import { useAuthContext } from "@/features/auth/AuthContext"

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

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { user, signOut } = useAuthContext()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Close on outside click
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

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
  }

  const handleSettings = () => {
    setOpen(false)
    void navigate("/settings")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background px-4">
        <button
          aria-label="Apri menu"
          onClick={() => setOpen(true)}
          className="mr-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold tracking-tight text-foreground">S.E.N.S.O.</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:block">{user.email}</span>
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
          <span className="font-bold tracking-tight text-foreground">S.E.N.S.O.</span>
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm select-none">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground">Account</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} item={item} onClick={() => setOpen(false)} />
          ))}
        </nav>

        {/* Footer actions */}
        <div className="border-t border-border px-3 py-4 space-y-1">
          <button
            onClick={handleSettings}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="h-5 w-5" />
            <span>Impostazioni</span>
          </button>
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
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
