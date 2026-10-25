"""
Tickets routes: author-facing ticket management.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from database import get_db
import models
import schemas
import auth as auth_utils
from services import ai_service

router = APIRouter()


def _build_ticket_out(ticket: models.Ticket) -> schemas.TicketOut:
    """Convert a Ticket ORM object to TicketOut schema."""
    messages = []
    for msg in ticket.messages:
        messages.append(schemas.TicketMessageOut(
            id=msg.id,
            ticket_id=msg.ticket_id,
            sender_id=msg.sender_id,
            sender_role=msg.sender_role,
            sender_name=msg.sender.name if msg.sender else None,
            content=msg.content,
            is_ai_draft=msg.is_ai_draft,
            created_at=msg.created_at,
        ))

    notes = []
    for note in ticket.notes:
        notes.append(schemas.InternalNoteOut(
            id=note.id,
            ticket_id=note.ticket_id,
            author_id=note.author_id,
            author_name=note.author.name if note.author else None,
            content=note.content,
            created_at=note.created_at,
        ))

    return schemas.TicketOut(
        id=ticket.id,
        author_id=ticket.author_id,
        author_name=ticket.author.name if ticket.author else None,
        author_email=ticket.author.email if ticket.author else None,
        book_id=ticket.book_id,
        book_title=ticket.book.title if ticket.book else None,
        subject=ticket.subject,
        description=ticket.description,
        status=ticket.status,
        category=ticket.category,
        priority=ticket.priority,
        ai_category=ticket.ai_category,
        ai_priority=ticket.ai_priority,
        ai_classification_done=ticket.ai_classification_done,
        assigned_to=ticket.assigned_to,
        assigned_admin_name=ticket.assigned_admin.name if ticket.assigned_admin else None,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        resolved_at=ticket.resolved_at,
        messages=messages,
        notes=notes,
    )


def _classify_ticket_background(ticket_id: str):
    """Background task to classify a ticket after creation."""
    from database import SessionLocal
    db = SessionLocal()
    try:
        ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
        if not ticket:
            return

        category, priority, reasoning = ai_service.classify_ticket(
            ticket.subject, ticket.description
        )

        ticket.ai_category = category
        ticket.ai_priority = priority
        # Set the actual category/priority from AI if not yet set
        ticket.category = category
        ticket.priority = priority
        ticket.ai_classification_done = True
        db.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Background classification error: {e}")
    finally:
        db.close()


@router.post(
    "",
    response_model=schemas.TicketOut,
    status_code=201,
    summary="Submit a new support ticket",
)
@router.post(
    "/",
    response_model=schemas.TicketOut,
    status_code=201,
    include_in_schema=False,
)
def create_ticket(
    request: schemas.TicketCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(auth_utils.get_current_author),
    db: Session = Depends(get_db),
):
    """
    Submit a new support ticket. AI classification runs in the background
    after the ticket is created, so the response is immediate.
    
    - `book_id`: Optional. Leave null for General/Account Level queries.
    - `subject`: Brief description (5-200 chars)
    - `description`: Full details of the issue
    """
    # Validate book belongs to this author
    if request.book_id:
        book = db.query(models.Book).filter(
            models.Book.id == request.book_id,
            models.Book.author_id == current_user.id,
        ).first()
        if not book:
            raise HTTPException(status_code=404, detail="Book not found or not owned by you")

    ticket = models.Ticket(
        id=str(uuid.uuid4()),
        author_id=current_user.id,
        book_id=request.book_id,
        subject=request.subject,
        description=request.description,
        status=models.TicketStatus.open,
        category=models.TicketCategory.general,
        priority=models.TicketPriority.medium,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    # Fire-and-forget classification — ticket creation is never blocked by AI
    background_tasks.add_task(_classify_ticket_background, ticket.id)

    # Reload with relationships
    ticket = db.query(models.Ticket).options(
        joinedload(models.Ticket.author),
        joinedload(models.Ticket.book),
        joinedload(models.Ticket.messages).joinedload(models.TicketMessage.sender),
        joinedload(models.Ticket.notes).joinedload(models.InternalNote.author),
        joinedload(models.Ticket.assigned_admin),
    ).filter(models.Ticket.id == ticket.id).first()

    return _build_ticket_out(ticket)


@router.get(
    "",
    response_model=List[schemas.TicketListItem],
    summary="Get all tickets for the current author",
)
@router.get(
    "/",
    response_model=List[schemas.TicketListItem],
    include_in_schema=False,
)
def get_my_tickets(
    current_user: models.User = Depends(auth_utils.get_current_author),
    db: Session = Depends(get_db),
):
    """Returns all support tickets submitted by the authenticated author."""
    tickets = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.author),
            joinedload(models.Ticket.book),
            joinedload(models.Ticket.assigned_admin),
            joinedload(models.Ticket.messages),
        )
        .filter(models.Ticket.author_id == current_user.id)
        .order_by(models.Ticket.created_at.desc())
        .all()
    )

    result = []
    for t in tickets:
        result.append(schemas.TicketListItem(
            id=t.id,
            author_id=t.author_id,
            author_name=t.author.name if t.author else None,
            author_email=t.author.email if t.author else None,
            book_id=t.book_id,
            book_title=t.book.title if t.book else None,
            subject=t.subject,
            status=t.status,
            category=t.category,
            priority=t.priority,
            ai_classification_done=t.ai_classification_done,
            assigned_to=t.assigned_to,
            assigned_admin_name=t.assigned_admin.name if t.assigned_admin else None,
            created_at=t.created_at,
            updated_at=t.updated_at,
            message_count=len(t.messages),
        ))
    return result


@router.get(
    "/{ticket_id}",
    response_model=schemas.TicketOut,
    summary="Get a specific ticket with full conversation",
)
def get_ticket(
    ticket_id: str,
    current_user: models.User = Depends(auth_utils.get_current_author),
    db: Session = Depends(get_db),
):
    """
    Returns full ticket details including the conversation thread.
    Authors can only access their own tickets.
    """
    query = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.author),
            joinedload(models.Ticket.book),
            joinedload(models.Ticket.messages).joinedload(models.TicketMessage.sender),
            joinedload(models.Ticket.notes).joinedload(models.InternalNote.author),
            joinedload(models.Ticket.assigned_admin),
        )
        .filter(models.Ticket.id == ticket_id)
    )

    # Authors can only see their own tickets
    if current_user.role == models.UserRole.author:
        query = query.filter(models.Ticket.author_id == current_user.id)

    ticket = query.first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return _build_ticket_out(ticket)


@router.get(
    "/{ticket_id}/poll",
    response_model=schemas.TicketOut,
    summary="Poll ticket for updates (for real-time simulation)",
)
def poll_ticket(
    ticket_id: str,
    current_user: models.User = Depends(auth_utils.get_current_author),
    db: Session = Depends(get_db),
):
    """
    Same as GET /{ticket_id} — used by the frontend for polling-based 
    real-time updates. Returns current ticket state with all messages.
    """
    return get_ticket(ticket_id, current_user, db)
