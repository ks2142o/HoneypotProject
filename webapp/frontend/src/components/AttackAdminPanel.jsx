import React, { useState, useEffect } from 'react';
import * as api from '../api';

function AttackAdminPanel() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [honeypotFilter, setHoneypotFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PER_PAGE = 50;

  useEffect(() => {
    loadAttacks();
  }, [page, honeypotFilter, eventFilter]);

  const loadAttacks = async () => {
    setLoading(true);
    setError('');
    try {
      // Use the existing API but with admin access
      const data = await api.recentAttacks();
      let allAttacks = Array.isArray(data?.attacks) ? data.attacks : [];
      if (allAttacks.length === 0 && Array.isArray(data)) {
        // fallback if endpoint returns plain array
        allAttacks = data;
      }

      // Apply filters
      if (honeypotFilter) {
        allAttacks = allAttacks.filter(a => a.honeypot_type === honeypotFilter);
      }
      if (eventFilter) {
        allAttacks = allAttacks.filter(a => a.event_type === eventFilter);
      }
      if (filter) {
        const q = filter.toLowerCase();
        allAttacks = allAttacks.filter(a =>
          (a.src_ip || '').toLowerCase().includes(q) ||
          (a.username || '').toLowerCase().includes(q) ||
          (a.password || '').toLowerCase().includes(q) ||
          (a.input || '').toLowerCase().includes(q) ||
          (a.honeypot_type || '').toLowerCase().includes(q)
        );
      }

      setTotalPages(Math.ceil(allAttacks.length / PER_PAGE));
      const start = (page - 1) * PER_PAGE;
      const paginated = allAttacks.slice(start, start + PER_PAGE);
      setAttacks(paginated);
    } catch (err) {
      setError((err && err.message) ? err.message : String(err || 'Failed to load attacks'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttack = async (attackId) => {
    if (!attackId) {
      setError('Delete not available for this record (missing ID)');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this attack record?')) return;

    // TODO: implement backend delete endpoint (/api/attacks/:id)
    setError('Delete functionality not implemented yet');
  };

  const exportData = () => {
    const csv = [
      ['Timestamp', 'Source IP', 'Honeypot', 'Event', 'Username', 'Password', 'Command', 'Country'].join(','),
      ...attacks.map(a => [
        a['@timestamp'] || '',
        a.src_ip || '',
        a.honeypot_type || '',
        a.event_type || '',
        a.username || '',
        a.password || '',
        a.input || '',
        (a.geoip || {}).country_name || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attacks-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueHoneypots = [...new Set(attacks.map(a => a.honeypot_type).filter(Boolean))];
  const uniqueEvents = [...new Set(attacks.map(a => a.event_type).filter(Boolean))];

  if (loading && attacks.length === 0) {
    return <div className="text-center text-gray-300 py-8">Loading attack data...</div>;
  }

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-white mb-6">Attack Database Management</h2>

      {error && (
        <div className="bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Filters and Actions */}
      <div className="mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search attacks..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={honeypotFilter}
            onChange={(e) => setHoneypotFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Honeypots</option>
            {uniqueHoneypots.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Events</option>
            {uniqueEvents.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <button
            onClick={exportData}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition"
          >
            Export CSV
          </button>
        </div>
        <button
          onClick={loadAttacks}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition"
        >
          Apply Filters
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-400">{attacks.length}</div>
          <div className="text-gray-300">Records Shown</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{uniqueHoneypots.length}</div>
          <div className="text-gray-300">Honeypot Types</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{uniqueEvents.length}</div>
          <div className="text-gray-300">Event Types</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{page}/{totalPages}</div>
          <div className="text-gray-300">Current Page</div>
        </div>
      </div>

      {/* Attacks Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-gray-300">
          <thead className="border-b border-gray-600">
            <tr>
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Source IP</th>
              <th className="px-4 py-2">Honeypot</th>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Credentials</th>
              <th className="px-4 py-2">Command</th>
              <th className="px-4 py-2">Country</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {attacks.map((attack, index) => (
              <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                <td className="px-4 py-3 font-mono text-xs">
                  {attack['@timestamp'] ? new Date(attack['@timestamp']).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-blue-400">{attack.src_ip || '—'}</td>
                <td className="px-4 py-3 text-green-400">{attack.honeypot_type || '—'}</td>
                <td className="px-4 py-3 text-yellow-400">{attack.event_type || '—'}</td>
                <td className="px-4 py-3 text-purple-400">
                  {attack.username && attack.password ? `${attack.username}:${attack.password}` :
                   attack.username ? attack.username :
                   attack.password ? `:${attack.password}` : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400 max-w-xs truncate">
                  {attack.input || '—'}
                </td>
                <td className="px-4 py-3 text-cyan-400">
                  {(attack.geoip || {}).country_name || '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDeleteAttack(attack.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded"
          >
            Previous
          </button>
          <span className="text-gray-300">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white rounded"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default AttackAdminPanel;