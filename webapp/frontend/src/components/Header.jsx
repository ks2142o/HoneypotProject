import { RefreshCw, Shield, Rocket, StopCircle } from 'lucide-react'

const HealthDot = ({ label, value }) => {
  const ok = ['healthy', 'green', 'yellow'].includes(String(value).toLowerCase())
  return (
    <span className={`flex items-center gap-1.5 text-xs font-mono ${ok ? 'text-cyber-green' : 'text-cyber-red'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-cyber-green animate-pulse-slow' : 'bg-cyber-red'}`} />
      {label}
    </span>
  )
}

export default function Header({ health, isRefreshing, onRefresh, onDeployAll, onShutdown }) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-cyber-border/60 backdrop-blur-md"
      style={{ background: 'linear-gradient(90deg, rgba(10,14,26,0.97) 0%, rgba(22,32,64,0.97) 50%, rgba(10,14,26,0.97) 100%)' }}
    >
      <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyber-accent/10 border border-cyber-accent/30
                          flex items-center justify-center shadow-[0_0_15px_rgba(0,212,255,0.2)]">
            <Shield size={20} className="text-cyber-accent" />
          </div>
          <div>
            <h1 className="text-base font-bold text-cyber-bright tracking-wide leading-none">
              HONEYPOT THREAT INTELLIGENCE
            </h1>
            <p className="text-[11px] text-cyber-muted font-mono mt-0.5">
              Automated Defence Platform v2.0
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-5">

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse-slow shadow-glow-green" />
            <span className="text-xs text-cyber-muted font-mono tracking-widest">LIVE</span>
          </div>

          {/* Component health */}
          <div className="hidden md:flex items-center gap-4 border-l border-cyber-border pl-4">
            <HealthDot label="Docker" value={health.docker ?? '…'} />
            <HealthDot label="ES"     value={health.elasticsearch ?? '…'} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              className="btn btn-success"
              onClick={() => { if (window.confirm('Start all stopped services?')) onDeployAll() }}
            >
              <Rocket size={14} /> Start Services
            </button>

            <button
              className="btn btn-danger"
              onClick={() => { if (window.confirm('Stop ALL services? Confirm?')) onShutdown() }}
            >
              <StopCircle size={14} /> Shutdown
            </button>

            <button
              className="btn btn-ghost"
              onClick={onRefresh}
              title="Refresh all data"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
