import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Vulnerability, Scan } from '../lib/supabase';
import {
  AlertTriangle,
  Search,
  Filter,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

export default function VulnerabilitiesPage() {
  const [vulnerabilities, setVulnerabilities] = useState<(Vulnerability & { scans: Scan })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetchVulnerabilities();
  }, [filter, page]);

  const fetchVulnerabilities = async () => {
    try {
      let query = supabase
        .from('vulnerabilities')
        .select('*, scans(*)')
        .order('cvss_score', { ascending: false, nullsFirst: false });

      if (filter !== 'all') {
        query = query.eq('severity', filter);
      }

      // Get total count for pagination
      const { count } = await supabase
        .from('vulnerabilities')
        .select('*', { count: 'exact', head: true });

      setTotalPages(Math.ceil((count || 0) / pageSize));

      const { data } = await query
        .range((page - 1) * pageSize, page * pageSize - 1);

      setVulnerabilities(data || []);
    } catch (error) {
      console.error('Error fetching vulnerabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredVulns = vulnerabilities.filter(v =>
    v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.cve_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <div className="w-3 h-3 rounded-full bg-critical-500" />;
      case 'high':
        return <div className="w-3 h-3 rounded-full bg-warning-500" />;
      case 'medium':
        return <div className="w-3 h-3 rounded-full bg-primary-500" />;
      case 'low':
        return <div className="w-3 h-3 rounded-full bg-success-500" />;
      default:
        return <div className="w-3 h-3 rounded-full bg-dark-500" />;
    }
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
          <h1 className="text-2xl font-bold text-white">Vulnerabilities</h1>
          <p className="text-dark-400 mt-1">Review and remediate identified vulnerabilities</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-11"
            placeholder="Search vulnerabilities..."
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="select"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="informational">Informational</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {['critical', 'high', 'medium', 'low', 'informational'].map((severity) => (
          <button
            key={severity}
            onClick={() => setFilter(filter === severity ? 'all' : severity)}
            className={clsx(
              'card p-4 text-center transition-all cursor-pointer',
              filter === severity ? 'ring-2 ring-primary-500' : ''
            )}
          >
            <div className="flex items-center justify-center mb-1">
              {severityIcon(severity)}
            </div>
            <p className={clsx('text-xl font-bold capitalize', {
              'text-critical-400': severity === 'critical',
              'text-warning-400': severity === 'high',
              'text-primary-400': severity === 'medium',
              'text-success-400': severity === 'low',
              'text-dark-400': severity === 'informational',
            })}>
              {vulnerabilities.filter(v => v.severity === severity).length || 0}
            </p>
            <p className="text-xs text-dark-400 capitalize">{severity}</p>
          </button>
        ))}
      </div>

      {/* Vulnerability List */}
      {filteredVulns.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No vulnerabilities found</h3>
          <p className="text-dark-400 mb-6">
            {searchQuery ? 'Try adjusting your search query' : 'Run a scan to discover vulnerabilities'}
          </p>
          <Link to="/scans/new" className="btn btn-primary">
            Run New Scan
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVulns.map((vuln) => (
            <div key={vuln.id} className="card p-5 hover:bg-dark-800/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {severityIcon(vuln.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={clsx('badge', severityBadge(vuln.severity))}>
                      {vuln.severity.charAt(0).toUpperCase() + vuln.severity.slice(1)}
                    </span>
                    {vuln.cvss_score && (
                      <span className="text-xs text-dark-400 font-mono">
                        CVSS {vuln.cvss_score.toFixed(1)}
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
                    <p className="text-dark-400 text-sm mt-1 line-clamp-2">{vuln.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-xs text-dark-500">
                    <span>Scan: {vuln.scans?.name || 'Unknown'}</span>
                    <span>Found: {new Date(vuln.created_at).toLocaleDateString()}</span>
                  </div>
                  {vuln.solution && (
                    <div className="mt-3 p-3 bg-success-500/10 border border-success-500/20 rounded-lg">
                      <p className="text-xs font-medium text-success-400 mb-1">Remediation</p>
                      <p className="text-sm text-success-300 line-clamp-2">{vuln.solution}</p>
                    </div>
                  )}
                </div>
                <Link
                  to={`/scans/${vuln.scan_id}`}
                  className="btn btn-ghost text-xs"
                >
                  View Scan
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="btn btn-secondary p-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-dark-400 text-sm">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="btn btn-secondary p-2"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
