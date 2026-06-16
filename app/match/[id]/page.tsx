'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PredictionPanel from '@/components/PredictionPanel';
import StatsTable from '@/components/StatsTable';
import { Fixture, Prediction } from '@/types/sportmonks';
import { formatMatchTime, formatMatchDateFull } from '@/lib/formatDate';

interface FormData {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
  winRate: number;
  form: ('W' | 'D' | 'L')[];
  estimatedXG?: { xgFor: number; xgAgainst: number };
}

interface H2HData {
  totalMatches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
}

/**
 * Match Detail Page
 * 
 * Shows comprehensive information about a single match including
 * teams, scores, statistics, and AI prediction.
 * 
 * TODO: Future enhancements:
 * - Add lineup visualization
 * - Add match events timeline (goals, cards, subs)
 * - Add live commentary feed
 * - Add odds comparison table
 * - Add player ratings
 * - Add xG timeline chart
 * - Save match to user favorites
 * - Share prediction via link
 */
export default function MatchDetailPage() {
  const params = useParams();
  const fixtureId = params.id as string;

  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [homeForm, setHomeForm] = useState<FormData | null>(null);
  const [awayForm, setAwayForm] = useState<FormData | null>(null);
  const [h2h, setH2H] = useState<H2HData | null>(null);
  const [isLoadingFixture, setIsLoadingFixture] = useState(true);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(false);
  const [fixtureError, setFixtureError] = useState<string | null>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  // Fetch fixture details
  const fetchFixture = async (showLoading = true) => {
    if (showLoading) setIsLoadingFixture(true);
    setFixtureError(null);

    try {
      const response = await fetch(`/api/fixtures/${fixtureId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener el partido');
      }

      setFixture(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setFixtureError(message);
    } finally {
      if (showLoading) setIsLoadingFixture(false);
    }
  };

  useEffect(() => {
    if (fixtureId) {
      fetchFixture(true);
    }
  }, [fixtureId]);

  // Auto-refresh every 30s for live matches (scores + statistics)
  useEffect(() => {
    if (!fixture) return;
    const dev = fixture.state?.developer_name || '';
    const isLive = ['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_ET_2ND_HALF', 'INPLAY_PENALTIES', 'BREAK', 'EXTRA_TIME_BREAK', 'PEN_BREAK'].includes(dev);
    if (!isLive) return;

    const interval = setInterval(() => {
      fetchFixture(false);
    }, 30000);

    return () => clearInterval(interval);
  }, [fixture?.state?.developer_name, fixtureId]);

  // Fetch prediction + form data
  useEffect(() => {
    async function fetchPrediction() {
      setIsLoadingPrediction(true);
      setPredictionError(null);

      try {
        const response = await fetch(`/api/prediction?fixtureId=${fixtureId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al generar predicción');
        }

        setPrediction(data.data.prediction);
        setHomeForm(data.data.homeForm || null);
        setAwayForm(data.data.awayForm || null);
        setH2H(data.data.h2h || null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setPredictionError(message);
      } finally {
        setIsLoadingPrediction(false);
      }
    }

    if (fixtureId) {
      fetchPrediction();
    }
  }, [fixtureId]);

  // Loading state
  if (isLoadingFixture) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 mb-6" />
          <div className="bg-white rounded-xl border border-gray-200 p-8">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex-1 text-center space-y-3">
                <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-24 mx-auto" />
              </div>
              <div className="h-10 bg-gray-200 rounded w-20 mx-8" />
              <div className="flex-1 text-center space-y-3">
                <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-24 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (fixtureError) {
    return (
      <div className="space-y-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver a partidos
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-red-800 mb-1">Error al cargar el partido</h3>
          <p className="text-sm text-red-600">{fixtureError}</p>
        </div>
      </div>
    );
  }

  if (!fixture) return null;

  const homeTeam = fixture.participants?.find(p => p.meta?.location === 'home');
  const awayTeam = fixture.participants?.find(p => p.meta?.location === 'away');
  const league = fixture.league;
  const state = fixture.state;

  // Format date/time (API returns UTC, converted to user's local timezone)
  const formattedDate = formatMatchDateFull(fixture.starting_at);
  const formattedTime = formatMatchTime(fixture.starting_at);

  // Get scores
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
  const getStatusInfo = () => {
    const devName = state?.developer_name;
    if (!devName || devName === 'NS') return { text: 'Por jugar', color: 'bg-blue-100 text-blue-800' };
    if (devName === 'FT' || devName === 'AET' || devName === 'FT_PEN') return { text: 'Finalizado', color: 'bg-gray-100 text-gray-800' };
    if (['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_ET_2ND_HALF', 'INPLAY_PENALTIES', 'BREAK', 'EXTRA_TIME_BREAK', 'PEN_BREAK'].includes(devName)) return { text: 'En vivo', color: 'bg-green-100 text-green-800' };
    if (['CANCELLED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'INTERRUPTED', 'DELAYED'].includes(devName)) return { text: 'Suspendido', color: 'bg-red-100 text-red-800' };
    return { text: state?.name || devName, color: 'bg-gray-100 text-gray-600' };
  };

  const statusInfo = getStatusInfo();

  // Determine match state for contextual panel
  const stateDevName = state?.developer_name;
  const matchState: 'pre' | 'live' | 'finished' = (() => {
    if (!stateDevName || stateDevName === 'NS') return 'pre';
    if (stateDevName === 'FT' || stateDevName === 'AET' || stateDevName === 'FT_PEN') return 'finished';
    if (['INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'HT', 'INPLAY_ET', 'INPLAY_ET_2ND_HALF', 'INPLAY_PENALTIES', 'BREAK', 'EXTRA_TIME_BREAK', 'PEN_BREAK'].includes(stateDevName)) return 'live';
    if (['CANCELLED', 'POSTPONED', 'SUSPENDED', 'ABANDONED', 'INTERRUPTED', 'DELAYED'].includes(stateDevName)) return 'pre';
    return 'pre';
  })();

  return (
    <div className="space-y-6">
      {/* Back Navigation */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a partidos
      </Link>

      {/* Match Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8">
        {/* League and Status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {league?.image_path && (
              <img src={league.image_path} alt={league.name} className="w-6 h-6 object-contain" />
            )}
            <span className="text-sm font-medium text-gray-600">{league?.name || 'Liga desconocida'}</span>
          </div>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${statusInfo.color}`}>
            {statusInfo.text}
          </span>
        </div>

        {/* Teams and Score */}
        <div className="flex items-center justify-between">
          {/* Home Team */}
          <Link href={`/team/${homeTeam?.id}`} className="flex-1 text-center hover:opacity-80 transition-opacity">
            {homeTeam?.image_path && (
              <img src={homeTeam.image_path} alt={homeTeam.name} className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 object-contain" />
            )}
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">{homeTeam?.name || 'Local'}</h2>
            <p className="text-xs text-gray-400 mt-1">Local</p>
          </Link>

          {/* Score */}
          <div className="px-6 sm:px-10 text-center">
            {homeGoals !== null && awayGoals !== null ? (
              <div className="text-4xl sm:text-5xl font-bold text-gray-900">
                {homeGoals} - {awayGoals}
              </div>
            ) : (
              <div className="text-2xl font-bold text-gray-300">VS</div>
            )}
            <p className="text-sm text-gray-500 mt-2">{formattedTime}</p>
          </div>

          {/* Away Team */}
          <Link href={`/team/${awayTeam?.id}`} className="flex-1 text-center hover:opacity-80 transition-opacity">
            {awayTeam?.image_path && (
              <img src={awayTeam.image_path} alt={awayTeam.name} className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-3 object-contain" />
            )}
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">{awayTeam?.name || 'Visitante'}</h2>
            <p className="text-xs text-gray-400 mt-1">Visitante</p>
          </Link>
        </div>

        {/* Match Info */}
        <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-500">
          <span className="capitalize">{formattedDate}</span>
          {fixture.venue && (
            <>
              <span className="text-gray-300">•</span>
              <span>{fixture.venue.name}, {fixture.venue.city_name}</span>
            </>
          )}
          {fixture.result_info && (
            <>
              <span className="text-gray-300">•</span>
              <span>{fixture.result_info}</span>
            </>
          )}
        </div>
      </div>

      {/* Content Grid: Left Panel + Prediction */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Context-aware based on match state */}
        <div className="space-y-6">
          {/* Pre-match: Show form, H2H, and xG data */}
          {matchState === 'pre' && (
            <>
              {/* Team Form Cards */}
              {isLoadingPrediction ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                  <div className="h-5 bg-gray-200 rounded w-40 mb-4" />
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-full" />
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                </div>
              ) : (
                <>
                  {/* xG Comparison */}
                  {(homeForm?.estimatedXG || awayForm?.estimatedXG) && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        xG Estimado Pre-Partido
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Home xG */}
                        <div className="text-center p-4 bg-indigo-50 rounded-lg">
                          <p className="text-xs font-medium text-indigo-600 mb-1">{homeTeam?.name}</p>
                          <p className="text-3xl font-bold text-indigo-700">{homeForm?.estimatedXG?.xgFor.toFixed(2) || '—'}</p>
                          <p className="text-xs text-indigo-500 mt-1">xG a favor / partido</p>
                          <p className="text-lg font-semibold text-indigo-400 mt-2">{homeForm?.estimatedXG?.xgAgainst.toFixed(2) || '—'}</p>
                          <p className="text-xs text-indigo-400">xG en contra / partido</p>
                        </div>
                        {/* Away xG */}
                        <div className="text-center p-4 bg-rose-50 rounded-lg">
                          <p className="text-xs font-medium text-rose-600 mb-1">{awayTeam?.name}</p>
                          <p className="text-3xl font-bold text-rose-700">{awayForm?.estimatedXG?.xgFor.toFixed(2) || '—'}</p>
                          <p className="text-xs text-rose-500 mt-1">xG a favor / partido</p>
                          <p className="text-lg font-semibold text-rose-400 mt-2">{awayForm?.estimatedXG?.xgAgainst.toFixed(2) || '—'}</p>
                          <p className="text-xs text-rose-400">xG en contra / partido</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        Basado en tiros a puerta, tiros dentro del área y ocasiones claras de los últimos partidos
                      </p>
                    </div>
                  )}

                  {/* Team Form */}
                  {(homeForm || awayForm) && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        Forma Reciente
                      </h3>
                      <div className="space-y-4">
                        {[
                          { label: homeTeam?.name || 'Local', form: homeForm, colorClass: 'text-indigo-600' },
                          { label: awayTeam?.name || 'Visitante', form: awayForm, colorClass: 'text-rose-600' },
                        ].map(({ label, form, colorClass }) => form && (
                          <div key={label} className="border border-gray-100 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-gray-900">{label}</p>
                              <div className="flex gap-1">
                                {form.form.map((r, i) => (
                                  <span key={i} className={`w-6 h-6 rounded text-xs font-bold flex items-center justify-center ${
                                    r === 'W' ? 'bg-green-100 text-green-700' :
                                    r === 'D' ? 'bg-gray-100 text-gray-600' :
                                    'bg-red-100 text-red-700'
                                  }`}>{r === 'W' ? 'V' : r === 'D' ? 'E' : 'D'}</span>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div>
                                <p className="text-lg font-bold text-gray-900">{form.wins}</p>
                                <p className="text-xs text-gray-500">Victorias</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-gray-900">{form.draws}</p>
                                <p className="text-xs text-gray-500">Empates</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-gray-900">{form.losses}</p>
                                <p className="text-xs text-gray-500">Derrotas</p>
                              </div>
                              <div>
                                <p className="text-lg font-bold text-gray-900">{Math.round(form.winRate * 100)}%</p>
                                <p className="text-xs text-gray-500">% Vic.</p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-50 flex justify-between text-xs text-gray-500">
                              <span>Goles a favor: <strong className={colorClass}>{form.avgGoalsFor.toFixed(1)}</strong>/partido</span>
                              <span>En contra: <strong className="text-gray-700">{form.avgGoalsAgainst.toFixed(1)}</strong>/partido</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* H2H */}
                  {h2h && h2h.totalMatches > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Historial Directo
                      </h3>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-indigo-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-indigo-700">{h2h.team1Wins}</p>
                          <p className="text-xs text-indigo-600 font-medium">{homeTeam?.name}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-gray-600">{h2h.draws}</p>
                          <p className="text-xs text-gray-500 font-medium">Empates</p>
                        </div>
                        <div className="bg-rose-50 rounded-lg p-3">
                          <p className="text-2xl font-bold text-rose-700">{h2h.team2Wins}</p>
                          <p className="text-xs text-rose-600 font-medium">{awayTeam?.name}</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-3 text-center">
                        {h2h.totalMatches} partidos entre ambos equipos
                      </p>
                      {/* H2H Visual bar */}
                      <div className="flex h-2 rounded-full overflow-hidden mt-3">
                        <div className="bg-indigo-500" style={{ width: `${(h2h.team1Wins / h2h.totalMatches) * 100}%` }} />
                        <div className="bg-gray-300" style={{ width: `${(h2h.draws / h2h.totalMatches) * 100}%` }} />
                        <div className="bg-rose-500" style={{ width: `${(h2h.team2Wins / h2h.totalMatches) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!homeForm && !awayForm && !h2h && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                      <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <h3 className="text-sm font-medium text-gray-900 mb-1">Datos pre-partido</h3>
                      <p className="text-xs text-gray-500">
                        No hay suficientes datos históricos para mostrar el análisis pre-partido.
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Live / Finished: Show match statistics */}
          {(matchState === 'live' || matchState === 'finished') && (
            <>
              {matchState === 'live' && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                  <p className="text-sm font-medium text-green-800">Partido en vivo — Estadísticas en tiempo real</p>
                </div>
              )}
              <StatsTable
                statistics={fixture.statistics || []}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
              />
            </>
          )}
        </div>

        {/* Prediction */}
        <PredictionPanel
          prediction={prediction}
          isLoading={isLoadingPrediction}
          error={predictionError}
          homeTeamName={homeTeam?.name || 'Local'}
          awayTeamName={awayTeam?.name || 'Visitante'}
        />
      </div>
    </div>
  );
}
