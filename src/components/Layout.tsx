import React from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  LayoutDashboard,
  Search,
  FileText,
  Network,
  Users,
  Clock,
  Settings,
  LogOut,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Scans', href: '/scans', icon: Search },
  { name: 'Vulnerabilities', href: '/vulnerabilities', icon: AlertTriangle },
  { name: 'Network Map', href: '/network', icon: Network },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Scheduled', href: '/scheduled', icon: Clock },
];

const adminNavigation = [
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Audit Logs', href: '/audit', icon: Activity },
];

export default function Layout() {
  const { profile, signOut, canManageUsers } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-900 border-r border-dark-800 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-dark-800">
          <Shield className="w-8 h-8 text-primary-500" />
          <span className="ml-3 text-xl font-bold text-white">NetVuln</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800'
                )
              }
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </NavLink>
          ))}

          {canManageUsers() && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-dark-500 uppercase tracking-wider">
                  Administration
                </p>
              </div>
              {adminNavigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary-600/20 text-primary-400'
                        : 'text-dark-400 hover:text-white hover:bg-dark-800'
                    )
                  }
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User Panel */}
        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-white font-semibold">
                  {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-dark-400 truncate">{profile?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="ml-2 p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-600/20 text-primary-400">
              {profile?.role?.charAt(0).toUpperCase()}{profile?.role?.slice(1)}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-6">
          <div className="flex items-center">
            <nav className="flex items-center space-x-2 text-sm">
              <span className="text-dark-400">NetVuln Scanner</span>
              {location.pathname !== '/' && (
                <>
                  <span className="text-dark-600">/</span>
                  <span className="text-white capitalize">
                    {location.pathname.slice(1).split('/')[0].replace('-', ' ')}
                  </span>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-6 bg-dark-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
