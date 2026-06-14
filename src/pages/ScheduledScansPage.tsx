import React, { useEffect, useState } from 'react';
import { supabase, ScheduledScan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Clock,
  Plus,
  Loader2,
  Play,
  Pause,
  Trash2,
  Edit2,
  X,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

export default function ScheduledScansPage() {
  const { canRunScans } = useAuth();
  const [schedules, setSchedules] = useState<ScheduledScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledScan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    target: '',
    scan_type: 'quick' as 'quick' | 'full' | 'vulnerability' | 'stealth' | 'service' | 'os',
    schedule_cron: '0 0 * * *',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const { data } = await supabase
        .from('scheduled_scans')
        .select('*')
        .order('created_at', { ascending: false });
      setSchedules(data || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (schedule: ScheduledScan) => {
    await supabase
      .from('scheduled_scans')
      .update({ is_active: !schedule.is_active })
      .eq('id', schedule.id);
    fetchSchedules();
  };

  const deleteSchedule = async (id: string) => {
    await supabase.from('scheduled_scans').delete().eq('id', id);
    setSchedules(schedules.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingSchedule) {
        await supabase
          .from('scheduled_scans')
          .update({
            name: formData.name,
            target: formData.target,
            scan_type: formData.scan_type,
            schedule_cron: formData.schedule_cron,
          })
          .eq('id', editingSchedule.id);
      } else {
        await supabase.from('scheduled_scans').insert({
          name: formData.name,
          target: formData.target,
          scan_type: formData.scan_type,
          schedule_cron: formData.schedule_cron,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        });
      }
      closeModal();
      fetchSchedules();
    } catch (error) {
      console.error('Error saving schedule:', error);
    } finally {
      setSaving(false);
    }
  };

  const openModal = (schedule?: ScheduledScan) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        name: schedule.name,
        target: schedule.target,
        scan_type: schedule.scan_type,
        schedule_cron: schedule.schedule_cron,
      });
    } else {
      setEditingSchedule(null);
      setFormData({
        name: '',
        target: '',
        scan_type: 'quick',
        schedule_cron: '0 0 * * *',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSchedule(null);
  };

  const cronToText = (cron: string) => {
    const parts = cron.split(' ');
    if (parts[2] === '*' && parts[4] === '*') return 'Daily';
    if (parts[4] !== '*') return `Weekly`;
    if (parts[2] !== '*') return `Monthly`;
    return 'Custom';
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
          <h1 className="text-2xl font-bold text-white">Scheduled Scans</h1>
          <p className="text-dark-400 mt-1">Automate recurring network scans</p>
        </div>
        {canRunScans() && (
          <button onClick={() => openModal()} className="btn btn-primary">
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        )}
      </div>

      {/* Schedules List */}
      {schedules.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock className="w-12 h-12 text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No scheduled scans</h3>
          <p className="text-dark-400 mb-6">
            Automate your scans by setting up a schedule
          </p>
          {canRunScans() && (
            <button onClick={() => openModal()} className="btn btn-primary">
              <Plus className="w-4 h-4" />
              Create Schedule
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="card p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  schedule.is_active ? 'bg-success-500/20' : 'bg-dark-800'
                )}>
                  <Clock className={clsx('w-5 h-5', schedule.is_active ? 'text-success-400' : 'text-dark-500')} />
                </div>
                <div>
                  <p className="text-white font-medium">{schedule.name}</p>
                  <div className="flex items-center gap-3 text-xs text-dark-400 mt-1">
                    <span className="font-mono">{schedule.target}</span>
                    <span className={clsx('badge text-xs', schedule.is_active ? 'bg-success-500/20 text-success-400' : 'bg-dark-700 text-dark-400')}>
                      {cronToText(schedule.schedule_cron)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx('badge', schedule.is_active ? 'bg-success-500/20 text-success-400 border-success-500/30' : 'bg-dark-700 text-dark-400 border-dark-600')}>
                  {schedule.is_active ? 'Active' : 'Paused'}
                </span>
                {schedule.next_run && (
                  <span className="text-xs text-dark-400">
                    Next: {new Date(schedule.next_run).toLocaleDateString()}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => toggleActive(schedule)}
                    className="p-2 text-dark-400 hover:text-white rounded transition-colors"
                  >
                    {schedule.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openModal(schedule)}
                    className="p-2 text-dark-400 hover:text-primary-400 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteSchedule(schedule.id)}
                    className="p-2 text-dark-400 hover:text-critical-400 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {editingSchedule ? 'Edit Schedule' : 'New Scheduled Scan'}
              </h2>
              <button onClick={closeModal} className="p-1 text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="Weekly Network Audit"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Target</label>
                <input
                  type="text"
                  value={formData.target}
                  onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                  className="input font-mono"
                  placeholder="192.168.1.0/24"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Scan Type</label>
                <select
                  value={formData.scan_type}
                  onChange={(e) => setFormData({ ...formData, scan_type: e.target.value as typeof formData.scan_type })}
                  className="select"
                >
                  <option value="quick">Quick Scan</option>
                  <option value="full">Full Scan</option>
                  <option value="vulnerability">Vulnerability Scan</option>
                  <option value="stealth">Stealth Scan</option>
                  <option value="service">Service Detection</option>
                  <option value="os">OS Detection</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Cron Schedule</label>
                <input
                  type="text"
                  value={formData.schedule_cron}
                  onChange={(e) => setFormData({ ...formData, schedule_cron: e.target.value })}
                  className="input font-mono"
                  placeholder="0 0 * * *"
                />
                <p className="mt-1.5 text-xs text-dark-500">
                  Format: minute hour day-of-month month day-of-week
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {[
                    { label: 'Daily', cron: '0 0 * * *' },
                    { label: 'Weekly', cron: '0 0 * * 0' },
                    { label: 'Monthly', cron: '0 0 1 * *' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormData({ ...formData, schedule_cron: preset.cron })}
                      className={clsx(
                        'px-2 py-1 rounded text-xs',
                        formData.schedule_cron === preset.cron
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-700 text-dark-300 hover:text-white'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button onClick={closeModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || !formData.name || !formData.target} className="btn btn-primary">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      Save Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
