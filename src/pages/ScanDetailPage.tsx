import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase, Scan, Host, Port, Vulnerability } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft,
  Loader2,
  Server,
  Globe,
  Cpu,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import clsx from 'clsx';

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canRunScans } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [ports, setPorts] = useState<Record<string, Port[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedHost, setExpandedHost] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'hosts' | 'vulnerabilities' | 'details'>('hosts');

  useEffect(() => {
    if (id) fetchScanData();
  }, [id]);

  const fetchScanData = async () => {
    try {
      const { data: scanData } = await supabase
        .from('scans')
        .select('*')
        .eq('id', id)
        .single();
      setScan(scanData);

      const { data: hostData } = await supabase
        .from('hosts')
        .select('*')
        .eq('scan_id', id);
      setHosts(hostData || []);

      const { data: vulnData } = await supabase
        .from('vulnerabilities')
        .select('*')
        .eq('scan_id', id)
        .order('severity', { ascending: true });
      setVulnerabilities(vulnData || []);

      // Fetch ports for each host
      if (hostData) {
        const portMap: Record<string, Port[]> = {};
        for (const host of hostData) {
          const { data: portData } = await supabase
            .from('ports')
            .select('*')
            .eq('host_id', host.id);
          portMap[host.id] = portData || [];
        }
        setPorts(portMap);
      }
    } catch (error) {
      console.error('Error fetching scan data:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const vulnCounts = {
    critical: vulnerabilities.filter(v => v.severity === 'critical').length,
    high: vulnerabilities.filter(v => v.severity === 'high').length,
    medium: vulnerabilities.filter(v => v.severity === 'medium').length,
    low: vulnerabilities.filter(v => v.severity === 'low').length,
    informational: vulnerabilities.filter(v => v.severity === 'informational').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-white mb-2">Scan not found</h2>
        <Link to="/scans" className="text-primary-400 hover:text-primary-300">Back to scans</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/scans')} className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{scan.name}</h1>
            <p className="text-dark-400 mt-1 font-mono text-sm">{scan.target}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to={`/reports/new?scanId=${scan.id}`}
            className="btn btn-secondary"
          >
            <Download className="w-4 h-4" />
            Export Report
          </Link>
        </div>
      </div>

      {/* Status Bar */}
      <div className="card p-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div>
            <p className="text-xs text-dark-400 uppercase tracking-wider">Status</p>
            <div className="flex items-center gap-2 mt-1">
              {scan.status === 'running' && <Loader2 className="w-4 h-4 text-warning-400 animate-spin" />}
              {scan.status === 'completed' && <CheckCircle className="w-4 h-4 text-success-400" />}
              {scan.status === 'failed' && <XCircle className="w-4 h-4 text-critical-400" />}
              <span className={clsx('badge', scan.status === 'running' ? 'bg-warning-500/20 text-warning-400' : scan.status === 'completed' ? 'bg-success-500/20 text-success-400' : scan.status === 'failed' ? 'bg-critical-500/20 text-critical-400' : 'badge-info')}>
                {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-dark-400 uppercase tracking-wider">Scan Type</p>
            <p className="text-white font-medium mt-1 capitalize">{scan.scan_type}</p>
          </div>
          <div>
            <p className="text-xs text-dark-400 uppercase tracking-wider">Hosts</p>
            <p className="text-white font-medium mt-1">{hosts.length}</p>
          </div>
          <div>
            <p className="text-xs text-dark-400 uppercase tracking-wider">Open Ports</p>
            <p className="text-white font-medium mt-1">
              {Object.values(ports).flat().filter(p => p.state === 'open').length}
            </p>
          </div>
          <div>
            <p className="text-xs text-dark-400 uppercase tracking-wider">Vulnerabilities</p>
            <p className="text-white font-medium mt-1">{vulnerabilities.length}</p>
          </div>
        </div>

        {scan.status === 'running' && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-dark-400">Progress</span>
              <span className="text-primary-400">{scan.progress}%</span>
            </div>
            <div className="w-full h-2 bg-dark-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${scan.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Vulnerability Summary */}
      {vulnerabilities.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {Object.entries(vulnCounts).map(([severity, count]) => (
            <div key={severity} className="card p-3 text-center">
              <p className={clsx('text-2xl font-bold', {
                'text-critical-400': severity === 'critical',
                'text-warning-400': severity === 'high',
                'text-primary-400': severity === 'medium',
                'text-success-400': severity === 'low',
                'text-dark-400': severity === 'informational',
              })}>{count}</p>
              <p className="text-xs text-dark-400 capitalize mt-1">{severity}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-dark-900 rounded-lg p-1 border border-dark-800">
        {(['hosts', 'vulnerabilities', 'details'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors capitalize',
              activeTab === tab
                ? 'bg-dark-800 text-white'
                : 'text-dark-400 hover:text-white'
            )}
          >
            {tab === 'hosts' && <Server className="w-4 h-4 inline mr-2" />}
            {tab === 'vulnerabilities' && <AlertTriangle className="w-4 h-4 inline mr-2" />}
            {tab === 'details' && <FileText className="w-4 h-4 inline mr-2" />}
            {tab}
            {tab === 'vulnerabilities' && vulnerabilities.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-critical-500/20 text-critical-400">
                {vulnerabilities.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'hosts' && (
        <div className="space-y-3">
          {hosts.length === 0 ? (
            <div className="card p-8 text-center">
              <Server className="w-10 h-10 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">No hosts discovered</p>
            </div>
          ) : (
            hosts.map((host) => (
              <div key={host.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedHost(expandedHost === host.id ? null : host.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-dark-800/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {expandedHost === host.id ? (
                      <ChevronDown className="w-4 h-4 text-dark-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-dark-400" />
                    )}
                    <div className="w-2 h-2 rounded-full bg-success-400" />
                    <div className="text-left">
                      <p className="text-white font-medium font-mono">{host.ip_address}</p>
                      <p className="text-dark-400 text-sm">{host.hostname || 'Unknown hostname'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {host.os_name && (
                      <span className="text-xs text-dark-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {host.os_name}
                      </span>
                    )}
                    <span className="text-xs text-dark-400">
                      {ports[host.id]?.filter(p => p.state === 'open').length || 0} open ports
                    </span>
                  </div>
                </button>

                {expandedHost === host.id && ports[host.id] && (
                  <div className="border-t border-dark-800">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-dark-800/50">
                          <th className="px-4 py-2 text-left text-xs font-medium text-dark-400">Port</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-dark-400">Protocol</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-dark-400">State</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-dark-400">Service</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-dark-400">Version</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ports[host.id].map((port) => (
                          <tr key={port.id} className="border-t border-dark-800/50">
                            <td className="px-4 py-2 text-sm font-mono text-white">{port.port_number}</td>
                            <td className="px-4 py-2 text-sm text-dark-300">{port.protocol}</td>
                            <td className="px-4 py-2">
                              <span className={clsx('badge', port.state === 'open' ? 'bg-success-500/20 text-success-400' : 'badge-info')}>
                                {port.state}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-dark-300">{port.service_name || '-'}</td>
                            <td className="px-4 py-2 text-sm text-dark-300">
                              {port.service_product && port.service_version
                                ? `${port.service_product} ${port.service_version}`
                                : port.service_product || port.service_version || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'vulnerabilities' && (
        <div className="space-y-3">
          {vulnerabilities.length === 0 ? (
            <div className="card p-8 text-center">
              <CheckCircle className="w-10 h-10 text-success-400 mx-auto mb-3" />
              <p className="text-dark-400">No vulnerabilities found</p>
            </div>
          ) : (
            vulnerabilities.map((vuln) => (
              <div key={vuln.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={clsx('badge', severityBadge(vuln.severity))}>
                        {vuln.severity.charAt(0).toUpperCase() + vuln.severity.slice(1)}
                      </span>
                      {vuln.cvss_score && (
                        <span className="text-xs text-dark-400">
                          CVSS: {vuln.cvss_score}
                        </span>
                      )}
                      {vuln.cve_id && (
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                        >
                          {vuln.cve_id}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <h3 className="text-white font-medium">{vuln.title}</h3>
                    {vuln.description && (
                      <p className="text-dark-400 text-sm mt-2">{vuln.description}</p>
                    )}
                    {vuln.solution && (
                      <div className="mt-3 p-3 bg-success-500/10 border border-success-500/20 rounded-lg">
                        <p className="text-xs font-medium text-success-400 mb-1">Remediation</p>
                        <p className="text-sm text-success-300">{vuln.solution}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'details' && (
        <div className="card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">Scan Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-dark-400 uppercase tracking-wider">Target</p>
              <p className="text-white font-mono mt-1">{scan.target}</p>
            </div>
            <div>
              <p className="text-xs text-dark-400 uppercase tracking-wider">Type</p>
              <p className="text-white mt-1 capitalize">{scan.scan_type}</p>
            </div>
            <div>
              <p className="text-xs text-dark-400 uppercase tracking-wider">Created</p>
              <p className="text-white mt-1">{new Date(scan.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-dark-400 uppercase tracking-wider">Started</p>
              <p className="text-white mt-1">{scan.started_at ? new Date(scan.started_at).toLocaleString() : 'Not started'}</p>
            </div>
            <div>
              <p className="text-xs text-dark-400 uppercase tracking-wider">Completed</p>
              <p className="text-white mt-1">{scan.completed_at ? new Date(scan.completed_at).toLocaleString() : 'N/A'}</p>
            </div>
            {scan.error_message && (
              <div className="col-span-2">
                <p className="text-xs text-dark-400 uppercase tracking-wider">Error</p>
                <p className="text-critical-400 mt-1">{scan.error_message}</p>
              </div>
            )}
          </div>
          {scan.options && Object.keys(scan.options).length > 0 && (
            <div>
              <p className="text-xs text-dark-400 uppercase tracking-wider mb-2">Options</p>
              <pre className="bg-dark-800 rounded-lg p-4 text-sm text-dark-300 font-mono overflow-x-auto">
                {JSON.stringify(scan.options, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
