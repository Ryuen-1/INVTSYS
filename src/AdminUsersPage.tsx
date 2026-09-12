import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AdminUser, Branch, UserRole } from './types'
import { supabase } from './utils/supabase'

type UserForm = {
  email: string
  password: string
  full_name: string
  role: UserRole
  branch_id: string
}

const emptyUserForm: UserForm = {
  email: '',
  password: '',
  full_name: '',
  role: 'staff',
  branch_id: '',
}

export function AdminUsersPage({ branches }: { branches: Branch[] }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [form, setForm] = useState<UserForm>(emptyUserForm)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const branchById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  )

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'list' },
    })

    if (error) {
      setErrorMessage(error.message)
      setUsers([])
    } else if (data?.error) {
      setErrorMessage(data.error)
      setUsers([])
    } else {
      setUsers((data?.users ?? []) as AdminUser[])
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setErrorMessage(null)

    const action = editingUserId ? 'update' : 'create'
    const body = {
      action,
      user: {
        id: editingUserId,
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim() || null,
        role: form.role,
        branch_id: form.branch_id || null,
      },
    }

    const { data, error } = await supabase.functions.invoke('admin-users', { body })

    if (error || data?.error) {
      setErrorMessage(data?.error ?? error?.message ?? 'Unable to save user.')
      return
    }

    setNotice(editingUserId ? 'User updated.' : 'User created.')
    setEditingUserId(null)
    setForm(emptyUserForm)
    await loadUsers()
  }

  async function deleteUser(userId: string) {
    setNotice(null)
    setErrorMessage(null)

    if (!window.confirm('Delete this user account?')) {
      return
    }

    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'delete', user: { id: userId } },
    })

    if (error || data?.error) {
      setErrorMessage(data?.error ?? error?.message ?? 'Unable to delete user.')
      return
    }

    setNotice('User deleted.')
    await loadUsers()
  }

  function startEdit(user: AdminUser) {
    setEditingUserId(user.id)
    setForm({
      email: user.email,
      password: '',
      full_name: user.full_name ?? '',
      role: user.role,
      branch_id: user.branch_id ?? '',
    })
  }

  return (
    <section className="stack">
      {notice && <p className="notice">{notice}</p>}
      {errorMessage && (
        <section className="empty-state setup-warning">
          <h2>Admin Users message</h2>
          <p>{errorMessage}</p>
        </section>
      )}

      <section className="panel">
        <div className="panel-header">
          <h2>{editingUserId ? 'Edit User' : 'Create User'}</h2>
        </div>
        <form className="form-grid admin-user-form" onSubmit={saveUser}>
          <label>
            Email
            <input
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            Password
            <input
              minLength={editingUserId ? 0 : 6}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editingUserId ? 'Leave blank to keep' : ''}
              required={!editingUserId}
              type="password"
              value={form.password}
            />
          </label>
          <label>
            Full name
            <input
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              type="text"
              value={form.full_name}
            />
          </label>
          <label>
            Role
            <select
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as UserRole })
              }
              value={form.role}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Branch
            <select
              onChange={(event) => setForm({ ...form, branch_id: event.target.value })}
              value={form.branch_id}
            >
              <option value="">No branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit">{editingUserId ? 'Save user' : 'Create user'}</button>
            {editingUserId && (
              <button
                className="secondary-button"
                onClick={() => {
                  setEditingUserId(null)
                  setForm(emptyUserForm)
                }}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Users</h2>
          <span>{isLoading ? '...' : users.length}</span>
        </div>
        {users.length === 0 ? (
          <p className="muted-text">{isLoading ? 'Loading users...' : 'No users found.'}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Confirmed</th>
                  <th>Last sign in</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.email}</td>
                    <td>{user.full_name ?? '-'}</td>
                    <td>{user.role}</td>
                    <td>{user.branch_id ? branchById.get(user.branch_id) ?? '-' : '-'}</td>
                    <td>{user.email_confirmed_at ? 'Yes' : 'No'}</td>
                    <td>
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString()
                        : '-'}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="secondary-button"
                          onClick={() => startEdit(user)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="danger-button"
                          onClick={() => deleteUser(user.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
