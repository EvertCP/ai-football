'use client';

import Link from 'next/link';
import { Fixture } from '@/types/sportmonks';
import { formatMatchTime } from '@/lib/formatDate';

interface MatchRowProps {
  fixture: Fixture;
}

/**
 * Compact match row (Sofascore-style) showing time, teams, and score in a single row.
 */
export default function MatchRow({ fixture }: MatchRowProps) {
  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const state = fixture.state;

  // Format time (API returns UTC, converted to user's local timezone)
  const formattedTime = formatMatchTime(fixture.starting_at);

  // Get score
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

  // Status
  const devName = state?.developer_name;
  const isLive = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_ET_2ND_HALF', 'INPLAY_PENALTIES', 'BREAK', 'EXTRA_TIME_BREAK', 'PEN_BREAK'].includes(devName || '');
  const isFinished = devName === 'FT' || devName === 'AET' || devName === 'FT_PEN';
  const isPostponed = ['CANCELLED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'INTERRUPTED', 'DELAYED'].includes(devName || '');

  const statusLabel = isFinished ? 'FT' : isLive ? 'EN VIVO' : isPostponed ? 'SUSP' : formattedTime;

  return (
    <Link
      href={`/match/${fixture.id}`}
      className="flex items-center px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 group"
    >
      {/* Time / Status */}
      <div className="w-14 flex-shrink-0 text-center">
        <span className={`text-xs font-medium ${
          isLive ? 'text-green-600' : isFinished ? 'text-gray-400' : isPostponed ? 'text-red-500' : 'text-gray-600'
        }`}>
          {statusLabel}
        </span>
        {isFinished && (
          <p className="text-[10px] text-gray-400">FT</p>
        )}
      </div>

      {/* Teams */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Home */}
        <div className="flex items-center gap-2">
          {homeTeam?.image_path ? (
            <img src={homeTeam.image_path} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 bg-gray-200 rounded-full flex-shrink-0" />
          )}
          <span className={`text-sm truncate ${isFinished && homeGoals !== null && awayGoals !== null && homeGoals > awayGoals ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {homeTeam?.name || 'Local'}
          </span>
        </div>
        {/* Away */}
        <div className="flex items-center gap-2">
          {awayTeam?.image_path ? (
            <img src={awayTeam.image_path} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 bg-gray-200 rounded-full flex-shrink-0" />
          )}
          <span className={`text-sm truncate ${isFinished && homeGoals !== null && awayGoals !== null && awayGoals > homeGoals ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {awayTeam?.name || 'Visitante'}
          </span>
        </div>
      </div>

      {/* Score */}
      <div className="w-10 flex-shrink-0 text-right space-y-1">
        {homeGoals !== null && awayGoals !== null ? (
          <>
            <p className={`text-sm ${homeGoals > awayGoals ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{homeGoals}</p>
            <p className={`text-sm ${awayGoals > homeGoals ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{awayGoals}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">-</p>
            <p className="text-sm text-gray-400">-</p>
          </>
        )}
      </div>
    </Link>
  );
}
