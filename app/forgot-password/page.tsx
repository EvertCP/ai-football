'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (response.ok) setSent(true);
    else setError('No se pudo procesar la solicitud. Intenta más tarde.');
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-700 bg-[#1a1d2e] p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Recuperar contraseña</h1>
      {sent ? (
        <p className="text-sm text-gray-300">Si el correo está registrado y verificado, recibirás un enlace para restablecer tu contraseña.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-gray-600 bg-[#0f1117] px-4 py-3 text-white" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Enviando...' : 'Enviar enlace'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-gray-400"><Link href="/login" className="text-indigo-400">Volver al inicio de sesión</Link></p>
    </div>
  );
}
