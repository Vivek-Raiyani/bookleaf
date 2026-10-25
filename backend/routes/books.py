"""
Books routes: authors can view their own books.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
import models
import schemas
import auth as auth_utils

router = APIRouter()


@router.get(
    "",
    response_model=List[schemas.BookOut],
    summary="Get all books for the current author",
)
@router.get(
    "/",
    response_model=List[schemas.BookOut],
    include_in_schema=False,
)
def get_my_books(
    current_user: models.User = Depends(auth_utils.get_current_author),
    db: Session = Depends(get_db),
):
    """
    Returns all books belonging to the authenticated author.
    Authors can only see their own books.
    """
    books = db.query(models.Book).filter(models.Book.author_id == current_user.id).all()
    return books


@router.get(
    "/{book_id}",
    response_model=schemas.BookOut,
    summary="Get a specific book by ID",
)
def get_book(
    book_id: str,
    current_user: models.User = Depends(auth_utils.get_current_author),
    db: Session = Depends(get_db),
):
    """
    Returns details of a specific book.
    Authors can only access their own books. Admins can access any book.
    """
    query = db.query(models.Book).filter(models.Book.id == book_id)
    
    # Authors can only see their own books
    if current_user.role == models.UserRole.author:
        query = query.filter(models.Book.author_id == current_user.id)
    
    book = query.first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book
