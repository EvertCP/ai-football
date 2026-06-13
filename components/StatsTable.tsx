'use client';

import { FixtureStatistic, Team } from '@/types/sportmonks';

interface StatsTableProps {
  statistics: FixtureStatistic[];
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
}

/**
 * StatsTable Component
 * Displays match statistics in a comparative table format.
 * 
 * TODO: Future enhancements:
 * - Add visual bars for stat comparison
 * - Add stat type name mapping (type_id -> readable name)
 * - Add xG visualization
 * - Add shot map visualization
 * - Add possession timeline
 * - Color code stats that favor each team
 * - Add tooltips with stat explanations
 */

// Mapping of Sportmonks stat type IDs to Spanish names
const STAT_TYPE_NAMES: Record<number, string> = {
  45: 'Posesión %',
  42: 'Tiros Totales',
  86: 'Tiros a Puerta',
  41: 'Tiros Fuera',
  58: 'Tiros Bloqueados',
  49: 'Tiros Dentro del Área',
  50: 'Tiros Fuera del Área',
  54: 'Intentos de Gol',
  34: 'Corners',
  56: 'Faltas',
  55: 'Tiros Libres',
  84: 'Tarjetas Amarillas',
  52: 'Goles',
  53: 'Saques de Meta',
  51: 'Fuera de Juego',
  57: 'Atajadas',
  59: 'Sustituciones',
  60: 'Saques de Banda',
  80: 'Pases Totales',
  81: 'Pases Precisos',
  82: 'Pases Precisos %',
  62: 'Pases Largos',
  117: 'Pases Clave',
  43: 'Ataques',
  44: 'Ataques Peligrosos',
  46: 'Balón Seguro',
  78: 'Entradas',
  65: 'Cabezazos Ganados',
  79: 'Asistencias',
  98: 'Centros Totales',
  99: 'Centros Precisos',
  100: 'Intercepciones',
  106: 'Duelos Ganados',
  108: 'Intentos de Regate',
  109: 'Regates Exitosos',
  1605: 'Regates Exitosos %',
  580: 'Ocasiones Claras Creadas',
  581: 'Ocasiones Claras Falladas',
  1527: 'Contraataques',
  27264: 'Pases al Último Tercio',
  27265: 'Pases al Último Tercio Exitosos',
};

// Order of stats for display (most important first)
const STAT_DISPLAY_ORDER: number[] = [
  45, 42, 86, 41, 58, 49, 50, 34, 56, 84, 51, 57,
  80, 81, 82, 62, 117, 43, 44, 78, 65, 98, 99, 100,
  106, 108, 109, 1605, 580, 581, 1527, 79, 59, 60,
  55, 53, 52, 54, 46, 27264, 27265,
];

export default function StatsTable({ statistics, homeTeam, awayTeam }: StatsTableProps) {
  if (!statistics || statistics.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Estadísticas</h3>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-gray-500">
            Estadísticas no disponibles para este partido.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Las estadísticas aparecen durante y después del partido.
          </p>
        </div>
      </div>
    );
  }

  // Group statistics by type_id for comparison
  const statPairs: {
    typeId: number;
    name: string;
    homeValue: string | number;
    awayValue: string | number;
  }[] = [];

  const homeStats = statistics.filter(s => s.participant_id === homeTeam?.id);
  const awayStats = statistics.filter(s => s.participant_id === awayTeam?.id);

  // Collect all available type IDs
  const allTypeIds = new Set<number>();
  statistics.forEach(s => allTypeIds.add(s.type_id));

  // Sort by display order, then remaining stats at the end
  const sortedTypeIds = Array.from(allTypeIds).sort((a, b) => {
    const idxA = STAT_DISPLAY_ORDER.indexOf(a);
    const idxB = STAT_DISPLAY_ORDER.indexOf(b);
    if (idxA === -1 && idxB === -1) return a - b;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  sortedTypeIds.forEach(typeId => {
    const homeStat = homeStats.find(s => s.type_id === typeId);
    const awayStat = awayStats.find(s => s.type_id === typeId);
    statPairs.push({
      typeId,
      name: STAT_TYPE_NAMES[typeId] || `Stat #${typeId}`,
      homeValue: homeStat?.data?.value ?? '-',
      awayValue: awayStat?.data?.value ?? '-',
    });
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas</h3>

      <div className="overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-3 gap-4 pb-3 border-b border-gray-200">
          <div className="text-xs font-semibold text-gray-500 text-center">
            {homeTeam?.name || 'Local'}
          </div>
          <div className="text-xs font-semibold text-gray-500 text-center">
            Estadística
          </div>
          <div className="text-xs font-semibold text-gray-500 text-center">
            {awayTeam?.name || 'Visitante'}
          </div>
        </div>

        {/* Stats Rows */}
        <div className="divide-y divide-gray-50">
          {statPairs.map((pair) => {
            const homeNum = typeof pair.homeValue === 'number' ? pair.homeValue : parseFloat(String(pair.homeValue));
            const awayNum = typeof pair.awayValue === 'number' ? pair.awayValue : parseFloat(String(pair.awayValue));
            const homeHigher = !isNaN(homeNum) && !isNaN(awayNum) && homeNum > awayNum;
            const awayHigher = !isNaN(homeNum) && !isNaN(awayNum) && awayNum > homeNum;
            const maxVal = Math.max(homeNum || 0, awayNum || 0);
            const homePct = maxVal > 0 ? ((homeNum || 0) / maxVal) * 100 : 0;
            const awayPct = maxVal > 0 ? ((awayNum || 0) / maxVal) * 100 : 0;

            return (
              <div key={pair.typeId} className="py-3">
                <div className="grid grid-cols-3 gap-4 mb-1">
                  <div className={`text-sm text-center font-medium ${homeHigher ? 'text-indigo-600' : 'text-gray-700'}`}>
                    {pair.homeValue}
                  </div>
                  <div className="text-xs text-center text-gray-500 self-center">
                    {pair.name}
                  </div>
                  <div className={`text-sm text-center font-medium ${awayHigher ? 'text-rose-600' : 'text-gray-700'}`}>
                    {pair.awayValue}
                  </div>
                </div>
                {/* Visual bar */}
                {maxVal > 0 && !isNaN(homeNum) && !isNaN(awayNum) && (
                  <div className="flex items-center gap-1 px-4">
                    <div className="flex-1 flex justify-end">
                      <div
                        className={`h-1.5 rounded-full transition-all ${homeHigher ? 'bg-indigo-500' : 'bg-gray-300'}`}
                        style={{ width: `${homePct}%` }}
                      />
                    </div>
                    <div className="w-1" />
                    <div className="flex-1">
                      <div
                        className={`h-1.5 rounded-full transition-all ${awayHigher ? 'bg-rose-500' : 'bg-gray-300'}`}
                        style={{ width: `${awayPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
