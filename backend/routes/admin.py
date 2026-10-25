"""
Admin routes: full ticket management, author overview, internal notes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from database import get_db
import models
import schemas
import auth as auth_utils
from routes.tickets import _build_ticket_out

router = APIRouter()


def _ticket_to_list_item(t: models.Ticket) -> schemas.TicketListItem:
    return schemas.TicketListItem(
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
        message_count=len(t.messages) if t.messages else 0,
    )


# ─── Ticket Queue ─────────────────────────────────────────────────────────────

@router.get(
    "/tickets",
    response_model=schemas.PaginatedTickets,
    summary="Get all tickets with filters (admin only)",
)
def get_all_tickets(
    status: Optional[str] = Query(None, description="Filter by status"),
    category: Optional[str] = Query(None, description="Filter by category"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    assigned_to_me: bool = Query(False, description="Show only tickets assigned to me"),
    search: Optional[str] = Query(None, description="Search in subject/description"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Returns paginated list of all tickets across all authors.
    Supports filtering by status, category, priority, assignment, and text search.
    Sorted by priority (Critical first) then oldest first (to surface urgent + stale tickets).
    """
    query = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.author),
            joinedload(models.Ticket.book),
            joinedload(models.Ticket.assigned_admin),
            joinedload(models.Ticket.messages),
        )
    )

    # Filters
    if status:
        try:
            status_enum = models.TicketStatus(status)
            query = query.filter(models.Ticket.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    if category:
        try:
            cat_enum = models.TicketCategory(category)
            query = query.filter(models.Ticket.category == cat_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

    if priority:
        try:
            pri_enum = models.TicketPriority(priority)
            query = query.filter(models.Ticket.priority == pri_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {priority}")

    if assigned_to_me:
        query = query.filter(models.Ticket.assigned_to == current_user.id)

    if search:
        query = query.filter(
            or_(
                models.Ticket.subject.ilike(f"%{search}%"),
                models.Ticket.description.ilike(f"%{search}%"),
            )
        )

    # Priority ordering: Critical → High → Medium → Low → oldest first
    priority_order = {
        models.TicketPriority.critical: 0,
        models.TicketPriority.high: 1,
        models.TicketPriority.medium: 2,
        models.TicketPriority.low: 3,
    }
    total = query.count()
    tickets = (
        query
        .order_by(models.Ticket.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Sort in Python to apply priority ordering
    priority_rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    tickets.sort(key=lambda t: (priority_rank.get(t.priority.value if t.priority else "Low", 3), t.created_at))

    return schemas.PaginatedTickets(
        items=[_ticket_to_list_item(t) for t in tickets],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get(
    "/tickets/{ticket_id}",
    response_model=schemas.TicketOut,
    summary="Get full ticket detail (admin only)",
)
def get_ticket_detail(
    ticket_id: str,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """Returns full ticket with all messages and internal notes."""
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.author),
            joinedload(models.Ticket.book),
            joinedload(models.Ticket.messages).joinedload(models.TicketMessage.sender),
            joinedload(models.Ticket.notes).joinedload(models.InternalNote.author),
            joinedload(models.Ticket.assigned_admin),
        )
        .filter(models.Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _build_ticket_out(ticket)


# ─── Ticket Updates ───────────────────────────────────────────────────────────

@router.patch(
    "/tickets/{ticket_id}/status",
    response_model=schemas.TicketOut,
    summary="Update ticket status (admin only)",
)
def update_ticket_status(
    ticket_id: str,
    request: schemas.TicketStatusUpdate,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    ticket.status = request.status
    if request.status in (models.TicketStatus.resolved, models.TicketStatus.closed):
        ticket.resolved_at = datetime.now(timezone.utc)
    
    db.commit()
    return get_ticket_detail(ticket_id, current_user, db)


@router.patch(
    "/tickets/{ticket_id}/category",
    response_model=schemas.TicketOut,
    summary="Override ticket category (admin only)",
)
def update_ticket_category(
    ticket_id: str,
    request: schemas.TicketCategoryUpdate,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """Admin can override the AI-assigned category."""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.category = request.category
    db.commit()
    return get_ticket_detail(ticket_id, current_user, db)


@router.patch(
    "/tickets/{ticket_id}/priority",
    response_model=schemas.TicketOut,
    summary="Override ticket priority (admin only)",
)
def update_ticket_priority(
    ticket_id: str,
    request: schemas.TicketPriorityUpdate,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """Admin can override the AI-assigned priority."""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.priority = request.priority
    db.commit()
    return get_ticket_detail(ticket_id, current_user, db)


@router.patch(
    "/tickets/{ticket_id}/assign",
    response_model=schemas.TicketOut,
    summary="Assign ticket to an admin (admin only)",
)
def assign_ticket(
    ticket_id: str,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """Assign the ticket to the currently logged-in admin."""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.assigned_to = current_user.id
    if ticket.status == models.TicketStatus.open:
        ticket.status = models.TicketStatus.in_progress
    db.commit()
    return get_ticket_detail(ticket_id, current_user, db)


@router.patch(
    "/tickets/{ticket_id}/unassign",
    response_model=schemas.TicketOut,
    summary="Unassign a ticket (admin only)",
)
def unassign_ticket(
    ticket_id: str,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket.assigned_to = None
    db.commit()
    return get_ticket_detail(ticket_id, current_user, db)


# ─── Messaging ────────────────────────────────────────────────────────────────

@router.post(
    "/tickets/{ticket_id}/reply",
    response_model=schemas.TicketOut,
    summary="Send a reply to the author (admin only)",
)
def reply_to_ticket(
    ticket_id: str,
    request: schemas.AdminReplyCreate,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Send a visible reply to the author. If the ticket was Open, auto-moves to In Progress.
    Mark `is_ai_draft: true` if this response was generated by AI (for tracking).
    """
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    message = models.TicketMessage(
        id=str(uuid.uuid4()),
        ticket_id=ticket_id,
        sender_id=current_user.id,
        sender_role=models.UserRole.admin,
        content=request.content,
        is_ai_draft=request.is_ai_draft,
    )
    db.add(message)

    # Auto-progress status
    if ticket.status == models.TicketStatus.open:
        ticket.status = models.TicketStatus.in_progress
    if not ticket.assigned_to:
        ticket.assigned_to = current_user.id

    db.commit()
    return get_ticket_detail(ticket_id, current_user, db)


# ─── Internal Notes ───────────────────────────────────────────────────────────

@router.post(
    "/tickets/{ticket_id}/notes",
    response_model=schemas.TicketOut,
    summary="Add an internal note (admin only, not visible to author)",
)
def add_internal_note(
    ticket_id: str,
    request: schemas.InternalNoteCreate,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """Adds a private internal note visible only to admins."""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    note = models.InternalNote(
        id=str(uuid.uuid4()),
        ticket_id=ticket_id,
        author_id=current_user.id,
        content=request.content,
    )
    db.add(note)
    db.commit()
    return get_ticket_detail(ticket_id, current_user, db)


# ─── Authors Overview ─────────────────────────────────────────────────────────

@router.get(
    "/authors",
    response_model=List[schemas.UserOut],
    summary="Get all authors (admin only)",
)
def get_all_authors(
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """Returns list of all registered authors."""
    return db.query(models.User).filter(models.User.role == models.UserRole.author).all()


@router.get(
    "/authors/{author_id}/books",
    response_model=List[schemas.BookOut],
    summary="Get all books for a specific author (admin only)",
)
def get_author_books(
    author_id: str,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    author = db.query(models.User).filter(models.User.id == author_id).first()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")
    return db.query(models.Book).filter(models.Book.author_id == author_id).all()


@router.get(
    "/stats",
    summary="Dashboard statistics (admin only)",
)
def get_dashboard_stats(
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """Returns aggregate statistics for the admin dashboard."""
    total_tickets = db.query(models.Ticket).count()
    open_tickets = db.query(models.Ticket).filter(
        models.Ticket.status == models.TicketStatus.open
    ).count()
    in_progress = db.query(models.Ticket).filter(
        models.Ticket.status == models.TicketStatus.in_progress
    ).count()
    resolved = db.query(models.Ticket).filter(
        models.Ticket.status.in_([models.TicketStatus.resolved, models.TicketStatus.closed])
    ).count()
    critical_tickets = db.query(models.Ticket).filter(
        models.Ticket.priority == models.TicketPriority.critical,
        models.Ticket.status.notin_([models.TicketStatus.resolved, models.TicketStatus.closed]),
    ).count()
    unassigned = db.query(models.Ticket).filter(
        models.Ticket.assigned_to == None,
        models.Ticket.status.notin_([models.TicketStatus.resolved, models.TicketStatus.closed]),
    ).count()
    total_authors = db.query(models.User).filter(
        models.User.role == models.UserRole.author
    ).count()
    total_books = db.query(models.Book).count()

    return {
        "total_tickets": total_tickets,
        "open_tickets": open_tickets,
        "in_progress": in_progress,
        "resolved": resolved,
        "critical_tickets": critical_tickets,
        "unassigned": unassigned,
        "total_authors": total_authors,
        "total_books": total_books,
    }
