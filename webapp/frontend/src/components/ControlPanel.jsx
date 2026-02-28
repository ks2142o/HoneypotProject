import { Play, ExternalLink, HeartPulse, Activity } from 'lucide-react'

const HEALTH_COLOR = (v) => {
  if (['healthy', 'green'].includes(v))              return 'text-cyber-green'
  if (v === 'yellow')                                return 'text-cyber-yellow'
  if (['unreachable', 'unknown', '…'].includes(v))   return 'text-cyber-yellow'
  return 'text-cyber-red'
}

export default function ControlPanel({ health, onDeployAll }) {
  // Build URLs relative to the current browser host so links work on
  // localhost (WSL2) and remote alike — only the port changes.
  const host      = window.location.hostname
  const kibanaUrl = `http://${host}:5601`
  const ngrokUrl  = `http://${host}:4040`

  return (
    <div className="card flex flex-col gap-5">
      <p className="section-title">
        <Activity size={14} /> Quick Actions
      </p>

      {/* ── Service control ───────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-cyber-muted">
          Service Control
        </p>
        <button
          className="btn btn-success w-full justify-center"
          onClick={() => {
            if (window.confirm('Start all stopped services?')) onDeployAll()
          }}
        >
          <Play size={14} /> Start All Services
        </button>
      </div>

      {/* ── External links ────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-cyber-muted">
          Open in Browser
        </p>
        <a
          href={kibanaUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-warning w-full justify-center"
        >
          <ExternalLink size={14} /> Kibana Dashboards
        </a>
        <a
          href={ngrokUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost w-full justify-center"
        >
          <ExternalLink size={14} /> ngrok Inspector
        </a>
        <p className="text-[10px] text-cyber-muted leading-relaxed">
          Kibana: port&nbsp;5601&nbsp;·&nbsp;ngrok inspector: port&nbsp;4040
          (run <code className="font-mono bg-cyber-card2 px-1 rounded">make expose</code> first)
        </p>
      </div>

      {/* ── System health ─────────────────────────────────────── */}
      <div className="bg-cyber-card2 border border-cyber-border rounded-xl p-4 mt-auto">
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse size={13} className="text-cyber-accent" />
          <p className="text-[10px] font-semibold tracking-widest uppercase text-cyber-muted">
            System Health
          </p>
        </div>
        <div className="space-y-1.5">
          {Object.entries(health).map(([k, v]) =>
            k !== 'timestamp' && (
              <div key={k} className="flex justify-between items-center text-xs">
                <span className="text-cyber-muted font-mono capitalize">{k}</span>
                <span className={`font-mono font-medium ${HEALTH_COLOR(String(v))}`}>
                  {String(v)}
                </span>
              </div>
            )
          )}
          {Object.keys(health).length === 0 && (
            <p className="text-xs text-cyber-muted">Loading…</p>
          )}
        </div>
      </div>
    </div>
  )
}
