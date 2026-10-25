"""
BookLeaf Backend - FastAPI Application
Author Support & Communication Portal
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import settings
from database import engine, Base
from routes import auth, books, tickets, admin, ai_routes
from seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database and seed data on startup."""
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield


app = FastAPI(
    title="BookLeaf Author Support Portal API",
    description="""
    API for BookLeaf Publishing's Author Support & Communication Portal.
    
    ## Authentication
    Use `/auth/login` to get a JWT token. Include it as `Authorization: Bearer <token>` header.
    
    ## Roles
    - **author**: Can access own books and tickets only
    - **admin**: Full access to all tickets and authors
    """,
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(books.router, prefix="/books", tags=["Books"])
app.include_router(tickets.router, prefix="/tickets", tags=["Tickets"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(ai_routes.router, prefix="/ai", tags=["AI"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "BookLeaf API is running", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy"}
