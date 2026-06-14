-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'viewer')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scans table
CREATE TABLE public.scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    scan_type TEXT NOT NULL CHECK (scan_type IN ('quick', 'full', 'vulnerability', 'stealth', 'service', 'os')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0,
    options JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hosts table
CREATE TABLE public.hosts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    hostname TEXT,
    mac_address TEXT,
    os_name TEXT,
    os_family TEXT,
    os_vendor TEXT,
    os_accuracy INTEGER,
    status TEXT DEFAULT 'up',
    latency_ms FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ports table
CREATE TABLE public.ports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
    port_number INTEGER NOT NULL,
    protocol TEXT NOT NULL CHECK (protocol IN ('tcp', 'udp', 'sctp')),
    state TEXT NOT NULL,
    service_name TEXT,
    service_product TEXT,
    service_version TEXT,
    service_extrainfo TEXT,
    service_hostname TEXT,
    service_ostype TEXT,
    scripts_run TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vulnerabilities table
CREATE TABLE public.vulnerabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    port_id UUID REFERENCES public.ports(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
    scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    cve_id TEXT,
    cve_name TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),
    cvss_score FLOAT,
    title TEXT NOT NULL,
    description TEXT,
    solution TEXT,
    cve_refs TEXT[],
    nse_script TEXT,
    raw_output TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports table
CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('pdf', 'csv', 'json')),
    file_path TEXT,
    file_size INTEGER,
    includes_executive_summary BOOLEAN DEFAULT true,
    includes_remediation BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled scans table
CREATE TABLE public.scheduled_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target TEXT NOT NULL,
    scan_type TEXT NOT NULL,
    schedule_cron TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    options JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_scans_user_id ON public.scans(user_id);
CREATE INDEX idx_scans_status ON public.scans(status);
CREATE INDEX idx_scans_created_at ON public.scans(created_at DESC);
CREATE INDEX idx_hosts_scan_id ON public.hosts(scan_id);
CREATE INDEX idx_ports_host_id ON public.ports(host_id);
CREATE INDEX idx_vulnerabilities_scan_id ON public.vulnerabilities(scan_id);
CREATE INDEX idx_vulnerabilities_severity ON public.vulnerabilities(severity);
CREATE INDEX idx_reports_scan_id ON public.reports(scan_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_scheduled_scans_user_id ON public.scheduled_scans(user_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vulnerabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
    TO authenticated USING (auth.uid() = id);
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
    TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- RLS Policies for scans
CREATE POLICY "select_own_scans" ON public.scans FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_scans" ON public.scans FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_scans" ON public.scans FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_scans" ON public.scans FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for hosts
CREATE POLICY "select_own_hosts" ON public.hosts FOR SELECT
    TO authenticated USING (
        EXISTS (SELECT 1 FROM public.scans WHERE scans.id = hosts.scan_id AND scans.user_id = auth.uid())
    );
CREATE POLICY "insert_own_hosts" ON public.hosts FOR INSERT
    TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.scans WHERE scans.id = hosts.scan_id AND scans.user_id = auth.uid())
    );

-- RLS Policies for ports
CREATE POLICY "select_own_ports" ON public.ports FOR SELECT
    TO authenticated USING (
        EXISTS (SELECT 1 FROM public.hosts h JOIN public.scans s ON s.id = h.scan_id WHERE h.id = ports.host_id AND s.user_id = auth.uid())
    );
CREATE POLICY "insert_own_ports" ON public.ports FOR INSERT
    TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.hosts h JOIN public.scans s ON s.id = h.scan_id WHERE h.id = ports.host_id AND s.user_id = auth.uid())
    );

-- RLS Policies for vulnerabilities
CREATE POLICY "select_own_vulnerabilities" ON public.vulnerabilities FOR SELECT
    TO authenticated USING (
        EXISTS (SELECT 1 FROM public.scans WHERE scans.id = vulnerabilities.scan_id AND scans.user_id = auth.uid())
    );
CREATE POLICY "insert_own_vulnerabilities" ON public.vulnerabilities FOR INSERT
    TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.scans WHERE scans.id = vulnerabilities.scan_id AND scans.user_id = auth.uid())
    );

-- RLS Policies for reports
CREATE POLICY "select_own_reports" ON public.reports FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_reports" ON public.reports FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_reports" ON public.reports FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for scheduled_scans
CREATE POLICY "select_own_scheduled_scans" ON public.scheduled_scans FOR SELECT
    TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_scheduled_scans" ON public.scheduled_scans FOR INSERT
    TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_scheduled_scans" ON public.scheduled_scans FOR UPDATE
    TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_scheduled_scans" ON public.scheduled_scans FOR DELETE
    TO authenticated USING (auth.uid() = user_id);

-- RLS Policies for audit_logs (users can view their own logs)
CREATE POLICY "select_own_audit_logs" ON public.audit_logs FOR SELECT
    TO authenticated USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON public.scans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scheduled_scans_updated_at BEFORE UPDATE ON public.scheduled_scans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'), 'viewer');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();