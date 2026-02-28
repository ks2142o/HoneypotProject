import { useState, useMemo } from 'react'
import { Crosshair, Search, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react'

const HONEYPOT_COLOR = {
  'cowrie-ssh': 'text-cyber-accent',
  'flask-http': 'text-cyber-green',
  'dionaea':    'text-cyber-red',
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export default function AttacksTable({ attacks, onRefresh }) {
  const [filter, setFilter]   = useState('')
  const [sortCol, setSortCol] = useState('@timestamp')
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage]       = useState(1)
  const PER_PAGE = 15

  const filtered = useMemo(() => {
    const q = filter.toLowerCase()
    return attacks.filter(a => {
      if (!q) return true
      return [a.src_ip, a.honeypot_type, a.event_type, a.username, a.password, a.input,
              (a.geoip ?? {}).country_name]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    })
  }, [attacks, filter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = String(a[sortCol] ?? '')
      const vb = String(b[sortCol] ?? '')
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [filtered, sortCol, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE))
  const paged      = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(false) }
    setPage(1)
  }
  const SortIcon = ({ col }) => sortCol === col
    ? (sortAsc ? <ChevronUp size={11} /> : <ChevronDown size={11} />)
    : null

  return (
    <div className="card">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="section-title" style={{ marginBottom: 0 }}>
          <Crosshair size={14} /> Recent Attack Events
          {filtered.length !== attacks.length && (
            <span className="ml-2 text-cyber-yellow font-mono">({filtered.length} / {attacks.length})</span>
          )}
        </p>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyber-muted" />
            <input
              type="text"
              placeholder="Filter by IP, country, command…"
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1) }}
              className="cyber-input pl-8 w-56 h-8 text-xs"
            />
          </div>
          <button className="btn btn-ghost py-1.5 px-3 text-xs" onClick={onRefresh}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-xl border border-cyber-border/50" style={{ maxHeight: 380 }}>
        {paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-cyber-muted gap-2">
            <Crosshair size={28} className="opacity-25" />
            <p className="text-sm">{attacks.length === 0 ? 'No attack events yet — waiting for traffic…' : 'No results match your filter'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {[
                  ['@timestamp', 'Timestamp'],
                  ['src_ip',      'Source IP'],
                  ['geoip',       'Country'],
                  ['honeypot_type','Honeypot'],
                  ['event_type',  'Event'],
                  ['username',    'Credentials / Command'],
                ].map(([col, label]) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="cursor-pointer select-none hover:text-cyber-accent transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      {label} <SortIcon col={col} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((a, i) => {
                const ts  = a['@timestamp'] ? new Date(a['@timestamp']).toLocaleString() : '—'
                const ip  = a.src_ip ?? '—'
                const cc  = (a.geoip ?? {}).country_name ?? '—'
                const hp  = a.honeypot_type ?? '—'
                const ev  = a.event_type ?? '—'
                const det = [a.username, a.password, a.input].filter(Boolean).join(' / ') || '—'
                return (
                  <tr key={i}>
                    <td className="text-cyber-muted font-mono whitespace-nowrap text-[11px]">{ts}</td>
                    <td className="text-cyber-accent font-mono text-[11px]">{ip}</td>
                    <td className="text-cyber-yellow text-[11px]">{cc}</td>
                    <td className={`font-medium text-[11px] ${HONEYPOT_COLOR[hp] ?? 'text-cyber-green'}`}>{hp}</td>
                    <td className="text-cyber-muted text-[11px]">{ev}</td>
                    <td
                      className="font-mono text-cyber-purple text-[11px]"
                      dangerouslySetInnerHTML={{ __html: escapeHtml(det) }}
                    />
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-cyber-muted">
          <span>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              className="btn btn-ghost py-1 px-2 text-xs disabled:opacity-30"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >‹ Prev</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i
              if (p > totalPages) return null
              return (
                <button
                  key={p}
                  className={`btn py-1 px-2.5 text-xs ${page === p ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPage(p)}
                >{p}</button>
              )
            })}
            <button
              className="btn btn-ghost py-1 px-2 text-xs disabled:opacity-30"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >Next ›</button>
          </div>
        </div>
      )}
    </div>
  )
}
