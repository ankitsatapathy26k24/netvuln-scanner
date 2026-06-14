from fastapi import APIRouter
from .scans import router as scans_router
from .reports import router as reports_router
from .users import router as users_router
from .audit import router as audit_router
from .vulnerabilities import router as vulnerabilities_router

api_router = APIRouter()
api_router.include_router(scans_router, prefix="/scans", tags=["scans"])
api_router.include_router(reports_router, prefix="/reports", tags=["reports"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(audit_router, prefix="/audit", tags=["audit"])
api_router.include_router(vulnerabilities_router, prefix="/vulnerabilities", tags=["vulnerabilities"])
