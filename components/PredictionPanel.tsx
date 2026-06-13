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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Predicción</h3>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-16 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Predicción</h3>
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Predicción</h3>
        <p className="text-sm text-gray-500">No hay predicción disponible.</p>
      </div>
    );
  }

  const confidenceColors = {
    low: 'bg-yellow-100 text-yellow-800',
    medium: 'bg-blue-100 text-blue-800',
    high: 'bg-green-100 text-green-800',
  };

  const confidenceLabels = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">Predicción</h3>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${confidenceColors[prediction.confidence]}`}>
          Confianza: {confidenceLabels[prediction.confidence]}
        </span>
      </div>
      <div className="mb-5">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          prediction.source === 'sportmonks'
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-gray-100 text-gray-600'
        }`}>
          {prediction.source === 'sportmonks' ? '⚡ Sportmonks AI' : '🔢 Modelo Heurístico'}
        </span>
      </div>

      {/* Probability Bars */}
      <div className="space-y-3 mb-6">
        {/* Home Win */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">{homeTeamName}</span>
            <span className="font-semibold text-gray-900">
              {Math.round(prediction.homeWinProbability * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${prediction.homeWinProbability * 100}%` }}
            />
          </div>
        </div>

        {/* Draw */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">Empate</span>
            <span className="font-semibold text-gray-900">
              {Math.round(prediction.drawProbability * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-gray-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${prediction.drawProbability * 100}%` }}
            />
          </div>
        </div>

        {/* Away Win */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium text-gray-700">{awayTeamName}</span>
            <span className="font-semibold text-gray-900">
              {Math.round(prediction.awayWinProbability * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-rose-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${prediction.awayWinProbability * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-5">
        <p className="text-sm font-medium text-indigo-900 mb-1">Recomendación</p>
        <p className="text-sm text-indigo-700">{prediction.recommendation}</p>
      </div>

      {/* Factors */}
      {prediction.factors.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Factores considerados:</p>
          <div className="space-y-2">
            {prediction.factors.map((factor, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  factor.impact === 'positive_home' ? 'bg-indigo-500' :
                  factor.impact === 'positive_away' ? 'bg-rose-500' :
                  'bg-gray-400'
                }`} />
                <div>
                  <p className="text-xs font-medium text-gray-700">{factor.name}</p>
                  <p className="text-xs text-gray-500">{factor.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-gray-100">
        * Predicción basada en modelo heurístico. No constituye consejo de apuestas.
      </p>
    </div>
  );
}
