'use client';

import { LineupPlayer, Team, Formation, FixtureMetadata } from '@/types/sportmonks';

interface MatchLineupsProps {
  lineups: LineupPlayer[];
  formations?: Formation[];
  metadata?: FixtureMetadata[];
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
}

// Position labels in Spanish
const POSITION_LABELS: Record<string, string> = {
  G: 'POR',
  D: 'DEF',
  M: 'MED',
  A: 'DEL',
};

const POSITION_COLORS: Record<string, string> = {
  G: 'bg-amber-100 text-amber-800',
  D: 'bg-blue-100 text-blue-800',
  M: 'bg-green-100 text-green-800',
  A: 'bg-red-100 text-red-800',
};

const POSITION_ORDER: Record<string, number> = {
  G: 0,
  D: 1,
  M: 2,
  A: 3,
};

// Sportmonks position_id → position letter mapping
const POSITION_ID_MAP: Record<number, string> = {
  24: 'G', // Goalkeeper
  25: 'D', // Defender
  26: 'M', // Midfielder
  27: 'A', // Attacker
};

/**
 * Resolves the position letter for a lineup player.
 * Uses the lineup's `position` field first, falls back to `player.position_id`.
 */
function resolvePosition(player: LineupPlayer): string {
  if (player.position && player.position.trim() !== '') return player.position;
  if (player.player?.position_id) return POSITION_ID_MAP[player.player.position_id] || '';
  // Fallback: derive from formation_field row
  if (player.formation_field) {
    const row = parseInt(player.formation_field.split(':')[0], 10);
    if (row === 1) return 'G';
  }
  return '';
}

/**
 * Derives formation string (e.g., "4-3-3") from lineup formation_field values
 */
function deriveFormation(starters: LineupPlayer[]): string | null {
  const rows: Record<number, number> = {};
  starters.forEach(p => {
    if (p.formation_field) {
      const row = parseInt(p.formation_field.split(':')[0], 10);
      if (!isNaN(row) && row > 1) {
        rows[row] = (rows[row] || 0) + 1;
      }
    }
  });

  const sortedRows = Object.keys(rows)
    .map(Number)
    .sort((a, b) => a - b);

  if (sortedRows.length === 0) return null;

  return sortedRows.map(r => rows[r]).join('-');
}

/**
 * Extracts coach name from metadata
 */
function getCoachFromMetadata(
  metadata: FixtureMetadata[] | undefined,
  location: 'home' | 'away'
): string | null {
  if (!metadata) return null;

  const coachMeta = metadata.find(m => {
    const devName = m.type?.developer_name?.toLowerCase() || '';
    return devName.includes('coach') && devName.includes(location);
  });

  if (coachMeta?.values) {
    return (
      (coachMeta.values as Record<string, string>).name ||
      (coachMeta.values as Record<string, string>).common_name ||
      null
    );
  }

  return null;
}

/**
 * Gets formation string from formations include or derives it from lineup data
 */
function getFormation(
  formations: Formation[] | undefined,
  teamId: number | undefined,
  location: string,
  starters: LineupPlayer[]
): string | null {
  if (formations && teamId) {
    const f = formations.find(
      fm => fm.participant_id === teamId || fm.location === location
    );
    if (f?.formation) return f.formation;
  }
  return deriveFormation(starters);
}

/**
 * Groups starters into formation rows based on formation_field
 * Returns rows ordered from GK (row 1) to forwards (row N)
 */
function groupByFormationRows(starters: LineupPlayer[]): LineupPlayer[][] {
  const rowMap: Record<number, LineupPlayer[]> = {};

  starters.forEach(p => {
    if (p.formation_field) {
      const row = parseInt(p.formation_field.split(':')[0], 10);
      if (!isNaN(row)) {
        if (!rowMap[row]) rowMap[row] = [];
        rowMap[row].push(p);
      }
    }
  });

  // Sort each row by position number (the second part of formation_field)
  Object.values(rowMap).forEach(row => {
    row.sort((a, b) => {
      const posA = parseInt(a.formation_field?.split(':')[1] || '0', 10);
      const posB = parseInt(b.formation_field?.split(':')[1] || '0', 10);
      return posA - posB;
    });
  });

  // Return rows sorted by row number
  const sortedKeys = Object.keys(rowMap).map(Number).sort((a, b) => a - b);
  return sortedKeys.map(k => rowMap[k]);
}

/**
 * Fallback grouping by position when formation_field is not available
 */
function groupByPosition(starters: LineupPlayer[]): LineupPlayer[][] {
  const groups: Record<string, LineupPlayer[]> = { G: [], D: [], M: [], A: [] };
  starters.forEach(p => {
    const pos = resolvePosition(p) || 'M';
    if (!groups[pos]) groups[pos] = [];
    groups[pos].push(p);
  });
  return ['G', 'D', 'M', 'A'].map(k => groups[k]).filter(g => g.length > 0);
}

