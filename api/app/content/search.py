"""
Content search using in-process BM25 (rank_bm25).

Loads content from the database (ContentItem table). Falls back to static JSON
catalog files if the DB is empty or unavailable.

Locale filtering is applied BEFORE BM25 scoring — the LLM always gets
locale-matched results only.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
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
    # type-specific extras passed through for rendering
    url: str | None = None
    video_id: str | None = None
    slide_count: int | None = None
    offer_type: str | None = None
    partner_name: str | None = None
    loan_params: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        d = {
            "id": self.id,
            "locale": self.locale,
            "type": self.type,
            "title": self.title,
            "summary": self.summary,
            "score": round(self.score, 4),
        }
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
                "locale": row.locale,
                "type": row.type,
                "title": row.title,
                "summary": row.summary or "",
                "topics": row.topics or [],
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
        url=item.get("url"),
        video_id=item.get("video_id"),
        slide_count=item.get("slide_count"),
        offer_type=item.get("offer_type"),
        partner_name=item.get("partner_name"),
        loan_params=item.get("loan_params"),
    )


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
        """
        Search catalog items matching query in the given locale.

        Args:
            query: natural language search query
            locale: locale to filter by (only items with matching locale are returned)
            top_k: maximum number of results
            content_types: if provided, only return items of these types
                           (e.g. ["article", "video", "slide_deck", "partner_offer"])
        """
        if locale not in self._locale_index:
            return []

        items, bm25 = self._locale_index[locale]
        tokens = _tokenize(query)
        if not tokens:
            return []

        scores = bm25.get_scores(tokens)
        ranked = sorted(
            ((score, item) for score, item in zip(scores, items) if score > 0),
            key=lambda x: x[0],
            reverse=True,
        )

        results: list[SearchResult] = []
        for score, item in ranked:
            if content_types and item.get("type") not in content_types:
                continue
            results.append(_item_to_result(item, score))
            if len(results) >= top_k:
                break

        return results

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
