/** Centralised API layer — all fetch calls in one place */

const BASE = ''   // same-origin when served by Flask

async function send(path, method = 'GET', body = null) {
  const options = {
    method,
    credentials: 'same-origin',  // Include session cookies
    headers: {
      'Content-Type': 'application/json',
    },
  }
  if (body) {
    options.body = JSON.stringify(body)
  }
  
  const r = await fetch(BASE + path, options)
  const json = await r.json().catch(() => ({}))
  
  if (!r.ok) {
    throw new Error(json.error || r.statusText)
  }
  return json
}

async function get(path) {
  return send(path, 'GET')
}

async function post(path, body = null) {
  return send(path, 'POST', body)
}

async function put(path, body = null) {
  return send(path, 'PUT', body)
}

async function del(path) {
  return send(path, 'DELETE')
}

// ─────────────────────────────────────────
// Auth Endpoints
// ─────────────────────────────────────────

export const register = async (username, email, password) => {
  return post('/api/auth/register', { username, email, password })
}

export const login = async (username, password) => {
  return post('/api/auth/login', { username, password })
}

export const logout = async () => {
  return post('/api/auth/logout')
}

export const getMe = async () => {
  return get('/api/auth/me')
}

// ─────────────────────────────────────────
// Admin User Management Endpoints
// ─────────────────────────────────────────

export const listUsers = async () => {
  return get('/api/admin/users')
}

export const createUser = async (username, email, password, role = 'user') => {
  return post('/api/admin/users', { username, email, password, role })
}

export const updateUser = async (userId, updates) => {
  return put(`/api/admin/users/${userId}`, updates)
}

export const deleteUser = async (userId) => {
  return del(`/api/admin/users/${userId}`)
}

// ─────────────────────────────────────────
// Analytics & Deployment Endpoints
// ─────────────────────────────────────────

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
