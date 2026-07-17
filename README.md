# Trace

Trace is an internal project tracking platform built with a FastAPI backend and a React/Vite frontend. It supports admin onboarding, employee registration, project creation, team allocation, Kanban workflow tracking, sprint planning, backlog management, dashboards, and project leadership/admin controls.

## Project Structure

```text
Trace/
|-- trace-backend/
|   |-- app/
|   |   |-- auth/          # Admin/user identity, JWT utilities, auth dependencies
|   |   |-- projects/      # Projects, teams, boards, sprints, tasks, admin controls
|   |   |-- config.py      # Environment-backed settings
|   |   |-- database.py    # SQLAlchemy engine/session setup
|   |   `-- main.py        # FastAPI app entry point
|   |-- alembic/           # Database migration environment
|   |-- alembic.ini
|   |-- requirements.txt
|   `-- .env               # Local backend environment values
`-- trace-frontend/
    |-- src/
    |   |-- components/    # Screens and UI components
    |   |-- lib/           # API clients and project helpers
    |   |-- App.tsx        # Frontend routing/session root
    |   |-- constants.ts
    |   |-- index.css
    |   `-- main.tsx
    |-- package.json
    |-- vite.config.ts
    `-- index.html
```

## Technology Stack

Backend:

- Python
- FastAPI
- SQLAlchemy
- PostgreSQL
- Alembic
- Pydantic
- JWT authentication with `PyJWT`
- Password hashing with `passlib` and `bcrypt`

Frontend:

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React icons
- DnD Kit for drag-and-drop Kanban interactions
- Recharts for dashboard visualizations

## Core Product Flow

1. A user selects a role from the frontend: `Admin` or `User`.
2. Admins can sign up and log in with username/password credentials.
3. Employees can register their profile through the user onboarding flow.
4. A registered employee can create a project and becomes that project's Team Leader.
5. Project creation automatically creates:
   - a project record,
   - a semantic project key,
   - a project membership row for the leader,
   - a default board,
   - nine workflow columns.
6. Team Leaders add employees to projects by Employee ID.
7. Users enter a project workspace using Employee ID and Project Key.
8. Inside the workspace, users can view dashboards, manage Kanban work, create tasks, manage backlog items, and plan sprints.
9. Admins can view global stats, inspect employees/project members, delete employees/projects, and transfer project leadership.

## Backend Setup

From the root folder:

```powershell
cd trace-backend
```

Create and activate a virtual environment:

```powershell
python -m venv env
.\env\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Create a PostgreSQL database, for example:

```sql
CREATE DATABASE trace_db;
```

Configure `trace-backend/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trace_db
SECRET_KEY=replace-with-a-secure-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=720
```

Run the backend:

```powershell
uvicorn app.main:app --reload
```

The backend runs at:

```text
http://localhost:8000
```

FastAPI documentation is available at:

```text
http://localhost:8000/docs
```

## Frontend Setup

From the root folder:

```powershell
cd trace-frontend
```

Install dependencies:

```powershell
npm install
```

Run the frontend:

```powershell
npm run dev
```

The frontend is configured to run on:

```text
http://localhost:3000
```

The frontend API clients currently call the backend at:

```text
http://localhost:8000
```

## Run Order

Start services in this order:

1. Start PostgreSQL and confirm `trace_db` exists.
2. Start the FastAPI backend from `trace-backend`.
3. Start the Vite frontend from `trace-frontend`.
4. Open `http://localhost:3000`.

## Main Backend Endpoints

Authentication and identity:

```text
POST   /auth/admin/signup
POST   /auth/admin/login
POST   /auth/user/register
DELETE /auth/admin/delete-user/{employee_id}
```

Projects and access:

```text
POST   /projects/create
POST   /projects/add-member
POST   /projects/verify-access
GET    /projects/dashboard/{employee_id}
GET    /projects/{project_id}/members
DELETE /projects/{project_id}/delete/{employee_id}
```

Kanban and tasks:

```text
GET    /projects/{project_id}/board
GET    /projects/{project_id}/tasks
POST   /projects/tasks/create
PATCH  /projects/tasks/{task_id}/move-lane/{column_id}
DELETE /projects/tasks/{task_id}
```

Sprints:

