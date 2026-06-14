'use client';

import Link from 'next/link';
import { Fixture } from '@/types/sportmonks';

interface MatchCardProps {
  fixture: Fixture;
}

/**
 * MatchCard Component
 * Displays a single match in a card format with key information.
 * 
 * TODO: Future enhancements:
 * - Add team logos (image_path from participants)
 * - Add live score updates via WebSocket
 * - Add quick odds display
 * - Add favorite/bookmark functionality
 * - Add mini form indicator (W/D/L dots)
 */
export default function MatchCard({ fixture }: MatchCardProps) {
  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const league = fixture.league;
  const state = fixture.state;

  // Format date (API returns UTC, append 'Z' so JS converts to local timezone)
  const utcDate = fixture.starting_at?.replace(' ', 'T') + 'Z';
  const matchDate = new Date(utcDate);
  const formattedDate = matchDate.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = matchDate.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Get current score if available
  let homeGoals: number | null = null;
  let awayGoals: number | null = null;
  if (fixture.scores) {
    fixture.scores.forEach(score => {
      if (score.description === 'CURRENT') {
        if (score.participant_id === homeTeam?.id) {
          homeGoals = score.score.goals;
        } else {
          awayGoals = score.score.goals;
        }
      }
    });
  }

  // Determine status badge color and text
  const getStatusBadge = () => {
    const devName = state?.developer_name;
    if (!devName || devName === 'NS') {
      return { text: 'Por jugar', color: 'bg-blue-100 text-blue-800' };
    }
    if (devName === 'FT' || devName === 'AET' || devName === 'FT_PEN') {
      return { text: 'Finalizado', color: 'bg-gray-100 text-gray-800' };
    }
    if (['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_ET_2ND_HALF', 'INPLAY_PENALTIES', 'BREAK', 'EXTRA_TIME_BREAK', 'PEN_BREAK'].includes(devName)) {
      return { text: 'En vivo', color: 'bg-green-100 text-green-800' };
    }
    if (['CANCELLED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'INTERRUPTED', 'DELAYED'].includes(devName)) {
      return { text: 'Suspendido', color: 'bg-red-100 text-red-800' };
    }
    return { text: state?.name || 'Desconocido', color: 'bg-gray-100 text-gray-600' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-gray-300 transition-all duration-200 group">
      {/* Header: League and Status */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {league?.image_path && (
            <img
              src={league.image_path}
              alt={league.name}
              className="w-5 h-5 object-contain"
            />
          )}
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            {league?.name || 'Liga desconocida'}
          </span>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge.color}`}>
          {statusBadge.text}
        </span>
      </div>

      {/* Teams and Score */}
      <div className="flex items-center justify-between mb-4">
        {/* Home Team */}
        <Link href={`/team/${homeTeam?.id}`} className="flex-1 text-center hover:opacity-80 transition-opacity">
          {homeTeam?.image_path && (
            <img
              src={homeTeam.image_path}
              alt={homeTeam.name}
              className="w-10 h-10 mx-auto mb-2 object-contain"
            />
          )}
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {homeTeam?.name || 'Local'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Local</p>
        </Link>

        {/* Score or VS */}
        <div className="px-4 text-center">
          {homeGoals !== null && awayGoals !== null ? (
            <div className="text-2xl font-bold text-gray-900">
              {homeGoals} - {awayGoals}
            </div>
          ) : (
            <div className="text-lg font-semibold text-gray-400">VS</div>
          )}
          <p className="text-xs text-gray-400 mt-1">{formattedTime}</p>
        </div>

        {/* Away Team */}
        <Link href={`/team/${awayTeam?.id}`} className="flex-1 text-center hover:opacity-80 transition-opacity">
          {awayTeam?.image_path && (
            <img
              src={awayTeam.image_path}
              alt={awayTeam.name}
              className="w-10 h-10 mx-auto mb-2 object-contain"
            />
          )}
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            {awayTeam?.name || 'Visitante'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Visitante</p>
        </Link>
      </div>

      {/* Footer: Date and Action */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-xs text-gray-400">{formattedDate}</span>
        <Link
          href={`/match/${fixture.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 group-hover:translate-x-0.5 transition-transform"
        >
          Ver análisis
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
