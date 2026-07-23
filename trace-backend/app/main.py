from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# Import connection engines
from app.database import engine, Base

# Important: Import models so SQLAlchemy binds metadata BEFORE creating tables
from app.auth.models import Employee
from app.projects.models import Project, ProjectMember

# Import modular routers
from app.auth.router import router as auth_router
from app.projects.router import router as project_router

# Synchronize schemas with PostgreSQL database
Base.metadata.create_all(bind=engine)


def ensure_runtime_schema_compatibility() -> None:
    """Keep local dev databases compatible with small model additions."""
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE sprints "
                "ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE"
            )
        )
        connection.execute(
            text(
                "UPDATE sprints "
                "SET updated_at = COALESCE(created_at, NOW()) "
                "WHERE updated_at IS NULL"
            )
        )


ensure_runtime_schema_compatibility()

app = FastAPI(
    title="Trace Project Tracking Engine",
    description="Corporate project tracking micro-infrastructure built for custom internal enterprise operations.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://3.104.49.129:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],              # explicit allow for GET, POST, OPTIONS, PATCH, DELETE
    allow_headers=["*"],              # explicit allow for Content-Type, Authorization, etc.
    expose_headers=["*"],
)

app.include_router(auth_router)
app.include_router(project_router)

@app.get("/", tags=["Root Context Health Verification Check"])
def read_root():
    return {
        "status": "online",
        "system": "Trace Platform",
        "umbrella_scope": "Single-Company Workspace Hierarchy Enabled"
    }
