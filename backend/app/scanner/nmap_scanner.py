import subprocess
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import re
import asyncio
import logging
import os

logger = logging.getLogger(__name__)


@dataclass
class PortResult:
    number: int
    protocol: str
    state: str
    service_name: Optional[str] = None
    service_product: Optional[str] = None
    service_version: Optional[str] = None
    service_extrainfo: Optional[str] = None
    scripts: List[Dict[str, Any]] = None

    def __post_init__(self):
        if self.scripts is None:
            self.scripts = []


@dataclass
class HostResult:
    ip_address: str
    hostname: Optional[str] = None
    mac_address: Optional[str] = None
    os_name: Optional[str] = None
    os_family: Optional[str] = None
    os_vendor: Optional[str] = None
    os_accuracy: Optional[int] = None
    status: str = "up"
    latency_ms: Optional[float] = None
    ports: List[PortResult] = None

    def __post_init__(self):
        if self.ports is None:
            self.ports = []


@dataclass
class VulnerabilityResult:
    cve_id: Optional[str]
    title: str
    severity: str
    cvss_score: Optional[float] = None
    description: Optional[str] = None
    solution: Optional[str] = None
    nse_script: Optional[str] = None
    raw_output: Optional[str] = None
    port_number: Optional[int] = None


@dataclass
class ScanResult:
    hosts: List[HostResult]
    vulnerabilities: List[VulnerabilityResult]
    raw_xml: str
    command: str
    success: bool
    error_message: Optional[str] = None


