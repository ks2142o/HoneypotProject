import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { RefreshCw, Search, Trash2, Download, Filter, Target } from 'lucide-react';

const HONEYPOT_COLOR = {
  'cowrie-ssh': 'text-cyber-green',
  'dionaea': 'text-cyber-blue',
  'flask-http': 'text-cyber-accent'
};

function AttackAdminPanel() {
  const [attacks, setAttacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [honeypotFilter, setHoneypotFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const PER_PAGE = 25;

  useEffect(() => {
    loadAttacks();
  }, [page, honeypotFilter, eventFilter, filter]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => {
      loadAttacks();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, page, honeypotFilter, eventFilter, filter]);

  const loadAttacks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.allAttacks();
      let allAttacks = [];
      if (Array.isArray(data?.attacks)) {
        allAttacks = data.attacks;
      } else if (Array.isArray(data)) {
        allAttacks = data;
      }

      if (!Array.isArray(allAttacks)) {
        throw new Error('Invalid backend response: attacks must be an array.');
      }

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
      setError(err.message || 'Failed to load attacks');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttack = async (attackId) => {
    if (!attackId) return;
    if (!window.confirm('Delete this attack record?')) return;
    try {
      await api.deleteAttack(attackId);
      loadAttacks();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const exportCSV = () => {
    if (attacks.length === 0) {
      alert('No data to export on this page.');
      return;
    }
    const csv = [
      ['Timestamp', 'Source IP', 'Honeypot', 'Event', 'Credentials', 'Command', 'Country'].join(','),
      ...attacks.map(a => [
        a['@timestamp'] || '',
        a.src_ip || '',
        a.honeypot_type || '',
        a.event_type || '',
        `${a.username || ''}:${a.password || ''}`,
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

  return (
    <div className="card max-w-7xl mx-auto mt-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-cyber-bright">
            <Target className="text-cyber-accent" size={22} />
            Global Attack Database
          </h2>
          <p className="text-xs text-cyber-muted mt-1 font-mono">
            Detailed logging of all intercepted malicious events across honeypots.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {error && <span className="text-red-400 text-xs mr-2">{error}</span>}

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyber-muted" />
            <input
              type="text"
              placeholder="Search IP, creds, commands..."
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setPage(1); }}
              className="cyber-input pl-8 w-48 text-xs"
            />
          </div>

          <div className="relative hidden xs:block">
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyber-muted" />
            <select
              value={honeypotFilter}
              onChange={(e) => { setHoneypotFilter(e.target.value); setPage(1); }}
              className="cyber-input pl-8 w-32 text-xs cursor-pointer appearance-none bg-no-repeat"
            >
              <option value="">All Services</option>
              <option value="cowrie-ssh">Cowrie (SSH/Telnet)</option>
              <option value="dionaea">Dionaea</option>
              <option value="flask-http">Flask (HTTP)</option>
            </select>
          </div>

          <button onClick={exportCSV} className="btn btn-ghost py-1.5 px-3 text-xs" title="Export page to CSV">
            <Download size={14} /> Export
          </button>
          
          <button 
            onClick={() => loadAttacks()} 
            className="btn btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={loading && !autoRefresh ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-cyber-border/50">
        <table className="data-table w-full text-left">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Source IP</th>
              <th>Honeypot</th>
              <th>Event</th>
              <th>Credentials</th>
              <th>Command / Input</th>
              <th>Country</th>
              <th className="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && attacks.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-8 text-cyber-muted">Loading database...</td></tr>
            ) : attacks.length === 0 ? (
              <tr><td colSpan="8" className="text-center py-8 text-cyber-muted">No attacks found for the given filters.</td></tr>
            ) : (
              attacks.map((a, i) => {
                const ts  = a['@timestamp'] ? new Date(a['@timestamp']).toLocaleString() : '—'
                const ip  = a.src_ip || '—'
                const hp  = a.honeypot_type || '—'
                const ev  = a.event_type || '—'
                const hpColor = HONEYPOT_COLOR[hp] || 'text-cyber-green'
                const numericId = Number(a.id)
                const canDelete = Number.isInteger(numericId) && String(numericId) === String(a.id)
                
                let creds = '—'
                if (a.username && a.password) creds = `${a.username}:${a.password}`
                else if (a.username) creds = a.username
                else if (a.password) creds = `:${a.password}`
                
                const cmd = a.input || a.message || '—'
                const cc  = (a.geoip && a.geoip.country_name) ? a.geoip.country_name : '—'

                return (
                  <tr key={a.id || i} className="hover:bg-white/5 transition-colors">
                    <td className="text-cyber-muted font-mono text-[11px] whitespace-nowrap">{ts}</td>
                    <td className="text-cyber-accent font-mono text-[11px] font-bold">{ip}</td>
                    <td className={`font-medium text-[11px] ${hpColor}`}>{hp.toUpperCase()}</td>
                    <td className="text-cyber-yellow text-[11px]">{ev}</td>
                    <td className="text-cyber-purple font-mono text-[11px]">{creds}</td>
                    <td className="text-cyber-muted text-[11px] max-w-xs truncate" title={cmd}>{cmd}</td>
                    <td className="text-cyber-bright text-[11px]">{cc}</td>
                    <td className="text-right">
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteAttack(numericId)}
                          className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-400/10 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 border-t border-cyber-border/30 pt-4">
          <span className="text-xs text-cyber-muted">
            Page <strong className="text-cyber-bright">{page}</strong> of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn btn-ghost py-1 px-3 text-xs disabled:opacity-30"
            >
              Previous
            </button>
            <div className="flex items-center mx-2 gap-1 hidden sm:flex">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = page <= 3 ? i + 1 : page - 2 + i;
                if (totalPages - page < 2) p = totalPages - 4 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[28px] h-7 rounded text-xs transition ${page === p ? 'bg-cyber-accent text-black font-bold' : 'text-cyber-muted hover:bg-white/10'}`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn btn-ghost py-1 px-3 text-xs disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttackAdminPanel;
