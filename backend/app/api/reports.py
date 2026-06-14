from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from supabase import create_client, Client
import os
import json

from ..auth.deps import get_current_user, require_analyst, CurrentUser
from ..models.schemas import ReportCreate, ReportResponse
from ..reports.generator import ReportGenerator

router = APIRouter()
supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
supabase: Client = create_client(supabase_url, supabase_key)


class ReportListResponse(BaseModel):
    data: List[ReportResponse]
    total: int


@router.get("/", response_model=ReportListResponse)
async def list_reports(
    format: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user)
):
    """List all reports for the current user."""
    try:
        query = supabase.table("reports").select("*, scans(name)", count="exact")

        if current_user.role != "admin":
            query = query.eq("user_id", current_user.id)

        if format:
            query = query.eq("format", format)

        response = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        return ReportListResponse(
            data=[ReportResponse(**r) for r in response.data],
            total=response.count or 0
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_data: ReportCreate,
    current_user: CurrentUser = Depends(require_analyst)
):
    """Generate a new report from a scan."""
    try:
        # Verify scan exists and user has access
        scan_response = supabase.table("scans").select("*").eq("id", str(report_data.scan_id)).single().execute()

        if not scan_response.data:
            raise HTTPException(status_code=404, detail="Scan not found")

        scan = scan_response.data

        if current_user.role != "admin" and scan["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        if scan["status"] != "completed":
            raise HTTPException(status_code=400, detail="Can only generate reports for completed scans")

        # Get scan data for report
        hosts_response = supabase.table("hosts").select("*, ports(*)").eq("scan_id", str(report_data.scan_id)).execute()
        vulns_response = supabase.table("vulnerabilities").select("*").eq("scan_id", str(report_data.scan_id)).execute()

        scan_data = {
            **scan,
            "hosts": hosts_response.data,
            "vulnerabilities": vulns_response.data
        }

        # Generate report
        generator = ReportGenerator()

        if report_data.format == "json":
            content = generator.generate_json_report(scan_data)
            content_bytes = content.encode('utf-8')
            mime_type = "application/json"
        elif report_data.format == "csv":
            content = generator.generate_csv_report(scan_data)
            content_bytes = content.encode('utf-8')
            mime_type = "text/csv"
        elif report_data.format == "pdf":
            content_bytes = generator.generate_pdf_report(scan_data)
            mime_type = "application/pdf"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")

        # Store report metadata
        report_insert = {
            "scan_id": str(report_data.scan_id),
            "user_id": current_user.id,
            "name": report_data.name,
            "format": report_data.format,
            "file_size": len(content_bytes),
            "includes_executive_summary": report_data.includes_executive_summary,
            "includes_remediation": report_data.includes_remediation
        }

        report_response = supabase.table("reports").insert(report_insert).execute()

        # Log audit event
        supabase.table("audit_logs").insert({
            "user_id": current_user.id,
            "action": "generate_report",
            "resource_type": "report",
            "resource_id": report_response.data[0]["id"],
            "details": {"format": report_data.format, "scan_id": str(report_data.scan_id)}
        }).execute()

        return ReportResponse(**report_response.data[0])

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{report_id}/download")
async def download_report(
    report_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Download a report file."""
    try:
        # Get report metadata
        report_response = supabase.table("reports").select("*").eq("id", str(report_id)).single().execute()

        if not report_response.data:
            raise HTTPException(status_code=404, detail="Report not found")

        report = report_response.data

        if current_user.role != "admin" and report["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Get scan data
        scan_response = supabase.table("scans").select("*").eq("id", report["scan_id"]).single().execute()
        hosts_response = supabase.table("hosts").select("*, ports(*)").eq("scan_id", report["scan_id"]).execute()
        vulns_response = supabase.table("vulnerabilities").select("*").eq("scan_id", report["scan_id"]).execute()

        scan_data = {
            **scan_response.data,
            "hosts": hosts_response.data,
            "vulnerabilities": vulns_response.data
        }

        generator = ReportGenerator()

        if report["format"] == "json":
            content = generator.generate_json_report(scan_data)
            content_bytes = content.encode('utf-8')
            media_type = "application/json"
            filename = f"report_{report_id}.json"
        elif report["format"] == "csv":
            content = generator.generate_csv_report(scan_data)
            content_bytes = content.encode('utf-8')
            media_type = "text/csv"
            filename = f"report_{report_id}.csv"
        elif report["format"] == "pdf":
            content_bytes = generator.generate_pdf_report(scan_data)
            media_type = "application/pdf"
            filename = f"report_{report_id}.pdf"
        else:
            raise HTTPException(status_code=400, detail="Invalid format")

        return Response(
            content=content_bytes,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{report_id}")
async def delete_report(
    report_id: UUID,
    current_user: CurrentUser = Depends(get_current_user)
):
    """Delete a report."""
    try:
        # Get report
        report_response = supabase.table("reports").select("user_id").eq("id", str(report_id)).single().execute()

        if not report_response.data:
            raise HTTPException(status_code=404, detail="Report not found")

        if current_user.role != "admin" and report_response.data["user_id"] != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

        # Delete report
        supabase.table("reports").delete().eq("id", str(report_id)).execute()

        return {"message": "Report deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