class NmapScanner:
    """Nmap scanner wrapper for network vulnerability scanning."""

    def __init__(self, nmap_path: str = "/usr/bin/nmap"):
        self.nmap_path = nmap_path
        self._validate_nmap()

    def _validate_nmap(self):
        """Check if nmap is available."""
        if not os.path.exists(self.nmap_path):
            logger.warning(f"Nmap not found at {self.nmap_path}. Using mock mode.")
            self.nmap_path = "nmap"

    def _build_command(
        self,
        target: str,
        scan_type: str,
        ports: Optional[str] = None,
        timing: int = 4,
        enable_os: bool = False,
        enable_service: bool = False,
    ) -> List[str]:
        """Build nmap command based on scan type."""
        cmd = [
            self.nmap_path,
            "-oX", "-",  # Output XML to stdout
            "-T" + str(timing),  # Timing template
            "-v",  # Verbose
        ]

        # Add scan type specific options
        if scan_type == "quick":
            cmd.extend(["-F"])  # Fast scan (top 100 ports)
        elif scan_type == "full":
            cmd.extend(["-p-"])  # All 65535 ports
        elif scan_type == "vulnerability":
            cmd.extend(["--script", "vuln"])  # Vulnerability scripts
        elif scan_type == "stealth":
            cmd.extend(["-sS"])  # SYN scan
        elif scan_type == "service":
            cmd.extend(["-sV", "--version-intensity", "5"])
        elif scan_type == "os":
            cmd.extend(["-O"])  # OS detection

        # Additional options
        if enable_os and scan_type != "os":
            cmd.append("-O")
        if enable_service and scan_type not in ["service", "vulnerability"]:
            cmd.append("-sV")

        if ports:
            cmd.extend(["-p", ports])

        cmd.append(target)
        return cmd

    async def scan(
        self,
        target: str,
        scan_type: str = "quick",
        ports: Optional[str] = None,
        timing: int = 4,
        enable_os: bool = False,
        enable_service: bool = False,
        timeout: int = 600,
        progress_callback: Optional[callable] = None,
    ) -> ScanResult:
        """Execute an Nmap scan asynchronously."""
        cmd = self._build_command(
            target, scan_type, ports, timing, enable_os, enable_service
        )

        logger.info(f"Starting scan with command: {' '.join(cmd)}")

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout_lines = []
            stderr_lines = []

            async def read_stream(stream, lines, is_progress=False):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    line = line.decode('utf-8', errors='ignore')
                    lines.append(line)
                    if is_progress and progress_callback:
                        # Parse progress from stderr
                        if "Discovered" in line or "Completed" in line:
                            progress_callback(line)

            await asyncio.gather(
                read_stream(process.stdout, stdout_lines),
                read_stream(process.stderr, stderr_lines, is_progress=True)
            )

            await process.wait()

            raw_xml = "".join(stdout_lines)
            stderr_output = "".join(stderr_lines)

            if process.returncode != 0:
                logger.error(f"Nmap failed with code {process.returncode}: {stderr_output}")
                return ScanResult(
                    hosts=[],
                    vulnerabilities=[],
                    raw_xml=raw_xml,
                    command=" ".join(cmd),
                    success=False,
                    error_message=stderr_output
                )

            # Parse XML output
            hosts, vulnerabilities = self._parse_xml(raw_xml)

            return ScanResult(
                hosts=hosts,
                vulnerabilities=vulnerabilities,
                raw_xml=raw_xml,
                command=" ".join(cmd),
                success=True
            )

        except asyncio.TimeoutError:
            logger.error("Scan timed out")
            return ScanResult(
                hosts=[],
                vulnerabilities=[],
                raw_xml="",
                command=" ".join(cmd),
                success=False,
                error_message="Scan timed out"
            )
        except Exception as e:
            logger.exception("Scan failed with exception")
            return ScanResult(
                hosts=[],
                vulnerabilities=[],
                raw_xml="",
                command=" ".join(cmd),
                success=False,
                error_message=str(e)
            )

    def _parse_xml(self, xml_data: str) -> tuple:
        """Parse Nmap XML output."""
        hosts = []
        vulnerabilities = []

        try:
            root = ET.fromstring(xml_data)
        except ET.ParseError as e:
            logger.error(f"Failed to parse XML: {e}")
            return hosts, vulnerabilities

        for host_elem in root.findall(".//host"):
            host = self._parse_host(host_elem)
            hosts.append(host)

            # Parse vulnerabilities from script output
            for port in host.ports:
                for script in port.scripts:
                    vulns = self._parse_vulnerability_script(
                        script, host.ip_address, port.number
                    )
                    vulnerabilities.extend(vulns)

        return hosts, vulnerabilities

    def _parse_host(self, host_elem) -> HostResult:
        """Parse a single host element."""
        # Get address info
        ip_address = None
        mac_address = None

        for addr in host_elem.findall("address"):
            addr_type = addr.get("addrtype")
            if addr_type == "ipv4":
                ip_address = addr.get("addr")
            elif addr_type == "mac":
                mac_address = addr.get("addr")

        # Get hostname
        hostname = None
        hostnames = host_elem.find(".//hostnames")
        if hostnames is not None:
            for h in hostnames.findall("hostname"):
                hostname = h.get("name")
                break

        # Get status
        status_elem = host_elem.find("status")
        status = status_elem.get("state", "unknown") if status_elem is not None else "unknown"

        # Get latency
        latency = None
        times = host_elem.find(".//times")
        if times is not None:
            srtt = times.get("srtt")
            if srtt:
                latency = float(srtt) / 1000  # Convert to ms

        # Parse OS detection
        os_name = None
        os_family = None
        os_vendor = None
        os_accuracy = None
        os_match = host_elem.find(".//osmatch")
        if os_match is not None:
            os_name = os_match.get("name")
            os_accuracy = int(os_match.get("accuracy", 0))
            os_class = os_match.find(".//osclass")
            if os_class is not None:
                os_family = os_class.get("osfamily")
                os_vendor = os_class.get("vendor")

        # Parse ports
        ports = []
        ports_elem = host_elem.find("ports")
        if ports_elem is not None:
            for port_elem in ports_elem.findall("port"):
                port = self._parse_port(port_elem)
                ports.append(port)

        return HostResult(
            ip_address=ip_address or "unknown",
            hostname=hostname,
            mac_address=mac_address,
            os_name=os_name,
            os_family=os_family,
            os_vendor=os_vendor,
            os_accuracy=os_accuracy,
            status=status,
            latency_ms=latency,
            ports=ports
        )

    def _parse_port(self, port_elem) -> PortResult:
        """Parse a single port element."""
        port_id = port_elem.get("portid")
        protocol = port_elem.get("protocol")

        state_elem = port_elem.find("state")
        state = state_elem.get("state") if state_elem is not None else "unknown"

        service = port_elem.find("service")
        service_name = service.get("name") if service is not None else None
        service_product = service.get("product") if service is not None else None
        service_version = service.get("version") if service is not None else None
        service_extrainfo = service.get("extrainfo") if service is not None else None

        # Parse scripts
        scripts = []
        for script in port_elem.findall("script"):
            scripts.append({
                "id": script.get("id"),
                "output": script.get("output"),
                "elems": [
                    {"key": e.get("key"), "value": e.get("value")}
                    for e in script.findall("elem")
                ]
            })

        return PortResult(
            number=int(port_id),
            protocol=protocol,
            state=state,
            service_name=service_name,
            service_product=service_product,
            service_version=service_version,
            service_extrainfo=service_extrainfo,
            scripts=scripts
        )

    def _parse_vulnerability_script(
        self, script: Dict, ip: str, port: int
    ) -> List[VulnerabilityResult]:
        """Parse vulnerability script output."""
        vulnerabilities = []
        script_id = script.get("id", "")
        output = script.get("output", "")

        # Common vulnerability script patterns
        cve_pattern = r'CVE-\d{4}-\d{4,}'

        if "vuln" in script_id or "CVE" in output or "VULNERABLE" in output.upper():
            # Find CVE IDs
            cve_matches = re.findall(cve_pattern, output)

            if cve_matches:
                for cve_id in cve_matches:
                    severity = self._estimate_severity(output)
                    vulnerabilities.append(VulnerabilityResult(
                        cve_id=cve_id,
                        title=f"{cve_id} detected on port {port}",
                        severity=severity,
                        description=output[:500],
                        nse_script=script_id,
                        raw_output=output,
                        port_number=port
                    ))
            else:
                # Generic vulnerability finding
                severity = self._estimate_severity(output)
                vulnerabilities.append(VulnerabilityResult(
                    cve_id=None,
                    title=f"Vulnerability detected on port {port}",
                    severity=severity,
                    description=output[:500],
                    nse_script=script_id,
                    raw_output=output,
                    port_number=port
                ))

        return vulnerabilities

    def _estimate_severity(self, output: str) -> str:
        """Estimate vulnerability severity from script output."""
        output_lower = output.lower()

        if any(term in output_lower for term in ["critical", "remote code execution", "rce"]):
            return "critical"
        elif any(term in output_lower for term in ["high", "privilege escalation", "sql injection"]):
            return "high"
        elif any(term in output_lower for term in ["medium", "xss", "csrf"]):
            return "medium"
        elif any(term in output_lower for term in ["low", "information disclosure"]):
            return "low"
        else:
            return "informational"


