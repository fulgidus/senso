/**
 * ContentDetailPage - public /learn/:slug page for viewing a single content item.
 *
 * No authentication required. Renders type-specific content:
 * - article: summary + external link
 * - video: YouTube iframe embed
 * - slide_deck: MarpSlideViewer (if in SLIDE_INDEX) or placeholder
 * - partner_offer: partner info + CTA button
 *
 * B2: Uses slug-based lookup (fetchContentItemBySlug).
 * B3: Redirects to /learn with toast on 404.
 * B4: "Discuss with coach" CTA links to /chat/about/:slug.
 * C5: Topics are clickable, linking to /learn/t/:tag.
 */

import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  fetchContentItemBySlug,
  fetchLocalizationSiblings,
  type ContentItemDTO,
} from "./contentApi";
import { MarpSlideViewer } from "../coaching/MarpSlideViewer";

// ── Type badge colours (same as browse page) ─────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  article: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300" },
  video: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300" },
  slide_deck: {
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
  },
  partner_offer: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
  },
};

const TYPE_ICON: Record<string, string> = {
  article: "📄",
  video: "🎬",
  slide_deck: "📊",
  partner_offer: "🤝",
};

const TYPE_LABELS: Record<string, string> = {
  article: "Articles",
  video: "Videos",
  slide_deck: "Slides",
  partner_offer: "Partners",
};

// ── Component ────────────────────────────────────────────────────────────────

