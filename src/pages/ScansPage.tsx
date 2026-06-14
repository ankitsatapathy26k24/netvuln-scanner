import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Scan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Search,
  Plus,
  Filter,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  Pause,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';

export default function ScansPage() {
  const { canRunScans } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchScans();
  }, [filter]);

  const fetchScans = async () => {
    try {
      let query = supabase
        .from('scans')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data } = await query;
      setScans(data || []);
    } catch (error) {
      console.error('Error fetching scans:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteScan = async (id: string) => {
    await supabase.from('scans').delete().eq('id', id);
    setScans(scans.filter(s => s.id !== id));
  };

  const filteredScans = scans.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.target.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 text-warning-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-success-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-critical-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-dark-400" />;
      case 'cancelled':
        return <Pause className="w-4 h-4 text-dark-500" />;
      default:
        return null;
    }
  };

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      running: 'bg-warning-500/20 text-warning-400 border-warning-500/30',
      completed: 'bg-success-500/20 text-success-400 border-success-500/30',
      failed: 'bg-critical-500/20 text-critical-400 border-critical-500/30',
      pending: 'bg-dark-700 text-dark-300 border-dark-600',
      cancelled: 'bg-dark-700 text-dark-400 border-dark-600',
    };
    return classes[status] || 'bg-dark-700 text-dark-300 border-dark-600';
  };

  const scanTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      quick: 'Quick Scan',
      full: 'Full Scan',
      vulnerability: 'Vuln Scan',
      stealth: 'Stealth Scan',
      service: 'Service Detection',
      os: 'OS Detection',
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Scans</h1>
          <p className="text-dark-400 mt-1">Manage and monitor your network scans</p>
        </div>
        {canRunScans() && (
          <Link to="/scans/new" className="btn btn-primary">
            <Plus className="w-4 h-4" />
            New Scan
          </Link>
        )}
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
            placeholder="Search scans..."
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="select pr-10"
          >
            <option value="all">All Status</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-dark-400 pointer-events-none" />
        </div>
      </div>

      {/* Scans Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredScans.length === 0 ? (
        <div className="card p-12 text-center">
          <Search className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No scans found</h3>
          <p className="text-dark-400 mb-6">
            {searchQuery ? 'Try adjusting your search query' : 'Start by creating your first scan'}
          </p>
          {canRunScans() && (
            <Link to="/scans/new" className="btn btn-primary">
              <Plus className="w-4 h-4" />
              Create Scan
            </Link>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Target</th>
                <th>Type</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Started</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredScans.map((scan) => (
                <tr key={scan.id}>
                  <td>
                    <Link to={`/scans/${scan.id}`} className="text-primary-400 hover:text-primary-300 font-medium">
                      {scan.name}
                    </Link>
                  </td>
                  <td className="font-mono text-sm">{scan.target}</td>
                  <td>
                    <span className="badge badge-info">{scanTypeLabel(scan.scan_type)}</span>
                  </td>
                  <td>
                    <span className={clsx('badge', statusBadge(scan.status))}>
                      {statusIcon(scan.status)}
                      <span className="ml-1.5 capitalize">{scan.status}</span>
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${scan.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-dark-400">{scan.progress}%</span>
                    </div>
                  </td>
                  <td className="text-dark-400 text-sm">
                    {scan.started_at
                      ? new Date(scan.started_at).toLocaleDateString()
                      : '-'}
                  </td>
                  <td>
                    <button
                      onClick={() => deleteScan(scan.id)}
                      className="p-1.5 text-dark-500 hover:text-critical-400 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