# Mock scanner for development/testing
class MockScanner:
    """Mock scanner that generates sample data for testing."""

    async def scan(self, target: str, scan_type: str, **kwargs) -> ScanResult:
        """Generate mock scan results."""
        sample_hosts = [
            HostResult(
                ip_address="192.168.1.1",
                hostname="gateway.local",
                os_name="Linux 5.4",
                os_family="Linux",
                os_accuracy=95,
                status="up",
                latency_ms=0.5,
                ports=[
                    PortResult(22, "tcp", "open", "ssh", "OpenSSH", "8.2p1"),
                    PortResult(80, "tcp", "open", "http", "nginx", "1.18.0"),
                    PortResult(443, "tcp", "open", "https", "nginx", "1.18.0"),
                ]
            ),
            HostResult(
                ip_address="192.168.1.100",
                hostname="workstation.local",
                os_name="Windows 10",
                os_family="Windows",
                os_accuracy=90,
                status="up",
                latency_ms=1.2,
                ports=[
                    PortResult(135, "tcp", "open", "msrpc", "Microsoft Windows RPC"),
                    PortResult(445, "tcp", "open", "microsoft-ds", "Windows Server 2019"),
                    PortResult(3389, "tcp", "open", "rdp", "Microsoft Terminal Services"),
                ]
            ),
            HostResult(
                ip_address="192.168.1.200",
                hostname="server.local",
                os_name="Ubuntu 20.04",
                os_family="Linux",
                os_accuracy=98,
                status="up",
                latency_ms=0.8,
                ports=[
                    PortResult(22, "tcp", "open", "ssh", "OpenSSH", "8.2p1"),
                    PortResult(3306, "tcp", "open", "mysql", "MySQL", "8.0.25"),
                    PortResult(8080, "tcp", "open", "http-proxy", "Apache Tomcat", "9.0.50"),
                ]
            )
        ]

        sample_vulnerabilities = [
            VulnerabilityResult(
                cve_id="CVE-2021-44228",
                title="Apache Log4j Remote Code Execution",
                severity="critical",
                cvss_score=10.0,
                description="Apache Log4j2 2.0-beta9 through 2.15.0 (excluding security releases) JNDI features...",
                solution="Upgrade to Log4j 2.17.0 or later",
                port_number=8080
            ),
            VulnerabilityResult(
                cve_id="CVE-2021-34527",
                title="Windows Print Spooler Remote Code Execution",
                severity="critical",
                cvss_score=9.0,
                description="Windows Print Spooler service improperly performs privileged file operations...",
                solution="Disable Print Spooler service or apply Microsoft security update",
                port_number=445
            ),
            VulnerabilityResult(
                cve_id="CVE-2021-3711",
                title="OpenSSL SM2 Decryption Buffer Overflow",
                severity="high",
                cvss_score=8.1,
                description="Buffer overflow in OpenSSL SM2 decryption...",
                solution="Upgrade OpenSSL to version 1.1.1l or later",
                port_number=443
            ),
        ]

        return ScanResult(
            hosts=sample_hosts,
            vulnerabilities=sample_vulnerabilities,
            raw_xml="<?xml version='1.0'?>\n<!-- Mock scan result -->",
            command=f"nmap -sV -sC {target}",
            success=True
        )