export function ContentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [item, setItem] = useState<ContentItemDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // E2: Localization siblings for language switcher
  const [siblings, setSiblings] = useState<ContentItemDTO[]>([]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setSiblings([]);
    fetchContentItemBySlug(slug)
      .then((fetchedItem) => {
        setItem(fetchedItem);
        // E2: Fetch localization siblings if item is in a group
        if (fetchedItem.localization_group) {
          fetchLocalizationSiblings(fetchedItem.id)
            .then(setSiblings)
            .catch(() => setSiblings([]));
        }
      })
      .catch(() => {
        setError("not_found");
        // B3: Redirect to /learn after a brief delay so the user sees the toast
        setTimeout(() => {
          navigate("/learn", { replace: true, state: { toast: t("content.notFoundRedirect") } });
        }, 100);
      })
      .finally(() => setLoading(false));
  }, [slug, navigate, t]);

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Error / not found - fallback UI while redirect fires
  if (error || !item) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-background">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <p className="mb-4 text-lg text-muted-foreground">{t("content.noResults")}</p>
          <Link to="/learn" className="text-sm font-medium text-primary hover:underline">
            ← {t("content.backToList")}
          </Link>
        </div>
      </div>
    );
  }

  const badge = TYPE_BADGE[item.type] || TYPE_BADGE.article;
  const icon = TYPE_ICON[item.type] || "📄";
  const typeLabel = TYPE_LABELS[item.type] || "Articles";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Back link */}
        <Link
          to="/learn"
          className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {t("content.backToList")}
        </Link>

        {/* Type badge */}
        <div className="mb-4 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${badge.bg} ${badge.text}`}
          >
            <span>{icon}</span>
            {t(`content.filter${typeLabel}`)}
          </span>
          {/* Reading time / duration meta */}
          {item.type === "article" && item.reading_time_minutes && (
            <span className="text-xs text-muted-foreground">
              {t("content.readingMinutes", { minutes: item.reading_time_minutes })}
            </span>
          )}
          {item.type === "video" && item.duration_seconds && (
            <span className="text-xs text-muted-foreground">
              {t("content.durationMinutes", { minutes: Math.ceil(item.duration_seconds / 60) })}
            </span>
          )}
        </div>

        {/* E2: Language switcher for localization siblings */}
        {siblings.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {t("content.availableIn")}:
            </span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase text-primary">
              {item.locale}
            </span>
            {siblings.map((sib) => (
              <Link
                key={sib.id}
                to={`/learn/${encodeURIComponent(sib.slug)}`}
                className="rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {sib.locale}
              </Link>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="mb-4 text-3xl font-bold text-foreground">{item.title}</h1>

        {/* Summary */}
        {item.summary && (
          <p className="mb-6 text-lg text-muted-foreground leading-relaxed">{item.summary}</p>
        )}

        {/* Topics - clickable, link to /learn/t/:tag */}
        {item.topics.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("content.topics")}:
            </span>
            {item.topics.map((topic) => (
              <Link
                key={topic}
                to={`/learn/t/${encodeURIComponent(topic)}`}
                className="rounded-md bg-muted px-2.5 py-1 text-sm text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {topic}
              </Link>
            ))}
          </div>
        )}

        {/* Type-specific content */}
        <div className="mt-6">
          {item.type === "article" && <ArticleDetail item={item} />}
          {item.type === "video" && <VideoDetail item={item} />}
          {item.type === "slide_deck" && <SlideDetail item={item} />}
          {item.type === "partner_offer" && <PartnerDetail item={item} />}
        </div>

        {/* B4: "Discuss with coach" CTA */}
        <div className="mt-8 border-t border-border pt-6">
          <Link
            to={`/chat/about/${encodeURIComponent(item.slug)}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("content.discussWithCoach")} →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Article detail ───────────────────────────────────────────────────────────

function ArticleDetail({ item }: { item: ContentItemDTO }) {
  const { t } = useTranslation();
  const md = item.metadata;
  const url = md.url as string | undefined;
  // Prefer top-level field, fall back to metadata
  const readMinutes =
    item.reading_time_minutes ?? (md.estimated_read_minutes as number | undefined);

  return (
    <div className="space-y-4">
      {readMinutes && (
        <p className="text-sm text-muted-foreground">
          {t("content.readingMinutes", { minutes: readMinutes })}
        </p>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("content.readMore")} ↗
        </a>
      )}
    </div>
  );
}

// ── Video detail ─────────────────────────────────────────────────────────────

function VideoDetail({ item }: { item: ContentItemDTO }) {
  const md = item.metadata;
  const videoId = md.video_id as string | undefined;

  if (!videoId) {
    return <p className="text-sm text-muted-foreground">Video not available.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        className="aspect-video w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={item.title}
      />
    </div>
  );
}

// ── Slide deck detail ────────────────────────────────────────────────────────

function SlideDetail({ item }: { item: ContentItemDTO }) {
  const { t } = useTranslation();
  const md = item.metadata;
  const slideCount = md.slide_count as number | undefined;

  return (
    <div className="space-y-4">
      {slideCount && (
        <p className="text-sm text-muted-foreground">
          {t("content.slides", { count: slideCount })}
        </p>
      )}
      <MarpSlideViewer slideId={item.id} title={item.title} />
    </div>
  );
}

// ── Partner offer detail ─────────────────────────────────────────────────────

function PartnerDetail({ item }: { item: ContentItemDTO }) {
  const md = item.metadata;
  const partnerName = md.partner_name as string | undefined;
  const description = md.description as string | undefined;
  const ctaLabel = md.cta_label as string | undefined;
  const ctaUrl = md.cta_url as string | undefined;
  const offerType = md.offer_type as string | undefined;
  const logoInitial = md.partner_logo_initial as string | undefined;

  return (
    <div className="card-glow p-6">
      {/* Partner header */}
      <div className="mb-4 flex items-center gap-3">
        {logoInitial && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-lg font-bold text-amber-700 dark:text-amber-300">
            {logoInitial}
          </div>
        )}
        <div>
          {partnerName && <h3 className="text-lg font-semibold text-foreground">{partnerName}</h3>}
          {offerType && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              {offerType}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {description && <p className="mb-4 text-muted-foreground leading-relaxed">{description}</p>}

      {/* CTA */}
      {ctaUrl && (
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          {ctaLabel || "Learn more"} ↗
        </a>
      )}
    </div>
  );
}

export default ContentDetailPage;
