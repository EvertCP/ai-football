'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verificando tu correo...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Enlace de verificación inválido.');
      return;
    }
    fetch(`/api/auth/verify?token=${token}`)
      .then(async res => {
        if (res.ok) {
          setStatus('success');
          setMessage('Correo verificado correctamente. Ya puedes iniciar sesión.');
        } else {
          const data = await res.json().catch(() => ({}));
          setStatus('error');
          setMessage(data.error || 'El enlace es inválido o ha expirado.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Ocurrió un error al verificar tu correo.');
      });
  }, [token]);

  return (
    <>
      <p className={`mb-6 text-sm ${status === 'success' ? 'text-green-400' : status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>{message}</p>
      {status === 'success' && <Link href="/login" className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Iniciar sesión</Link>}
    </>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-gray-700 bg-[#1a1d2e] p-8 text-center">
      <h1 className="mb-4 text-2xl font-bold text-white">Verificación de correo</h1>
      <Suspense fallback={<p className="text-sm text-gray-300">Cargando...</p>}>
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}
