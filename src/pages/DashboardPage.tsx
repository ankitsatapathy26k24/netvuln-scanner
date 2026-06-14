import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Scan, Vulnerability } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  AlertTriangle,
  Server,
  Shield,
  TrendingUp,
  Clock,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import clsx from 'clsx';

type Stats = {
  totalScans: number;
  activeScans: number;
  totalHosts: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalScans: 0,
    activeScans: 0,
    totalHosts: 0,
    vulnerabilities: { critical: 0, high: 0, medium: 0, low: 0, informational: 0 },
  });
  const [recentScans, setRecentScans] = useState<(Scan & { hosts: { count: number }[], vulnerabilities: { count: number }[] })[]>([]);
  const [recentVulns, setRecentVulns] = useState<Vulnerability[]>([]);
  const [scanTrend, setScanTrend] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch scans
      const { data: scans } = await supabase
        .from('scans')
        .select('*, hosts(count), vulnerabilities(count)')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch vulnerability counts
      const { data: vulnCounts } = await supabase
        .rpc('get_vulnerability_counts');

      // Fetch recent vulnerabilities
      const { data: vulns } = await supabase
        .from('vulnerabilities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch host count
      const { count: hostCount } = await supabase
        .from('hosts')
        .select('*', { count: 'exact', head: true });

      // Calculate stats
      const activeScans = scans?.filter(s => s.status === 'running' || s.status === 'pending').length || 0;

      const vulnStats = {
        critical: vulnCounts?.find((v: { severity: string }) => v.severity === 'critical')?.count || 0,
        high: vulnCounts?.find((v: { severity: string }) => v.severity === 'high')?.count || 0,
        medium: vulnCounts?.find((v: { severity: string }) => v.severity === 'medium')?.count || 0,
        low: vulnCounts?.find((v: { severity: string }) => v.severity === 'low')?.count || 0,
        informational: vulnCounts?.find((v: { severity: string }) => v.severity === 'informational')?.count || 0,
      };

      setStats({
        totalScans: scans?.length || 0,
        activeScans,
        totalHosts: hostCount || 0,
        vulnerabilities: vulnStats,
      });

      setRecentScans(scans || []);
      setRecentVulns(vulns || []);

      // Generate mock trend data for the chart
      const trendData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        trendData.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short' }),
          count: Math.floor(Math.random() * 10) + 1,
        });
      }
      setScanTrend(trendData);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const vulnPieData = [
    { name: 'Critical', value: stats.vulnerabilities.critical, color: '#ef4444' },
    { name: 'High', value: stats.vulnerabilities.high, color: '#f97316' },
    { name: 'Medium', value: stats.vulnerabilities.medium, color: '#3b82f6' },
    { name: 'Low', value: stats.vulnerabilities.low, color: '#22c55e' },
    { name: 'Info', value: stats.vulnerabilities.informational, color: '#64748b' },
  ];

  const severityBadge = (severity: string) => {
    const classes: Record<string, string> = {
      critical: 'badge-critical',
      high: 'badge-high',
      medium: 'badge-medium',
      low: 'badge-low',
      informational: 'badge-info',
    };
    return classes[severity] || 'badge-info';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-dark-400 mt-1">Welcome back, {profile?.full_name || 'User'}</p>
        </div>
        <Link to="/scans/new" className="btn btn-primary">
          <Shield className="w-4 h-4" />
          New Scan
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Scans', value: stats.totalScans, icon: Activity, color: 'text-primary-400' },
          { label: 'Active Scans', value: stats.activeScans, icon: Clock, color: 'text-warning-400' },
          { label: 'Hosts Discovered', value: stats.totalHosts, icon: Server, color: 'text-success-400' },
          { label: 'Total Vulnerabilities', value: Object.values(stats.vulnerabilities).reduce((a, b) => a + b, 0), icon: AlertTriangle, color: 'text-critical-400' },
        ].map((stat) => (
          <div key={stat.label} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-dark-400 text-sm">{stat.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
              </div>
              <stat.icon className={clsx('w-8 h-8', stat.color)} />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vulnerability Distribution */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Vulnerability Distribution</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie
                  data={vulnPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {vulnPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="ml-6 space-y-2">
              {vulnPieData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-dark-300">{entry.name}:</span>
                  <span className="text-sm font-medium text-white">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scan Activity */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Scan Activity (7 Days)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={scanTrend}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                fillOpacity={1}
                fill="url(#colorCount)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Scans</h3>
            <Link to="/scans" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentScans.length === 0 ? (
              <p className="text-dark-400 text-sm py-8 text-center">No scans yet. Start your first scan!</p>
            ) : (
              recentScans.map((scan) => (
                <Link
                  key={scan.id}
                  to={`/scans/${scan.id}`}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50 hover:bg-dark-800 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{scan.name}</p>
                    <p className="text-xs text-dark-400">{scan.target}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {scan.status === 'running' && (
                      <span className="flex items-center gap-1.5 text-warning-400 text-xs">
                        <span className="w-2 h-2 rounded-full bg-warning-400 animate-pulse" />
                        Running
                      </span>
                    )}
                    {scan.status === 'completed' && (
                      <span className="badge badge-success text-xs">Completed</span>
                    )}
                    {scan.status === 'failed' && (
                      <span className="badge badge-critical text-xs">Failed</span>
                    )}
                    {scan.status === 'pending' && (
                      <span className="badge badge-info text-xs">Pending</span>
                    )}
                    <span className="text-xs text-dark-500">
                      {scan.hosts?.[0]?.count || 0} hosts
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Vulnerabilities */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Vulnerabilities</h3>
            <Link to="/vulnerabilities" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentVulns.length === 0 ? (
              <p className="text-dark-400 text-sm py-8 text-center">No vulnerabilities found yet.</p>
            ) : (
              recentVulns.map((vuln) => (
                <div
                  key={vuln.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{vuln.title}</p>
                    <p className="text-xs text-dark-400">{vuln.cve_id || 'No CVE'}</p>
                  </div>
                  <span className={clsx('badge ml-3', severityBadge(vuln.severity))}>
                    {vuln.severity.charAt(0).toUpperCase() + vuln.severity.slice(1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
