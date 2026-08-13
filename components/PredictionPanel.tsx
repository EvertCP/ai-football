'use client';

import { Prediction } from '@/types/sportmonks';
import type { ExactScorePrediction } from '@/lib/prediction-engine';

interface PredictionPanelProps {
  prediction: Prediction | null;
  exactScorePrediction?: ExactScorePrediction | null;
  isLoading: boolean;
  error: string | null;
  homeTeamName: string;
  awayTeamName: string;
}

/**
 * PredictionPanel Component
 * Displays match prediction with probability bars, exact score predictions,
 * and recommendation.
 */
export default function PredictionPanel({
  prediction,
  exactScorePrediction,
  isLoading,
  error,
  homeTeamName,
  awayTeamName,
}: PredictionPanelProps) {
  if (isLoading) {
    return (
      <div className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Predicción</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-8 bg-gray-700 rounded" />
          <div className="h-8 bg-gray-700 rounded" />
          <div className="h-8 bg-gray-700 rounded" />
          <div className="h-16 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1d2e] rounded-xl border border-red-800/50 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Predicción</h3>
        <div className="bg-red-900/20 text-red-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Predicción</h3>
        <p className="text-sm text-gray-400">No hay predicción disponible.</p>
      </div>
    );
  }

  const confidenceColors = {
    low: 'bg-yellow-500/20 text-yellow-300',
    medium: 'bg-blue-500/20 text-blue-300',
    high: 'bg-green-500/20 text-green-300',
  };

  const confidenceLabels = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
  };

  return (
    <div className="bg-[#1a1d2e] rounded-xl border border-gray-700/50 p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-100">Predicción</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${confidenceColors[prediction.confidence]}`}>
          Confianza: {confidenceLabels[prediction.confidence]}
        </span>
      </div>
      <div className="mb-5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          prediction.source === 'sportmonks'
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-gray-700/50 text-gray-400'
        }`}>
          {prediction.source === 'sportmonks' ? '⚡ Sportmonks AI' : '🔢 Modelo Heurístico'}
        </span>
      </div>

      {/* Probability Bars */}
      <div className="space-y-3 mb-6">
        {/* Home Win */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-300">{homeTeamName}</span>
            <span className="font-semibold text-white">
              {Math.round(prediction.homeWinProbability * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-indigo-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${prediction.homeWinProbability * 100}%` }}
            />
          </div>
        </div>

        {/* Draw */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-300">Empate</span>
            <span className="font-semibold text-white">
              {Math.round(prediction.drawProbability * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-gray-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${prediction.drawProbability * 100}%` }}
            />
          </div>
        </div>

        {/* Away Win */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-300">{awayTeamName}</span>
            <span className="font-semibold text-white">
              {Math.round(prediction.awayWinProbability * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="bg-rose-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${prediction.awayWinProbability * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Exact Score Prediction */}
      {exactScorePrediction && (
        <div className="mb-6">
          {/* Expected Goals */}
          <div className="flex items-center justify-between mb-4 p-3 bg-[#151823] rounded-lg border border-gray-700/30">
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 mb-0.5">Goles esperados</p>
              <p className="text-lg font-bold text-indigo-400">
                λ {exactScorePrediction.expectedGoals.home.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">{homeTeamName}</p>
            </div>
            <div className="w-px h-10 bg-gray-700/50" />
            <div className="text-center flex-1">
              <p className="text-xs text-gray-500 mb-0.5">Goles esperados</p>
              <p className="text-lg font-bold text-rose-400">
                λ {exactScorePrediction.expectedGoals.away.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">{awayTeamName}</p>
            </div>
          </div>

          {/* Top Exact Scores */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-200 mb-3">Marcadores más probables</p>
            <div className="space-y-2">
              {exactScorePrediction.topExactScores.map((score, idx) => (
                <div
                  key={score.score}
                  className={`flex items-center justify-between p-2.5 rounded-lg border ${
                    idx === 0
                      ? 'bg-indigo-500/10 border-indigo-500/30'
                      : 'bg-[#151823] border-gray-700/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${
                      idx === 0 ? 'bg-indigo-500/30 text-indigo-300' : 'bg-gray-700/50 text-gray-400'
                    }`}>
                      {idx + 1}
                    </span>
                    <span className={`text-base font-bold tabular-nums ${
                      idx === 0 ? 'text-white' : 'text-gray-200'
                    }`}>
                      {score.score}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${idx === 0 ? 'bg-indigo-500' : 'bg-gray-500'}`}
                        style={{ width: `${Math.min(score.probability * 100 * 5, 100)}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold tabular-nums min-w-[3rem] text-right ${
                      idx === 0 ? 'text-indigo-300' : 'text-gray-300'
                    }`}>
                      {(score.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Markets: O/U and BTTS */}
          <div className="grid grid-cols-2 gap-3">
            {/* Over/Under 2.5 */}
            <div className="bg-[#151823] rounded-lg border border-gray-700/30 p-3">
              <p className="text-xs text-gray-500 mb-2">Más/Menos 2.5</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Over</span>
                <span className="font-semibold text-white">
                  {((exactScorePrediction.totals.find(t => t.line === 2.5)?.over ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-300">Under</span>
                <span className="font-semibold text-white">
                  {((exactScorePrediction.totals.find(t => t.line === 2.5)?.under ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            {/* BTTS */}
            <div className="bg-[#151823] rounded-lg border border-gray-700/30 p-3">
              <p className="text-xs text-gray-500 mb-2">Ambos anotan</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-300">Sí</span>
                <span className="font-semibold text-white">
                  {(exactScorePrediction.btts.yes * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-300">No</span>
                <span className="font-semibold text-white">
                  {(exactScorePrediction.btts.no * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Model badge */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
              {exactScorePrediction.model}
            </span>
            <span className="text-xs text-gray-500">
              Masa prob: {(exactScorePrediction.metadata.totalProbabilityMass * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 mb-5">
        <p className="text-sm font-medium text-indigo-300 mb-1">Recomendación</p>
        <p className="text-sm text-indigo-200">{prediction.recommendation}</p>
      </div>

      {/* Factors */}
      {prediction.factors.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-300 mb-2">Factores considerados:</p>
          <div className="space-y-2">
            {prediction.factors.map((factor, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  factor.impact === 'positive_home' ? 'bg-indigo-500' :
                  factor.impact === 'positive_away' ? 'bg-rose-500' :
                  'bg-gray-400'
                }`} />
                <div>
                  <p className="text-xs font-medium text-gray-300">{factor.name}</p>
                  <p className="text-xs text-gray-500">{factor.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-700/30">
        * Predicción basada en modelo heurístico. No constituye consejo de apuestas.
      </p>
    </div>
  );
}
