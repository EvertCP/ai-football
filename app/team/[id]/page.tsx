'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Fixture } from '@/types/sportmonks';
import { formatMatchTime, formatMatchDate } from '@/lib/formatDate';

interface Player {
  id: number;
  name: string;
  image: string;
  position: string;
  positionId: number;
  jerseyNumber: number | null;
  captain: boolean;
  dateOfBirth: string | null;
  height: number | null;
  weight: number | null;
}

interface Coach {
  id: number;
  name: string;
  image: string;
  dateOfBirth: string | null;
}

interface TeamLeague {
  leagueId: number;
  leagueName: string;
  leagueImage: string;
  seasonName: string;
}

interface Venue {
  name: string;
  city: string;
  capacity: number;
  image: string;
  surface: string;
  address: string;
}

interface TeamData {
  id: number;
  name: string;
  shortCode: string;
  image: string;
  founded: number;
  type: string;
  venue: Venue | null;
  coaches: Coach[];
  players: Player[];
  leagues: TeamLeague[];
  upcoming: Fixture[];
  latest: Fixture[];
}

const POSITION_LABELS: Record<string, string> = {
  Goalkeeper: 'Porteros',
  Defender: 'Defensas',
  Midfielder: 'Mediocampistas',
  Attacker: 'Delanteros',
};

const POSITION_COLORS: Record<string, string> = {
  Goalkeeper: 'bg-amber-100 text-amber-800',
  Defender: 'bg-blue-100 text-blue-800',
  Midfielder: 'bg-green-100 text-green-800',
  Attacker: 'bg-red-100 text-red-800',
};

