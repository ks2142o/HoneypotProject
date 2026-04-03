import React, { useEffect, useMemo, useState } from 'react'
import * as api from '../api'
import {
  Activity,
  Filter,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

const ROLE_CLASS = {
  admin: 'bg-cyber-red/10 text-cyber-red border-cyber-red/30',
  user: 'bg-cyber-accent/10 text-cyber-accent border-cyber-accent/30',
}

const STATUS_CLASS = {
  active: 'bg-cyber-green/10 text-cyber-green border-cyber-green/30',
  inactive: 'bg-cyber-yellow/10 text-cyber-yellow border-cyber-yellow/30',
}

function UserAdminPanel() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [creatingUser, setCreatingUser] = useState(false)
  const [newUserData, setNewUserData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
  })

  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({
    username: '',
    email: '',
    role: 'user',
    is_active: true,
    password: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.listUsers()
      setUsers(Array.isArray(data?.users) ? data.users : [])
    } catch (err) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const activeAdmins = users.filter((u) => u.role === 'admin' && u.is_active).length

  const filteredUsers = useMemo(() => {
    let list = [...users]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((u) =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      )
    }

    if (roleFilter) {
      list = list.filter((u) => u.role === roleFilter)
    }

    if (statusFilter) {
      const target = statusFilter === 'active'
      list = list.filter((u) => Boolean(u.is_active) === target)
    }

    return list
  }, [users, search, roleFilter, statusFilter])

  const stats = useMemo(() => {
    const total = users.length
    const admins = users.filter((u) => u.role === 'admin').length
    const active = users.filter((u) => u.is_active).length
    const inactive = total - active
    return { total, admins, active, inactive }
  }, [users])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setError('')

    if (!newUserData.username || !newUserData.email || !newUserData.password) {
      setError('Username, email, and password are required')
      return
    }

    setCreatingUser(true)
    try {
      await api.createUser(
        newUserData.username.trim(),
        newUserData.email.trim(),
        newUserData.password,
        newUserData.role
      )
      setNewUserData({ username: '', email: '', password: '', role: 'user' })
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to create user')
    } finally {
      setCreatingUser(false)
    }
  }

  const startEdit = (user) => {
    setEditingId(user.id)
    setEditData({
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'user',
      is_active: Boolean(user.is_active),
      password: '',
    })
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({ username: '', email: '', role: 'user', is_active: true, password: '' })
  }

  const handleSaveEdit = async (user) => {
    setError('')

    const isSoleActiveAdmin = user.role === 'admin' && user.is_active && activeAdmins === 1
    if (isSoleActiveAdmin && (editData.role !== 'admin' || !editData.is_active)) {
      setError('Cannot demote or deactivate the sole active admin')
      return
    }

    setSavingEdit(true)
    try {
      const payload = {
        username: editData.username.trim(),
        email: editData.email.trim(),
        role: editData.role,
        is_active: editData.is_active,
      }
      if (editData.password.trim()) {
        payload.password = editData.password
      }

      await api.updateUser(user.id, payload)
      cancelEdit()
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to update user')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteUser = async (user) => {
    const isSoleActiveAdmin = user.role === 'admin' && user.is_active && activeAdmins === 1
    if (isSoleActiveAdmin) {
      setError('Cannot delete the sole active admin')
      return
    }

    if (!window.confirm(`Delete user ${user.username}?`)) return

    setError('')
    try {
      await api.deleteUser(user.id)
      await loadUsers()
    } catch (err) {
      setError(err.message || 'Failed to delete user')
    }
  }

  if (loading) {
    return (
      <div className="card max-w-7xl mx-auto mt-6">
        <div className="text-center py-10 text-cyber-muted">Loading user directory...</div>
      </div>
    )
  }

  return (
    <div className="card max-w-7xl mx-auto mt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-cyber-bright">
            <Users className="text-cyber-accent" size={22} />
            User Management
          </h2>
          <p className="text-xs text-cyber-muted mt-1 font-mono">
            Manage dashboard access, roles, and account status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyber-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search username/email"
              className="cyber-input pl-8 w-48 text-xs"
            />
          </div>

          <div className="relative hidden sm:block">
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyber-muted" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="cyber-input pl-8 w-32 text-xs cursor-pointer appearance-none"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>

          <div className="relative hidden sm:block">
            <Activity size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyber-muted" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="cyber-input pl-8 w-32 text-xs cursor-pointer appearance-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <button onClick={loadUsers} className="btn btn-primary py-1.5 px-3 text-xs">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-cyber-red/30 bg-cyber-red/10 text-cyber-red text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border border-cyber-border/50 bg-cyber-card2 p-3">
          <p className="text-cyber-muted text-[11px] uppercase tracking-wide">Total Users</p>
          <p className="text-cyber-bright text-lg font-bold mt-1">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-cyber-border/50 bg-cyber-card2 p-3">
          <p className="text-cyber-muted text-[11px] uppercase tracking-wide">Admins</p>
          <p className="text-cyber-red text-lg font-bold mt-1">{stats.admins}</p>
        </div>
        <div className="rounded-lg border border-cyber-border/50 bg-cyber-card2 p-3">
          <p className="text-cyber-muted text-[11px] uppercase tracking-wide">Active</p>
          <p className="text-cyber-green text-lg font-bold mt-1">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-cyber-border/50 bg-cyber-card2 p-3">
          <p className="text-cyber-muted text-[11px] uppercase tracking-wide">Inactive</p>
          <p className="text-cyber-yellow text-lg font-bold mt-1">{stats.inactive}</p>
        </div>
      </div>

      <div className="rounded-xl border border-cyber-border/50 bg-cyber-card2/40 p-4 mb-6">
        <h3 className="text-sm font-semibold text-cyber-bright mb-3 flex items-center gap-2">
          <UserPlus size={16} className="text-cyber-accent" />
          Create New User
        </h3>

        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Username"
            value={newUserData.username}
            onChange={(e) => setNewUserData((prev) => ({ ...prev, username: e.target.value }))}
            className="cyber-input text-sm"
            disabled={creatingUser}
          />
          <input
            type="email"
            placeholder="Email"
            value={newUserData.email}
            onChange={(e) => setNewUserData((prev) => ({ ...prev, email: e.target.value }))}
            className="cyber-input text-sm"
            disabled={creatingUser}
          />
          <input
            type="password"
            placeholder="Password"
            value={newUserData.password}
            onChange={(e) => setNewUserData((prev) => ({ ...prev, password: e.target.value }))}
            className="cyber-input text-sm"
            disabled={creatingUser}
          />
          <select
            value={newUserData.role}
            onChange={(e) => setNewUserData((prev) => ({ ...prev, role: e.target.value }))}
            className="cyber-input text-sm cursor-pointer"
            disabled={creatingUser}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={creatingUser} className="btn btn-success justify-center">
            <UserPlus size={14} />
            {creatingUser ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-xl border border-cyber-border/50">
        <table className="data-table w-full text-left">
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-cyber-muted">
                  No users match the current filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isEditing = editingId === user.id
                const isSoleActiveAdmin = user.role === 'admin' && user.is_active && activeAdmins === 1

                if (isEditing) {
                  return (
                    <tr key={user.id} className="bg-cyber-card2/70">
                      <td>
                        <input
                          type="text"
                          value={editData.username}
                          onChange={(e) => setEditData((prev) => ({ ...prev, username: e.target.value }))}
                          className="cyber-input text-xs w-full"
                        />
                      </td>
                      <td>
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) => setEditData((prev) => ({ ...prev, email: e.target.value }))}
                          className="cyber-input text-xs w-full"
                        />
                      </td>
                      <td>
                        <select
                          value={editData.role}
                          onChange={(e) => setEditData((prev) => ({ ...prev, role: e.target.value }))}
                          className="cyber-input text-xs w-full"
                          disabled={isSoleActiveAdmin}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={editData.is_active ? '1' : '0'}
                          onChange={(e) => setEditData((prev) => ({ ...prev, is_active: e.target.value === '1' }))}
                          className="cyber-input text-xs w-full"
                          disabled={isSoleActiveAdmin && editData.role === 'admin'}
                        >
                          <option value="1">Active</option>
                          <option value="0">Inactive</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="password"
                          value={editData.password}
                          onChange={(e) => setEditData((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="Set new password"
                          className="cyber-input text-xs w-full"
                        />
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(user)}
                            disabled={savingEdit}
                            className="text-cyber-green hover:text-cyber-bright transition-colors"
                            title="Save"
                          >
                            <Save size={15} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-cyber-muted hover:text-cyber-bright transition-colors"
                            title="Cancel"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="text-cyber-bright font-medium">{user.username}</td>
                    <td className="text-cyber-muted">{user.email}</td>
                    <td>
                      <span className={`inline-flex px-2.5 py-1 rounded border text-xs font-semibold ${ROLE_CLASS[user.role] || ROLE_CLASS.user}`}>
                        {user.role === 'admin' ? <Shield size={11} className="mr-1" /> : null}
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`inline-flex px-2.5 py-1 rounded border text-xs font-semibold ${user.is_active ? STATUS_CLASS.active : STATUS_CLASS.inactive}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="text-cyber-muted text-xs font-mono">
                      {user.created_at ? new Date(user.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => startEdit(user)}
                          className="text-cyber-accent hover:text-cyber-bright transition-colors"
                          title="Edit user"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          disabled={isSoleActiveAdmin}
                          className="text-cyber-red hover:text-cyber-bright transition-colors disabled:opacity-30"
                          title={isSoleActiveAdmin ? 'Cannot delete sole active admin' : 'Delete user'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default UserAdminPanel
