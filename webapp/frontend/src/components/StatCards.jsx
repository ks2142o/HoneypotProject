import { Database, Server, Globe, Layers, TrendingUp, AlertTriangle } from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color, colorClass }) {
  return (
    <div className="stat-card group">
      {/* Background glow blob */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-[11px] font-semibold tracking-widest uppercase text-cyber-muted">{label}</p>
          <p
            className={`text-[2.2rem] font-bold font-mono leading-tight mt-1 count-animate ${colorClass}`}
            key={value}
          >
            {value ?? '—'}
          </p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center border opacity-80"
          style={{ background: `${color}15`, borderColor: `${color}30` }}
        >
          <Icon size={20} style={{ color }} />
        </div>
      </div>

      <p className="text-[11px] text-cyber-muted mt-2 relative z-10">{sub}</p>
    </div>
  )
}

export default function StatCards({ totalDocs, runningCount, totalServices, topCountry, indices, esStatus }) {
  const esConnected = esStatus === 'connected'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Events"
        value={esConnected ? (totalDocs?.toLocaleString() ?? '0') : '—'}
        sub={esConnected ? 'Indexed in Elasticsearch' : 'Awaiting Elasticsearch…'}
        icon={esConnected ? Database : AlertTriangle}
        color="#00d4ff"
        colorClass="text-cyber-accent"
      />
      <StatCard
        label="Active Services"
        value={totalServices ? `${runningCount} / ${totalServices}` : '—'}
        sub="Docker containers running"
        icon={Server}
        color="#00ff9d"
        colorClass="text-cyber-green"
      />
      <StatCard
        label="Top Attacker Country"
        value={topCountry}
        sub="Most attack traffic"
        icon={Globe}
        color="#ffd32a"
        colorClass="text-cyber-yellow text-2xl mt-1"
      />
      <StatCard
        label="ES Indices"
        value={esConnected ? (indices ?? '0') : '—'}
        sub="Honeypot log indices"
        icon={Layers}
        color="#a55eea"
        colorClass="text-cyber-purple"
      />
    </div>
  )
}
