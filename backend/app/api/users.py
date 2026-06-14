from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from uuid import UUID
from pydantic import BaseModel
from supabase import create_client, Client
import os

from ..auth.deps import require_admin, CurrentUser
from ..models.schemas import UserUpdate, UserResponse

router = APIRouter()
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
supabase: Client = create_client(supabase_url, supabase_key)


class UserListResponse(BaseModel):
    data: List[UserResponse]
    total: int


@router.get("/", response_model=UserListResponse)
async def list_users(
    current_user: CurrentUser = Depends(require_admin)
):
    """List all users (admin only)."""
    try:
        response = supabase.table("profiles").select("*", count="exact").execute()

        return UserListResponse(
            data=[UserResponse(**u) for u in response.data],
            total=response.count or 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_admin)
):
    """Get a specific user (admin only)."""
    try:
        response = supabase.table("profiles").select("*").eq("id", str(user_id)).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        return UserResponse(**response.data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    current_user: CurrentUser = Depends(require_admin)
):
    """Update a user (admin only)."""
    try:
        update_data = user_update.dict(exclude_unset=True)

        if not update_data:
            raise HTTPException(status_code=400, detail="No data to update")

        response = supabase.table("profiles").update(update_data).eq("id", str(user_id)).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="User not found")

        # Log audit event
        supabase.table("audit_logs").insert({
            "user_id": current_user.id,
            "action": "update_user",
            "resource_type": "user",
            "resource_id": str(user_id),
            "details": update_data
        }).execute()

        return UserResponse(**response.data[0])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    current_user: CurrentUser = Depends(require_admin)
):
    """Delete a user (admin only)."""
    try:
        if str(user_id) == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot delete yourself")

        # Check user exists
        check_response = supabase.table("profiles").select("id").eq("id", str(user_id)).single().execute()

        if not check_response.data:
            raise HTTPException(status_code=404, detail="User not found")

        # Delete user (Supabase auth will handle this via trigger)
        supabase.auth.admin.delete_user(str(user_id))

        # Log audit event
        supabase.table("audit_logs").insert({
            "user_id": current_user.id,
            "action": "delete_user",
            "resource_type": "user",
            "resource_id": str(user_id)
        }).execute()

        return {"message": "User deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
