import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Shield, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-900 p-12 flex-col justify-between">
        <div className="flex items-center">
          <Shield className="w-10 h-10 text-white" />
          <span className="ml-3 text-2xl font-bold text-white">NetVuln Scanner</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold text-white mb-6">
            Comprehensive Network Security Assessment
          </h1>
          <p className="text-primary-200 text-lg leading-relaxed">
            Discover vulnerabilities, map your network topology, and generate detailed reports with our powerful Nmap-integrated scanner.
          </p>
          <div className="mt-8 space-y-4">
            {[
              'Full network discovery across subnets',
              'CVE mapping with CVSS scores',
              'Automated vulnerability detection',
              'Role-based access control',
            ].map((feature) => (
              <div key={feature} className="flex items-center text-primary-200">
                <div className="w-2 h-2 rounded-full bg-primary-400 mr-3" />
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="text-primary-300 text-sm">
          Powered by Nmap NSE Scripts
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center mb-8">
            <Shield className="w-10 h-10 text-primary-500" />
            <span className="ml-3 text-2xl font-bold text-white">NetVuln</span>
          </div>

          <div className="card p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-dark-400 mb-8">Sign in to your account to continue</p>

            {error && (
              <div className="mb-6 p-4 bg-critical-500/20 border border-critical-500/30 rounded-lg text-critical-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-dark-200 mb-2">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-11"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-dark-200 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-500" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-11"
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-dark-400">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
