import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  Zap,
  ScanLine,
  Bug,
  Eye,
  Wrench,
  Monitor,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import clsx from 'clsx';

const scanTypes = [
  {
    id: 'quick',
    name: 'Quick Scan',
    description: 'Fast ping sweep and top 100 ports',
    icon: Zap,
    nmapArgs: '-T4 -F',
    estimatedTime: '1-3 min',
  },
  {
    id: 'full',
    name: 'Full Scan',
    description: 'All 65535 ports with service detection',
    icon: ScanLine,
    nmapArgs: '-p- -sV',
    estimatedTime: '10-30 min',
  },
  {
    id: 'vulnerability',
    name: 'Vulnerability Scan',
    description: 'NSE vulnerability scripts for CVE detection',
    icon: Bug,
    nmapArgs: '--script vuln',
    estimatedTime: '15-60 min',
  },
  {
    id: 'stealth',
    name: 'Stealth Scan',
    description: 'SYN scan for stealthy reconnaissance',
    icon: Eye,
    nmapArgs: '-sS',
    estimatedTime: '5-15 min',
  },
  {
    id: 'service',
    name: 'Service Detection',
    description: 'Detailed service and version detection',
    icon: Wrench,
    nmapArgs: '-sV --version-intensity 5',
    estimatedTime: '5-15 min',
  },
  {
    id: 'os',
    name: 'OS Detection',
    description: 'Operating system fingerprinting',
    icon: Monitor,
    nmapArgs: '-O',
    estimatedTime: '3-10 min',
  },
];

export default function NewScanPage() {
  const { canRunScans, profile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [selectedType, setSelectedType] = useState<string>('quick');
  const [portRange, setPortRange] = useState('');
  const [timing, setTiming] = useState('4');
  const [enableOS, setEnableOS] = useState(false);
  const [enableService, setEnableService] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateTarget = (t: string): boolean => {
    const cidrRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/;
    const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
    const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
    const rangeRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}-\d{1,3}$/;

    return cidrRegex.test(t) || ipRegex.test(t) || hostnameRegex.test(t) || rangeRegex.test(t);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!canRunScans()) {
      setError('You do not have permission to run scans');
      return;
    }

    if (!validateTarget(target)) {
      setError('Invalid target. Use IP, CIDR (e.g., 192.168.1.0/24), or hostname');
      return;
    }

    if (!name.trim()) {
      setError('Please provide a scan name');
      return;
    }

    setLoading(true);

    try {
      const { data, error: insertError } = await supabase
        .from('scans')
        .insert({
          name: name.trim(),
          target: target.trim(),
          scan_type: selectedType,
          user_id: profile?.id,
          status: 'pending',
          options: {
            portRange: portRange || undefined,
            timing: parseInt(timing),
            enableOS,
            enableService,
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log audit event
      await supabase.from('audit_logs').insert({
        user_id: profile?.id,
        action: 'create_scan',
        resource_type: 'scan',
        resource_id: data.id,
        details: { name, target, scan_type: selectedType },
      });

      navigate(`/scans/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create scan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">New Scan</h1>
        <p className="text-dark-400 mt-1">Configure and launch a new network scan</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-critical-500/20 border border-critical-500/30 rounded-lg text-critical-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Info */}
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Scan Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">Scan Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="e.g., Internal Network Audit"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">Target</label>
              <input
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="input font-mono"
                placeholder="e.g., 192.168.1.0/24"
                required
              />
              <p className="mt-1.5 text-xs text-dark-500">
                IP address, CIDR range, or hostname
              </p>
            </div>
          </div>
        </div>

        {/* Scan Type Selection */}
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Scan Type</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scanTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedType(type.id)}
                className={clsx(
                  'p-4 rounded-lg border-2 text-left transition-all',
                  selectedType === type.id
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-dark-700 bg-dark-800/50 hover:border-dark-600'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <type.icon className={clsx(
                    'w-6 h-6',
                    selectedType === type.id ? 'text-primary-400' : 'text-dark-400'
                  )} />
                  {selectedType === type.id && (
                    <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                      <ChevronRight className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <h3 className={clsx(
                  'font-medium',
                  selectedType === type.id ? 'text-primary-300' : 'text-white'
                )}>
                  {type.name}
                </h3>
                <p className="text-xs text-dark-400 mt-1">{type.description}</p>
                <p className="text-xs text-dark-500 mt-2">~{type.estimatedTime}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options */}
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white">Advanced Options</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">Port Range</label>
              <input
                type="text"
                value={portRange}
                onChange={(e) => setPortRange(e.target.value)}
                className="input font-mono"
                placeholder="e.g., 1-1000, 80,443"
              />
              <p className="mt-1.5 text-xs text-dark-500">Leave empty for default ports</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-200 mb-2">Timing Template</label>
              <select
                value={timing}
                onChange={(e) => setTiming(e.target.value)}
                className="select"
              >
                <option value="0">T0 - Paranoid</option>
                <option value="1">T1 - Sneaky</option>
                <option value="2">T2 - Polite</option>
                <option value="3">T3 - Normal</option>
                <option value="4">T4 - Aggressive</option>
                <option value="5">T5 - Insane</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableOS}
                onChange={(e) => setEnableOS(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-dark-200">OS Detection (-O)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableService}
                onChange={(e) => setEnableService(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm text-dark-200">Service Version (-sV)</span>
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate('/scans')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !canRunScans()}
            className="btn btn-primary"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Launching...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Launch Scan
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
