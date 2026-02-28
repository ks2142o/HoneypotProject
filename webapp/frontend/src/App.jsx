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
import { api }      from './api'

export default function App() {
  /* ── state ───────────────────────────────────────────────── */
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
    refreshAll()
    const fast  = setInterval(loadStatus, 10_000)
    const slow  = setInterval(() => {
      loadStats(); loadHealth(); loadAnalytics()
    }, 30_000)
    return () => { clearInterval(fast); clearInterval(slow) }
  }, [refreshAll, loadStatus, loadStats, loadHealth, loadAnalytics])

  /* ── notification helper ─────────────────────────────────── */
  const notify = useCallback((msg, type = 'info') => {
    notifRef.current?.add(msg, type)
  }, [])

  /* ── action handlers ─────────────────────────────────────── */
  const handleDeployAll = async () => {
    notify('Full deployment started — this may take several minutes…', 'info')
    try {
      await api.deployAll()
      notify('Deployment triggered successfully', 'success')
      setTimeout(refreshAll, 8000)
    } catch (e) { notify(`Deploy failed: ${e.message}`, 'error') }
  }

  const handleDeployService = async (svc) => {
    try {
      await api.deployService(svc)
      notify(`${svc} started`, 'success')
      setTimeout(loadStatus, 2000)
    } catch (e) { notify(`${svc}: ${e.message}`, 'error') }
  }

  const handleDeployELK = async () => {
    notify('Deploying ELK stack…', 'info')
    try {
      await api.deployService('elasticsearch')
      await api.deployService('logstash')
      await api.deployService('kibana')
      notify('ELK stack deployment started', 'success')
      setTimeout(refreshAll, 5000)
    } catch (e) { notify(`ELK deploy failed: ${e.message}`, 'error') }
  }

  const handleDeployHoneypots = async () => {
    notify('Deploying honeypots…', 'info')
    try {
      await Promise.all([
        api.deployService('cowrie'),
        api.deployService('dionaea'),
        api.deployService('flask'),
      ])
      notify('Honeypots deployed', 'success')
      setTimeout(loadStatus, 3000)
    } catch (e) { notify(`Honeypot deploy failed: ${e.message}`, 'error') }
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

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-cyber-bg">
      <Notifications ref={notifRef} />

      <Header
        health={health}
        isRefreshing={isRefreshing}
        onRefresh={refreshAll}
        onDeployAll={handleDeployAll}
        onShutdown={handleShutdown}
      />

      <main className="max-w-screen-2xl mx-auto px-4 py-5 space-y-5 animate-fadeIn">

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
            />
          </div>
          <ControlPanel
            health={health}
            onDeployELK={handleDeployELK}
            onDeployHoneypots={handleDeployHoneypots}
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
