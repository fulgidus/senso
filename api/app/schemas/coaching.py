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


class ContentCard(BaseModel):
    title: str
    card_type: str
    summary: Optional[str] = None
    url: Optional[str] = None
    estimated_read_minutes: Optional[int] = None
    video_id: Optional[str] = None
    slide_id: Optional[str] = None
    concept: Optional[str] = None
    plain_explanation: Optional[str] = None
    example: Optional[str] = None

    model_config = {"populate_by_name": True}


class InteractiveCard(BaseModel):
    title: str
    description: str
    action_type: str
    cta_label: Optional[str] = None
    payload: Optional[dict] = None

    model_config = {"populate_by_name": True}


class AffordabilityKeyFigure(BaseModel):
    label: str
    value: str

    model_config = {"populate_by_name": True}


class AffordabilityVerdict(BaseModel):
    verdict: str
    key_figures: list[AffordabilityKeyFigure] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class TransactionEvidenceRow(BaseModel):
    date: Optional[str] = None
    description: str
    amount: float

    model_config = {"populate_by_name": True}


class TransactionEvidence(BaseModel):
    transactions: list[TransactionEvidenceRow] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class GoalProgress(BaseModel):
    goal_name: str
    estimated_pct: int
    subtitle: str

    model_config = {"populate_by_name": True}


class CoachingResponseDTO(BaseModel):
    message: str
    reasoning_used: list[ReasoningStep] = Field(default_factory=list)
    content_cards: list[ContentCard] = Field(default_factory=list)
    interactive_cards: list[InteractiveCard] = Field(default_factory=list)
    details_a2ui: Optional[str] = None
    affordability_verdict: Optional[AffordabilityVerdict] = None
    transaction_evidence: Optional[TransactionEvidence] = None
    goal_progress: Optional[GoalProgress] = None
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
