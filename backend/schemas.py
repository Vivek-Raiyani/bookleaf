"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from models import UserRole, TicketStatus, TicketCategory, TicketPriority


# ─── Auth Schemas ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str
    name: str


class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None


# ─── User Schemas ─────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.author
    phone: Optional[str] = None
    city: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserOut(UserBase):
    id: str
    joined_date: Optional[str] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AdminOut(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole

    class Config:
        from_attributes = True


# ─── Book Schemas ─────────────────────────────────────────────────────────────

class BookOut(BaseModel):
    id: str
    author_id: str
    title: str
    isbn: Optional[str] = None
    genre: Optional[str] = None
    publication_date: Optional[str] = None
    status: str
    mrp: Optional[float] = None
    author_royalty_per_copy: Optional[float] = None
    total_copies_sold: int = 0
    total_royalty_earned: float = 0.0
    royalty_paid: float = 0.0
    royalty_pending: float = 0.0
    last_royalty_payout_date: Optional[str] = None
    print_partner: Optional[str] = None
    available_on: List[str] = []

    class Config:
        from_attributes = True


# ─── Ticket Schemas ───────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    book_id: Optional[str] = None  # None = General/Account level
    subject: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10)


class TicketMessageOut(BaseModel):
    id: str
    ticket_id: str
    sender_id: str
    sender_role: UserRole
    sender_name: Optional[str] = None
    content: str
    is_ai_draft: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class InternalNoteOut(BaseModel):
    id: str
    ticket_id: str
    author_id: str
    author_name: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: str
    author_id: str
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    book_id: Optional[str] = None
    book_title: Optional[str] = None
    subject: str
    description: str
    status: TicketStatus
    category: Optional[TicketCategory] = None
    priority: Optional[TicketPriority] = None
    ai_category: Optional[TicketCategory] = None
    ai_priority: Optional[TicketPriority] = None
    ai_classification_done: bool = False
    assigned_to: Optional[str] = None
    assigned_admin_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    messages: List[TicketMessageOut] = []
    notes: List[InternalNoteOut] = []

    class Config:
        from_attributes = True


class TicketListItem(BaseModel):
    """Lightweight ticket for list views."""
    id: str
    author_id: str
    author_name: Optional[str] = None
    author_email: Optional[str] = None
    book_id: Optional[str] = None
    book_title: Optional[str] = None
    subject: str
    status: TicketStatus
    category: Optional[TicketCategory] = None
    priority: Optional[TicketPriority] = None
    ai_classification_done: bool = False
    assigned_to: Optional[str] = None
    assigned_admin_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    message_count: int = 0

    class Config:
        from_attributes = True


# ─── Admin Update Schemas ─────────────────────────────────────────────────────

class TicketStatusUpdate(BaseModel):
    status: TicketStatus


class TicketCategoryUpdate(BaseModel):
    category: TicketCategory


class TicketPriorityUpdate(BaseModel):
    priority: TicketPriority


class TicketAssignUpdate(BaseModel):
    admin_id: str


class AdminReplyCreate(BaseModel):
    content: str = Field(..., min_length=1)
    is_ai_draft: bool = False


class InternalNoteCreate(BaseModel):
    content: str = Field(..., min_length=1)


# ─── AI Schemas ───────────────────────────────────────────────────────────────

class AIClassificationResult(BaseModel):
    category: TicketCategory
    priority: TicketPriority
    reasoning: str


class AIDraftResponse(BaseModel):
    draft: str
    model_used: str
    tokens_used: Optional[int] = None
    fallback: bool = False  # True if AI was unavailable


# ─── Pagination ───────────────────────────────────────────────────────────────

class PaginatedTickets(BaseModel):
    items: List[TicketListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
