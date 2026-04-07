import { RefreshCw, Shield, Rocket, LogOut } from 'lucide-react'

const HealthDot = ({ label, value }) => {
  const ok = ['healthy', 'green', 'yellow'].includes(String(value).toLowerCase())
  return (
    <span className={`flex items-center gap-1.5 text-xs font-mono ${ok ? 'text-cyber-green' : 'text-cyber-red'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-cyber-green animate-pulse-slow' : 'bg-cyber-red'}`} />
      {label}
    </span>
  )
}

export default function Header({
  user,
  isAdmin,
  health,
  isRefreshing,
  runningCount,
  totalServices,
  adminView,
  setAdminView,
  onRefresh,
  onDeployAll,
  onLogout,
}) {
  const showRecover = isAdmin && (!totalServices || runningCount < totalServices)

  return (
    <header
      className="sticky top-0 z-50 border-b border-cyber-border/60 backdrop-blur-md"
      style={{ background: 'linear-gradient(90deg, rgba(10,14,26,0.97) 0%, rgba(22,32,64,0.97) 50%, rgba(10,14,26,0.97) 100%)' }}
    >
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-3">

        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyber-accent/10 border border-cyber-accent/30
                          flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
            <Shield size={18} className="text-cyber-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-cyber-bright tracking-wide leading-none truncate">
              SENTINEL <span className="hidden sm:inline">SECURITY CONSOLE</span>
            </h1>
            <p className="hidden sm:block text-[10px] text-cyber-muted mt-1 font-mono tracking-wide">
              Research Threat Intelligence Platform
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 md:gap-2 mx-2 p-1 rounded-lg border border-cyber-border bg-cyber-card2/70">
            {[
              { id: 'dashboard', label: 'Main Dashboard' },
              { id: 'attacks', label: 'Attack Database' },
              { id: 'users', label: 'User Management' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAdminView(tab.id)}
                className={`text-xs md:text-sm font-medium transition-colors px-2.5 py-1.5 rounded-md border ${
                  adminView === tab.id
                    ? 'text-cyber-accent border-cyber-accent/40 bg-cyber-accent/10'
                    : 'text-cyber-muted border-transparent hover:text-cyber-bright hover:border-cyber-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0 mt-2 sm:mt-0 ml-auto">

          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-pulse-slow shadow-glow-green" />
            <span className="hidden sm:inline text-xs text-cyber-muted font-mono tracking-widest">LIVE</span>
          </div>

          <div className="hidden xl:flex items-center rounded-md border border-cyber-green/30 bg-cyber-green/10 px-2.5 py-1 text-[11px] font-mono text-cyber-green">
            Safe Mode
          </div>

          <div className="hidden md:flex items-center rounded-md border border-cyber-border bg-cyber-card2 px-2.5 py-1 text-[11px] font-mono text-cyber-muted">
            {runningCount}/{totalServices || 0} services online
          </div>

          {/* Component health — hidden on mobile */}
          <div className="hidden lg:flex items-center gap-4 border-l border-cyber-border pl-4">
            <HealthDot label="Docker" value={health.docker ?? '…'} />
            <HealthDot label="ES"     value={health.elasticsearch ?? '…'} />
          </div>

          {/* User info and auth */}
          <div className="flex items-center gap-1.5 sm:gap-2 border-l border-cyber-border pl-2 sm:pl-4">
            {user && (
              <div className="flex items-center gap-2">
                <div className="text-xs sm:text-sm text-cyber-muted hidden sm:block">
                  <div className="font-semibold text-cyber-bright">{user.username}</div>
                  <div className="text-[10px] font-mono">{isAdmin ? 'Admin Operator' : 'Analyst User'}</div>
                </div>
                <button
                  className="btn btn-ghost px-2 sm:px-3"
                  onClick={onLogout}
                  title="Logout"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isAdmin && (
              <>
                {showRecover && (
                  <button
                    className="btn btn-success px-2.5 sm:px-4"
                    onClick={() => { if (window.confirm('Start all stopped services?')) onDeployAll() }}
                    title="Start all stopped services (admin only)"
                  >
                    <Rocket size={14} />
                    <span className="hidden sm:inline">Recover</span>
                  </button>
                )}
              </>
            )}

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
