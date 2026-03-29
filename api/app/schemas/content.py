"""Pydantic schemas for content item CRUD operations."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ContentItemCreate(BaseModel):
    """Schema for creating a new content item."""

    id: str = Field(..., min_length=1, max_length=200)
    locale: str = Field(..., pattern=r"^(it|en)$")
    type: str = Field(..., pattern=r"^(article|video|slide_deck|partner_offer)$")
    title: str = Field(..., min_length=1, max_length=500)
    summary: str | None = None
    topics: list[str] = Field(default_factory=list)
    metadata_: dict[str, Any] = Field(default_factory=dict, alias="metadata")
    is_published: bool = True

    model_config = ConfigDict(populate_by_name=True)


class ContentItemUpdate(BaseModel):
    """Schema for updating an existing content item (partial)."""

    title: str | None = None
    summary: str | None = None
    topics: list[str] | None = None
    metadata_: dict[str, Any] | None = Field(default=None, alias="metadata")
    is_published: bool | None = None

    model_config = ConfigDict(populate_by_name=True)


class ContentItemDTO(BaseModel):
    """Schema for returning a content item to the client."""

    id: str
    locale: str
    type: str
    title: str
    summary: str | None
    topics: list[str]
    metadata_: dict[str, Any] = Field(alias="metadata")
    is_published: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
