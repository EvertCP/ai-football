'use client';

import { Prediction } from '@/types/sportmonks';

interface PredictionPanelProps {
  prediction: Prediction | null;
  isLoading: boolean;
  error: string | null;
  homeTeamName: string;
  awayTeamName: string;
}

/**
 * PredictionPanel Component
 * Displays match prediction with probability bars and recommendation.
 * 
 * TODO: Future enhancements:
 * - Add animated probability bars
 * - Show historical accuracy percentage
 * - Add comparison with bookmaker odds
 * - Add "save prediction" button (requires auth + DB)
 * - Show confidence interval visualization
 * - Add predicted scoreline
 * - Compare ML model vs heuristic predictions
 */
export default function PredictionPanel({
  prediction,
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
