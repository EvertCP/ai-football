'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function NavigationLinks() {
  const { data: session } = useSession();
  const role = session?.user.role;

  return (
    <>
      <Link href="/" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Dashboard</Link>
      <Link href="/competitions" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">Competencias</Link>
      {(role === 'PRO' || role === 'ADMIN') && <Link href="/picks" className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">Picks</Link>}
      {role === 'ADMIN' && (
        <>
          <Link href="/admin/model-performance" className="text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors">Admin</Link>
          <Link href="/admin/users" className="text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors">Usuarios</Link>
        </>
      )}
    </>
  );
}
