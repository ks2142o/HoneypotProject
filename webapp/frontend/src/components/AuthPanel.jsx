import React, { useState } from 'react';
import * as api from '../api';
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  ArrowRightLeft,
  AlertTriangle,
} from 'lucide-react';

function AuthPanel({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api.login(formData.username, formData.password);
      if (result.user) {
        onAuthenticated();
      }
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.register(formData.username, formData.email, formData.password);
      setError('');
      // Auto-login after registration
      const result = await api.login(formData.username, formData.password);
      if (result.user) {
        onAuthenticated();
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-cyber-bg flex items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-cyber-accent/10 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 w-80 h-80 rounded-full bg-cyber-green/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-cyber-border bg-cyber-card/95 backdrop-blur p-7 shadow-cyber-lg">
        <div className="text-center mb-7">
          <div className="mx-auto mb-3 w-14 h-14 rounded-2xl bg-cyber-accent/10 border border-cyber-accent/30 flex items-center justify-center shadow-[0_0_30px_rgba(0,212,255,0.18)]">
            <ShieldCheck size={26} className="text-cyber-accent" />
          </div>
          <h1 className="text-2xl font-bold text-cyber-bright tracking-wide">Sentinel Access</h1>
          <p className="text-sm text-cyber-muted mt-1">Honeypot Threat Intelligence Console</p>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="inline-flex p-1 rounded-lg border border-cyber-border bg-cyber-card2">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
              }}
              className={`px-3 py-1.5 text-xs rounded-md transition ${mode === 'login' ? 'bg-cyber-accent/15 text-cyber-accent border border-cyber-accent/30' : 'text-cyber-muted hover:text-cyber-bright'}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <LogIn size={13} /> Login
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError('');
              }}
              className={`px-3 py-1.5 text-xs rounded-md transition ${mode === 'register' ? 'bg-cyber-green/15 text-cyber-green border border-cyber-green/30' : 'text-cyber-muted hover:text-cyber-bright'}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <UserPlus size={13} /> Register
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const nextMode = mode === 'login' ? 'register' : 'login';
              setMode(nextMode);
              setError('');
              setFormData({ username: '', email: '', password: '' });
            }}
            className="text-xs text-cyber-muted hover:text-cyber-bright transition inline-flex items-center gap-1"
            title="Switch mode"
          >
            <ArrowRightLeft size={12} />
            Switch
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-cyber-red/40 bg-cyber-red/10 text-cyber-red px-3 py-2 text-sm flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
          <div className="mb-4">
            <label className="block text-cyber-muted text-xs font-semibold tracking-wider uppercase mb-2">
              {mode === 'login' ? 'Username or Email' : 'Username'}
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted" />
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder={mode === 'login' ? 'admin or admin@local' : 'minimum 3 characters'}
                className="cyber-input w-full pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="mb-4">
              <label className="block text-cyber-muted text-xs font-semibold tracking-wider uppercase mb-2">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="name@company.com"
                  className="cyber-input w-full pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-cyber-muted text-xs font-semibold tracking-wider uppercase mb-2">Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyber-muted" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder={mode === 'login' ? 'Enter password' : 'minimum 8 characters'}
                className="cyber-input w-full pl-10"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full btn justify-center ${mode === 'login' ? 'btn-primary' : 'btn-success'}`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {mode === 'login' ? 'Logging in...' : 'Registering...'}
              </span>
            ) : mode === 'login' ? (
              <span className="inline-flex items-center gap-1.5"><LogIn size={14} /> Login</span>
            ) : (
              <span className="inline-flex items-center gap-1.5"><UserPlus size={14} /> Register</span>
            )}
          </button>
        </form>

        <p className="text-cyber-muted text-xs text-center mt-4">
          {mode === 'login'
            ? 'No account yet? Use Register mode to create one.'
            : 'Already registered? Switch to Login mode.'}
        </p>
      </div>
    </div>
  );
}

export default AuthPanel;
