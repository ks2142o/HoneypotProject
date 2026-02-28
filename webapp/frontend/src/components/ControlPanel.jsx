import { BarChart2, Bug, ExternalLink, Search, HeartPulse } from 'lucide-react'

const HEALTH_COLOR = (v) => {
  if (['healthy', 'green'].includes(v))  return 'text-cyber-green'
  if (v === 'yellow')                     return 'text-cyber-yellow'
  if (v === 'unreachable' || v === 'unknown') return 'text-cyber-yellow'
  return 'text-cyber-red'
}

export default function ControlPanel({ health, onDeployELK, onDeployHoneypots }) {
  return (
    <div className="card flex flex-col gap-5">
      <p className="section-title">
        <BarChart2 size={14} /> Controls &amp; Links
      </p>

      {/* Deploy subset */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-cyber-muted">Deploy Subset</p>
        <button
          className="btn btn-primary w-full justify-center"
          onClick={() => { if (window.confirm('Deploy ELK Stack?')) onDeployELK() }}
        >
          <BarChart2 size={14} /> Deploy ELK Stack
        </button>
        <button
          className="btn btn-primary w-full justify-center"
          onClick={() => { if (window.confirm('Deploy Honeypots?')) onDeployHoneypots() }}
        >
          <Bug size={14} /> Deploy Honeypots
        </button>
      </div>

      {/* Quick links */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-cyber-muted">Quick Links</p>
        <a
          href="http://localhost:5601"
          target="_blank"
          rel="noreferrer"
          className="btn btn-warning w-full justify-center"
        >
          <ExternalLink size={14} /> Kibana Dashboard
        </a>
        <a
          href="http://localhost:9200/_cat/indices?v"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost w-full justify-center"
        >
          <Search size={14} /> Elasticsearch API
        </a>
      </div>

      {/* Health panel */}
      <div className="bg-cyber-card2 border border-cyber-border rounded-xl p-4 mt-auto">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse size={13} className="text-cyber-accent" />
          <p className="text-[10px] font-semibold tracking-widest uppercase text-cyber-muted">System Health</p>
        </div>
        <div className="space-y-1.5">
          {Object.entries(health).map(([k, v]) => (
            <div key={k} className="flex justify-between items-center text-xs">
              <span className="text-cyber-muted font-mono capitalize">{k}</span>
              <span className={`font-mono font-medium ${HEALTH_COLOR(String(v))}`}>
                {String(v)}
              </span>
            </div>
          ))}
          {Object.keys(health).length === 0 && (
            <p className="text-xs text-cyber-muted">Loading…</p>
          )}
        </div>
      </div>
    </div>
  )
}