export default function TeamPage() {
  const params = useParams();
  const teamId = params.id as string;

  const [team, setTeam] = useState<TeamData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'squad' | 'fixtures'>('overview');

  useEffect(() => {
    async function fetchTeam() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/teams/${teamId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        setTeam(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchTeam();
  }, [teamId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-200 rounded-full" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 text-sm">{error || 'Equipo no encontrado'}</p>
        </div>
      </div>
    );
  }

  // Group players by position
  const playersByPosition: Record<string, Player[]> = {};
  team.players.forEach(p => {
    const pos = p.position || 'Unknown';
    if (!playersByPosition[pos]) playersByPosition[pos] = [];
    playersByPosition[pos].push(p);
  });

  // Compute form from latest
  const form = team.latest
    .filter(f => f.state?.developer_name === 'FT' || f.state?.developer_name === 'AET')
    .slice(0, 5)
    .map(match => {
      const isHome = match.participants?.find(p => p.meta?.location === 'home')?.id === team.id;
      let homeGoals = 0, awayGoals = 0;
      match.scores?.forEach(s => {
        if (s.description === 'CURRENT') {
          const isHomeScore = s.participant_id === match.participants?.find(p => p.meta?.location === 'home')?.id;
          if (isHomeScore) homeGoals = s.score.goals;
          else awayGoals = s.score.goals;
        }
      });
      const teamGoals = isHome ? homeGoals : awayGoals;
      const oppGoals = isHome ? awayGoals : homeGoals;
      if (teamGoals > oppGoals) return 'W';
      if (teamGoals === oppGoals) return 'D';
      return 'L';
    });

  return (
    <div className="space-y-6">
      {/* Back */}
      <button onClick={() => window.history.back()} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver
      </button>

      {/* Team Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {team.image && (
            <img src={team.image} alt={team.name} className="w-20 h-20 object-contain" />
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
              {team.shortCode && <span className="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs">{team.shortCode}</span>}
              {team.founded > 0 && <span>Fundado: {team.founded}</span>}
              {team.type && <span className="capitalize">{team.type === 'national' ? 'Selección Nacional' : 'Club'}</span>}
            </div>
            {/* Form */}
            {form.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3">
                <span className="text-xs text-gray-500 mr-1">Forma:</span>
                {form.map((r, i) => (
                  <span
                    key={i}
                    className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
                      r === 'W' ? 'bg-green-500 text-white' :
                      r === 'D' ? 'bg-gray-400 text-white' :
                      'bg-red-500 text-white'
                    }`}
                  >
                    {r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Venue */}
        {team.venue && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Estadio</h3>
            {team.venue.image && (
              <img src={team.venue.image} alt={team.venue.name} className="w-full h-24 object-cover rounded-lg mb-2" />
            )}
            <p className="text-sm font-medium text-gray-900">{team.venue.name}</p>
            <p className="text-xs text-gray-500">{team.venue.city}</p>
            {team.venue.capacity > 0 && (
              <p className="text-xs text-gray-500">Capacidad: {team.venue.capacity.toLocaleString()}</p>
            )}
            {team.venue.surface && (
              <p className="text-xs text-gray-500 capitalize">Superficie: {team.venue.surface}</p>
            )}
          </div>
        )}

        {/* Coach */}
        {team.coaches.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Director Técnico</h3>
            {team.coaches.map(c => (
              <div key={c.id} className="flex items-center gap-3">
                {c.image ? (
                  <img src={c.image} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm">DT</div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leagues */}
        {team.leagues.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Competencias</h3>
            <div className="space-y-2">
              {team.leagues.map(l => (
                <Link key={l.leagueId} href={`/competition/${l.leagueId}`} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                  {l.leagueImage && <img src={l.leagueImage} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-sm text-gray-700 hover:text-indigo-600">{l.leagueName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Plantilla</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{team.players.length}</p>
              <p className="text-xs text-gray-500">Jugadores</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{team.upcoming.length}</p>
              <p className="text-xs text-gray-500">Próximos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['overview', 'squad', 'fixtures'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'overview' ? 'Resumen' : tab === 'squad' ? 'Plantilla' : 'Partidos'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Próximos Partidos</h3>
            </div>
            {team.upcoming.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">Sin próximos partidos programados.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {team.upcoming.map(match => (
                  <FixtureRow key={match.id} fixture={match} teamId={team.id} />
                ))}
              </div>
            )}
          </div>

          {/* Latest */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Últimos Resultados</h3>
            </div>
            {team.latest.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">Sin resultados recientes.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {team.latest.slice(0, 10).map(match => (
                  <FixtureRow key={match.id} fixture={match} teamId={team.id} showResult />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Squad Tab */}
      {activeTab === 'squad' && (
        <div className="space-y-6">
          {['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'].map(pos => {
            const posPlayers = playersByPosition[pos];
            if (!posPlayers || posPlayers.length === 0) return null;
            return (
              <div key={pos} className="bg-white rounded-xl border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">{POSITION_LABELS[pos] || pos}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 divide-gray-50">
                  {posPlayers.map(player => (
                    <div key={player.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors">
                      {player.image ? (
                        <img src={player.image} alt={player.name} className="w-10 h-10 rounded-full object-cover bg-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold">
                          {player.jerseyNumber || '?'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{player.name}</span>
                          {player.captain && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-semibold">C</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${POSITION_COLORS[pos] || 'bg-gray-100 text-gray-600'}`}>
                            {pos === 'Goalkeeper' ? 'POR' : pos === 'Defender' ? 'DEF' : pos === 'Midfielder' ? 'MED' : 'DEL'}
                          </span>
                          {player.jerseyNumber && (
                            <span className="text-xs text-gray-500">#{player.jerseyNumber}</span>
                          )}
                          {player.height && (
                            <span className="text-xs text-gray-400">{player.height}cm</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {/* Unknown positions */}
          {Object.entries(playersByPosition)
            .filter(([pos]) => !['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'].includes(pos))
            .map(([pos, players]) => (
              <div key={pos} className="bg-white rounded-xl border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">{pos}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
                  {players.map(player => (
                    <div key={player.id} className="flex items-center gap-3 p-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs font-bold">
                        {player.jerseyNumber || '?'}
                      </div>
                      <span className="text-sm text-gray-700">{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Fixtures Tab */}
      {activeTab === 'fixtures' && (
        <div className="space-y-6">
          {/* Upcoming */}
          {team.upcoming.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Próximos Partidos</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {team.upcoming.map(match => (
                  <FixtureRow key={match.id} fixture={match} teamId={team.id} />
                ))}
              </div>
            </div>
          )}

          {/* All latest */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700">Resultados Recientes</h3>
            </div>
            {team.latest.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">Sin resultados.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {team.latest.map(match => (
                  <FixtureRow key={match.id} fixture={match} teamId={team.id} showResult />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FixtureRow({ fixture, teamId, showResult }: { fixture: Fixture; teamId: number; showResult?: boolean }) {
  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const isHome = homeTeam?.id === teamId;

  // Date formatting (API returns UTC, converted to user's local timezone)
  const dateStr = formatMatchDate(fixture.starting_at, { day: 'numeric', month: 'short' });
  const timeStr = formatMatchTime(fixture.starting_at);

  // Score
  let homeGoals = '-';
  let awayGoals = '-';
  let resultClass = '';

  if (showResult && fixture.scores) {
    fixture.scores.forEach(s => {
      if (s.description === 'CURRENT') {
        if (s.participant_id === homeTeam?.id) homeGoals = String(s.score.goals);
        else awayGoals = String(s.score.goals);
      }
    });

    // Determine result for this team
    const hg = parseInt(homeGoals) || 0;
    const ag = parseInt(awayGoals) || 0;
    const teamGoals = isHome ? hg : ag;
    const oppGoals = isHome ? ag : hg;
    if (teamGoals > oppGoals) resultClass = 'border-l-4 border-l-green-500';
    else if (teamGoals < oppGoals) resultClass = 'border-l-4 border-l-red-500';
    else resultClass = 'border-l-4 border-l-gray-400';
  }

  return (
    <Link
      href={`/match/${fixture.id}`}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${resultClass}`}
    >
      {/* Date */}
      <div className="text-center w-14 flex-shrink-0">
        <p className="text-xs text-gray-500">{dateStr}</p>
        <p className="text-xs font-medium text-gray-700">{timeStr}</p>
      </div>

      {/* League badge */}
      {fixture.league?.image_path && (
        <img src={fixture.league.image_path} alt="" className="w-4 h-4 object-contain flex-shrink-0" />
      )}

      {/* Teams */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {homeTeam?.image_path && <img src={homeTeam.image_path} alt="" className="w-4 h-4 object-contain" />}
          <span className={`text-sm truncate ${isHome ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {homeTeam?.name || '?'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {awayTeam?.image_path && <img src={awayTeam.image_path} alt="" className="w-4 h-4 object-contain" />}
          <span className={`text-sm truncate ${!isHome ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {awayTeam?.name || '?'}
          </span>
        </div>
      </div>

      {/* Score or Status */}
      {showResult && homeGoals !== '-' ? (
        <div className="text-right flex-shrink-0 w-10">
          <p className="text-sm font-bold text-gray-900">{homeGoals}</p>
          <p className="text-sm font-bold text-gray-900">{awayGoals}</p>
        </div>
      ) : (
        <div className="flex-shrink-0">
          <span className={`text-xs px-2 py-1 rounded ${
            fixture.state?.developer_name === 'NS' ? 'bg-gray-100 text-gray-600' :
            ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_ET_2ND_HALF', 'INPLAY_PENALTIES', 'BREAK'].includes(fixture.state?.developer_name || '')
              ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-500'
          }`}>
            {fixture.state?.short_name || 'TBD'}
          </span>
        </div>
      )}
    </Link>
  );
}
