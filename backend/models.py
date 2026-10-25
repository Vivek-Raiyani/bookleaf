"""
SQLAlchemy ORM Models for BookLeaf.
"""
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text, 
    ForeignKey, JSON, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from database import Base


class UserRole(str, enum.Enum):
    author = "author"
    admin = "admin"


class TicketStatus(str, enum.Enum):
    open = "Open"
    in_progress = "In Progress"
    resolved = "Resolved"
    closed = "Closed"


class TicketCategory(str, enum.Enum):
    royalty_payments = "Royalty & Payments"
    isbn_metadata = "ISBN & Metadata Issues"
    printing_quality = "Printing & Quality"
    distribution = "Distribution & Availability"
    book_status = "Book Status & Production Updates"
    general = "General Inquiry"


class TicketPriority(str, enum.Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"


class BookStatus(str, enum.Enum):
    manuscript_received = "Manuscript Received"
    editing = "Editing"
    cover_design = "In Production - Cover Design"
    typesetting = "In Production - Typesetting"
    proofreading = "Proofreading"
    isbn_assignment = "ISBN Assignment"
    printing = "Printing"
    distribution_setup = "Distribution Setup"
    published = "Published & Live"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.author, nullable=False)
    phone = Column(String, nullable=True)
    city = Column(String, nullable=True)
    joined_date = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    books = relationship("Book", back_populates="author")
    tickets = relationship("Ticket", back_populates="author", foreign_keys="Ticket.author_id")
    assigned_tickets = relationship("Ticket", back_populates="assigned_admin", foreign_keys="Ticket.assigned_to")


class Book(Base):
    __tablename__ = "books"

    id = Column(String, primary_key=True, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    isbn = Column(String, nullable=True)
    genre = Column(String, nullable=True)
    publication_date = Column(String, nullable=True)
    status = Column(String, default="Manuscript Received", nullable=False)
    mrp = Column(Float, nullable=True)
    author_royalty_per_copy = Column(Float, nullable=True)
    total_copies_sold = Column(Integer, default=0)
    total_royalty_earned = Column(Float, default=0.0)
    royalty_paid = Column(Float, default=0.0)
    royalty_pending = Column(Float, default=0.0)
    last_royalty_payout_date = Column(String, nullable=True)
    print_partner = Column(String, nullable=True)
    available_on = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    author = relationship("User", back_populates="books")
    tickets = relationship("Ticket", back_populates="book")


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, index=True)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    book_id = Column(String, ForeignKey("books.id"), nullable=True)  # None = General/Account level
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(SAEnum(TicketStatus), default=TicketStatus.open, nullable=False)
    category = Column(SAEnum(TicketCategory), default=TicketCategory.general, nullable=True)
    priority = Column(SAEnum(TicketPriority), default=TicketPriority.medium, nullable=True)
    
    # AI fields
    ai_category = Column(SAEnum(TicketCategory), nullable=True)
    ai_priority = Column(SAEnum(TicketPriority), nullable=True)
    ai_classification_done = Column(Boolean, default=False)
    
    # Assignment
    assigned_to = Column(String, ForeignKey("users.id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    author = relationship("User", back_populates="tickets", foreign_keys=[author_id])
    book = relationship("Book", back_populates="tickets")
    assigned_admin = relationship("User", back_populates="assigned_tickets", foreign_keys=[assigned_to])
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan", order_by="TicketMessage.created_at")
    notes = relationship("InternalNote", back_populates="ticket", cascade="all, delete-orphan", order_by="InternalNote.created_at")


class TicketMessage(Base):
    """Visible messages between author and admin."""
    __tablename__ = "ticket_messages"

    id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey("tickets.id"), nullable=False)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False)
    sender_role = Column(SAEnum(UserRole), nullable=False)
    content = Column(Text, nullable=False)
    is_ai_draft = Column(Boolean, default=False)  # Track if message was AI-assisted
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="messages")
    sender = relationship("User")


class InternalNote(Base):
    """Internal admin-only notes on a ticket."""
    __tablename__ = "internal_notes"

    id = Column(String, primary_key=True, index=True)
    ticket_id = Column(String, ForeignKey("tickets.id"), nullable=False)
    author_id = Column(String, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="notes")
    author = relationship("User")
