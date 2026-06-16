'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MatchCard from '@/components/MatchCard';
import DateCalendar from '@/components/DateCalendar';
import { Fixture } from '@/types/sportmonks';
import { parseUTCDate, getLocalDateString } from '@/lib/formatDate';

interface CalendarLeague {
  id: number;
  name: string;
  image_path: string;
  today: Fixture[];
}

interface Standing {
  id: number;
  participant_id: number;
  position: number;
  points: number;
  result: string;
  group_id: number;
  group?: {
    id: number;
    name: string;
  };
  overall: {
    games_played: number;
    won: number;
    draw: number;
    lost: number;
    goals_scored: number;
    goals_against: number;
    goal_difference: number;
    points: number;
  };
  participant?: {
    id: number;
    name: string;
    short_code: string;
    image_path: string;
  };
}

interface StandingsGroup {
  id: number;
  name: string;
  standings: Standing[];
}

export default function CompetitionPage() {
  const params = useParams();
  const leagueId = params.id as string;

  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [standings, setStandings] = useState<StandingsGroup[]>([]);
  const [leagueName, setLeagueName] = useState('');
  const [leagueImage, setLeagueImage] = useState('');
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(true);
  const [isLoadingStandings, setIsLoadingStandings] = useState(true);
  const [fixturesError, setFixturesError] = useState<string | null>(null);
  const [standingsError, setStandingsError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'calendar' | 'fixtures' | 'standings'>('calendar');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [calendarDate, setCalendarDate] = useState(getLocalDateString());
  const [calendarFixtures, setCalendarFixtures] = useState<Fixture[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Fetch fixtures
  useEffect(() => {
    async function fetchFixtures() {
      setIsLoadingFixtures(true);
      try {
        const res = await fetch(`/api/leagues/${leagueId}/fixtures?page=${page}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');

        const newFixtures = data.data || [];
        if (page === 1) {
          setFixtures(newFixtures);
        } else {
          setFixtures(prev => [...prev, ...newFixtures]);
        }
        setHasMore(data.pagination?.has_more || false);

        // Get league name from first fixture
        if (newFixtures.length > 0 && newFixtures[0].league) {
          setLeagueName(newFixtures[0].league.name);
          setLeagueImage(newFixtures[0].league.image_path || '');
        }
      } catch (err) {
        setFixturesError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoadingFixtures(false);
      }
    }
    fetchFixtures();
  }, [leagueId, page]);

  // Fetch standings
  useEffect(() => {
    async function fetchStandings() {
      setIsLoadingStandings(true);
      try {
        const res = await fetch(`/api/leagues/${leagueId}/standings`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');

        const raw: Standing[] = data.data || [];
        if (raw.length > 0) {
          // Group by group name
          const groupsMap: Record<string, Standing[]> = {};
          raw.forEach(s => {
            const groupName = s.group?.name || `Grupo ${s.group_id}`;
            if (!groupsMap[groupName]) groupsMap[groupName] = [];
            groupsMap[groupName].push(s);
          });

          // Sort groups alphabetically and standings by points desc, then GD
          const grouped: StandingsGroup[] = Object.entries(groupsMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, items], idx) => ({
              id: idx,
              name,
              standings: items.sort((a, b) => {
                const aPts = a.overall?.points ?? a.points ?? 0;
                const bPts = b.overall?.points ?? b.points ?? 0;
                if (bPts !== aPts) return bPts - aPts;
                const aGD = (a.overall?.goals_scored || 0) - (a.overall?.goals_against || 0);
                const bGD = (b.overall?.goals_scored || 0) - (b.overall?.goals_against || 0);
                return bGD - aGD;
              }),
            }));

          setStandings(grouped);
        }
      } catch (err) {
        setStandingsError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoadingStandings(false);
      }
    }
    fetchStandings();
  }, [leagueId]);

  // Fetch fixtures by calendar date
  useEffect(() => {
    async function fetchByDate() {
      setIsLoadingCalendar(true);
      setCalendarError(null);
      try {
        const tzOffset = -(new Date().getTimezoneOffset() / 60); // e.g., -6 for Mexico
        const res = await fetch(`/api/fixtures/by-date?date=${calendarDate}&tz=${tzOffset}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');

        // Find this league in the response and extract today's fixtures
        const leagues: CalendarLeague[] = data.data || [];
        const thisLeague = leagues.find((l: CalendarLeague) => l.id === parseInt(leagueId));
        if (thisLeague && thisLeague.today) {
          // Sort by starting time
          const sorted = thisLeague.today.sort((a: Fixture, b: Fixture) =>
            (a.starting_at || '').localeCompare(b.starting_at || '')
          );
          setCalendarFixtures(sorted);
          if (!leagueName && thisLeague.name) {
            setLeagueName(thisLeague.name);
            setLeagueImage(thisLeague.image_path || '');
          }
        } else {
          setCalendarFixtures([]);
        }
      } catch (err) {
        setCalendarError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoadingCalendar(false);
      }
    }
    if (activeTab === 'calendar') {
      fetchByDate();
    }
  }, [calendarDate, leagueId, activeTab, leagueName]);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link href="/competitions" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a competencias
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-4">
          {leagueImage && (
            <img src={leagueImage} alt={leagueName} className="w-14 h-14 object-contain" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{leagueName || `Competencia #${leagueId}`}</h1>
            <p className="text-sm text-gray-500 mt-0.5">ID: {leagueId}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'calendar'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Calendario
        </button>
        <button
          onClick={() => setActiveTab('fixtures')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'fixtures'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Todos los Partidos
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'standings'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Tabla de Posiciones
        </button>
      </div>

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <DateCalendar selectedDate={calendarDate} onDateChange={setCalendarDate} />

          {calendarError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{calendarError}</div>
          )}

          {isLoadingCalendar ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-48" />
              ))}
            </div>
          ) : calendarFixtures.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <p className="text-gray-500 text-sm">No hay partidos de esta competencia para el día seleccionado.</p>
              <p className="text-gray-400 text-xs mt-1">Prueba con otra fecha usando el calendario.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">{calendarFixtures.length} partido{calendarFixtures.length !== 1 ? 's' : ''} este día</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {calendarFixtures.map((fixture) => (
                  <MatchCard key={fixture.id} fixture={fixture} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fixtures Tab */}
      {activeTab === 'fixtures' && (
        <div className="space-y-6">
          {fixturesError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{fixturesError}</div>
          )}

          {isLoadingFixtures && page === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-48" />
              ))}
            </div>
          ) : fixtures.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">No se encontraron partidos para esta competencia.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">{fixtures.length} partidos cargados</p>
              {/* Group fixtures by LOCAL date, today first */}
              {(() => {
                const today = getLocalDateString();
                const grouped: Record<string, Fixture[]> = {};
                fixtures.forEach(f => {
                  // Convert UTC to local date for grouping
                  const localDate = parseUTCDate(f.starting_at).toLocaleDateString('en-CA'); // YYYY-MM-DD format
                  if (!grouped[localDate]) grouped[localDate] = [];
                  grouped[localDate].push(f);
                });
                // Sort dates: today first, then by date ascending
                const sortedDates = Object.keys(grouped).sort((a, b) => {
                  if (a === today) return -1;
                  if (b === today) return 1;
                  return a.localeCompare(b);
                });
                return sortedDates.map(date => {
                  const dateObj = new Date(date + 'T12:00:00Z');
                  const isToday = date === today;
                  const label = isToday ? 'Hoy' : dateObj.toLocaleDateString('es-MX', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  });
                  // Sort fixtures within date by time
                  const sortedFixtures = grouped[date].sort((a, b) => 
                    (a.starting_at || '').localeCompare(b.starting_at || '')
                  );
                  return (
                    <div key={date} className="space-y-3">
                      <div className={`flex items-center gap-2 ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                        <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                        <h3 className={`text-sm font-semibold capitalize ${isToday ? 'text-indigo-700' : 'text-gray-700'}`}>
                          {label}
                        </h3>
                        <span className="text-xs text-gray-400">({sortedFixtures.length} partidos)</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {sortedFixtures.map((fixture) => (
                          <MatchCard key={fixture.id} fixture={fixture} />
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
              {hasMore && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={isLoadingFixtures}
                    className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoadingFixtures ? 'Cargando...' : 'Cargar más partidos'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Standings Tab */}
      {activeTab === 'standings' && (
        <div className="space-y-6">
          {standingsError && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
              Tabla de posiciones no disponible: {standingsError}
            </div>
          )}

          {isLoadingStandings ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-100 rounded" />
                ))}
              </div>
            </div>
          ) : standings.length === 0 && !standingsError ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">Tabla de posiciones no disponible para esta competencia.</p>
            </div>
          ) : (
            standings.map((group) => (
              <div key={group.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {group.name && standings.length > 1 && (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-700">{group.name}</h3>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 w-8">#</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Equipo</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500">PJ</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500">G</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500">E</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500">P</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500">GF</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500">GC</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500">DG</th>
                        <th className="text-center px-2 py-3 text-xs font-semibold text-gray-500 font-bold">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {group.standings
                        .map((row, idx) => {
                          const gd = (row.overall?.goals_scored || 0) - (row.overall?.goals_against || 0);
                          return (
                            <tr key={row.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-xs font-semibold text-gray-500">{idx + 1}</td>
                              <td className="px-4 py-2.5">
                                <Link href={`/team/${row.participant_id}`} className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                                  {row.participant?.image_path && (
                                    <img src={row.participant.image_path} alt="" className="w-5 h-5 object-contain" />
                                  )}
                                  <span className="text-sm font-medium truncate">
                                    {row.participant?.name || `Team ${row.participant_id}`}
                                  </span>
                                </Link>
                              </td>
                              <td className="text-center px-2 py-2.5 text-gray-600">{row.overall?.games_played || 0}</td>
                              <td className="text-center px-2 py-2.5 text-gray-600">{row.overall?.won || 0}</td>
                              <td className="text-center px-2 py-2.5 text-gray-600">{row.overall?.draw || 0}</td>
                              <td className="text-center px-2 py-2.5 text-gray-600">{row.overall?.lost || 0}</td>
                              <td className="text-center px-2 py-2.5 text-gray-600">{row.overall?.goals_scored || 0}</td>
                              <td className="text-center px-2 py-2.5 text-gray-600">{row.overall?.goals_against || 0}</td>
                              <td className={`text-center px-2 py-2.5 font-medium ${gd > 0 ? 'text-green-600' : gd < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                {gd > 0 ? '+' : ''}{gd}
                              </td>
                              <td className="text-center px-2 py-2.5 font-bold text-gray-900">{row.points}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
