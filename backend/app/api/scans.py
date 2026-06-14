from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from supabase import create_client, Client
import os

from ..auth.deps import get_current_user, require_analyst, CurrentUser
from ..models.schemas import ScanCreate, ScanUpdate, ScanResponse
from ..tasks.scanner_tasks import run_scan_task

router = APIRouter()
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
supabase: Client = create_client(supabase_url, supabase_key)


class ScanListResponse(BaseModel):
    data: List[ScanResponse]
    total: int


@router.get("/", response_model=ScanListResponse)
async def list_scans(
    status: Optional[str] = None,
    scan_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all scans for the current user."""
    try:
        query = supabase.table("scans").select("*", count="exact")

        # Filter by user (non-admins only see their own scans)
        if current_user.role != "admin":
            query = query.eq("user_id", current_user.id)

        if status:
            query = query.eq("status", status)
        if scan_type:
            query = query.eq("scan_type", scan_type)

        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        return ScanListResponse(
            data=[ScanResponse(**scan) for scan in response.data],
            total=response.count or 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ScanResponse, status_code=status.HTTP_201_CREATED)
async def create_scan(
    scan_data: ScanCreate,
    current_user: CurrentUser = Depends(require_analyst)
):
    """Create a new scan."""
    try:
        # Insert scan into database
        scan_insert = {
            "name": scan_data.name,
            "target": scan_data.target,
            "scan_type": scan_data.scan_type,
            "user_id": current_user.id,
            "options": scan_data.options or {},
            "status": "pending",
        }

        response = supabase.table("scans").insert(scan_insert).execute()
        scan = response.data[0]

        # Queue scan task
        run_scan_task.delay(
            scan_id=scan["id"],
            target=scan_data.target,
            scan_type=scan_data.scan_type,
            options=scan_data.options or {}
        )

        # Log audit event
        supabase.table("audit_logs").insert({
            "user_id": current_user.id,
            "action": "create_scan",
            "resource_type": "scan",
            "resource_id": scan["id"],
            "details": {"name": scan_data.name, "target": scan_data.target}
        }).execute()

        return ScanResponse(**scan)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{scan_id}", response_model=ScanResponse)
async def get_scan(
    scan_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get a specific scan by ID."""
    try:
        response = supabase.table("scans").select("*").eq("id", str(scan_id)).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Scan not found")

        scan = response.data

        # Check permission
        if current_user.role != "admin" and scan["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        return ScanResponse(**scan)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{scan_id}/hosts")
async def get_scan_hosts(
    scan_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get hosts discovered in a scan."""
    try:
        # Verify scan access
        scan_response = supabase.table("scans").select("user_id").eq("id", str(scan_id)).single().execute()

        if not scan_response.data:
            raise HTTPException(status_code=404, detail="Scan not found")

        if current_user.role != "admin" and scan_response.data["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get hosts
        hosts_response = supabase.table("hosts").select("*").eq("scan_id", str(scan_id)).execute()

        hosts = []
        for host in hosts_response.data:
            # Get ports for each host
            ports_response = supabase.table("ports").select("*").eq("host_id", host["id"]).execute()
            host["ports"] = ports_response.data
            hosts.append(host)

        return {"data": hosts}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{scan_id}/vulnerabilities")
async def get_scan_vulnerabilities(
    scan_id: UUID,
    severity: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get vulnerabilities found in a scan."""
    try:
        # Verify scan access
        scan_response = supabase.table("scans").select("user_id").eq("id", str(scan_id)).single().execute()

        if not scan_response.data:
            raise HTTPException(status_code=404, detail="Scan not found")

        if current_user.role != "admin" and scan_response.data["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get vulnerabilities
        query = supabase.table("vulnerabilities").select("*").eq("scan_id", str(scan_id))

        if severity:
            query = query.eq("severity", severity)

        vulns_response = query.execute()

        return {"data": vulns_response.data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete a scan."""
    try:
        # Verify scan access
        scan_response = supabase.table("scans").select("user_id").eq("id", str(scan_id)).single().execute()

        if not scan_response.data:
            raise HTTPException(status_code=404, detail="Scan not found")

        if current_user.role != "admin" and scan_response.data["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Delete scan (cascade will handle related records)
        supabase.table("scans").delete().eq("id", str(scan_id)).execute()

        # Log audit event
        supabase.table("audit_logs").insert({
            "user_id": current_user.id,
            "action": "delete_scan",
            "resource_type": "scan",
            "resource_id": str(scan_id)
        }).execute()

        return {"message": "Scan deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{scan_id}/cancel")
async def cancel_scan(
    scan_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Cancel a running scan."""
    try:
        # Verify scan access
        scan_response = supabase.table("scans").select("user_id, status").eq("id", str(scan_id)).single().execute()

        if not scan_response.data:
            raise HTTPException(status_code=404, detail="Scan not found")

        if current_user.role != "admin" and scan_response.data["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        if scan_response.data["status"] not in ["pending", "running"]:
            raise HTTPException(status_code=400, detail="Can only cancel pending or running scans")

        # Update status
        supabase.table("scans").update({
            "status": "cancelled",
            "completed_at": datetime.utcnow().isoformat()
        }).eq("id", str(scan_id)).execute()

        return {"message": "Scan cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
