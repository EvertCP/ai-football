'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import MatchRow from '@/components/MatchRow';
import DateCalendar from '@/components/DateCalendar';
import { Fixture } from '@/types/sportmonks';

interface LeagueWithFixtures {
  id: number;
  name: string;
  image_path: string;
  today: Fixture[];
}

export default function HomePage() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [leagues, setLeagues] = useState<LeagueWithFixtures[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'finished' | 'upcoming'>('all');
  const [featured, setFeatured] = useState<Fixture[]>([]);

  // Fetch fixtures for selected date
  useEffect(() => {
    async function fetchByDate() {
      setIsLoading(true);
      setError(null);
      try {
        const tzOffset = -(new Date().getTimezoneOffset() / 60);
        const res = await fetch(`/api/fixtures/by-date?date=${date}&tz=${tzOffset}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error');
        setLeagues(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error');
      } finally {
        setIsLoading(false);
      }
    }
    fetchByDate();
  }, [date]);

  // Fetch featured/recommended matches
  useEffect(() => {
    async function fetchFeatured() {
      try {
        const res = await fetch('/api/fixtures/latest?perPage=4');
        const data = await res.json();
        if (res.ok) setFeatured(data.data || []);
      } catch {}
    }
    fetchFeatured();
  }, []);

  // All fixtures flattened
  const allFixtures = useMemo(() => {
    return leagues.flatMap(l => l.today.map(f => ({ ...f, _leagueId: l.id, _leagueName: l.name, _leagueImage: l.image_path })));
  }, [leagues]);

  // Filter by status
  const filteredByStatus = useMemo(() => {
    return allFixtures.filter(f => {
      const dev = f.state?.developer_name || 'NS';
      if (statusFilter === 'live') return ['1H', '2H', 'HT', 'ET', 'PEN', 'LIVE', 'BREAK'].includes(dev);
      if (statusFilter === 'finished') return dev === 'FT' || dev === 'AET';
      if (statusFilter === 'upcoming') return dev === 'NS' || !dev;
      return true;
    });
  }, [allFixtures, statusFilter]);

  // Filter by league
  const filteredByLeague = useMemo(() => {
    if (selectedLeague === 'all') return filteredByStatus;
    return filteredByStatus.filter(f => f._leagueId === parseInt(selectedLeague));
  }, [filteredByStatus, selectedLeague]);

  // Filter by search
  const filteredFixtures = useMemo(() => {
    if (!searchQuery.trim()) return filteredByLeague;
    const q = searchQuery.toLowerCase();
    return filteredByLeague.filter(f => {
      const home = f.participants?.find(p => p.meta?.location === 'home')?.name?.toLowerCase() || '';
      const away = f.participants?.find(p => p.meta?.location === 'away')?.name?.toLowerCase() || '';
      return home.includes(q) || away.includes(q);
    });
  }, [filteredByLeague, searchQuery]);

  // Group filtered fixtures by league
  const groupedFixtures = useMemo(() => {
    const groups: Record<string, { id: number; name: string; image: string; fixtures: Fixture[]; group?: string }[]> = {};
    
    filteredFixtures.forEach(f => {
      const lid = f._leagueId || 0;
      const lname = f._leagueName || '';
      const limage = f._leagueImage || '';
      const key = `${lid}`;
      if (!groups[key]) groups[key] = [];
      
      // Check if fixture has a group (from round/stage)
      const groupName = f.group?.name || '';
      let section = groups[key].find(s => s.group === groupName);
      if (!section) {
        section = { id: lid, name: lname, image: limage, fixtures: [], group: groupName };
        groups[key].push(section);
      }
      section.fixtures.push(f);
    });

    return Object.values(groups).flat();
  }, [filteredFixtures]);

  // Counts
  const liveCount = allFixtures.filter(f => {
    const dev = f.state?.developer_name || '';
    return ['1H', '2H', 'HT', 'ET', 'PEN', 'LIVE', 'BREAK'].includes(dev);
  }).length;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left Column: Match List */}
      <div className="flex-1 min-w-0">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar partidos, equipos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* League Selector + Date */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={selectedLeague}
            onChange={(e) => setSelectedLeague(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Todas las ligas</option>
            {leagues.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <div className="flex-1" />
        </div>

        {/* Date Calendar */}
        <div className="mb-4">
          <DateCalendar selectedDate={date} onDateChange={setDate} />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 mb-4">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos ({allFixtures.length})
          </button>
          <button
            onClick={() => setStatusFilter('live')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'live' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            En vivo {liveCount > 0 && `(${liveCount})`}
          </button>
          <button
            onClick={() => setStatusFilter('finished')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'finished' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Finalizados
          </button>
          <button
            onClick={() => setStatusFilter('upcoming')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'upcoming' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Próximos
          </button>
        </div>

        {/* Match List */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center px-3 py-3 border-b border-gray-100 animate-pulse">
                <div className="w-14 h-4 bg-gray-100 rounded" />
                <div className="flex-1 ml-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-28" />
                </div>
                <div className="w-6 h-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        ) : filteredFixtures.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500 text-sm">No hay partidos para este día.</p>
            <p className="text-gray-400 text-xs mt-1">Selecciona otra fecha o cambia los filtros.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedFixtures.map((section, idx) => (
              <div key={`${section.id}-${section.group}-${idx}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* League Header */}
                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    {section.image && (
                      <img src={section.image} alt="" className="w-5 h-5 object-contain" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-gray-800">{section.name}</span>
                      {section.group && (
                        <span className="ml-2 text-xs text-gray-500">{section.group}</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/competition/${section.id}`}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Ver liga
                  </Link>
                </div>
                {/* Matches */}
                {section.fixtures
                  .sort((a, b) => (a.starting_at || '').localeCompare(b.starting_at || ''))
                  .map(fixture => (
                    <MatchRow key={fixture.id} fixture={fixture} />
                  ))
                }
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Featured */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
        {/* Featured Match Banner */}
        {featured.length > 0 && (
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-5 text-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {featured[0].league?.name || 'Destacado'}
              </span>
              <Link href={`/competition/${featured[0].league?.id || ''}`} className="text-white/70 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                {featured[0].participants?.[0]?.image_path && (
                  <img src={featured[0].participants[0].image_path} alt="" className="w-12 h-12 mx-auto mb-1 object-contain" />
                )}
                <p className="text-xs font-medium truncate">{featured[0].participants?.[0]?.name}</p>
              </div>
              <div className="px-3 text-center">
                <p className="text-lg font-bold">
                  {(() => {
                    const utc = featured[0].starting_at?.replace(' ', 'T') + 'Z';
                    return new Date(utc).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                  })()}
                </p>
                <p className="text-[10px] opacity-70">
                  {(() => {
                    const utc = featured[0].starting_at?.replace(' ', 'T') + 'Z';
                    const d = new Date(utc);
                    const today = new Date();
                    if (d.toDateString() === today.toDateString()) return 'Hoy';
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    if (d.toDateString() === tomorrow.toDateString()) return 'Mañana';
                    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
                  })()}
                </p>
              </div>
              <div className="text-center flex-1">
                {featured[0].participants?.[1]?.image_path && (
                  <img src={featured[0].participants[1].image_path} alt="" className="w-12 h-12 mx-auto mb-1 object-contain" />
                )}
                <p className="text-xs font-medium truncate">{featured[0].participants?.[1]?.name}</p>
              </div>
            </div>
          </div>
        )}

        {/* Recommended Matches */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-800">Partidos Destacados</h3>
          </div>
          {featured.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">Cargando...</div>
          ) : (
            featured.map(fixture => (
              <MatchRow key={fixture.id} fixture={fixture} />
            ))
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Accesos Rápidos</h3>
          <div className="space-y-2">
            <Link href="/competitions" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
              <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Todas las Competencias
            </Link>
            <Link href="/competition/732" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
              <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Mundial 2026
            </Link>
            <Link href="/competitions" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-gray-700 transition-colors">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Todas las Competencias
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
