'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error || 'No se pudo crear la cuenta');
      return;
    }
    setRegistered(true);
  }

  if (registered) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-gray-700 bg-[#1a1d2e] p-8 text-center">
        <h1 className="mb-4 text-2xl font-bold text-white">Cuenta creada</h1>
        <p className="text-sm text-gray-300">Te enviamos un correo de verificación. Confirma tu email antes de iniciar sesión.</p>
        <p className="mt-4 text-sm"><Link href="/resend-verification" className="text-indigo-400 hover:text-indigo-300">¿No recibiste el correo?</Link></p>
        <p className="mt-2 text-sm text-gray-400"><Link href="/login" className="text-indigo-400">Ir al inicio de sesión</Link></p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-700 bg-[#1a1d2e] p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Crear cuenta</h1>
      <form onSubmit={submit} className="space-y-4">
        <input required value={name} onChange={e => setName(e.target.value)} placeholder="Nombre" className="w-full rounded-lg border border-gray-600 bg-[#0f1117] px-4 py-3 text-white" />
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-gray-600 bg-[#0f1117] px-4 py-3 text-white" />
        <input type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña (mínimo 8 caracteres)" className="w-full rounded-lg border border-gray-600 bg-[#0f1117] px-4 py-3 text-white" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Creando...' : 'Registrarme'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-400">¿Ya tienes cuenta? <Link href="/login" className="text-indigo-400">Inicia sesión</Link></p>
    </div>
  );
}
