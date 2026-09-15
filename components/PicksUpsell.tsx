'use client';

import { useState } from 'react';

export default function PicksUpsell() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function subscribe() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || 'No se pudo iniciar el pago');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Error de conexión');
      setLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-br from-amber-600/20 to-orange-700/20 rounded-xl border border-amber-500/30 p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-100">Picks PRO</h3>
          <p className="text-xs text-amber-200/70 mt-1">
            Accede a picks de jugadores y equipos generados con estadísticas de API-Football: tiros a puerta, goles, tarjetas, over/under y más.
          </p>
          <button
            onClick={subscribe}
            disabled={loading}
            className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Cargando...' : 'Suscribirse por $199 MXN/mes'}
          </button>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>
      </div>
    </div>
  );
}
