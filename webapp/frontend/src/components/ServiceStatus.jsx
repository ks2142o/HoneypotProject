import { Play, RotateCcw, Network } from 'lucide-react'

const SERVICE_META = {
  elasticsearch: { label: 'Elasticsearch', emoji: '🔍', group: 'elk' },
  logstash:      { label: 'Logstash',      emoji: '🔄', group: 'elk' },
  kibana:        { label: 'Kibana',         emoji: '📊', group: 'elk' },
  cowrie:        { label: 'Cowrie SSH',    emoji: '🐝', group: 'honeypot' },
  dionaea:       { label: 'Dionaea',       emoji: '🪤', group: 'honeypot' },
  flask:         { label: 'Flask HTTP',    emoji: '🌐', group: 'honeypot' },
  webapp:        { label: 'Dashboard',     emoji: '🖥️', group: 'other' },
}

function ServiceCard({ name, info, onDeploy }) {
  const running = info.status === 'running'
  const meta    = SERVICE_META[name] ?? { label: name, emoji: '📦', group: 'other' }

  return (
    <div
      className={`relative rounded-xl p-4 border transition-all duration-200 group
                  ${running
                    ? 'bg-cyber-green/[0.04] border-cyber-green/20 hover:border-cyber-green/40'
                    : 'bg-cyber-card2 border-cyber-border hover:border-cyber-red/30'}`}
    >
      {/* Status strip */}
      <div
        className={`absolute top-0 left-0 right-0 h-0.5 rounded-t-xl
                    ${running ? 'bg-gradient-to-r from-transparent via-cyber-green to-transparent' : 'bg-gradient-to-r from-transparent via-cyber-red/50 to-transparent'}`}
      />

      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-base leading-none">{meta.emoji}</span>
          <p className="text-xs font-semibold text-cyber-bright mt-1 leading-tight">{meta.label}</p>
        </div>
        <span
          className={`w-2.5 h-2.5 rounded-full mt-0.5 ${running ? 'bg-cyber-green shadow-glow-green animate-pulse-slow' : 'bg-cyber-red/60'}`}
        />
      </div>

      <span className={`badge ${running ? 'badge-running' : 'badge-stopped'}`}>
        {info.status}
      </span>

      {info.health && info.health !== 'none' && info.health !== 'unknown' && (
        <p className="text-[10px] text-cyber-muted mt-1.5 font-mono">
          health: <span className={info.health === 'healthy' ? 'text-cyber-green' : 'text-cyber-yellow'}>{info.health}</span>
        </p>
      )}

      <button
        className={`mt-3 w-full text-[11px] py-1.5 rounded-lg border transition-all duration-200 flex items-center justify-center gap-1
                    ${running
                      ? 'bg-cyber-accent/5 border-cyber-accent/20 text-cyber-accent hover:bg-cyber-accent/10'
                      : 'bg-cyber-green/5  border-cyber-green/20 text-cyber-green  hover:bg-cyber-green/10'}`}
        onClick={() => onDeploy(name)}
      >
        {running ? <RotateCcw size={11} /> : <Play size={11} />}
        {running ? 'Restart' : 'Start'}
      </button>
    </div>
  )
}

export default function ServiceStatus({ status, onDeploy }) {
  const entries = Object.entries(status)

  return (
    <div className="card h-full">
      <p className="section-title">
        <Network size={14} /> Service Status
      </p>

      {entries.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyber-accent/30 border-t-cyber-accent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-cyber-muted">Loading service status…</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {entries.map(([name, info]) => (
            <ServiceCard key={name} name={name} info={info} onDeploy={onDeploy} />
          ))}
        </div>
      )}
    </div>
  )
}
