"""Pydantic schemas for content item CRUD operations."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ContentItemCreate(BaseModel):
    """Schema for creating a new content item."""

    id: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=300)
    locale: str = Field(..., pattern=r"^(it|en)$")
    type: str = Field(..., pattern=r"^(article|video|slide_deck|partner_offer)$")
    title: str = Field(..., min_length=1, max_length=500)
    summary: str | None = None
    body: str | None = None
    topics: list[str] = Field(default_factory=list)
    metadata_: dict[str, Any] = Field(default_factory=dict, alias="metadata")
    is_published: bool = True
    localization_group: str | None = None
    reading_time_minutes: int | None = None
    duration_seconds: int | None = None

    model_config = ConfigDict(populate_by_name=True)


class ContentItemUpdate(BaseModel):
    """Schema for updating an existing content item (partial).

    Note: ``type`` is intentionally excluded — changing an item's type
    (e.g. article → video) is not a meaningful operation.
    """

    slug: str | None = None
    locale: str | None = Field(default=None, pattern=r"^(it|en)$")
    title: str | None = None
    summary: str | None = None
    body: str | None = None
    topics: list[str] | None = None
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")
    is_published: bool | None = None
    localization_group: str | None = Field(default=None)
    reading_time_minutes: int | None = None
    duration_seconds: int | None = None

    model_config = ConfigDict(populate_by_name=True)


class ContentItemDTO(BaseModel):
    """Schema for returning a content item to the client."""

    id: str
    slug: str
    locale: str
    type: str
    title: str
    summary: str | None
    body: str | None = None
    topics: list[str]
    metadata_: dict[str, Any] = Field(serialization_alias="metadata")
    is_published: bool
    localization_group: str | None = None
    reading_time_minutes: int | None = None
    duration_seconds: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response wrapper."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
