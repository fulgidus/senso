import {
    Bell,
    BookOpen,
    Bug,
    ChevronDown,
    FileText,
    Flag,
    Globe,
    LogOut,
    Mail,
    MapPin,
    Menu,
    MessageCircle,
    Settings,
    ShieldCheck,
    User,
    X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getNotifications } from "@/api/notificationsApi";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PageTransition } from "@/components/PageTransition";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuthContext } from "@/features/auth/AuthContext";
import { NotificationPanel } from "@/features/notifications/NotificationPanel";
import { getDisplayName, stripUsernamePrefix } from "@/lib/user-avatar";

// ── Topbar-buttons preference (localStorage, no backend needed) ───────────────

const TOPBAR_STORAGE_KEY = "senso:topbarButtons";

export function readTopbarButtons(): boolean {
    try {
        return localStorage.getItem(TOPBAR_STORAGE_KEY) !== "false";
    } catch {
        return true;
    }
}

export function writeTopbarButtons(value: boolean) {
    try {
        localStorage.setItem(TOPBAR_STORAGE_KEY, value ? "true" : "false");
    } catch {
        /* ignore */
    }
}

// ── SensoLogo ─────────────────────────────────────────────────────────────────
// Shows /assets/logo-light.svg on light theme, /assets/logo-dark.svg on dark.
// Falls back to text if both fail.

function SensoLogo() {
    const [lightFailed, setLightFailed] = useState(false);
    const [darkFailed, setDarkFailed] = useState(false);

    return (
        <>
            {/* light-mode logo */}
            {!lightFailed && (
                <img
                    src="/assets/logo-light.svg"
                    alt="S.E.N.S.O."
                    className="block h-7 w-auto dark:hidden"
                    onError={() => setLightFailed(true)}
                />
            )}
            {/* dark-mode logo */}
            {!darkFailed && (
                <img
                    src="/assets/logo-dark.svg"
                    alt="S.E.N.S.O."
                    className="hidden h-7 w-auto dark:block"
                    onError={() => setDarkFailed(true)}
                />
            )}
            {/* text fallback - only shows if both images fail */}
            {lightFailed && darkFailed && (
                <span className="font-bold tracking-tight text-foreground">S.E.N.S.O.</span>
            )}
        </>
    );
}

// ── Nav items ─────────────────────────────────────────────────────────────────

type NavItem = {
    to: string;
    label: string;
    icon: React.ReactNode;
};

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
    return (
        <NavLink
            to={item.to}
            end={item.to === "/"}
            onClick={onClick}
            className={({ isActive }) =>
                [
                    "ripple-target flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                ].join(" ")
            }
        >
            {item.icon}
            <span>{item.label}</span>
        </NavLink>
    );
}

// Compact top-bar link (icon + label)
function TopBarNavLink({ item }: { item: NavItem }) {
    return (
        <NavLink
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
                [
                    "ripple-target flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                ].join(" ")
            }
        >
            {item.icon}
            <span>{item.label}</span>
        </NavLink>
    );
}

// ── LanguageSwitcher ──────────────────────────────────────────────────────────

