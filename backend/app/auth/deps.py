from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from pydantic import BaseModel
from typing import Optional
import os

supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_KEY", "")
supabase: Client = create_client(supabase_url, supabase_key)

security = HTTPBearer()


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class CurrentUser(BaseModel):
    id: str
    email: str
    role: str
    full_name: Optional[str] = None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> CurrentUser:
    """Validate JWT token and return current user."""
    token = credentials.credentials

    try:
        # Verify token with Supabase
        user_response = supabase.auth.get_user(token)

        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = user_response.user

        # Get user profile from database
        profile_response = supabase.table("profiles").select("*").eq("id", user.id).single().execute()

        profile = profile_response.data

        return CurrentUser(
            id=user.id,
            email=user.email or "",
            role=profile.get("role", "viewer") if profile else "viewer",
            full_name=profile.get("full_name") if profile else None
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_role(required_role: str):
    """Dependency to require a specific role."""
    async def role_checker(current_user: CurrentUser = Depends(get_current_user)):
        role_hierarchy = {"viewer": 1, "analyst": 2, "admin": 3}
        user_level = role_hierarchy.get(current_user.role, 0)
        required_level = role_hierarchy.get(required_role, 99)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user

    return role_checker


# Role requirement shortcuts
require_admin = require_role("admin")
require_analyst = require_role("analyst")
require_viewer = require_role("viewer")
