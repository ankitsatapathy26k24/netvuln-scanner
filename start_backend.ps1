$env:SUPABASE_URL = "https://nwlakxjmkeszsqqywrzt.supabase.co"
$env:SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53bGFreGpta2VzenNxcXl3cnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjIyNDEsImV4cCI6MjA5NjgzODI0MX0.svc6aq7xZGdeuVaQuxtfEzLVIqbsENtSqIJ1yOkwlco"
$env:SUPABASE_DB_URL = "postgresql://postgres.nwlakxjmkeszsqqywrzt:postgres@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
Set-Location "c:\Users\ANKIT\OneDrive\Desktop\project\backend"
& "c:\Users\ANKIT\OneDrive\Desktop\project\.venv\Scripts\uvicorn.exe" main:app --host 0.0.0.0 --port 8000 --reload
