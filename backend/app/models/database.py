import enum
from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, Integer, Float, Boolean, Text, ForeignKey, Enum as SQLEnum, ARRAY, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from ..database import Base


class ScanType(str, enum.Enum):
    QUICK = "quick"
    FULL = "full"
    VULNERABILITY = "vulnerability"
    STEALTH = "stealth"
    SERVICE = "service"
    OS = "os"


class ScanStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Severity(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFORMATIONAL = "informational"


class Role(str, enum.Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class Protocol(str, enum.Enum):
    TCP = "tcp"
    UDP = "udp"
    SCTP = "sctp"


class User(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String)
    role = Column(String, default=Role.VIEWER.value)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scans = relationship("Scan", back_populates="user")
    reports = relationship("Report", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    name = Column(String, nullable=False)
    target = Column(String, nullable=False)
    scan_type = Column(String, nullable=False)
    status = Column(String, default=ScanStatus.PENDING.value)
    progress = Column(Integer, default=0)
    options = Column(JSON, default={})
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="scans")
    hosts = relationship("Host", back_populates="scan", cascade="all, delete-orphan")
    vulnerabilities = relationship("Vulnerability", back_populates="scan", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="scan", cascade="all, delete-orphan")


class Host(Base):
    __tablename__ = "hosts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False)
    ip_address = Column(String, nullable=False)
    hostname = Column(String)
    mac_address = Column(String)
    os_name = Column(String)
    os_family = Column(String)
    os_vendor = Column(String)
    os_accuracy = Column(Integer)
    status = Column(String, default="up")
    latency_ms = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)

    scan = relationship("Scan", back_populates="hosts")
    ports = relationship("Port", back_populates="host", cascade="all, delete-orphan")
    vulnerabilities = relationship("Vulnerability", back_populates="host", cascade="all, delete-orphan")


class Port(Base):
    __tablename__ = "ports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    host_id = Column(UUID(as_uuid=True), ForeignKey("hosts.id"), nullable=False)
    port_number = Column(Integer, nullable=False)
    protocol = Column(String, nullable=False)
    state = Column(String, nullable=False)
    service_name = Column(String)
    service_product = Column(String)
    service_version = Column(String)
    service_extrainfo = Column(String)
    service_hostname = Column(String)
    service_ostype = Column(String)
    scripts_run = Column(ARRAY(String))
    created_at = Column(DateTime, default=datetime.utcnow)

    host = relationship("Host", back_populates="ports")
    vulnerabilities = relationship("Vulnerability", back_populates="port")


class Vulnerability(Base):
    __tablename__ = "vulnerabilities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    port_id = Column(UUID(as_uuid=True), ForeignKey("ports.id"))
    host_id = Column(UUID(as_uuid=True), ForeignKey("hosts.id"), nullable=False)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False)
    cve_id = Column(String)
    cve_name = Column(String)
    severity = Column(String, nullable=False)
    cvss_score = Column(Float)
    title = Column(String, nullable=False)
    description = Column(Text)
    solution = Column(Text)
    cve_refs = Column(ARRAY(String))
    nse_script = Column(String)
    raw_output = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    scan = relationship("Scan", back_populates="vulnerabilities")
    host = relationship("Host", back_populates="vulnerabilities")
    port = relationship("Port", back_populates="vulnerabilities")


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    scan_id = Column(UUID(as_uuid=True), ForeignKey("scans.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    name = Column(String, nullable=False)
    format = Column(String, nullable=False)
    file_path = Column(String)
    file_size = Column(Integer)
    includes_executive_summary = Column(Boolean, default=True)
    includes_remediation = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    scan = relationship("Scan", back_populates="reports")
    user = relationship("User", back_populates="reports")


class ScheduledScan(Base):
    __tablename__ = "scheduled_scans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    name = Column(String, nullable=False)
    target = Column(String, nullable=False)
    scan_type = Column(String, nullable=False)
    schedule_cron = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    options = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=False)
    resource_id = Column(UUID(as_uuid=True))
    details = Column(JSON, default={})
    ip_address = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")
