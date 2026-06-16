'use client';

import { useMemo, useRef, useEffect } from 'react';
import { getLocalDateString } from '@/lib/formatDate';

interface DateCalendarProps {
  selectedDate: string; // YYYY-MM-DD
  onDateChange: (date: string) => void;
}

/**
 * Horizontal date calendar strip.
 * Shows 9 days centered around the selected date with navigation arrows.
 */
export default function DateCalendar({ selectedDate, onDateChange }: DateCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to center the selected day on mount and when selection changes
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const selectedEl = container.querySelector('[data-selected="true"]') as HTMLElement;
    if (selectedEl) {
      const containerWidth = container.offsetWidth;
      const elLeft = selectedEl.offsetLeft;
      const elWidth = selectedEl.offsetWidth;
      container.scrollLeft = elLeft - (containerWidth / 2) + (elWidth / 2);
    }
  }, [selectedDate]);

  const days = useMemo(() => {
    const center = new Date(selectedDate + 'T12:00:00');
    const result: { date: string; label: string; dayName: string; isToday: boolean }[] = [];

    const today = getLocalDateString();

    for (let i = -4; i <= 4; i++) {
      const d = new Date(center);
      d.setDate(d.getDate() + i);
      const dateStr = getLocalDateString(d);
      const dayName = d.toLocaleDateString('es-MX', { weekday: 'short' });
      const label = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      result.push({
        date: dateStr,
        label,
        dayName,
        isToday: dateStr === today,
      });
    }
    return result;
  }, [selectedDate]);

  const goBack = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 5);
    onDateChange(getLocalDateString(d));
  };

  const goForward = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 5);
    onDateChange(getLocalDateString(d));
  };

  const goToToday = () => {
    onDateChange(getLocalDateString());
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Calendario</h3>
        <button
          onClick={goToToday}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Hoy
        </button>
      </div>
      <div className="flex items-center gap-1">
        {/* Left arrow */}
        <button
          onClick={goBack}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Days */}
        <div ref={scrollRef} className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide scroll-smooth">
          {days.map((day) => {
            const isSelected = day.date === selectedDate;
            return (
              <button
                key={day.date}
                data-selected={isSelected}
                onClick={() => onDateChange(day.date)}
                className={`flex flex-col items-center px-2 py-1.5 rounded-lg transition-all min-w-[60px] flex-shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : day.isToday
                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`text-[10px] font-medium capitalize ${isSelected ? 'text-indigo-100' : 'text-gray-400'}`}>
                  {day.dayName}
                </span>
                <span className={`text-xs font-semibold ${isSelected ? 'text-white' : ''}`}>
                  {day.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right arrow */}
        <button
          onClick={goForward}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
