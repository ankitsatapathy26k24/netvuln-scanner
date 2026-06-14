import React, { useEffect, useState } from 'react';
import { supabase, AuditLog, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  Loader2,
  Filter,
  Clock,
  User,
  Shield,
  FileText,
  Search,
  X,
} from 'lucide-react';
import clsx from 'clsx';

export default function AuditLogPage() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<(AuditLog & { profiles: Profile | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    if (isAdmin()) {
      fetchLogs();
    }
  }, [filter]);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*, profiles(*)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'all') {
        query = query.eq('action', filter);
      }

      const { data } = await query;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const actionIcon = (action: string) => {
    switch (action) {
      case 'login':
        return <User className="w-4 h-4 text-primary-400" />;
      case 'logout':
        return <X className="w-4 h-4 text-dark-400" />;
      case 'create_scan':
        return <Shield className="w-4 h-4 text-success-400" />;
      case 'delete_scan':
        return <Shield className="w-4 h-4 text-critical-400" />;
      case 'generate_report':
        return <FileText className="w-4 h-4 text-warning-400" />;
      default:
        return <Activity className="w-4 h-4 text-dark-400" />;
    }
  };

  const actionBadge = (action: string) => {
    const classes: Record<string, string> = {
      login: 'bg-primary-500/20 text-primary-400',
      logout: 'bg-dark-700 text-dark-300',
      create_scan: 'bg-success-500/20 text-success-400',
      delete_scan: 'bg-critical-500/20 text-critical-400',
      generate_report: 'bg-warning-500/20 text-warning-400',
    };
    return classes[action] || 'bg-dark-700 text-dark-300';
  };

  const filteredLogs = logs.filter(log =>
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details?.toString().toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isAdmin()) {
    return (
      <div className="text-center py-20">
        <Shield className="w-12 h-12 text-dark-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-dark-400">Only administrators can view audit logs</p>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-white">Audit Logs</h1>
          <p className="text-dark-400 mt-1">Track all user activity and system events</p>
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
            placeholder="Search logs..."
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="select"
        >
          <option value="all">All Actions</option>
          <option value="login">Login</option>
          <option value="logout">Logout</option>
          <option value="create_scan">Create Scan</option>
          <option value="delete_scan">Delete Scan</option>
          <option value="generate_report">Generate Report</option>
        </select>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <div className="card p-12 text-center">
          <Activity className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No audit logs found</h3>
          <p className="text-dark-400">
            {searchQuery ? 'Try adjusting your search' : 'Activity will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <button
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="w-full card p-4 flex items-center justify-between hover:bg-dark-800 transition-colors text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center">
                  {actionIcon(log.action)}
                </div>
                <div>
                  <p className="text-white font-medium">{log.action.replace(/_/g, ' ')}</p>
                  <div className="flex items-center gap-3 text-xs text-dark-400 mt-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.profiles?.email || 'System'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx('badge text-xs', actionBadge(log.action))}>
                  {log.resource_type}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Log Details</h2>
              <button onClick={() => setSelectedLog(null)} className="p-1 text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-dark-400 uppercase tracking-wider">Action</p>
                <p className="text-white mt-1">{selectedLog.action}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400 uppercase tracking-wider">User</p>
                <p className="text-white mt-1">{selectedLog.profiles?.email || 'System'}</p>
              </div>
              <div>
                <p className="text-xs text-dark-400 uppercase tracking-wider">Resource Type</p>
                <p className="text-white mt-1">{selectedLog.resource_type}</p>
              </div>
              {selectedLog.resource_id && (
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wider">Resource ID</p>
                  <p className="text-white mt-1 font-mono text-sm">{selectedLog.resource_id}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-dark-400 uppercase tracking-wider">Timestamp</p>
                <p className="text-white mt-1">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
              {selectedLog.ip_address && (
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wider">IP Address</p>
                  <p className="text-white mt-1 font-mono">{selectedLog.ip_address}</p>
                </div>
              )}
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <p className="text-xs text-dark-400 uppercase tracking-wider mb-2">Details</p>
                  <pre className="bg-dark-800 rounded-lg p-4 text-sm text-dark-300 font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