function LanguageSwitcher() {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Build the list dynamically from loaded resources: each locale labels itself
    const langs = Object.keys(i18n.store.data).map((code) => ({
        code,
        label: (i18n.getResourceBundle(code, "translation")?.nav?.languageFullName as string) ?? code,
    }));

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                aria-label={t("nav.languageMenuLabel")}
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
                <Globe className="h-4 w-4" />
                <span className="hidden text-xs font-medium uppercase sm:inline">
                    {i18n.language.slice(0, 2)}
                </span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute top-full right-0 z-50 mt-1 min-w-[120px] rounded-xl border border-border bg-background py-1 shadow-lg"
                >
                    {langs.map((lang) => (
                        <button
                            key={lang.code}
                            role="menuitem"
                            onClick={() => {
                                void i18n.changeLanguage(lang.code);
                                setOpen(false);
                            }}
                            className={[
                                "w-full px-4 py-2 text-left text-sm transition-colors",
                                i18n.language.startsWith(lang.code)
                                    ? "bg-accent font-semibold text-foreground"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                            ].join(" ")}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── UserMenu ──────────────────────────────────────────────────────────────────
// Dropdown from avatar: Settings + Logout

type UserMenuProps = {
    showEmail?: boolean;
};

function UserMenu({ showEmail = false }: UserMenuProps) {
    const { user, signOut } = useAuthContext();
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handle(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [open]);

    const handleSignOut = useCallback(async () => {
        setOpen(false);
        await signOut();
    }, [signOut]);

    const handleSettings = useCallback(() => {
        setOpen(false);
        void navigate("/settings");
    }, [navigate]);

    return (
        <div ref={ref} className="relative">
            <button
                aria-label={t("nav.userMenuLabel")}
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-accent"
            >
                {showEmail ? (
                    <div className="hidden min-w-0 flex-col items-end md:flex">
                        <span className="max-w-[160px] truncate text-xs leading-tight font-medium text-foreground">
                            {getDisplayName(user)}
                        </span>
                        <span className="max-w-[160px] truncate text-[10px] leading-tight text-muted-foreground">
                            {user.username ? stripUsernamePrefix(user.username) : user.email}
                        </span>
                    </div>
                ) : (
                    <span className="hidden max-w-[120px] truncate text-xs text-muted-foreground sm:block">
                        {getDisplayName(user)}
                    </span>
                )}
                <UserAvatar user={user} size="sm" />
                <ChevronDown className="hidden h-3 w-3 text-muted-foreground sm:block" />
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute top-full right-0 z-50 mt-1 min-w-[160px] rounded-xl border border-border bg-background py-1 shadow-lg"
                >
                    <button
                        role="menuitem"
                        onClick={handleSettings}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <Settings className="h-4 w-4 shrink-0" />
                        {t("nav.settings")}
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button
                        role="menuitem"
                        onClick={() => void handleSignOut()}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                        <LogOut className="h-4 w-4 shrink-0" />
                        {t("nav.logout")}
                    </button>
                </div>
            )}
        </div>
    );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

type AppShellProps = {
    children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
    const { user, signOut, pendingMessageCount } = useAuthContext();
    const { t } = useTranslation();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [topbarButtons, setTopbarButtons] = useState(readTopbarButtons);
    const [adminOpen, setAdminOpen] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    // ── Notification bell state ──
    const [notifOpen, setNotifOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnread = useCallback(() => {
        getNotifications(1)
            .then((r) => setUnreadCount(r.unread_count))
            .catch(() => { });
    }, []);

    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, 30_000);
        return () => clearInterval(interval);
    }, [fetchUnread]);

    // Expose setter so SettingsScreen can update it live
    (window as unknown as Record<string, unknown>)["__sensoSetTopbarButtons"] = (v: boolean) => {
        writeTopbarButtons(v);
        setTopbarButtons(v);
    };

    const NAV_ITEMS: NavItem[] = [
        {
            to: "/profile",
            label: t("nav.profile"),
            icon: <User className="h-5 w-5" />,
        },
        {
            to: "/chat",
            label: t("nav.coach"),
            icon: <MessageCircle className="h-5 w-5" />,
        },
        {
            to: "/messages",
            label: t("nav.messages"),
            icon: (
                <span className="relative">
                    <Mail className="h-5 w-5" />
                    {pendingMessageCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {pendingMessageCount > 9 ? "9+" : pendingMessageCount}
                        </span>
                    )}
                </span>
            ),
        },
        {
            to: "/learn",
            label: t("nav.learn"),
            icon: <BookOpen className="h-5 w-5" />,
        },
    ];

    // Close drawer on outside click
    useEffect(() => {
        if (!drawerOpen) return;
        function handleClick(e: MouseEvent) {
            if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
                setDrawerOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [drawerOpen]);

    // Close drawer on Escape
    useEffect(() => {
        if (!drawerOpen) return;
        function handleKey(e: KeyboardEvent) {
            if (e.key === "Escape") setDrawerOpen(false);
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [drawerOpen]);

    const handleSignOut = useCallback(async () => {
        setDrawerOpen(false);
        await signOut();
    }, [signOut]);

    // Hamburger is shown:
    //   - always on mobile (< md)
    //   - on desktop only when topbarButtons is OFF
    const hamburgerClass = topbarButtons
        ? "flex md:hidden shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        : "flex shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors";

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* Top bar */}
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
                {/* Hamburger */}
                <button
                    aria-label={t("nav.openMenu")}
                    onClick={() => setDrawerOpen(true)}
                    className={hamburgerClass}
                >
                    <Menu className="h-5 w-5" />
                </button>

                {/* Logo - clickable, goes to / */}
                <NavLink to="/" end aria-label="S.E.N.S.O. - Home" className="flex shrink-0 items-center">
                    <SensoLogo />
                </NavLink>

                {/* Inline nav - only on md+ when topbarButtons is ON */}
                {topbarButtons && (
                    <nav className="ml-4 hidden items-center gap-1 md:flex">
                        {NAV_ITEMS.map((item) => (
                            <TopBarNavLink key={item.to} item={item} />
                        ))}
                    </nav>
                )}

                {/* Right side */}
                <div className="ml-auto flex shrink-0 items-center gap-2">
                    {/* Notification bell */}
                    <div className="relative">
                        <button
                            aria-label={
                                unreadCount > 0
                                    ? t("notifications.bellAriaLabel_other", {
                                        count: unreadCount,
                                    })
                                    : t("notifications.bellAriaLabel_zero")
                            }
                            onClick={() => setNotifOpen((o) => !o)}
                            className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                            <Bell className="h-5 w-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
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

            <OfflineBanner />

            {/* Sidebar overlay */}
            <div
                className={[
                    "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
                    drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
                ].join(" ")}
                aria-hidden="true"
            />

            {/* Sidebar drawer */}
            <div
                ref={sidebarRef}
                className={[
                    "fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-r border-border bg-background shadow-xl transition-transform duration-200 ease-out",
                    drawerOpen ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
                {...(drawerOpen
                    ? {
                        role: "dialog",
                        "aria-modal": "true",
                        "aria-label": t("nav.menuLabel"),
                    }
                    : {})}
            >
                {/* Sidebar header */}
                <div className="flex h-14 items-center justify-between border-b border-border px-4">
                    <SensoLogo />
                    <button
                        aria-label={t("nav.closeMenu")}
                        onClick={() => setDrawerOpen(false)}
                        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* User badge */}
                <div className="border-b border-border px-4 py-4">
                    <div className="flex items-center gap-3">
                        <UserAvatar user={user} size="md" />
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{getDisplayName(user)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                                {user.username ? stripUsernamePrefix(user.username) : user.email}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Nav items (all routes including Settings) */}
                <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
                    {[
                        ...NAV_ITEMS,
                        {
                            to: "/settings",
                            label: t("nav.settings"),
                            icon: <Settings className="h-5 w-5" />,
                        },
                    ].map((item) => (
                        <NavItemLink key={item.to} item={item} onClick={() => setDrawerOpen(false)} />
                    ))}

                    {/* Admin submenu - collapsible, admin-only */}
                    {user.isAdmin && (
                        <div>
                            <button
                                type="button"
                                onClick={() => setAdminOpen((o) => !o)}
                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                aria-expanded={adminOpen}
                            >
                                <ShieldCheck className="h-5 w-5 shrink-0" />
                                <span className="flex-1 text-left">{t("nav.adminSection")}</span>
                                <ChevronDown
                                    className={["h-4 w-4 transition-transform", adminOpen ? "rotate-180" : ""].join(
                                        " ",
                                    )}
                                />
                            </button>
                            {adminOpen && (
                                <div className="mt-1 space-y-1 pl-4">
                                    <NavItemLink
                                        item={{
                                            to: "/admin/content",
                                            label: t("nav.adminContent"),
                                            icon: <FileText className="h-4 w-4" />,
                                        }}
                                        onClick={() => setDrawerOpen(false)}
                                    />
                                    <NavItemLink
                                        item={{
                                            to: "/admin/merchant-map",
                                            label: t("admin.merchantMap.title"),
                                            icon: <MapPin className="h-4 w-4" />,
                                        }}
                                        onClick={() => setDrawerOpen(false)}
                                    />
                                    <NavItemLink
                                        item={{
                                            to: "/admin/moderation",
                                            label: t("admin.moderation.title"),
                                            icon: <Flag className="h-4 w-4" />,
                                        }}
                                        onClick={() => setDrawerOpen(false)}
                                    />
                                    <NavItemLink
                                        item={{
                                            to: "/debug",
                                            label: t("nav.debug"),
                                            icon: <Bug className="h-4 w-4" />,
                                        }}
                                        onClick={() => setDrawerOpen(false)}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </nav>

                {/* Footer - Logout */}
                <div className="border-t border-border px-3 py-4">
                    <button
                        onClick={() => void handleSignOut()}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                        <LogOut className="h-5 w-5" />
                        <span>{t("nav.logout")}</span>
                    </button>
                </div>
            </div>

            {/* Page content */}
            <div className="flex-1 overflow-y-auto">
                <PageTransition>{children}</PageTransition>
            </div>
        </div>
    );
}

// ── PublicShell ───────────────────────────────────────────────────────────────
// Lightweight shell for unauthenticated /learn visitors.
// Shows: logo + language switcher + login CTA. No sidebar, no user menu.

export function PublicShell({ children }: { children: React.ReactNode }) {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* Top bar */}
            <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
                {/* Logo - clickable, goes to /learn for public visitors */}
                <NavLink to="/learn" aria-label="S.E.N.S.O. - Learn" className="flex shrink-0 items-center">
                    <SensoLogo />
                </NavLink>

                {/* Right side */}
                <div className="ml-auto flex shrink-0 items-center gap-3">
                    <LanguageSwitcher />
                    <Link
                        to="/"
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        {t("nav.loginCta")}
                    </Link>
                </div>
            </header>

            {/* Page content */}
            <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
    );
}
