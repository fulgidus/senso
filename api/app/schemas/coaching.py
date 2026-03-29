from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    persona_id: str = Field(default="mentore-saggio")
    locale: Literal["it", "en"] = Field(default="it")

    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Message cannot be empty or whitespace only")
        return stripped

    model_config = {"populate_by_name": True}


class ChatMessageDTO(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: Optional[datetime] = None
    # For role=="user": the user who sent the message.
    sender_id: Optional[str] = None
    # For role=="assistant": which persona was speaking.
    persona_id: Optional[str] = None

    model_config = {"populate_by_name": True}


class ReasoningStep(BaseModel):
    step: str
    detail: str

    model_config = {"populate_by_name": True}


class ActionCard(BaseModel):
    title: str
    description: str
    action_type: str
    cta_label: Optional[str] = None
    payload: Optional[dict] = None

    model_config = {"populate_by_name": True}


class ResourceCard(BaseModel):
    title: str
    summary: str
    resource_type: str
    url: Optional[str] = None
    estimated_read_minutes: Optional[int] = None

    model_config = {"populate_by_name": True}


class LearnCard(BaseModel):
    concept: str
    plain_explanation: str
    example: Optional[str] = None

    model_config = {"populate_by_name": True}


class CoachingResponseDTO(BaseModel):
    message: str
    reasoning_used: list[ReasoningStep] = Field(default_factory=list)
    action_cards: list[ActionCard] = Field(default_factory=list)
    resource_cards: list[ResourceCard] = Field(default_factory=list)
    learn_cards: list[LearnCard] = Field(default_factory=list)
    details_a2ui: Optional[str] = None
    session_id: str  # always returned - new or existing session
    debug: Optional[dict] = None  # only populated when LLM_DEBUG=true

    model_config = {"populate_by_name": True}


class SessionSummaryDTO(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    message_count: int
    last_message_preview: Optional[str] = None
    locale: str
    persona_id: str

    model_config = {"populate_by_name": True}


class RenameSessionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)

    model_config = {"populate_by_name": True}


class NameConversationRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)

    model_config = {"populate_by_name": True}


class NameConversationResponse(BaseModel):
    name: str

    model_config = {"populate_by_name": True}


class TTSConfig(BaseModel):
    fallback: Literal["browser", "none"] = "browser"
    browser_fallback_enabled: bool = Field(True, alias="browserFallbackEnabled")

    model_config = {"populate_by_name": True}


class PersonaThemeModeDTO(BaseModel):
    avatar_bg: str
    bubble_bg: str
    bubble_border: str

    model_config = {"populate_by_name": True}


class PersonaThemeDTO(BaseModel):
    light: PersonaThemeModeDTO
    dark: PersonaThemeModeDTO
    label_tone: str

    model_config = {"populate_by_name": True}


class PersonaDTO(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    available: bool = True
    tts: TTSConfig = Field(default_factory=TTSConfig)
    default_gender: str = Field(default="neutral", alias="defaultGender")
    theme: PersonaThemeDTO

    model_config = {"populate_by_name": True}


class WelcomeResponseDTO(BaseModel):
    message: str

    model_config = {"populate_by_name": True}
