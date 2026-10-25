"""
Database seeder: populates the database with the provided sample dataset
(10 authors, 18 books) and creates admin accounts.

This runs on every startup but is idempotent — it checks for existing records
before inserting.
"""
import json
import logging
import uuid
from pathlib import Path

from database import SessionLocal
import models
import auth as auth_utils

logger = logging.getLogger(__name__)

SAMPLE_DATA_PATH = Path(__file__).parent.parent / "FULLSTACK-SAMPLEDATA.json"

# Test credentials (documented in README)
ADMIN_ACCOUNTS = [
    {
        "id": "ADMIN001",
        "email": "admin@bookleaf.com",
        "password": "admin123",
        "name": "BookLeaf Admin",
        "role": models.UserRole.admin,
    },
    {
        "id": "ADMIN002",
        "email": "support@bookleaf.com",
        "password": "support123",
        "name": "Support Manager",
        "role": models.UserRole.admin,
    },
]

# Author passwords — all set to "author123" for demo purposes
AUTHOR_PASSWORD = "author123"


def seed_database():
    """Idempotent seed function — safe to call on every startup."""
    db = SessionLocal()
    try:
        # ── Seed admins ───────────────────────────────────────────────────────
        for admin_data in ADMIN_ACCOUNTS:
            exists = db.query(models.User).filter(
                models.User.email == admin_data["email"]
            ).first()
            if not exists:
                admin = models.User(
                    id=admin_data["id"],
                    email=admin_data["email"],
                    hashed_password=auth_utils.hash_password(admin_data["password"]),
                    name=admin_data["name"],
                    role=admin_data["role"],
                    city="Delhi",
                    joined_date="2023-01-01",
                )
                db.add(admin)
                logger.info(f"Created admin: {admin_data['email']}")

        db.commit()

        # ── Seed authors + books from sample data ─────────────────────────────
        if not SAMPLE_DATA_PATH.exists():
            logger.warning(f"Sample data file not found at {SAMPLE_DATA_PATH}")
            return

        with open(SAMPLE_DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        for author_data in data.get("authors", []):
            author_id = author_data["author_id"]
            
            # Check if author already exists
            existing = db.query(models.User).filter(models.User.id == author_id).first()
            if not existing:
                author = models.User(
                    id=author_id,
                    email=author_data["email"],
                    hashed_password=auth_utils.hash_password(AUTHOR_PASSWORD),
                    name=author_data["name"],
                    role=models.UserRole.author,
                    phone=author_data.get("phone"),
                    city=author_data.get("city"),
                    joined_date=author_data.get("joined_date"),
                )
                db.add(author)
                logger.info(f"Created author: {author_data['email']}")

            # Seed books
            for book_data in author_data.get("books", []):
                book_id = book_data["book_id"]
                existing_book = db.query(models.Book).filter(models.Book.id == book_id).first()
                if not existing_book:
                    book = models.Book(
                        id=book_id,
                        author_id=author_id,
                        title=book_data["title"],
                        isbn=book_data.get("isbn"),
                        genre=book_data.get("genre"),
                        publication_date=book_data.get("publication_date"),
                        status=book_data.get("status", "Manuscript Received"),
                        mrp=book_data.get("mrp"),
                        author_royalty_per_copy=book_data.get("author_royalty_per_copy"),
                        total_copies_sold=book_data.get("total_copies_sold", 0),
                        total_royalty_earned=book_data.get("total_royalty_earned", 0.0),
                        royalty_paid=book_data.get("royalty_paid", 0.0),
                        royalty_pending=book_data.get("royalty_pending", 0.0),
                        last_royalty_payout_date=book_data.get("last_royalty_payout_date"),
                        print_partner=book_data.get("print_partner"),
                        available_on=book_data.get("available_on", []),
                    )
                    db.add(book)

        db.commit()

        # ── Seed sample tickets ───────────────────────────────────────────────
        sample_tickets = [
            {
                "id": "TCK-1001",
                "author_id": "AUTH001",
                "book_id": "BK001",
                "subject": "Royalty payout inquiry for Q4",
                "description": "Hi team, I noticed my dashboard shows ₹3,570 in pending royalties for 'Whispers of the Ganges'. Could you please let me know when this will be credited to my bank account?",
                "status": models.TicketStatus.open,
                "category": models.TicketCategory.royalty_payments,
                "priority": models.TicketPriority.high,
                "ai_category": models.TicketCategory.royalty_payments,
                "ai_priority": models.TicketPriority.high,
                "ai_classification_done": True,
                "assigned_to": None,
            },
            {
                "id": "TCK-1002",
                "author_id": "AUTH002",
                "book_id": "BK003",
                "subject": "Author copies cover spine misaligned",
                "description": "Received my bundle of 10 author copies today. The title text on the spine is offset by about 3mm to the left, which looks unprofessional. Can we please get these reprinted?",
                "status": models.TicketStatus.in_progress,
                "category": models.TicketCategory.printing_quality,
                "priority": models.TicketPriority.critical,
                "ai_category": models.TicketCategory.printing_quality,
                "ai_priority": models.TicketPriority.critical,
                "ai_classification_done": True,
                "assigned_to": "ADMIN001",
            },
            {
                "id": "TCK-1003",
                "author_id": "AUTH003",
                "book_id": "BK005",
                "subject": "Timeline for typesetting completion",
                "description": "My book has been in 'In Production - Typesetting' status for about two weeks now. Could you please share the expected delivery date for the formatted PDF proofs?",
                "status": models.TicketStatus.in_progress,
                "category": models.TicketCategory.book_status,
                "priority": models.TicketPriority.medium,
                "ai_category": models.TicketCategory.book_status,
                "ai_priority": models.TicketPriority.medium,
                "ai_classification_done": True,
                "assigned_to": "ADMIN002",
            },
            {
                "id": "TCK-1004",
                "author_id": "AUTH004",
                "book_id": "BK007",
                "subject": "Flipkart listing shows incorrect publication year",
                "description": "On Flipkart, the product listing for 'Frontiers of the Thar' mentions the publication year as 2021 instead of 2023. Also the author bio is truncated. Please update the metadata.",
                "status": models.TicketStatus.open,
                "category": models.TicketCategory.isbn_metadata,
                "priority": models.TicketPriority.high,
                "ai_category": models.TicketCategory.isbn_metadata,
                "ai_priority": models.TicketPriority.high,
                "ai_classification_done": True,
                "assigned_to": None,
            },
            {
                "id": "TCK-1005",
                "author_id": "AUTH005",
                "book_id": "BK009",
                "subject": "Book showing Out of Stock on Amazon US",
                "description": "Several readers from California and New Jersey mentioned that 'Carnatic Chords' is marked as Currently Unavailable on Amazon US. Is international distribution active?",
                "status": models.TicketStatus.open,
                "category": models.TicketCategory.distribution,
                "priority": models.TicketPriority.medium,
                "ai_category": models.TicketCategory.distribution,
                "ai_priority": models.TicketPriority.medium,
                "ai_classification_done": True,
                "assigned_to": None,
            },
            {
                "id": "TCK-1006",
                "author_id": "AUTH010",
                "book_id": "BK017",
                "subject": "Adding a new preface in subsequent print run",
                "description": "I am writing a new preface for the 2nd print run of 'Durga’s Daughters'. Could you let me know the deadline for submitting the revised manuscript files?",
                "status": models.TicketStatus.resolved,
                "category": models.TicketCategory.general,
                "priority": models.TicketPriority.low,
                "ai_category": models.TicketCategory.general,
                "ai_priority": models.TicketPriority.low,
                "ai_classification_done": True,
                "assigned_to": "ADMIN001",
            },
        ]

        for t_data in sample_tickets:
            existing_t = db.query(models.Ticket).filter(models.Ticket.id == t_data["id"]).first()
            if not existing_t:
                ticket = models.Ticket(
                    id=t_data["id"],
                    author_id=t_data["author_id"],
                    book_id=t_data["book_id"],
                    subject=t_data["subject"],
                    description=t_data["description"],
                    status=t_data["status"],
                    category=t_data["category"],
                    priority=t_data["priority"],
                    ai_category=t_data["ai_category"],
                    ai_priority=t_data["ai_priority"],
                    ai_classification_done=t_data["ai_classification_done"],
                    assigned_to=t_data["assigned_to"],
                )
                db.add(ticket)
                # Add initial message
                msg = models.TicketMessage(
                    id=str(uuid.uuid4()),
                    ticket_id=t_data["id"],
                    sender_id=t_data["author_id"],
                    sender_role=models.UserRole.author,
                    content=t_data["description"],
                    is_ai_draft=False,
                )
                db.add(msg)
                logger.info(f"Seeded ticket {t_data['id']}: {t_data['subject']}")

        db.commit()
        logger.info("Database seeding complete.")

    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_database()
