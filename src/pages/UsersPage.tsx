import React, { useEffect, useState } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Users,
  Plus,
  Loader2,
  Edit2,
  Trash2,
  X,
  Check,
  Shield,
  Eye,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';

export default function UsersPage() {
  const { canManageUsers } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'viewer',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (canManageUsers()) {
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingUser) {
        await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            is_active: formData.is_active,
          })
          .eq('id', editingUser.id);
      } else {
        // In a real app, we'd use admin API to create user
        // Here we just show a message
        alert('User creation requires admin API access');
      }
      setShowModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name || '',
      role: user.role,
      is_active: user.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({ email: '', full_name: '', role: 'viewer', is_active: true });
  };

  const roleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-critical-400" />;
      case 'analyst':
        return <BarChart3 className="w-4 h-4 text-primary-400" />;
      case 'viewer':
        return <Eye className="w-4 h-4 text-dark-400" />;
      default:
        return null;
    }
  };

  const roleBadge = (role: string) => {
    const classes: Record<string, string> = {
      admin: 'bg-critical-500/20 text-critical-400 border-critical-500/30',
      analyst: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
      viewer: 'bg-dark-700 text-dark-300 border-dark-600',
    };
    return classes[role] || 'badge-info';
  };

  if (!canManageUsers()) {
    return (
      <div className="text-center py-20">
        <Shield className="w-12 h-12 text-dark-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
        <p className="text-dark-400">You don't have permission to manage users</p>
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
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-dark-400 mt-1">Manage user accounts and permissions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {['admin', 'analyst', 'viewer'].map((role) => (
          <div key={role} className="card p-4">
            <div className="flex items-center gap-3">
              {roleIcon(role)}
              <div>
                <p className="text-2xl font-bold text-white">
                  {profiles.filter(p => p.role === role).length}
                </p>
                <p className="text-xs text-dark-400 capitalize">{role}s</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {profile.full_name?.[0]?.toUpperCase() || profile.email[0].toUpperCase()}
                      </span>
                    </div>
                    <span className="font-medium text-white">
                      {profile.full_name || 'Unnamed'}
                    </span>
                  </div>
                </td>
                <td className="text-dark-300">{profile.email}</td>
                <td>
                  <span className={clsx('badge flex items-center gap-1.5 w-fit', roleBadge(profile.role))}>
                    {roleIcon(profile.role)}
                    {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </span>
                </td>
                <td>
                  <span className={clsx('badge', profile.is_active ? 'bg-success-500/20 text-success-400 border-success-500/30' : 'bg-critical-500/20 text-critical-400 border-critical-500/30')}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-dark-400">
                  {new Date(profile.created_at).toLocaleDateString()}
                </td>
                <td>
                  <button
                    onClick={() => openEditModal(profile)}
                    className="p-1.5 text-dark-500 hover:text-primary-400 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {editingUser ? 'Edit User' : 'New User'}
              </h2>
              <button onClick={closeModal} className="p-1 text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                  disabled={!!editingUser}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="input"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-200 mb-2">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'analyst' | 'viewer' })}
                  className="select"
                >
                  <option value="viewer">Viewer - Read-only access</option>
                  <option value="analyst">Analyst - Run scans, export reports</option>
                  <option value="admin">Admin - Full access, manage users</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-dark-200">Active account</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button onClick={closeModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save
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
