# NetVuln Scanner

A comprehensive network vulnerability scanner powered by Nmap with a modern web dashboard, role-based access control, and detailed reporting capabilities.

## Features

- **Network Discovery & Mapping**: Full network discovery across subnets using Nmap
- **Vulnerability Detection**: CVE mapping with CVSS scores using Nmap NSE scripts
- **Multiple Scan Types**: Quick, Full, Vulnerability, Stealth, Service Detection, OS Detection
- **Report Generation**: Export detailed reports in PDF, CSV, and JSON formats
- **Role-Based Access Control**: Admin, Analyst, and Viewer roles
- **Scheduled Scans**: Set up recurring automated scans
- **Interactive Dashboard**: Real-time monitoring and statistics

## Architecture

```
netvuln-scanner/
├── frontend/           # React + TypeScript frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Page components
│   │   ├── contexts/   # React contexts
│   │   └── lib/        # Utilities
│   └── ...
├── backend/            # Python FastAPI backend
│   ├── app/
│   │   ├── api/        # REST API endpoints
│   │   ├── auth/       # Authentication & RBAC
│   │   ├── models/     # Database models & schemas
│   │   ├── reports/    # Report generation
│   │   ├── scanner/    # Nmap scanner module
│   │   └── tasks/      # Celery background tasks
│   ├── main.py         # FastAPI application
│   └── celery_app.py   # Celery configuration
└── supabase/           # Database (via Supabase)
```

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Nmap** (for scanning)
- **Redis** (for task queue)
- **Supabase Account** (for database and auth)

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd netvuln-scanner
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_KEY="your-supabase-anon-key"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
export SUPABASE_DB_URL="your-postgres-connection-string"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY="your-random-secret-key"

# Run database migrations (handled via Supabase)
# Start Redis
redis-server

# Start Celery worker
celery -A celery_app worker --loglevel=info

# Start Celery beat (scheduler)
celery -A celery_app beat --loglevel=info

# Start API server
uvicorn main:app --reload
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev
```

### 4. Docker Deployment

```bash
# Build and run all services
docker-compose up -d

# Check logs
docker-compose logs -f api
```

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_DB_URL` | PostgreSQL connection string |
| `REDISE_URL` | Redis connection URL |
| `SECRET_KEY` | Application secret key |
| `DEBUG` | Enable debug mode |
| `USE_MOCK_SCANNER` | Use mock scanner for testing |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

## Scan Types

| Type | Description | Nmap Options |
|------|-------------|--------------|
| Quick | Fast scan (top 100 ports) | `-T4 -F` |
| Full | All 65535 ports | `-p- -sV` |
| Vulnerability | CVE detection scripts | `--script vuln` |
| Stealth | SYN scan | `-sS` |
| Service Detection | Version detection | `-sV --version-intensity 5` |
| OS Detection | OS fingerprinting | `-O` |

## Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage users, run scans, view all reports |
| **Analyst** | Run scans, view reports, export data |
| **Viewer** | Read-only access to reports |

## API Endpoints

### Authentication
All endpoints require Bearer token authentication via Supabase JWT.

### Scans
- `GET /api/scans` - List scans
- `POST /api/scans` - Create new scan
- `GET /api/scans/{id}` - Get scan details
- `GET /api/scans/{id}/hosts` - Get discovered hosts
- `GET /api/scans/{id}/vulnerabilities` - Get vulnerabilities
- `DELETE /api/scans/{id}` - Delete scan

### Reports
- `GET /api/reports` - List reports
- `POST /api/reports` - Generate report
- `GET /api/reports/{id}/download` - Download report
- `DELETE /api/reports/{id}` - Delete report

### Vulnerabilities
- `GET /api/vulnerabilities` - List vulnerabilities
- `GET /api/vulnerabilities/stats` - Get statistics

### Users (Admin)
- `GET /api/users` - List users
- `GET /api/users/{id}` - Get user details
- `PATCH /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### Audit Logs (Admin)
- `GET /api/audit` - List audit logs

## Scheduled Scans

Configure recurring scans using cron syntax:

```python
# Daily at midnight
schedule = "0 0 * * *"

# Weekly on Sunday
schedule = "0 0 * * 0"

# Monthly on the 1st
schedule = "0 0 1 * *"
```

## Sample Reports

Reports include:
- Executive summary with risk assessment
- Host inventory with open ports
- Vulnerability findings with CVE references
- Step-by-step remediation recommendations

## Security Considerations

1. **Input Validation**: All scan targets are validated (IP, CIDR, hostname)
2. **Rate Limiting**: API endpoints are rate-limited
3. **RLS Policies**: Row-Level Security enabled on all tables
4. **Audit Logging**: All actions are logged

## Development

### Running Tests

```bash
# Backend tests
cd backend
pytest --cov=app

# Frontend tests
cd frontend
npm run test
```

### Linting

```bash
# Backend
black app/
isort app/
flake8 app/
mypy app/

# Frontend
npm run lint
```

## Troubleshooting

### Nmap Permission Errors
Nmap requires root/admin privileges for certain scan types (`-sS`, `-O`). Run with appropriate permissions or use Docker with capabilities.

### Database Connection Issues
Verify your Supabase credentials and ensure the database is accessible from your environment.

### Task Queue Not Processing
Check Redis connectivity and ensure Celery workers are running.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Support

For issues and feature requests, please use GitHub Issues.
