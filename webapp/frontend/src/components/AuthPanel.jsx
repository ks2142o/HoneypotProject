import React, { useState } from 'react';
import * as api from '../api';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Honeypot Dashboard</h1>
          <p className="text-gray-400">Threat Intelligence Platform</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => {
              setMode('login');
              setError('');
              setFormData({ username: '', email: '', password: '' });
            }}
            className={`flex-1 py-2 px-4 rounded font-semibold transition ${
              mode === 'login'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => {
              setMode('register');
              setError('');
              setFormData({ username: '', email: '', password: '' });
            }}
            className={`flex-1 py-2 px-4 rounded font-semibold transition ${
              mode === 'register'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Register
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              {mode === 'login' ? 'Username or Email' : 'Username'}
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder={mode === 'login' ? 'Enter username or email' : 'At least 3 characters'}
              className="w-full px-4 py-2 rounded bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>

          {mode === 'register' && (
            <div className="mb-4">
              <label className="block text-gray-300 text-sm font-semibold mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                className="w-full px-4 py-2 rounded bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="mb-6">
            <label className="block text-gray-300 text-sm font-semibold mb-2">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder={mode === 'login' ? 'Enter password' : 'At least 8 characters'}
              className="w-full px-4 py-2 rounded bg-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin mr-2">⏳</span>
                {mode === 'login' ? 'Logging in...' : 'Registering...'}
              </span>
            ) : mode === 'login' ? (
              'Login'
            ) : (
              'Register'
            )}
          </button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-4">
          {mode === 'login'
            ? 'Don\'t have an account? Click "Register" above'
            : 'Already have an account? Click "Login" above'}
        </p>
      </div>
    </div>
  );
}

export default AuthPanel;
