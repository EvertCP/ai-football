'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface League {
  id: number;
  name: string;
  short_code: string;
  image_path: string;
  type: string;
  sub_type: string;
  country_id: number;
  currentSeason?: {
    id: number;
    name: string;
  };
}

export default function CompetitionsPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeagues() {
      try {
        const res = await fetch('/api/leagues');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        setLeagues(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setIsLoading(false);
      }
    }
    fetchLeagues();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Competencias</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Competencias</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  // Separate tournaments (World Cup) from domestic leagues
  const tournaments = leagues.filter(l => l.name.toLowerCase().includes('world cup') || l.name.toLowerCase().includes('qualification'));
  const domesticLeagues = leagues.filter(l => !l.name.toLowerCase().includes('world cup') && !l.name.toLowerCase().includes('qualification'));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Competencias</h1>
        <p className="text-sm text-gray-500 mt-1">Ligas y torneos disponibles en tu plan</p>
      </div>

      {/* Tournaments */}
      {tournaments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            Torneos Internacionales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </div>
        </div>
      )}

      {/* Domestic Leagues */}
      {domesticLeagues.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            Ligas Domésticas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {domesticLeagues.map((league) => (
              <LeagueCard key={league.id} league={league} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LeagueCard({ league }: { league: League }) {
  return (
    <Link
      href={`/competition/${league.id}`}
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-gray-300 transition-all group"
    >
      <div className="flex items-center gap-4">
        {league.image_path ? (
          <img src={league.image_path} alt={league.name} className="w-12 h-12 object-contain" />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
            {league.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">{league.type}</p>
        </div>
        <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
