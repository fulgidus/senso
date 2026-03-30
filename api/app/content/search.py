"""
Content search using in-process BM25 (rank_bm25).

Loads content from the database (ContentItem table). Falls back to static JSON
catalog files if the DB is empty or unavailable.

Locale filtering is applied BEFORE BM25 scoring — the LLM always gets
locale-matched results only.

Search syntax keywords (English only, no i18n):
    tag:budget          — filter results to items containing topic "budget"
    type:video          — filter results to items of type "video"
    from:2026-01-01     — filter results to items created on or after date
    to:2026-03-31       — filter results to items created on or before date

Keywords are extracted before BM25 scoring.  Remaining free text is scored
by BM25.  If no free text remains after extraction, all items matching
the structured filters are returned (sorted by created_at desc).
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from rank_bm25 import BM25Okapi  # type: ignore[import-untyped]

_CONTENT_DIR = Path(__file__).parent
logger = logging.getLogger(__name__)


# ── Data model ─────────────────────────────────────────────────────────────────


@dataclass
class SearchResult:
    id: str
    locale: str
    type: str
    title: str
    summary: str
    score: float
    slug: str | None = None
    topics: list[str] = field(default_factory=list)
    # type-specific extras passed through for rendering
    url: str | None = None
    video_id: str | None = None
    slide_count: int | None = None
    offer_type: str | None = None
    partner_name: str | None = None
    loan_params: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "locale": self.locale,
            "type": self.type,
            "title": self.title,
            "summary": self.summary,
            "score": round(self.score, 4),
        }
        if self.slug is not None:
            d["slug"] = self.slug
        if self.topics:
            d["topics"] = self.topics
        if self.url is not None:
            d["url"] = self.url
        if self.video_id is not None:
            d["video_id"] = self.video_id
        if self.slide_count is not None:
            d["slide_count"] = self.slide_count
        if self.offer_type is not None:
            d["offer_type"] = self.offer_type
        if self.partner_name is not None:
            d["partner_name"] = self.partner_name
        if self.loan_params is not None:
            d["loan_params"] = self.loan_params
        return d


# ── Search query parser ────────────────────────────────────────────────────────

# Regex: keyword:value (value may be quoted or unquoted)
_SYNTAX_RE = re.compile(
    r"""
    \b(tag|type|from|to)       # keyword
    :                          # separator
    (?:"([^"]*)"               # quoted value
    |(\S+))                    # unquoted value
    """,
    re.VERBOSE | re.IGNORECASE,
)

_VALID_TYPES = {"article", "video", "slide_deck", "partner_offer"}


@dataclass
class ParsedQuery:
    """Result of parsing a search string with structured syntax keywords."""

    free_text: str
    tags: list[str] = field(default_factory=list)
    content_types: list[str] = field(default_factory=list)
    date_from: date | None = None
    date_to: date | None = None


def parse_search_query(raw: str) -> ParsedQuery:
    """Parse structured search syntax from a raw query string.

    Extracts ``tag:``, ``type:``, ``from:``, ``to:`` keywords.
    Everything else is returned as ``free_text`` for BM25 scoring.
    """
    tags: list[str] = []
    content_types: list[str] = []
    date_from: date | None = None
    date_to: date | None = None

    def _replace(m: re.Match) -> str:  # type: ignore[type-arg]
        nonlocal date_from, date_to
        keyword = m.group(1).lower()
        value = (m.group(2) or m.group(3)).strip()
        if not value:
            return ""

        if keyword == "tag":
            tags.append(value.lower())
        elif keyword == "type":
            normalized = value.lower().replace("-", "_")
            if normalized in _VALID_TYPES:
                content_types.append(normalized)
        elif keyword == "from":
            try:
                date_from = date.fromisoformat(value)
            except ValueError:
                pass  # ignore unparseable dates, leave as free text
        elif keyword == "to":
            try:
                date_to = date.fromisoformat(value)
            except ValueError:
                pass
        return ""

    free_text = _SYNTAX_RE.sub(_replace, raw).strip()
    # Collapse multiple spaces
    free_text = re.sub(r"\s+", " ", free_text).strip()

    return ParsedQuery(
        free_text=free_text,
        tags=tags,
        content_types=content_types,
        date_from=date_from,
        date_to=date_to,
    )


# ── Tokenizer ──────────────────────────────────────────────────────────────────


def _tokenize(text: str) -> list[str]:
    """Lowercase, strip punctuation, split on whitespace."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return [t for t in text.split() if len(t) > 1]


# ── Catalog loaders ───────────────────────────────────────────────────────────


def _load_catalog_from_json() -> list[dict[str, Any]]:
    """Load content items from static JSON catalog files (original loader)."""
    items: list[dict[str, Any]] = []
    for fname in ("articles.json", "videos.json", "slides.json", "partners.json"):
        path = _CONTENT_DIR / fname
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            items.extend(raw)
    return items


