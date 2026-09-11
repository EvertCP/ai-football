'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

export default function AuthControls() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <span className="text-sm text-gray-500">Cargando...</span>;
  if (!session) {
    return <Link href="/login" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">Iniciar sesión</Link>;
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/account" className="text-sm text-gray-300 hover:text-white">{session.user.name || session.user.email}</Link>
      <span className="rounded bg-indigo-500/20 px-2 py-1 text-xs font-semibold text-indigo-300">{session.user.role}</span>
      <button onClick={() => signOut({ callbackUrl: '/' })} className="text-sm text-gray-400 hover:text-white">Salir</button>
    </div>
  );
}
