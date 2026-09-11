'use client';

import { useState } from 'react';

export default function BillingActions({ hasSubscription, role }: { hasSubscription: boolean; role: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function open(endpoint: 'checkout' | 'portal') {
    setLoading(true);
    setError('');
    const response = await fetch(`/api/billing/${endpoint}`, { method: 'POST' });
    const result = await response.json();
    if (!response.ok || !result.url) {
      setError(result.error || 'No se pudo abrir Stripe');
      setLoading(false);
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className="space-y-3">
      {role === 'USER' && <button disabled={loading} onClick={() => open('checkout')} className="w-full rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Iniciar prueba PRO de 7 días</button>}
      {hasSubscription && <button disabled={loading} onClick={() => open('portal')} className="w-full rounded-lg border border-gray-600 px-5 py-3 font-semibold text-white hover:bg-gray-700 disabled:opacity-50">Administrar suscripción</button>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
