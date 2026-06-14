import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase, Report, Scan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText,
  Download,
  Loader2,
  Filter,
  Plus,
  FileJson,
  FileSpreadsheet,
  File,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';

export default function ReportsPage() {
  const [reports, setReports] = useState<(Report & { scans: Scan })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const { canRunScans } = useAuth();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const fetchReports = async () => {
    try {
      let query = supabase
        .from('reports')
        .select('*, scans(*)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('format', filter);
      }

      const { data } = await query;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (id: string) => {
    await supabase.from('reports').delete().eq('id', id);
    setReports(reports.filter(r => r.id !== id));
  };

  const formatIcon = (format: string) => {
    switch (format) {
      case 'pdf':
        return <File className="w-4 h-4 text-critical-400" />;
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-success-400" />;
      case 'json':
        return <FileJson className="w-4 h-4 text-warning-400" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const generateReport = async (scanId: string, format: 'pdf' | 'csv' | 'json') => {
    try {
      // In a real app, this would call the backend API
      // For now, we'll create a mock report entry
      const scan = reports.find(r => r.scan_id === scanId)?.scans;
      const { data } = await supabase
        .from('reports')
        .insert({
          scan_id: scanId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          name: `Report - ${scan?.name || 'Scan'} - ${new Date().toLocaleDateString()}`,
          format,
          includes_executive_summary: true,
          includes_remediation: true,
        })
        .select()
        .single();

      if (data) {
        fetchReports();
      }
    } catch (error) {
      console.error('Error generating report:', error);
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
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-dark-400 mt-1">Export and manage scan reports</p>
        </div>
        <Link to="/scans" className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Generate Report
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-dark-800 rounded-lg p-1">
          {['all', 'pdf', 'csv', 'json'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize',
                filter === f
                  ? 'bg-dark-700 text-white'
                  : 'text-dark-400 hover:text-white'
              )}
            >
              {f === 'all' ? 'All Formats' : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No reports yet</h3>
          <p className="text-dark-400 mb-6">
            Generate reports from completed scans
          </p>
          <Link to="/scans" className="btn btn-primary">
            View Scans
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Report Name</th>
                <th>Scan</th>
                <th>Format</th>
                <th>Size</th>
                <th>Created</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      {formatIcon(report.format)}
                      <span className="font-medium text-white">{report.name}</span>
                    </div>
                  </td>
                  <td className="text-dark-300">
                    <Link to={`/scans/${report.scan_id}`} className="text-primary-400 hover:text-primary-300">
                      {report.scans?.name || 'Unknown'}
                    </Link>
                  </td>
                  <td>
                    <span className={clsx('badge', {
                      'bg-critical-500/20 text-critical-400 border-critical-500/30': report.format === 'pdf',
                      'bg-success-500/20 text-success-400 border-success-500/30': report.format === 'csv',
                      'bg-warning-500/20 text-warning-400 border-warning-500/30': report.format === 'json',
                    })}>
                      {report.format.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-dark-400">{formatSize(report.file_size)}</td>
                  <td className="text-dark-400">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button className="p-1.5 text-dark-500 hover:text-primary-400 rounded transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="p-1.5 text-dark-500 hover:text-critical-400 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
