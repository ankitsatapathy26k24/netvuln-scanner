import csv
import json
import io
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID
import logging

logger = logging.getLogger(__name__)


class ReportGenerator:
    """Generate reports in various formats."""

    def __init__(self):
        pass

    def generate_json_report(self, scan_data: Dict[str, Any]) -> str:
        """Generate a JSON report."""
        report = {
            "meta": {
                "generated_at": datetime.utcnow().isoformat(),
                "report_type": "network_vulnerability_scan",
                "version": "1.0.0"
            },
            "executive_summary": self._generate_executive_summary(scan_data),
            "scan_info": {
                "id": str(scan_data.get("id", "")),
                "name": scan_data.get("name", ""),
                "target": scan_data.get("target", ""),
                "type": scan_data.get("scan_type", ""),
                "status": scan_data.get("status", ""),
                "started_at": scan_data.get("started_at"),
                "completed_at": scan_data.get("completed_at"),
            },
            "hosts": scan_data.get("hosts", []),
            "vulnerabilities": scan_data.get("vulnerabilities", []),
            "statistics": self._calculate_statistics(scan_data)
        }
        return json.dumps(report, indent=2, default=str)

    def generate_csv_report(self, scan_data: Dict[str, Any]) -> str:
        """Generate a CSV report."""
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "Host IP", "Hostname", "Port", "Protocol", "State", "Service",
            "Version", "CVE ID", "Vulnerability", "Severity", "CVSS Score", "Solution"
        ])

        # Create a mapping of hosts and vulnerabilities
        hosts = scan_data.get("hosts", [])
        vulnerabilities = scan_data.get("vulnerabilities", [])

        host_map = {h.get("id"): h for h in hosts}

        # Write vulnerabilities
        for vuln in vulnerabilities:
            host_id = vuln.get("host_id")
            host = host_map.get(host_id, {})

            writer.writerow([
                host.get("ip_address", ""),
                host.get("hostname", ""),
                vuln.get("port_number", ""),
                "tcp",
                "open",
                "",
                "",
                vuln.get("cve_id", ""),
                vuln.get("title", ""),
                vuln.get("severity", ""),
                vuln.get("cvss_score", ""),
                vuln.get("solution", "")[:100] if vuln.get("solution") else ""
            ])

        # Write hosts without vulnerabilities
        vuln_host_ids = {v.get("host_id") for v in vulnerabilities}
        for host in hosts:
            if host.get("id") not in vuln_host_ids:
                for port in host.get("ports", []):
                    writer.writerow([
                        host.get("ip_address", ""),
                        host.get("hostname", ""),
                        port.get("port_number", ""),
                        port.get("protocol", ""),
                        port.get("state", ""),
                        port.get("service_name", ""),
                        f"{port.get('service_product', '')} {port.get('service_version', '')}".strip(),
                        "", "", "", "", ""
                    ])

        return output.getvalue()

    def generate_pdf_report(self, scan_data: Dict[str, Any]) -> bytes:
        """Generate a PDF report using pure Python (no external dependencies)."""
        # This is a simplified PDF generation without ReportLab
        # For production, use ReportLab or WeasyPrint
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors
            from reportlab.lib.units import inch
        except ImportError:
            # Fall back to HTML-to-text if ReportLab not available
            logger.warning("ReportLab not installed, generating HTML instead")
            return self._generate_html_report_bytes(scan_data)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()

        elements = []

        # Title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30
        )
        elements.append(Paragraph("Network Vulnerability Scan Report", title_style))
        elements.append(Spacer(1, 12))

        # Executive Summary
        elements.append(Paragraph("Executive Summary", styles['Heading2']))
        summary = self._generate_executive_summary(scan_data)
        elements.append(Paragraph(summary["overview"], styles['Normal']))
        elements.append(Spacer(1, 12))

        # Statistics Table
        elements.append(Paragraph("Scan Statistics", styles['Heading2']))
        stats_data = [
            ["Metric", "Value"],
            ["Total Hosts", str(summary["hosts_count"])],
            ["Open Ports", str(summary["ports_count"])],
            ["Critical Vulnerabilities", str(summary["vulnerabilities"]["critical"])],
            ["High Vulnerabilities", str(summary["vulnerabilities"]["high"])],
            ["Medium Vulnerabilities", str(summary["vulnerabilities"]["medium"])],
            ["Low Vulnerabilities", str(summary["vulnerabilities"]["low"])],
        ]
        table = Table(stats_data, colWidths=[3*inch, 2*inch])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(table)
        elements.append(PageBreak())

        # Vulnerabilities
        elements.append(Paragraph("Vulnerabilities Found", styles['Heading2']))
        vulns = scan_data.get("vulnerabilities", [])

        for i, vuln in enumerate(vulns[:50], 1):  # Limit to 50 for PDF
            elements.append(Paragraph(
                f"{i}. {vuln.get('title', 'Unknown')}",
                styles['Heading3']
            ))
            elements.append(Paragraph(
                f"<b>Severity:</b> {vuln.get('severity', 'Unknown').upper()}",
                styles['Normal']
            ))
            if vuln.get("cve_id"):
                elements.append(Paragraph(
                    f"<b>CVE:</b> {vuln.get('cve_id')}",
                    styles['Normal']
                ))
            if vuln.get("description"):
                elements.append(Paragraph(
                    f"<b>Description:</b> {vuln.get('description')[:500]}",
                    styles['Normal']
                ))
            if vuln.get("solution"):
                elements.append(Paragraph(
                    f"<b>Remediation:</b> {vuln.get('solution')[:300]}",
                    styles['Normal']
                ))
            elements.append(Spacer(1, 12))

        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()

    def _generate_html_report_bytes(self, scan_data: Dict[str, Any]) -> bytes:
        """Generate HTML report as fallback for PDF."""
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Network Vulnerability Scan Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 40px; }}
                h1 {{ color: #2563eb; }}
                h2 {{ color: #1e40af; margin-top: 30px; }}
                table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                th {{ background-color: #2563eb; color: white; }}
                .critical {{ color: #dc2626; font-weight: bold; }}
                .high {{ color: #ea580c; font-weight: bold; }}
                .medium {{ color: #2563eb; }}
                .low {{ color: #16a34a; }}
            </style>
        </head>
        <body>
            <h1>Network Vulnerability Scan Report</h1>
            <h2>Executive Summary</h2>
            <p>Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}</p>
            <p>Target: {scan_data.get('target', 'Unknown')}</p>
            <p>Scan Type: {scan_data.get('scan_type', 'Unknown')}</p>

            <h2>Statistics</h2>
            <table>
                <tr><th>Metric</th><th>Value</th></tr>
                <tr><td>Total Hosts</td><td>{len(scan_data.get('hosts', []))}</td></tr>
                <tr><td>Total Vulnerabilities</td><td>{len(scan_data.get('vulnerabilities', []))}</td></tr>
            </table>

            <h2>Vulnerabilities</h2>
            <table>
                <tr>
                    <th>CVE</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>CVSS</th>
                </tr>
        """

        for vuln in scan_data.get('vulnerabilities', []):
            html += f"""
                <tr>
                    <td>{vuln.get('cve_id', 'N/A')}</td>
                    <td>{vuln.get('title', 'Unknown')}</td>
                    <td class="{vuln.get('severity', '')}">{vuln.get('severity', 'Unknown').upper()}</td>
                    <td>{vuln.get('cvss_score', 'N/A')}</td>
                </tr>
            """

        html += """
            </table>
        </body>
        </html>
        """
        return html.encode('utf-8')

    def _generate_executive_summary(self, scan_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate executive summary."""
        hosts = scan_data.get("hosts", [])
        vulns = scan_data.get("vulnerabilities", [])

        vuln_counts = {
            "critical": len([v for v in vulns if v.get("severity") == "critical"]),
            "high": len([v for v in vulns if v.get("severity") == "high"]),
            "medium": len([v for v in vulns if v.get("severity") == "medium"]),
            "low": len([v for v in vulns if v.get("severity") == "low"]),
            "informational": len([v for v in vulns if v.get("severity") == "informational"]),
        }

        total_ports = sum(len(h.get("ports", [])) for h in hosts)

        risk_level = "Low"
        if vuln_counts["critical"] > 0:
            risk_level = "Critical"
        elif vuln_counts["high"] > 0:
            risk_level = "High"
        elif vuln_counts["medium"] > 0:
            risk_level = "Medium"

        overview = (
            f"This scan discovered {len(hosts)} hosts with {total_ports} open ports. "
            f"A total of {len(vulns)} vulnerabilities were identified, including "
            f"{vuln_counts['critical']} critical and {vuln_counts['high']} high severity issues. "
            f"Overall risk assessment: {risk_level}."
        )

        return {
            "overview": overview,
            "risk_level": risk_level,
            "hosts_count": len(hosts),
            "ports_count": total_ports,
            "vulnerabilities": vuln_counts
        }

    def _calculate_statistics(self, scan_data: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate scan statistics."""
        hosts = scan_data.get("hosts", [])
        vulns = scan_data.get("vulnerabilities", [])

        services = {}
        os_distribution = {}

        for host in hosts:
            for port in host.get("ports", []):
                service = port.get("service_name") or "unknown"
                services[service] = services.get(service, 0) + 1

            os = host.get("os_name") or "Unknown"
            os_distribution[os] = os_distribution.get(os, 0) + 1

        return {
            "services": services,
            "os_distribution": os_distribution,
            "vulnerability_count": len(vulns),
            "host_count": len(hosts)
        }
