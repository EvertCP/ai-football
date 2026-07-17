'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PlayerPick, PickItem } from '@/types/sportmonks';

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
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Player Picks
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Top 20 apuestas de jugador con mayor probabilidad
            </p>
          </div>
          <Link href="/" className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            ← Volver
          </Link>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-4">
          {/* Date navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              disabled={isLoading}
            >
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-200 min-w-[220px] text-center capitalize">
              {formatDateLabel(selectedDate)}
            </span>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              disabled={isLoading}
            >
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Match window selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1">Últimos:</span>
            {([5, 10, 20] as const).map(n => (
              <button
                key={n}
                onClick={() => setMatchWindow(n)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  matchWindow === n
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-gray-600/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gray-700 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-700 rounded w-36 mb-2" />
                    <div className="h-3 bg-gray-700/60 rounded w-48" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-6 bg-gray-700/40 rounded w-full" />
                  <div className="h-6 bg-gray-700/40 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-6 text-center">
            <svg className="w-10 h-10 mx-auto text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-300 font-medium">{error}</p>
          </div>
        )}

        {/* No picks */}
        {!isLoading && !error && picks.length === 0 && (
          <div className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm text-gray-400">No hay picks disponibles para esta fecha.</p>
            <p className="text-xs text-gray-500 mt-1">Usa las flechas para navegar a un día con partidos.</p>
          </div>
        )}

        {/* Picks List */}
        {!isLoading && picks.length > 0 && (
          <div className="space-y-3">
            {/* Meta info */}
            {meta && (
              <p className="text-xs text-gray-500">
                {meta.totalFixtures as number} partidos • {meta.teamsAnalyzed as number} equipos • {meta.totalPicks as number} picks
              </p>
            )}

            {picks.map((playerPick, index) => (
              <PlayerPickCard
                key={`${playerPick.playerId}-${playerPick.upcomingFixtureId}`}
                pick={playerPick}
                rank={index + 1}
                isExpanded={expandedPlayer === `${playerPick.playerId}-${playerPick.upcomingFixtureId}`}
                onToggle={() => setExpandedPlayer(
                  expandedPlayer === `${playerPick.playerId}-${playerPick.upcomingFixtureId}`
                    ? null
                    : `${playerPick.playerId}-${playerPick.upcomingFixtureId}`
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayerPickCard({ pick, rank, isExpanded, onToggle }: {
  pick: PlayerPick;
  rank: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 hover:border-gray-600/60 transition-all overflow-hidden">
      {/* Main Row - Clickable */}
      <button onClick={onToggle} className="w-full p-4 sm:p-5 text-left">
        <div className="flex items-center gap-3">
          {/* Rank */}
          <div className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-amber-400 to-orange-500 text-black text-xs font-bold rounded-lg flex items-center justify-center">
            {rank}
          </div>

          {/* Player Image */}
          {pick.playerImage ? (
            <img src={pick.playerImage} alt={pick.playerName} className="w-10 h-10 rounded-full object-cover border border-gray-600/50 flex-shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}

          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-sm truncate">{pick.playerName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {pick.teamImage && (
                <img src={pick.teamImage} alt={pick.teamName} className="w-3.5 h-3.5 object-contain" />
              )}
              <span className="text-xs text-gray-400">{pick.teamName}</span>
              <span className="text-gray-600 text-xs">•</span>
              <span className="text-xs text-gray-500">{pick.upcomingFixtureName}</span>
            </div>
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {pick.picks.filter(p => p.confidence === 'high').length > 0 && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {pick.picks.filter(p => p.confidence === 'high').length} HIGH
              </span>
            )}
            {pick.picks.filter(p => p.confidence === 'medium').length > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                {pick.picks.filter(p => p.confidence === 'medium').length} MED
              </span>
            )}
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {/* Expanded: Bar Charts */}
      {isExpanded && (
        <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-gray-700/30 space-y-3">
          {pick.picks.map((p, i) => (
            <StatBarRow key={`${p.stat}-${p.threshold}-${i}`} pickItem={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatBarRow({ pickItem }: { pickItem: PickItem }) {
  const values = pickItem.matchValues || [];
  const maxVal = Math.max(...values, pickItem.threshold);
  const isHigh = pickItem.confidence === 'high';

  return (
    <div className="space-y-1.5">
      {/* Label + Percentage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isHigh ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-xs font-medium text-gray-200">{pickItem.label}</span>
        </div>
        <span className={`text-xs font-bold ${isHigh ? 'text-emerald-400' : 'text-amber-400'}`}>
          {pickItem.hitCount}/{pickItem.totalMatches} ({pickItem.percentage}%)
        </span>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end gap-0.5 h-8">
        {values.map((val, i) => {
          const height = maxVal > 0 ? Math.max((val / maxVal) * 100, 4) : 4;
          const hitsThreshold = val >= pickItem.threshold;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all relative group"
              style={{ height: `${height}%` }}
            >
              <div
                className={`w-full h-full rounded-sm ${
                  hitsThreshold
                    ? isHigh ? 'bg-emerald-500' : 'bg-amber-500'
                    : 'bg-gray-600/60'
                }`}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-gray-900 border border-gray-600 rounded px-1.5 py-0.5 text-[9px] text-gray-200 whitespace-nowrap">
                  {val}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Threshold line label */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-gray-500">
          {values.length > 0 && `M${1}`}
        </span>
        <span className="text-[9px] text-gray-500">
          Umbral: {pickItem.threshold}+
        </span>
        <span className="text-[9px] text-gray-500">
          {values.length > 0 && `M${values.length}`}
        </span>
      </div>
    </div>
  );
}