```text
POST  /projects/sprints/create
GET   /projects/{project_id}/sprints
PATCH /projects/sprints/{sprint_id}/update
```

Admin dashboard and controls:

```text
GET    /projects/admin/overview-stats
GET    /projects/admin/{project_id}/members-list
GET    /projects/admin/employee/{employee_id}/details
PATCH  /projects/admin/change-lead
DELETE /projects/admin/delete/{project_id}
```

## Data Model Overview

The backend uses SQLAlchemy models with PostgreSQL UUID primary keys.

Important tables:

- `employees`: stores admins and employees.
- `projects`: stores project containers, slugs, project keys, and ticket counters.
- `project_members`: connects employees to projects and stores project role/designation.
- `boards`: one board per project.
- `board_columns`: workflow lanes for each board.
- `sprints`: sprint planning records for a project.
- `tasks`: task tickets, priorities, sprint links, assignees, parent task links, and Kanban column positions.

Project roles:

- `Team Leader`
- `Member`

Employee/global roles:

- `Admin`
- `User`

Task priorities:

- `Low`
- `Medium`
- `High`
- `Urgent`

Sprint statuses:

- `Future`
- `Active`
- `Completed`

Default Kanban columns created with every project:

```text
To Do
In Progress
Testing
Development Complete
Peer Review
QA Move
UAT Move
Production Deploy
Done
```

## Frontend Pages and Components

Key screens:

- `RoleSelection`: first role choice between admin and user.
- `AuthPage`: admin login/signup and user access flows.
- `AdminDashboard`: admin metrics and administrative controls.
- `Dashboard`: standard project workspace shell.
- `KanbanPage`: visual board and task movement.
- `BacklogPage`: backlog planning experience.
- `SprintPage`: sprint creation, status updates, and sprint tracking.
- `ProfilePage`: user/profile details.

Frontend session data is stored in `localStorage`, including:

- selected role,
- auth session,
- JWT token under `trace_session_token`.

## Authentication Model

Admin authentication uses username/password login and returns a bearer token.

Project user authentication is password-less. A registered user verifies access with:

- `employee_id`
- `project_key`

If the employee is assigned to the project, the backend returns a JWT token and workspace metadata.

Protected backend routes use the bearer token to resolve the current user.

## Development Notes

- Backend CORS allows the frontend development ports `3000` and `5173`.
- `Base.metadata.create_all(bind=engine)` is currently called at backend startup, so tables are created automatically during local development.
- Alembic is present for migrations and includes versions for the structural baseline and sprint `updated_at` field.
- `app.main.ensure_runtime_schema_compatibility()` adds `sprints.updated_at` if it is missing, which helps older local databases keep working.
- The frontend has fixed API base URLs in `src/lib/kanbanApi.ts` and `src/lib/sprintApi.ts`.

## Useful Commands

Backend:

```powershell
cd trace-backend
.\env\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

Frontend:

```powershell
cd trace-frontend
npm run dev
```

Frontend production build:

```powershell
cd trace-frontend
npm run build
```

Frontend TypeScript check:

```powershell
cd trace-frontend
npm run lint
```

## Troubleshooting

If the frontend cannot load data:

- Confirm the backend is running on `http://localhost:8000`.
- Confirm PostgreSQL is running.
- Confirm `trace-backend/.env` has the correct `DATABASE_URL`.
- Confirm CORS origins include the frontend URL.

If login or protected admin endpoints fail:

- Confirm the `Authorization: Bearer <token>` header is being sent.
- Log in again to refresh `localStorage` session data.
- Confirm the account has `Admin` role for admin-only endpoints.

If project access fails:

- Confirm the employee is registered.
- Confirm the project exists.
- Confirm the employee has been added to the project.
- Confirm the project key matches the backend-generated `project_key`.

If task or sprint creation fails:

- Confirm the `project_id` is a valid UUID.
- Confirm the project has a board and columns.
- For sprint payloads, use the backend aliases accepted by the API, such as `Project_id`, `Name`, `Goal`, `Start_date`, and `End_date`.

## Current Local Assumptions

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`
- Database: PostgreSQL database named `trace_db`
- Main backend entry point: `trace-backend/app/main.py`
- Main frontend entry point: `trace-frontend/src/App.tsx`
