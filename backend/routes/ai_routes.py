"""
AI routes: on-demand classification and draft generation endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional

from database import get_db
import models
import schemas
import auth as auth_utils
from services import ai_service

router = APIRouter()


@router.post(
    "/classify/{ticket_id}",
    response_model=schemas.AIClassificationResult,
    summary="Re-classify a ticket using AI (admin only)",
)
def classify_ticket(
    ticket_id: str,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Triggers AI classification for a specific ticket and updates it.
    Useful for re-classifying if the initial background classification failed.
    """
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    category, priority, reasoning = ai_service.classify_ticket(
        ticket.subject, ticket.description
    )

    ticket.ai_category = category
    ticket.ai_priority = priority
    ticket.category = category
    ticket.priority = priority
    ticket.ai_classification_done = True
    db.commit()

    return schemas.AIClassificationResult(
        category=category,
        priority=priority,
        reasoning=reasoning,
    )


@router.get(
    "/draft/{ticket_id}",
    response_model=schemas.AIDraftResponse,
    summary="Generate an AI draft response for a ticket (admin only)",
)
def generate_draft(
    ticket_id: str,
    current_user: models.User = Depends(auth_utils.get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Generates an AI-drafted response for the admin to review and edit.
    
    The draft is based on:
    - The ticket subject and description
    - The category-specific section of the BookLeaf Knowledge Base
    - The author's book data (if the ticket is book-specific)
    - BookLeaf's communication tone guidelines
    
    If the AI service is unavailable (rate limit, connection error, no key),
    `fallback: true` is returned and the admin can write a manual response.
    """
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.author),
            joinedload(models.Ticket.book),
        )
        .filter(models.Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    # Prepare book data for context (only if ticket is book-specific)
    book_data = None
    if ticket.book:
        book_data = {
            "title": ticket.book.title,
            "status": ticket.book.status,
            "total_copies_sold": ticket.book.total_copies_sold,
            "total_royalty_earned": ticket.book.total_royalty_earned,
            "royalty_paid": ticket.book.royalty_paid,
            "royalty_pending": ticket.book.royalty_pending,
            "last_royalty_payout_date": ticket.book.last_royalty_payout_date,
            "available_on": ticket.book.available_on or [],
        }

    author_first_name = ticket.author.name.split()[0] if ticket.author else "there"

    result = ai_service.generate_response_draft(
        subject=ticket.subject,
        description=ticket.description,
        category=ticket.category,
        author_name=author_first_name,
        book_title=ticket.book.title if ticket.book else None,
        book_data=book_data,
    )

    return schemas.AIDraftResponse(**result)