/**
 * Player dot on the football pitch
 */
function PitchPlayer({ player, jersey_color }: { player: LineupPlayer; jersey_color: string }) {
  const displayName = player.player_name || player.player?.display_name || player.player?.common_name || '';
  // Get short surname
  const shortName = displayName.includes(' ')
    ? displayName.split(' ').slice(-1)[0]
    : displayName;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-md border-2 border-white/80 ${jersey_color}`}>
        {player.jersey_number}
      </div>
      <span className="text-[8px] sm:text-[9px] font-semibold text-white text-center leading-tight w-12 sm:w-14 truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {shortName}
      </span>
    </div>
  );
}

/**
 * Single horizontal football pitch with both teams — home on left, away on right
 */
function FullPitch({
  homeStarters,
  awayStarters,
  homeTeam,
  awayTeam,
  homeFormation,
  awayFormation,
}: {
  homeStarters: LineupPlayer[];
  awayStarters: LineupPlayer[];
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  homeFormation: string | null;
  awayFormation: string | null;
}) {
  const homeHasField = homeStarters.some(p => p.formation_field);
  const awayHasField = awayStarters.some(p => p.formation_field);

  // Home: GK on far left → forwards toward center (left-to-right columns)
  const homeRows = homeHasField ? groupByFormationRows(homeStarters) : groupByPosition(homeStarters);
  // Away: forwards toward center → GK on far right (reversed so GK is rightmost)
  const awayRows = awayHasField ? groupByFormationRows(awayStarters) : groupByPosition(awayStarters);
  const awayRowsReversed = [...awayRows].reverse();

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-gradient-to-r from-green-700 via-green-600 to-green-700 border border-green-800 shadow-inner">
      {/* Field markings — horizontal pitch */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Border */}
        <div className="absolute inset-2 sm:inset-3 border-2 border-white/30 rounded-lg" />
        {/* Center line (vertical) */}
        <div className="absolute top-2 sm:top-3 bottom-2 sm:bottom-3 left-1/2 w-0.5 bg-white/25" />
        {/* Center circle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-24 sm:h-24 border-2 border-white/25 rounded-full" />
        {/* Center dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white/30 rounded-full" />
        {/* Left penalty area */}
        <div className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-[12%] h-[55%] border-2 border-l-0 border-white/25 rounded-r-lg" />
        {/* Left goal area */}
        <div className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-[6%] h-[30%] border-2 border-l-0 border-white/20 rounded-r" />
        {/* Right penalty area */}
        <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-[12%] h-[55%] border-2 border-r-0 border-white/25 rounded-l-lg" />
        {/* Right goal area */}
        <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-[6%] h-[30%] border-2 border-r-0 border-white/20 rounded-l" />
      </div>

      {/* Team labels at top */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 pt-3 sm:pt-4">
        <div className="flex items-center gap-1.5">
          {homeTeam?.image_path && <img src={homeTeam.image_path} alt={homeTeam.name} className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />}
          <span className="text-[10px] sm:text-xs font-bold text-white/90 drop-shadow">{homeTeam?.name}</span>
          {homeFormation && (
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-200 bg-indigo-900/40 px-1.5 py-0.5 rounded">
              {homeFormation}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {awayFormation && (
            <span className="text-[9px] sm:text-[10px] font-bold text-rose-200 bg-rose-900/40 px-1.5 py-0.5 rounded">
              {awayFormation}
            </span>
          )}
          <span className="text-[10px] sm:text-xs font-bold text-white/90 drop-shadow">{awayTeam?.name}</span>
          {awayTeam?.image_path && <img src={awayTeam.image_path} alt={awayTeam.name} className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />}
        </div>
      </div>

      {/* Players — horizontal layout: columns for each formation row */}
      <div className="relative z-10 flex items-stretch min-h-[280px] sm:min-h-[340px] py-4 sm:py-6">
        {/* Home team (left half) */}
        <div className="flex-1 flex justify-between px-2 sm:px-4">
          {homeRows.map((col, colIdx) => (
            <div key={`home-${colIdx}`} className="flex flex-col items-center justify-center gap-2 sm:gap-3">
              {col.map(player => (
                <PitchPlayer key={player.id} player={player} jersey_color="bg-indigo-600 text-white" />
              ))}
            </div>
          ))}
        </div>

        {/* Away team (right half) */}
        <div className="flex-1 flex justify-between px-2 sm:px-4">
          {awayRowsReversed.map((col, colIdx) => (
            <div key={`away-${colIdx}`} className="flex flex-col items-center justify-center gap-2 sm:gap-3">
              {col.map(player => (
                <PitchPlayer key={player.id} player={player} jersey_color="bg-rose-600 text-white" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Bench player row
 */
function BenchPlayerRow({ player }: { player: LineupPlayer }) {
  const pos = resolvePosition(player);
  const posLabel = POSITION_LABELS[pos] || pos || '—';
  const posColor = POSITION_COLORS[pos] || 'bg-gray-100 text-gray-700';
  const displayName = player.player_name || player.player?.display_name || player.player?.common_name || '';
  const imageUrl = player.player?.image_path;

  return (
    <div className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
      <span className="w-6 h-6 flex items-center justify-center text-[10px] font-bold text-gray-600 bg-gray-100 rounded-full flex-shrink-0">
        {player.jersey_number}
      </span>
      {imageUrl ? (
        <img src={imageUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-gray-200" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{displayName}</span>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${posColor}`}>{posLabel}</span>
    </div>
  );
}

