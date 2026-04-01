import { useState, useEffect, useCallback, useRef } from 'react'
import Header       from './components/Header'
import StatCards    from './components/StatCards'
import ServiceStatus from './components/ServiceStatus'
import ControlPanel from './components/ControlPanel'
import WorldMap     from './components/WorldMap'
import Charts       from './components/Charts'
import AttacksTable from './components/AttacksTable'
import LogsViewer   from './components/LogsViewer'
import Notifications from './components/Notifications'
import AuthPanel    from './components/AuthPanel'
import UserAdminPanel from './components/UserAdminPanel'
import AttackAdminPanel from './components/AttackAdminPanel'
import { api, getMe, logout } from './api'

export default function App() {
  /* ── auth state ──────────────────────────────────────────── */
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  /* ── dashboard state ─────────────────────────────────────── */
  const [status,      setStatus]      = useState({})
  const [stats,       setStats]       = useState({ total_docs: 0, indices: 0, status: 'loading' })
  const [health,      setHealth]      = useState({})
  const [attacks,     setAttacks]     = useState([])
  const [credentials, setCredentials] = useState({ top_usernames: [], top_passwords: [] })
  const [commands,    setCommands]    = useState({ top_commands: [] })
  const [countries,   setCountries]   = useState({ by_country: [] })
  const [timeline,    setTimeline]    = useState({ timeline: [] })
  const [geoPoints,   setGeoPoints]   = useState({ points: [] })
  const [isRefreshing, setRefreshing] = useState(false)
  const notifRef = useRef(null)

  /* ── check auth on mount ─────────────────────────────────── */
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getMe()
        setUser(currentUser)
      } catch (e) {
        setUser(null)
      } finally {
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [])

  /* ── handle logout ───────────────────────────────────────── */
  const handleLogout = async () => {
    try {
      await logout()
      setUser(null)
      notifRef.current?.add('Logged out successfully', 'success')
    } catch (e) {
      notifRef.current?.add(`Logout failed: ${e.message}`, 'error')
    }
  }

  const isAdmin = user?.role === 'admin'

  /* ── loaders ─────────────────────────────────────────────── */
  const load = useCallback(async (fn, setter) => {
    try { setter(await fn()) } catch (e) { /* ES might not be up yet */ }
  }, [])

  const loadStatus = useCallback(() => load(api.status,   setStatus),   [load])
  const loadStats  = useCallback(() => load(api.stats,    setStats),    [load])
  const loadHealth = useCallback(() => load(api.health,   setHealth),   [load])

  const loadAnalytics = useCallback(() => Promise.all([
    load(api.recentAttacks,  setAttacks),
    load(api.topCredentials, setCredentials),
    load(api.topCommands,    setCommands),
    load(api.byCountry,      setCountries),
    load(api.timeline,       setTimeline),
    load(api.geoPoints,      setGeoPoints),
  ]), [load])

  const refreshAll = useCallback(async () => {
    setRefreshing(true)
    await Promise.allSettled([loadStatus(), loadStats(), loadHealth(), loadAnalytics()])
    setRefreshing(false)
  }, [loadStatus, loadStats, loadHealth, loadAnalytics])

  /* ── auto-refresh intervals ──────────────────────────────── */
  useEffect(() => {
    if (!user) return
    refreshAll()
    const fast  = setInterval(loadStatus, 10_000)
    const slow  = setInterval(() => {
      loadStats(); loadHealth(); loadAnalytics()
    }, 30_000)
    return () => { clearInterval(fast); clearInterval(slow) }
  }, [refreshAll, loadStatus, loadStats, loadHealth, loadAnalytics, user])

  /* ── notification helper ─────────────────────────────────── */
  const notify = useCallback((msg, type = 'info') => {
    notifRef.current?.add(msg, type)
  }, [])

  /* ── action handlers ─────────────────────────────────────── */
  const handleDeployAll = async () => {
    notify('Starting all stopped services…', 'info')
    try {
      await api.deployAll()
      notify('Services started successfully', 'success')
      setTimeout(refreshAll, 5000)
    } catch (e) { notify(`Deploy failed: ${e.message}`, 'error') }
  }

  const handleDeployService = async (svc) => {
    try {
      await api.deployService(svc)
      notify(`${svc} started`, 'success')
      setTimeout(loadStatus, 2000)
    } catch (e) { notify(`${svc}: ${e.message}`, 'error') }
  }

  const handleShutdown = async () => {
    try {
      await api.shutdown()
      notify('All services stopped', 'success')
      setTimeout(loadStatus, 2000)
    } catch (e) { notify(`Shutdown failed: ${e.message}`, 'error') }
  }

  /* ── derived values ──────────────────────────────────────── */
  const runningCount = Object.values(status).filter(s => s.status === 'running').length
  const topCountry   = countries.by_country?.[0]?.key ?? '—'

  /* ── render: loading state ───────────────────────────────── */
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    )
  }

  /* ── render: not authenticated ───────────────────────────── */
  if (!user) {
    return (
      <div className="min-h-screen bg-cyber-bg">
        <Notifications ref={notifRef} />
        <AuthPanel onAuthenticated={() => {
          // Refresh auth state after successful login
          getMe().then(setUser).catch(() => setUser(null))
        }} />
      </div>
    )
  }

  /* ── render: authenticated dashboard ─────────────────────── */
  return (
    <div className="min-h-screen bg-cyber-bg">
      <Notifications ref={notifRef} />

      <Header
        user={user}
        isAdmin={isAdmin}
        health={health}
        isRefreshing={isRefreshing}
        onRefresh={refreshAll}
        onDeployAll={handleDeployAll}
        onShutdown={handleShutdown}
        onLogout={handleLogout}
      />

      <main className="max-w-screen-2xl mx-auto px-4 py-5 space-y-5 animate-fadeIn">

        {/* Admin user management panel */}
        {isAdmin && <UserAdminPanel />}

        {/* Admin attack database management panel */}
        {isAdmin && <AttackAdminPanel />}

        {/* Stats row */}
        <StatCards
          totalDocs={stats.total_docs}
          runningCount={runningCount}
          totalServices={Object.keys(status).length}
          topCountry={topCountry}
          indices={stats.indices}
          esStatus={stats.status}
        />

        {/* Service status + control panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <ServiceStatus
              status={status}
              onDeploy={handleDeployService}
              isAdmin={isAdmin}
            />
          </div>
          <ControlPanel
            health={health}
            onDeployAll={handleDeployAll}
            isAdmin={isAdmin}
          />
        </div>

        {/* World map */}
        <WorldMap points={geoPoints.points || []} onRefresh={() => load(api.geoPoints, setGeoPoints)} />

        {/* Charts row */}
        <Charts
          timeline={timeline.timeline || []}
          countries={countries.by_country || []}
          usernames={credentials.top_usernames || []}
          passwords={credentials.top_passwords || []}
          commands={commands.top_commands || []}
        />

        {/* Recent attacks */}
        <AttacksTable attacks={attacks.attacks || []} onRefresh={() => load(api.recentAttacks, setAttacks)} />

        {/* Logs */}
        <LogsViewer notify={notify} />

      </main>
    </div>
  )
}
