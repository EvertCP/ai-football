'use client';

import { FormEvent, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getProviders, signIn } from 'next-auth/react';

function ErrorMessage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  if (!error) return null;
  if (error === 'EmailNoVerificado') return <p className="text-sm text-amber-400">Debes verificar tu correo antes de iniciar sesión. <Link href="/resend-verification" className="underline">Reenviar enlace</Link></p>;
  return <p className="text-sm text-red-400">Email o contraseña incorrectos</p>;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hasGoogle, setHasGoogle] = useState(false);

  useEffect(() => { getProviders().then(providers => setHasGoogle(Boolean(providers?.google))); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const result = await signIn('credentials', { email, password, redirect: false });
    if (result?.error) {
      if (result.error === 'EmailNoVerificado') setError('verify');
      else setError('credentials');
    } else window.location.href = '/';
  }

  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-700 bg-[#1a1d2e] p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Iniciar sesión</h1>
      <Suspense fallback={null}><ErrorMessage /></Suspense>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-gray-600 bg-[#0f1117] px-4 py-3 text-white" />
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" className="w-full rounded-lg border border-gray-600 bg-[#0f1117] px-4 py-3 text-white" />
        {error === 'verify' && <p className="text-sm text-amber-400">Debes verificar tu correo. <Link href="/resend-verification" className="underline">Reenviar enlace</Link></p>}
        {error === 'credentials' && <p className="text-sm text-red-400">Email o contraseña incorrectos</p>}
        <button className="w-full rounded-lg bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500">Entrar</button>
      </form>
      {hasGoogle && <button onClick={() => signIn('google', { callbackUrl: '/' })} className="mt-3 w-full rounded-lg border border-gray-600 py-3 font-semibold text-white hover:bg-gray-700">Continuar con Google</button>}
      <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="text-indigo-400 hover:text-indigo-300">¿Olvidaste tu contraseña?</Link></p>
      <p className="mt-2 text-center text-sm text-gray-400">¿No tienes cuenta? <Link href="/register" className="text-indigo-400">Regístrate</Link></p>
    </div>
  );
}
