'use client';

import { useState, useEffect } from 'react';

interface BacktestReport {
  model: string;
  totalMatches: number;
  exactScore: { top1Accuracy: number; top3Accuracy: number; top5Accuracy: number };
  matchResultAccuracy: number;
  goals: {
    homeMAE: number; awayMAE: number; totalMAE: number;
    avgPredictedHome: number; avgPredictedAway: number;
    avgActualHome: number; avgActualAway: number;
  };
  brierScore: number;
  benchmark: { randomBrier: number; description: string };
}

interface Comparison {
  modelA: BacktestReport;
  modelB: BacktestReport;
  winner: string;
  improvements: string[];
}

export default function ModelPerformancePage() {
  const [reportV1, setReportV1] = useState<BacktestReport | null>(null);
  const [reportV2, setReportV2] = useState<BacktestReport | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchReports() {
    setIsLoading(true);
    setError(null);
    try {
      const [v1Res, v2Res, compRes] = await Promise.all([
        fetch('/api/prediction/evaluate?model=POISSON_V1'),
        fetch('/api/prediction/evaluate?model=POISSON_V2'),
        fetch('/api/prediction/evaluate?model=POISSON_V1&compare=POISSON_V2'),
      ]);
      const v1Data = await v1Res.json();
      const v2Data = await v2Res.json();
      const compData = await compRes.json();

      setReportV1(v1Data.data || null);
      setReportV2(v2Data.data || null);
      setComparison(compData.data?.comparison || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reportes');
    } finally {
      setIsLoading(false);
    }
  }

  async function runEvaluation() {
    setIsEvaluating(true);
    setEvalResult(null);
    try {
      const res = await fetch('/api/prediction/evaluate', { method: 'POST' });
      const data = await res.json();
      setEvalResult(data.data?.message || 'Evaluación completada');
      await fetchReports();
    } catch (err) {
      setEvalResult('Error al evaluar predicciones');
    } finally {
      setIsEvaluating(false);
    }
  }

  useEffect(() => { fetchReports(); }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Model Performance</h1>
          <p className="text-sm text-gray-400 mt-1">Backtesting y comparación de modelos de predicción</p>
        </div>
        <button
          onClick={runEvaluation}
          disabled={isEvaluating}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isEvaluating ? 'Evaluando...' : 'Evaluar Pendientes'}
        </button>
      </div>

      {evalResult && (
        <div className="bg-indigo-900/20 border border-indigo-700/50 rounded-xl p-3 text-sm text-indigo-300">
          {evalResult}
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4 text-sm text-red-300">{error}</div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0, 1].map(i => (
            <div key={i} className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-6 animate-pulse">
              <div className="h-5 bg-gray-700 rounded w-1/3 mb-4" />
              <div className="space-y-3">
                {[0, 1, 2, 3].map(j => <div key={j} className="h-4 bg-gray-700/60 rounded w-full" />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Side-by-side reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportV1 && <ReportCard report={reportV1} label="V1 — Poisson (xG estimado)" color="blue" />}
            {reportV2 && <ReportCard report={reportV2} label="V2 — Team Strength Engine" color="emerald" />}
          </div>

          {/* No data message */}
          {(!reportV1 || reportV1.totalMatches === 0) && (!reportV2 || reportV2.totalMatches === 0) && (
            <div className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-8 text-center">
              <p className="text-gray-400 text-sm">No hay predicciones evaluadas aún.</p>
              <p className="text-gray-500 text-xs mt-1">Las predicciones se guardan automáticamente al consultar un partido. Usa &quot;Evaluar Pendientes&quot; después de que los partidos terminen.</p>
            </div>
          )}

          {/* Comparison */}
          {comparison && <ComparisonCard comparison={comparison} />}
        </>
      )}
    </div>
  );
}

function ReportCard({ report, label, color }: { report: BacktestReport; label: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
  };
  const dotColor: Record<string, string> = { blue: 'bg-blue-500', emerald: 'bg-emerald-500' };

  if (report.totalMatches === 0) {
    return (
      <div className={`bg-[#1a1d2e] rounded-xl border ${colorMap[color] || 'border-gray-700/50'} p-6`}>
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <span className={`w-2 h-2 ${dotColor[color] || 'bg-gray-500'} rounded-full`} />
          {label}
        </h3>
        <p className="text-gray-500 text-xs mt-3">Sin datos evaluados</p>
      </div>
    );
  }

  return (
    <div className={`bg-[#1a1d2e] rounded-xl border ${colorMap[color] || 'border-gray-700/50'} p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
          <span className={`w-2 h-2 ${dotColor[color] || 'bg-gray-500'} rounded-full`} />
          {label}
        </h3>
        <span className="text-xs text-gray-500">{report.totalMatches} partidos</span>
      </div>

      {/* 1X2 Accuracy */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Resultado 1X2</span>
          <span className="text-white font-medium">{(report.matchResultAccuracy * 100).toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-700/50 rounded-full h-2">
          <div className={`h-2 rounded-full ${color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(report.matchResultAccuracy * 100, 100)}%` }} />
        </div>
      </div>

      {/* Exact Score */}
      <div className="grid grid-cols-3 gap-3">
        <MetricBox label="Top 1" value={`${(report.exactScore.top1Accuracy * 100).toFixed(1)}%`} />
        <MetricBox label="Top 3" value={`${(report.exactScore.top3Accuracy * 100).toFixed(1)}%`} />
        <MetricBox label="Top 5" value={`${(report.exactScore.top5Accuracy * 100).toFixed(1)}%`} />
      </div>

      {/* Goals MAE */}
      <div className="grid grid-cols-3 gap-3">
        <MetricBox label="MAE Local" value={report.goals.homeMAE.toFixed(3)} small />
        <MetricBox label="MAE Visit" value={report.goals.awayMAE.toFixed(3)} small />
        <MetricBox label="MAE Total" value={report.goals.totalMAE.toFixed(3)} small />
      </div>

      {/* Brier Score */}
      <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400">Brier Score</span>
        <div className="text-right">
          <span className={`text-sm font-mono font-medium ${report.brierScore < 0.667 ? 'text-green-400' : 'text-red-400'}`}>
            {report.brierScore.toFixed(4)}
          </span>
          <span className="text-xs text-gray-500 ml-2">(random: 0.667)</span>
        </div>
      </div>

      {/* Average Goals */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Avg predicho: {report.goals.avgPredictedHome.toFixed(2)} - {report.goals.avgPredictedAway.toFixed(2)}</span>
          <span>Avg real: {report.goals.avgActualHome.toFixed(2)} - {report.goals.avgActualAway.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function ComparisonCard({ comparison }: { comparison: Comparison }) {
  return (
    <div className="bg-[#1a1d2e] rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
      <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-500 rounded-full" />
        Comparación V1 vs V2
      </h3>

      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400">Ganador:</span>
        <span className={`text-sm font-semibold ${comparison.winner === 'POISSON_V2' ? 'text-emerald-400' : comparison.winner === 'POISSON_V1' ? 'text-blue-400' : 'text-gray-400'}`}>
          {comparison.winner === 'TIE' ? 'Empate' : comparison.winner}
        </span>
      </div>

      {comparison.improvements.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-gray-400">Mejoras V2:</span>
          {comparison.improvements.map((imp, i) => (
            <div key={i} className="text-xs text-emerald-400 bg-emerald-900/20 rounded px-2 py-1">
              {imp}
            </div>
          ))}
        </div>
      )}

      {comparison.improvements.length === 0 && (
        <p className="text-xs text-gray-500">Sin mejoras significativas detectadas</p>
      )}
    </div>
  );
}

function MetricBox({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="bg-gray-800/50 rounded-lg px-3 py-2 text-center">
      <div className={`font-mono font-medium text-white ${small ? 'text-xs' : 'text-sm'}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
