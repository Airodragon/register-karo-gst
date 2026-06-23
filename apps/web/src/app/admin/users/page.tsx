'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string; role: string }>>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('operator');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch(() => router.push('/dashboard'));
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.createUser({ email, name, password, role });
      setUsers(await api.listUsers());
      setEmail('');
      setName('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-xs text-neutral-500 hover:text-neutral-800">
              ← Dashboard
            </Link>
            <h1 className="text-lg font-semibold mt-1">Team management</h1>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <form onSubmit={handleCreate} className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
          <h2 className="font-medium">Invite operator</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="operator">Operator</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            className="bg-teal-700 text-white text-sm px-4 py-2 rounded-lg font-medium"
          >
            Create user
          </button>
        </form>
        <ul className="bg-white border border-neutral-200 rounded-xl divide-y">
          {users.map((u) => (
            <li key={u.id} className="px-5 py-3 flex justify-between text-sm">
              <div>
                <p className="font-medium">{u.name}</p>
                <p className="text-neutral-500">{u.email}</p>
              </div>
              <span className="text-xs uppercase text-neutral-400">{u.role}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
