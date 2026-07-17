from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.config import settings  # Fixed: Load JWT expiration parameters natively
from app.auth.models import Employee, GlobalRole
from app.auth.schemas import (
    AdminSignupRequest, AdminLoginRequest, 
    EmployeeOnboardingRequest, EmployeeResponse, TokenResponse
)
from app.auth.utils import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Identity & Profiles"])

@router.post("/admin/signup", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def admin_signup(data: AdminSignupRequest, db: Session = Depends(get_db)):
    if db.query(Employee).filter(Employee.username == data.username).first():
        raise HTTPException(status_code=400, detail="Admin username is already taken.")
        
    new_admin = Employee(
        username=data.username,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        global_role=GlobalRole.ADMIN,
        availability_status="Available"
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin

@router.post("/admin/login")
def admin_login(data: AdminLoginRequest, db: Session = Depends(get_db)):
    """Authenticates supervisor profiles safely by extracting parameters correctly from Pydantic schemas."""
    # 1. FIXED: Safely unpack Pydantic attributes via data.username or data.dict() to prevent 500 mapping errors
    request_data = data.dict() if hasattr(data, 'dict') else data.__dict__
    input_username = request_data.get("username", "").strip()
    input_password = request_data.get("password", "")

    # 2. Look up the employee in the database using a case-insensitive match
    admin = db.query(Employee).filter(
        func.lower(Employee.username) == func.lower(input_username)
    ).first()
    
    # 3. Validation Guard: Check if user exists
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access Denied: Invalid administrative credentials."
        )
        
    # 4. Validation Guard: Ensure the user holds global Admin authorization privileges
    user_role = str(admin.global_role.value) if hasattr(admin.global_role, 'value') else str(admin.global_role)
    if user_role.upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Your profile does not hold administrative permissions."
        )
        
    # 5. Verify the incoming password hash matches the database metric string
    if not verify_password(input_password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access Denied: Invalid administrative credentials."
        )
        
    # 6. Issue secure cryptographic token session tracking metrics over the wire
    session_time_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    issued_token = create_access_token(
        data={"sub": str(admin.id), "global_role": "Admin"},
        expires_delta=session_time_delta
    )
    
    return {
        "access_token": issued_token,
        "token_type": "bearer"
    }

@router.post("/user/register", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def employee_onboarding(data: EmployeeOnboardingRequest, db: Session = Depends(get_db)):
    
    if db.query(Employee).filter(Employee.employee_id == data.employee_id).first():
        raise HTTPException(status_code=400, detail="Employee ID already registered in the platform database.")
        
    if db.query(Employee).filter(Employee.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email address already registered.")

    new_employee = Employee(
        employee_id=data.employee_id,
        full_name=data.full_name,
        email=data.email,
        phone_number=data.phone_number,
        department=data.department,
        designation=data.designation,
        skills=data.skills,
        global_role=GlobalRole.USER,
        availability_status="Available"
    )
    db.add(new_employee)
    db.commit()
    db.refresh(new_employee)
    return new_employee

@router.delete("/admin/delete-user/{employee_id}", status_code=status.HTTP_200_OK)
def admin_permanently_delete_user(
    employee_id: str, 
    db: Session = Depends(get_db),
    current_admin: Employee = Depends(get_current_user)
):
    if current_admin.global_role != GlobalRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Access Denied. Only system administrators can completely remove accounts."
        )

    target_user = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target employee account matching Employee ID not found.")

    db.delete(target_user)
    db.commit()

    return {
        "status": "success",
        "message": f"Employee record associated with employee_id '{employee_id}' has been permanently deleted."
    }