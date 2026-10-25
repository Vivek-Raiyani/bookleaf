"""
BookLeaf AI Service
Uses the OpenAI-compatible client pointed at Groq for:
  1. Ticket auto-classification (category + priority)
  2. AI-drafted admin response generation

Design decisions for cost-consciousness:
  - Classification uses a short, focused prompt (not the full KB)
  - Response generation uses a curated KB excerpt relevant to the category
  - We cap max_tokens to reasonable limits
  - We gracefully degrade: if Groq is down, we return fallback values so the
    ticket workflow is never blocked
"""
import json
import logging
from typing import Optional, Tuple
from openai import OpenAI, APIError, RateLimitError, APIConnectionError
from config import settings
from models import TicketCategory, TicketPriority

logger = logging.getLogger(__name__)

# ─── Groq Client (OpenAI-compatible) ─────────────────────────────────────────

def _get_client() -> Optional[OpenAI]:
    """Return a Groq-backed OpenAI client, or None if no API key configured."""
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set — AI features disabled")
        return None
    return OpenAI(
        api_key=settings.GROQ_API_KEY,
        base_url=settings.GROQ_BASE_URL,
    )


# ─── BookLeaf Knowledge Base (curated by category) ────────────────────────────
# We store the KB in sections so we only inject what's relevant to the ticket
# category. This significantly reduces token usage vs. sending everything every time.

KNOWLEDGE_BASE = {
    "company": """
BookLeaf Publishing is a self-publishing company operating in India and the US.
Publishing packages: Standard Free (no upfront cost) and Bestseller Breakthrough (premium with marketing).
Services: cover design, typesetting, ISBN assignment, printing, distribution, royalty management.
Printing: In-house (Delhi warehouse) + print partners Repro India and Epitome Books.
""",
    TicketCategory.royalty_payments: """
ROYALTY POLICY:
- 80/20 split: 80% net profit to author, 20% to BookLeaf
- Net profit = MRP minus printing cost, platform commission (Amazon/Flipkart), and shipping
- Royalties calculated quarterly, paid within 45 days of quarter end
- Minimum payout threshold: ₹1,000 (rolls over if below)
- Payouts via bank transfer to account linked in dashboard
- Authors can view per-platform sales breakdown in dashboard
""",
    TicketCategory.isbn_metadata: """
ISBN POLICY:
- Every book gets a unique ISBN assigned by BookLeaf under BookLeaf's publisher imprint
- Authors wanting ISBN under their own imprint must obtain it independently
- ISBN errors (duplicate, wrong book linked) = HIGH PRIORITY, escalated to production team immediately
- Resolution timeline for ISBN issues: 48 hours
METADATA UPDATES:
- Book description/metadata updates can be submitted via dashboard or by emailing BookLeaf
- Changes reflect on platforms within 3–5 business days
""",
    TicketCategory.printing_quality: """
PRINTING & QUALITY:
- In-house printing for most orders; overflow to Repro India or Epitome Books
- Standard turnaround: 5–7 business days from order confirmation
- Quality issues (misprints, binding defects, color inconsistency): BookLeaf arranges FREE reprint after verification
- Author must share photos of defective copies for verification
- Reprint timeline: 5–7 business days once verified
""",
    TicketCategory.distribution: """
DISTRIBUTION & AVAILABILITY:
- Books listed on: Amazon India, Flipkart, Amazon US, Amazon UK, BookLeaf Store
- New listings go live: 7–10 business days after publication complete
- "Currently Unavailable" on platform = usually a stock sync issue
- Re-sync can be triggered by BookLeaf team; resolves in 24–48 hours
""",
    TicketCategory.book_status: """
PRODUCTION STAGES (in order):
Manuscript Received → Editing (if opted) → Cover Design → Typesetting → Proofreading → ISBN Assignment → Printing → Distribution Setup → Published & Live

- Authors updated via email at each stage
- Common delays: Cover Design (waiting for author approval), Proofreading (revision rounds)
- If delayed, be honest about reason and give specific updated timeline
""",
    TicketCategory.general: """
GENERAL:
- Metadata/description updates: submit via dashboard or email. Reflects in 3–5 business days.
- Author bio updates: contact BookLeaf support team
- Account/dashboard questions: authors can update bank details, view royalty breakdown in dashboard
- For anything not covered, escalate to the appropriate team with a 48-hour response commitment
""",
}

TONE_GUIDELINES = """
COMMUNICATION TONE:
- Empathetic and professional — authors are partners, not customers to manage
- Acknowledge concern before jumping to solutions
- Be specific: use actual numbers, dates, statuses — never vague reassurances
- If BookLeaf is at fault, own it directly — no corporate deflection
- If needs escalation: give clear timeline ("Our team will look into this within 48 hours")
- End with a clear next step for the author and/or BookLeaf team
- Sign off as "The BookLeaf Support Team"
"""

# ─── Classification ────────────────────────────────────────────────────────────

CATEGORIES = [cat.value for cat in TicketCategory]
PRIORITIES = [p.value for p in TicketPriority]

CLASSIFICATION_PROMPT = """You are a support ticket classifier for BookLeaf Publishing.

Classify the ticket into EXACTLY one category and one priority level.

CATEGORIES:
- Royalty & Payments: royalty amounts, payment timing, bank details, payout questions
- ISBN & Metadata Issues: wrong ISBN, duplicate ISBN, book description changes, metadata errors
- Printing & Quality: print defects, blurry images, binding issues, author copy problems
- Distribution & Availability: book not showing on Amazon/Flipkart, "unavailable" status, listing issues
- Book Status & Production Updates: production stage questions, delays in typesetting/cover design/proofreading
- General Inquiry: account questions, bio updates, platform changes, anything else

PRIORITY LEVELS:
- Critical: legal threats, financial disputes >6 months old, ISBN duplicates, data integrity issues
- High: royalty overdue >3 months, quality defect affecting sales, urgent production blocker
- Medium: royalty questions, standard production updates, distribution delays <1 week
- Low: general questions, bio updates, feature requests, informational queries

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"category": "<exact category name>", "priority": "<exact priority level>", "reasoning": "<1 sentence>"}

TICKET SUBJECT: {subject}
TICKET DESCRIPTION: {description}"""


