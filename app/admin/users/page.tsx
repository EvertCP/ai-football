'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  emailVerified: string | null;
  subscriptionStatus: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setUsers(data.data || []);
        setLoading(false);
      })
      .catch(() => { setError('Error al cargar usuarios'); setLoading(false); });
  }, []);

  async function updateRole(userId: string, role: string) {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.error || 'Error al actualizar rol'); return; }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  }

  if (status === 'loading' || loading) return <p className="text-sm text-gray-400">Cargando...</p>;
  if (session?.user.role !== 'ADMIN') return <p className="text-sm text-red-400">Acceso denegado</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Gestión de usuarios</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="rounded-xl border border-gray-700 bg-[#1a1d2e] overflow-hidden">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="bg-[#0f1117] text-gray-400">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Verificado</th>
              <th className="px-4 py-3">Suscripción</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-t border-gray-700">
                <td className="px-4 py-3">{user.name || '-'}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.role}</td>
                <td className="px-4 py-3">{user.emailVerified ? 'Sí' : 'No'}</td>
                <td className="px-4 py-3">{user.subscriptionStatus || '-'}</td>
                <td className="px-4 py-3 flex gap-2">
                  {user.role !== 'ADMIN' && <button onClick={() => updateRole(user.id, 'ADMIN')} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500">Admin</button>}
                  {user.role !== 'PRO' && <button onClick={() => updateRole(user.id, 'PRO')} className="rounded bg-amber-500 px-2 py-1 text-xs text-black hover:bg-amber-400">PRO</button>}
                  {user.role !== 'USER' && <button onClick={() => updateRole(user.id, 'USER')} className="rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-500">USER</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
