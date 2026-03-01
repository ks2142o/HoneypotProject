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
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-3">

        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyber-accent/10 border border-cyber-accent/30
                          flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
            <Shield size={18} className="text-cyber-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-cyber-bright tracking-wide leading-none truncate">
              HONEYPOT <span className="hidden sm:inline">THREAT INTELLIGENCE</span>
            </h1>
            <p className="text-[10px] sm:text-[11px] text-cyber-muted font-mono mt-0.5 hidden xs:block">
              Automated Defence Platform v2.0
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse-slow shadow-glow-green" />
            <span className="hidden sm:inline text-xs text-cyber-muted font-mono tracking-widest">LIVE</span>
          </div>

          {/* Component health — hidden on mobile */}
          <div className="hidden lg:flex items-center gap-4 border-l border-cyber-border pl-4">
            <HealthDot label="Docker" value={health.docker ?? '…'} />
            <HealthDot label="ES"     value={health.elasticsearch ?? '…'} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              className="btn btn-success px-2.5 sm:px-4"
              onClick={() => { if (window.confirm('Start all stopped services?')) onDeployAll() }}
              title="Start all stopped services"
            >
              <Rocket size={14} />
              <span className="hidden sm:inline">Start Services</span>
            </button>

            <button
              className="btn btn-danger px-2.5 sm:px-4"
              onClick={() => { if (window.confirm('Stop ALL services? Confirm?')) onShutdown() }}
              title="Shutdown all services"
            >
              <StopCircle size={14} />
              <span className="hidden sm:inline">Shutdown</span>
            </button>

            <button
              className="btn btn-ghost px-2.5 sm:px-4"
              onClick={onRefresh}
              title="Refresh all data"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
