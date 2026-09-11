'use client';

import { FormEvent, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (response.ok) setDone(true);
    else setError(data.error || 'No se pudo restablecer la contraseña.');
  }

  if (done) return <p className="text-center text-sm text-green-400">Contraseña actualizada. <a href="/login" className="text-indigo-400">Iniciar sesión</a></p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Nueva contraseña (mínimo 8 caracteres)" className="w-full rounded-lg border border-gray-600 bg-[#0f1117] px-4 py-3 text-white" />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button disabled={loading} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-700 bg-[#1a1d2e] p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Restablecer contraseña</h1>
      <Suspense fallback={<p className="text-sm text-gray-400">Cargando...</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