def _load_catalog_from_db() -> list[dict[str, Any]]:
    """Load all published content items from the database."""
    from app.db.session import SessionLocal  # noqa: PLC0415
    from app.db.models import ContentItem  # noqa: PLC0415

    db = SessionLocal()
    try:
        rows = db.query(ContentItem).filter(ContentItem.is_published == True).all()  # noqa: E712
        items: list[dict[str, Any]] = []
        for row in rows:
            item: dict[str, Any] = {
                "id": row.id,
                "slug": getattr(row, "slug", None),
                "locale": row.locale,
                "type": row.type,
                "title": row.title,
                "summary": row.summary or "",
                "topics": row.topics or [],
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            # Merge type-specific metadata into top-level dict
            if row.metadata_:
                item.update(row.metadata_)
            items.append(item)
        return items
    finally:
        db.close()


def _item_to_searchable_text(item: dict[str, Any]) -> str:
    parts = [
        item.get("title", ""),
        item.get("summary", item.get("description", "")),
        " ".join(item.get("topics", [])),
        item.get("type", ""),
    ]
    return " ".join(p for p in parts if p)


def _item_to_result(item: dict[str, Any], score: float) -> SearchResult:
    return SearchResult(
        id=item["id"],
        locale=item.get("locale", "it"),
        type=item.get("type", "article"),
        title=item.get("title", ""),
        summary=item.get("summary", item.get("description", "")),
        score=score,
        slug=item.get("slug"),
        topics=item.get("topics", []),
        url=item.get("url"),
        video_id=item.get("video_id"),
        slide_count=item.get("slide_count"),
        offer_type=item.get("offer_type"),
        partner_name=item.get("partner_name"),
        loan_params=item.get("loan_params"),
    )


def _matches_structured_filters(
    item: dict[str, Any],
    parsed: ParsedQuery,
) -> bool:
    """Check if an item passes all structured filters from the parsed query."""
    # Tag filter: item must have ALL requested tags (case-insensitive)
    if parsed.tags:
        item_topics = {t.lower() for t in item.get("topics", [])}
        if not all(tag in item_topics for tag in parsed.tags):
            return False

    # Type filter
    if parsed.content_types:
        if item.get("type") not in parsed.content_types:
            return False

    # Date range filters
    if parsed.date_from or parsed.date_to:
        created_str = item.get("created_at")
        if not created_str:
            return False
        try:
            if isinstance(created_str, str):
                created = datetime.fromisoformat(created_str).date()
            elif isinstance(created_str, datetime):
                created = created_str.date()
            elif isinstance(created_str, date):
                created = created_str
            else:
                return False
        except (ValueError, AttributeError):
            return False

        if parsed.date_from and created < parsed.date_from:
            return False
        if parsed.date_to and created > parsed.date_to:
            return False

    return True


# ── Index ──────────────────────────────────────────────────────────────────────


class ContentIndex:
    """BM25 index over the full content catalog, locale-partitioned.

    Loads from the database first; falls back to static JSON if the DB is
    empty or unavailable.
    """

    def __init__(self) -> None:
        try:
            self._all_items = _load_catalog_from_db()
        except Exception:
            logger.debug("DB load failed, falling back to JSON catalogs.")
            self._all_items = _load_catalog_from_json()
        if not self._all_items:
            self._all_items = _load_catalog_from_json()
        # Build per-locale indexes
        self._locale_index: dict[str, tuple[list[dict[str, Any]], BM25Okapi]] = {}
        self._build_all_locales()

    def rebuild(self) -> None:
        """Reload content from DB and rebuild all locale indexes."""
        try:
            self._all_items = _load_catalog_from_db()
        except Exception:
            logger.debug(
                "DB load failed during rebuild, falling back to JSON catalogs."
            )
            self._all_items = _load_catalog_from_json()
        if not self._all_items:
            self._all_items = _load_catalog_from_json()
        self._locale_index.clear()
        self._build_all_locales()

    def _build_all_locales(self) -> None:
        locales = {item.get("locale", "it") for item in self._all_items}
        for locale in locales:
            items = [i for i in self._all_items if i.get("locale", "it") == locale]
            if not items:
                continue
            corpus = [_tokenize(_item_to_searchable_text(i)) for i in items]
            bm25 = BM25Okapi(corpus)
            self._locale_index[locale] = (items, bm25)

    def search(
        self,
        query: str,
        locale: str = "it",
        top_k: int = 5,
        content_types: list[str] | None = None,
    ) -> list[SearchResult]:
        """Search catalog items matching query in the given locale.

        Supports structured syntax: ``tag:``, ``type:``, ``from:``, ``to:``.
        Free text after syntax extraction is scored by BM25.

        The ``content_types`` parameter is a legacy filter — if the parsed query
        also contains ``type:`` keywords, both are merged (union).
        """
        parsed = parse_search_query(query)

        # Merge legacy content_types param with parsed type: filters
        if content_types:
            merged_types = list(set(parsed.content_types + content_types))
            parsed.content_types = merged_types

        if locale not in self._locale_index:
            return []

        items, bm25 = self._locale_index[locale]

        # If there's free text, score with BM25
        if parsed.free_text:
            tokens = _tokenize(parsed.free_text)
            if not tokens:
                # All free text was stop words / too short — fall through
                # to filter-only path
                return self._filter_only(items, parsed, top_k)

            scores = bm25.get_scores(tokens)
            ranked = sorted(
                ((score, item) for score, item in zip(scores, items) if score > 0),
                key=lambda x: x[0],
                reverse=True,
            )

            results: list[SearchResult] = []
            for score, item in ranked:
                if not _matches_structured_filters(item, parsed):
                    continue
                results.append(_item_to_result(item, score))
                if len(results) >= top_k:
                    break
            return results

        # No free text — return all items matching structured filters
        return self._filter_only(items, parsed, top_k)

    def _filter_only(
        self,
        items: list[dict[str, Any]],
        parsed: ParsedQuery,
        top_k: int,
    ) -> list[SearchResult]:
        """Return items matching structured filters only (no BM25 scoring)."""
        results: list[SearchResult] = []
        for item in items:
            if not _matches_structured_filters(item, parsed):
                continue
            results.append(_item_to_result(item, 0.0))
            if len(results) >= top_k:
                break
        return results

    def suggest(
        self,
        query: str,
        locale: str = "it",
        limit: int = 8,
    ) -> list[dict[str, Any]]:
        """Return lightweight suggestions for typeahead.

        Uses prefix matching on title tokens + BM25 fallback.  Returns
        minimal fields: id, slug, title, type.
        """
        if locale not in self._locale_index:
            return []

        items, bm25 = self._locale_index[locale]
        query_lower = query.lower().strip()
        if not query_lower:
            return []

        # Phase 1: prefix match on title words (fast, high-relevance)
        prefix_hits: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        for item in items:
            title_lower = item.get("title", "").lower()
            # Match if any word in the title starts with the query
            words = title_lower.split()
            if (
                any(w.startswith(query_lower) for w in words)
                or query_lower in title_lower
            ):
                if item["id"] not in seen_ids:
                    prefix_hits.append(item)
                    seen_ids.add(item["id"])
                    if len(prefix_hits) >= limit:
                        break

        # Phase 2: BM25 fallback to fill remaining slots
        if len(prefix_hits) < limit:
            tokens = _tokenize(query_lower)
            if tokens:
                scores = bm25.get_scores(tokens)
                ranked = sorted(
                    (
                        (score, item)
                        for score, item in zip(scores, items)
                        if score > 0 and item["id"] not in seen_ids
                    ),
                    key=lambda x: x[0],
                    reverse=True,
                )
                for _, item in ranked:
                    prefix_hits.append(item)
                    seen_ids.add(item["id"])
                    if len(prefix_hits) >= limit:
                        break

        return [
            {
                "id": item["id"],
                "slug": item.get("slug"),
                "title": item.get("title", ""),
                "type": item.get("type", "article"),
            }
            for item in prefix_hits
        ]

    def get_all_tags(self, locale: str | None = None) -> list[str]:
        """Return all unique topic tags, optionally filtered by locale."""
        tags: set[str] = set()
        for item in self._all_items:
            if locale and item.get("locale", "it") != locale:
                continue
            for topic in item.get("topics", []):
                tags.add(topic)
        return sorted(tags)

    def get_by_id(self, item_id: str) -> dict[str, Any] | None:
        for item in self._all_items:
            if item.get("id") == item_id:
                return item
        return None

    @property
    def total_items(self) -> int:
        return len(self._all_items)


# ── Singleton ──────────────────────────────────────────────────────────────────

_index: ContentIndex | None = None


def get_index() -> ContentIndex:
    global _index
    if _index is None:
        _index = ContentIndex()
    return _index


def rebuild_index() -> None:
    """Rebuild the singleton index from current DB state."""
    global _index
    if _index is not None:
        _index.rebuild()
    else:
        _index = ContentIndex()


def search_content(
    query: str,
    locale: str = "it",
    top_k: int = 5,
    content_types: list[str] | None = None,
) -> list[dict[str, Any]]:
    """
    Public search function. Returns list of dicts suitable for LLM tool response injection.
    """
    return [
        r.to_dict() for r in get_index().search(query, locale, top_k, content_types)
    ]


def suggest_content(
    query: str,
    locale: str = "it",
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Public suggestion function for typeahead. Returns lightweight results."""
    return get_index().suggest(query, locale, limit)


def get_all_tags(locale: str | None = None) -> list[str]:
    """Return all unique topic tags from the index."""
    return get_index().get_all_tags(locale)
