import asyncio
import logging
from datetime import datetime
from typing import Dict, Any
from celery import shared_task
from supabase import create_client, Client
import os

logger = logging.getLogger(__name__)

supabase_url = os.getenv("SUPABASE_URL", "")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", os.getenv("SUPABASE_KEY", ""))
supabase: Client = create_client(supabase_url, supabase_key)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def run_scan_task(self, scan_id: str, target: str, scan_type: str, options: Dict[str, Any] = None):
    """Celery task to execute a network scan."""
    options = options or {}

    try:
        # Update scan status to running
        supabase.table("scans").update({
            "status": "running",
            "started_at": datetime.utcnow().isoformat(),
        }).eq("id", scan_id).execute()

        # Import scanner (local import to avoid circular dependency)
        from ..scanner.nmap_scanner import NmapScanner, MockScanner

        # Determine if we should use real scanner or mock
        use_mock = os.getenv("USE_MOCK_SCANNER", "false").lower() == "true"

        if use_mock:
            scanner = MockScanner()
        else:
            scanner = NmapScanner()

        # Run scan
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            scanner.scan(
                target=target,
                scan_type=scan_type,
                ports=options.get("portRange"),
                timing=options.get("timing", 4),
                enable_os=options.get("enableOS", False),
                enable_service=options.get("enableService", False),
                progress_callback=lambda msg: update_scan_progress(scan_id, msg)
            )
        )

        if result.success:
            # Save hosts and ports
            host_ids = {}
            for host in result.hosts:
                host_data = {
                    "scan_id": scan_id,
                    "ip_address": host.ip_address,
                    "hostname": host.hostname,
                    "mac_address": host.mac_address,
                    "os_name": host.os_name,
                    "os_family": host.os_family,
                    "os_vendor": host.os_vendor,
                    "os_accuracy": host.os_accuracy,
                    "status": host.status,
                    "latency_ms": host.latency_ms,
                }
                host_response = supabase.table("hosts").insert(host_data).execute()
                host_id = host_response.data[0]["id"]
                host_ids[host.ip_address] = host_id

                # Save ports
                for port in host.ports:
                    port_data = {
                        "host_id": host_id,
                        "port_number": port.number,
                        "protocol": port.protocol,
                        "state": port.state,
                        "service_name": port.service_name,
                        "service_product": port.service_product,
                        "service_version": port.service_version,
                        "service_extrainfo": port.service_extrainfo,
                    }
                    supabase.table("ports").insert(port_data).execute()

            # Save vulnerabilities
            for vuln in result.vulnerabilities:
                # Find host_id for this vulnerability
                host_id = None
                for h in result.hosts:
                    for p in h.ports:
                        if p.number == vuln.port_number:
                            host_id = host_ids.get(h.ip_address)
                            break

                if not host_id:
                    continue

                vuln_data = {
                    "scan_id": scan_id,
                    "host_id": host_id,
                    "cve_id": vuln.cve_id,
                    "title": vuln.title,
                    "severity": vuln.severity,
                    "cvss_score": vuln.cvss_score,
                    "description": vuln.description,
                    "solution": vuln.solution,
                    "nse_script": vuln.nse_script,
                    "raw_output": vuln.raw_output,
                }
                supabase.table("vulnerabilities").insert(vuln_data).execute()

            # Update scan as completed
            supabase.table("scans").update({
                "status": "completed",
                "progress": 100,
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", scan_id).execute()

            logger.info(f"Scan {scan_id} completed successfully")

        else:
            # Update scan as failed
            supabase.table("scans").update({
                "status": "failed",
                "error_message": result.error_message,
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", scan_id).execute()

            logger.error(f"Scan {scan_id} failed: {result.error_message}")

    except Exception as e:
        logger.exception(f"Error in scan task: {e}")

        # Update scan as failed
        supabase.table("scans").update({
            "status": "failed",
            "error_message": str(e),
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", scan_id).execute()

        # Retry the task
        raise self.retry(exc=e)


def update_scan_progress(scan_id: str, message: str):
    """Update scan progress in database."""
    try:
        # Simple progress update - in production, parse actual progress from message
        supabase.table("scans").update({
            "progress": 50,  # Placeholder
        }).eq("id", scan_id).execute()
    except Exception as e:
        logger.warning(f"Failed to update progress: {e}")
