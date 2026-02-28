/** Centralised API layer — all fetch calls in one place */

const BASE = ''   // same-origin when served by Flask

async function get(path) {
  const r = await fetch(BASE + path)
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new Error(j.error || r.statusText)
  }
  return r.json()
}

async function post(path) {
  const r = await fetch(BASE + path, { method: 'POST' })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new Error(j.error || r.statusText)
  }
  return r.json()
}

export const api = {
  status:         () => get('/api/status'),
  stats:          () => get('/api/stats'),
  health:         () => get('/api/health'),
  recentAttacks:  () => get('/api/attacks/recent'),
  topCredentials: () => get('/api/attacks/top-credentials'),
  topCommands:    () => get('/api/attacks/top-commands'),
  byCountry:      () => get('/api/attacks/by-country'),
  timeline:       () => get('/api/attacks/timeline'),
  geoPoints:      () => get('/api/attacks/geo-points'),
  logs:         (svc) => get(`/api/logs/${svc}`),

  deployAll:      () => post('/api/deploy/all'),
  deployService: (s)  => post(`/api/deploy/${s}`),
  shutdown:       () => post('/api/shutdown'),
}