export default function MatchLineups({
  lineups,
  formations,
  metadata,
  homeTeam,
  awayTeam,
}: MatchLineupsProps) {
  if (!lineups || lineups.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Alineaciones
        </h3>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm text-gray-500">
            Alineaciones no disponibles para este partido.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Las alineaciones se publican aproximadamente una hora antes del inicio.
          </p>
        </div>
      </div>
    );
  }

  // Split lineups by team
  const homeLineups = lineups.filter(l => l.team_id === homeTeam?.id);
  const awayLineups = lineups.filter(l => l.team_id === awayTeam?.id);

  // Split into starters and bench strictly by type_id from the API
  // type_id 11 = starting XI, type_id 12 = bench
  const homeStarters = homeLineups.filter(l => l.type_id === 11);
  const homeBench = homeLineups.filter(l => l.type_id === 12);
  const awayStarters = awayLineups.filter(l => l.type_id === 11);
  const awayBench = awayLineups.filter(l => l.type_id === 12);

  // Get formations
  const homeFormation = getFormation(formations, homeTeam?.id, 'home', homeStarters);
  const awayFormation = getFormation(formations, awayTeam?.id, 'away', awayStarters);

  // Get coaches from metadata
  const homeCoach = getCoachFromMetadata(metadata, 'home');
  const awayCoach = getCoachFromMetadata(metadata, 'away');

  // Sort bench by position then jersey number
  const sortedHomeBench = [...homeBench].sort((a, b) => {
    const oA = POSITION_ORDER[resolvePosition(a)] ?? 99;
    const oB = POSITION_ORDER[resolvePosition(b)] ?? 99;
    return oA !== oB ? oA - oB : (a.jersey_number || 0) - (b.jersey_number || 0);
  });
  const sortedAwayBench = [...awayBench].sort((a, b) => {
    const oA = POSITION_ORDER[resolvePosition(a)] ?? 99;
    const oB = POSITION_ORDER[resolvePosition(b)] ?? 99;
    return oA !== oB ? oA - oB : (a.jersey_number || 0) - (b.jersey_number || 0);
  });

  return (
    <div className="space-y-6">
      {/* Single Horizontal Pitch with both teams */}
      <FullPitch
        homeStarters={homeStarters}
        awayStarters={awayStarters}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeFormation={homeFormation}
        awayFormation={awayFormation}
      />

      {/* Coaches and Bench */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:divide-x md:divide-gray-100">
          {/* Home Team - Coach & Bench */}
          <div>
            {/* Coach */}
            {homeCoach && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-indigo-50 rounded-lg">
                <svg className="w-5 h-5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Director Técnico</p>
                  <p className="text-sm font-semibold text-indigo-900">{homeCoach}</p>
                </div>
              </div>
            )}
            {/* Bench */}
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Suplentes ({sortedHomeBench.length})
              </p>
            </div>
            {sortedHomeBench.length > 0 ? (
              <div className="space-y-0.5">
                {sortedHomeBench.map(p => <BenchPlayerRow key={p.id} player={p} />)}
              </div>
            ) : (
              <p className="text-xs text-gray-400 px-2">No hay información de suplentes.</p>
            )}
          </div>

          {/* Away Team - Coach & Bench */}
          <div className="md:pl-6">
            {/* Coach */}
            {awayCoach && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-rose-50 rounded-lg">
                <svg className="w-5 h-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Director Técnico</p>
                  <p className="text-sm font-semibold text-rose-900">{awayCoach}</p>
                </div>
              </div>
            )}
            {/* Bench */}
            <div className="flex items-center gap-2 mb-2 px-2">
              <div className="w-2 h-2 rounded-full bg-rose-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Suplentes ({sortedAwayBench.length})
              </p>
            </div>
            {sortedAwayBench.length > 0 ? (
              <div className="space-y-0.5">
                {sortedAwayBench.map(p => <BenchPlayerRow key={p.id} player={p} />)}
              </div>
            ) : (
              <p className="text-xs text-gray-400 px-2">No hay información de suplentes.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
