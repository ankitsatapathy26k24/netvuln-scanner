from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from supabase import create_client, Client
import os

from ..auth.deps import get_current_user, CurrentUser
from ..models.schemas import VulnerabilityResponse

router = APIRouter()
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
supabase: Client = create_client(supabase_url, supabase_key)


class VulnerabilityListResponse(BaseModel):
    data: List[VulnerabilityResponse]
    total: int


@router.get("/", response_model=VulnerabilityListResponse)
async def list_vulnerabilities(
    severity: Optional[str] = None,
    scan_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user)
):
    """List vulnerabilities with filtering."""
    try:
        # Join with scans to check ownership
        query = supabase.table("vulnerabilities").select("*, scans!inner(user_id)", count="exact")

        if severity:
            query = query.eq("severity", severity)
        if scan_id:
            query = query.eq("scan_id", scan_id)

        response = query.order("cvss_score", desc=True).range(offset, offset + limit - 1).execute()

        # Filter by user access
        vulnerabilities = []
        for vuln in response.data:
            scan = vuln.get("scans", {})
            if current_user.role == "admin" or scan.get("user_id") == current_user.id:
                vulnerabilities.append(VulnerabilityResponse(
                    id=vuln["id"],
                    port_id=vuln.get("port_id"),
                    host_id=vuln["host_id"],
                    scan_id=vuln["scan_id"],
                    cve_id=vuln.get("cve_id"),
                    cve_name=vuln.get("cve_name"),
                    severity=vuln["severity"],
                    cvss_score=vuln.get("cvss_score"),
                    title=vuln["title"],
                    description=vuln.get("description"),
                    solution=vuln.get("solution"),
                    cve_refs=vuln.get("cve_refs"),
                    nse_script=vuln.get("nse_script"),
                    raw_output=vuln.get("raw_output"),
                    created_at=vuln["created_at"]
                ))

        return VulnerabilityListResponse(
            data=vulnerabilities,
            total=len(vulnerabilities)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_vulnerability_stats(
    current_user: CurrentUser = Depends(get_current_user)
):
    """Get vulnerability statistics."""
    try:
        # Get all vulnerabilities for user's scans
        if current_user.role == "admin":
            response = supabase.table("vulnerabilities").select("severity").execute()
        else:
            # Get scan IDs for user
            scans_response = supabase.table("scans").select("id").eq("user_id", current_user.id).execute()
            scan_ids = [s["id"] for s in scans_response.data]

            if not scan_ids:
                return {"stats": {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}}

            response = supabase.table("vulnerabilities").select("severity").in_("scan_id", scan_ids).execute()

        # Count by severity
        stats = {"critical": 0, "high": 0, "medium": 0, "low": 0, "informational": 0}
        for vuln in response.data:
            severity = vuln.get("severity", "informational")
            stats[severity] = stats.get(severity, 0) + 1

        return {"stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
