"""
Content search using in-process BM25 (rank_bm25).

Indexes all catalog items (articles, videos, slides, partners) at module load time.
Exposes search(query, locale, top_k) -> list[SearchResult].

Locale filtering is applied BEFORE BM25 scoring — the LLM always gets
locale-matched results only.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rank_bm25 import BM25Okapi  # type: ignore[import-untyped]

_CONTENT_DIR = Path(__file__).parent


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


# ── Catalog loader ─────────────────────────────────────────────────────────────


def _load_catalog() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for fname in ("articles.json", "videos.json", "slides.json", "partners.json"):
        path = _CONTENT_DIR / fname
        if path.exists():
            raw = json.loads(path.read_text(encoding="utf-8"))
            items.extend(raw)
    return items


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
    """BM25 index over the full content catalog, locale-partitioned."""

    def __init__(self) -> None:
        self._all_items = _load_catalog()
        # Build per-locale indexes lazily on first access
        self._locale_index: dict[str, tuple[list[dict[str, Any]], BM25Okapi]] = {}
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
