import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { MapPin, RefreshCw } from 'lucide-react'

const TYPE_COLORS = {
  'cowrie-ssh': '#00d4ff',
  'flask-http': '#00ff9d',
  'dionaea':    '#ff4757',
}

/** Zoom to fit all markers when points change */
function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 0) {
      const lats = points.map(p => p.lat)
      const lons = points.map(p => p.lon)
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]],
        { padding: [30, 30], maxZoom: 6 }
      )
    }
  }, [points, map])
  return null
}

export default function WorldMap({ points, onRefresh }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title" style={{ marginBottom: 0 }}>
          <MapPin size={14} /> Attack Origins — World Map
        </p>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4 text-[11px] text-cyber-muted">
            {Object.entries(TYPE_COLORS).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                {t}
              </span>
            ))}
          </div>
          <button className="btn btn-ghost py-1.5 px-3 text-xs" onClick={onRefresh}>
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ height: 380 }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%', background: '#060810' }}
          minZoom={1}
          maxZoom={8}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />

          {points.map((p, i) => {
            const color = TYPE_COLORS[p.type] ?? '#a55eea'
            return (
              <CircleMarker
                key={i}
                center={[p.lat, p.lon]}
                radius={5}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 1.5 }}
              >
                <Popup>
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-sm mb-1">{p.ip || 'Unknown IP'}</p>
                    <p>🌍 {p.country}</p>
                    <p>🎯 {p.type}</p>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}

          {points.length > 0 && <FitBounds points={points} />}
        </MapContainer>
      </div>

      <p className="text-[11px] text-cyber-muted text-right mt-2 font-mono">
        {points.length > 0
          ? `${points.length} attack origin${points.length !== 1 ? 's' : ''} plotted`
          : 'No geo data yet — deploy honeypots and wait for traffic'}
      </p>
    </div>
  )
}
