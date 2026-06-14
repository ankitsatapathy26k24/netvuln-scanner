from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
import re


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    id: UUID
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScanBase(BaseModel):
    name: str
    target: str
    scan_type: str

    @field_validator('target')
    @classmethod
    def validate_target(cls, v):
        # Validate IP address, CIDR, or hostname
        cidr_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$'
        ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
        hostname_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$'
        range_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}$'

        if not (re.match(cidr_pattern, v) or re.match(ip_pattern, v) or
                re.match(hostname_pattern, v) or re.match(range_pattern, v)):
            raise ValueError('Invalid target format. Use IP, CIDR, hostname, or range')
        return v

    @field_validator('scan_type')
    @classmethod
    def validate_scan_type(cls, v):
        valid_types = ['quick', 'full', 'vulnerability', 'stealth', 'service', 'os']
        if v not in valid_types:
            raise ValueError(f'Invalid scan type. Must be one of: {valid_types}')
        return v


class ScanCreate(ScanBase):
    options: Optional[Dict[str, Any]] = {}


class ScanUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    error_message: Optional[str] = None


class ScanResponse(ScanBase):
    id: UUID
    user_id: UUID
    status: str
    progress: int
    options: Dict[str, Any]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HostBase(BaseModel):
    ip_address: str
    hostname: Optional[str] = None
    mac_address: Optional[str] = None
    os_name: Optional[str] = None
    os_family: Optional[str] = None
    os_vendor: Optional[str] = None
    os_accuracy: Optional[int] = None
    status: str = "up"
    latency_ms: Optional[float] = None


class HostCreate(HostBase):
    scan_id: UUID


class HostResponse(HostBase):
    id: UUID
    scan_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class PortBase(BaseModel):
    port_number: int
    protocol: str
    state: str
    service_name: Optional[str] = None
    service_product: Optional[str] = None
    service_version: Optional[str] = None
    service_extrainfo: Optional[str] = None
    service_hostname: Optional[str] = None
    service_ostype: Optional[str] = None
    scripts_run: Optional[List[str]] = None


class PortCreate(PortBase):
    host_id: UUID


class PortResponse(PortBase):
    id: UUID
    host_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class VulnerabilityBase(BaseModel):
    cve_id: Optional[str] = None
    cve_name: Optional[str] = None
    severity: str
    cvss_score: Optional[float] = None
    title: str
    description: Optional[str] = None
    solution: Optional[str] = None
    cve_refs: Optional[List[str]] = None
    nse_script: Optional[str] = None
    raw_output: Optional[str] = None


class VulnerabilityCreate(VulnerabilityBase):
    port_id: Optional[UUID] = None
    host_id: UUID
    scan_id: UUID


class VulnerabilityResponse(VulnerabilityBase):
    id: UUID
    port_id: Optional[UUID]
    host_id: UUID
    scan_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class ReportBase(BaseModel):
    name: str
    format: str
    includes_executive_summary: bool = True
    includes_remediation: bool = True


class ReportCreate(ReportBase):
    scan_id: UUID


class ReportResponse(ReportBase):
    id: UUID
    scan_id: UUID
    user_id: UUID
    file_path: Optional[str]
    file_size: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduledScanBase(BaseModel):
    name: str
    target: str
    scan_type: str
    schedule_cron: str
    options: Optional[Dict[str, Any]] = {}


class ScheduledScanCreate(ScheduledScanBase):
    pass


class ScheduledScanUpdate(BaseModel):
    name: Optional[str] = None
    target: Optional[str] = None
    scan_type: Optional[str] = None
    schedule_cron: Optional[str] = None
    is_active: Optional[bool] = None


class ScheduledScanResponse(ScheduledScanBase):
    id: UUID
    user_id: UUID
    is_active: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    action: str
    resource_type: str
    resource_id: Optional[UUID]
    details: Dict[str, Any]
    ip_address: Optional[str]
    user_agent: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ScanStats(BaseModel):
    total_scans: int
    active_scans: int
    total_hosts: int
    vulnerabilities: Dict[str, int]
