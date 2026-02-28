import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp, Flag, User, Key, Terminal } from 'lucide-react'

/* ── Shared tooltip style ──────────────────────────────────── */
const TooltipStyle = {
  contentStyle: {
    background: '#0f1629', border: '1px solid #1d2d55',
    borderRadius: 8, color: '#c9d1d9', fontSize: 12,
  },
  cursor: { fill: 'rgba(0,212,255,0.05)' },
}

/* ── Generic empty state ───────────────────────────────────── */
function Empty({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-cyber-muted text-xs gap-2">
      <div className="w-8 h-8 rounded-full border border-cyber-border/50 flex items-center justify-center opacity-40">
        <TrendingUp size={14} />
      </div>
      {message}
    </div>
  )
}

/* ── Attack Timeline ───────────────────────────────────────── */
function TimelineChart({ data }) {
  if (!data.length) return <Empty message="No timeline data yet" />
  const formatted = data.map(b => ({
    time:   new Date(b.key_as_string ?? b.key).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    attacks: b.doc_count,
  }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="attackFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1d2d55" />
        <XAxis dataKey="time" tick={{ fill: '#8b949e', fontSize: 10 }} tickLine={false} />
        <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip {...TooltipStyle} />
        <Area
          type="monotone" dataKey="attacks" stroke="#00d4ff" strokeWidth={2}
          fill="url(#attackFill)" dot={false} activeDot={{ r: 4, fill: '#00d4ff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/* ── Generic horizontal bar chart ─────────────────────────── */
function HBarChart({ data, color, keyField = 'key', valueField = 'doc_count', emptyMsg }) {
  if (!data.length) return <Empty message={emptyMsg} />
  const formatted = data.slice(0, 10).map(d => ({
    name:  String(d[keyField] ?? '').slice(0, 22) || '(empty)',
    value: d[valueField],
  }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} layout="vertical" margin={{ top: 0, right: 10, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1d2d55" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 10 }} tickLine={false} />
        <YAxis
          type="category" dataKey="name"
          tick={{ fill: '#c9d1d9', fontSize: 10, fontFamily: 'monospace' }}
          tickLine={false} width={110}
        />
        <Tooltip {...TooltipStyle} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {formatted.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={0.6 + (0.3 * (1 - i / formatted.length))} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Chart card wrapper ────────────────────────────────────── */
function ChartCard({ icon: Icon, title, children }) {
  return (
    <div className="card">
      <p className="section-title">
        <Icon size={14} /> {title}
      </p>
      {children}
    </div>
  )
}

/* ── Main export ───────────────────────────────────────────── */
export default function Charts({ timeline, countries, usernames, passwords, commands }) {
  return (
    <div className="space-y-4">
      {/* Row 1: Timeline + Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard icon={TrendingUp} title="Attack Timeline (24h)">
          <TimelineChart data={timeline} />
        </ChartCard>

        <ChartCard icon={Flag} title="Top Attack Countries">
          <HBarChart
            data={countries}
            color="#ffd32a"
            emptyMsg="No country data yet"
          />
        </ChartCard>
      </div>

      {/* Row 2: Usernames / Passwords / Commands */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartCard icon={User} title="Top Usernames Tried">
          <HBarChart
            data={usernames}
            color="#00d4ff"
            emptyMsg="No credential data yet"
          />
        </ChartCard>

        <ChartCard icon={Key} title="Top Passwords Tried">
          <HBarChart
            data={passwords}
            color="#ff4757"
            emptyMsg="No credential data yet"
          />
        </ChartCard>

        <ChartCard icon={Terminal} title="Top Shell Commands">
          <HBarChart
            data={commands}
            color="#a55eea"
            emptyMsg="No command data yet"
          />
        </ChartCard>
      </div>
    </div>
  )
}
