# app/projects/schemas.py
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from uuid import UUID
from typing import List, Dict, Optional
from datetime import datetime
from app.projects.models import ProjectRole, CorporateDesignation, SprintStatus, TaskPriority

# --- 1. BASIC BASELINE STRUCTURES ---
class ProjectCreateRequest(BaseModel):
    project_name: str = Field(..., min_length=2, max_length=120)
    slug: str = Field(..., min_length=2, max_length=40)
    employee_id: str = Field(..., description="Employee ID of creating Team Leader")

class ProjectResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    project_key: str

    class Config:
        from_attributes = True

class AddTeamMemberRequest(BaseModel):
    project_id: UUID = Field(..., description="The context project UUID")
    employee_id: str = Field(..., description="The unique identity string of the worker to assign")
    designation: CorporateDesignation = Field(default=CorporateDesignation.DEVELOPER)

# --- 2. INNER LOG OBJECTS (MUST BE DEFINED FIRST) ---
class ProjectOverviewItem(BaseModel):
    id: str
    name: str
    slug: str

    class Config:
        from_attributes = True

class EmployeeOverviewItem(BaseModel):
    employee_id: str
    full_name: str
    email: str
    created_at: Optional[datetime] = None
    designation: Optional[str] = "Software Engineer"
    department: Optional[str] = "Engineering Operations"
    skills: Optional[List[str]] = ["Python", "FastAPI", "React"]

    class Config:
        from_attributes = True

class RecentUserLog(BaseModel):
    employee_id: str
    full_name: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- 3. DASHBOARD SUMMARY WRAPPERS ---
class ProjectSummaryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    project_key: str
    user_role_in_project: ProjectRole
    user_designation: CorporateDesignation

    class Config:
        from_attributes = True

class EmployeeDashboardOverview(BaseModel):
    employee_id: str
    full_name: str
    email: str
    active_projects: List[ProjectSummaryResponse]

    class Config:
        from_attributes = True

class AdminDashboardOverview(BaseModel):
    total_projects: int
    total_employees: int
    designation_breakdown: Dict[str, int]
    recent_registrations: List[EmployeeOverviewItem]  # Fixed: Defined above
    projects_list: List[ProjectOverviewItem]          # Fixed: Defined above

    class Config:
        from_attributes = True

# --- 4. TASK SCHEMAS ---
class TaskCreateRequest(BaseModel):
    project_id: UUID
    title: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = None
    priority: TaskPriority = TaskPriority.MEDIUM
    sprint_id: Optional[UUID] = Field(default=None, alias="Sprint_id")
    parent_id: Optional[UUID] = Field(default=None, alias="Parent_id")
    assignee_id: Optional[str] = Field(default=None, alias="Assignee_id")

class TaskResponse(BaseModel):
    id: UUID
    ticket_key: str
    project_id: UUID
    column_id: UUID
    sprint_id: Optional[UUID] = Field(default=None, alias="Sprint_id")
    parent_id: Optional[UUID] = Field(default=None, alias="Parent_id")
    title: str = Field(alias="Title")
    description: Optional[str] = Field(default=None, alias="Description")
    priority: TaskPriority = Field(alias="Priority")
    assignee_id: Optional[str] = Field(default=None, alias="Assignee_id")
    created_at: datetime = Field(alias="Created_at")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# --- 5. BOARD COLUMNS & SPRINTS ---
class ColumnResponse(BaseModel):
    id: UUID = Field(alias="Id")
    name: str = Field(alias="Name")
    position: int = Field(alias="Position")
    wip_limit: Optional[int] = Field(default=None, alias="Wip_limit")
    tasks: List[TaskResponse] = Field(default_factory=list, alias="Tasks")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class BoardDetailResponse(BaseModel):
    id: UUID = Field(alias="Id")
    project_id: UUID = Field(alias="Project_id")
    name: str = Field(alias="Name")
    columns: List[ColumnResponse] = Field(alias="Columns")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

class SprintCreateRequest(BaseModel):
    project_id: UUID = Field(alias="Project_id")
    name: str = Field(..., min_length=2, max_length=120, alias="Name")
    goal: Optional[str] = Field(default=None, alias="Goal")
    start_date: Optional[datetime] = Field(default=None, alias="Start_date")
    end_date: Optional[datetime] = Field(default=None, alias="End_date")

    model_config = ConfigDict(populate_by_name=True)

class SprintUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, alias="Name")
    goal: Optional[str] = Field(default=None, alias="Goal")
    start_date: Optional[datetime] = Field(default=None, alias="Start_date")
    end_date: Optional[datetime] = Field(default=None, alias="End_date")
    status: Optional[SprintStatus] = Field(default=None, alias="Status")

    model_config = ConfigDict(populate_by_name=True)

class SprintResponse(BaseModel):
    id: UUID = Field(alias="Id")
    project_id: UUID = Field(alias="Project_id")
    name: str = Field(alias="Name")
    goal: Optional[str] = Field(default=None, alias="Goal")
    start_date: Optional[datetime] = Field(default=None, alias="Start_date")
    end_date: Optional[datetime] = Field(default=None, alias="End_date")
    status: SprintStatus = Field(alias="Status")
    created_at: Optional[datetime] = Field(default=None, alias="Created_at")
    updated_at: Optional[datetime] = Field(default=None, alias="Updated_at")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

# --- 6. ADMINISTRATIVE OVERRIDES INPUT VALIDATIONS ---
class ChangeLeadRequest(BaseModel):
    project_id: UUID = Field(alias="Project_id")
    old_leader_employee_id: str = Field(alias="Old_leader_employee_id")
    new_leader_employee_id: str = Field(alias="New_leader_employee_id")

    model_config = ConfigDict(populate_by_name=True)

class ProjectAccessVerificationRequest(BaseModel):
    employee_id: str = Field(..., description="The employee ID typing into the interface gate")
    project_key: str = Field(..., description="The short project code text prefix constraint (e.g., TEJ, TRACE)")

# --- 7. AUTHENTICATION & TOKEN SESSION RESPONSES ---
class UserProjectMeta(BaseModel):
    full_name: str
    project_id: UUID
    project_name: str
    assigned_role: str
    designation: str

class TokenVerificationResponse(BaseModel):
    status: str
    access_token: str
    token_type: str
    user_meta: UserProjectMeta
