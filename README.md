# 📚 BookLeaf — Author Support & Communication Portal

A fullstack web application for **BookLeaf Publishing** that provides a support and communication portal for authors and administrators.

---

## 🗂️ Project Structure

```
bookleaf/
├── backend/       # FastAPI (Python) REST API
└── frontend/      # Next.js (TypeScript) web application
```

---

## ⚙️ Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Python, FastAPI, SQLAlchemy, SQLite |
| Frontend  | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Auth      | JWT (via `python-jose`)             |
| AI        | Groq API (OpenAI-compatible)        |
| Package Manager (Frontend) | Bun |

---

## 🚀 Getting Started

### Prerequisites

- **Python** 3.10+ (for the backend)
- **Node.js** 20+ and **Bun** 1.4+ (for the frontend)
- A **Groq API key** — get one free at [console.groq.com](https://console.groq.com)

---

## 🔧 Backend Setup

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Create and activate a virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment variables
cp .env.example .env
# Then open .env and fill in your values (see below)

# 5. Start the development server
uvicorn main:app --reload --port 8000
```

### Backend `.env` Configuration

```env
# JWT
SECRET_KEY=your-super-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Groq API (for AI features)
GROQ_API_KEY=your-groq-api-key-here
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant

# Database
DATABASE_URL=sqlite:///./bookleaf.db

# CORS — must match your frontend URL
FRONTEND_URL=http://localhost:3000
```

The backend will automatically:
- Create the SQLite database (`bookleaf.db`) on first run
- Seed initial data (authors, books, tickets)

### Backend API Docs

Once running, visit:

| URL | Description |
|-----|-------------|
| `http://localhost:8000` | Health check |
| `http://localhost:8000/docs` | Interactive Swagger UI |
| `http://localhost:8000/redoc` | ReDoc API reference |

---

## 🖥️ Frontend Setup

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies (uses Bun)
bun install

# 3. Start the development server
bun run dev
```

The frontend will be available at **`http://localhost:3000`**.

### Other Frontend Commands

```bash
# Build for production
bun run build

# Start production server (after build)
bun run start

# Run linter
bun run lint
```

---

## 🔐 Default User Roles

The seeded database includes two roles:

| Role     | Description                                      |
|----------|--------------------------------------------------|
| `author` | Access to own books and support tickets only     |
| `admin`  | Full access to all tickets, authors, and reports |

Use the `/auth/login` endpoint to obtain a JWT token. Include it in requests as:

```
Authorization: Bearer <token>
```

---

## 📡 API Routes Overview

| Prefix    | Description              |
|-----------|--------------------------|
| `/auth`   | Login & authentication   |
| `/books`  | Book management          |
| `/tickets`| Support ticket CRUD      |
| `/admin`  | Admin-only operations    |
| `/ai`     | AI-powered features      |

---

## 🧩 Running Both Services Together

Open two terminal windows:

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate   # or: source venv/bin/activate on Mac/Linux
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
bun run dev
```

Then open **`http://localhost:3000`** in your browser.

---

## 📝 Notes

- The backend uses **SQLite** by default, so no external database setup is needed.
- Sample data is available in `FULLSTACK-SAMPLEDATA.json` at the project root.
- AI features require a valid `GROQ_API_KEY` in your backend `.env`.
