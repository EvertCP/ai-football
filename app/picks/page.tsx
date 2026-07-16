'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PlayerPick } from '@/types/sportmonks';

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function PlayerPicksPage() {
  const [picks, setPicks] = useState<PlayerPick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [matchWindow, setMatchWindow] = useState<10 | 5 | 20>(10);

  const fetchPicks = useCallback(async (date: string, matches: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/player-picks?date=${date}&limit=20&matches=${matches}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener picks');
      }
      setPicks(data.data || []);
      setMeta(data.meta || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPicks(selectedDate, matchWindow);
  }, [selectedDate, matchWindow, fetchPicks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Player Picks
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Top 20 apuestas de jugador con mayor probabilidad para los próximos partidos
          </p>
        </div>
        <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          ← Volver
        </Link>
      </div>

      {/* Controls: Date navigation + Match window filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-4">
        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isLoading}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-800 min-w-[200px] text-center capitalize">
            {formatDateLabel(selectedDate)}
          </span>
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={isLoading}
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Match window selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 mr-1">Últimos:</span>
          {([5, 10, 20] as const).map(n => (
            <button
              key={n}
              onClick={() => setMatchWindow(n)}
              disabled={isLoading}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                matchWindow === n
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n} partidos
            </button>
          ))}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800">¿Cómo funciona?</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Analizamos los últimos {matchWindow} partidos de cada jugador y calculamos el porcentaje de veces que cumplió cada estadística.
              Solo mostramos picks con ≥60% de cumplimiento. 🟢 Alta = ≥80% | 🟡 Media = 60-79%
            </p>
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-56" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <div className="h-7 bg-gray-200 rounded-full w-32" />
                <div className="h-7 bg-gray-200 rounded-full w-28" />
                <div className="h-7 bg-gray-200 rounded-full w-36" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 mx-auto text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* No picks */}
      {!isLoading && !error && picks.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-sm text-gray-500">No hay picks disponibles para hoy.</p>
          <p className="text-xs text-gray-400 mt-1">Puede que no haya partidos programados o falten datos históricos.</p>
        </div>
      )}

      {/* Picks List */}
      {!isLoading && picks.length > 0 && (
        <div className="space-y-4">
          {/* Meta info */}
          {meta && (
            <p className="text-xs text-gray-400">
              {meta.totalFixtures as number} partidos analizados • {meta.teamsAnalyzed as number} equipos • {meta.totalPicks as number} picks generados
            </p>
          )}

          {picks.map((playerPick, index) => (
            <PlayerPickCard key={`${playerPick.playerId}-${playerPick.upcomingFixtureId}`} pick={playerPick} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayerPickCard({ pick, rank }: { pick: PlayerPick; rank: number }) {
  const highConfidencePicks = pick.picks.filter(p => p.confidence === 'high');
  const mediumConfidencePicks = pick.picks.filter(p => p.confidence === 'medium');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
      {/* Player Info */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
            {rank}
          </span>
          {pick.playerImage ? (
            <img src={pick.playerImage} alt={pick.playerName} className="w-12 h-12 rounded-full object-cover border-2 border-gray-100" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{pick.playerName}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            {pick.teamImage && (
              <img src={pick.teamImage} alt={pick.teamName} className="w-4 h-4 object-contain" />
            )}
            <span className="text-xs text-gray-500">{pick.teamName}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Próximo</p>
          <p className="text-xs font-medium text-gray-700 mt-0.5">{pick.upcomingFixtureName}</p>
        </div>
      </div>

      {/* Picks */}
      <div className="mt-4 flex flex-wrap gap-2">
        {highConfidencePicks.map((p, i) => (
          <span
            key={`high-${i}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {p.label} — {p.hitCount}/{p.totalMatches} ({p.percentage}%)
          </span>
        ))}
        {mediumConfidencePicks.map((p, i) => (
          <span
            key={`med-${i}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-800 border border-yellow-200"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            {p.label} — {p.hitCount}/{p.totalMatches} ({p.percentage}%)
          </span>
        ))}
      </div>
    </div>
  );
}