def classify_ticket(subject: str, description: str) -> Tuple[TicketCategory, TicketPriority, str]:
    """
    Classify a ticket using AI. Returns (category, priority, reasoning).
    Falls back to (General Inquiry, Medium) if AI is unavailable.
    """
    client = _get_client()
    if not client:
        return TicketCategory.general, TicketPriority.medium, "AI classification unavailable (no API key)"

    prompt = CLASSIFICATION_PROMPT.format(subject=subject, description=description[:1000])

    try:
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.1,  # Low temperature for consistent classification
        )
        raw = response.choices[0].message.content.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)

        category_str = data.get("category", TicketCategory.general.value)
        priority_str = data.get("priority", TicketPriority.medium.value)
        reasoning = data.get("reasoning", "")

        # Validate and map to enum values
        category = next(
            (c for c in TicketCategory if c.value == category_str),
            TicketCategory.general
        )
        priority = next(
            (p for p in TicketPriority if p.value == priority_str),
            TicketPriority.medium
        )

        logger.info(f"Ticket classified: {category.value} / {priority.value}")
        return category, priority, reasoning

    except (RateLimitError, APIConnectionError, APIError) as e:
        logger.error(f"Groq API error during classification: {e}")
        return TicketCategory.general, TicketPriority.medium, f"AI unavailable: {str(e)[:100]}"
    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Classification response parse error: {e}")
        return TicketCategory.general, TicketPriority.medium, "Classification parse error"


# ─── Response Generation ───────────────────────────────────────────────────────

def generate_response_draft(
    subject: str,
    description: str,
    category: Optional[TicketCategory],
    author_name: str,
    book_title: Optional[str],
    book_data: Optional[dict] = None,
) -> dict:
    """
    Generate an AI-drafted admin response using the relevant KB section.
    
    Cost-conscious design:
    - Only injects the KB section relevant to the ticket category
    - Always includes company overview + tone guidelines
    - Caps at 400 output tokens (sufficient for a support response)
    - Returns fallback=True if AI is unavailable, so admin can write manually
    
    Returns: {"draft": str, "model_used": str, "tokens_used": int, "fallback": bool}
    """
    client = _get_client()
    if not client:
        return {
            "draft": "",
            "model_used": "none",
            "tokens_used": 0,
            "fallback": True,
        }

    # Build context: company overview + category-specific KB section
    cat = category or TicketCategory.general
    kb_section = KNOWLEDGE_BASE.get(cat, KNOWLEDGE_BASE[TicketCategory.general])
    company_info = KNOWLEDGE_BASE["company"]

    # Build book context if available (only key fields, not full object)
    book_context = ""
    if book_data:
        book_context = f"""
BOOK DETAILS FOR THIS TICKET:
- Title: {book_data.get('title', 'N/A')}
- Status: {book_data.get('status', 'N/A')}
- Total Copies Sold: {book_data.get('total_copies_sold', 0)}
- Royalty Earned: ₹{book_data.get('total_royalty_earned', 0):,.0f}
- Royalty Paid: ₹{book_data.get('royalty_paid', 0):,.0f}
- Royalty Pending: ₹{book_data.get('royalty_pending', 0):,.0f}
- Last Payout Date: {book_data.get('last_royalty_payout_date') or 'No payout yet'}
- Available On: {', '.join(book_data.get('available_on', [])) or 'Not yet listed'}
"""

    system_prompt = f"""You are a senior support representative at BookLeaf Publishing.
Draft a professional, empathetic response to an author's support ticket.

{company_info}

{kb_section}
{TONE_GUIDELINES}

INSTRUCTIONS:
- Address the author by their first name
- Keep response concise but complete (150-300 words)
- Use specific details from the Knowledge Base (timelines, policies)
- If book data is provided, reference actual numbers
- Do NOT make up information not in the KB
- End with "Warm regards,\\nThe BookLeaf Support Team"
- Do NOT include a subject line or "Dear [name]" header — start directly with the acknowledgment
"""

    user_message = f"""AUTHOR NAME: {author_name}
{f'BOOK: {book_title}' if book_title else 'QUERY TYPE: General / Account Level'}
{book_context}

TICKET SUBJECT: {subject}

AUTHOR'S MESSAGE:
{description[:1500]}

Please draft a response to this ticket."""

    try:
        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            max_tokens=500,
            temperature=0.4,
        )
        draft = response.choices[0].message.content.strip()
        tokens = response.usage.total_tokens if response.usage else None

        return {
            "draft": draft,
            "model_used": settings.GROQ_MODEL,
            "tokens_used": tokens,
            "fallback": False,
        }

    except (RateLimitError, APIConnectionError, APIError) as e:
        logger.error(f"Groq API error during draft generation: {e}")
        return {
            "draft": "",
            "model_used": "none",
            "tokens_used": 0,
            "fallback": True,
        }
    except Exception as e:
        logger.error(f"Unexpected error in generate_response_draft: {e}")
        return {
            "draft": "",
            "model_used": "none",
            "tokens_used": 0,
            "fallback": True,
        }
