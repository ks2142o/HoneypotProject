import { useState, useRef } from 'react'
import { ScrollText, Play, Trash2, Download } from 'lucide-react'
import { api } from '../api'

const SERVICES = [
  { value: 'elasticsearch', label: '🔍 Elasticsearch' },
  { value: 'logstash',      label: '🔄 Logstash' },
  { value: 'kibana',        label: '📊 Kibana' },
  { value: 'cowrie',        label: '🐝 Cowrie SSH' },
  { value: 'dionaea',       label: '🪤 Dionaea' },
  { value: 'flask',         label: '🌐 Flask HTTP' },
  { value: 'webapp',        label: '🖥️ Dashboard' },
]

export default function LogsViewer({ notify }) {
  const [service, setService] = useState('')
  const [logs, setLogs]       = useState('')
  const [loading, setLoading] = useState(false)
  const termRef = useRef(null)

  const fetchLogs = async () => {
    if (!service) { notify('Select a service first', 'error'); return }
    setLoading(true)
    try {
      const data = await api.logs(service)
      setLogs(data.logs || '(no logs available)')
      setTimeout(() => {
        if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
      }, 50)
    } catch (e) {
      setLogs(`Error fetching logs: ${e.message}`)
    }
    setLoading(false)
  }

  const downloadLogs = () => {
    if (!logs) return
    const blob = new Blob([logs], { type: 'text/plain' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${service}-logs-${new Date().toISOString().slice(0,10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card">
      <p className="section-title">
        <ScrollText size={14} /> Service Logs
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={service}
          onChange={e => setService(e.target.value)}
          className="cyber-input min-w-[190px]"
        >
          <option value="">Select a service…</option>
          {SERVICES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <button
          className="btn btn-primary"
          onClick={fetchLogs}
          disabled={loading || !service}
        >
          {loading ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-cyber-accent/30 border-t-cyber-accent rounded-full animate-spin" />
              Loading…
            </>
          ) : (
            <><Play size={13} /> Show Logs</>
          )}
        </button>

        {logs && (
          <>
            <button className="btn btn-warning" onClick={downloadLogs}>
              <Download size={13} /> Download
            </button>
            <button className="btn btn-ghost" onClick={() => setLogs('')}>
              <Trash2 size={13} /> Clear
            </button>
          </>
        )}
      </div>

      {logs && (
        <div ref={termRef} className="terminal">
          {logs}
        </div>
      )}

      {!logs && (
        <div className="flex items-center justify-center h-24 text-cyber-muted text-xs gap-2 opacity-50">
          <ScrollText size={16} />
          Select a service and click Show Logs
        </div>
      )}
    </div>
  )
}
