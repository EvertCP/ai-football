'use client';

import { useState, useEffect } from 'react';
import MatchCard from '@/components/MatchCard';
import { Fixture } from '@/types/sportmonks';

/**
 * RecentMatches Component
 * Fetches and displays the most recent available matches.
 * Uses the general /fixtures endpoint (works with Free plan).
 */
export default function RecentMatches() {
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecent() {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/fixtures/latest?perPage=6');
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error al obtener partidos');

        setFixtures(data.data || []);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setError(msg);
      }

      setIsLoading(false);
    }

    fetchRecent();
  }, []);

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Últimos Partidos</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 bg-gray-200 rounded w-40 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex justify-between mb-4">
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-5 bg-gray-200 rounded w-16" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 text-center space-y-2">
                  <div className="w-10 h-10 bg-gray-200 rounded-full mx-auto" />
                  <div className="h-3 bg-gray-200 rounded w-16 mx-auto" />
                </div>
                <div className="h-6 bg-gray-200 rounded w-10 mx-4" />
                <div className="flex-1 text-center space-y-2">
                  <div className="w-10 h-10 bg-gray-200 rounded-full mx-auto" />
                  <div className="h-3 bg-gray-200 rounded w-16 mx-auto" />
                </div>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-200 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (fixtures.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Últimos Partidos</h2>
        <p className="text-sm text-gray-500">No se encontraron partidos recientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Últimos Partidos</h2>
        <span className="text-sm text-gray-500">Disponibles en tu plan</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fixtures.map((fixture) => (
          <MatchCard key={fixture.id} fixture={fixture} />
        ))}
      </div>
    </div>
  );
}
