'use client';

import Link from 'next/link';
import { Fixture } from '@/types/sportmonks';
import { formatMatchTime, formatMatchDate } from '@/lib/formatDate';

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

  // Format date/time (API returns UTC, converted to user's local timezone)
  const formattedDate = formatMatchDate(fixture.starting_at);
  const formattedTime = formatMatchTime(fixture.starting_at);

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
      return { text: 'Por jugar', color: 'bg-blue-500/20 text-blue-300' };
    }
    if (devName === 'FT' || devName === 'AET' || devName === 'FT_PEN') {
      return { text: 'Finalizado', color: 'bg-gray-600/30 text-gray-300' };
    }
    if (['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_ET_2ND_HALF', 'INPLAY_PENALTIES', 'BREAK', 'EXTRA_TIME_BREAK', 'PEN_BREAK'].includes(devName)) {
      return { text: 'En vivo', color: 'bg-green-500/20 text-green-300' };
    }
    if (['CANCELLED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'INTERRUPTED', 'DELAYED'].includes(devName)) {
      return { text: 'Suspendido', color: 'bg-red-500/20 text-red-300' };
    }
    return { text: state?.name || 'Desconocido', color: 'bg-gray-600/30 text-gray-400' };
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-5 hover:border-gray-600/60 hover:bg-[#1e2236] transition-all duration-200 group">
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
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
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
          <p className="text-sm font-semibold text-gray-200 leading-tight">
            {homeTeam?.name || 'Local'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Local</p>
        </Link>

        {/* Score or VS */}
        <div className="px-4 text-center">
          {homeGoals !== null && awayGoals !== null ? (
            <div className="text-2xl font-bold text-white">
              {homeGoals} - {awayGoals}
            </div>
          ) : (
            <div className="text-lg font-semibold text-gray-500">VS</div>
          )}
          <p className="text-xs text-gray-500 mt-1">{formattedTime}</p>
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
          <p className="text-sm font-semibold text-gray-200 leading-tight">
            {awayTeam?.name || 'Visitante'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Visitante</p>
        </Link>
      </div>

      {/* Footer: Date and Action */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700/30">
        <span className="text-xs text-gray-500">{formattedDate}</span>
        <Link
          href={`/match/${fixture.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 group-hover:translate-x-0.5 transition-transform"
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
