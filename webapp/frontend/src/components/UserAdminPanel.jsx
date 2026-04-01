import React, { useState, useEffect } from 'react';
import * as api from '../api';

function UserAdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserData, setNewUserData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.email || !newUserData.password) {
      setError('All fields are required');
      return;
    }

    setCreatingUser(true);
    setError('');
    try {
      await api.createUser(
        newUserData.username,
        newUserData.email,
        newUserData.password,
        newUserData.role
      );
      setNewUserData({ username: '', email: '', password: '', role: 'user' });
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleUpdateUser = async (userId, updatedData) => {
    try {
      await api.updateUser(userId, updatedData);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.deleteUser(userId);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    }
  };

  if (loading) {
    return <div className="text-center text-gray-300 py-8">Loading users...</div>;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">User Management</h2>

      {error && (
        <div className="bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Create User Form */}
      <div className="bg-gray-700 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Create New User</h3>
        <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Username"
            value={newUserData.username}
            onChange={(e) =>
              setNewUserData((prev) => ({ ...prev, username: e.target.value }))
            }
            className="px-3 py-2 bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creatingUser}
          />
          <input
            type="email"
            placeholder="Email"
            value={newUserData.email}
            onChange={(e) => setNewUserData((prev) => ({ ...prev, email: e.target.value }))}
            className="px-3 py-2 bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creatingUser}
          />
          <input
            type="password"
            placeholder="Password"
            value={newUserData.password}
            onChange={(e) =>
              setNewUserData((prev) => ({ ...prev, password: e.target.value }))
            }
            className="px-3 py-2 bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creatingUser}
          />
          <select
            value={newUserData.role}
            onChange={(e) => setNewUserData((prev) => ({ ...prev, role: e.target.value }))}
            className="px-3 py-2 bg-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creatingUser}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={creatingUser}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-semibold transition"
          >
            {creatingUser ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-gray-300">
          <thead className="border-b border-gray-600">
            <tr>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                onUpdate={handleUpdateUser}
                onDelete={handleDeleteUser}
                allUsers={users}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserRow({ user, onUpdate, onDelete, allUsers }) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    username: user.username,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  });

  const activeAdmins = allUsers.filter((u) => u.role === 'admin' && u.is_active).length;
  const isSoleActiveAdmin =
    user.role === 'admin' && user.is_active && activeAdmins === 1;

  const handleSave = async () => {
    if (editData.role !== 'admin' && isSoleActiveAdmin) {
      alert('Cannot demote the sole active admin');
      return;
    }
    await onUpdate(user.id, editData);
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="border-b border-gray-700 bg-gray-700">
        <td className="px-4 py-3">
          <input
            type="text"
            value={editData.username}
            onChange={(e) => setEditData((prev) => ({ ...prev, username: e.target.value }))}
            className="w-full px-2 py-1 bg-gray-600 text-white rounded"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="email"
            value={editData.email}
            onChange={(e) => setEditData((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full px-2 py-1 bg-gray-600 text-white rounded"
          />
        </td>
        <td className="px-4 py-3">
          <select
            value={editData.role}
            onChange={(e) => setEditData((prev) => ({ ...prev, role: e.target.value }))}
            className="w-full px-2 py-1 bg-gray-600 text-white rounded"
            disabled={isSoleActiveAdmin}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </td>
        <td className="px-4 py-3">
          <select
            value={editData.is_active ? '1' : '0'}
            onChange={(e) =>
              setEditData((prev) => ({ ...prev, is_active: e.target.value === '1' }))
            }
            className="w-full px-2 py-1 bg-gray-600 text-white rounded"
          >
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </td>
        <td className="px-4 py-3 flex space-x-2">
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
          >
            Cancel
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-700 hover:bg-gray-700">
      <td className="px-4 py-3">{user.username}</td>
      <td className="px-4 py-3">{user.email}</td>
      <td className="px-4 py-3">
        <span
          className={`px-3 py-1 rounded text-sm font-semibold ${
            user.role === 'admin'
              ? 'bg-red-900 text-red-200'
              : 'bg-blue-900 text-blue-200'
          }`}
        >
          {user.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`px-3 py-1 rounded text-sm font-semibold ${
            user.is_active
              ? 'bg-green-900 text-green-200'
              : 'bg-yellow-900 text-yellow-200'
          }`}
        >
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3 flex space-x-2">
        <button
          onClick={() => setEditing(true)}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(user.id)}
          disabled={isSoleActiveAdmin}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded text-sm"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

export default UserAdminPanel;
