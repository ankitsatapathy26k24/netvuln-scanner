from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from supabase import create_client, Client
import os

from ..auth.deps import require_admin, CurrentUser
from ..models.schemas import AuditLogResponse

router = APIRouter()
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
supabase: Client = create_client(supabase_url, supabase_key)


class AuditLogListResponse(BaseModel):
    data: List[AuditLogResponse]
    total: int


@router.get("/", response_model=AuditLogListResponse)
async def list_audit_logs(
    action: Optional[str] = None,
    user_id: Optional[UUID] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_admin)
):
    """List audit logs (admin only)."""
    try:
        query = supabase.table("audit_logs").select("*, profiles(email, full_name)", count="exact")

        if action:
            query = query.eq("action", action)
        if user_id:
            query = query.eq("user_id", str(user_id))

        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        # Transform data to include user info
        logs = []
        for log in response.data:
            logs.append(AuditLogResponse(
                id=log["id"],
                user_id=log["user_id"],
                action=log["action"],
                resource_type=log["resource_type"],
                resource_id=log.get("resource_id"),
                details=log.get("details", {}),
                ip_address=log.get("ip_address"),
                user_agent=log.get("user_agent"),
                created_at=log["created_at"]
            ))

        return AuditLogListResponse(
            data=logs,
            total=response.count or 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(
    log_id: UUID,
    current_user: CurrentUser = Depends(require_admin)
):
    """Get a specific audit log entry (admin only)."""
    try:
        response = supabase.table("audit_logs").select("*, profiles(email, full_name)").eq("id", str(log_id)).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Audit log not found")

        log = response.data
        return AuditLogResponse(
            id=log["id"],
            user_id=log["user_id"],
            action=log["action"],
            resource_type=log["resource_type"],
            resource_id=log.get("resource_id"),
            details=log.get("details", {}),
            ip_address=log.get("ip_address"),
            user_agent=log.get("user_agent"),
            created_at=log["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
