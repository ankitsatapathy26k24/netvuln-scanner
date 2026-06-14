import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'analyst' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Scan = {
  id: string;
  user_id: string;
  name: string;
  target: string;
  scan_type: 'quick' | 'full' | 'vulnerability' | 'stealth' | 'service' | 'os';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  options: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type Host = {
  id: string;
  scan_id: string;
  ip_address: string;
  hostname: string | null;
  mac_address: string | null;
  os_name: string | null;
  os_family: string | null;
  os_vendor: string | null;
  os_accuracy: number | null;
  status: string;
  latency_ms: number | null;
  created_at: string;
};

export type Port = {
  id: string;
  host_id: string;
  port_number: number;
  protocol: 'tcp' | 'udp' | 'sctp';
  state: string;
  service_name: string | null;
  service_product: string | null;
  service_version: string | null;
  service_extrainfo: string | null;
  service_hostname: string | null;
  service_ostype: string | null;
  scripts_run: string[] | null;
  created_at: string;
};

export type Vulnerability = {
  id: string;
  port_id: string | null;
  host_id: string;
  scan_id: string;
  cve_id: string | null;
  cve_name: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  cvss_score: number | null;
  title: string;
  description: string | null;
  solution: string | null;
  cve_refs: string[] | null;
  nse_script: string | null;
  raw_output: string | null;
  created_at: string;
};

export type Report = {
  id: string;
  scan_id: string;
  user_id: string;
  name: string;
  format: 'pdf' | 'csv' | 'json';
  file_path: string | null;
  file_size: number | null;
  includes_executive_summary: boolean;
  includes_remediation: boolean;
  created_at: string;
};

export type ScheduledScan = {
  id: string;
  user_id: string;
  name: string;
  target: string;
  scan_type: 'quick' | 'full' | 'vulnerability' | 'stealth' | 'service' | 'os';
  schedule_cron: string;
  is_active: boolean;
  last_run: string | null;
  next_run: string | null;
  options: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type ScanWithStats = Scan & {
  hosts: Host[];
  vulnerabilities: Vulnerability[];
  host_count: number;
  port_count: number;
  vulnerability_counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
};
