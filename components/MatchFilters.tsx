'use client';

import { useState } from 'react';
import { getLocalDateString } from '@/lib/formatDate';

interface MatchFiltersProps {
  onDateChange: (date: string) => void;
  currentDate: string;
  isLoading: boolean;
}

/**
 * MatchFilters Component
 * Provides date selection and quick navigation for match filtering.
 * 
 * TODO: Future enhancements:
 * - Add league/country filter dropdowns
 * - Add status filter (live, upcoming, finished)
 * - Add search by team name
 * - Add favorite leagues quick access
 * - Save user filter preferences
 */
export default function MatchFilters({ onDateChange, currentDate, isLoading }: MatchFiltersProps) {
  const [inputDate, setInputDate] = useState(currentDate);

  const handleDateChange = (newDate: string) => {
    setInputDate(newDate);
    onDateChange(newDate);
  };

  // Quick navigation buttons
  const getRelativeDate = (daysOffset: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return getLocalDateString(date);
  };

  const quickDates = [
    { label: 'Ayer', date: getRelativeDate(-1) },
    { label: 'Hoy', date: getRelativeDate(0) },
    { label: 'Mañana', date: getRelativeDate(1) },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Date Input */}
        <div className="flex items-center gap-2">
          <label htmlFor="match-date" className="text-sm font-medium text-gray-700">
            Fecha:
          </label>
          <input
            id="match-date"
            type="date"
            value={inputDate}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={isLoading}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Quick Date Buttons */}
        <div className="flex items-center gap-2">
          {quickDates.map(({ label, date }) => (
            <button
              key={label}
              onClick={() => handleDateChange(date)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                inputDate === date
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-500">Cargando...</span>
          </div>
        )}
      </div>
    </div>
  );
}
