import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { ChatScreen } from "@/features/coaching/ChatScreen";
import { createProfileApi } from "@/lib/profile-api";
import { createCoachingApi, sendMessage, renameSession } from "@/features/coaching/coachingApi";
import { fetchContentItemBySlug, type ContentItemDTO } from "@/features/content/contentApi";
import { useAuthContext } from "@/features/auth/AuthContext";
import { readAccessToken } from "@/features/auth/storage";

// ── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
    </main>
  );
}

// ── Profile-ready gate ───────────────────────────────────────────────────────
// Runs once at the /chat/* level. Checks that the profile is confirmed
// before allowing any chat child route to render.

function useProfileReady(): { ready: boolean; checking: boolean } {
  const token = readAccessToken();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { onUnauthorized } = useAuthContext();
  const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized]);
  const [state, setState] = useState<"checking" | "ready" | "rejected">("checking");

  useEffect(() => {
    if (!token) {
      setState("rejected");
      return;
    }
    let cancelled = false;
    profileApi
      .getProfile(token)
      .then((profile) => {
        if (cancelled) return;
        if (profile?.confirmed) {
          setState("ready");
        } else {
          navigate("/", { replace: true, state: { toast: t("app.profileRequired") } });
          setState("rejected");
        }
      })
      .catch(() => {
        if (cancelled) return;
        navigate("/", { replace: true, state: { toast: t("app.profileRequired") } });
        setState("rejected");
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate, t]);

  return { ready: state === "ready", checking: state === "checking" };
}

// ── Session resolver (index route) ───────────────────────────────────────────
// /chat → sessions.length > 0 → /chat/{lastSessionId}; else → /chat/new

function SessionResolver() {
  const [target, setTarget] = useState<string | null>(null);
  const { onUnauthorized } = useAuthContext();
  const coachingApi = useMemo(() => createCoachingApi(onUnauthorized), [onUnauthorized]);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    coachingApi
      .listSessions()
      .then((sessions) => {
        if (sessions.length > 0) {
          // Sessions are sorted by updated_at desc - first is most recent
          setTarget(`/chat/${sessions[0].id}`);
        } else {
          setTarget("/chat/new");
        }
      })
      .catch(() => {
        // On error, go to new chat
        setTarget("/chat/new");
      });
  }, [coachingApi]);

  if (!target) return <LoadingScreen />;
  return <Navigate to={target} replace />;
}

// ── /chat/new ────────────────────────────────────────────────────────────────

function NewChatPage() {
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? "en" : "it";
  const navigate = useNavigate();

  return (
    <ChatScreen
      forceNew
      onNavigateBack={() => history.back()}
      locale={locale}
      onSessionCreated={(id) => navigate(`/chat/${id}`, { replace: true })}
    />
  );
}

// ── /chat/:sessionId ─────────────────────────────────────────────────────────

function SessionChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { i18n } = useTranslation();
  const locale = i18n.language.startsWith("en") ? "en" : "it";

  if (!sessionId) return <Navigate to="/chat/new" replace />;

  return (
    <ChatScreen
      key={sessionId}
      onNavigateBack={() => history.back()}
      locale={locale}
      sessionId={sessionId}
    />
  );
}

// ── /chat/about/:slug ────────────────────────────────────────────────────────
// Builds an enriched first message from the content item and auto-sends it.

function buildContentMessage(item: ContentItemDTO, locale: "it" | "en"): string {
  const typeLabels: Record<string, { it: string; en: string }> = {
    article: { it: "Articolo", en: "Article" },
    video: { it: "Video", en: "Video" },
    slide_deck: { it: "Presentazione", en: "Slide deck" },
    partner_offer: { it: "Offerta partner", en: "Partner offer" },
  };
  const typeLabel = typeLabels[item.type]?.[locale] ?? item.type;
  const topicsStr = item.topics.length > 0 ? item.topics.join(", ") : null;

  if (locale === "en") {
    const parts: string[] = [`I just found this resource: "${item.title}"`];
    if (item.summary) parts.push(`\n${item.summary}`);
    const meta: string[] = [`Type: ${typeLabel}`];
    if (topicsStr) meta.push(`Topics: ${topicsStr}`);
    parts.push(`\n${meta.join(" | ")}`);
    parts.push(
      "\nCan you help me understand how this applies to my financial situation? What should I do concretely?",
    );
    return parts.join("\n");
  }

  const parts: string[] = [`Ho appena trovato questa risorsa: «${item.title}»`];
  if (item.summary) parts.push(`\n${item.summary}`);
  const meta: string[] = [`Tipo: ${typeLabel}`];
  if (topicsStr) meta.push(`Argomenti: ${topicsStr}`);
  parts.push(`\n${meta.join(" | ")}`);
  parts.push(
    "\nPuoi aiutarmi a capire come si applica alla mia situazione finanziaria? Cosa dovrei fare concretamente?",
  );
  return parts.join("\n");
}

function AboutChatPage() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const locale = i18n.language.startsWith("en") ? "en" : "it";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      navigate("/chat/new", { replace: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // 1. Fetch content item (public endpoint, no auth)
        const item = await fetchContentItemBySlug(decodeURIComponent(slug));
        if (cancelled) return;

        // 2. Build enriched message
        const message = buildContentMessage(item, locale);

        // 3. Send first chat message → creates new session
        const personaId = user?.defaultPersonaId ?? "mentore-saggio";
        const response = await sendMessage(message, locale, personaId);
        if (cancelled) return;

        const sessionId = response.session_id;
        if (!sessionId) throw new Error("no session_id in response");

        // 4. Rename session to content title (fire-and-forget)
        void renameSession(sessionId, item.title).catch(() => {
          /* ignore */
        });

        // 5. Navigate to the new session — replace so back goes to /learn
        navigate(`/chat/${sessionId}`, { replace: true });
      } catch {
        if (cancelled) return;
        setError("load_failed");
        // Brief delay so user can see the error before redirect
        setTimeout(() => navigate("/chat/new", { replace: true }), 1500);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, locale, navigate, user]);

  // Error state — brief flash before redirect to /chat/new
  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          {locale === "it" ? "Caricamento contenuto..." : "Loading content..."}
        </p>
      </main>
    );
  }

  // Loading state while fetching + sending
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        {locale === "it" ? "Avvio conversazione…" : "Starting conversation…"}
      </p>
    </main>
  );
}

// ── ChatRoutes subrouter ─────────────────────────────────────────────────────

export function ChatRoutes() {
  const { ready, checking } = useProfileReady();

  if (checking) return <LoadingScreen />;
  if (!ready) return null; // redirect already fired by hook

  return (
    <Routes>
      <Route index element={<SessionResolver />} />
      <Route path="new" element={<NewChatPage />} />
      <Route path="about/:slug" element={<AboutChatPage />} />
      <Route path=":sessionId" element={<SessionChatPage />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
